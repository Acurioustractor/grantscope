import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface SavedGrant {
  id: string;
  stage: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
  } | null;
}

interface SavedFoundation {
  id: string;
  stage: string;
  foundation: {
    id: string;
    name: string;
    total_giving_annual: number | null;
    thematic_focus: string[];
    geographic_focus: string[];
  } | null;
}

function formatMoney(amount: number | null): string {
  if (!amount) return '—';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

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
  ]);

  const grants = (savedGrants || []) as unknown as SavedGrant[];
  const foundations = (savedFoundations || []) as unknown as SavedFoundation[];

  // Pipeline counts
  const stageCounts: Record<string, number> = {};
  grants.forEach((g) => { stageCounts[g.stage] = (stageCounts[g.stage] || 0) + 1; });

  const discoveredCount = stageCounts['discovered'] || 0;
  const activeCount = (stageCounts['researching'] || 0) + (stageCounts['pursuing'] || 0) + (stageCounts['preparing'] || 0);
  const submittedCount = stageCounts['submitted'] || 0;
  const wonCount = (stageCounts['successful'] || 0) + (stageCounts['approved'] || 0) + (stageCounts['realized'] || 0);

  // Deadlines — split into urgent (<=7d) and upcoming
  const allDeadlines = grants
    .filter((g) => g.grant?.closes_at && new Date(g.grant.closes_at) > new Date())
    .sort((a, b) => new Date(a.grant?.closes_at || 0).getTime() - new Date(b.grant?.closes_at || 0).getTime());

  const urgentDeadlines = allDeadlines.filter((g) => daysUntil(g.grant!.closes_at!) <= 7);
  const soonDeadlines = allDeadlines.filter((g) => {
    const d = daysUntil(g.grant!.closes_at!);
    return d > 7 && d <= 30;
  }).slice(0, 5);

  // Foundation summary
  const foundationStageCounts: Record<string, number> = {};
  foundations.forEach((f) => { foundationStageCounts[f.stage] = (foundationStageCounts[f.stage] || 0) + 1; });

  // Onboarding — only show when genuinely new
  const isNewUser = grants.length === 0 && foundations.length === 0;
  const hasProfile = !!profile?.name;
  const hasFocusAreas = !!profile?.focus_areas?.length;

  // Greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] || profile?.name;

  return (
    <div>
      {/* ── Greeting ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight mb-1">
          {timeGreeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-bauhaus-muted">
          {urgentDeadlines.length > 0
            ? `You have ${urgentDeadlines.length} deadline${urgentDeadlines.length !== 1 ? 's' : ''} closing this week.`
            : grants.length > 0
              ? `${grants.length} grants tracked across your pipeline.`
              : 'Let\u2019s find some grants for your organisation.'}
        </p>
      </div>

      {/* ── New user onboarding ── */}
      {isNewUser && (
        <div className="border-4 border-bauhaus-blue bg-bauhaus-blue/5 p-6 mb-8">
          <h2 className="text-lg font-black uppercase tracking-wider mb-3">Get Started</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/profile" className={`flex items-center gap-3 p-3 border-2 transition-colors ${hasProfile && hasFocusAreas ? 'border-green-600 bg-green-50' : 'border-bauhaus-black hover:bg-white'}`}>
              <div className={`w-8 h-8 flex items-center justify-center text-sm font-black ${hasProfile && hasFocusAreas ? 'bg-green-600 text-white' : 'bg-bauhaus-black text-white'}`}>
                {hasProfile && hasFocusAreas ? '\u2713' : '1'}
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider">Complete Profile</p>
                <p className="text-xs text-bauhaus-muted">Name, ABN &amp; focus areas</p>
              </div>
            </Link>
            <Link href="/grants" className="flex items-center gap-3 p-3 border-2 border-bauhaus-black hover:bg-white transition-colors">
              <div className="w-8 h-8 flex items-center justify-center text-sm font-black bg-bauhaus-black text-white">2</div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider">Find Grants</p>
                <p className="text-xs text-bauhaus-muted">Search 14k+ opportunities</p>
              </div>
            </Link>
            <Link href="/alerts" className="flex items-center gap-3 p-3 border-2 border-bauhaus-black hover:bg-white transition-colors">
              <div className="w-8 h-8 flex items-center justify-center text-sm font-black bg-bauhaus-black text-white">3</div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider">Set Up Alerts</p>
                <p className="text-xs text-bauhaus-muted">Get notified about new grants</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ── Profile nudge (not new, but missing focus areas) ── */}
      {!isNewUser && !hasFocusAreas && (
        <Link href="/profile" className="flex items-center gap-3 p-4 mb-6 bg-bauhaus-blue/5 border-2 border-bauhaus-blue hover:bg-bauhaus-blue/10 transition-colors">
          <div className="w-8 h-8 flex items-center justify-center text-sm font-black bg-bauhaus-blue text-white flex-shrink-0">!</div>
          <div>
            <p className="text-sm font-bold">Add your focus areas to get better grant matches</p>
            <p className="text-xs text-bauhaus-muted">Tell us what you fund so we can surface the most relevant opportunities.</p>
          </div>
        </Link>
      )}

      {/* ── Urgent deadlines — top of page when present ── */}
      {urgentDeadlines.length > 0 && (
        <section className="mb-8">
          <div className="border-4 border-bauhaus-red">
            <div className="bg-bauhaus-red px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-widest">
                Closing This Week
              </span>
              <span className="text-xs font-bold text-white/70">
                {urgentDeadlines.length} grant{urgentDeadlines.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="divide-y-2 divide-bauhaus-black/10">
              {urgentDeadlines.map((item) => {
                const days = daysUntil(item.grant!.closes_at!);
                return (
                  <Link
                    key={item.id}
                    href={`/grants/${item.grant?.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.grant?.name}</p>
                      <p className="text-xs text-bauhaus-muted">{item.grant?.provider}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {item.grant?.amount_max && (
                        <span className="text-sm font-black tabular-nums">{formatMoney(item.grant.amount_max)}</span>
                      )}
                      <span className="text-xs font-black uppercase tracking-wider px-2 py-1 bg-bauhaus-red text-white tabular-nums">
                        {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Pipeline overview — compact, actionable ── */}
      {grants.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black uppercase tracking-wider">Your Pipeline</h2>
            <Link href="/tracker" className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
              Open Tracker &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/tracker" className="border-2 border-bauhaus-black p-4 bg-white hover:bg-gray-50 transition-colors">
              <p className="text-3xl font-black tabular-nums">{discoveredCount}</p>
              <p className="text-xs font-bold text-bauhaus-muted mt-1">To Review</p>
              {discoveredCount > 20 && (
                <p className="text-[11px] text-bauhaus-red font-bold mt-2">Needs triaging</p>
              )}
            </Link>
            <Link href="/tracker" className="border-2 border-bauhaus-black p-4 bg-white hover:bg-gray-50 transition-colors">
              <p className="text-3xl font-black tabular-nums">{activeCount}</p>
              <p className="text-xs font-bold text-bauhaus-muted mt-1">In Progress</p>
            </Link>
            <Link href="/tracker" className="border-2 border-bauhaus-black p-4 bg-white hover:bg-gray-50 transition-colors">
              <p className="text-3xl font-black tabular-nums">{submittedCount}</p>
              <p className="text-xs font-bold text-bauhaus-muted mt-1">Submitted</p>
            </Link>
            <div className="border-2 border-bauhaus-black p-4 bg-white">
              <p className="text-3xl font-black tabular-nums text-money">{wonCount}</p>
              <p className="text-xs font-bold text-bauhaus-muted mt-1">Won</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Upcoming deadlines (next 30 days, after urgents) ── */}
      {soonDeadlines.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-black uppercase tracking-wider mb-3">Coming Up</h2>
          <div className="border-2 border-bauhaus-black divide-y divide-bauhaus-black/10">
            {soonDeadlines.map((item) => {
              const days = daysUntil(item.grant!.closes_at!);
              return (
                <Link
                  key={item.id}
                  href={`/grants/${item.grant?.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.grant?.name}</p>
                    <p className="text-xs text-bauhaus-muted">{item.grant?.provider}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {item.grant?.amount_max && (
                      <span className="text-sm font-black tabular-nums">{formatMoney(item.grant.amount_max)}</span>
                    )}
                    <span className="text-xs font-bold text-bauhaus-muted tabular-nums">
                      {days}d
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Foundations — show names, not just counts ── */}
      {foundations.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black uppercase tracking-wider">Foundations</h2>
            <Link href="/foundations/tracker" className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
              View All {foundations.length} &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {foundations.slice(0, 6).map((f) => (
              <Link
                key={f.id}
                href={`/foundations/${f.foundation?.id}`}
                className="flex items-center justify-between border-2 border-bauhaus-black px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{f.foundation?.name}</p>
                  <p className="text-xs text-bauhaus-muted">
                    {f.foundation?.total_giving_annual
                      ? `${formatMoney(f.foundation.total_giving_annual)}/yr`
                      : 'Giving unknown'}
                    {f.foundation?.thematic_focus?.[0] && ` \u00B7 ${f.foundation.thematic_focus[0]}`}
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted ml-3 flex-shrink-0">
                  {f.stage.replace('_', ' ')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state — only when truly nothing ── */}
      {grants.length === 0 && foundations.length === 0 && !isNewUser && (
        <div className="border-2 border-dashed border-bauhaus-black/20 p-8 text-center">
          <p className="text-sm text-bauhaus-muted mb-3">Your pipeline is empty</p>
          <Link href="/grants" className="inline-block bg-bauhaus-black text-white px-6 py-2.5 text-sm font-black uppercase tracking-wider hover:bg-bauhaus-red transition-colors">
            Find Grants
          </Link>
        </div>
      )}
    </div>
  );
}
