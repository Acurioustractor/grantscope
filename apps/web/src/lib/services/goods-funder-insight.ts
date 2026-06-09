import { getServiceSupabase } from '@/lib/supabase';
import type { GoodsRelType, GoodsStage } from './goods-engagement-shared';
import {
  decodeFunderInsight, rankInsights, summariseInsights,
  type FunderInsight, type FunderInsightSummary, type GhlSignal,
} from './goods-funder-insight-shared';

/**
 * Goods Command Center — Funder Insight.
 * Reads the funder cohort from goods_relationships (incl. the structured GHL
 * signal captured into ghl_signal by sync-goods-ghl.mjs), decodes each into a
 * temperature / interests / attention-flags / next-move via the pure decoder,
 * and ranks act-now first. No LLM, no Gmail — structured signal only.
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

// The "who funds / lends to us" cohort. Buyers get their own surface.
const FUNDER_TYPES: GoodsRelType[] = ['funder', 'impact_investor', 'repayable_finance'];

type Row = {
  id: string;
  display_name: string;
  relationship_type: GoodsRelType;
  stage: GoodsStage;
  warmth_display: number | string | null;
  last_touch_at: string | null;
  total_received_aud: number | string | null;
  has_prior_support: boolean | null;
  ghl_signal: GhlSignal | null;
};

const num = (v: number | string | null): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getGoodsFunderInsight(): Promise<{
  insights: FunderInsight[];
  summary: FunderInsightSummary;
}> {
  const empty = {
    insights: [] as FunderInsight[],
    summary: { total: 0, actNow: 0, hot: 0, cooling: 0, vip: 0, withSignal: 0 },
  };
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('goods_relationships')
      .select('id, display_name, relationship_type, stage, warmth_display, last_touch_at, total_received_aud, has_prior_support, ghl_signal')
      .in('relationship_type', FUNDER_TYPES);

    if (error) {
      console.error('[goods-funder-insight] query failed:', error.message);
      return empty;
    }

    const insights = ((data as Row[] | null) ?? [])
      .map((r) =>
        decodeFunderInsight({
          id: r.id,
          name: r.display_name,
          relationshipType: r.relationship_type,
          stage: r.stage,
          warmthDisplay: num(r.warmth_display),
          lastTouchAt: r.last_touch_at,
          totalReceived: num(r.total_received_aud),
          hasPrior: !!r.has_prior_support,
          signal: r.ghl_signal ?? {},
        }),
      )
      .sort(rankInsights);

    return { insights, summary: summariseInsights(insights) };
  } catch (e) {
    console.error('[goods-funder-insight] unexpected:', e);
    return empty;
  }
}
