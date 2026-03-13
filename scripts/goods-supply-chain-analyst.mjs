#!/usr/bin/env node
/**
 * goods-supply-chain-analyst.mjs
 *
 * Analyzes supply chain economics for Goods communities.
 * - Calculates delivered cost per product per community
 * - Identifies supply route optimizations
 * - Computes community-level idiot index
 * - Generates supply chain health reports
 *
 * Run: node --env-file=.env scripts/goods-supply-chain-analyst.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL: ${error.message}`);
  return data || [];
}

async function main() {
  const startedAt = Date.now();
  let itemsFound = 0, itemsNew = 0;

  console.log('=== Goods Supply Chain Analyst ===\n');

  // 1. Load products and communities (batch by state to avoid exec_sql 1000-row limit)
  const products = await sql(`SELECT * FROM goods_products WHERE status IN ('active', 'prototype')`);
  let communities = [];
  for (const st of ['NT','WA','QLD','SA','NSW','TAS','VIC','ACT']) {
    const rows = await sql(`
      SELECT id, community_name, state, remoteness, estimated_freight_cost_per_kg,
             last_mile_method, nearest_staging_hub, freight_corridor,
             total_local_entities, buyer_entity_count, assets_deployed
      FROM goods_communities
      WHERE state = '${st}' AND priority IN ('lead', 'active', 'warm', 'monitor')
      ORDER BY total_local_entities DESC
    `);
    communities = communities.concat(rows);
  }
  itemsFound = communities.length;
  console.log(`1. ${products.length} products, ${communities.length} priority communities\n`);

  // 2. Calculate delivered cost per product per community
  console.log('2. Calculating delivered costs...');
  const routeRows = [];

  for (const comm of communities) {
    const freightPerKg = Number(comm.estimated_freight_cost_per_kg) || 3.0;

    for (const prod of products) {
      const weightKg = Number(prod.weight_kg) || 30;
      const wholesalePrice = Number(prod.wholesale_price_aud) || 0;
      const freightCost = freightPerKg * weightKg;
      const deliveredCost = wholesalePrice + freightCost;

      // Compare to incumbent
      const incumbentCost = Number(prod.typical_delivered_cost_remote) || 0;
      const savings = incumbentCost > 0 ? incumbentCost - deliveredCost : 0;
      const savingsPct = incumbentCost > 0 ? Math.round(100 * savings / incumbentCost) : 0;

      routeRows.push({
        community_id: comm.id,
        route_name: `${comm.nearest_staging_hub} → ${comm.community_name}`,
        is_primary: true,
        origin_city: comm.nearest_staging_hub || 'Unknown',
        staging_hub: comm.nearest_staging_hub || null,
        last_mile_origin: comm.nearest_staging_hub || null,
        last_mile_method: comm.last_mile_method || 'road',
        freight_cost_per_kg: freightPerKg,
        [`delivered_cost_per_${prod.category}`]: deliveredCost,
        seasonal_access: 'year_round',
      });
    }
    itemsNew++;
  }

  // Upsert primary routes (one per community)
  const primaryRoutes = new Map();
  for (const r of routeRows) {
    const key = r.community_id;
    if (!primaryRoutes.has(key)) {
      primaryRoutes.set(key, {
        community_id: r.community_id,
        route_name: r.route_name,
        is_primary: true,
        origin_city: r.origin_city,
        staging_hub: r.staging_hub,
        last_mile_origin: r.last_mile_origin,
        last_mile_method: r.last_mile_method,
        freight_cost_per_kg: r.freight_cost_per_kg,
        seasonal_access: 'year_round',
      });
    }
    // Merge per-product delivered costs
    const existing = primaryRoutes.get(key);
    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith('delivered_cost_per_')) existing[k] = v;
    }
  }

  const routeArray = [...primaryRoutes.values()];
  const BATCH = 50;
  for (let i = 0; i < routeArray.length; i += BATCH) {
    const batch = routeArray.slice(i, i + BATCH);
    const { error } = await supabase.from('goods_supply_routes').upsert(batch, {
      onConflict: 'community_id,route_name',
      ignoreDuplicates: false,
    });
    // Will fail on unique constraint since we don't have one — just insert
    if (error) {
      // Try insert instead
      await supabase.from('goods_supply_routes').insert(batch);
    }
  }
  console.log(`   Calculated routes for ${primaryRoutes.size} communities\n`);

  // 3. Supply chain health report
  console.log('3. Supply chain health report...\n');

  // Communities by freight corridor
  const corridorStats = await sql(`
    SELECT freight_corridor, COUNT(*) as communities,
      SUM(assets_deployed) as total_assets,
      SUM(buyer_entity_count) as total_buyers,
      AVG(estimated_freight_cost_per_kg) as avg_freight_cost
    FROM goods_communities
    WHERE priority IN ('lead', 'active', 'warm', 'monitor')
    GROUP BY freight_corridor
    ORDER BY communities DESC
    LIMIT 15
  `);

  console.log('=== FREIGHT CORRIDORS ===');
  for (const c of corridorStats) {
    console.log(`${c.freight_corridor}: ${c.communities} communities, ${c.total_assets} assets, ${c.total_buyers} buyers, $${Number(c.avg_freight_cost).toFixed(2)}/kg`);
  }

  // Communities by last-mile method
  const lastMileStats = await sql(`
    SELECT last_mile_method, COUNT(*) as communities,
      AVG(estimated_freight_cost_per_kg) as avg_cost
    FROM goods_communities WHERE priority IN ('lead', 'active', 'warm', 'monitor')
    GROUP BY last_mile_method ORDER BY communities DESC
  `);

  console.log('\n=== LAST MILE METHODS ===');
  for (const m of lastMileStats) {
    console.log(`${m.last_mile_method}: ${m.communities} communities, avg $${Number(m.avg_cost).toFixed(2)}/kg`);
  }

  // Idiot index per product at different remoteness levels
  console.log('\n=== DELIVERED ECONOMICS (per product per remoteness) ===');
  for (const prod of products) {
    const weightKg = Number(prod.weight_kg) || 30;
    const wholesale = Number(prod.wholesale_price_aud) || 0;
    const incumbent = Number(prod.typical_delivered_cost_remote) || 0;
    const materialCost = Number(prod.material_cost_aud) || 1;

    console.log(`\n${prod.name}:`);
    for (const [label, freightRate] of [['Road ($2/kg)', 2], ['Barge ($6.3/kg)', 6.3], ['Charter ($17.5/kg)', 17.5]]) {
      const freight = freightRate * weightKg;
      const delivered = wholesale + freight;
      const localIdiot = Math.round(delivered / materialCost * 10) / 10;
      const incumbentIdiot = Math.round(incumbent / materialCost * 10) / 10;
      const saving = incumbent > 0 ? Math.round(100 * (1 - delivered / incumbent)) : 0;
      console.log(`  ${label}: Goods $${delivered.toFixed(0)} (${localIdiot}x idiot) vs Incumbent $${incumbent.toFixed(0)} (${incumbentIdiot}x) — ${saving}% savings`);
    }
  }

  // 4. Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Communities analyzed: ${itemsNew}`);
  console.log(`Routes calculated:   ${primaryRoutes.size}`);

  if (runId) await logComplete(supabase, runId, { items_found: itemsFound, items_new: itemsNew });
}

let runId;
(async () => {
  const run = await logStart(supabase, 'goods-supply-chain-analyst', 'Goods Supply Chain Analyst');
  runId = run?.id || null;
  await main();
})().catch(async (err) => {
  console.error('FATAL:', err);
  if (runId) try { await logFailed(supabase, runId, err); } catch {}
  process.exit(1);
});
