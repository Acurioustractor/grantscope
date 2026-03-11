#!/usr/bin/env node

/**
 * Backfill postcodes from ABR API for all entities missing them
 *
 * Strategy:
 * 1. Entities with ABN → direct ABR API lookup (returns postcode + state)
 * 2. Entities without ABN → ABR name search to find ABN, then lookup
 * 3. Government bodies → hardcode to capital city postcodes
 * 4. Enrich all with remoteness/LGA/SEIFA from postcode_geo
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-postcodes-from-abr-api.mjs
 *   node --env-file=.env scripts/backfill-postcodes-from-abr-api.mjs --apply
 *   node --env-file=.env scripts/backfill-postcodes-from-abr-api.mjs --apply --skip-name-search
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const SKIP_NAME_SEARCH = process.argv.includes('--skip-name-search');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const GUID = process.env.ABN_LOOKUP_GUID;
const log = (msg) => console.log(`[abr-api-backfill] ${msg}`);

const RATE_LIMIT_MS = 500; // ABR API rate limit

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupAbn(abn) {
  const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&guid=${GUID}`;
  const res = await fetch(url);
  const text = await res.text();
  try {
    const json = JSON.parse(text.replace(/^callback\(/, '').replace(/\)$/, ''));
    if (json.AddressPostcode && json.AddressPostcode !== '0000') {
      return { postcode: json.AddressPostcode, state: json.AddressState, abn };
    }
  } catch (e) { /* ignore parse errors */ }
  return null;
}

