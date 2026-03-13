#!/usr/bin/env node
/**
 * hydrate-goods-procurement.mjs
 *
 * Fills empty spend columns in goods_procurement_entities from austender_contracts.
 * Processes in batches to avoid timeout on the large austender table (672K rows).
 *
 * Fills:
 *   - estimated_annual_spend  ← total contract value / years active
 *   - govt_contract_value     ← SUM of all contracts (with goods keyword boost)
 *   - govt_contract_count     ← COUNT of contracts
 *
 * Run: node --env-file=.env scripts/hydrate-goods-procurement.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}\nQuery: ${query.slice(0, 300)}`);
  return data || [];
}

async function sqlAll(query, orderCol = 'id') {
  const PAGE = 900;
  let all = [];
  let offset = 0;
  while (true) {
    const page = await sql(`${query} ORDER BY ${orderCol} LIMIT ${PAGE} OFFSET ${offset}`);
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// Keywords indicating goods/furniture/housing procurement relevance
const GOODS_KEYWORDS = [
  'furniture', 'bed', 'mattress', 'housing', 'accommodation',
  'white goods', 'appliance', 'washing', 'refrigerat', 'linen',
  'fitout', 'fit-out', 'furnish', 'kitchen', 'laundry',
];

async function main() {
  console.log('=== Hydrate Goods Procurement Entities ===\n');

  // 1. Get all procurement entities with ABNs
  const entities = await sqlAll(`
    SELECT id, abn, entity_name, gs_id
    FROM goods_procurement_entities
    WHERE abn IS NOT NULL
  `, 'id');
  console.log(`Found ${entities.length} procurement entities to hydrate\n`);

  // 2. Get unique ABNs for batch lookup
  const uniqueAbns = [...new Set(entities.map(e => e.abn).filter(Boolean))];
  console.log(`Unique ABNs: ${uniqueAbns.length}`);

  // 3. Process ABNs in batches to avoid timeout
  const ABN_BATCH_SIZE = 100;
  const contractData = new Map(); // abn → { total_value, count, min_year, max_year, goods_value }

  for (let i = 0; i < uniqueAbns.length; i += ABN_BATCH_SIZE) {
    const batch = uniqueAbns.slice(i, i + ABN_BATCH_SIZE);
    const abnList = batch.map(a => `'${a}'`).join(',');

    const rows = await sql(`
      SELECT
        supplier_abn,
        COUNT(*) as contract_count,
        SUM(contract_value) as total_value,
        MIN(EXTRACT(YEAR FROM contract_start)) as min_year,
        MAX(EXTRACT(YEAR FROM contract_start)) as max_year
      FROM austender_contracts
      WHERE supplier_abn IN (${abnList})
      GROUP BY supplier_abn
    `);

    for (const r of rows) {
      contractData.set(r.supplier_abn, {
        total_value: Number(r.total_value) || 0,
        count: Number(r.contract_count) || 0,
        min_year: Number(r.min_year) || 2020,
        max_year: Number(r.max_year) || 2025,
        goods_value: 0, // Will be filled in goods-specific query
      });
    }

    // Also check for goods-specific contracts in this batch
    const goodsPattern = GOODS_KEYWORDS.map(k => `title ILIKE '%${k}%'`).join(' OR ');
    const goodsRows = await sql(`
      SELECT
        supplier_abn,
        SUM(contract_value) as goods_value
      FROM austender_contracts
      WHERE supplier_abn IN (${abnList})
        AND (${goodsPattern})
      GROUP BY supplier_abn
    `);

    for (const r of goodsRows) {
      const existing = contractData.get(r.supplier_abn);
      if (existing) {
        existing.goods_value = Number(r.goods_value) || 0;
      }
    }

    process.stdout.write(`\r  Queried ${Math.min(i + ABN_BATCH_SIZE, uniqueAbns.length)}/${uniqueAbns.length} ABNs`);
  }

  console.log(`\nFound contract data for ${contractData.size} entities\n`);

  // 4. Also enrich from gs_relationships (grants/donations)
  const relationshipData = new Map();
  for (let i = 0; i < uniqueAbns.length; i += ABN_BATCH_SIZE) {
    const batch = uniqueAbns.slice(i, i + ABN_BATCH_SIZE);
    const abnList = batch.map(a => `'${a}'`).join(',');

    const rows = await sql(`
      SELECT e.abn, SUM(r.amount) as relationship_total, COUNT(*) as rel_count
      FROM gs_relationships r
      JOIN gs_entities e ON e.id = r.target_entity_id
      WHERE e.abn IN (${abnList}) AND r.amount > 0
      GROUP BY e.abn
    `);

    for (const r of rows) {
      relationshipData.set(r.abn, {
        total: Number(r.relationship_total) || 0,
        count: Number(r.rel_count) || 0,
      });
    }
  }
  console.log(`Found relationship data for ${relationshipData.size} entities\n`);

  // 5. Update procurement entities
  const BATCH_SIZE = 50;
  let batch = [];
  let updated = 0;
  let withContracts = 0;

  for (const ent of entities) {
    const contracts = contractData.get(ent.abn);
    const relationships = relationshipData.get(ent.abn);

    const totalContractValue = contracts?.total_value || 0;
    const goodsContractValue = contracts?.goods_value || 0;
    const contractCount = contracts?.count || 0;
    const relTotal = relationships?.total || 0;

    // Estimated annual spend = total contract value / years active
    const yearsActive = contracts ? Math.max(1, (contracts.max_year - contracts.min_year) + 1) : 1;
    const annualContractSpend = totalContractValue / yearsActive;
    const annualRelSpend = relTotal / 5; // Assume 5 years of relationship data

    const estimatedAnnualSpend = annualContractSpend + annualRelSpend;

    // Fit score: higher if entity has goods-specific contracts
    let fitScore = 0;
    if (goodsContractValue > 0) fitScore += 50;
    if (totalContractValue > 1000000) fitScore += 20;
    if (contractCount > 10) fitScore += 15;
    if (relTotal > 0) fitScore += 15;

    if (totalContractValue > 0 || relTotal > 0) withContracts++;

    batch.push({
      id: ent.id,
      estimated_annual_spend: Math.round(estimatedAnnualSpend * 100) / 100,
      govt_contract_value: Math.round(totalContractValue * 100) / 100,
      govt_contract_count: contractCount,
      fit_score: fitScore,
      updated_at: new Date().toISOString(),
    });

    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch);
      updated += batch.length;
      batch = [];
      process.stdout.write(`\r  Updated ${updated}/${entities.length}`);
    }
  }

  if (batch.length > 0) {
    await upsertBatch(batch);
    updated += batch.length;
  }

  console.log(`\n\nProcurement hydration complete:`);
  console.log(`  Entities updated: ${updated}`);
  console.log(`  With contract/relationship data: ${withContracts}\n`);

  // 6. Verify
  const verify = await sql(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE estimated_annual_spend > 0) as has_spend,
      COUNT(*) FILTER (WHERE govt_contract_value > 0) as has_contracts,
      COUNT(*) FILTER (WHERE govt_contract_count > 0) as has_count,
      ROUND(SUM(govt_contract_value)::numeric, 0) as total_contract_value,
      ROUND(AVG(estimated_annual_spend)::numeric, 0) as avg_annual_spend
    FROM goods_procurement_entities
  `);
  console.log('Verification:');
  console.table(verify);
}

async function upsertBatch(rows) {
  for (const { id, ...updates } of rows) {
    const { error } = await supabase
      .from('goods_procurement_entities')
      .update(updates)
      .eq('id', id);
    if (error) throw new Error(`Update error for ${id}: ${error.message}`);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
