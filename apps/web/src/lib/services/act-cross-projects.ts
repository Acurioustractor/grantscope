import { getServiceSupabase } from '@/lib/supabase';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';

/**
 * The cross-project view — slice H of the console plan.
 *
 * The workspace has 62 pages and every one of them is either org-wide or single-project; there was
 * no page where the projects sit side by side. This service builds that rollup from what the data
 * actually supports: pipeline aggregates and foundation-engagement counts. It deliberately does
 * NOT surface owner / next_action — those columns are 100% empty across all 125 pipeline rows and
 * a screen designed around them would be designed around a fiction.
 *
 * Aggregation happens in three separate queries joined in JS. A single SQL join fans out —
 * measured: Goods showed a $1.02bn pipeline (27 rows × 202 foundations) where the honest figure
 * is $3.5m. The person→money double-count gate, again.
 */

export interface CrossProject {
  id: string;
  code: string;
  name: string;
  slug: string;
  tier: string | null;
  parentProjectId: string | null;
  pipeline: {
    count: number;
    amount: number;
    submitted: number;
    upcoming: number;
    nextDeadline: string | null;
  };
  foundations: {
    total: number;
    /** approach_now · priority · in_conversation — stages where a human is acting. */
    active: number;
  };
}

export interface CrossProjectView {
  orgName: string;
  projects: CrossProject[];
  totals: { pipelineCount: number; pipelineAmount: number; foundationsActive: number };
}

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  slug: string;
  tier: string | null;
  parent_project_id: string | null;
}

const ACTIVE_STAGES = new Set(['approach_now', 'priority', 'in_conversation']);

export async function getCrossProjectView(slug: string): Promise<CrossProjectView | null> {
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) return null;

  const db = getServiceSupabase();

  const [projectRes, pipelineRes, foundationRes] = await Promise.all([
    db
      .from('org_projects')
      .select('id, code, name, slug, tier, parent_project_id')
      .eq('org_profile_id', profile.id)
      .eq('status', 'active')
      .order('sort_order'),
    db
      .from('org_pipeline')
      .select('project_code, project_id, amount_numeric, status, deadline')
      .eq('org_profile_id', profile.id),
    db.from('org_project_foundations').select('org_project_id, stage').eq('org_profile_id', profile.id),
  ]);

  const projects = (projectRes.data ?? []) as ProjectRow[];
  if (projects.length === 0) return null;

  const byCode = new Map(projects.map((p) => [p.code, p]));
  const byId = new Map(projects.map((p) => [p.id, p]));

  const pipeline = new Map<
    string,
    { count: number; amount: number; submitted: number; upcoming: number; nextDeadline: string | null }
  >();
  const today = new Date().toISOString().slice(0, 10);
  for (const row of pipelineRes.data ?? []) {
    const project = (row.project_code && byCode.get(row.project_code)) || (row.project_id && byId.get(row.project_id));
    if (!project) continue;
    let agg = pipeline.get(project.id);
    if (!agg) {
      agg = { count: 0, amount: 0, submitted: 0, upcoming: 0, nextDeadline: null };
      pipeline.set(project.id, agg);
    }
    agg.count += 1;
    agg.amount += row.amount_numeric ?? 0;
    if (row.status === 'submitted') agg.submitted += 1;
    if (row.status === 'upcoming') agg.upcoming += 1;
    // deadline is TEXT in the schema; only trust ISO-shaped values.
    if (typeof row.deadline === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.deadline)) {
      const d = row.deadline.slice(0, 10);
      if (d >= today && (!agg.nextDeadline || d < agg.nextDeadline)) agg.nextDeadline = d;
    }
  }

  const foundations = new Map<string, { total: number; active: number }>();
  for (const row of foundationRes.data ?? []) {
    if (!row.org_project_id) continue;
    let agg = foundations.get(row.org_project_id);
    if (!agg) {
      agg = { total: 0, active: 0 };
      foundations.set(row.org_project_id, agg);
    }
    agg.total += 1;
    if (row.stage && ACTIVE_STAGES.has(row.stage)) agg.active += 1;
  }

  const out: CrossProject[] = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    slug: p.slug,
    tier: p.tier,
    parentProjectId: p.parent_project_id,
    pipeline: pipeline.get(p.id) ?? { count: 0, amount: 0, submitted: 0, upcoming: 0, nextDeadline: null },
    foundations: foundations.get(p.id) ?? { total: 0, active: 0 },
  }));

  // Money leads: the projects carrying live pipeline first, dormant subs last.
  out.sort(
    (a, b) => b.pipeline.amount - a.pipeline.amount || b.foundations.active - a.foundations.active || a.name.localeCompare(b.name),
  );

  return {
    orgName: profile.name,
    projects: out,
    totals: {
      pipelineCount: out.reduce((n, p) => n + p.pipeline.count, 0),
      pipelineAmount: out.reduce((n, p) => n + p.pipeline.amount, 0),
      foundationsActive: out.reduce((n, p) => n + p.foundations.active, 0),
    },
  };
}
