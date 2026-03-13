#!/usr/bin/env node
/**
 * estimate-goods-demand.mjs
 *
 * Estimates household goods demand per community and computes priority scores.
 *
 * Formula:
 *   households = population / 3.5 (remote Indigenous avg household size)
 *   demand_beds = households * 1.2 (20% replacement/new)
 *   demand_washers = households * 0.15 (15% annual replacement)
 *   demand_fridges = households * 0.15
 *   demand_mattresses = demand_beds (1:1 with beds)
 *
 * Priority score combines demand value, remoteness, and disadvantage.
 *
 * Run: node --env-file=.env scripts/estimate-goods-demand.mjs
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

// Product pricing (retail delivered)
const PRICES = {
  bed: 850,
  washer: 1200,
  fridge: 1500,
  mattress: 600,
};

// Remoteness multipliers — more remote = more need, less supply
const REMOTENESS_MULT = {
  'Very Remote Australia': 2.0,
  'Remote Australia': 1.5,
  'Outer Regional Australia': 1.0,
  'Inner Regional Australia': 0.7,
  'Major Cities of Australia': 0.5,
};

// SEIFA IRSD disadvantage multipliers — lower decile = more disadvantage
function seifaMultiplier(decile) {
  if (!decile || decile <= 0) return 1.5; // Unknown = assume disadvantaged
  if (decile <= 1) return 2.0;
  if (decile <= 2) return 1.8;
  if (decile <= 3) return 1.5;
  if (decile <= 5) return 1.2;
  return 1.0;
}

async function main() {
  console.log('=== Estimate Goods Demand per Community ===\n');

  // 1. Load communities with population data
  const communities = await sqlAll(`
    SELECT id, community_name, state, postcode, remoteness,
           estimated_population, estimated_households
    FROM goods_communities
  `, 'id');
  console.log(`Processing ${communities.length} communities`);

  // 2. Load SEIFA data
  const seifaMap = new Map();
  const seifaRows = await sqlAll(`
    SELECT postcode, decile_national FROM seifa_2021 WHERE index_type = 'IRSD'
  `, 'postcode');
  for (const r of seifaRows) {
    seifaMap.set(r.postcode, Number(r.decile_national));
  }
  console.log(`Loaded SEIFA for ${seifaRows.length} postcodes\n`);

  // 3. Estimate demand for each community
  const BATCH_SIZE = 50;
  let batch = [];
  let updated = 0;
  let totalDemandValue = 0;
  let withPopulation = 0;
  let withoutPopulation = 0;

  for (const c of communities) {
    let population = Number(c.estimated_population) || 0;
    let households = Number(c.estimated_households) || 0;

    // If no population data, estimate from state averages for remote Indigenous communities
    if (population === 0) {
      // Conservative estimate: 150 people for unknown small communities
      population = 150;
      withoutPopulation++;
    } else {
      withPopulation++;
    }

    // Calculate households if not set
    if (households === 0) {
      households = Math.max(1, Math.round(population / 3.5));
    }

    // Demand estimates
    const demandBeds = Math.round(households * 1.2);
    const demandWashers = Math.round(households * 0.15);
    const demandFridges = Math.round(households * 0.15);
    const demandMattresses = demandBeds; // 1:1 with beds

    // Dollar values
    const bedValue = demandBeds * PRICES.bed;
    const washerValue = demandWashers * PRICES.washer;
    const fridgeValue = demandFridges * PRICES.fridge;
    const mattressValue = demandMattresses * PRICES.mattress;
    const totalValue = bedValue + washerValue + fridgeValue + mattressValue;

    // Priority scoring
    const remoteMult = REMOTENESS_MULT[c.remoteness] || 1.0;
    const seifaDecile = c.postcode ? seifaMap.get(c.postcode) : null;
    const disadvantageMult = seifaMultiplier(seifaDecile);

    // Priority = weighted demand * location multipliers
    const rawPriority = (demandBeds * 3 + demandWashers + demandFridges) * remoteMult * disadvantageMult;

    // Classify tier (constraint: background, monitor, warm, active, lead)
    let priority;
    if (totalValue > 500000) priority = 'lead';
    else if (totalValue > 100000) priority = 'active';
    else if (totalValue > 25000) priority = 'warm';
    else if (totalValue > 5000) priority = 'monitor';
    else priority = 'background';

    totalDemandValue += totalValue;

    batch.push({
      id: c.id,
      estimated_population: population,
      estimated_households: households,
      demand_beds: demandBeds,
      demand_washers: demandWashers,
      demand_fridges: demandFridges,
      demand_mattresses: demandMattresses,
      priority,
      data_quality_score: population > 0 && c.remoteness ? 75 : 50,
      updated_at: new Date().toISOString(),
    });

    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch);
      updated += batch.length;
      batch = [];
      process.stdout.write(`\r  Updated ${updated}/${communities.length}`);
    }
  }

  if (batch.length > 0) {
    await upsertBatch(batch);
    updated += batch.length;
  }

  console.log(`\n\nDemand estimation complete:`);
  console.log(`  Communities updated: ${updated}`);
  console.log(`  With real population data: ${withPopulation}`);
  console.log(`  Using estimated population: ${withoutPopulation}`);
  console.log(`  Total annual demand value: $${(totalDemandValue / 1_000_000).toFixed(1)}M\n`);

  // 4. Verify
  const verify = await sql(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE demand_beds > 0) as has_bed_demand,
      COUNT(*) FILTER (WHERE demand_washers > 0) as has_washer_demand,
      SUM(demand_beds) as total_bed_demand,
      SUM(demand_washers) as total_washer_demand,
      SUM(demand_fridges) as total_fridge_demand
    FROM goods_communities
  `);
  console.log('Verification:');
  console.table(verify);

  // 5. Print top communities by demand
  const top = await sql(`
    SELECT community_name, state, remoteness, estimated_population,
           demand_beds, demand_washers, demand_fridges, priority
    FROM goods_communities
    WHERE demand_beds > 0
    ORDER BY demand_beds DESC
    LIMIT 15
  `);
  console.log('\nTop 15 communities by bed demand:');
  console.table(top);
}

async function upsertBatch(rows) {
  for (const { id, ...updates } of rows) {
    const { error } = await supabase
      .from('goods_communities')
      .update(updates)
      .eq('id', id);
    if (error) throw new Error(`Update error for ${id}: ${error.message}`);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
