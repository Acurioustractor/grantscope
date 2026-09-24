import { getServiceSupabase } from '@/lib/supabase';

/** GHL is the system of record for relationship state (see three-pipeline
 *  architecture). ghl_tags on org_project_foundations is a cached signal
 *  written by the reconcile pass; this service derives warmth from it. */

export type GhlWarmth = 'hot' | 'warm' | 'steady' | 'cooling' | 'cold' | 'not_in_ghl';

export interface FunderScanRow {
  id: string;
  name: string;
  projectSlug: string | null;
  projectName: string | null;
  /** org_projects.code, e.g. ACT-GD: the desk's decision record keys on it. */
  projectCode: string | null;
  /** A = recorded grants on file · B = DGR or verified giving · C = theme overlap only. */
  evidenceGrade: 'A' | 'B' | 'C' | null;
  stage: string | null;
  fitScore: number | null;
  fitSummary: string | null;
  nextStep: string | null;
  /** Grants and donations made in Australia, latest ACNC AIS. Null when the funder files no AIS. */
  givingAnnual: number | null;
  givingYear: number | null;
  ghlWarmth: GhlWarmth;
  ghlContactId: string | null;
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

const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };

/** Evidence grade first, then real AIS giving (a funder that gave nothing last year sinks), then fit. */
export function rankFunders(a: Pick<FunderScanRow, 'evidenceGrade' | 'givingAnnual' | 'fitScore'>, b: typeof a): number {
  const g = (GRADE_RANK[a.evidenceGrade ?? ''] ?? 3) - (GRADE_RANK[b.evidenceGrade ?? ''] ?? 3);
  if (g) return g;
  const m = (b.givingAnnual ?? -1) - (a.givingAnnual ?? -1);
  if (m) return m;
  return (b.fitScore ?? -1) - (a.fitScore ?? -1);
}

/**
 * Funder scan for one ACT project, or the whole portfolio when no slug is given.
 *
 * This was pinned to `goods` by a single `.eq()`, which is why Goods owned the
 * only funder surface while Empathy Ledger (99 high-fit) and PICC (84) had none.
 * Ordering is by `evidence_grade` first: A = recorded grants on file, B = DGR or
 * a verified giving figure, C = theme overlap only. `fit_score` is a secondary
 * sort because it was inflated by placeholder giving values on 85% of the
 * foundations table (audit 2026-08-07).
 */
export async function getFunderScan(projectSlug?: string): Promise<FunderScanResult> {
  const db = getServiceSupabase();
  // Every match, not the first 500: the cap hid 1,053 of 1,553 rows from the desk.
  const raw: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let query = db
      .from('org_project_foundations')
      .select('id, stage, fit_score, fit_summary, next_step, evidence_grade, ghl_contact_id, ghl_contact_email, ghl_tags, ghl_synced_at, foundations(name, acnc_abn), org_projects!inner(slug, name, code)');
    if (projectSlug) query = query.eq('org_projects.slug', projectSlug);
    const { data, error } = await query.order('id').range(from, from + 999);
    if (error) throw new Error(`funder scan: ${error.message}`);
    raw.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }

  // Giving = grants and donations made in Australia in the charity's latest Annual Information Statement.
  // Never foundations.total_giving_annual: 81.5% of it is a size-band guess (25K / 100K / 500K).
  const abns = [...new Set(raw.map((r) => (r.foundations as { acnc_abn?: string } | null)?.acnc_abn).filter((a): a is string => !!a))];
  const giving = new Map<string, { amount: number; year: number }>();
  for (let i = 0; i < abns.length; i += 300) {
    const { data, error } = await db
      .from('acnc_ais')
      .select('abn, ais_year, grants_donations_au')
      .in('abn', abns.slice(i, i + 300))
      .not('grants_donations_au', 'is', null);
    if (error) throw new Error(`funder scan (AIS): ${error.message}`);
    for (const a of (data ?? []) as { abn: string; ais_year: number; grants_donations_au: number }[]) {
      const prev = giving.get(a.abn);
      if (!prev || a.ais_year > prev.year) giving.set(a.abn, { amount: Number(a.grants_donations_au), year: a.ais_year });
    }
  }

  const rows: FunderScanRow[] = raw.map((r) => {
    const f = r.foundations as { name?: string; acnc_abn?: string } | null;
    const p = r.org_projects as { slug?: string; name?: string; code?: string } | null;
    const tags = (r.ghl_tags as string[] | null) || [];
    const ais = f?.acnc_abn ? giving.get(f.acnc_abn) : undefined;
    return {
      id: r.id as string,
      name: f?.name ?? '(unknown foundation)',
      projectSlug: p?.slug ?? null,
      projectName: p?.name ?? null,
      projectCode: p?.code ?? null,
      evidenceGrade: (r.evidence_grade as FunderScanRow['evidenceGrade']) ?? null,
      stage: (r.stage as string | null) ?? null,
      fitScore: (r.fit_score as number | null) ?? null,
      fitSummary: (r.fit_summary as string | null) ?? null,
      nextStep: (r.next_step as string | null) ?? null,
      givingAnnual: ais?.amount ?? null,
      givingYear: ais?.year ?? null,
      ghlWarmth: warmthFromTags(r.ghl_synced_at ? tags : null),
      ghlContactId: (r.ghl_contact_id as string | null) ?? null,
      ghlEmail: (r.ghl_contact_email as string | null) ?? null,
      ghlTags: tags,
      ghlSyncedAt: (r.ghl_synced_at as string | null) ?? null,
    };
  });
  rows.sort(rankFunders);

  const byWarmth = Object.fromEntries(WARMTH_ORDER.map((w) => [w, 0])) as Record<GhlWarmth, number>;
  for (const r of rows) byWarmth[r.ghlWarmth] += 1;

  return {
    rows,
    summary: {
      total: rows.length,
      byWarmth,
      synced: rows.filter((r) => r.ghlSyncedAt).length,
      warmButUnworked: rows.filter((r) => (r.ghlWarmth === 'hot' || r.ghlWarmth === 'warm') && (!r.stage || UNWORKED.has(r.stage))),
      // Was `fitScore >= 85`, which surfaced 286 rows ranked on placeholder money.
      // Evidence grade A means recorded grants on file — provable, not inferred.
      hotButUnpushed: rows.filter((r) => r.ghlWarmth === 'not_in_ghl' && r.evidenceGrade === 'A'),
    },
  };
}

/** Goods-scoped view, kept for the Goods funder-scan page. */
export function getGoodsFunderScan(): Promise<FunderScanResult> {
  return getFunderScan('goods');
}
