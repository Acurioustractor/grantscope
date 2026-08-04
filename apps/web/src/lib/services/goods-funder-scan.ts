import { getServiceSupabase } from '@/lib/supabase';

/** GHL is the system of record for relationship state (see three-pipeline
 *  architecture). ghl_tags on org_project_foundations is a cached signal
 *  written by the reconcile pass; this service derives warmth from it. */

export type GhlWarmth = 'hot' | 'warm' | 'steady' | 'cooling' | 'cold' | 'not_in_ghl';

export interface FunderScanRow {
  id: string;
  name: string;
  stage: string | null;
  fitScore: number | null;
  fitSummary: string | null;
  nextStep: string | null;
  givingAnnual: number | null;
  ghlWarmth: GhlWarmth;
  ghlEmail: string | null;
  ghlTags: string[];
  ghlSyncedAt: string | null;
}

export const WARMTH_ORDER: GhlWarmth[] = ['hot', 'warm', 'steady', 'cooling', 'cold', 'not_in_ghl'];

export const WARMTH_LABEL: Record<GhlWarmth, string> = {
  hot: 'Hot',
  warm: 'Warm',
  steady: 'Steady',
  cooling: 'Cooling',
  cold: 'Cold',
  not_in_ghl: 'Not in GHL',
};

function warmthFromTags(tags: string[] | null): GhlWarmth {
  if (!tags || tags.length === 0) return 'not_in_ghl';
  if (tags.includes('goods-hot')) return 'hot';
  if (tags.includes('goods-warm')) return 'warm';
  if (tags.includes('goods-steady')) return 'steady';
  if (tags.includes('goods-cooling')) return 'cooling';
  if (tags.includes('goods-cold')) return 'cold';
  // Synced, matched, but no goods-* temperature tag — treat as steady signal.
  return 'steady';
}

export interface FunderScanResult {
  rows: FunderScanRow[];
  summary: {
    total: number;
    byWarmth: Record<GhlWarmth, number>;
    synced: number;
    /** GHL warm/hot but discovery stage is saved/parked/none — discovery understates. */
    warmButUnworked: FunderScanRow[];
    /** fit >= 85 with no GHL contact — never pushed to the core pipeline. */
    hotButUnpushed: FunderScanRow[];
  };
}

const UNWORKED = new Set(['saved', 'parked']);

export async function getGoodsFunderScan(): Promise<FunderScanResult> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('org_project_foundations')
    .select('id, stage, fit_score, fit_summary, next_step, ghl_contact_email, ghl_tags, ghl_synced_at, foundations(name, total_giving_annual), org_projects!inner(slug)')
    .eq('org_projects.slug', 'goods')
    .order('fit_score', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(`funder scan: ${error.message}`);

  const rows: FunderScanRow[] = (data || []).map((r: Record<string, unknown>) => {
    const f = r.foundations as { name?: string; total_giving_annual?: number } | null;
    const tags = (r.ghl_tags as string[] | null) || [];
    return {
      id: r.id as string,
      name: f?.name ?? '(unknown foundation)',
      stage: (r.stage as string | null) ?? null,
      fitScore: (r.fit_score as number | null) ?? null,
      fitSummary: (r.fit_summary as string | null) ?? null,
      nextStep: (r.next_step as string | null) ?? null,
      givingAnnual: f?.total_giving_annual ?? null,
      ghlWarmth: warmthFromTags(r.ghl_synced_at ? tags : null),
      ghlEmail: (r.ghl_contact_email as string | null) ?? null,
      ghlTags: tags,
      ghlSyncedAt: (r.ghl_synced_at as string | null) ?? null,
    };
  });

  const byWarmth = Object.fromEntries(WARMTH_ORDER.map((w) => [w, 0])) as Record<GhlWarmth, number>;
  for (const r of rows) byWarmth[r.ghlWarmth] += 1;

  return {
    rows,
    summary: {
      total: rows.length,
      byWarmth,
      synced: rows.filter((r) => r.ghlSyncedAt).length,
      warmButUnworked: rows.filter((r) => (r.ghlWarmth === 'hot' || r.ghlWarmth === 'warm') && (!r.stage || UNWORKED.has(r.stage))),
      hotButUnpushed: rows.filter((r) => r.ghlWarmth === 'not_in_ghl' && (r.fitScore ?? 0) >= 85),
    },
  };
}
