import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { HomeClient } from './home-client';
import type { GrantItem, FoundationItem, AgentRun } from './home-client';

export const dynamic = 'force-dynamic';

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default async function HomePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getServiceSupabase();

  const [
    { data: savedGrants },
    { data: savedFoundations },
    { data: profile },
    { data: recentAgentRuns },
    { count: openGrantCount },
    { count: entityCount },
  ] = await Promise.all([
    db.from('saved_grants')
      .select('id, stage, grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    db.from('saved_foundations')
      .select('id, stage, foundation:foundation_id(id, name, total_giving_annual, thematic_focus, geographic_focus)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    db.from('org_profiles')
      .select('id, name, abn, focus_areas, geographic_focus, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('agent_runs')
      .select('agent_name, status, items_found, items_new, started_at, duration_ms')
      .order('started_at', { ascending: false })
      .limit(8),
    db.from('grant_opportunities')
      .select('*', { count: 'exact', head: true })
      .gt('closes_at', new Date().toISOString()),
    db.from('gs_entities')
      .select('*', { count: 'exact', head: true }),
  ]);

  const grants = (savedGrants || []) as unknown as GrantItem[];
  const foundations = (savedFoundations || []) as unknown as FoundationItem[];
  const agentRuns = (recentAgentRuns || []) as AgentRun[];

  // Pipeline counts
  const stageCounts: Record<string, number> = {};
  grants.forEach((g) => { stageCounts[g.stage] = (stageCounts[g.stage] || 0) + 1; });

  const discoveredCount = stageCounts['discovered'] || 0;
  const activeCount = (stageCounts['researching'] || 0) + (stageCounts['pursuing'] || 0) + (stageCounts['preparing'] || 0);
  const submittedCount = stageCounts['submitted'] || 0;
  const wonCount = (stageCounts['successful'] || 0) + (stageCounts['approved'] || 0) + (stageCounts['realized'] || 0);

  // Deadlines
  const allDeadlines = grants
    .filter((g) => g.grant?.closes_at && new Date(g.grant.closes_at) > new Date())
    .sort((a, b) => new Date(a.grant?.closes_at || 0).getTime() - new Date(b.grant?.closes_at || 0).getTime());

  const urgentDeadlines = allDeadlines.filter((g) => daysUntil(g.grant!.closes_at!) <= 7);
  const soonDeadlines = allDeadlines.filter((g) => {
    const d = daysUntil(g.grant!.closes_at!);
    return d > 7 && d <= 30;
  }).slice(0, 5);

  // Onboarding
  const isNewUser = grants.length === 0 && foundations.length === 0;
  const hasProfile = !!profile?.name;
  const hasFocusAreas = !!profile?.focus_areas?.length;

  // Greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] || profile?.name;
  const greeting = `${timeGreeting}${firstName ? `, ${firstName}` : ''}`;

  const contextLine = urgentDeadlines.length > 0
    ? `${urgentDeadlines.length} deadline${urgentDeadlines.length !== 1 ? 's' : ''} closing this week`
    : grants.length > 0
      ? `${grants.length} grants tracked \u00B7 ${(openGrantCount || 0).toLocaleString()} open opportunities in the database`
      : 'Welcome to CivicGraph. Let\u2019s get your workspace set up.';

  return (
    <HomeClient
      greeting={greeting}
      contextLine={contextLine}
      isNewUser={isNewUser}
      hasProfile={hasProfile}
      hasFocusAreas={hasFocusAreas}
      grants={grants}
      foundations={foundations}
      agentRuns={agentRuns}
      openGrantCount={openGrantCount || 0}
      entityCount={entityCount || 0}
      urgentDeadlines={urgentDeadlines}
      soonDeadlines={soonDeadlines}
      discoveredCount={discoveredCount}
      activeCount={activeCount}
      submittedCount={submittedCount}
      wonCount={wonCount}
    />
  );
}
