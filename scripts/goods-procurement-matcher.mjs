#!/usr/bin/env node
/**
 * goods-procurement-matcher.mjs
 *
 * For each goods_procurement_signal:
 *   1. Find local buyer entity (best fit by govt contract value)
 *   2. Generate demand_unmet signals for priority communities with no assets
 *   3. Match top-3 open grants per (signal × community), scored by:
 *        - goods_relevance_score (the work backfilled into grant_opportunities)
 *        - geography overlap with community.state
 *        - amount band vs signal.estimated_value
 *   4. Match top-3 foundations per (signal × community), scored by:
 *        - thematic_focus overlap with goods themes
 *        - geographic_focus overlap with community.state
 *        - total_giving_annual (size proxy)
 *   5. Set funding_confidence based on top match score:
 *        >= 80 → 'strong', >= 60 → 'moderate', else 'possible'
 *
 * Run: node --env-file=.env scripts/goods-procurement-matcher.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const GOODS_FOUNDATION_THEMES = new Set([
  'indigenous', 'aboriginal', 'first_nations', 'first nations',
  'housing', 'homelessness',
  'community', 'community_development', 'community development',
  'rural_remote', 'rural remote', 'remote', 'regional',
  'social_enterprise', 'social enterprise',
  'closing_the_gap', 'closing the gap',
]);

// "National" markers that mean a foundation/grant funds anywhere in Australia.
const NATIONAL_MARKERS = new Set(['AU-National', 'AU', 'national', 'Australia']);

function geographyMatchesCommunity(grantGeography, communityState) {
  if (!grantGeography) return { fit: 'unknown', score: 4 };
  if (NATIONAL_MARKERS.has(grantGeography)) return { fit: 'national', score: 12 };
  if (communityState && grantGeography === `AU-${communityState}`) return { fit: 'state-exact', score: 20 };
  return { fit: 'mismatch', score: 0 };
}

function amountFitsSignal(grant, signal) {
  const need = Number(signal.estimated_value) || 0;
  const max = Number(grant.amount_max) || 0;
  if (max === 0) return { fit: 'unknown', score: 4 };
  if (need === 0) return { fit: 'no-signal-value', score: max >= 50_000 ? 8 : 4 };
  if (max >= need * 2) return { fit: 'comfortable', score: 15 };
  if (max >= need) return { fit: 'fits', score: 10 };
  if (max >= need * 0.5) return { fit: 'partial', score: 5 };
  return { fit: 'too-small', score: 0 };
}

function foundationGeoMatch(foundation, communityState) {
  const focus = Array.isArray(foundation.geographic_focus) ? foundation.geographic_focus : [];
  if (focus.length === 0) return { fit: 'unknown', score: 3 };
  if (focus.some(f => NATIONAL_MARKERS.has(f))) return { fit: 'national', score: 10 };
  if (communityState && focus.includes(`AU-${communityState}`)) return { fit: 'state-exact', score: 18 };
  return { fit: 'mismatch', score: 0 };
}

function foundationThemeScore(foundation) {
  const themes = Array.isArray(foundation.thematic_focus) ? foundation.thematic_focus : [];
  let hits = 0;
  for (const t of themes) if (GOODS_FOUNDATION_THEMES.has(String(t).toLowerCase())) hits++;
  if (hits === 0) return { score: 0, hits };
  if (hits >= 3) return { score: 25, hits };
  if (hits === 2) return { score: 18, hits };
  return { score: 10, hits };
}

// Schema allows: 'confirmed' | 'likely' | 'possible' | 'none'
function pickConfidence(topScore) {
  if (topScore >= 80) return 'likely';
  if (topScore >= 40) return 'possible';
  return 'none';
}

async function loadGoodsGrantPool() {
  // Threshold 30, not 50 — catches mid-tier NT/QLD-specific grants that miss
  // the high keyword-density threshold but are clean state fits.
  const { data, error } = await supabase
    .from('grant_opportunities')
    .select('id, name, provider, amount_max, geography, closes_at, goods_relevance_score')
    .gte('goods_relevance_score', 30)
    .eq('status', 'open')
    .order('goods_relevance_score', { ascending: false })
    .limit(2000);
  if (error) throw new Error(`grant pool: ${error.message}`);
  // Drop closed
  const now = Date.now();
  return (data || []).filter(g => !g.closes_at || new Date(g.closes_at).getTime() > now);
}

async function loadFoundationPool() {
  const { data, error } = await supabase
    .from('foundations')
    .select('id, name, thematic_focus, geographic_focus, total_giving_annual')
    .not('thematic_focus', 'is', null);
  if (error) throw new Error(`foundation pool: ${error.message}`);
  // Filter to goods-themed in JS so we don't ILIKE on the array column
  return (data || []).filter(f => {
    const themes = Array.isArray(f.thematic_focus) ? f.thematic_focus : [];
    return themes.some(t => GOODS_FOUNDATION_THEMES.has(String(t).toLowerCase()));
  });
}

async function loadCommunities(ids) {
  if (ids.length === 0) return new Map();
  const out = new Map();
  const CHUNK = 80;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('goods_communities')
      .select('id, community_name, state, postcode, priority, demand_beds, demand_washers')
      .in('id', slice);
    if (error) throw new Error(`communities: ${error.message}`);
    for (const c of data || []) out.set(c.id, c);
  }
  return out;
}

function matchGrantsForSignal(signal, community, grantPool) {
  const ranked = grantPool.map(g => {
    const geo = geographyMatchesCommunity(g.geography, community?.state);
    const amount = amountFitsSignal(g, signal);
    const relevance = Math.min(50, Math.round((g.goods_relevance_score || 0) * 0.5));
    const match_score = geo.score + amount.score + relevance;
    return { grant: g, match_score, geo: geo.fit, amount: amount.fit };
  });
  // STRICT geo filter: no padding with mismatched-state grants. Better to show
  // 1 real fit than 3 grants where 2 are noise. A grant gets through only if it's
  // state-exact for this community, AU-National, or has unknown geography.
  ranked.sort((a, b) => b.match_score - a.match_score);
  return ranked.filter(r => r.geo !== 'mismatch').slice(0, 3);
}

function matchFoundationsForSignal(community, foundationPool) {
  const ranked = foundationPool.map(f => {
    const theme = foundationThemeScore(f);
    const geo = foundationGeoMatch(f, community?.state);
    const size = Number(f.total_giving_annual) || 0;
    const sizeBonus = size >= 50_000_000 ? 12 : size >= 5_000_000 ? 8 : size >= 500_000 ? 4 : 0;
    const match_score = theme.score + geo.score + sizeBonus;
    return { foundation: f, match_score, theme_hits: theme.hits, geo: geo.fit };
  });
  ranked.sort((a, b) => b.match_score - a.match_score);
  return ranked.filter(r => r.geo !== 'mismatch' || r.match_score > 25).slice(0, 3);
}

async function main() {
  const startedAt = Date.now();
  let itemsFound = 0;
  let itemsMatched = 0;
  let itemsNewSignals = 0;
  let foundationsMatched = 0;
  let strongFitCount = 0;

  console.log('=== Goods Procurement Matcher (v2: score-aware) ===\n');

  console.log('Loading goods-relevant pools...');
  const [grantPool, foundationPool] = await Promise.all([
    loadGoodsGrantPool(),
    loadFoundationPool(),
  ]);
  console.log(`  Grant pool: ${grantPool.length} open grants with goods_relevance_score >= 50`);
  console.log(`  Foundation pool: ${foundationPool.length} goods-themed foundations\n`);

  // 1. Fetch signals needing matching: unmatched, or matched stale enough to rescore
  const RESCORE_ALL = process.argv.includes('--rescore-all');
  let query = supabase
    .from('goods_procurement_signals')
    .select('id, community_id, signal_type, title, products_needed, estimated_value, priority, status, matched_grant_ids')
    .in('status', ['new', 'reviewing'])
    .order('created_at', { ascending: false })
    .limit(1500);
  const { data: rawSignals, error: sigErr } = await query;
  const signals = RESCORE_ALL ? (rawSignals || []) : (rawSignals || []).filter(s => !s.matched_grant_ids || s.matched_grant_ids.length === 0);
  if (sigErr) throw new Error(`signals: ${sigErr.message}`);
  itemsFound = signals.length;
  console.log(`1. ${signals.length} signals to process\n`);

  // 2. Pre-load communities
  const communityIds = [...new Set(signals.filter(s => s.community_id).map(s => s.community_id))];
  const communities = await loadCommunities(communityIds);
  console.log(`   Loaded ${communities.size} communities referenced by signals`);

  // 3. Assign buyer + match grants + foundations per signal
  console.log('\n2. Matching paths per signal...');
  for (const sig of signals) {
    if (!sig.community_id) continue;
    const community = communities.get(sig.community_id);

    // Buyer match
    let buyerId = null;
    let buyerNote = '';
    const { data: buyers } = await supabase
      .from('goods_procurement_entities')
      .select('id, entity_name, buyer_role, govt_contract_value')
      .eq('community_id', sig.community_id)
      .order('govt_contract_value', { ascending: false, nullsLast: true })
      .limit(10);
    if (buyers && buyers.length > 0) {
      buyerId = buyers[0].id;
      buyerNote = `Best buyer match: ${buyers[0].entity_name} (${buyers[0].buyer_role})` +
        (buyers.length > 1 ? ` · ${buyers.length - 1} more in area.` : '');
    }

    // Grant matches
    const grantMatches = matchGrantsForSignal(sig, community, grantPool);
    const foundationMatches = matchFoundationsForSignal(community, foundationPool);

    const topScore = grantMatches[0]?.match_score || 0;
    const confidence = pickConfidence(topScore);
    if (confidence === 'likely') strongFitCount++;
    if (foundationMatches.length > 0) foundationsMatched++;

    const matched_grant_ids = grantMatches.map(g => g.grant.id);
    const matched_foundation_ids = foundationMatches.map(f => f.foundation.id);

    const update = {
      matched_grant_ids,
      matched_foundation_ids,
      funding_confidence: confidence,
    };
    if (buyerId) update.buyer_entity_id = buyerId;
    if (buyerNote) update.description = (sig.title || '') + '\n\n' + buyerNote;

    const { error } = await supabase
      .from('goods_procurement_signals')
      .update(update)
      .eq('id', sig.id);
    if (error) {
      console.log(`   ERR ${sig.id}: ${error.message.slice(0, 80)}`);
    } else {
      itemsMatched++;
    }
  }
  console.log(`   Matched ${itemsMatched} signals · strong-fit ${strongFitCount} · with foundations ${foundationsMatched}\n`);

  // 4. Generate demand_unmet signals
  console.log('3. Generating demand_unmet for unserved priority communities...');
  const { data: candidates } = await supabase
    .from('goods_communities')
    .select('id, community_name, state, demand_beds, demand_washers, assets_deployed, buyer_entity_count, priority')
    .in('priority', ['lead', 'active', 'warm', 'monitor'])
    .or('demand_beds.gt.0,demand_washers.gt.0')
    .eq('assets_deployed', 0)
    .limit(50);
  const existingDemandSignals = new Set(
    (await supabase.from('goods_procurement_signals').select('community_id').eq('signal_type', 'demand_unmet').in('status', ['new', 'reviewing'])).data?.map(s => s.community_id) || []
  );
  const unmet = (candidates || []).filter(c => !existingDemandSignals.has(c.id));
  if (unmet.length > 0) {
    const newSignals = unmet.map(c => ({
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
    if (error) console.log(`   Insert error: ${error.message.slice(0, 100)}`);
    else { itemsNewSignals = newSignals.length; console.log(`   Generated ${newSignals.length} demand_unmet signals\n`); }
  } else {
    console.log('   No new demand signals needed\n');
  }

  // 5. Summary
  const { data: tally } = await supabase
    .from('goods_procurement_signals')
    .select('funding_confidence, status, signal_type');
  const summary = {
    total: tally?.length || 0,
    with_grants: 0, with_foundations: 0, likely: 0, possible: 0,
  };
  // Re-fetch with array fields to count match coverage
  const { data: full } = await supabase
    .from('goods_procurement_signals')
    .select('matched_grant_ids, matched_foundation_ids, funding_confidence');
  for (const s of full || []) {
    if ((s.matched_grant_ids || []).length > 0) summary.with_grants++;
    if ((s.matched_foundation_ids || []).length > 0) summary.with_foundations++;
    if (s.funding_confidence === 'likely') summary.likely++;
    if (s.funding_confidence === 'possible') summary.possible++;
  }

  console.log('=== SUMMARY ===');
  console.log(`Total signals:                  ${summary.total}`);
  console.log(`  with matched grants:          ${summary.with_grants}`);
  console.log(`  with matched foundations:     ${summary.with_foundations}`);
  console.log(`  confidence: likely            ${summary.likely}`);
  console.log(`  confidence: possible          ${summary.possible}`);
  console.log(`This run: matched ${itemsMatched} · likely-fit ${strongFitCount} · new demand signals ${itemsNewSignals}`);
  console.log(`Elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  if (runId) await logComplete(supabase, runId, {
    items_found: itemsFound,
    items_new: itemsNewSignals,
    items_updated: itemsMatched,
  });
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
