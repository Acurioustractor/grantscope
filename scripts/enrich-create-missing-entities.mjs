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

/**
 * Collect (abn → name) pairs from a source table. Returning names alongside
 * lets us fall back to a minimal entity record when ABR doesn't have the ABN
 * (which happens for ~99% of supplier ABNs in austender_contracts).
 */
async function collectMissingAbns(source) {
  log(`Scanning ${source}...`);
  const PAGE = 1000;
  const missing = new Map(); // abn → first-seen name
  let offset = 0;

  while (true) {
    let q;
    if (source === 'contracts') {
      q = db.from('austender_contracts')
        .select('supplier_abn, supplier_name')
        .not('supplier_abn', 'is', null)
        .range(offset, offset + PAGE - 1);
    } else if (source === 'justice') {
      q = db.from('justice_funding')
        .select('recipient_abn, recipient_name')
        .not('recipient_abn', 'is', null)
        .range(offset, offset + PAGE - 1);
    } else {
      q = db.from('political_donations')
        .select('donor_abn, donor_name')
        .not('donor_abn', 'is', null)
        .range(offset, offset + PAGE - 1);
    }

    const { data, error } = await q;
    if (error) { log(`  Error: ${error.message}`); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const abn = row.supplier_abn || row.recipient_abn || row.donor_abn;
      const name = row.supplier_name || row.recipient_name || row.donor_name;
      if (abn && !missing.has(abn)) missing.set(abn, name || null);
    }

    if (data.length < PAGE) break;
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

  // Step 2: Collect (abn → name) pairs from all sources
  const abnToName = new Map();
  const abnSource = new Map(); // for tagging

  for (const source of ['contracts', 'justice', 'donations']) {
    const map = await collectMissingAbns(source);
    for (const [abn, name] of map) {
      if (existingAbns.has(abn)) continue;
      if (!abnToName.has(abn)) {
        abnToName.set(abn, name);
        abnSource.set(abn, source);
      }
    }
  }

  log(`${abnToName.size.toLocaleString()} ABNs in datasets but NOT in gs_entities`);

  // Step 3: Look up missing ABNs in abr_registry, fall back to source data
  // when ABR is missing. Bulk upsert by gs_id so duplicates are silent.
  const missingList = [...abnToName.keys()];
  let createdFromAbr = 0;
  let createdFromSource = 0;
  let skipped = 0;
  const BATCH = 500;

  for (let i = 0; i < missingList.length; i += BATCH) {
    const batch = missingList.slice(i, i + BATCH);

    // ABR lookup (best-effort metadata)
    const { data: abrRecords, error } = await db.from('abr_registry')
      .select('abn, entity_name, entity_type_code, state, postcode')
      .in('abn', batch);
    if (error) { log(`  ABR lookup error: ${error.message}`); continue; }

    const abrMap = new Map();
    for (const r of (abrRecords || [])) abrMap.set(r.abn, r);

    const toInsert = [];
    for (const abn of batch) {
      const abr = abrMap.get(abn);
      const sourceName = abnToName.get(abn);
      const source = abnSource.get(abn);

      if (abr) {
        toInsert.push({
          gs_id: `AU-ABN-${abn}`,
          canonical_name: abr.entity_name || sourceName || `Unknown (${abn})`,
          abn: abr.abn,
          entity_type: mapEntityType(abr.entity_type_code),
          state: abr.state || null,
          postcode: abr.postcode || null,
          source_datasets: ['abr', source],
          source_count: 2,
          confidence: 'registry',
          tags: ['abr-matched', `${source}-source`],
        });
        createdFromAbr++;
      } else if (sourceName) {
        // Fallback: create a minimal entity from the source record name
        toInsert.push({
          gs_id: `AU-ABN-${abn}`,
          canonical_name: sourceName,
          abn,
          entity_type: 'company',
          source_datasets: [source],
          source_count: 1,
          confidence: 'reported',
          tags: [`${source}-source`, 'no-abr-match'],
        });
        createdFromSource++;
      } else {
        skipped++;
      }
    }

    if (toInsert.length > 0) {
      const { error: upsertError } = await db
        .from('gs_entities')
        .upsert(toInsert, { onConflict: 'gs_id', ignoreDuplicates: true });
      if (upsertError) {
        log(`  Upsert error: ${upsertError.message}`);
      }
    }

    if ((i + BATCH) % 5000 === 0 || (i + BATCH) >= missingList.length) {
      log(`  [${Math.min(i + BATCH, missingList.length).toLocaleString()}/${missingList.length.toLocaleString()}] abr=${createdFromAbr.toLocaleString()} source=${createdFromSource.toLocaleString()} skipped=${skipped}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== COMPLETE === ${(createdFromAbr + createdFromSource).toLocaleString()} entities created (${createdFromAbr.toLocaleString()} from ABR, ${createdFromSource.toLocaleString()} from source data), ${skipped} skipped (no name), in ${elapsed} min`);

  // Final count
  const { count } = await db.from('gs_entities').select('*', { count: 'exact', head: true });
  log(`gs_entities total: ${count?.toLocaleString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
