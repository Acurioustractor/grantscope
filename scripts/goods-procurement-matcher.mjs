#!/usr/bin/env node
/**
 * goods-procurement-matcher.mjs
 *
 * Matches procurement signals to buyers and funding sources.
 * For each 'new' signal:
 * 1. Find local procurement entities in the community
 * 2. Match grants/foundations that could fund the order
 * 3. Score and rank procurement paths
 * 4. Generate demand_unmet signals for communities with no assets
 *
 * Run: node --env-file=.env scripts/goods-procurement-matcher.mjs
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

// Goods-relevant grant keywords
const GOODS_GRANT_KEYWORDS = [
  'indigenous', 'remote', 'community', 'housing', 'health', 'infrastructure',
  'furniture', 'equipment', 'essential', 'wellbeing', 'social enterprise',
  'first nations', 'aboriginal', 'torres strait', 'disability', 'ndis',
  'aged care', 'homelessness', 'domestic violence', 'youth',
];

// Goods-relevant foundation themes
const GOODS_FOUNDATION_THEMES = [
  'indigenous', 'housing', 'health', 'education', 'community development',
  'social enterprise', 'remote communities', 'poverty', 'disadvantage',
];

async function main() {
  const startedAt = Date.now();
  let itemsFound = 0, itemsNew = 0;

  console.log('=== Goods Procurement Matcher ===\n');

  // 1. Find new signals
  const signals = await sql(`
    SELECT gps.id, gps.community_id, gps.signal_type, gps.title, gps.products_needed
    FROM goods_procurement_signals gps
    WHERE gps.status = 'new'
    ORDER BY gps.priority DESC, gps.created_at ASC
    LIMIT 200
  `);
  itemsFound = signals.length;
  console.log(`1. ${signals.length} new signals to process\n`);

  // 2. For each signal, match buyers and funding
  console.log('2. Matching procurement paths...');
  for (const sig of signals) {
    if (!sig.community_id) continue;

    // Find local buyer entities
    const buyers = await sql(`
      SELECT gpe.id, gpe.entity_name, gpe.buyer_role, gpe.procurement_method,
             gpe.govt_contract_value, gpe.relationship_status
      FROM goods_procurement_entities gpe
      WHERE gpe.community_id = '${sig.community_id}'
      ORDER BY gpe.govt_contract_value DESC NULLS LAST
      LIMIT 10
    `);

    // Auto-assign best buyer if available
    if (buyers.length > 0) {
      const bestBuyer = buyers[0];
      const { error } = await supabase.from('goods_procurement_signals').update({
        buyer_entity_id: bestBuyer.id,
        description: (sig.title || '') + `\n\nBest buyer match: ${bestBuyer.entity_name} (${bestBuyer.buyer_role})` +
          (buyers.length > 1 ? `\n${buyers.length - 1} other potential buyers in area.` : ''),
      }).eq('id', sig.id);
      if (error) console.log(`   Update error: ${error.message.slice(0, 80)}`);
    }

    itemsNew++;
  }
  console.log(`   Processed ${itemsNew} signals\n`);

  // 3. Find communities with demand but no assets (generate demand_unmet signals)
  console.log('3. Checking for unmet demand...');
  const unmetDemand = await sql(`
    SELECT gc.id, gc.community_name, gc.state, gc.demand_beds, gc.demand_washers,
           gc.assets_deployed, gc.buyer_entity_count, gc.priority
    FROM goods_communities gc
    WHERE gc.priority IN ('lead', 'active', 'warm', 'monitor')
      AND (gc.demand_beds > 0 OR gc.demand_washers > 0)
      AND gc.assets_deployed = 0
      AND NOT EXISTS (
        SELECT 1 FROM goods_procurement_signals gps
        WHERE gps.community_id = gc.id AND gps.signal_type = 'demand_unmet' AND gps.status IN ('new', 'reviewing')
      )
    ORDER BY gc.priority DESC
    LIMIT 50
  `);

  if (unmetDemand.length > 0) {
    const newSignals = unmetDemand.map(c => ({
      signal_type: 'demand_unmet',
      priority: c.priority === 'lead' ? 'high' : 'medium',
      community_id: c.id,
      title: `Unmet demand: ${c.community_name} (${c.state}) — ${c.demand_beds} beds, ${c.demand_washers} washers`,
      description: `Community has expressed demand but no assets deployed. ${c.buyer_entity_count} potential buyer entities in area.`,
      estimated_units: Number(c.demand_beds) + Number(c.demand_washers),
      products_needed: [
        ...(Number(c.demand_beds) > 0 ? ['bed'] : []),
        ...(Number(c.demand_washers) > 0 ? ['washer'] : []),
      ],
      source_agent: 'goods-procurement-matcher',
    }));

    const { error } = await supabase.from('goods_procurement_signals').insert(newSignals);
    if (error) console.log(`   Demand signal error: ${error.message.slice(0, 100)}`);
    else console.log(`   Generated ${newSignals.length} demand_unmet signals\n`);
  } else {
    console.log('   No new demand signals needed\n');
  }

  // 4. Match open grants to communities
  console.log('4. Matching grants to communities...');
  const keywordPattern = GOODS_GRANT_KEYWORDS.map(k => `'%${k}%'`).join(', ');
  const openGrants = await sql(`
    SELECT id, name, provider, amount_min, amount_max, closes_at, categories, focus_areas, geography
    FROM grant_opportunities
    WHERE (closes_at IS NULL OR closes_at > NOW())
      AND (
        ${GOODS_GRANT_KEYWORDS.map(k => `name ILIKE '%${k}%' OR array_to_string(categories, ',') ILIKE '%${k}%' OR array_to_string(focus_areas, ',') ILIKE '%${k}%'`).join(' OR ')}
      )
    ORDER BY amount_max DESC NULLS LAST
    LIMIT 50
  `);
  console.log(`   Found ${openGrants.length} potentially relevant open grants`);

  // Update signals with matching grant IDs
  if (openGrants.length > 0) {
    const grantIds = openGrants.map(g => g.id);
    // Update all new community signals with grant matches
    const newSignals = await sql(`SELECT id FROM goods_procurement_signals WHERE status = 'new' AND community_id IS NOT NULL`);
    for (const sig of newSignals.slice(0, 100)) {
      await supabase.from('goods_procurement_signals').update({
        matched_grant_ids: grantIds.slice(0, 5),
        funding_confidence: 'possible',
      }).eq('id', sig.id);
    }
    console.log(`   Linked ${Math.min(newSignals.length, 100)} signals to ${openGrants.length} grants\n`);
  }

  // 5. Summary
  const [summary] = await sql(`
    SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count,
      COUNT(CASE WHEN signal_type = 'asset_end_of_life' THEN 1 END) as eol,
      COUNT(CASE WHEN signal_type = 'demand_unmet' THEN 1 END) as unmet
    FROM goods_procurement_signals
  `);

  console.log('=== SUMMARY ===');
  console.log(`Total signals:    ${summary.total}`);
  console.log(`  New:            ${summary.new_count}`);
  console.log(`  End-of-life:    ${summary.eol}`);
  console.log(`  Demand unmet:   ${summary.unmet}`);
  console.log(`Grants matched:   ${openGrants.length}`);

  if (runId) await logComplete(supabase, runId, { items_found: itemsFound, items_new: itemsNew });
}

let runId;
(async () => {
  const run = await logStart(supabase, 'goods-procurement-matcher', 'Goods Procurement Matcher');
  runId = run?.id || null;
  await main();
})().catch(async (err) => {
  console.error('FATAL:', err);
  if (runId) try { await logFailed(supabase, runId, err); } catch {}
  process.exit(1);
});
