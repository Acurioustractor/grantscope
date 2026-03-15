#!/usr/bin/env node

/**
 * Create Missing Entities Agent
 *
 * Finds ABNs referenced in contracts, grants, and donations that don't exist
 * in gs_entities, then creates them using ABR registry data.
 * This directly fixes broken relationships by ensuring both sides exist.
 *
 * Sources checked:
 *   - austender_contracts (supplier_abn)
 *   - justice_funding (recipient_abn)
 *   - political_donations (donor_abn)
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-create-missing-entities.mjs
 */

import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// Map ABR entity_type_code to gs_entities entity_type
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

async function collectMissingAbns(source, query) {
  log(`Scanning ${source}...`);
  const PAGE = 1000;
  const missing = new Set();
  let offset = 0;

  while (true) {
    const { data, error } = await db.rpc('', {}).maybeSingle(); // placeholder
    break; // We'll use a different approach
  }

  // Collect ABNs from source in pages
  offset = 0;
  while (true) {
    let q;
    if (source === 'contracts') {
      q = db.from('austender_contracts')
        .select('supplier_abn')
        .not('supplier_abn', 'is', null)
        .range(offset, offset + PAGE - 1);
    } else if (source === 'justice') {
      q = db.from('justice_funding')
        .select('recipient_abn')
        .not('recipient_abn', 'is', null)
        .range(offset, offset + PAGE - 1);
    } else {
      q = db.from('political_donations')
        .select('donor_abn')
        .not('donor_abn', 'is', null)
        .range(offset, offset + PAGE - 1);
    }

    const { data, error } = await q;
    if (error) { log(`  Error: ${error.message}`); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const abn = row.supplier_abn || row.recipient_abn || row.donor_abn;
      if (abn) missing.add(abn);
    }

    offset += PAGE;
    if (offset % 50000 === 0) log(`  ${source}: scanned ${offset.toLocaleString()} rows, ${missing.size.toLocaleString()} unique ABNs`);
  }

  log(`  ${source}: ${missing.size.toLocaleString()} unique ABNs found`);
  return missing;
}

async function main() {
  log('=== Create Missing Entities from ABR ===');
  const t0 = Date.now();

  // Step 1: Get all existing ABNs in gs_entities
  log('Loading existing gs_entities ABNs...');
  const existingAbns = new Set();
  let offset = 0;
  const PAGE = 5000;

  while (true) {
    const { data } = await db.from('gs_entities')
      .select('abn')
      .not('abn', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) existingAbns.add(r.abn);
    offset += PAGE;
  }
  log(`  ${existingAbns.size.toLocaleString()} existing ABNs in gs_entities`);

  // Step 2: Collect ABNs from all sources
  const allAbns = new Set();

  for (const source of ['contracts', 'justice', 'donations']) {
    const abns = await collectMissingAbns(source);
    for (const abn of abns) {
      if (!existingAbns.has(abn)) allAbns.add(abn);
    }
  }

  log(`${allAbns.size.toLocaleString()} ABNs in datasets but NOT in gs_entities`);

  // Step 3: Look up each missing ABN in abr_registry and create gs_entity
  const missingList = [...allAbns];
  let created = 0;
  let notInAbr = 0;
  const BATCH = 100;

  for (let i = 0; i < missingList.length; i += BATCH) {
    const batch = missingList.slice(i, i + BATCH);

    // Look up in ABR
    const { data: abrRecords, error } = await db.from('abr_registry')
      .select('abn, entity_name, entity_type, entity_type_code, status, state, postcode, acn, acnc_registered')
      .in('abn', batch);

    if (error) { log(`  ABR lookup error: ${error.message}`); continue; }

    const abrMap = new Map();
    for (const r of (abrRecords || [])) abrMap.set(r.abn, r);

    // Create gs_entities for found ABR records
    const toInsert = [];
    for (const abn of batch) {
      const abr = abrMap.get(abn);
      if (!abr) { notInAbr++; continue; }

      toInsert.push({
        canonical_name: abr.entity_name,
        abn: abr.abn,
        entity_type: mapEntityType(abr.entity_type_code),
        state: abr.state || null,
        postcode: abr.postcode || null,
      });
    }

    if (toInsert.length > 0) {
      // Insert one by one to skip duplicates (no unique constraint on abn)
      for (const row of toInsert) {
        // Check if ABN already exists
        const { data: dup } = await db.from('gs_entities')
          .select('id').eq('abn', row.abn).maybeSingle();
        if (dup) continue;

        const { error: insertError } = await db.from('gs_entities').insert(row);
        if (insertError) {
          // Likely race condition duplicate
        } else {
          created++;
        }
      }
    }

    if ((i + BATCH) % 5000 === 0) {
      log(`  [${(i + BATCH).toLocaleString()}/${missingList.length.toLocaleString()}] created=${created.toLocaleString()} notInAbr=${notInAbr}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== COMPLETE === ${created.toLocaleString()} entities created, ${notInAbr} not in ABR, in ${elapsed} min`);

  // Final count
  const { count } = await db.from('gs_entities').select('*', { count: 'exact', head: true });
  log(`gs_entities total: ${count?.toLocaleString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
