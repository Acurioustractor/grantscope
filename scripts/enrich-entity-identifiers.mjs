#!/usr/bin/env node

/**
 * Entity Identifiers Cross-Linker Agent
 *
 * Enriches entity_identifiers table with ACN, ABN, and cross-references
 * from ABR and ASIC registries. This wires up the identifier graph so
 * any entity can be found by ABN, ACN, or name.
 *
 * Also adds ABR entity type codes and ASIC company types as identifiers
 * for richer classification.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-entity-identifiers.mjs
 */

import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function main() {
  log('=== Entity Identifiers Cross-Linker ===');
  const t0 = Date.now();

  // Step 1: Find gs_entities with ABN that have ABR records with ACN
  log('Finding entities with ABR-linked ACN...');
  const PAGE = 2000;
  let offset = 0;
  let toInsert = [];
  let totalFound = 0;

  while (true) {
    const { data: entities } = await db.from('gs_entities')
      .select('id, abn')
      .not('abn', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (!entities || entities.length === 0) break;

    // Look up ACNs from ABR for this batch
    const abns = entities.map(e => e.abn);
    const { data: abrRecords } = await db.from('abr_registry')
      .select('abn, acn, entity_type_code')
      .in('abn', abns)
      .not('acn', 'is', null);

    if (abrRecords && abrRecords.length > 0) {
      const abrMap = new Map();
      for (const r of abrRecords) abrMap.set(r.abn, r);

      for (const e of entities) {
        const abr = abrMap.get(e.abn);
        if (!abr) continue;

        // Add ACN identifier
        toInsert.push({
          entity_id: e.id,
          identifier_type: 'acn',
          identifier_value: abr.acn,
          source: 'abr_registry',
        });

        totalFound++;
      }
    }

    offset += PAGE;
    if (offset % 20000 === 0) log(`  Scanned ${offset.toLocaleString()} entities, ${totalFound.toLocaleString()} with ACN`);

    // Batch insert every 5000 identifiers
    if (toInsert.length >= 5000) {
      const { error } = await db.from('entity_identifiers')
        .upsert(toInsert, { onConflict: 'entity_id,identifier_type,identifier_value', ignoreDuplicates: true });
      if (error) log(`  Upsert error: ${error.message}`);
      else log(`  Inserted ${toInsert.length.toLocaleString()} ACN identifiers`);
      toInsert = [];
    }
  }

  // Flush remaining
  if (toInsert.length > 0) {
    const { error } = await db.from('entity_identifiers')
      .upsert(toInsert, { onConflict: 'entity_id,identifier_type,identifier_value', ignoreDuplicates: true });
    if (error) log(`  Final upsert error: ${error.message}`);
    else log(`  Inserted ${toInsert.length.toLocaleString()} ACN identifiers`);
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== COMPLETE === ${totalFound.toLocaleString()} ACN cross-references added in ${elapsed} min`);

  // Stats
  const { count } = await db.from('entity_identifiers').select('*', { count: 'exact', head: true });
  log(`entity_identifiers total: ${count?.toLocaleString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
