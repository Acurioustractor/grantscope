#!/usr/bin/env node

/**
 * Entity Resolution Engine
 *
 * THE CORE AGENT. Ensures every ABN referenced in any dataset has a
 * canonical gs_entity. This is the foundation of the relationship graph.
 *
 * Process:
 *   1. Collect ALL unique ABNs from austender_contracts, justice_funding,
 *      political_donations, acnc_charities
 *   2. Find which ABNs are NOT in gs_entities
 *   3. Look up each missing ABN in abr_registry
 *   4. Create gs_entity with ABR metadata (name, type, state, postcode)
 *   5. Also collect buyer/recipient names without ABNs — match against ABR
 *
 * This directly enables relationship extraction by ensuring both sides
 * of every relationship have a resolvable entity.
 *
 * Usage:
 *   node --env-file=.env scripts/engine-entity-resolution.mjs
 */

import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function mapEntityType(abrCode) {
  const map = {
    'PUB': 'company', 'PRV': 'company',
    'IND': 'person', 'SOL': 'person',
    'TRT': 'company', 'DIT': 'company',
    'FPT': 'foundation', 'FXT': 'foundation',
    'SGE': 'government_body', 'LGE': 'government_body', 'CGE': 'government_body',
    'SAT': 'government_body', 'TGA': 'government_body',
    'INC': 'charity', 'OIE': 'indigenous_corp',
    'CUT': 'company', 'CMT': 'company', 'NPT': 'company',
    'PTR': 'company', 'PTN': 'company',
    'SUP': 'company', 'CCB': 'company', 'CSS': 'company',
    'ADF': 'foundation',
  };
  return map[abrCode] || 'company';
}

async function collectAbns(table, abnColumn, nameColumn, extraColumns = []) {
  log(`  Scanning ${table}.${abnColumn}...`);
  const PAGE = 5000;
  const abns = new Map(); // ABN -> { name, source }
  let offset = 0;
  const cols = [abnColumn, nameColumn, ...extraColumns].join(',');

  while (true) {
    const { data, error } = await db.from(table)
      .select(cols)
      .not(abnColumn, 'is', null)
      .range(offset, offset + PAGE - 1);
    if (error) { log(`    Error: ${error.message}`); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const abn = row[abnColumn];
      if (abn && !abns.has(abn)) {
        abns.set(abn, { name: row[nameColumn], source: table });
      }
    }

    offset += PAGE;
    if (offset % 100000 === 0) log(`    ${offset.toLocaleString()} rows, ${abns.size.toLocaleString()} ABNs`);
  }

  log(`    ${table}: ${abns.size.toLocaleString()} unique ABNs`);
  return abns;
}

