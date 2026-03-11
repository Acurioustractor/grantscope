#!/usr/bin/env node

/**
 * Backfill postcodes + ABNs for indigenous_corp entities from ORIC CSV
 *
 * Downloads the latest ORIC register CSV from data.gov.au, matches by name
 * to gs_entities, and updates postcode/state/abn where missing.
 * Then enriches with remoteness/LGA/SEIFA from postcode_geo.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-postcodes-from-oric.mjs
 *   node --env-file=.env scripts/backfill-postcodes-from-oric.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const log = (msg) => console.log(`[oric-backfill] ${msg}`);

const CKAN_URL = 'https://data.gov.au/data/api/3/action/package_show?id=2c072eed-d6d3-4f3a-a6d2-8929b0c78682';

function normaliseState(state) {
  if (!state) return null;
  const s = state.trim().toUpperCase();
  const map = {
    'QUEENSLAND': 'QLD', 'QLD': 'QLD',
    'NEW SOUTH WALES': 'NSW', 'NSW': 'NSW',
    'VICTORIA': 'VIC', 'VIC': 'VIC',
    'WESTERN AUSTRALIA': 'WA', 'WA': 'WA',
    'SOUTH AUSTRALIA': 'SA', 'SA': 'SA',
    'TASMANIA': 'TAS', 'TAS': 'TAS',
    'NORTHERN TERRITORY': 'NT', 'NT': 'NT',
    'AUSTRALIAN CAPITAL TERRITORY': 'ACT', 'ACT': 'ACT',
  };
  return map[s] || s;
}

async function run() {
  // Step 1: Get entities missing postcodes
  log('Loading entities missing postcodes...');
  const { data: entities, error } = await supabase
    .from('gs_entities')
    .select('id, canonical_name, abn, state')
    .eq('entity_type', 'indigenous_corp')
    .is('postcode', null)
    .limit(5000);

  if (error) { console.error(error); return; }
  if (!entities.length) { log('No indigenous corps missing postcodes!'); return; }

  log(`${entities.length} indigenous corps missing postcodes`);

  // Step 2: Download latest ORIC CSV
  log('Fetching ORIC CSV...');
  const ckanRes = await fetch(CKAN_URL, { headers: { 'User-Agent': 'CivicGraph/1.0' } });
  const ckanJson = await ckanRes.json();
  const csvResources = ckanJson.result.resources
    .filter(r => r.format?.toLowerCase() === 'csv' || r.url?.endsWith('.csv'))
    .sort((a, b) => new Date(b.last_modified || b.created || 0) - new Date(a.last_modified || a.created || 0));

  // Build ORIC lookup from all CSV snapshots
  const oricByName = new Map();
  const oricByAbn = new Map();

  for (const resource of csvResources) {
    log(`Downloading: ${resource.name}...`);
    try {
      const csvRes = await fetch(resource.url, { headers: { 'User-Agent': 'CivicGraph/1.0' } });
      if (!csvRes.ok) { log(`  Skip: HTTP ${csvRes.status}`); continue; }
      const csvText = await csvRes.text();
      const records = parse(csvText, {
        columns: true, skip_empty_lines: true, trim: true,
        relax_column_count: true, relax_quotes: true,
      });

      let added = 0;
      for (const r of records) {
        const name = r['Corporation Name']?.trim();
        const postcode = r['Postcode (Main place of business) (Address)']?.trim();
        const state = r['State/Territory (Main place of business) (Address)']?.trim();
        const abn = r['ABN']?.trim()?.replace(/\s/g, '');
        if (!name || !postcode) continue;

        const key = name.toLowerCase();
        if (!oricByName.has(key)) {
          oricByName.set(key, { name, postcode, state: normaliseState(state), abn });
          added++;
        }
        if (abn && !oricByAbn.has(abn)) {
          oricByAbn.set(abn, { name, postcode, state: normaliseState(state), abn });
        }
      }
      log(`  ${records.length} records, ${added} new names added to lookup`);
    } catch (err) {
      log(`  Skip: ${err.message}`);
    }
  }

  log(`\nORIC lookup: ${oricByName.size} unique names, ${oricByAbn.size} unique ABNs`);

  // Step 3: Match
  const matches = [];
  let exactMatch = 0, abnMatch = 0, noMatch = 0;

  for (const e of entities) {
    const key = e.canonical_name.toLowerCase();
    let oric = oricByName.get(key);

    if (!oric && e.abn) {
      oric = oricByAbn.get(e.abn);
      if (oric) abnMatch++;
    }

    if (oric) {
      if (!oric._countedAbn) exactMatch++;
      matches.push({
        id: e.id,
        postcode: oric.postcode,
        state: oric.state || e.state,
        abn: oric.abn || e.abn,
        name: e.canonical_name,
      });
    } else {
      noMatch++;
    }
  }

  log(`\n=== Match results ===`);
  log(`Exact name match: ${exactMatch}`);
  log(`ABN match: ${abnMatch}`);
  log(`No match: ${noMatch}`);
  log(`Total to update: ${matches.length}`);

  if (matches.length === 0) { log('No matches found.'); return; }

  // Show samples
  for (const m of matches.slice(0, 5)) {
    log(`  ${m.name} → ${m.postcode} ${m.state}`);
  }

  if (!APPLY) {
    log(`\nDry run complete. Run with --apply to update the database.`);
    return;
  }

  // Step 4: Apply via Supabase client in batches
  log('\nApplying updates...');
  let updated = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE);

    for (const m of batch) {
      const updateData = { postcode: m.postcode };
      if (m.state) updateData.state = m.state;
      if (m.abn) updateData.abn = m.abn;

      const { error: updateErr } = await supabase
        .from('gs_entities')
        .update(updateData)
        .eq('id', m.id)
        .is('postcode', null);

      if (updateErr) {
        log(`  Error updating ${m.name}: ${updateErr.message}`);
      } else {
        updated++;
      }
    }

    log(`  Updated ${updated} / ${matches.length}`);
  }

  // Step 5: Enrich with postcode_geo (remoteness, LGA, SEIFA)
  log('\nEnriching with postcode_geo...');
  const enrichSql = `UPDATE gs_entities e SET
  remoteness = pg.remoteness_2021,
  lga_name = pg.lga_name,
  lga_code = pg.lga_code,
  seifa_irsd_decile = s.decile_national
FROM postcode_geo pg
LEFT JOIN seifa_2021 s ON s.postcode = pg.postcode AND s.index_type = 'irsd'
WHERE e.postcode = pg.postcode
  AND e.entity_type = 'indigenous_corp'
  AND e.remoteness IS NULL
  AND pg.postcode IS NOT NULL;`;

  const enrichFile = '/tmp/oric-enrich.sql';
  writeFileSync(enrichFile, enrichSql);
  try {
    execSync(
      `source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f ${enrichFile}`,
      { encoding: 'utf8', shell: '/bin/bash', cwd: process.cwd() }
    );
    log('  Enrichment applied.');
  } catch (err) {
    log(`  Enrichment error: ${err.message}`);
  }
  unlinkSync(enrichFile);

  // Final stats
  const { count: totalCount } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true });
  const { count: withPostcode } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true }).not('postcode', 'is', null);
  const { count: stillMissing } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true }).is('postcode', null);

  log(`\n=== Final coverage ===`);
  log(`Total entities: ${totalCount}`);
  log(`With postcode: ${withPostcode} (${Math.round(withPostcode/totalCount*100)}%)`);
  log(`Still missing: ${stillMissing}`);
}

run().catch(err => {
  console.error('[oric-backfill] Fatal:', err);
  process.exit(1);
});
