import { getServiceSupabase } from '@/lib/supabase';
import {
  warmthBand, nextBestAction, STAGE_PROBABILITY,
  type GoodsRelationship, type GoodsStage, type WarmthBand,
} from './goods-engagement-shared';

/**
 * Goods Command Center — Buyer / Procurement Pipeline: SERVER data access.
 * The buyer cohort is deliberately excluded from Funder Insight (which decodes
 * the funder/investor/finance GHL signal) and from the Money page's money-IN
 * rollups (QBE rule: procurement revenue is a SEPARATE track, never mixed into
 * grant/investment totals). This surface gives buyers their own first-class view:
 * who they are, warmth/stage, $ received, open ask, GHL stage if linked, and the
 * next-best-action — plus a procurement-track summary header.
 *
 * Reads goods_relationships where relationship_type='buyer' via the LIVE service
 * client. Follows the error-honesty pattern: { rows: [], fetchError } on failure
 * so the page renders an honest "live data unavailable" strip, never silent [].
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

/** Stages that mean an open, live procurement conversation (not committed/declined/dormant). */
const OPEN_ASK_STAGES: Set<GoodsStage> = new Set([
  'identified', 'researching', 'contacted', 'in_conversation', 'proposal',
]);

/** A single buyer relationship enriched for the procurement pipeline view. */
export type BuyerPipelineRow = {
  id: string;
  name: string;
  stage: GoodsStage;
  /** Linked GHL opportunity id, if this buyer is wired to GoHighLevel. */
  ghlOpportunityId: string | null;
  /** Linked GHL contact id — the reliable deep-link target. */
  ghlContactId: string | null;
  warmth: number;
  band: WarmthBand;
  lastTouchAt: string | null;
  totalReceived: number;
  askAmount: number | null;
  /** True when the buyer sits in an open (live) procurement stage. */
  isOpen: boolean;
  nextMove: string;
  nextActionDue: string | null;
  notes: string | null;
};

/** Procurement-track summary header — count, $ received, $ open asks. */
export type BuyerPipelineSummary = {
  /** Total buyer relationships. */
  total: number;
  /** Buyers in an open procurement stage. */
  open: number;
  /** Lifetime procurement revenue received (sum of total_received_aud). */
  totalReceived: number;
  /** Sum of ask_amount_aud across open buyers. */
  openAskTotal: number;
  /** Stage-weighted expected procurement dollars across open buyers. */
  weightedPipeline: number;
  /** Buyers wired to a GHL opportunity. */
  withGhl: number;
};

export type GoodsBuyerPipeline = {
  rows: BuyerPipelineRow[];
  summary: BuyerPipelineSummary;
  fetchError: string | null;
};

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Read with select('*') so the not-yet-migrated ask_amount_aud / ask_purpose
// columns flow through when the migration lands without breaking now — mirrors
// goods-engagement.ts. Never name those columns explicitly.
function coerceRow(raw: Record<string, unknown>): GoodsRelationship {
  return {
    ...(raw as unknown as GoodsRelationship),
    ask_amount_aud: (raw.ask_amount_aud as number | null | undefined) ?? null,
    ask_purpose: (raw.ask_purpose as string | null | undefined) ?? null,
  };
}

function toPipelineRow(r: GoodsRelationship): BuyerPipelineRow {
  const warmth = num(r.warmth_display);
  const ask = r.ask_amount_aud == null ? null : num(r.ask_amount_aud);
  const isOpen = OPEN_ASK_STAGES.has(r.stage);
  return {
    id: r.id,
    name: r.display_name,
    stage: r.stage,
    ghlOpportunityId: r.ghl_opportunity_id ?? null,
    ghlContactId: r.ghl_contact_id ?? null,
    warmth,
    band: warmthBand(warmth),
    lastTouchAt: r.last_touch_at,
    totalReceived: num(r.total_received_aud),
    askAmount: ask,
    isOpen,
    nextMove: nextBestAction(r),
    nextActionDue: r.next_action_due ?? null,
    notes: r.notes ?? null,
  };
}

function summarise(rows: BuyerPipelineRow[]): BuyerPipelineSummary {
  let open = 0;
  let totalReceived = 0;
  let openAskTotal = 0;
  let weightedPipeline = 0;
  let withGhl = 0;

  for (const r of rows) {
    totalReceived += r.totalReceived;
    if (r.ghlOpportunityId) withGhl += 1;
    if (r.isOpen) {
      open += 1;
      const ask = r.askAmount ?? 0;
      if (ask > 0) {
        openAskTotal += ask;
        weightedPipeline += ask * (STAGE_PROBABILITY[r.stage] ?? 0);
      }
    }
  }

  return {
    total: rows.length,
    open,
    totalReceived,
    openAskTotal,
    weightedPipeline,
    withGhl,
  };
}

const emptySummary: BuyerPipelineSummary = {
  total: 0, open: 0, totalReceived: 0, openAskTotal: 0, weightedPipeline: 0, withGhl: 0,
};

/**
 * Load the Goods buyer / procurement pipeline, warmest first.
 * Honest failure: returns { rows: [], summary: empty, fetchError } so the page
 * renders a "live data unavailable" strip instead of fabricated zeros.
 */
export async function getGoodsBuyerPipeline(): Promise<GoodsBuyerPipeline> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('goods_relationships')
      .select('*')
      .eq('relationship_type', 'buyer')
      .order('warmth_display', { ascending: false })
      .order('total_received_aud', { ascending: false });

    if (error) {
      console.error('[goods-buyer-pipeline] query failed:', error.message);
      return { rows: [], summary: emptySummary, fetchError: error.message };
    }

    const rows = ((data ?? []) as Record<string, unknown>[]).map(coerceRow).map(toPipelineRow);
    return { rows, summary: summarise(rows), fetchError: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected buyer-pipeline load error.';
    console.error('[goods-buyer-pipeline] unexpected:', e);
    return { rows: [], summary: emptySummary, fetchError: msg };
  }
}
