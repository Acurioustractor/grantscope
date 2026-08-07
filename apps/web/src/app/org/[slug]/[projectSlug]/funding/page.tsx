import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectFundingPortfolio } from '@/lib/services/project-funding-service';
import { getProjectApplyNow, FUNDING_ROUTE_NOTE, type ApplyNowCandidate } from '@/lib/services/act-project-apply-now';

export const dynamic = 'force-dynamic';

function money(value: number | null): string {
  return value == null
    ? 'Amount not published'
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

/** The five factors behind the score, shown so the number can be argued with. */
function FactorBar({ candidate }: { candidate: ApplyNowCandidate }) {
  const factors = candidate.factors.filter((f) => f.score != null);
  if (factors.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] text-[#475569]">
      {factors.map((f) => (
        <span key={f.label} className="rounded bg-[#f1f5f9] px-2 py-1">
          {f.label} {f.score}
        </span>
      ))}
    </div>
  );
}

function CandidateCard({ candidate, showBestAvailable }: { candidate: ApplyNowCandidate; showBestAvailable?: boolean }) {
  return (
    <article className="rounded-xl border border-[#dbe4df] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {candidate.isStrongFit ? (
          <span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#166534]">Strong fit</span>
        ) : null}
        {/* Relative, and labelled as such. "Strong fit" is an absolute claim about
            the round; this only says it is the best this project has. */}
        {showBestAvailable && !candidate.isStrongFit && (candidate.projectRank ?? 99) <= 3 ? (
          <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#475569]">
            Best available · #{candidate.projectRank}
          </span>
        ) : null}
        {candidate.wonFunder ? (
          <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2563eb]">We have won from this funder</span>
        ) : null}
        {candidate.feedStatus === 'rolling' ? (
          <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#475569]">Rolling — no deadline</span>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg font-black">{candidate.name}</h3>
      <p className="mt-1 text-sm text-[#64748b]">
        {candidate.funderName || 'Funder not recorded'}
        {candidate.fitScore != null ? ` · fit ${candidate.fitScore}/100` : ''}
      </p>
      <FactorBar candidate={candidate} />
      <dl className="mt-4 grid gap-3 border-t border-[#e2e8f0] pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-[#64748b]">Closes</dt>
          <dd className="mt-1 font-black">
            {candidate.deadline
              ? new Date(candidate.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Open ongoing'}
          </dd>
          {candidate.daysRemaining != null ? (
            <dd className={`text-xs ${candidate.daysRemaining <= 14 ? 'text-[#b91c1c]' : 'text-[#1f734f]'}`}>
              {candidate.daysRemaining} days remaining
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-xs text-[#64748b]">Maximum</dt>
          <dd className="mt-1 font-black">{money(candidate.maxAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#64748b]">Last verified</dt>
          <dd className="mt-1 font-black">
            {candidate.verifiedAt ? new Date(candidate.verifiedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'Not recorded'}
          </dd>
        </div>
      </dl>
      {candidate.flags.length > 0 ? (
        <p className="mt-3 rounded-lg bg-[#fff7ed] p-3 text-xs leading-5 text-[#9a3412]">{candidate.flags.join(' · ')}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {candidate.applicationUrl ? (
          <a href={candidate.applicationUrl} target="_blank" rel="noreferrer" className="min-h-11 rounded-lg bg-[#183426] px-3 py-3 text-white hover:bg-[#2f8f64]">Apply ↗</a>
        ) : null}
        {candidate.sourceUrl ? (
          <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="min-h-11 rounded-lg border border-[#cbd5e1] px-3 py-3 hover:border-[#2f8f64]">Official source ↗</a>
        ) : null}
      </div>
    </article>
  );
}

export default async function FundingProfilePage({ params }: { params: Promise<{ slug: string; projectSlug: string }> }) {
  const { slug, projectSlug } = await params;
  const [portfolio, applyNow] = await Promise.all([
    getProjectFundingPortfolio(slug),
    getProjectApplyNow(projectSlug).catch(() => null),
  ]);
  const profile = portfolio?.profiles.find(item => item.projectSlug === projectSlug);
  if (!portfolio || !profile) notFound();

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-8 text-[#0f172a] lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href={`/org/${slug}/funding`} className="text-sm font-semibold text-[#1f734f] hover:underline">← Portfolio funding desk</Link>
        <div className="mt-5 rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="font-mono text-[11px] font-bold text-[#64748b]">{profile.projectCode} · {profile.profileVersion}</p><h1 className="mt-2 text-3xl font-black">{profile.projectName}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">{profile.description}</p></div>
            <span className="w-fit rounded-full bg-[#fef3c7] px-3 py-1.5 text-xs font-bold uppercase text-[#92400e]">{profile.completeness.replace('_', ' ')}</span>
          </div>
          <dl className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f1f8f5] p-4"><dt className="text-xs text-[#64748b]">Applicant entities</dt><dd className="mt-1 text-2xl font-black">{profile.entities}</dd></div><div className="rounded-xl bg-[#eff6ff] p-4"><dt className="text-xs text-[#64748b]">Funding blocks</dt><dd className="mt-1 text-2xl font-black">{profile.fundingBlocks}</dd></div><div className="rounded-xl bg-[#f8fafc] p-4"><dt className="text-xs text-[#64748b]">Geographies</dt><dd className="mt-1 text-2xl font-black">{profile.geographies.length}</dd></div></dl>
        </div>

        {/* Route first. Where grants are not the plan, an empty list below is the
            expected result — saying so stops it reading as a discovery failure and
            stops anyone "fixing" it by loosening the matcher. */}
        {applyNow?.fundingRoute && applyNow.fundingRoute !== 'grants' && applyNow.fundingRoute !== 'mixed' ? (
          <section className="mt-6 rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#475569]">
              How this project is funded · {applyNow.fundingRoute}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#334155]">
              {FUNDING_ROUTE_NOTE[applyNow.fundingRoute as keyof typeof FUNDING_ROUTE_NOTE]}
            </p>
          </section>
        ) : null}

        {/* The recommender's own open question. Better it asks than guesses — a
            fabricated ranking is what made the last queue untrustworthy. */}
        {applyNow?.nextQuestion ? (
          <section className="mt-6 rounded-2xl border border-[#b8d2c5] bg-[#183426] p-6 text-white">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7e4cc]">
              Blocking a confident ranking
            </p>
            <p className="mt-2 max-w-3xl text-base leading-7">{applyNow.nextQuestion}</p>
            <p className="mt-3 text-xs leading-5 text-[#dbe9e1]">
              Until this is answered the ranking below is a best guess on partial information.
              Answer it in the project registry and the next run will rank on it.
            </p>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">What must be resolved</h2>
          <p className="mt-1 text-sm text-[#64748b]">These gaps prevent the system from asserting direct eligibility.</p>
          <ol className="mt-4 grid gap-3">{profile.unresolvedDecisions.map((decision, index) => <li key={decision} className="flex gap-3 rounded-lg bg-[#fff7ed] p-4 text-sm leading-6"><span className="font-mono font-black text-[#9a3412]">{index + 1}</span><span>{decision}</span></li>)}</ol>
          {profile.unresolvedDecisions.length === 0 ? <p className="mt-4 rounded-lg bg-[#dcfce7] p-4 text-sm text-[#166534]">No unresolved profile decisions.</p> : null}
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Apply now</h2>
              <p className="mt-1 text-sm text-[#64748b]">
                Dated rounds for this project, soonest first.
                {applyNow ? ` ${applyNow.totalConsidered} verified opportunities considered.` : ''}
              </p>
              {/* An absence of highlights reads as "we found nothing", which is not
                  what it means. Say what it does mean. */}
              {applyNow?.noStrongFits ? (
                <p className="mt-3 max-w-3xl rounded-lg bg-[#f1f5f9] p-3 text-xs leading-5 text-[#475569]">
                  Nothing here clears the portfolio-wide strong-fit bar, so these are ranked
                  best-available for this project rather than flagged as strong. The rounds are real
                  and current; they score lower on theme, geography or eligibility than rounds the
                  bar was set for. Worth reading, worth a judgement call, not worth assuming.
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {applyNow?.dated.map((candidate) => <CandidateCard key={candidate.opportunityId} candidate={candidate} showBestAvailable={applyNow.noStrongFits} />)}
            {!applyNow?.dated.length ? (
              <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-[#64748b]">
                No dated round is currently open for this project. Rolling programs below have no deadline and can be approached any time.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-black">Always open</h2>
          <p className="mt-1 text-sm text-[#64748b]">Rolling programs with no published deadline, ranked by fit rather than urgency.</p>
          <div className="mt-4 grid gap-3">
            {applyNow?.rolling.map((candidate) => <CandidateCard key={candidate.opportunityId} candidate={candidate} showBestAvailable={applyNow.noStrongFits} />)}
            {!applyNow?.rolling.length ? (
              <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-[#64748b]">No rolling programs matched this project yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
