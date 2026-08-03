import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectFundingPortfolio } from '@/lib/services/project-funding-service';
import { getLatestFundingWeeklyDigest } from '@/lib/services/funding-weekly-digest';
import { PursueFundingForm } from './pursue-funding-form';

export const dynamic = 'force-dynamic';

function money(value: number | null): string {
  return value == null ? 'Amount not published' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

export default async function ProjectFundingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [portfolio, digest] = await Promise.all([getProjectFundingPortfolio(slug), getLatestFundingWeeklyDigest(slug)]);
  if (!portfolio) notFound();

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <header className="border-b border-[#dbe4df] bg-white px-5 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f64]">Weekly funding desk</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Five decisions, not five hundred grants</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">Evidence-safe opportunities ranked across the whole ACT portfolio. Nothing here is promoted externally until you make a pursue decision.</p>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <Link href={`/org/${slug}/pipeline`} className="min-h-11 rounded-lg border border-[#cbd5e1] bg-white px-4 py-3 hover:border-[#2f8f64]">Open pipeline</Link>
              <Link href={`/org/${slug}?view=opportunities#opportunities`} className="min-h-11 rounded-lg bg-[#183426] px-4 py-3 text-white hover:bg-[#2f8f64]">Explore evidence</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:px-10">
        <section aria-labelledby="weekly-cycle-title" className="rounded-xl border border-[#b8d2c5] bg-[#183426] p-5 text-white shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_2fr]">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7e4cc]">Operating cycle</p>
              <h2 id="weekly-cycle-title" className="mt-2 text-xl font-black">{digest ? `Week of ${new Date(`${digest.weekStart}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : 'First weekly snapshot pending'}</h2>
              <p className="mt-2 text-sm leading-6 text-[#dbe9e1]">{digest ? `${digest.metrics.decisionsThisWeek} decisions this week · ${digest.metrics.queueSize}/5 queue places · ${digest.metrics.decisionReadyProfiles}/${digest.metrics.activeProfiles} project profiles ready` : 'The first in-app digest will persist the decision queue, source health and project readiness. It does not send anything externally.'}</p>
            </div>
            {digest ? <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#e7ef65]">Priority actions</h3>
              <ol className="mt-3 grid gap-2 text-sm text-[#f1f5f3]">{digest.priorityActions.map((action, index) => <li key={action} className="flex gap-3"><span className="font-mono text-[#e7ef65]">{index + 1}.</span><span>{action}</span></li>)}</ol>
            </div> : null}
          </div>
        </section>
        <section aria-labelledby="weekly-queue-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="weekly-queue-title" className="text-xl font-black">This week&apos;s decision queue</h2>
              <p className="mt-1 text-sm text-[#64748b]">{portfolio.weeklyQueue.length} of 5 places used · {portfolio.candidateCount} evidence-safe project matches considered</p>
            </div>
            <time className="hidden font-mono text-[10px] text-[#64748b] sm:block" dateTime={portfolio.generatedAt}>Generated {new Date(portfolio.generatedAt).toLocaleString('en-AU')}</time>
          </div>
          <div className="mt-4 grid gap-3">
            {portfolio.weeklyQueue.map((item, index) => (
              <article key={item.opportunityId} className="rounded-xl border border-[#dbe4df] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="grid gap-4 lg:grid-cols-[52px_minmax(0,1fr)_180px] lg:items-start">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#e7ef65] font-mono text-sm font-black text-[#183426]">{index + 1}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2563eb]">{item.projectName}</span>
                      <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9a3412]">Needs verification</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black">{item.opportunityName}</h3>
                    <p className="mt-1 text-sm text-[#64748b]">{item.funderName || 'Funder not recorded'} · fit {item.fitScore}/100</p>
                    <p className="mt-3 text-sm leading-6 text-[#475569]">{item.eligibilityReason}</p>
                    {item.hybridScore != null ? (
                      <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] text-[#475569]" aria-label="Hybrid retrieval signals">
                        <span className="rounded bg-[#f1f5f9] px-2 py-1">Hybrid {item.hybridScore.toFixed(1)}</span>
                        <span className="rounded bg-[#f1f5f9] px-2 py-1">Lexical {(item.lexicalScore || 0).toFixed(2)}</span>
                        <span className="rounded bg-[#f1f5f9] px-2 py-1">Semantic {(item.semanticScore || 0).toFixed(2)}</span>
                        <span className="rounded bg-[#f1f5f9] px-2 py-1">Project {item.recommendationScore || 0}</span>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                      <Link href={`/org/${slug}/${item.projectSlug}/funding`} className="min-h-11 rounded-lg border border-[#cbd5e1] px-3 py-3 hover:border-[#2f8f64]">Review project route</Link>
                      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="min-h-11 rounded-lg border border-[#cbd5e1] px-3 py-3 hover:border-[#2f8f64]">Official evidence ↗</a> : null}
                    </div>
                    <PursueFundingForm projectCode={item.projectCode} opportunityId={item.opportunityId} projectSlug={item.projectSlug} orgSlug={slug} />
                  </div>
                  <dl className="rounded-lg bg-[#f1f8f5] p-4 text-sm">
                    <dt className="text-xs text-[#64748b]">Deadline</dt>
                    <dd className="mt-1 font-black">{new Date(item.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
                    <dd className="text-xs text-[#1f734f]">{item.daysRemaining} days remaining</dd>
                    <dt className="mt-4 text-xs text-[#64748b]">Maximum</dt>
                    <dd className="mt-1 font-black">{money(item.maxAmount)}</dd>
                  </dl>
                </div>
              </article>
            ))}
            {portfolio.weeklyQueue.length === 0 ? <div className="rounded-xl border border-dashed border-[#94a3b8] bg-white p-8 text-sm text-[#475569]">No evidence-safe, undecided opportunities currently meet the weekly queue contract.</div> : null}
          </div>
        </section>

        <section aria-labelledby="profile-title">
          <h2 id="profile-title" className="text-xl font-black">Project funding readiness</h2>
          <p className="mt-1 text-sm text-[#64748b]">Every active project participates. Incomplete facts remain visible as work, not hidden as model confidence.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {portfolio.profiles.map(profile => (
              <Link key={profile.projectId} href={`/org/${slug}/${profile.projectSlug}/funding`} className="rounded-xl border border-[#dbe4df] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#2f8f64] hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] font-bold text-[#64748b]">{profile.projectCode}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${profile.completeness === 'decision_ready' ? 'bg-[#dcfce7] text-[#166534]' : profile.completeness === 'partial' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#e2e8f0] text-[#475569]'}`}>{profile.completeness.replace('_', ' ')}</span>
                </div>
                <h3 className="mt-3 text-lg font-black">{profile.projectName}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#64748b]">{profile.description}</p>
                <div className="mt-4 flex gap-4 border-t border-[#e2e8f0] pt-4 font-mono text-[10px] text-[#475569]">
                  <span>{profile.entities} entities</span><span>{profile.fundingBlocks} blocks</span><span>{profile.unresolvedDecisions.length} gaps</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
