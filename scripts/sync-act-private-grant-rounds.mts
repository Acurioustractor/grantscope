#!/usr/bin/env -S npx tsx
/**
 * sync-act-private-grant-rounds — SmartyGrants rounds into act_private_grant_rounds, for ACT only.
 *
 * Writes ONLY to act_private_grant_rounds (RLS on, no policies, service role only). Never to
 * grant_opportunities, which is public. Ben chose on 2026-09-14 to run this for ACT's own
 * grant-seeking despite Our Community's Terms of Use cl 2(i) (no bots or scraping); see migration
 * 20260914180000. Stop it by disabling that schedule if Our Community says no.
 *
 * Each run: upsert every live round by url; close rounds that vanished from their portal or whose
 * close date has passed.
 *
 *   npx tsx --env-file=.env scripts/sync-act-private-grant-rounds.mts --dry-run
 *   npx tsx --env-file=.env scripts/sync-act-private-grant-rounds.mts
 */
import { createClient } from '@supabase/supabase-js';
import { createSmartyGrantsPlugin } from '../packages/grant-engine/src/sources/smartygrants.ts';
import { placeFromGeography } from '../packages/grant-engine/src/storage/repository.ts';
import { scoreGrantForGoods, applyGoodsTag } from './lib/goods-relevance.mjs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const TABLE = 'act_private_grant_rounds';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const run = DRY_RUN ? { id: null } : await logStart(sb, 'sync-act-private-grant-rounds', 'ACT private grant rounds (SmartyGrants)');
try {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  for await (const g of createSmartyGrantsPlugin().discover({})) {
    if (!g.sourceUrl || seen.has(g.sourceUrl)) continue;
    seen.add(g.sourceUrl);
    const { geography, place } = placeFromGeography(g.geography);
    const base = {
      name: g.title, provider: g.provider, description: g.description ?? null,
      amount_min: g.amount?.min ?? null, amount_max: g.amount?.max ?? null,
      closes_at: g.deadline ?? null, url: g.sourceUrl, geography, categories: g.categories ?? [],
    };
    const { score, signals } = scoreGrantForGoods(base);
    const tag = applyGoodsTag({ aligned_projects: [] }, score, signals, now);
    rows.push({
      ...base,
      status: g.applicationStatus === 'upcoming' ? 'upcoming' : 'open',
      application_status: g.applicationStatus ?? 'unknown',
      metadata: place ? { place, last_seen_at: now } : { last_seen_at: now },
      aligned_projects: tag.tagged, goods_relevance_score: score, goods_relevance_signals: tag.signals,
      source: 'smartygrants', discovery_method: 'smartygrants', updated_at: now,
    });
  }

  const { data: existing, error: readErr } = await sb.from(TABLE).select('id, url, status, closes_at');
  if (readErr) throw readErr;
  const toClose = (existing ?? []).filter(r =>
    r.status !== 'closed' && (!seen.has(r.url) || (r.closes_at && r.closes_at < today)));

  console.log(`[act-private-grants] live rounds ${rows.length} · held ${existing?.length ?? 0} · closing ${toClose.length}${DRY_RUN ? ' (dry run)' : ''}`);

  if (!DRY_RUN) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from(TABLE).upsert(rows.slice(i, i + 200), { onConflict: 'url' });
      if (error) throw error;
    }
    for (let i = 0; i < toClose.length; i += 200) {
      const { error } = await sb.from(TABLE).update({ status: 'closed', updated_at: now })
        .in('id', toClose.slice(i, i + 200).map(r => r.id));
      if (error) throw error;
    }
    const heldIds = new Set((existing ?? []).map(r => r.url));
    await logComplete(sb, run.id, {
      items_found: rows.length,
      items_new: rows.filter(r => !heldIds.has(r.url as string)).length,
      items_updated: toClose.length,
    });
  }
} catch (err) {
  if (run.id) await logFailed(sb, run.id, err);
  throw err;
}
