import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';
import type { FunderContext } from '@/app/ops/grant-recommendations/funder-dossier';

export type PipelineColumn =
  | 'discovered'
  | 'watching'
  | 'pursuing'
  | 'applied'
  | 'submitted'
  | 'won'
  | 'lost'
  | 'passed';

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  'discovered',
  'watching',
  'pursuing',
  'applied',
  'submitted',
  'won',
  'lost',
  'passed',
];

export interface OrgPipelineCard {
  /** Stable id for drag/drop = `${project_code}|${opportunity_id}` */
  key: string;
  project_code: string;
  also_fits_projects: string[];
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  min_grant_amount: number | null;
  max_grant_amount: number | null;
  fit_score: number;
  is_strong_fit: boolean;
  source_url: string | null;
  application_url: string | null;
  flags: string[] | null;
  theme_score: number;
  geography_score: number;
  eligibility_score: number;
  timing_score: number;
  decision: PipelineColumn;
  decided_at: string | null;
  grant_opportunity_id: string | null;
  notes: string | null;
  temperature: 'WARM' | 'TEPID' | 'LIGHT' | 'COLD';
  relationship_score: number | null;
  /** True for cards backfilled from xero_invoices (historical wins). Not draggable. */
  is_historical?: boolean;
  /** Lifetime paid total from Xero, used to render $ on historical Won cards. */
  historical_paid_total?: number;
  /** Number of paid invoices in Xero, shown on historical cards. */
  historical_invoice_count?: number;
}

export interface OrgPipelineProject {
  project_code: string;
  project_label: string;
}

export interface OrgPipelineData {
  cards: OrgPipelineCard[];
  projects: OrgPipelineProject[];
  contexts: FunderContext[];
  /** Minimum fit_score required for an undecided row to land in Discovered */
  discoveredMinScore: number;
  /** Total rows in MV (for context strip) */
  totalRows: number;
}

interface RawRecRow {
  project_code: string;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  min_grant_amount: number | null;
  max_grant_amount: number | null;
  source_url: string | null;
  application_url: string | null;
  fit_score: number;
  is_strong_fit: boolean;
  flags: string[] | null;
  theme_score: number;
  geography_score: number;
  eligibility_score: number;
  timing_score: number;
}

interface RawDecisionRow {
  project_code: string;
  opportunity_id: string;
  decision: string;
  decided_at: string;
  notes: string | null;
  grant_opportunity_id: string | null;
}

interface RawProjectRow {
  project_code: string;
  notes: string | null;
}

function temperatureFor(
  funderName: string | null,
  contexts: Map<string, FunderContext>,
): { label: OrgPipelineCard['temperature']; score: number | null } {
  if (!funderName) return { label: 'COLD', score: null };
  const ctx = contexts.get(funderName);
  if (!ctx) return { label: 'COLD', score: null };
  const score = ctx.relationship_score ?? 0;
  if (score >= 50) return { label: 'WARM', score };
  if (score >= 20) return { label: 'TEPID', score };
  if (score > 0) return { label: 'LIGHT', score };
  return { label: 'COLD', score };
}

function isPipelineColumn(value: string): value is PipelineColumn {
  return PIPELINE_COLUMNS.includes(value as PipelineColumn);
}

/**
 * Pipeline data for an org slug. Currently only `act` (and aliases) has the
 * underlying ACT project codes wired up in act_grant_recommendations.
 *
 * `discoveredMinScore` (default 40) gates which undecided opportunities show
 * up in the Discovered column — 553 unique opps × 6 projects would otherwise
 * dwarf decided rows.
 */
