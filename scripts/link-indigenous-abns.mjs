#!/usr/bin/env node

/**
 * Indigenous Corp ABN Resolution — backfill ABNs from ORIC + ACNC
 *
 * Strategy:
 *   1. Exact name match: gs_entities.canonical_name → oric_corporations.name
 *   2. Normalized name match: strip suffixes (Aboriginal Corporation, Inc, Ltd, etc.)
 *   3. pg_trgm fuzzy match with high threshold (0.7+) for remaining
 *   4. Cross-reference ACNC for dual-registered Aboriginal orgs
 *
 * Usage:
 *   node --env-file=.env scripts/link-indigenous-abns.mjs [--apply] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function normalize(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(aboriginal|torres strait islander|corporation|incorporated|inc|ltd|limited|pty|co-operative|cooperative|association|assoc|the|of|and|for)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  log('═══ Indigenous Corp ABN Resolution ═══');
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  // Load all indigenous corps without ABN
  let noAbn = [];
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from('gs_entities')
      .select('id, canonical_name, gs_id, state')
      .eq('entity_type', 'indigenous_corp')
      .is('abn', null)
      .range(offset, offset + 999);
    if (error || !data?.length) break;
    noAbn.push(...data);
    if (data.length < 1000) break;
    offset += data.length;
  }
  log(`Found ${noAbn.length} indigenous corps without ABN`);

  // Load ALL ORIC corps into memory (only 7.3K)
  let oric = [];
  offset = 0;
  while (true) {
    const { data, error } = await db
      .from('oric_corporations')
      .select('name, abn, icn, state')
      .range(offset, offset + 999);
    if (error || !data?.length) break;
    oric.push(...data);
    if (data.length < 1000) break;
    offset += data.length;
  }
  log(`Loaded ${oric.length} ORIC corporations`);

  // Build ORIC indexes
  const oricByExact = new Map();
  const oricByNorm = new Map();
  for (const o of oric) {
    if (!o.abn) continue; // Skip ORIC records without ABN
    const exact = o.name?.toLowerCase().trim();
    const norm = normalize(o.name);
    if (exact && !oricByExact.has(exact)) oricByExact.set(exact, o);
    if (norm && norm.length > 3 && !oricByNorm.has(norm)) oricByNorm.set(norm, o);
  }
  log(`ORIC index: ${oricByExact.size} exact, ${oricByNorm.size} normalized (with ABN)`);

  // Load ACNC charities that are Aboriginal/Indigenous
  const { data: acncAboriginal } = await db.rpc('exec_sql', {
    query: `SELECT abn, name FROM acnc_charities WHERE name ILIKE '%aboriginal%' OR name ILIKE '%indigenous%' OR name ILIKE '%torres strait%' OR name ILIKE '%koori%' OR name ILIKE '%murri%'`
  });
  log(`ACNC Aboriginal/Indigenous charities: ${acncAboriginal?.length || 0}`);

  const acncByNorm = new Map();
  for (const a of (acncAboriginal || [])) {
    const norm = normalize(a.name);
    if (norm && norm.length > 3) acncByNorm.set(norm, a.abn);
  }

  // ─── Stage 1: Exact match ───
  log('\n--- Stage 1: Exact name match ---');
  let s1 = 0;
  const unmatched1 = [];

  for (const entity of noAbn) {
    const exact = entity.canonical_name?.toLowerCase().trim();
    const match = oricByExact.get(exact);
    if (match) {
      s1++;
      if (VERBOSE) log(`  EXACT: "${entity.canonical_name}" → ABN ${match.abn}`);
      if (APPLY) {
        await db.from('gs_entities').update({ abn: match.abn, updated_at: new Date().toISOString() }).eq('id', entity.id);
      }
    } else {
      unmatched1.push(entity);
    }
  }
  log(`  Matched ${s1} via exact name`);

  // ─── Stage 2: Normalized match ───
  log('\n--- Stage 2: Normalized name match ---');
  let s2 = 0;
  const unmatched2 = [];

  for (const entity of unmatched1) {
    const norm = normalize(entity.canonical_name);
    if (!norm || norm.length < 4) { unmatched2.push(entity); continue; }

    // Try ORIC first, then ACNC
    const oricMatch = oricByNorm.get(norm);
    if (oricMatch) {
      s2++;
      if (VERBOSE) log(`  NORM/ORIC: "${entity.canonical_name}" → "${oricMatch.name}" ABN ${oricMatch.abn}`);
      if (APPLY) {
        await db.from('gs_entities').update({ abn: oricMatch.abn, updated_at: new Date().toISOString() }).eq('id', entity.id);
      }
      continue;
    }

    const acncAbn = acncByNorm.get(norm);
    if (acncAbn) {
      s2++;
      if (VERBOSE) log(`  NORM/ACNC: "${entity.canonical_name}" → ABN ${acncAbn}`);
      if (APPLY) {
        await db.from('gs_entities').update({ abn: acncAbn, updated_at: new Date().toISOString() }).eq('id', entity.id);
      }
      continue;
    }

    unmatched2.push(entity);
  }
  log(`  Matched ${s2} via normalized name`);

  // ─── Stage 3: pg_trgm fuzzy match (batch via SQL) ───
  log('\n--- Stage 3: pg_trgm fuzzy match (threshold 0.7) ---');
  let s3 = 0;

  // Process in small batches to avoid timeout
  for (let i = 0; i < unmatched2.length; i++) {
    const entity = unmatched2[i];
    const name = entity.canonical_name?.replace(/'/g, "''");
    if (!name || name.length < 5) continue;

    try {
      const { data: matches } = await db.rpc('exec_sql', {
        query: `SELECT abn, name, similarity(name, '${name}') as sim
                FROM oric_corporations
                WHERE abn IS NOT NULL AND name % '${name}'
                ORDER BY sim DESC LIMIT 1`
      });

      if (matches?.length && matches[0].sim >= 0.7) {
        s3++;
        if (VERBOSE) log(`  FUZZY: "${entity.canonical_name}" → "${matches[0].name}" (sim=${matches[0].sim.toFixed(2)}) ABN ${matches[0].abn}`);
        if (APPLY) {
          await db.from('gs_entities').update({ abn: matches[0].abn, updated_at: new Date().toISOString() }).eq('id', entity.id);
        }
      }
    } catch (e) {
      // Skip timeout/errors
    }

    if (i > 0 && i % 200 === 0) log(`  Progress: ${i}/${unmatched2.length} (found ${s3})`);
  }
  log(`  Matched ${s3} via pg_trgm fuzzy`);

  // ─── Summary ───
  const total = s1 + s2 + s3;
  log('\n═══ SUMMARY ═══');
  log(`  Stage 1 (exact): ${s1}`);
  log(`  Stage 2 (normalized): ${s2}`);
  log(`  Stage 3 (fuzzy 0.7+): ${s3}`);
  log(`  Total ABNs resolved: ${total} / ${noAbn.length} (${((total / noAbn.length) * 100).toFixed(1)}%)`);
  log(`  Remaining without ABN: ${noAbn.length - total}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
