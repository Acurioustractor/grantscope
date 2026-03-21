#!/usr/bin/env node
/**
 * ingest-ndis-entities.mjs
 *
 * Creates gs_entities records for NDIS registered providers not yet in the knowledge graph.
 * Links geography via postcode_geo for LGA, remoteness.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-ndis-entities.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 500;

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// Step 1: Get all ABNs already in gs_entities
log('Loading existing ABNs from gs_entities...');
const existingAbns = new Set();
let offset = 0;
while (true) {
  const { data, error } = await db.from('gs_entities').select('abn').not('abn', 'is', null).range(offset, offset + 999);
  if (error) { log(`Error: ${error.message}`); break; }
  if (!data || data.length === 0) break;
  data.forEach(r => existingAbns.add(r.abn));
  offset += data.length;
  if (data.length < 1000) break;
}
log(`  ${existingAbns.size} existing ABNs loaded`);

// Step 2: Get distinct NDIS providers (one per ABN, latest report)
log('Loading NDIS registered providers...');
const providerMap = new Map(); // abn -> { name, state, postcode }
offset = 0;
while (true) {
  const { data, error } = await db.from('ndis_registered_providers')
    .select('abn, provider_name, legal_name, state_code, postcode, report_date')
    .not('abn', 'is', null)
    .range(offset, offset + 999)
    .order('report_date', { ascending: false });
  if (error) { log(`Error: ${error.message}`); break; }
  if (!data || data.length === 0) break;
  for (const r of data) {
    if (!providerMap.has(r.abn)) {
      providerMap.set(r.abn, {
        name: (r.legal_name || r.provider_name || '').trim(),
        state: r.state_code,
        postcode: r.postcode,
      });
    }
  }
  offset += data.length;
  if (data.length < 1000) break;
}
log(`  ${providerMap.size} unique NDIS provider ABNs`);

// Step 3: Filter to unmatched
const unmatched = [];
for (const [abn, info] of providerMap) {
  if (!existingAbns.has(abn)) {
    unmatched.push({ abn, ...info });
  }
}
log(`  ${unmatched.length} unmatched (need entity records)`);

if (DRY_RUN) {
  log('DRY RUN — showing first 10:');
  for (const u of unmatched.slice(0, 10)) {
    log(`  ${u.abn} | ${u.name} | ${u.state} ${u.postcode}`);
  }
  process.exit(0);
}

// Step 4: Load postcode_geo for geography mapping
log('Loading postcode_geo for LGA/remoteness mapping...');
const geoMap = new Map(); // postcode -> { lga_name, lga_code, remoteness }
offset = 0;
while (true) {
  const { data, error } = await db.from('postcode_geo')
    .select('postcode, lga_name, lga_code, remoteness_2021')
    .not('lga_name', 'is', null)
    .range(offset, offset + 999);
  if (error) { log(`Error: ${error.message}`); break; }
  if (!data || data.length === 0) break;
  for (const r of data) {
    if (!geoMap.has(r.postcode)) {
      geoMap.set(r.postcode, {
        lga_name: r.lga_name,
        lga_code: r.lga_code,
        remoteness: r.remoteness_2021,
      });
    }
  }
  offset += data.length;
  if (data.length < 1000) break;
}
log(`  ${geoMap.size} postcodes mapped`);

// Step 5: Batch insert
log(`Inserting ${unmatched.length} entities in batches of ${BATCH}...`);
let inserted = 0;
let skipped = 0;

for (let i = 0; i < unmatched.length; i += BATCH) {
  const batch = unmatched.slice(i, i + BATCH).map(u => {
    const geo = geoMap.get(u.postcode) || {};
    return {
      gs_id: `AU-ABN-${u.abn}`,
      canonical_name: u.name || `NDIS Provider ${u.abn}`,
      abn: u.abn,
      entity_type: 'company',
      state: u.state,
      postcode: u.postcode,
      sector: 'disability-services',
      lga_name: geo.lga_name || null,
      lga_code: geo.lga_code || null,
      remoteness: geo.remoteness || null,
      confidence: 'registry',
    };
  });

  const { error } = await db.from('gs_entities').upsert(batch, { onConflict: 'gs_id', ignoreDuplicates: true });
  if (error) {
    log(`  Batch ${i}-${i + batch.length} error: ${error.message}`);
    // Try one-by-one
    for (const row of batch) {
      const { error: e2 } = await db.from('gs_entities').upsert(row, { onConflict: 'gs_id', ignoreDuplicates: true });
      if (e2) { skipped++; } else { inserted++; }
    }
  } else {
    inserted += batch.length;
  }

  if ((i + BATCH) % 5000 === 0 || i + BATCH >= unmatched.length) {
    log(`  Progress: ${Math.min(i + BATCH, unmatched.length)}/${unmatched.length} (${inserted} inserted, ${skipped} skipped)`);
  }
}

log(`\n=== COMPLETE ===`);
log(`Inserted: ${inserted}`);
log(`Skipped: ${skipped}`);
log(`Total gs_entities ABNs: ${existingAbns.size + inserted}`);