export const getOrgPipelineData = cache(async function getOrgPipelineData(
  slug: string,
  discoveredMinScore = 40,
): Promise<OrgPipelineData | null> {
  if (!isActSlug(slug)) return null;

  const supabase = getServiceSupabase();

  const [recsRes, decisionsRes, projectsRes, contextsRes] = await Promise.all([
    supabase
      .from('act_grant_recommendations')
      .select(
        'project_code, opportunity_id, opportunity_name, funder_name, deadline, min_grant_amount, max_grant_amount, source_url, application_url, fit_score, is_strong_fit, flags, theme_score, geography_score, eligibility_score, timing_score',
      )
      .order('fit_score', { ascending: false })
      .range(0, 9999),
    supabase
      .from('act_grant_recommendation_decisions')
      .select('project_code, opportunity_id, decision, decided_at, notes, grant_opportunity_id'),
    supabase
      .from('act_grant_recommendation_projects')
      .select('project_code, notes')
      .eq('in_scope', true)
      .order('project_code'),
    supabase.from('funder_context_snapshot').select('*'),
  ]);

  const recs = (recsRes.data ?? []) as RawRecRow[];
  const decisions = (decisionsRes.data ?? []) as RawDecisionRow[];
  const projects = (projectsRes.data ?? []) as RawProjectRow[];
  const contexts = (contextsRes.data ?? []) as FunderContext[];

  const contextByFunder = new Map<string, FunderContext>();
  for (const ctx of contexts) {
    contextByFunder.set(ctx.funder_name, ctx);
    for (const alias of ctx.funder_aliases ?? []) contextByFunder.set(alias, ctx);
  }

  const decisionByKey = new Map<string, RawDecisionRow>();
  for (const d of decisions) {
    decisionByKey.set(`${d.project_code}|${d.opportunity_id}`, d);
  }

  // Dedup by opportunity_id: best-fit project_code wins; the others become
  // chips on the card. This keeps the kanban legible — one card per opp.
  const byOpp = new Map<string, { best: RawRecRow; others: string[] }>();
  for (const r of recs) {
    const existing = byOpp.get(r.opportunity_id);
    if (!existing) {
      byOpp.set(r.opportunity_id, { best: r, others: [] });
      continue;
    }
    if (r.fit_score > existing.best.fit_score) {
      byOpp.set(r.opportunity_id, {
        best: r,
        others: [...existing.others, existing.best.project_code],
      });
    } else {
      existing.others.push(r.project_code);
    }
  }

  // If any project pair for an opportunity has a decision, that decision wins.
  // Prefer the decision tied to the best-fit project; otherwise take the first
  // decision row we find for the opp.
  function decisionForOpp(opportunityId: string, bestProject: string): RawDecisionRow | null {
    const bestKey = `${bestProject}|${opportunityId}`;
    if (decisionByKey.has(bestKey)) return decisionByKey.get(bestKey)!;
    for (const d of decisions) {
      if (d.opportunity_id === opportunityId) return d;
    }
    return null;
  }

  const cards: OrgPipelineCard[] = [];
  for (const { best, others } of byOpp.values()) {
    const decision = decisionForOpp(best.opportunity_id, best.project_code);
    const decisionState: PipelineColumn = decision && isPipelineColumn(decision.decision)
      ? decision.decision
      : 'discovered';

    if (decisionState === 'discovered' && best.fit_score < discoveredMinScore) {
      // Below the discovered floor — don't surface in any column.
      continue;
    }

    const temp = temperatureFor(best.funder_name, contextByFunder);

    cards.push({
      key: `${best.project_code}|${best.opportunity_id}`,
      project_code: best.project_code,
      also_fits_projects: others,
      opportunity_id: best.opportunity_id,
      opportunity_name: best.opportunity_name,
      funder_name: best.funder_name,
      deadline: best.deadline,
      min_grant_amount: best.min_grant_amount,
      max_grant_amount: best.max_grant_amount,
      fit_score: best.fit_score,
      is_strong_fit: best.is_strong_fit,
      source_url: best.source_url,
      application_url: best.application_url,
      flags: best.flags,
      theme_score: best.theme_score,
      geography_score: best.geography_score,
      eligibility_score: best.eligibility_score,
      timing_score: best.timing_score,
      decision: decisionState,
      decided_at: decision?.decided_at ?? null,
      grant_opportunity_id: decision?.grant_opportunity_id ?? null,
      notes: decision?.notes ?? null,
      temperature: temp.label,
      relationship_score: temp.score,
    });
  }

  // ------------------------------------------------------------------
  // Backfill: append historical "won" cards from v_act_income_by_funder
  // (xero_invoices PAID rows). One card per (funder, project_code) pair
  // where the funder paid > $1K. Non-draggable in the UI.
  // ------------------------------------------------------------------
  const { data: incomeRows } = await supabase
    .from('v_act_income_by_funder')
    .select('funder_name, project_codes, paid_total, paid_invoice_count, last_paid_date')
    .gt('paid_total', 1000);

  const historicalCards: OrgPipelineCard[] = [];
  for (const row of incomeRows ?? []) {
    const projectCodes = (row.project_codes as string[] | null) ?? [];
    if (projectCodes.length === 0) continue;
    const funderName = String(row.funder_name ?? '');
    const paidTotal = Number(row.paid_total ?? 0);
    const invoiceCount = Number(row.paid_invoice_count ?? 0);
    const lastPaid = (row.last_paid_date as string | null) ?? null;
    const primaryProject = projectCodes[0];
    const otherProjects = projectCodes.slice(1);
    const temp = temperatureFor(funderName, contextByFunder);
    historicalCards.push({
      key: `historical|${primaryProject}|${funderName}`,
      project_code: primaryProject,
      also_fits_projects: otherProjects,
      opportunity_id: `historical-${primaryProject}-${funderName}`,
      opportunity_name: `${funderName} (lifetime)`,
      funder_name: funderName,
      deadline: null,
      min_grant_amount: null,
      max_grant_amount: paidTotal,
      fit_score: 100,
      is_strong_fit: true,
      source_url: null,
      application_url: null,
      flags: ['historical'],
      theme_score: 50,
      geography_score: 15,
      eligibility_score: 20,
      timing_score: 15,
      decision: 'won',
      decided_at: lastPaid,
      grant_opportunity_id: null,
      notes: `${invoiceCount} paid invoice${invoiceCount === 1 ? '' : 's'} via Xero`,
      temperature: temp.label,
      relationship_score: temp.score,
      is_historical: true,
      historical_paid_total: paidTotal,
      historical_invoice_count: invoiceCount,
    });
  }

  return {
    cards: [...cards, ...historicalCards],
    projects: projects.map((p) => ({
      project_code: p.project_code,
      project_label: p.notes ?? p.project_code,
    })),
    contexts,
    discoveredMinScore,
    totalRows: recs.length,
  };
});