async function searchByName(name) {
  const cleanName = name.replace(/[""]/g, '"').replace(/\(.*\)/g, '').trim();
  const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(cleanName)}&maxResults=3&guid=${GUID}`;
  const res = await fetch(url);
  const text = await res.text();
  try {
    const json = JSON.parse(text.replace(/^callback\(/, '').replace(/\)$/, ''));
    if (json.Names && json.Names.length > 0) {
      // Find best match — must be high score and name must be similar
      const nameLower = cleanName.toLowerCase();
      for (const match of json.Names) {
        if (match.Score >= 90 && match.Postcode) {
          const matchName = match.Name.toLowerCase();
          // Check if substantial word overlap
          const nameWords = nameLower.split(/\s+/).filter(w => w.length > 3);
          const matchWords = matchName.split(/\s+/).filter(w => w.length > 3);
          const overlap = nameWords.filter(w => matchWords.includes(w)).length;
          if (overlap >= Math.min(2, nameWords.length)) {
            return {
              postcode: match.Postcode,
              state: match.State,
              abn: match.Abn,
              matchedName: match.Name,
              score: match.Score,
            };
          }
        }
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

// Government body postcodes (federal agencies → Canberra unless otherwise known)
const GOV_POSTCODES = {
  'australian taxation office': { postcode: '2600', state: 'ACT' },
  'department of': { postcode: '2600', state: 'ACT' },
  'australian': { postcode: '2600', state: 'ACT' },
  'federal court': { postcode: '2600', state: 'ACT' },
  'federal circuit': { postcode: '2600', state: 'ACT' },
  'productivity commission': { postcode: '3000', state: 'VIC' },
  'national': { postcode: '2600', state: 'ACT' },
  'office of': { postcode: '2600', state: 'ACT' },
  'administrative appeals': { postcode: '2600', state: 'ACT' },
  'parliamentary': { postcode: '2600', state: 'ACT' },
  'tertiary education': { postcode: '3000', state: 'VIC' },
};

async function run() {
  if (!GUID) {
    log('Missing ABN_LOOKUP_GUID in .env');
    process.exit(1);
  }

  // Get all entities missing postcodes
  log('Loading entities missing postcodes...');
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('gs_entities')
      .select('id, canonical_name, abn, state, entity_type')
      .is('postcode', null)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += 1000;
  }

  log(`Total missing postcodes: ${all.length}`);

  const byType = {};
  for (const e of all) {
    byType[e.entity_type] = (byType[e.entity_type] || 0) + 1;
  }
  log('By type: ' + JSON.stringify(byType));

  const updates = []; // { id, postcode, state, abn, method }

  // Strategy 1: Government bodies → hardcode
  const govBodies = all.filter(e => e.entity_type === 'government_body');
  log(`\n--- Government bodies: ${govBodies.length} ---`);
  for (const e of govBodies) {
    const lower = e.canonical_name.toLowerCase();
    let found = null;
    for (const [prefix, info] of Object.entries(GOV_POSTCODES)) {
      if (lower.includes(prefix)) {
        found = info;
        break;
      }
    }
    if (!found) found = { postcode: '2600', state: 'ACT' }; // default to Canberra for fed agencies
    updates.push({ id: e.id, ...found, abn: e.abn, method: 'gov-hardcode', name: e.canonical_name });
  }
  log(`  Hardcoded: ${govBodies.length}`);

  // Strategy 2: Political parties → hardcode to Canberra
  const parties = all.filter(e => e.entity_type === 'political_party');
  log(`\n--- Political parties: ${parties.length} ---`);
  for (const e of parties) {
    updates.push({ id: e.id, postcode: '2600', state: 'ACT', abn: e.abn, method: 'party-hardcode', name: e.canonical_name });
  }

  // Strategy 3: Entities with ABN → ABR API lookup
  const withAbn = all.filter(e => e.abn && e.entity_type !== 'government_body' && e.entity_type !== 'political_party');
  log(`\n--- ABN lookup: ${withAbn.length} entities ---`);
  let abnHits = 0, abnMisses = 0;

  for (let i = 0; i < withAbn.length; i++) {
    const e = withAbn[i];
    if (i > 0 && i % 50 === 0) log(`  Progress: ${i}/${withAbn.length} (${abnHits} hits)`);

    const result = await lookupAbn(e.abn);
    if (result) {
      updates.push({ id: e.id, ...result, method: 'abn-lookup', name: e.canonical_name });
      abnHits++;
    } else {
      abnMisses++;
    }
    await sleep(RATE_LIMIT_MS);
  }
  log(`  Hits: ${abnHits}, Misses: ${abnMisses}`);

  // Strategy 4: Entities without ABN → name search (optional, slow)
  if (!SKIP_NAME_SEARCH) {
    const withoutAbn = all.filter(e =>
      !e.abn &&
      e.entity_type !== 'government_body' &&
      e.entity_type !== 'political_party' &&
      !updates.find(u => u.id === e.id)
    );
    log(`\n--- Name search: ${withoutAbn.length} entities ---`);
    let nameHits = 0, nameMisses = 0;

    for (let i = 0; i < withoutAbn.length; i++) {
      const e = withoutAbn[i];
      if (i > 0 && i % 100 === 0) log(`  Progress: ${i}/${withoutAbn.length} (${nameHits} hits)`);

      const result = await searchByName(e.canonical_name);
      if (result) {
        updates.push({
          id: e.id,
          postcode: result.postcode,
          state: result.state,
          abn: result.abn,
          method: 'name-search',
          name: e.canonical_name,
          matchedName: result.matchedName,
        });
        nameHits++;
      } else {
        nameMisses++;
      }
      await sleep(RATE_LIMIT_MS);
    }
    log(`  Hits: ${nameHits}, Misses: ${nameMisses}`);
  }

  // Summary
  log(`\n=== Summary ===`);
  const byMethod = {};
  for (const u of updates) {
    byMethod[u.method] = (byMethod[u.method] || 0) + 1;
  }
  log(`Total updates: ${updates.length}`);
  log('By method: ' + JSON.stringify(byMethod));
  log(`Remaining unfilled: ${all.length - updates.length}`);

  // Show samples
  log('\nSample updates:');
  for (const u of updates.slice(0, 10)) {
    log(`  ${u.name} → ${u.postcode} ${u.state} [${u.method}]`);
  }

  if (!APPLY) {
    log('\nDry run complete. Run with --apply to update the database.');
    return;
  }

  // Apply updates
  log('\nApplying updates...');
  let applied = 0, errors = 0;

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    const updateData = { postcode: u.postcode };
    if (u.state) updateData.state = u.state;
    if (u.abn) updateData.abn = u.abn;

    const { error } = await supabase
      .from('gs_entities')
      .update(updateData)
      .eq('id', u.id)
      .is('postcode', null);

    if (error) {
      errors++;
      if (errors <= 3) log(`  Error: ${error.message}`);
    } else {
      applied++;
    }

    if (i > 0 && i % 100 === 0) log(`  Applied: ${applied}/${updates.length}`);
  }

  log(`Applied: ${applied}, Errors: ${errors}`);

  // Enrich with postcode_geo
  log('\nEnriching with postcode_geo...');
  const enrichSql = `UPDATE gs_entities e SET
  remoteness = pg.remoteness_2021,
  lga_name = pg.lga_name,
  lga_code = pg.lga_code,
  seifa_irsd_decile = s.decile_national
FROM postcode_geo pg
LEFT JOIN seifa_2021 s ON s.postcode = pg.postcode AND s.index_type = 'irsd'
WHERE e.postcode = pg.postcode
  AND e.remoteness IS NULL
  AND pg.postcode IS NOT NULL;`;

  const enrichFile = '/tmp/abr-api-enrich.sql';
  writeFileSync(enrichFile, enrichSql);
  try {
    execSync(
      `source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f ${enrichFile}`,
      { encoding: 'utf8', shell: '/bin/bash', cwd: process.cwd() }
    );
    log('  Enrichment done.');
  } catch (err) {
    log(`  Enrichment error: ${err.message}`);
  }
  unlinkSync(enrichFile);

  // Final stats
  const { count: total } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true });
  const { count: withPc } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true }).not('postcode', 'is', null);
  const { count: missing } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true }).is('postcode', null);

  log(`\n=== Final coverage ===`);
  log(`Total: ${total}`);
  log(`With postcode: ${withPc} (${Math.round(withPc/total*100)}%)`);
  log(`Missing: ${missing}`);
}

run().catch(err => {
  console.error('[abr-api-backfill] Fatal:', err);
  process.exit(1);
});