async function main() {
  log('=== Entity Resolution Engine ===');
  const t0 = Date.now();

  // Step 1: Collect ALL existing ABNs in gs_entities
  log('Step 1: Loading existing gs_entities...');
  const existingAbns = new Set();
  const PAGE = 5000;
  let offset = 0;
  while (true) {
    const { data } = await db.from('gs_entities')
      .select('abn')
      .not('abn', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) existingAbns.add(r.abn);
    offset += PAGE;
  }
  log(`  ${existingAbns.size.toLocaleString()} existing ABNs`);

  // Step 2: Collect ABNs from all source datasets
  log('Step 2: Collecting ABNs from source datasets...');
  const allAbns = new Map();

  // Contracts — supplier side
  const contractSupplier = await collectAbns('austender_contracts', 'supplier_abn', 'supplier_name');
  for (const [abn, info] of contractSupplier) {
    if (!existingAbns.has(abn)) {
      const existing = allAbns.get(abn);
      if (existing) { existing.datasets.push(info.source); }
      else allAbns.set(abn, { ...info, datasets: [info.source] });
    }
  }

  // Justice funding — recipient side
  const justiceRecipient = await collectAbns('justice_funding', 'recipient_abn', 'recipient_name');
  for (const [abn, info] of justiceRecipient) {
    if (!existingAbns.has(abn)) {
      const existing = allAbns.get(abn);
      if (existing) { existing.datasets.push(info.source); }
      else allAbns.set(abn, { ...info, datasets: [info.source] });
    }
  }

  // Political donations — donor side
  const donorAbns = await collectAbns('political_donations', 'donor_abn', 'donor_name');
  for (const [abn, info] of donorAbns) {
    if (!existingAbns.has(abn)) {
      const existing = allAbns.get(abn);
      if (existing) { existing.datasets.push(info.source); }
      else allAbns.set(abn, { ...info, datasets: [info.source] });
    }
  }

  // ACNC charities
  const acncAbns = await collectAbns('acnc_charities', 'abn', 'name');
  for (const [abn, info] of acncAbns) {
    if (!existingAbns.has(abn)) {
      const existing = allAbns.get(abn);
      if (existing) { existing.datasets.push(info.source); }
      else allAbns.set(abn, { ...info, datasets: [info.source] });
    }
  }

  log(`Step 2 complete: ${allAbns.size.toLocaleString()} ABNs NOT in gs_entities`);

  // Step 3: Look up missing ABNs in ABR and create entities
  log('Step 3: Resolving against ABR registry...');
  const missingList = [...allAbns.entries()];
  let created = 0;
  let notInAbr = 0;
  let fromAbr = 0;
  let fromName = 0;
  const BATCH = 500;

  for (let i = 0; i < missingList.length; i += BATCH) {
    const batch = missingList.slice(i, i + BATCH);
    const batchAbns = batch.map(([abn]) => abn);

    // Look up in ABR
    const { data: abrRecords } = await db.from('abr_registry')
      .select('abn, entity_name, entity_type, entity_type_code, status, state, postcode, acn, acnc_registered')
      .in('abn', batchAbns);

    const abrMap = new Map();
    for (const r of (abrRecords || [])) abrMap.set(r.abn, r);

    // Build batch of entities to upsert
    const entities = [];
    for (const [abn, info] of batch) {
      const abr = abrMap.get(abn);
      entities.push({
        gs_id: `AU-ABN-${abn}`,
        canonical_name: abr ? abr.entity_name : info.name,
        abn: abn,
        entity_type: abr ? mapEntityType(abr.entity_type_code) : 'company',
        confidence: abr ? 'registry' : 'reported',
        source_datasets: info.datasets || [],
        state: abr?.state || null,
        postcode: abr?.postcode || null,
      });
      if (abr) fromAbr++; else fromName++;
    }

    // Batch upsert — skip conflicts on unique ABN index
    const { error, count } = await db.from('gs_entities')
      .upsert(entities, { onConflict: 'abn', ignoreDuplicates: true, count: 'exact' });
    if (error) {
      log(`  !! UPSERT ERROR: ${error.message} ${error.code} ${JSON.stringify(error.details)}`);
    } else {
      created += (count || entities.length);
    }

    notInAbr += batch.filter(([abn]) => !abrMap.has(abn)).length;

    if ((i + BATCH) % 5000 < BATCH || i + BATCH >= missingList.length) {
      const pct = (((i + BATCH) / missingList.length) * 100).toFixed(1);
      log(`  [${Math.min(i + BATCH, missingList.length).toLocaleString()}/${missingList.length.toLocaleString()}] ${pct}% — created=${created.toLocaleString()} (${fromAbr} ABR, ${fromName} name-only) notInAbr=${notInAbr}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== ENTITY RESOLUTION COMPLETE ===`);
  log(`  ${created.toLocaleString()} entities created in ${elapsed} min`);
  log(`  ${fromAbr.toLocaleString()} from ABR registry (full metadata)`);
  log(`  ${fromName.toLocaleString()} from dataset names (minimal metadata)`);
  log(`  ${notInAbr.toLocaleString()} ABNs not found in ABR`);

  // Final count
  const { count } = await db.from('gs_entities').select('*', { count: 'exact', head: true });
  log(`  gs_entities total: ${count?.toLocaleString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
