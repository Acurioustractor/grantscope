/**
 * Goods Engagement — PURE shared helpers + types. No server-only imports, so this
 * module is safe to import from client components AND server code.
 * Data-fetching lives in goods-engagement.ts (server only).
 */

export type GoodsRelType =
  | 'funder' | 'impact_investor' | 'repayable_finance'
  | 'production_partner' | 'buyer' | 'supporter' | 'advocate';

export type GoodsStage =
  | 'identified' | 'researching' | 'contacted' | 'in_conversation'
  | 'proposal' | 'committed' | 'repeat' | 'dormant' | 'declined';

export interface GoodsRelationship {
  id: string;
  relationship_type: GoodsRelType;
  display_name: string;
  entity_id: string | null;
  ghl_opportunity_id: string | null;
  stage: GoodsStage;
  target_stage: string | null;
  warmth_computed: number;
  warmth_override: number | null;
  warmth_display: number;
  last_touch_at: string | null;
  total_received_aud: number;
  alignment_score: number | null;
  has_prior_support: boolean;
  next_action: string | null;
  next_action_due: string | null;
  warm_intro_path: string | null;
  notes: string | null;
}

export type WarmthBand = 'Champion' | 'Hot' | 'Warm' | 'Cool' | 'Cold';
export const BANDS: WarmthBand[] = ['Champion', 'Hot', 'Warm', 'Cool', 'Cold'];

export function warmthBand(score: number): WarmthBand {
  if (score >= 90) return 'Champion';
  if (score >= 70) return 'Hot';
  if (score >= 50) return 'Warm';
  if (score >= 25) return 'Cool';
  return 'Cold';
}

export const REL_TYPE_LABEL: Record<GoodsRelType, string> = {
  funder: 'Funder',
  impact_investor: 'Impact Investor',
  repayable_finance: 'Repayable Finance',
  production_partner: 'Production Partner',
  buyer: 'Buyer',
  supporter: 'Supporter',
  advocate: 'Advocate',
};

export const STAGE_LABEL: Record<GoodsStage, string> = {
  identified: 'Identified',
  researching: 'Researching',
  contacted: 'Contacted',
  in_conversation: 'In conversation',
  proposal: 'Proposal',
  committed: 'Committed',
  repeat: 'Repeat',
  dormant: 'Dormant',
  declined: 'Declined',
};

export const STAGE_ORDER: GoodsStage[] = [
  'identified', 'researching', 'contacted', 'in_conversation',
  'proposal', 'committed', 'repeat', 'dormant', 'declined',
];

export const TYPES: (GoodsRelType | 'all')[] = [
  'all', 'funder', 'impact_investor', 'repayable_finance',
  'production_partner', 'buyer', 'supporter', 'advocate',
];

const STAGE_SCORE: Record<GoodsStage, number> = {
  identified: 10, researching: 25, contacted: 40, in_conversation: 60,
  proposal: 75, committed: 90, repeat: 100, dormant: 20, declined: 0,
};

/**
 * JS mirror of the SQL goods_compute_warmth() — keep in lockstep with
 * supabase/migrations/20260609060000_goods_relationships_engagement.sql.
 * Stage 40% / Recency 20% (~42d half-life) / History 20% / Alignment 15% / Advocacy 5%.
 */
export function computeWarmth(p: {
  stage: GoodsStage;
  lastTouch: string | null;
  totalReceived: number;
  alignment: number | null;
  hasPrior: boolean;
  advocacy?: number;
}): number {
  const stage = STAGE_SCORE[p.stage] ?? 0;
  let recency = 0;
  if (p.lastTouch) {
    const days = Math.max(0, (Date.now() - new Date(p.lastTouch).getTime()) / 86_400_000);
    recency = Math.max(0, 100 * Math.exp(-days / 60));
  }
  const history = p.hasPrior
    ? Math.min(100, 50 + 12 * Math.log(Math.max(1, p.totalReceived) / 1000 + 1))
    : 0;
  const align = Math.min(100, Math.max(0, p.alignment ?? 0));
  const adv = Math.min(100, Math.max(0, p.advocacy ?? 0));
  return Math.round(stage * 0.4 + recency * 0.2 + history * 0.2 + align * 0.15 + adv * 0.05);
}

export const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;

export function relDays(iso: string | null): string {
  if (!iso) return 'never';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'today';
  if (d < 60) return `${d}d ago`;
  if (d < 730) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

export function bandFill(band: WarmthBand): string {
  switch (band) {
    case 'Champion': return 'bg-bauhaus-blue';
    case 'Hot': return 'bg-bauhaus-red';
    case 'Warm': return 'bg-bauhaus-yellow';
    case 'Cool': return 'bg-bauhaus-blue/40';
    default: return 'bg-bauhaus-black/20';
  }
}

export function bandPill(band: WarmthBand): string {
  switch (band) {
    case 'Champion': return 'bg-bauhaus-blue text-white';
    case 'Hot': return 'bg-bauhaus-red text-white';
    case 'Warm': return 'bg-bauhaus-yellow text-bauhaus-black';
    case 'Cool': return 'bg-white text-bauhaus-black border-2 border-bauhaus-blue';
    default: return 'bg-white text-bauhaus-muted border-2 border-bauhaus-black/30';
  }
}

/** Next-best-action ("what to do to get closer"). Pure. */
export function nextBestAction(r: GoodsRelationship): string {
  if (r.next_action && r.next_action.trim()) return r.next_action.trim();
  const days = r.last_touch_at ? (Date.now() - new Date(r.last_touch_at).getTime()) / 86_400_000 : Infinity;
  if (r.warmth_display >= 25 && days > 60) return 'Re-warm: send the latest Goods impact update';
  switch (r.stage) {
    case 'identified': return 'Qualify fit and confirm the program / procurement window';
    case 'researching': return r.warm_intro_path ? `Make first contact ${r.warm_intro_path}` : 'Make first contact';
    case 'contacted': return 'Book a conversation to scope the need';
    case 'in_conversation': return 'Move to the ask: scope a beds / $ proposal';
    case 'proposal': return 'Follow up on the submitted proposal';
    case 'committed': return 'Confirm delivery and set up the next tranche';
    case 'repeat': return 'Steward: schedule the next impact touchpoint';
    case 'dormant': return 'Re-open: reference the latest community story';
    case 'declined': return 'Park; revisit when a better-fit program opens';
    default: return 'Review and set the next step';
  }
}
