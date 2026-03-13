#!/usr/bin/env node
/**
 * Backfill gs_entities from austender_contracts suppliers that don't exist yet.
 * Creates entity records + contract relationships.
 *
 * Usage: node --env-file=.env scripts/backfill-austender-entities.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 500;

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  // Step 1: Find austender supplier ABNs missing from gs_entities
  console.log('Finding missing supplier ABNs...');

  // Get all unique supplier ABNs + their most common name
  const { data: suppliers, error: supErr } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT supplier_abn,
             MODE() WITHIN GROUP (ORDER BY supplier_name) as supplier_name,
             COALESCE(bool_or(supplier_oric_match), false) as is_indigenous,
             COALESCE(bool_or(supplier_acnc_match), false) as is_charity,
             COUNT(*) as contract_count,
             COALESCE(SUM(contract_value), 0) as total_value
      FROM austender_contracts
      WHERE supplier_abn IS NOT NULL
        AND supplier_abn NOT IN (SELECT abn FROM gs_entities WHERE abn IS NOT NULL)
      GROUP BY supplier_abn
      ORDER BY total_value DESC
      LIMIT 1000
    `,
  });

  if (supErr) {
    console.error('Error fetching suppliers:', supErr.message);
    process.exit(1);
  }

  console.log(`Found ${suppliers.length} missing suppliers (batch capped at 1000)`);

  if (DRY_RUN) {
    console.log('Top 10:');
    for (const s of suppliers.slice(0, 10)) {
      console.log(`  ${s.supplier_abn} | ${s.supplier_name} | $${Number(s.total_value).toLocaleString()} | ${s.contract_count} contracts`);
    }
    return;
  }

  // Step 2: Create entities in batches
  let created = 0;
  for (let i = 0; i < suppliers.length; i += BATCH) {
    const batch = suppliers.slice(i, i + BATCH);
    const entities = batch.map((s) => ({
      gs_id: `AU-ABN-${s.supplier_abn}`,
      canonical_name: s.supplier_name,
      abn: s.supplier_abn,
      entity_type: s.is_indigenous ? 'indigenous_corp' : s.is_charity ? 'charity' : 'company',
      source_datasets: ['austender'],
      source_count: 1,
      confidence: 'medium',
      tags: ['austender-supplier'],
    }));

    const { error } = await supabase
      .from('gs_entities')
      .upsert(entities, { onConflict: 'gs_id', ignoreDuplicates: true });

    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message);
    } else {
      created += batch.length;
      console.log(`Created entities: ${created}/${suppliers.length}`);
    }
  }

  console.log(`\nEntity creation complete: ${created} entities`);

  // Step 3: Now create contract relationships
  // For each new entity, find their contracts and link to buyer entities
  console.log('\nCreating contract relationships...');

  // Get buyer ABNs that exist as entities
  const { data: buyerEntities, error: buyerErr } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT DISTINCT buyer_id, buyer_name
      FROM austender_contracts
      WHERE buyer_id IS NOT NULL
      LIMIT 1000
    `,
  });

  if (buyerErr) {
    console.error('Error fetching buyers:', buyerErr.message);
    return;
  }

  // Look up buyer entities by name
  const buyerMap = new Map();
  for (const b of buyerEntities || []) {
    // Try to find entity by buyer_id (which is often an ABN-like identifier)
    const { data: match } = await supabase
      .from('gs_entities')
      .select('id')
      .or(`canonical_name.ilike.%${b.buyer_name.replace(/[%_']/g, '')}%`)
      .limit(1);
    if (match?.[0]) {
      buyerMap.set(b.buyer_id, match[0].id);
    }
  }

  console.log(`Mapped ${buyerMap.size} buyer entities`);

  // Create relationships for newly created entities
  let relCount = 0;
  for (let i = 0; i < suppliers.length; i += 100) {
    const batch = suppliers.slice(i, i + 100);
    const abns = batch.map((s) => s.supplier_abn);

    // Get entity IDs for these suppliers
    const { data: entityRows } = await supabase
      .from('gs_entities')
      .select('id, abn')
      .in('abn', abns);

    if (!entityRows?.length) continue;
    const entityByAbn = new Map(entityRows.map((e) => [e.abn, e.id]));

    // Get contracts for these suppliers
    const { data: contracts } = await supabase
      .from('austender_contracts')
      .select('supplier_abn, buyer_id, contract_value, contract_start, contract_end')
      .in('supplier_abn', abns)
      .not('contract_value', 'is', null)
      .order('contract_value', { ascending: false })
      .limit(500);

    if (!contracts?.length) continue;

    // Aggregate by supplier+buyer pair
    const relMap = new Map();
    for (const c of contracts) {
      const supplierId = entityByAbn.get(c.supplier_abn);
      const buyerId = buyerMap.get(c.buyer_id);
      if (!supplierId || !buyerId) continue;

      const key = `${buyerId}:${supplierId}`;
      const existing = relMap.get(key);
      if (existing) {
        existing.amount += Number(c.contract_value) || 0;
      } else {
        relMap.set(key, {
          source_entity_id: buyerId,
          target_entity_id: supplierId,
          relationship_type: 'contract',
          amount: Number(c.contract_value) || 0,
          dataset: 'austender',
          confidence: 'high',
        });
      }
    }

    const rels = Array.from(relMap.values());
    if (rels.length > 0) {
      const { error: relErr } = await supabase
        .from('gs_relationships')
        .upsert(rels, { onConflict: 'source_entity_id,target_entity_id,relationship_type,dataset', ignoreDuplicates: true });

      if (relErr) {
        console.error(`Relationship batch error:`, relErr.message);
      } else {
        relCount += rels.length;
      }
    }
  }

  console.log(`Created ${relCount} contract relationships`);
  console.log('Done!');
}

main().catch(console.error);
