#!/usr/bin/env node
/**
 * goods-lifecycle-sync.mjs
 *
 * Syncs asset data from Goods Asset Register CSV into goods_asset_lifecycle.
 * Computes age, overdue status, and generates procurement signals for
 * assets needing replacement.
 *
 * Run: node --env-file=.env scripts/goods-lifecycle-sync.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
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

const GOODS_REPO = process.env.GOODS_REPO_PATH || '/Users/benknight/Code/Goods Asset Register';
const CSV_PATH = join(GOODS_REPO, 'data', 'expanded_assets_final.csv');

// Product slug mapping
const PRODUCT_SLUGS = {
  'basket bed': 'stretch-bed',        // Legacy name maps to current
  'stretch bed': 'stretch-bed',
  'id washing machine': 'id-washing-machine',
  'weave bed': 'stretch-bed',         // Discontinued, map to stretch
};

// Expected lifespan by product (months)
const EXPECTED_LIFESPAN = {
  'stretch-bed': 120,
  'id-washing-machine': 60,
};

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

async function main() {
  const startedAt = Date.now();
  let itemsFound = 0, itemsNew = 0;

  console.log('=== Goods Lifecycle Sync ===\n');

  // 1. Read CSV
  let csvText;
  try {
    csvText = readFileSync(CSV_PATH, 'utf8');
  } catch {
    console.log(`CSV not found at ${CSV_PATH} — skipping`);
    return;
  }

  const assets = parseCSV(csvText);
  itemsFound = assets.length;
  console.log(`1. Loaded ${assets.length} assets from CSV\n`);

  // 2. Get community mapping
  const communities = await sql(`SELECT id, community_name FROM goods_communities`);
  const commMap = new Map();
  for (const c of communities) {
    commMap.set(c.community_name.toLowerCase(), c.id);
  }
  console.log(`2. ${communities.length} communities loaded\n`);

  // 3. Upsert assets into goods_asset_lifecycle
  console.log('3. Syncing assets...');
  const now = new Date();
  const BATCH = 50;
  const rows = [];

  for (const a of assets) {
    const productType = (a.product || '').toLowerCase();
    const slug = PRODUCT_SLUGS[productType] || null;
    const communityName = a.community || '';
    const communityId = commMap.get(communityName.toLowerCase()) || null;

    const deployedAt = a.supply_date ? new Date(a.supply_date) : null;
    const lastCheckin = a.last_checkin_date ? new Date(a.last_checkin_date) : null;

    // Compute age
    let ageMonths = null;
    if (deployedAt && !isNaN(deployedAt.getTime())) {
      ageMonths = Math.floor((now - deployedAt) / (30 * 24 * 60 * 60 * 1000));
    }

    let monthsSinceCheckin = null;
    if (lastCheckin && !isNaN(lastCheckin.getTime())) {
      monthsSinceCheckin = Math.floor((now - lastCheckin) / (30 * 24 * 60 * 60 * 1000));
    }

    const isOverdue = !lastCheckin || isNaN(lastCheckin.getTime()) || monthsSinceCheckin > 6;

    // Replacement signal
    const expectedLife = EXPECTED_LIFESPAN[slug] || 120;
    const needsReplacement = ageMonths !== null && ageMonths > expectedLife * 0.8;
    const replacementReason = needsReplacement
      ? `Asset is ${ageMonths} months old (${Math.round(ageMonths / expectedLife * 100)}% of expected ${expectedLife}-month lifespan)`
      : null;

    rows.push({
      goods_asset_id: a.unique_id || a.id,
      product_slug: slug,
      community_id: communityId,
      asset_name: a.name || null,
      product_type: a.product || null,
      community_name: communityName,
      household: a.contact_household || null,
      deployed_at: deployedAt && !isNaN(deployedAt.getTime()) ? deployedAt.toISOString() : null,
      last_checkin_at: lastCheckin && !isNaN(lastCheckin.getTime()) ? lastCheckin.toISOString() : null,
      age_months: ageMonths,
      months_since_checkin: monthsSinceCheckin,
      is_overdue: isOverdue,
      needs_replacement: needsReplacement,
      replacement_reason: replacementReason,
      replacement_product_slug: needsReplacement ? slug : null,
      last_synced_at: now.toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('goods_asset_lifecycle').upsert(batch, {
      onConflict: 'goods_asset_id',
    });
    if (error) console.log(`   Batch ${i} error: ${error.message.slice(0, 100)}`);
    else itemsNew += batch.length;
    if (i % 200 === 0 && i > 0) process.stdout.write(`   ${i}/${rows.length}\r`);
  }
  console.log(`   Synced ${itemsNew} assets\n`);

  // 4. Generate procurement signals for assets needing replacement
  console.log('4. Generating procurement signals...');
  const needingReplacement = await sql(`
    SELECT gal.id, gal.community_id, gal.community_name, gal.product_slug, gal.product_type,
           gal.age_months, gal.replacement_reason
    FROM goods_asset_lifecycle gal
    WHERE gal.needs_replacement = true
      AND gal.community_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM goods_procurement_signals gps
        WHERE gps.asset_id = gal.id AND gps.signal_type = 'asset_end_of_life' AND gps.status IN ('new', 'reviewing')
      )
  `);

  if (needingReplacement.length > 0) {
    const signals = needingReplacement.map(a => ({
      signal_type: 'asset_end_of_life',
      priority: 'medium',
      community_id: a.community_id,
      asset_id: a.id,
      title: `${a.product_type || 'Asset'} replacement needed — ${a.community_name}`,
      description: a.replacement_reason,
      estimated_units: 1,
      products_needed: a.product_slug ? [a.product_slug.split('-')[0]] : ['bed'],
      source_agent: 'goods-lifecycle-sync',
    }));

    for (let i = 0; i < signals.length; i += BATCH) {
      const batch = signals.slice(i, i + BATCH);
      const { error } = await supabase.from('goods_procurement_signals').insert(batch);
      if (error) console.log(`   Signal batch error: ${error.message.slice(0, 100)}`);
    }
    console.log(`   Generated ${signals.length} replacement signals\n`);
  } else {
    console.log('   No new replacement signals needed\n');
  }

  // 5. Update community asset counts
  console.log('5. Updating community asset counts...');
  const commAssetCounts = await sql(`
    SELECT community_id, COUNT(*) as deployed,
      COUNT(CASE WHEN current_status = 'active' AND NOT is_overdue THEN 1 END) as active,
      COUNT(CASE WHEN is_overdue THEN 1 END) as overdue,
      MAX(last_checkin_at) as latest_checkin
    FROM goods_asset_lifecycle WHERE community_id IS NOT NULL
    GROUP BY community_id
  `);

  for (const c of commAssetCounts) {
    const { error } = await supabase.from('goods_communities').update({
      assets_deployed: Number(c.deployed),
      assets_active: Number(c.active),
      assets_overdue: Number(c.overdue),
      latest_checkin_date: c.latest_checkin,
    }).eq('id', c.community_id);
    if (error) console.log(`   Update error for ${c.community_id}: ${error.message.slice(0, 80)}`);
  }
  console.log(`   Updated ${commAssetCounts.length} communities\n`);

  // 6. Refresh MV (Skipped: view mv_goods_community_intelligence is currently deprecated/dropped)
  console.log('6. Refreshing MV... (Skipped)');
  console.log('   Done\n');

  // 7. Summary
  const [summary] = await sql(`
    SELECT COUNT(*) as total, COUNT(CASE WHEN is_overdue THEN 1 END) as overdue,
      COUNT(CASE WHEN needs_replacement THEN 1 END) as needing_replacement,
      AVG(age_months) as avg_age
    FROM goods_asset_lifecycle
  `);
  const [signals] = await sql(`SELECT COUNT(*) as count FROM goods_procurement_signals WHERE status = 'new'`);

  console.log('=== SUMMARY ===');
  console.log(`Assets tracked:       ${summary.total}`);
  console.log(`Overdue:              ${summary.overdue}`);
  console.log(`Needing replacement:  ${summary.needing_replacement}`);
  console.log(`Average age (months): ${Math.round(Number(summary.avg_age))}`);
  console.log(`Active signals:       ${signals.count}`);

  if (runId) await logComplete(supabase, runId, { items_found: itemsFound, items_new: itemsNew });
}

let runId;
(async () => {
  const run = await logStart(supabase, 'goods-lifecycle-sync', 'Goods Lifecycle Sync');
  runId = run?.id || null;
  await main();
})().catch(async (err) => {
  console.error('FATAL:', err);
  if (runId) try { await logFailed(supabase, runId, err); } catch {}
  process.exit(1);
});
