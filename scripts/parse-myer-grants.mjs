#!/usr/bin/env node

/**
 * Myer Foundation Grant Parser
 *
 * Parses the structured grant tables from the Myer Foundation annual report PDF
 * using pdftotext output. Creates grant relationship edges in gs_relationships.
 *
 * Usage:
 *   node --env-file=.env scripts/parse-myer-grants.mjs [--apply] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function parseAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/[$,\s]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

// ─── Extract grants from pdftotext output ────────────────────────────────────

function extractGrants(text) {
  const grants = [];
  const lines = text.split('\n');

  // Pattern: OrgName  STATE  Project  YEAR  Term  $Amount  $FY24Amount
  // Matches lines with org names followed by state codes and dollar amounts
  const grantLineRegex = /^\s{2,}([A-Z][A-Za-z\s&''\-,.()]+?)\s{2,}(ACT|NSW|VIC|QLD|SA|WA|TAS|NT|National)\s+(.+?)\s+(20\d{2})\s+\w+\s+\$([\d,]+)/;

  // Also match continuation lines (where org name spans multiple lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(grantLineRegex);
    if (match) {
      const name = match[1].trim();
      const state = match[2];
      const project = match[3].trim();
      const year = parseInt(match[4]);

      // Extract all dollar amounts from the line
      const amounts = [...line.matchAll(/\$([\d,]+)/g)].map(m => parseAmount(m[1]));
      const totalAmount = amounts[0]; // First amount is total commitment
      const fy24Amount = amounts[1]; // Second is FY24 payment

      // Skip "Total" rows
      if (name === 'Total') continue;

      grants.push({
        name,
        state,
        project,
        year,
        total_amount: totalAmount,
        fy24_amount: fy24Amount,
      });
    }
  }

  return grants;
}

// Also add known grants from the Family Grants and smaller sections
const ADDITIONAL_MYER_GRANTS = [
  // From the Family Grants Program section
  { name: 'Foundation for Rural & Regional Renewal', state: 'VIC', amount: 25000 },
  { name: 'Australian Chamber Orchestra', state: 'NSW', amount: 7000 },
  // From Kenneth Myer Innovation Fellows section
  // (individuals, not orgs — skip)
];

// ─── Match grantee to entity ─────────────────────────────────────────────────

async function matchGrantee(name) {
  if (!name || name.length < 3) return null;
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
      const exact = entities.find(e => e.canonical_name.toLowerCase() === name.toLowerCase());
      if (exact) return exact;
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

  // Strategy 3: pg_trgm fuzzy
  try {
    const escaped = name.replace(/'/g, "''");
    const { data: trgm } = await db.rpc('exec_sql', {
      query: `SELECT id, canonical_name, abn, similarity(canonical_name, '${escaped}') as sim
              FROM gs_entities WHERE canonical_name % '${escaped}'
              ORDER BY sim DESC LIMIT 1`
    });
    if (trgm?.length && trgm[0].sim >= 0.5) {
      return { id: trgm[0].id, canonical_name: trgm[0].canonical_name, abn: trgm[0].abn };
    }
  } catch {}

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('═══ Myer Foundation Grant Parser ═══');
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  // Extract text from PDF
  const pdfPath = 'tmp/myer-annual-report-2024.pdf';
  let text;
  try {
    text = execSync(`pdftotext -layout '${pdfPath}' -`, {
      encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000,
    });
  } catch (e) {
    log(`ERROR: Failed to extract text from ${pdfPath}`);
    return;
  }
  log(`Extracted ${text.length} chars from PDF`);

  // Extract grants
  const grants = extractGrants(text);
  log(`Found ${grants.length} grants in PDF tables`);

  // Dedup by org name
  const byOrg = new Map();
  for (const g of grants) {
    if (!byOrg.has(g.name)) {
      byOrg.set(g.name, []);
    }
    byOrg.get(g.name).push(g);
  }
  log(`Unique grantees: ${byOrg.size}`);

  if (VERBOSE) {
    for (const [name, gs] of byOrg) {
      const totalAmt = gs.reduce((s, g) => s + (g.total_amount || 0), 0);
      log(`  ${name} (${gs[0].state}) — ${gs.length} grants, $${(totalAmt / 1000).toFixed(0)}K`);
    }
  }

  // Get Myer Foundation entity
  const MYER_ABN = '46100632395';
  const { data: myerEntity } = await db
    .from('gs_entities')
    .select('id, canonical_name')
    .eq('abn', MYER_ABN)
    .limit(1);

  if (!myerEntity?.length) {
    log('ERROR: Myer Foundation entity not found');
    return;
  }

  const foundationId = myerEntity[0].id;
  log(`Foundation: ${myerEntity[0].canonical_name}`);

  // Check existing edges
  const { data: existing } = await db
    .from('gs_relationships')
    .select('target_entity_id')
    .eq('source_entity_id', foundationId)
    .eq('relationship_type', 'grant');

  const existingTargets = new Set((existing || []).map(r => r.target_entity_id));
  log(`Existing edges: ${existingTargets.size}`);

  // Match and create edges
  let matched = 0, created = 0, notFound = 0;
  const unmatched = [];

  for (const [name, orgGrants] of byOrg) {
    const entity = await matchGrantee(name);

    if (!entity) {
      notFound++;
      unmatched.push(name);
      if (VERBOSE) log(`  ✗ "${name}" — no match`);
      continue;
    }

    if (existingTargets.has(entity.id) || entity.id === foundationId) {
      if (VERBOSE) log(`  ⊘ "${name}" → "${entity.canonical_name}" — exists/self`);
      continue;
    }

    matched++;
    const totalAmt = orgGrants.reduce((s, g) => s + (g.total_amount || 0), 0);
    if (VERBOSE) {
      log(`  ✓ "${name}" → "${entity.canonical_name}" ($${(totalAmt / 1000).toFixed(0)}K)`);
    }

    if (APPLY) {
      const { error } = await db
        .from('gs_relationships')
        .insert({
          source_entity_id: foundationId,
          target_entity_id: entity.id,
          relationship_type: 'grant',
          amount: totalAmt || null,
          year: 2024,
          dataset: 'myer_annual_report_2024',
          confidence: 'reported',
          properties: {
            source: 'annual_report_pdf',
            grants: orgGrants.map(g => ({
              project: g.project,
              year: g.year,
              total: g.total_amount,
              fy24: g.fy24_amount,
            })),
            foundation: 'The Myer Foundation',
          },
        });

      if (!error) {
        created++;
        existingTargets.add(entity.id);
      } else {
        log(`  Error: ${error.message}`);
      }
    }
  }

  log('\n═══ SUMMARY ═══');
  log(`  Grants in PDF: ${grants.length}`);
  log(`  Unique orgs: ${byOrg.size}`);
  log(`  Matched: ${matched}`);
  log(`  Created: ${APPLY ? created : matched} edges`);
  log(`  Not found: ${notFound}`);

  if (unmatched.length) {
    log(`\n  Unmatched orgs (${unmatched.length}):`);
    for (const u of unmatched) log(`    • ${u}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
