#!/usr/bin/env node
/**
 * link-corporate-groups.mjs
 *
 * Links subsidiary → parent corporate relationships using ABR trading names.
 *
 * Strategy:
 *   1. Fetch all gs_entities with ABR trading names (via psql — no timeout)
 *   2. Match trading names against gs_entity canonical names in memory
 *   3. Insert subsidiary_of relationships
 *
 * Safe: dry-run by default, use --live to insert.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LIVE = process.argv.includes('--live');

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}`);
  return data;
}

/** Run query via psql --csv (no statement timeout) */
function psql(query) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/cg-query-${Date.now()}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(
      `psql "${connStr}" --csv -f ${tmpFile} 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024, timeout: 120000 }
    );
    unlinkSync(tmpFile);
    const lines = result.trim().split('\n').filter(l => l.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { vals.push(cur); cur = ''; continue; }
        cur += ch;
      }
      vals.push(cur);
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    console.error('psql error:', err.message?.slice(0, 200));
    return [];
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`Corporate Group Linker — ${LIVE ? 'LIVE' : 'DRY RUN'}`);
  console.log('='.repeat(60));

  // ── Step 1: Get all entity ABNs ──
  console.log('\n=== Step 1: Fetching entity ABNs ===');
  const allEntities = psql(`
    SELECT id, abn, canonical_name FROM gs_entities WHERE abn IS NOT NULL
  `);
  console.log(`  ${allEntities.length} entities`);

  // Build ABN set for fast lookup
  const entityByAbn = new Map();
  for (const e of allEntities) {
    entityByAbn.set(e.abn, e);
  }

  // ── Step 2: Get ABR trading names for those ABNs (batch via temp table) ──
  console.log('\n=== Step 2: Fetching ABR trading names ===');
  // Write ABNs to temp file, create temp table, join
  const abnList = [...entityByAbn.keys()];
  const batchSize = 50000;
  const entitiesWithTrades = [];

  for (let i = 0; i < abnList.length; i += batchSize) {
    const batch = abnList.slice(i, i + batchSize);
    const inClause = batch.map(a => `'${a}'`).join(',');
    const rows = psql(`
      SELECT abn, array_to_string(trading_names, '|||') as trades
      FROM abr_registry
      WHERE abn IN (${inClause})
        AND trading_names IS NOT NULL
        AND array_length(trading_names, 1) > 0
    `);
    for (const r of rows) {
      const entity = entityByAbn.get(r.abn);
      if (entity) {
        entitiesWithTrades.push({ ...entity, trades: r.trades });
      }
    }
    if ((i / batchSize) % 2 === 0) {
      process.stdout.write(`  batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(abnList.length / batchSize)} (${entitiesWithTrades.length} with trades)\r`);
    }
  }
  console.log(`\n  ${entitiesWithTrades.length} entities have ABR trading names`);

  const nameIndex = new Map();
  for (const e of allEntities) {
    const key = e.canonical_name.toUpperCase().trim();
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    nameIndex.get(key).push(e);
  }

  // ── Step 3: Match trading names → entity names ──
  console.log('\n=== Step 3: Matching trading names to entities ===');
  const links = [];
  let branchCount = 0;

  for (const parent of entitiesWithTrades) {
    if (!parent.trades) continue;
    const tradeNames = parent.trades.split('|||').map(t => t.trim()).filter(Boolean);

    for (const tradeName of tradeNames) {
      if (/\b(branch|division)\b/i.test(tradeName)) branchCount++;

      const key = tradeName.toUpperCase().trim();
      const matches = nameIndex.get(key) || [];
      for (const child of matches) {
        if (child.abn === parent.abn || child.id === parent.id) continue;
        // Skip if parent and child have the same canonical name — that's a duplicate entity, not a subsidiary
        if (child.canonical_name.toUpperCase().trim() === parent.canonical_name.toUpperCase().trim()) continue;
        // Skip generic church/parish name collisions
        const tradeLower = tradeName.toLowerCase();
        if (/^(st |saint |holy |our lady|christ |church of|baptist church|catholic church|uniting church|anglican |lutheran church|methodist)/.test(tradeLower)
            && child.canonical_name.toUpperCase() === key) continue;
        links.push({
          parent_entity_id: parent.id,
          parent_name: parent.canonical_name,
          parent_abn: parent.abn,
          child_entity_id: child.id,
          child_name: child.canonical_name,
          child_abn: child.abn,
          trade_name: tradeName,
        });
      }
    }
  }

  console.log(`  ${branchCount} branch/division trading names found`);
  console.log(`  ${links.length} trading-name → entity matches`);

  if (links.length > 0) {
    console.log('\n  Sample links:');
    for (const l of links.slice(0, 25)) {
      console.log(`    ${l.child_name} (${l.child_abn})`);
      console.log(`      ← subsidiary_of ← ${l.parent_name} (${l.parent_abn})`);
      console.log(`      via: "${l.trade_name}"`);
    }
  }

  // ── Step 4: Insert relationships ──
  let inserted = 0;
  let skipped = 0;

  if (LIVE && links.length > 0) {
    console.log('\n=== Step 4: Inserting relationships ===');
    for (const link of links) {
      try {
        // Check existing via Supabase client
        const { data: existing } = await supabase
          .from('gs_relationships')
          .select('id')
          .eq('source_entity_id', link.child_entity_id)
          .eq('target_entity_id', link.parent_entity_id)
          .eq('relationship_type', 'subsidiary_of')
          .limit(1);
        if (existing && existing.length > 0) { skipped++; continue; }

        // Insert via Supabase client
        const { error } = await supabase.from('gs_relationships').insert({
          source_entity_id: link.child_entity_id,
          target_entity_id: link.parent_entity_id,
          relationship_type: 'subsidiary_of',
          dataset: 'abr_corporate_groups',
          confidence: 'inferred',
        });
        if (error) throw error;
        inserted++;
        console.log(`  ✓ ${link.child_name} → subsidiary_of → ${link.parent_name}`);
      } catch (err) {
        console.log(`  ✗ ${link.child_name}: ${err.message?.slice(0, 80)}`);
        skipped++;
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Entities with trading names: ${entitiesWithTrades.length}`);
  console.log(`Branch/division names: ${branchCount}`);
  console.log(`Trading-name → entity links: ${links.length}`);
  if (LIVE) console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

  if (!LIVE) {
    console.log('\n⚠️  DRY RUN — no changes made. Use --live to insert.');
  }

  try {
    const runId = await logStart('link-corporate-groups', 'Corporate Group Linker');
    await logComplete(runId, { itemsFound: links.length, itemsNew: inserted });
  } catch { /* non-critical */ }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
