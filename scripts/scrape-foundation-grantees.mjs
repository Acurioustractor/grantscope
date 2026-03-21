#!/usr/bin/env node

/**
 * Foundation Grantee Scraper — Bulk automated scraping of foundation grantee lists
 *
 * Strategy:
 *   1. For each foundation with a website, fetch the home page
 *   2. Discover the grants/impact/partners/annual-report page via link analysis
 *   3. Fetch that page and extract organization names
 *   4. Match orgs to gs_entities and create grant relationships
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-foundation-grantees.mjs [--apply] [--limit=10] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '20');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function curl(url, timeout = 15) {
  try {
    const escaped = url.replace(/'/g, "'\\''");
    return execSync(
      `curl -sL --max-time ${timeout} --max-redirs 3 -H 'User-Agent: CivicGraph/1.0 (research)' '${escaped}'`,
      { encoding: 'utf8', maxBuffer: 3 * 1024 * 1024, timeout: (timeout + 5) * 1000 }
    );
  } catch { return null; }
}

// ─── Find grants/impact page from homepage ───────────────────────────────────

function discoverGrantsPage(html, baseUrl) {
  if (!html) return null;

  // Keywords that indicate a grantee list page
  const keywords = [
    'grants-database', 'grants-approved', 'who-we-fund', 'what-we-fund',
    'our-grants', 'funded-projects', 'grantee', 'partner', 'impact',
    'annual-report', 'funded', 'where-we-invest', 'our-work',
    'what-we-support', 'who-we-support', 'recipients', 'investments',
  ];

  // Extract all <a href> links
  const linkRegex = /href=["']([^"']+)["'][^>]*>([^<]*)</gi;
  const links = [];
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].toLowerCase().trim();
    links.push({ href, text });
  }

  // Score each link
  const scored = links.map(link => {
    let score = 0;
    const hrefLower = link.href.toLowerCase();

    for (const kw of keywords) {
      if (hrefLower.includes(kw)) score += 3;
      if (link.text.includes(kw.replace(/-/g, ' '))) score += 2;
    }

    // Bonus for "partners" or "who we fund" in link text
    if (link.text.includes('partner')) score += 4;
    if (link.text.includes('who we fund') || link.text.includes('what we fund')) score += 5;
    if (link.text.includes('grants database') || link.text.includes('grants approved')) score += 5;
    if (link.text.includes('funded') || link.text.includes('grantee')) score += 4;
    if (link.text.includes('annual report')) score += 3;
    if (link.text.includes('impact')) score += 2;

    // Penalize non-relevant
    if (hrefLower.includes('apply') || hrefLower.includes('login') || hrefLower.includes('contact')) score -= 3;
    if (hrefLower.includes('privacy') || hrefLower.includes('terms') || hrefLower.includes('faq')) score -= 5;

    return { ...link, score };
  }).filter(l => l.score > 0);

  scored.sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  // Resolve relative URL
  const best = scored[0];
  try {
    return new URL(best.href, baseUrl).href;
  } catch {
    return null;
  }
}

// ─── Extract org names from a page ───────────────────────────────────────────

function extractOrgNames(html) {
  if (!html) return [];

  const orgs = new Set();

  // Strategy 1: Look for structured lists of orgs
  // Many foundation sites use <h3>, <h4>, <strong>, or <li> for grantee names
  const patterns = [
    // Organization names in headings
    /<h[23456][^>]*>([^<]{5,80})<\/h[23456]>/gi,
    // Bold/strong names in lists
    /<strong>([^<]{5,80})<\/strong>/gi,
    // List items that look like org names
    /<li[^>]*>([A-Z][^<]{4,80})<\/li>/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (looksLikeOrgName(text)) {
        orgs.add(text);
      }
    }
  }

  return [...orgs];
}

function looksLikeOrgName(text) {
  if (!text || text.length < 4 || text.length > 120) return false;
  // Must start with uppercase
  if (!/^[A-Z]/.test(text)) return false;
  // Skip dates, numbers, common non-org patterns
  if (/^\d{4}/.test(text)) return false;
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(text)) return false;
  if (/^(Read more|Learn more|View|Download|Click|Contact|Apply|Submit|Privacy|Terms|Back to|Loading)/i.test(text)) return false;
  if (/^(The |A |An )?(Latest|New|Recent|Our|Your|This|About|How|What|Why|When|Where)/.test(text)) return false;
  // Should have at least one word break
  if (!/\s/.test(text) && text.length < 15) return false;
  // Good signals
  const orgSignals = ['Foundation', 'Trust', 'Institute', 'Council', 'Association', 'Inc', 'Ltd',
    'University', 'Aboriginal', 'Corporation', 'Services', 'Centre', 'Society', 'Organisation',
    'Network', 'Alliance', 'Community', 'Australia'];
  const hasOrgSignal = orgSignals.some(s => text.includes(s));
  if (hasOrgSignal) return true;
  // If it's title case with 2+ words, it might be an org
  const words = text.split(/\s+/);
  if (words.length >= 2 && words.every(w => /^[A-Z]/.test(w) || /^(of|the|and|for|in|at|to)$/i.test(w))) return true;
  return false;
}

// ─── Match org name to entity ────────────────────────────────────────────────

async function matchOrgToEntity(name) {
  // Quick ACNC lookup
  const { data: acnc } = await db
    .from('acnc_charities')
    .select('abn, name')
    .ilike('name', `%${name.replace(/[%_]/g, '')}%`)
    .limit(3);

  if (acnc?.length) {
    for (const a of acnc) {
      const { data: entity } = await db
        .from('gs_entities')
        .select('id, canonical_name')
        .eq('abn', a.abn)
        .limit(1);
      if (entity?.length) return entity[0];
    }
  }

  // Direct entity search
  const clean = name.replace(/[%_()[\]]/g, '').trim();
  if (clean.length >= 5) {
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, canonical_name')
      .ilike('canonical_name', `%${clean}%`)
      .limit(3);

    if (entities?.length === 1) return entities[0];
    if (entities?.length > 1) {
      const exact = entities.find(e => e.canonical_name.toLowerCase() === name.toLowerCase());
      if (exact) return exact;
      return entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
    }
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('═══ Foundation Grantee Bulk Scraper ═══');
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}, Limit: ${LIMIT}`);

  // Get top foundations with websites
  const { data: foundations } = await db.rpc('exec_sql', {
    query: `SELECT f.name, f.acnc_abn, f.total_giving_annual, e.id as entity_id, e.website
            FROM foundations f
            JOIN gs_entities e ON e.abn = f.acnc_abn
            WHERE e.website IS NOT NULL AND e.website != ''
            AND f.total_giving_annual > 5000000
            AND (f.name ILIKE '%foundation%' OR f.name ILIKE '%trust%' OR f.name ILIKE '%philanthropic%')
            AND f.name NOT ILIKE '%university%' AND f.name NOT ILIKE '%education%'
            AND f.name NOT ILIKE '%church%' AND f.name NOT ILIKE '%catholic%'
            ORDER BY f.total_giving_annual DESC
            LIMIT ${LIMIT}`
  });

  if (!foundations?.length) {
    log('No foundations found');
    return;
  }

  log(`Processing ${foundations.length} foundations\n`);

  let totalEdges = 0;
  let totalOrgsFound = 0;
  let totalMatched = 0;

  for (const f of foundations) {
    log(`\n─── ${f.name} ($${(f.total_giving_annual / 1000000).toFixed(0)}M/yr) ───`);

    let website = f.website;
    if (!website.startsWith('http')) website = 'https://' + website;

    // Check existing edges
    const { data: existing } = await db
      .from('gs_relationships')
      .select('target_entity_id')
      .eq('source_entity_id', f.entity_id)
      .eq('relationship_type', 'grant');
    const existingTargets = new Set((existing || []).map(r => r.target_entity_id));

    if (existingTargets.size > 20) {
      log(`  Already has ${existingTargets.size} grant edges, skipping`);
      continue;
    }

    // Step 1: Fetch homepage
    const homepage = curl(website);
    if (!homepage) {
      log(`  Failed to fetch ${website}`);
      continue;
    }

    // Step 2: Discover grants page
    const grantsUrl = discoverGrantsPage(homepage, website);
    if (grantsUrl) {
      log(`  Found grants page: ${grantsUrl}`);
    }

    // Step 3: Extract org names from grants page (or homepage)
    let orgNames = [];
    if (grantsUrl) {
      const grantsPage = curl(grantsUrl);
      if (grantsPage) {
        orgNames = extractOrgNames(grantsPage);
      }
    }

    // Also extract from homepage
    const homeOrgs = extractOrgNames(homepage);
    const allOrgs = [...new Set([...orgNames, ...homeOrgs])];

    totalOrgsFound += allOrgs.length;
    log(`  Found ${allOrgs.length} potential org names (${orgNames.length} from grants page, ${homeOrgs.length} from homepage)`);

    if (VERBOSE && allOrgs.length) {
      for (const o of allOrgs.slice(0, 10)) log(`    • ${o}`);
      if (allOrgs.length > 10) log(`    ... and ${allOrgs.length - 10} more`);
    }

    // Step 4: Match orgs to entities
    let matched = 0, created = 0;
    for (const orgName of allOrgs) {
      const entity = await matchOrgToEntity(orgName);
      if (!entity) continue;
      if (existingTargets.has(entity.id)) continue;
      if (entity.id === f.entity_id) continue; // Skip self-links

      matched++;
      totalMatched++;

      if (APPLY) {
        const { error } = await db
          .from('gs_relationships')
          .insert({
            source_entity_id: f.entity_id,
            target_entity_id: entity.id,
            relationship_type: 'grant',
            dataset: 'foundation_grantees',
            year: 2024,
            confidence: 'inferred',
            properties: { source: 'web_scrape', foundation: f.name },
          });

        if (!error) {
          created++;
          totalEdges++;
          existingTargets.add(entity.id);
        }
      }

      if (VERBOSE) log(`    ✓ "${orgName}" → "${entity.canonical_name}"`);
    }

    log(`  Matched: ${matched}, Created: ${APPLY ? created : matched} edges`);

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  log('\n═══ SUMMARY ═══');
  log(`  Foundations processed: ${foundations.length}`);
  log(`  Org names discovered: ${totalOrgsFound}`);
  log(`  Matched to entities: ${totalMatched}`);
  log(`  Grant edges created: ${totalEdges}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
