import { getServiceSupabase } from '@/lib/supabase';
import { isInternalActIdentity } from '@/lib/act-internal-identities';
import {
  warmthBand,
  REL_TRACK, STAGE_PROBABILITY,
  type GoodsRelationship, type GoodsRelType, type GoodsStage, type WarmthBand,
  type FundingTrack,
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

/** Per-funding-track dollar rollup — grants and investment never get lumped. */
export type TrackRollup = {
  track: FundingTrack;
  /** Sum of total_received_aud (lifetime money in) for this track. */
  lifetimeReceived: number;
  /** Sum of ask_amount_aud across still-open asks. */
  openAskTotal: number;
  /** Sum of ask_amount_aud * STAGE_PROBABILITY[stage] — expected pipeline. */
  weightedPipeline: number;
  count: number;
};

export interface EngagementSummary {
  total: number;
  byType: { type: GoodsRelType; label: string; count: number; avgWarmth: number }[];
  byBand: Record<WarmthBand, number>;
  totalReceived: number;
  activeAsks: number;
  needsReWarm: number;
  /** Per-track dollar rollup (grant / investment / procurement / support). */
  byTrack: Record<FundingTrack, TrackRollup>;
  /** Total open-ask dollars and stage-weighted expected dollars across all tracks. */
  openAskTotal: number;
  weightedPipeline: number;
}

// Read everything with select('*') so the not-yet-migrated ask_amount_aud /
// ask_purpose columns come back when the migration lands, without breaking now.
// Never name the new columns explicitly (migration is written, not applied).

/** Stages that count as an open, live ask for pipeline dollars. */
const OPEN_ASK_STAGES: Set<GoodsStage> = new Set([
  'identified', 'researching', 'contacted', 'in_conversation', 'proposal',
]);

function coerceRow(raw: Record<string, unknown>): GoodsRelationship {
  return {
    ...(raw as unknown as GoodsRelationship),
    // Columns may be absent until the migration applies — coerce to null.
    ask_amount_aud: (raw.ask_amount_aud as number | null | undefined) ?? null,
    ask_purpose: (raw.ask_purpose as string | null | undefined) ?? null,
  };
}

/**
 * Load the full Goods relationship registry, warmest first.
 * On error returns { rows: [], fetchError } so pages can render an honest
 * "live data unavailable" strip instead of fake zeros.
 */
export async function getGoodsRelationshipsSafe(opts?: {
  type?: GoodsRelType;
}): Promise<{ rows: GoodsRelationship[]; fetchError: string | null }> {
  try {
    const supabase = getServiceSupabase();
    let q = supabase
      .from('goods_relationships')
      .select('*')
      .order('warmth_display', { ascending: false })
      .order('total_received_aud', { ascending: false });
    if (opts?.type) q = q.eq('relationship_type', opts.type);
    const { data, error } = await q;
    if (error) {
      console.error('[goods-engagement] query failed:', error.message);
      return { rows: [], fetchError: error.message };
    }
    return {
      rows: ((data ?? []) as Record<string, unknown>[])
        .map(coerceRow)
        .filter((row) => !isInternalActIdentity({ name: row.display_name })),
      fetchError: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected registry load error.';
    console.error('[goods-engagement] unexpected:', e);
    return { rows: [], fetchError: msg };
  }
}

/** Backward-compatible loader: rows only, [] on error. Prefer the Safe variant. */
export async function getGoodsRelationships(opts?: {
  type?: GoodsRelType;
}): Promise<GoodsRelationship[]> {
  return (await getGoodsRelationshipsSafe(opts)).rows;
}

const ADVANCING: GoodsStage[] = ['contacted', 'in_conversation', 'proposal'];

function emptyTrack(track: FundingTrack): TrackRollup {
  return { track, lifetimeReceived: 0, openAskTotal: 0, weightedPipeline: 0, count: 0 };
}

const TRACK_LABELS: Record<GoodsRelType, string> = {
  funder: 'Funder',
  impact_investor: 'Impact Investor',
  repayable_finance: 'Repayable Finance',
  production_partner: 'Production Partner',
  buyer: 'Buyer',
  supporter: 'Supporter',
  advocate: 'Advocate',
};

/**
 * Pure rollup over an already-loaded set (no extra DB round-trip).
 * Deterministic: a single `now` is captured up-front so re-warm + any
 * time-sensitive logic is stable across the whole pass.
 */
export function summarize(rows: GoodsRelationship[]): EngagementSummary {
  const byTypeMap = new Map<GoodsRelType, { sum: number; count: number; label: string }>();
  const byBand: Record<WarmthBand, number> = { Champion: 0, Hot: 0, Warm: 0, Cool: 0, Cold: 0 };
  const byTrack: Record<FundingTrack, TrackRollup> = {
    grant: emptyTrack('grant'),
    investment: emptyTrack('investment'),
    procurement: emptyTrack('procurement'),
    support: emptyTrack('support'),
  };
  let totalReceived = 0;
  let activeAsks = 0;
  let needsReWarm = 0;
  let openAskTotal = 0;
  let weightedPipeline = 0;
  const now = Date.now();

  for (const r of rows) {
    const t = byTypeMap.get(r.relationship_type)
      ?? { sum: 0, count: 0, label: TRACK_LABELS[r.relationship_type] ?? r.relationship_type };
    t.sum += r.warmth_display;
    t.count += 1;
    byTypeMap.set(r.relationship_type, t);

    byBand[warmthBand(r.warmth_display)] += 1;
    const received = Number(r.total_received_aud) || 0;
    totalReceived += received;
    if (ADVANCING.includes(r.stage)) activeAsks += 1;

    const days = r.last_touch_at ? (now - new Date(r.last_touch_at).getTime()) / 86_400_000 : Infinity;
    if (r.warmth_display >= 25 && days > 60) needsReWarm += 1;

    // ---- per-track dollar rollup ----
    const track = REL_TRACK[r.relationship_type];
    const bucket = byTrack[track];
    bucket.count += 1;
    bucket.lifetimeReceived += received;
    const ask = Number(r.ask_amount_aud) || 0;
    if (ask > 0 && OPEN_ASK_STAGES.has(r.stage)) {
      bucket.openAskTotal += ask;
      const expected = ask * (STAGE_PROBABILITY[r.stage] ?? 0);
      bucket.weightedPipeline += expected;
      openAskTotal += ask;
      weightedPipeline += expected;
    }
  }

  const byType = [...byTypeMap.entries()]
    .map(([type, v]) => ({ type, label: v.label, count: v.count, avgWarmth: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.count - a.count);

  return {
    total: rows.length, byType, byBand, totalReceived, activeAsks, needsReWarm,
    byTrack, openAskTotal, weightedPipeline,
  };
}
