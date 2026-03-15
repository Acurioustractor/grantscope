#!/usr/bin/env node
/**
 * Overnight Data Linkage Sweep
 *
 * Runs through all unfinished linkage tasks in a loop:
 *   1. ALMA → gs_entities (fuzzy name matching)
 *   2. Justice funding ABN → gs_entities (create missing entities)
 *   3. Donation ABN → gs_entities (create missing entities)
 *   4. Contract ABN → gs_entities (create missing entities)
 *   5. Entity postcode/SEIFA/remoteness backfill
 *   6. Refresh materialized views
 *
 * Usage: node --env-file=.env scripts/overnight-linkage-sweep.mjs [--dry-run]
 *
 * Designed to run unattended. Logs progress to stdout.
 * Each phase is idempotent — safe to re-run.
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function log(phase, msg) {
  console.log(`[${new Date().toISOString()}] [${phase}] ${msg}`);
}

// ─── Phase 1: ALMA fuzzy linking ────────────────────────────────────────────
async function linkAlmaEntities() {
  log('ALMA', 'Starting ALMA → entity fuzzy linking...');

  const { data: unlinked, error } = await supabase
    .from('alma_interventions')
    .select('id, name, operating_organization, geography')
    .is('gs_entity_id', null)
    .not('operating_organization', 'is', null)
    .limit(500);

  if (error) { log('ALMA', `Error fetching: ${error.message}`); return { linked: 0, skipped: 0 }; }
  if (!unlinked?.length) { log('ALMA', 'No unlinked interventions with org names'); return { linked: 0, skipped: 0 }; }

  log('ALMA', `Found ${unlinked.length} unlinked interventions to process`);
  let linked = 0;
  let skipped = 0;

  for (const row of unlinked) {
    const orgName = row.operating_organization?.trim();
    if (!orgName || orgName.length < 3) { skipped++; continue; }

    // Try exact match first
    const { data: exact } = await supabase
      .from('gs_entities')
      .select('id')
      .ilike('canonical_name', orgName)
      .limit(1);

    if (exact?.length) {
      if (!DRY_RUN) {
        await supabase
          .from('alma_interventions')
          .update({ gs_entity_id: exact[0].id })
          .eq('id', row.id);
      }
      linked++;
      continue;
    }

    // Try fuzzy — strip common suffixes and re-search
    const simplified = orgName
      .replace(/\b(Inc|Ltd|Pty|Limited|Incorporated|Aboriginal Corporation|Corporation)\b\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (simplified.length < 3) { skipped++; continue; }

    const { data: fuzzy } = await supabase
      .from('gs_entities')
      .select('id, canonical_name')
      .ilike('canonical_name', `%${simplified}%`)
      .limit(5);

    if (fuzzy?.length === 1) {
      // Unique match — safe to link
      if (!DRY_RUN) {
        await supabase
          .from('alma_interventions')
          .update({ gs_entity_id: fuzzy[0].id })
          .eq('id', row.id);
      }
      linked++;
      log('ALMA', `  Linked: "${orgName}" → "${fuzzy[0].canonical_name}"`);
    } else {
      skipped++;
    }
  }

  log('ALMA', `Done. Linked: ${linked}, Skipped: ${skipped}`);
  return { linked, skipped };
}

// ─── Phase 2: Create missing entities from ABNs ────────────────────────────
async function createEntitiesFromAbns(source, table, abnCol, nameCol) {
  log(source, `Finding ABNs in ${table} with no matching entity...`);

  // Get distinct ABNs that don't exist in gs_entities
  const { data: rows, error } = await supabase.rpc('get_unlinked_abns', {
    p_table: table,
    p_abn_col: abnCol,
    p_name_col: nameCol,
    p_limit: BATCH_SIZE,
  });

  // Fallback: raw query if RPC doesn't exist
  if (error) {
    log(source, `RPC not available, using direct query fallback`);
    return await createEntitiesFromAbnsDirect(source, table, abnCol, nameCol);
  }

  if (!rows?.length) { log(source, 'No unlinked ABNs found'); return { created: 0 }; }

  log(source, `Found ${rows.length} unlinked ABNs to process`);
  let created = 0;

  for (const row of rows) {
    if (!row.abn || !row.name) continue;

    if (!DRY_RUN) {
      // Check existence first (ABN is not a unique constraint)
      const { data: existing } = await supabase
        .from('gs_entities')
        .select('id')
        .eq('abn', row.abn)
        .limit(1);

      if (existing?.length) continue;

      const { error: insertErr } = await supabase
        .from('gs_entities')
        .insert({
          canonical_name: row.name,
          abn: row.abn,
          source_datasets: [source],
          entity_type: 'unknown',
        });

      if (insertErr) {
        log(source, `  Error inserting ${row.abn}: ${insertErr.message}`);
        continue;
      }
    }
    created++;
  }

  log(source, `Done. Created: ${created}`);
  return { created };
}

async function createEntitiesFromAbnsDirect(source, table, abnCol, nameCol) {
  // Use gsql approach — query for unlinked ABNs directly
  const query = `
    SELECT DISTINCT ON (t.${abnCol})
      t.${abnCol} as abn,
      t.${nameCol} as name
    FROM ${table} t
    LEFT JOIN gs_entities e ON e.abn = t.${abnCol}
    WHERE t.${abnCol} IS NOT NULL
      AND e.id IS NULL
    LIMIT ${BATCH_SIZE}
  `;

  const { data, error } = await supabase.rpc('run_sql', { query });

  if (error) {
    log(source, `Direct query also failed: ${error.message}`);
    log(source, `Falling back to manual batch approach`);
    return await createEntitiesManualBatch(source, table, abnCol, nameCol);
  }

  let created = 0;
  for (const row of (data || [])) {
    if (!row.abn || !row.name) continue;
    if (!DRY_RUN) {
      // Check existence first (ABN is not a unique constraint)
      const { data: existing } = await supabase
        .from('gs_entities')
        .select('id')
        .eq('abn', row.abn)
        .limit(1);

      if (existing?.length) { continue; }

      const { error: insertErr } = await supabase
        .from('gs_entities')
        .insert({
          canonical_name: row.name,
          abn: row.abn,
          source_datasets: [source],
          entity_type: 'unknown',
        });

      if (!insertErr) created++;
    } else {
      created++;
    }
  }

  log(source, `Done. Created: ${created}`);
  return { created };
}

async function createEntitiesManualBatch(source, table, abnCol, nameCol) {
  // Most robust fallback: fetch from source table, check each against gs_entities
  log(source, `Using manual batch approach for ${table}`);

  const { data: sourceRows, error } = await supabase
    .from(table)
    .select(`${abnCol}, ${nameCol}`)
    .not(abnCol, 'is', null)
    .limit(2000);

  if (error || !sourceRows?.length) {
    log(source, `Could not fetch from ${table}: ${error?.message || 'no rows'}`);
    return { created: 0 };
  }

  // Deduplicate by ABN
  const byAbn = new Map();
  for (const row of sourceRows) {
    const abn = row[abnCol];
    if (abn && !byAbn.has(abn)) byAbn.set(abn, row[nameCol]);
  }

  // Check which ABNs already exist
  const abnList = [...byAbn.keys()].slice(0, BATCH_SIZE);
  const { data: existing } = await supabase
    .from('gs_entities')
    .select('abn')
    .in('abn', abnList);

  const existingAbns = new Set((existing || []).map(e => e.abn));
  const toCreate = abnList.filter(abn => !existingAbns.has(abn));

  log(source, `${toCreate.length} new ABNs to create from ${abnList.length} checked`);

  let created = 0;
  for (const abn of toCreate) {
    const name = byAbn.get(abn);
    if (!name) continue;

    if (!DRY_RUN) {
      const { error: insertErr } = await supabase
        .from('gs_entities')
        .insert({
          canonical_name: name,
          abn,
          source_datasets: [source],
          entity_type: 'unknown',
        });

      if (!insertErr) created++;
      else log(source, `  Insert error for ${abn}: ${insertErr.message}`);
    } else {
      created++;
    }
  }

  log(source, `Done. Created: ${created}`);
  return { created };
}

// ─── Phase 3: Backfill entity postcode → SEIFA + remoteness ─────────────────
async function backfillEntityGeo() {
  log('GEO', 'Backfilling SEIFA and remoteness from postcode...');

  // Find entities with postcode but missing SEIFA or remoteness
  const { data: entities, error } = await supabase
    .from('gs_entities')
    .select('id, postcode')
    .not('postcode', 'is', null)
    .or('seifa_irsd_decile.is.null,remoteness.is.null')
    .limit(BATCH_SIZE);

  if (error) { log('GEO', `Error: ${error.message}`); return { updated: 0 }; }
  if (!entities?.length) { log('GEO', 'No entities need geo backfill'); return { updated: 0 }; }

  log('GEO', `Found ${entities.length} entities needing geo backfill`);

  // Get postcode → geo lookup
  const postcodes = [...new Set(entities.map(e => e.postcode))];
  const { data: geoData } = await supabase
    .from('postcode_geo')
    .select('postcode, remoteness_2021, lga_name, lga_code')
    .in('postcode', postcodes);

  const { data: seifaData } = await supabase
    .from('seifa_2021')
    .select('postcode, score, decile_national')
    .in('postcode', postcodes)
    .eq('index_type', 'irsd');

  const geoMap = new Map((geoData || []).map(g => [g.postcode, g]));
  const seifaMap = new Map((seifaData || []).map(s => [s.postcode, s]));

  let updated = 0;
  for (const entity of entities) {
    const geo = geoMap.get(entity.postcode);
    const seifa = seifaMap.get(entity.postcode);

    if (!geo && !seifa) continue;

    const updates = {};
    if (geo?.remoteness_2021) updates.remoteness = geo.remoteness_2021;
    if (geo?.lga_name) updates.lga_name = geo.lga_name;
    if (geo?.lga_code) updates.lga_code = geo.lga_code;
    if (seifa?.decile_national) updates.seifa_irsd_decile = seifa.decile_national;

    if (Object.keys(updates).length === 0) continue;

    if (!DRY_RUN) {
      const { error: updateErr } = await supabase
        .from('gs_entities')
        .update(updates)
        .eq('id', entity.id);

      if (!updateErr) updated++;
    } else {
      updated++;
    }
  }

  log('GEO', `Done. Updated: ${updated}`);
  return { updated };
}

// ─── Phase 4: Create relationships for linked records ───────────────────────
async function createJusticeRelationships() {
  log('REL-JUSTICE', 'Creating relationships from justice_funding...');

  // Find justice_funding records with ABNs that have entities but no relationship
  const { data: records, error } = await supabase
    .from('justice_funding')
    .select('id, recipient_name, recipient_abn, program_name, amount_dollars, state, financial_year')
    .not('recipient_abn', 'is', null)
    .limit(1000);

  if (error || !records?.length) {
    log('REL-JUSTICE', `Error or no records: ${error?.message || 'empty'}`);
    return { created: 0 };
  }

  // Match ABNs to entities
  const abns = [...new Set(records.map(r => r.recipient_abn).filter(Boolean))];
  const { data: entities } = await supabase
    .from('gs_entities')
    .select('id, abn')
    .in('abn', abns.slice(0, 500));

  const abnToEntity = new Map((entities || []).map(e => [e.abn, e.id]));

  // Check existing relationships to avoid duplicates
  const entityIds = [...new Set([...abnToEntity.values()])];
  const { data: existingRels } = await supabase
    .from('gs_relationships')
    .select('target_entity_id, year, dataset')
    .in('target_entity_id', entityIds.slice(0, 200))
    .eq('dataset', 'justice_funding');

  const existingKeys = new Set(
    (existingRels || []).map(r => `${r.target_entity_id}:${r.year}`)
  );

  let created = 0;
  const toInsert = [];

  for (const rec of records) {
    const targetId = abnToEntity.get(rec.recipient_abn);
    if (!targetId) continue;

    const key = `${targetId}:${rec.financial_year}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    toInsert.push({
      source_entity_id: targetId, // self-referencing for now (funding received)
      target_entity_id: targetId,
      relationship_type: 'justice_funding',
      amount: rec.amount_dollars,
      year: rec.financial_year,
      dataset: 'justice_funding',
      details: { program: rec.program_name, state: rec.state },
    });

    if (toInsert.length >= 100) {
      if (!DRY_RUN) {
        const { error: insertErr } = await supabase
          .from('gs_relationships')
          .upsert(toInsert, { ignoreDuplicates: true });
        if (insertErr) log('REL-JUSTICE', `Batch insert error: ${insertErr.message}`);
      }
      created += toInsert.length;
      toInsert.length = 0;
    }
  }

  // Final batch
  if (toInsert.length > 0 && !DRY_RUN) {
    await supabase.from('gs_relationships').upsert(toInsert, { ignoreDuplicates: true });
    created += toInsert.length;
  }

  log('REL-JUSTICE', `Done. Created: ${created}`);
  return { created };
}

// ─── Phase 5: Refresh materialized views ────────────────────────────────────
async function refreshViews() {
  log('VIEWS', 'Refreshing materialized views...');

  const views = [
    'mv_acnc_latest',
    'mv_data_quality',
    'mv_gs_entity_stats',
    'mv_funding_by_postcode',
    'mv_funding_by_lga',
    'mv_gs_donor_contractors',
    'mv_org_justice_signals',
  ];

  let refreshed = 0;
  for (const view of views) {
    try {
      const { error } = await supabase.rpc('refresh_mv', { mv_name: view });
      if (error) {
        log('VIEWS', `  ${view}: RPC error — ${error.message}`);
        // Views might not have an RPC — that's ok, skip
      } else {
        log('VIEWS', `  ${view}: refreshed`);
        refreshed++;
      }
    } catch (e) {
      log('VIEWS', `  ${view}: skipped (${e.message})`);
    }
  }

  log('VIEWS', `Done. Refreshed: ${refreshed}/${views.length}`);
  return { refreshed };
}

// ─── Main orchestrator ──────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  log('MAIN', `=== Overnight Linkage Sweep ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  log('MAIN', '');

  const results = {};

  // Phase 1: ALMA linking
  results.alma = await linkAlmaEntities();

  // Phase 2: Create entities from unlinked ABNs
  results.justiceEntities = await createEntitiesManualBatch(
    'justice_funding', 'justice_funding', 'recipient_abn', 'recipient_name'
  );
  results.donationEntities = await createEntitiesManualBatch(
    'political_donations', 'political_donations', 'donor_abn', 'donor_name'
  );
  results.contractEntities = await createEntitiesManualBatch(
    'austender_contracts', 'austender_contracts', 'supplier_abn', 'supplier_name'
  );

  // Phase 3: Backfill geo data
  results.geo = await backfillEntityGeo();

  // Phase 4: Create justice relationships
  results.justiceRels = await createJusticeRelationships();

  // Phase 5: Refresh views
  results.views = await refreshViews();

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('MAIN', '');
  log('MAIN', '=== SUMMARY ===');
  log('MAIN', `ALMA linked:           ${results.alma.linked}`);
  log('MAIN', `Justice entities:      ${results.justiceEntities.created}`);
  log('MAIN', `Donation entities:     ${results.donationEntities.created}`);
  log('MAIN', `Contract entities:     ${results.contractEntities.created}`);
  log('MAIN', `Geo backfills:         ${results.geo.updated}`);
  log('MAIN', `Justice relationships: ${results.justiceRels.created}`);
  log('MAIN', `Views refreshed:       ${results.views.refreshed}`);
  log('MAIN', `Elapsed:               ${elapsed}s`);
  log('MAIN', `Mode:                  ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('MAIN', '');

  // Run again? Loop through phases 1-3 again if there's more to process
  const totalLinked = results.alma.linked + results.justiceEntities.created +
    results.donationEntities.created + results.contractEntities.created + results.geo.updated;

  if (totalLinked > 0) {
    log('MAIN', `Processed ${totalLinked} items. Running another pass...`);
    log('MAIN', '');

    // Second pass — ALMA and geo only (entities are created, now re-link)
    const pass2Alma = await linkAlmaEntities();
    const pass2Geo = await backfillEntityGeo();

    log('MAIN', '=== PASS 2 SUMMARY ===');
    log('MAIN', `ALMA linked (pass 2):  ${pass2Alma.linked}`);
    log('MAIN', `Geo backfills (pass 2): ${pass2Geo.updated}`);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('MAIN', `=== COMPLETE. Total elapsed: ${totalElapsed}s ===`);
}

main().catch(err => {
  log('FATAL', err.message);
  process.exit(1);
});
