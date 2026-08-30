import { getServiceSupabase } from '@/lib/supabase';
import { GrantRecommendationsClient, type Recommendation, type Decision, type ProjectSummary } from './grant-recommendations-client';
import type { FunderContext } from './funder-dossier';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Grant Recommendations — Ops',
  description: 'Fit-scored grant opportunities × 6 ACT projects.',
};

export default async function GrantRecommendationsPage() {
  const supabase = getServiceSupabase();

  const { data: recsRaw } = await supabase
    .from('act_grant_recommendations_current')
    .select('*')
    .order('project_code', { ascending: true })
    .order('fit_score', { ascending: false })
    .range(0, 9999);

  const { data: decisionsRaw } = await supabase
    .from('act_grant_recommendation_decisions')
    .select('project_code, opportunity_id, decision, decided_at, notes, grant_opportunity_id')
    .eq('decision_scope', 'operational');

  const { data: projectsRaw } = await supabase
    .from('act_grant_recommendation_projects')
    .select('project_code, notes, home_states, in_scope')
    .eq('in_scope', true)
    .order('project_code');

  const { data: contextsRaw } = await supabase
    .from('funder_context_snapshot')
    .select('*');

  const recs = (recsRaw ?? []) as Recommendation[];
  const decisions = (decisionsRaw ?? []) as Decision[];

  const summary: ProjectSummary[] = (projectsRaw ?? []).map((p) => {
    const projectRecs = recs.filter((r) => r.project_code === p.project_code);
    const strong = projectRecs.filter((r) => r.is_strong_fit);
    const topTier = projectRecs.filter((r) => r.fit_score >= 80);
    return {
      project_code: p.project_code,
      project_label: p.notes ?? p.project_code,
      home_states: p.home_states ?? [],
      total: projectRecs.length,
      strong_count: strong.length,
      top_tier_count: topTier.length,
      max_score: projectRecs.reduce((m, r) => Math.max(m, r.fit_score), 0),
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <GrantRecommendationsClient
        recommendations={recs}
        decisions={decisions}
        summary={summary}
        contexts={(contextsRaw ?? []) as FunderContext[]}
      />
    </div>
  );
}
