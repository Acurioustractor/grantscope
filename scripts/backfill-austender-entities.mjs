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

  // Dedup and diff in JS instead of SQL — 770K × 587K JOIN exceeds the 8s
  // Supabase statement timeout. Pagination + in-memory sets finishes in ~30s
  // and produces the same result.

  // Step 1a: load existing gs_entity ABNs into a Set.
  // PostgREST caps responses at 1000 rows by default, so paginate 1000 at a time.
  // With ~350K entities that have ABNs, this is ~350 requests = ~20s.
  console.log('  loading existing gs_entities ABNs...');
  const existingAbns = new Set();
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('gs_entities')
        .select('abn')
        .not('abn', 'is', null)
        .order('abn')
        .range(from, from + PAGE - 1);
      if (error) { console.error('Error loading gs_entities ABNs:', error.message); process.exit(1); }
      if (!data || data.length === 0) break;
      for (const row of data) if (row.abn) existingAbns.add(row.abn);
      if (from % 50000 === 0) console.log(`    ${existingAbns.size} loaded...`);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  console.log(`  loaded ${existingAbns.size} existing ABNs`);

  // Step 1b: scan austender_contracts for unique supplier ABNs not in existingAbns
  console.log('  scanning austender_contracts for missing suppliers...');
  const supplierMap = new Map(); // abn → { supplier_abn, supplier_name, is_indigenous, is_charity }
  {
    let from = 0;
    const PAGE = 1000;
    const TARGET = 1000; // cap per run
    while (supplierMap.size < TARGET) {
      const { data, error } = await supabase
        .from('austender_contracts')
        .select('supplier_abn, supplier_name, supplier_oric_match, supplier_acnc_match')
        .not('supplier_abn', 'is', null)
        .range(from, from + PAGE - 1);
      if (error) { console.error('Error scanning contracts:', error.message); process.exit(1); }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const abn = row.supplier_abn;
        if (!abn || existingAbns.has(abn) || supplierMap.has(abn)) continue;
        supplierMap.set(abn, {
          supplier_abn: abn,
          supplier_name: row.supplier_name,
          is_indigenous: row.supplier_oric_match === true,
          is_charity: row.supplier_acnc_match === true,
        });
        if (supplierMap.size >= TARGET) break;
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const suppliers = Array.from(supplierMap.values());

  console.log(`Found ${suppliers.length} missing suppliers (batch capped at 1000)`);

  if (DRY_RUN) {
    console.log('Top 10:');
    for (const s of suppliers.slice(0, 10)) {
      console.log(`  ${s.supplier_abn} | ${s.supplier_name}${s.is_indigenous ? ' [indigenous]' : ''}${s.is_charity ? ' [charity]' : ''}`);
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
    query: `
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
