#!/usr/bin/env node

/**
 * Ian Potter Foundation Grants Database Scraper
 *
 * Scrapes the full grants database (1964-present, ~10,000 grants)
 * from ianpotter.org.au/knowledge-centre/grants-database/
 *
 * Outputs a JSON file with all grants, then optionally matches
 * grantees to gs_entities and creates grant relationship edges.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-ian-potter-grants.mjs [--apply] [--verbose] [--limit=100]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const SCRAPE_ONLY = process.argv.includes('--scrape-only');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function curl(url, timeout = 20) {
  try {
    const escaped = url.replace(/'/g, "\\'");
    return execSync(
      `curl -sL --max-time ${timeout} --max-redirs 3 -H 'User-Agent: CivicGraph/1.0 (research)' '${escaped}'`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: (timeout + 5) * 1000 }
    );
  } catch { return null; }
}

// ─── Extract grants from a page of HTML ──────────────────────────────────────

function extractGrants(html) {
  if (!html) return [];

  const grants = [];
  // Split by grant cards
  const cards = html.split('grant-card divided-card');

  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    const grant = {};

    // Extract title
    const titleMatch = card.match(/grant-card__title">([^<]+)/);
    if (titleMatch) grant.title = titleMatch[1].trim().replace(/&amp;/g, '&');

    // Extract dt/dd pairs
    const dtddRegex = /<dt>([^<]+)<\/dt>\s*<dd>([^<]+)<\/dd>/gi;
    let m;
    while ((m = dtddRegex.exec(card)) !== null) {
      const key = m[1].trim().toLowerCase();
      const val = m[2].trim();
      if (key === 'grantee') grant.grantee = val;
      if (key === 'grant') grant.amount = val;
      if (key === 'year granted') grant.year = parseInt(val);
      if (key === 'program area') grant.program = val;
      if (key === 'project state') grant.state = val;
    }

    if (grant.grantee) grants.push(grant);
  }

  return grants;
}

// ─── Parse dollar amount ─────────────────────────────────────────────────────

function parseAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/[$,\s]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

// ─── Match grantee to entity ─────────────────────────────────────────────────

async function matchGrantee(name) {
  if (!name || name.length < 3) return null;

  // Clean the name for searching
  const clean = name.replace(/[()[\]\\\/]/g, '').trim();
  if (clean.length < 4) return null;

  // Strategy 1: Direct entity ILIKE
  try {
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn')
      .ilike('canonical_name', `%${clean}%`)
      .limit(5);

    if (entities?.length === 1) return entities[0];
    if (entities?.length > 1) {
      // Exact match first
      const exact = entities.find(e => e.canonical_name.toLowerCase() === name.toLowerCase());
      if (exact) return exact;
      // Shortest match (most specific)
      return entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
    }
  } catch {}

  // Strategy 2: ACNC lookup
  try {
    const { data: acnc } = await db
      .from('acnc_charities')
      .select('abn, name')
      .ilike('name', `%${clean}%`)
      .limit(3);

    if (acnc?.length) {
      for (const a of acnc) {
        const { data: entity } = await db
          .from('gs_entities')
          .select('id, canonical_name, abn')
          .eq('abn', a.abn)
          .limit(1);
        if (entity?.length) return entity[0];
      }
    }
  } catch {}

  // Strategy 3: pg_trgm fuzzy (for misspellings, abbreviations)
  try {
    const escaped = name.replace(/'/g, "''");
    const { data: trgm } = await db.rpc('exec_sql', {
      query: `SELECT id, canonical_name, abn, similarity(canonical_name, '${escaped}') as sim
              FROM gs_entities WHERE canonical_name % '${escaped}'
              ORDER BY sim DESC LIMIT 1`
    });
    if (trgm?.length && trgm[0].sim >= 0.55) {
      return { id: trgm[0].id, canonical_name: trgm[0].canonical_name, abn: trgm[0].abn };
    }
  } catch {}

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('═══ Ian Potter Foundation Grants Scraper ═══');

  const CACHE_FILE = 'tmp/ian-potter-grants.json';

  let allGrants = [];

  // Check for cached scrape data
  if (existsSync(CACHE_FILE)) {
    log('Loading cached grant data...');
    allGrants = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    log(`Loaded ${allGrants.length} grants from cache`);
  } else {
    // Scrape the database
    const BASE = 'https://www.ianpotter.org.au/knowledge-centre/grants-database/';
    const PER_PAGE = 10;
    const TOTAL_APPROX = 10090;
    const maxPages = LIMIT > 0 ? Math.ceil(LIMIT / PER_PAGE) : Math.ceil(TOTAL_APPROX / PER_PAGE);

    log(`Scraping up to ${maxPages} pages (${maxPages * PER_PAGE} grants)...`);

    let emptyStreak = 0;
    for (let page = 0; page < maxPages; page++) {
      const start = page * PER_PAGE;
      const url = `${BASE}?start=${start}`;
      const html = curl(url);

      if (!html) {
        emptyStreak++;
        if (emptyStreak > 3) {
          log(`  3 consecutive failures at start=${start}, stopping`);
          break;
        }
        continue;
      }

      const grants = extractGrants(html);
      if (!grants.length) {
        emptyStreak++;
        if (emptyStreak > 3) {
          log(`  3 consecutive empty pages at start=${start}, stopping`);
          break;
        }
        continue;
      }

      emptyStreak = 0;
      allGrants.push(...grants);

      if (page > 0 && page % 50 === 0) {
        log(`  Progress: ${allGrants.length} grants scraped (page ${page}/${maxPages})`);
      }

      // Rate limit: 200ms between requests
      await new Promise(r => setTimeout(r, 200));
    }

    // Save to cache
    writeFileSync(CACHE_FILE, JSON.stringify(allGrants, null, 2));
    log(`Saved ${allGrants.length} grants to ${CACHE_FILE}`);
  }

  if (SCRAPE_ONLY) {
    log('Scrape-only mode, stopping here');
    printStats(allGrants);
    return;
  }

  // ─── Dedup grantees ──────────────────────────────────────────────────────
  const uniqueGrantees = [...new Set(allGrants.map(g => g.grantee).filter(Boolean))];
  log(`\nUnique grantees: ${uniqueGrantees.length}`);

  // Get Ian Potter entity
  const IAN_POTTER_ABN = '77950227010';
  const { data: ipEntity } = await db
    .from('gs_entities')
    .select('id, canonical_name')
    .eq('abn', IAN_POTTER_ABN)
    .limit(1);

  if (!ipEntity?.length) {
    log('ERROR: Ian Potter entity not found');
    return;
  }

  const foundationId = ipEntity[0].id;
  log(`Foundation: ${ipEntity[0].canonical_name} (${foundationId})`);

  // Check existing grant edges
  const { data: existing } = await db
    .from('gs_relationships')
    .select('target_entity_id')
    .eq('source_entity_id', foundationId)
    .eq('relationship_type', 'grant');

  const existingTargets = new Set((existing || []).map(r => r.target_entity_id));
  log(`Existing grant edges: ${existingTargets.size}`);
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  // ─── Match grantees ──────────────────────────────────────────────────────
  let matched = 0, created = 0, skipped = 0, notFound = 0;
  const unmatched = [];
  const matchedEdges = [];

  for (let i = 0; i < uniqueGrantees.length; i++) {
    const name = uniqueGrantees[i];
    const entity = await matchGrantee(name);

    if (!entity) {
      notFound++;
      unmatched.push(name);
      continue;
    }

    if (existingTargets.has(entity.id)) {
      skipped++;
      if (VERBOSE) log(`  ⊘ "${name}" → "${entity.canonical_name}" — exists`);
      continue;
    }

    if (entity.id === foundationId) continue;

    matched++;

    // Get all grants for this grantee
    const grantsForOrg = allGrants.filter(g => g.grantee === name);
    const totalAmount = grantsForOrg.reduce((sum, g) => sum + (parseAmount(g.amount) || 0), 0);
    const years = [...new Set(grantsForOrg.map(g => g.year).filter(Boolean))].sort();
    const programs = [...new Set(grantsForOrg.map(g => g.program).filter(Boolean))];

    if (VERBOSE) {
      log(`  ✓ "${name}" → "${entity.canonical_name}" (${grantsForOrg.length} grants, $${(totalAmount / 1000).toFixed(0)}K, ${years[0]}-${years[years.length - 1]})`);
    }

    if (APPLY) {
      // Create one edge per distinct year with amount
      for (const grant of grantsForOrg) {
        const amount = parseAmount(grant.amount);
        const { error } = await db
          .from('gs_relationships')
          .insert({
            source_entity_id: foundationId,
            target_entity_id: entity.id,
            relationship_type: 'grant',
            amount,
            year: grant.year,
            dataset: 'ian_potter_grants_db',
            confidence: 'reported',
            properties: {
              source: 'ian_potter_grants_database',
              title: grant.title,
              program: grant.program,
              state: grant.state,
              foundation: 'The Ian Potter Foundation',
            },
          });

        if (!error) {
          created++;
        } else if (VERBOSE) {
          log(`    Error: ${error.message}`);
        }
      }
      existingTargets.add(entity.id);
    } else {
      created += grantsForOrg.length;
    }

    if (i > 0 && i % 100 === 0) log(`  Progress: ${i}/${uniqueGrantees.length}`);
  }

  log('\n═══ MATCHING SUMMARY ═══');
  log(`  Unique grantees: ${uniqueGrantees.length}`);
  log(`  Matched to entities: ${matched}`);
  log(`  Skipped (existing): ${skipped}`);
  log(`  Not found: ${notFound}`);
  log(`  Grant edges created: ${created}`);

  if (unmatched.length && VERBOSE) {
    log(`\n  Unmatched grantees (${unmatched.length}):`);
    for (const u of unmatched.slice(0, 30)) log(`    • ${u}`);
    if (unmatched.length > 30) log(`    ... and ${unmatched.length - 30} more`);
  }

  printStats(allGrants);
}

function printStats(grants) {
  log('\n═══ DATABASE STATS ═══');
  log(`  Total grants: ${grants.length}`);

  const byYear = {};
  for (const g of grants) {
    const y = g.year || 'unknown';
    byYear[y] = (byYear[y] || 0) + 1;
  }
  const years = Object.keys(byYear).sort();
  log(`  Year range: ${years[0]} - ${years[years.length - 1]}`);
  log(`  Recent: ${byYear[2024] || 0} (2024), ${byYear[2025] || 0} (2025), ${byYear[2026] || 0} (2026)`);

  const totalAmount = grants.reduce((sum, g) => sum + (parseAmount(g.amount) || 0), 0);
  log(`  Total grant value: $${(totalAmount / 1000000).toFixed(0)}M`);

  const uniqueOrgs = new Set(grants.map(g => g.grantee).filter(Boolean));
  log(`  Unique grantees: ${uniqueOrgs.size}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
