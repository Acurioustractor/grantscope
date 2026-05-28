import { notFound } from 'next/navigation';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { getServiceSupabase } from '@/lib/supabase';
import { getActSurfaceCounts } from '@/lib/services/act-surface-counts';
import { ActSurfaceNav } from '../../_components/act-surface-nav';
import { TriageDeck } from './triage-deck';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Triage — Strong-fit decisions',
  description: 'Decide on every strong-fit opportunity that has no decision yet.',
};

interface TriageRow {
  project_code: string;
  project_label: string;
  project_readiness: string | null;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  min_grant_amount: number | null;
  max_grant_amount: number | null;
  fit_score: number;
  is_strong_fit: boolean;
  flags: string[] | null;
  theme_score: number;
  geography_score: number;
  eligibility_score: number;
  timing_score: number;
  source_url: string | null;
  application_url: string | null;
}

export default async function TriagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = (await getOrgProfileBySlug(slug)) ?? (isActSlug(slug) ? ACT_FAST_PROFILE : null);
  if (!profile) notFound();
  if (!isActSlug(slug)) notFound();

  const supabase = getServiceSupabase();
  const counts = await getActSurfaceCounts(slug);

  // Pull strong-fit recommendations with no decision yet.
  // DISTINCT ON (opportunity_id) — best project_code wins.
  const [recsRes, decisionsRes, projectsRes] = await Promise.all([
    supabase
      .from('act_grant_recommendations')
      .select(
        'project_code, opportunity_id, opportunity_name, funder_name, deadline, min_grant_amount, max_grant_amount, source_url, application_url, fit_score, is_strong_fit, flags, theme_score, geography_score, eligibility_score, timing_score',
      )
      .eq('is_strong_fit', true)
      .order('fit_score', { ascending: false })
      .range(0, 4999),
    supabase
      .from('act_grant_recommendation_decisions')
      .select('project_code, opportunity_id'),
    supabase
      .from('act_grant_recommendation_projects')
      .select('project_code, project_label, readiness')
      .eq('in_scope', true),
  ]);

  const recs = (recsRes.data ?? []) as TriageRow[];
  const decisions = (decisionsRes.data ?? []) as Array<{
    project_code: string;
    opportunity_id: string;
  }>;
  const projects = (projectsRes.data ?? []) as Array<{
    project_code: string;
    project_label: string | null;
    readiness: string | null;
  }>;

  const projectMap = new Map(projects.map((p) => [p.project_code, p]));
  const decided = new Set(decisions.map((d) => `${d.project_code}|${d.opportunity_id}`));

  // Dedup by opportunity_id (best fit_score wins) AND filter out decided rows
  // for any project pairing — once you decide on an opp anywhere, it leaves
  // the triage deck.
  const decidedOppIds = new Set(decisions.map((d) => d.opportunity_id));

  const byOpp = new Map<string, TriageRow>();
  for (const r of recs) {
    if (decidedOppIds.has(r.opportunity_id)) continue;
    // Also filter: deadline must be future or null
    if (r.deadline && new Date(r.deadline) < new Date()) continue;
    const existing = byOpp.get(r.opportunity_id);
    if (!existing || r.fit_score > existing.fit_score) {
      const project = projectMap.get(r.project_code);
      byOpp.set(r.opportunity_id, {
        ...r,
        project_label: project?.project_label ?? r.project_code,
        project_readiness: project?.readiness ?? null,
      });
    }
  }

  const queue = Array.from(byOpp.values()).sort((a, b) => {
    // Sort by deadline urgency: tight first, then fit_score
    const aDays = a.deadline
      ? Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86_400_000)
      : 999;
    const bDays = b.deadline
      ? Math.ceil((new Date(b.deadline).getTime() - Date.now()) / 86_400_000)
      : 999;
    if (aDays !== bDays) return aDays - bDays;
    return b.fit_score - a.fit_score;
  });

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">
            Triage
          </p>
          <h1 className="text-2xl font-black uppercase tracking-wider mt-1">
            Strong-fit decisions
          </h1>
          <p className="mt-1 text-[11px] font-mono text-gray-300">
            {queue.length} undecided · sorted by deadline, then fit
          </p>
          <div className="mt-6">
            <ActSurfaceNav slug={slug} current="triage" counts={counts} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {queue.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-12 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
              Nothing to triage
            </p>
            <p className="mt-3 font-mono text-sm">
              Every strong-fit opportunity has a decision. Take the win.
            </p>
          </div>
        ) : (
          <TriageDeck initialQueue={queue} slug={slug} />
        )}
      </div>
    </main>
  );
}
