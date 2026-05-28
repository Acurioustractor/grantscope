import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { getActTodayDigest } from '@/lib/services/act-today-digest';
import { getActSurfaceCounts } from '@/lib/services/act-surface-counts';
import { getServiceSupabase } from '@/lib/supabase';
import { ActSurfaceNav } from '../_components/act-surface-nav';
import { TodayGrantActions, TodayFoundationNudge, TodayBuyerAdd } from './today-actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Today — ACT daily standup',
  description: 'What needs action today across grants, foundations, and procurement.',
};

function fmtMoney(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtRelativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const DEADLINE_CLASSES = (days: number) =>
  days <= 3 ? 'bg-bauhaus-red text-white'
    : days <= 7 ? 'bg-bauhaus-yellow text-bauhaus-black'
    : 'bg-bauhaus-canvas text-bauhaus-black border-2 border-bauhaus-black';

const DECISION_CLASSES: Record<string, string> = {
  pursuing: 'bg-bauhaus-red text-white',
  watching: 'bg-bauhaus-yellow text-bauhaus-black',
  passed: 'bg-gray-300 text-bauhaus-black',
  applied: 'bg-bauhaus-blue text-white',
  submitted: 'bg-bauhaus-blue text-white',
  won: 'bg-green-600 text-white',
  lost: 'bg-bauhaus-red text-white',
};

const REASON_LABEL: Record<string, { text: string; classes: string }> = {
  cooling: { text: 'Cooling', classes: 'bg-bauhaus-red text-white' },
  overdue_contact: { text: 'Overdue', classes: 'bg-bauhaus-yellow text-bauhaus-black' },
  recent_win: { text: 'Recent win', classes: 'bg-green-600 text-white' },
};

export default async function ActTodayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = (await getOrgProfileBySlug(slug)) ?? (isActSlug(slug) ? ACT_FAST_PROFILE : null);
  if (!profile) notFound();

  const [digest, counts] = await Promise.all([
    getActTodayDigest(slug),
    getActSurfaceCounts(slug),
  ]);
  if (!digest) notFound();

  // Project list for the buyer add picker
  const supabase = getServiceSupabase();
  const { data: projects } = await supabase
    .from('act_grant_recommendation_projects')
    .select('project_code, project_label, notes')
    .eq('in_scope', true)
    .order('project_code');
  const projectChoices = (projects ?? []).map((p) => ({
    project_code: p.project_code as string,
    project_label: (p.project_label ?? p.notes ?? p.project_code) as string,
  }));

  const { urgent_grants, recent_decisions, warm_foundations, hot_buyers, totals } = digest;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">
            Daily standup
          </p>
          <h1 className="text-2xl font-black uppercase tracking-wider mt-1">
            Today · {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          <p className="mt-1 text-[11px] font-mono text-gray-300">
            {totals.urgent_grant_count} urgent · {totals.triage_queue_size} in triage queue · {totals.decisions_last_7d} decided last 7d · {totals.cooling_funder_count} cooling funders · {totals.hot_buyer_count} hot buyers
          </p>
          <div className="mt-6">
            <ActSurfaceNav slug={slug} current="today" counts={counts} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">

        {/* Urgent grants */}
        <Section
          title="Closing soon"
          subtitle={`${urgent_grants.length} grants closing in the next 14 days`}
          cta={{ href: `/org/${slug}/pipeline/triage`, label: 'Triage queue →' }}
        >
          {urgent_grants.length === 0 ? (
            <EmptyState message="Nothing closing in the next two weeks." />
          ) : (
            <div className="border-4 border-bauhaus-black bg-white divide-y-2 divide-bauhaus-black">
              {urgent_grants.map((g) => (
                <div key={g.opportunity_id} className="p-4 flex items-start gap-4 hover:bg-bauhaus-canvas transition-colors">
                  <div className={`px-2 py-2 text-[10px] font-black uppercase tracking-widest tabular-nums min-w-[60px] text-center ${DEADLINE_CLASSES(g.days_to_deadline)}`}>
                    {g.days_to_deadline}d
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 flex-wrap items-center mb-1">
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-bauhaus-black text-white">
                        {g.project_code}
                      </span>
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest tabular-nums bg-bauhaus-blue text-white">
                        Fit {g.fit_score}
                      </span>
                      {g.last_decision === 'watching' && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-bauhaus-yellow text-bauhaus-black">
                          Watching
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-bauhaus-muted">
                        {new Date(g.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="font-black text-bauhaus-black">{g.opportunity_name}</div>
                    <div className="text-[11px] font-mono text-bauhaus-muted">
                      {g.funder_name ?? 'Unknown funder'} · {fmtMoney(g.max_grant_amount)}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 items-start">
                    {g.application_url && (
                      <a
                        href={g.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black px-2 py-1 hover:bg-bauhaus-black hover:text-white"
                      >
                        Apply ↗
                      </a>
                    )}
                    <TodayGrantActions
                      projectCode={g.project_code}
                      opportunityId={g.opportunity_id}
                      funderName={g.funder_name}
                      opportunityName={g.opportunity_name}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Two-column row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Warm foundations */}
          <Section
            title="Funders needing a nudge"
            subtitle={`${warm_foundations.length} funders flagged`}
            cta={{ href: `/org/${slug}/foundations/watchlist`, label: 'Watchlist →' }}
            compact
          >
            {warm_foundations.length === 0 ? (
              <EmptyState message="No funder is overdue for contact." />
            ) : (
              <div className="border-4 border-bauhaus-black bg-white divide-y-2 divide-bauhaus-black">
                {warm_foundations.map((f) => {
                  const r = REASON_LABEL[f.reason];
                  return (
                    <div key={f.funder_name} className="p-3 flex items-center gap-3 hover:bg-bauhaus-canvas">
                      <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest min-w-[80px] text-center ${r.classes}`}>
                        {r.text}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm truncate">{f.funder_name}</div>
                        <div className="text-[10px] font-mono text-bauhaus-muted">
                          {fmtMoney(f.paid_total)} lifetime ·{' '}
                          {f.days_since_last_touch != null ? `${f.days_since_last_touch}d since touch` : 'no record'}
                        </div>
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0 items-center">
                        {f.project_codes.slice(0, 2).map((pc) => (
                          <span key={pc} className="px-1 py-0.5 text-[8px] font-black uppercase tracking-wider border-2 border-bauhaus-black">
                            {pc}
                          </span>
                        ))}
                        <TodayFoundationNudge funderName={f.funder_name} projectCodes={f.project_codes} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Hot buyers */}
          <Section
            title="Active buyers (last 6mo)"
            subtitle={`${hot_buyers.length} government buyers spending now`}
            cta={{ href: `/org/${slug}/procurement/opportunities?heat=HOT`, label: 'All buyers →' }}
            compact
          >
            {hot_buyers.length === 0 ? (
              <EmptyState message="No buyers are hot right now." />
            ) : (
              <div className="border-4 border-bauhaus-black bg-white divide-y-2 divide-bauhaus-black">
                {hot_buyers.map((b) => (
                  <div key={b.buyer_name} className="p-3 hover:bg-bauhaus-canvas">
                    <div className="flex items-baseline gap-2">
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest tabular-nums bg-bauhaus-red text-white">
                        {b.contracts_last_6mo}
                      </span>
                      <span className="font-black text-sm flex-1 truncate" title={b.buyer_name}>
                        {b.buyer_name}
                      </span>
                      <span className="text-[10px] font-mono text-bauhaus-muted tabular-nums">
                        {fmtMoney(b.total_relevant_spend)}
                      </span>
                      <TodayBuyerAdd buyerName={b.buyer_name} projects={projectChoices} />
                    </div>
                    {b.recent_titles[0] && (
                      <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5 line-clamp-1" title={b.recent_titles[0]}>
                        Latest: {b.recent_titles[0]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Recent decisions */}
        <Section
          title="Recent decisions (last 7 days)"
          subtitle={`${recent_decisions.length} decisions logged`}
        >
          {recent_decisions.length === 0 ? (
            <EmptyState message="No decisions yet this week. Open the triage deck." />
          ) : (
            <div className="border-4 border-bauhaus-black bg-white divide-y-2 divide-bauhaus-black">
              {recent_decisions.slice(0, 15).map((d) => (
                <div key={`${d.project_code}|${d.opportunity_id}|${d.decided_at}`} className="p-3 flex items-center gap-3 hover:bg-bauhaus-canvas">
                  <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest min-w-[80px] text-center ${DECISION_CLASSES[d.decision] ?? 'bg-gray-300 text-bauhaus-black'}`}>
                    {d.decision}
                  </span>
                  <span className="text-[10px] font-mono text-bauhaus-muted min-w-[80px]">
                    {fmtRelativeDate(d.decided_at)}
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black min-w-[80px] text-center">
                    {d.project_code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm truncate" title={d.opportunity_name ?? d.opportunity_id}>
                      {d.opportunity_name ?? d.opportunity_id}
                    </div>
                    <div className="text-[10px] font-mono text-bauhaus-muted truncate">
                      {d.funder_name ?? '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  subtitle,
  cta,
  compact,
  children,
}: {
  title: string;
  subtitle: string;
  cta?: { href: string; label: string };
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className={`flex items-baseline justify-between gap-3 ${compact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <h2 className={`font-black uppercase tracking-widest text-bauhaus-black ${compact ? 'text-sm' : 'text-base'}`}>
            {title}
          </h2>
          <p className={`font-mono text-bauhaus-muted ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{subtitle}</p>
        </div>
        {cta && (
          <Link
            href={cta.href}
            className="text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black px-2 py-1 hover:bg-bauhaus-black hover:text-white"
          >
            {cta.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white p-6 text-center font-mono text-sm text-bauhaus-muted">
      {message}
    </div>
  );
}
