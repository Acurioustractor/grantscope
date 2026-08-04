import { notFound } from 'next/navigation';
import { ActWorkspacePageHeader } from '../_components/act-workspace-page-header';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getActResearchInitiative } from '@/lib/services/act-research';
import { BenchmarkReview } from './benchmark-review';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const PHASES = [
  ['Benchmark', 'Build reviewed cases from real ACT projects and deliberately invalid opportunities.'],
  ['Local baseline', 'Measure official feeds and open-source retrieval before paying external providers.'],
  ['Paid pilot', 'Compare Octen and other providers under fixed cost and quality caps.'],
  ['Network test', 'Run a bounded Bittensor testnet challenge with the same hidden evaluator.'],
  ['Community commons', 'Publish methods and govern improvements with participating communities.'],
];

function money(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

export default async function ActResearchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const [initiative, auth] = await Promise.all([
    getActResearchInitiative(),
    createSupabaseServer().then((client) => client.auth.getUser()),
  ]);
  if (!initiative) {
    return <main className="p-8">ACT Research Commons is not configured.</main>;
  }
  const user = auth.data.user;
  const reviewer = user && isAdminEmail(user.email)
    ? {
        name: typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === 'string'
            ? user.user_metadata.name
            : user.email?.split('@')[0] || 'ACT reviewer',
        email: user.email || 'No email',
        mode: 'authenticated' as const,
      }
    : process.env.NODE_ENV !== 'production' && !user
      ? {
          name: 'A Curious Tractor local reviewer',
          email: 'local-reviewer@act.place',
          mode: 'local-development' as const,
        }
      : null;

  const spendPct = initiative.budget_cap_aud > 0
    ? Math.min(100, Math.round((initiative.spend_to_date_aud / initiative.budget_cap_aud) * 100))
    : 0;

  return (
    <main className="min-h-screen bg-[var(--ws-surface-0)]">
      <ActWorkspacePageHeader
        eyebrow="ACT Research Commons"
        title={initiative.title}
        description="Small, reversible experiments for community-serving opportunity intelligence."
        meta={<div className="font-mono text-[10px] uppercase tracking-widest">{initiative.status} · phase {initiative.current_phase}/5</div>}
      />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 border-b border-[var(--ws-border)] pb-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h2 className="text-lg font-semibold">Purpose</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ws-text-secondary)]">{initiative.purpose}</p>
            <h3 className="mt-6 text-sm font-semibold">Community benefit commitment</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ws-text-secondary)]">{initiative.community_benefit_commitment}</p>
          </div>
          <div className="border-l-4 border-[#183426] bg-white p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-secondary)]">Research budget, not investment capital</div>
            <div className="mt-2 text-3xl font-semibold">{money(initiative.spend_to_date_aud)} <span className="text-base text-[var(--ws-text-secondary)]">/ {money(initiative.budget_cap_aud)}</span></div>
            <div className="mt-4 h-2 bg-[var(--ws-surface-2)]"><div className="h-full bg-[#183426]" style={{ width: `${spendPct}%` }} /></div>
            <p className="mt-4 text-xs leading-5 text-[var(--ws-text-secondary)]">No token purchase, staking or speculative exposure is authorised by this budget.</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Five-stage path</h2>
          <div className="mt-4 grid gap-px overflow-hidden border border-[var(--ws-border)] bg-[var(--ws-border)] md:grid-cols-5">
            {PHASES.map(([title, detail], index) => (
              <div key={title} className={index + 1 === initiative.current_phase ? 'bg-[#eef2ba] p-4' : 'bg-white p-4'}>
                <div className="font-mono text-[10px] uppercase tracking-widest">0{index + 1}</div>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">ACT opportunity benchmark</h2>
              <p className="mt-1 text-sm text-[var(--ws-text-secondary)]">This week shows at most 12 cases: four each from Goods/commercial, community-partner and arts/cultural lanes, then portfolio fill. Confirmed labels stay separate from candidates.</p>
            </div>
            <div className="font-mono text-xs">{initiative.benchmark.confirmed}/{initiative.benchmark.total} confirmed</div>
          </div>
          <div className="mt-4 grid gap-px border border-[var(--ws-border)] bg-[var(--ws-border)] sm:grid-cols-4">
            {[
              ['Confirmed', initiative.benchmark.confirmed],
              ['Pending', initiative.benchmark.pending],
              ['Relevant', initiative.benchmark.relevant],
              ['Not relevant', initiative.benchmark.notRelevant],
            ].map(([label, value]) => (
              <div key={label} className="bg-white p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-secondary)]">{label}</div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto border border-[var(--ws-border)] bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--ws-border)] bg-[var(--ws-surface-2)] font-mono text-[10px] uppercase tracking-widest">
                <tr><th className="p-3">Active project</th><th className="p-3">Confirmed</th><th className="p-3">Relevant</th><th className="p-3">Not relevant</th><th className="p-3">Pending</th><th className="p-3">Readiness</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--ws-border)]">
                {initiative.benchmark.coverage.map((item) => (
                  <tr key={item.projectCode}>
                    <td className="p-3"><div className="font-semibold">{item.projectName}</div><div className="font-mono text-[10px] text-[var(--ws-text-secondary)]">{item.projectCode}</div></td>
                    <td className="p-3 tabular-nums">{item.confirmed}/{item.target}</td>
                    <td className="p-3 tabular-nums">{item.relevant}</td>
                    <td className="p-3 tabular-nums">{item.notRelevant}</td>
                    <td className="p-3 tabular-nums">{item.pending}</td>
                    <td className="p-3"><span className={item.balanced ? 'bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900' : 'bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950'}>{item.balanced ? 'Balanced baseline' : `${item.shortfall} labels needed`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">A project is marked balanced only after 20 confirmed human labels with at least five relevant and five not-relevant examples. Pending candidates do not count as model truth.</p>
          <div className="mt-4">
            <BenchmarkReview
              initialCases={initiative.benchmark.pendingCases}
              initialConfirmed={initiative.benchmark.confirmed}
              total={initiative.benchmark.total}
              reviewer={reviewer}
              weeklyRemaining={initiative.benchmark.weeklyRemaining}
              weeklyLimit={initiative.benchmark.weeklyLimit}
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Experiment portfolio</h2>
          <div className="mt-4 overflow-x-auto border border-[var(--ws-border)] bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[var(--ws-border)] bg-[var(--ws-surface-2)] font-mono text-[10px] uppercase tracking-widest">
                <tr><th className="p-3">Experiment</th><th className="p-3">Provider</th><th className="p-3">State</th><th className="p-3">Cap</th><th className="p-3">Evidence</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--ws-border)]">
                {initiative.experiments.map((experiment) => (
                  <tr key={experiment.id}>
                    <td className="p-3"><div className="font-semibold">{experiment.name}</div><div className="mt-1 max-w-xl text-xs text-[var(--ws-text-secondary)]">{experiment.hypothesis}</div></td>
                    <td className="p-3 font-mono text-xs">{experiment.provider}</td>
                    <td className="p-3">{experiment.status}</td>
                    <td className="p-3 tabular-nums">{money(experiment.budget_cap_aud)}</td>
                    <td className="p-3 text-xs">{experiment.sample_size ? `${experiment.sample_size} cases` : 'Not run'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold">Governance</h2>
            <ul className="mt-3 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
              {initiative.governance_principles.map((principle) => <li key={principle} className="py-3 text-sm">{principle}</li>)}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Stop conditions</h2>
            <ul className="mt-3 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
              {initiative.stop_conditions.map((condition) => <li key={condition} className="py-3 text-sm text-[var(--ws-text-secondary)]">{condition}</li>)}
            </ul>
          </div>
        </section>

        <section className="border-l-4 border-[#d6a329] bg-white p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-text-secondary)]">Next decision</div>
          <p className="mt-2 text-sm font-semibold leading-6">{initiative.next_decision}</p>
        </section>
      </div>
    </main>
  );
}
