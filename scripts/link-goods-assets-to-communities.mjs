#!/usr/bin/env node
/**
 * One-off cleanup: link orphan goods_asset_lifecycle rows to goods_communities.
 *
 * State found 2026-05-14:
 *   404 total assets · 380 with community_id = NULL
 *   144 Tennant Creek (no community row) · 141 Palm Island (matches PALM ISLAND)
 *   68 Utopia Homelands (maps to AMPILATWATJA) · 24 Maningrida (linked)
 *   20 Kalgoorlie · 2 Mt Isa · 1 Alice Springs · 1 Darwin (regional towns, not in community register)
 *
 * Steps:
 *   1. Insert missing-but-needed communities (regional hubs) with priority='active'
 *   2. Backfill community_id on goods_asset_lifecycle via name mapping
 *   3. Recompute goods_communities.assets_deployed from actual joined counts
 *
 * Run: node --env-file=.env scripts/link-goods-assets-to-communities.mjs
 *      node --env-file=.env scripts/link-goods-assets-to-communities.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = process.argv.includes('--dry-run');

// Asset-register name → goods_communities canonical name.
// Maintained inline because it's small + transparent. Add mappings as new
// community names appear in the asset register.
const NAME_MAP = new Map([
  ['Tennant Creek', 'TENNANT CREEK'],
  ['Tennet Creek',  'TENNANT CREEK'],
  ['Palm Island',   'PALM ISLAND'],
  ['Utopia Homelands', 'AMPILATWATJA'],
  ['Maningrida',    'MANINGRIDA'],
  ['Kalgoorlie',    'KALGOORLIE'],
  ['Mount Isa',     'MOUNT ISA'],
  ['Mt Isa',        'MOUNT ISA'],
  ['Alice Springs', 'ALICE SPRINGS'],
  ['Darwin',        'DARWIN'],
  ['Alice Homelands', 'AMPILATWATJA'],
]);

// Regional hubs that need to exist in goods_communities for tracking.
// Most are larger towns not in the remote-community register.
const ENSURE_COMMUNITIES = [
  { name: 'TENNANT CREEK',  state: 'NT',  region: 'Barkly',          priority: 'lead',   postcode: '0860' },
  { name: 'KALGOORLIE',     state: 'WA',  region: 'Goldfields',      priority: 'active', postcode: '6430' },
  { name: 'MOUNT ISA',      state: 'QLD', region: 'North West',      priority: 'active', postcode: '4825' },
  { name: 'ALICE SPRINGS',  state: 'NT',  region: 'Central Australia', priority: 'active', postcode: '0870' },
  { name: 'DARWIN',         state: 'NT',  region: 'Top End',         priority: 'monitor', postcode: '0800' },
];

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL: ${error.message}`);
  return data || [];
}

async function main() {
  console.log(`=== Link Goods Assets to Communities ===${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // 1. Ensure regional hubs exist
  console.log('1. Ensuring regional hubs exist in goods_communities...');
  let hubsInserted = 0;
  for (const hub of ENSURE_COMMUNITIES) {
    const { data: existing } = await supabase
      .from('goods_communities')
      .select('id, community_name, priority')
      .eq('community_name', hub.name)
      .maybeSingle();
    if (existing) {
      console.log(`   exists: ${hub.name} (priority=${existing.priority})`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`   WOULD INSERT: ${hub.name} (${hub.state})`);
      hubsInserted++;
      continue;
    }
    const { error } = await supabase.from('goods_communities').insert({
      community_name: hub.name,
      state: hub.state,
      region_label: hub.region,
      priority: hub.priority,
      postcode: hub.postcode,
      demand_beds: 0,
      demand_washers: 0,
      assets_deployed: 0,
    });
    if (error) console.log(`   ERR insert ${hub.name}: ${error.message.slice(0, 100)}`);
    else { console.log(`   + inserted: ${hub.name} (${hub.state}, ${hub.priority})`); hubsInserted++; }
  }
  console.log(`   ${hubsInserted} regional hubs inserted\n`);

  // 2. Build lookup map of all goods_communities by canonical name.
  // PostgREST defaults max rows to 1000, so paginate explicitly.
  const communityIdByName = new Map();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data: page, error: ccErr } = await supabase
      .from('goods_communities')
      .select('id, community_name')
      .range(from, from + PAGE - 1);
    if (ccErr) throw new Error(`fetch communities: ${ccErr.message}`);
    if (!page || page.length === 0) break;
    for (const c of page) communityIdByName.set(c.community_name, c.id);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  console.log(`   ${communityIdByName.size} communities indexed`);

  // 3. Pull orphan asset rows + map them
  console.log('2. Linking orphan assets...');
  const { data: orphans, error: orErr } = await supabase
    .from('goods_asset_lifecycle')
    .select('id, community_name, community_id')
    .is('community_id', null)
    .limit(5000);
  if (orErr) throw new Error(`fetch orphans: ${orErr.message}`);
  console.log(`   ${orphans.length} orphan assets to link`);

  const updates = new Map(); // community_id → asset_ids[]
  const unmatched = new Map(); // raw name → count
  for (const row of orphans) {
    const canonical = NAME_MAP.get(row.community_name);
    const communityId = canonical ? communityIdByName.get(canonical) : null;
    if (!communityId) {
      unmatched.set(row.community_name || '(null)', (unmatched.get(row.community_name || '(null)') || 0) + 1);
      continue;
    }
    if (!updates.has(communityId)) updates.set(communityId, []);
    updates.get(communityId).push(row.id);
  }

  let linkedCount = 0;
  for (const [communityId, ids] of updates) {
    if (DRY_RUN) {
      console.log(`   WOULD LINK: ${ids.length} assets → ${communityId.slice(0, 8)}`);
      linkedCount += ids.length;
      continue;
    }
    // Update in chunks to avoid URL-length limits
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await supabase
        .from('goods_asset_lifecycle')
        .update({ community_id: communityId })
        .in('id', chunk);
      if (error) console.log(`   ERR link chunk: ${error.message.slice(0, 100)}`);
      else linkedCount += chunk.length;
    }
  }
  console.log(`   ${linkedCount} assets linked`);
  if (unmatched.size > 0) {
    console.log(`   ${[...unmatched.values()].reduce((a, b) => a + b, 0)} unmatched (add to NAME_MAP):`);
    for (const [name, count] of unmatched) console.log(`     "${name}" — ${count}`);
  }

  // 4. Recompute assets_deployed counters from lifecycle truth
  console.log('\n3. Recomputing goods_communities.assets_deployed...');
  if (DRY_RUN) {
    const { data: rows } = await supabase
      .from('goods_asset_lifecycle')
      .select('community_id')
      .not('community_id', 'is', null)
      .limit(5000);
    const counts = new Map();
    for (const r of rows || []) counts.set(r.community_id, (counts.get(r.community_id) || 0) + 1);
    console.log(`   WOULD UPDATE ${counts.size} communities`);
    for (const [cid, n] of [...counts].slice(0, 5)) console.log(`     ${cid.slice(0, 8)} → ${n}`);
  } else {
    // Single SQL: count + update via exec_sql isn't possible (SELECT-only). Use
    // a JS aggregation then UPDATE per community.
    const { data: rows } = await supabase
      .from('goods_asset_lifecycle')
      .select('community_id')
      .not('community_id', 'is', null)
      .limit(5000);
    const counts = new Map();
    for (const r of rows || []) counts.set(r.community_id, (counts.get(r.community_id) || 0) + 1);

    // Zero out all first so communities that had counts now showing 0 are correct
    await supabase.from('goods_communities').update({ assets_deployed: 0 }).gt('assets_deployed', 0);
    let updated = 0;
    for (const [cid, n] of counts) {
      const { error } = await supabase
        .from('goods_communities')
        .update({ assets_deployed: n })
        .eq('id', cid);
      if (error) console.log(`   ERR update ${cid.slice(0, 8)}: ${error.message.slice(0, 80)}`);
      else updated++;
    }
    console.log(`   ${updated} communities updated`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Hubs inserted:   ${hubsInserted}`);
  console.log(`Assets linked:   ${linkedCount}`);
  console.log(`Unmatched:       ${[...unmatched.values()].reduce((a, b) => a + b, 0)}`);
}

let runId;
(async () => {
  const run = !DRY_RUN ? await logStart(supabase, 'link-goods-assets-to-communities', 'Link Goods Assets to Communities') : { id: null };
  runId = run?.id || null;
  await main();
  if (runId) await logComplete(supabase, runId, { items_found: 404, items_updated: 1 });
})().catch(async (err) => {
  console.error('FATAL:', err);
  if (runId) try { await logFailed(supabase, runId, err); } catch {}
  process.exit(1);
});
