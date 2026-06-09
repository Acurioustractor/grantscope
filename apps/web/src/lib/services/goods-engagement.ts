import { getServiceSupabase } from '@/lib/supabase';
import {
  warmthBand,
  type GoodsRelationship, type GoodsRelType, type GoodsStage, type WarmthBand,
} from '@/lib/services/goods-engagement-shared';

/**
 * Goods Command Center — Engagement & Warmth Map: SERVER data access.
 * Pure helpers/types live in goods-engagement-shared.ts (client-safe).
 * Reads the unified `goods_relationships` registry (seeded by
 * scripts/seed-goods-relationships.sql). Uses the LIVE service client.
 *
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

// re-export shared so existing server-side importers keep one import site
export * from '@/lib/services/goods-engagement-shared';

export interface EngagementSummary {
  total: number;
  byType: { type: GoodsRelType; label: string; count: number; avgWarmth: number }[];
  byBand: Record<WarmthBand, number>;
  totalReceived: number;
  activeAsks: number;
  needsReWarm: number;
}

const SELECT_COLS =
  'id, relationship_type, display_name, entity_id, ghl_opportunity_id, stage, target_stage, ' +
  'warmth_computed, warmth_override, warmth_display, last_touch_at, total_received_aud, ' +
  'alignment_score, has_prior_support, next_action, next_action_due, warm_intro_path, notes';

/** Load the full Goods relationship registry, warmest first. Returns [] on error. */
export async function getGoodsRelationships(opts?: {
  type?: GoodsRelType;
}): Promise<GoodsRelationship[]> {
  try {
    const supabase = getServiceSupabase();
    let q = supabase
      .from('goods_relationships')
      .select(SELECT_COLS)
      .order('warmth_display', { ascending: false })
      .order('total_received_aud', { ascending: false });
    if (opts?.type) q = q.eq('relationship_type', opts.type);
    const { data, error } = await q;
    if (error) {
      console.error('[goods-engagement] query failed:', error.message);
      return [];
    }
    return (data ?? []) as unknown as GoodsRelationship[];
  } catch (e) {
    console.error('[goods-engagement] unexpected:', e);
    return [];
  }
}

const ADVANCING: GoodsStage[] = ['contacted', 'in_conversation', 'proposal'];

/** Pure rollup over an already-loaded set (no extra DB round-trip). */
export function summarize(rows: GoodsRelationship[]): EngagementSummary {
  const byTypeMap = new Map<GoodsRelType, { sum: number; count: number; label: string }>();
  const byBand: Record<WarmthBand, number> = { Champion: 0, Hot: 0, Warm: 0, Cool: 0, Cold: 0 };
  let totalReceived = 0;
  let activeAsks = 0;
  let needsReWarm = 0;
  const now = Date.now();

  for (const r of rows) {
    const t = byTypeMap.get(r.relationship_type) ?? { sum: 0, count: 0, label: r.relationship_type };
    t.sum += r.warmth_display;
    t.count += 1;
    byTypeMap.set(r.relationship_type, t);

    byBand[warmthBand(r.warmth_display)] += 1;
    totalReceived += Number(r.total_received_aud) || 0;
    if (ADVANCING.includes(r.stage)) activeAsks += 1;

    const days = r.last_touch_at ? (now - new Date(r.last_touch_at).getTime()) / 86_400_000 : Infinity;
    if (r.warmth_display >= 25 && days > 60) needsReWarm += 1;
  }

  const byType = [...byTypeMap.entries()]
    .map(([type, v]) => ({ type, label: type, count: v.count, avgWarmth: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.count - a.count);

  return { total: rows.length, byType, byBand, totalReceived, activeAsks, needsReWarm };
}
