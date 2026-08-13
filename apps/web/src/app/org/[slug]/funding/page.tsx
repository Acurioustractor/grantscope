import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectFundingPortfolio } from '@/lib/services/project-funding-service';
import { getLatestFundingWeeklyDigest } from '@/lib/services/funding-weekly-digest';
import { getFundingOperatingReport } from '@/lib/services/funding-operating-report';
import { PursueFundingForm } from './pursue-funding-form';
import { CorrectionForm } from './correction-form';

export const dynamic = 'force-dynamic';

function money(value: number | null): string {
  return value == null ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

export default async function FundingPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ project?: string; q?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [portfolio, digest, report] = await Promise.all([getProjectFundingPortfolio(slug), getLatestFundingWeeklyDigest(slug), getFundingOperatingReport()]);
  if (!portfolio) notFound();

  const query = sp.q?.trim().toLocaleLowerCase('en-AU');
  const selectedProfile = sp.project ? portfolio.profiles.find(profile => profile.projectSlug === sp.project) : null;
  const queue = portfolio.weeklyQueue.filter(item => {
    if (sp.project && item.projectSlug !== sp.project) return false;
    return !query || [item.opportunityName, item.funderName, item.projectName].some(value => value?.toLocaleLowerCase('en-AU').includes(query));
  });
  const ready = portfolio.profiles.filter(profile => profile.completeness === 'decision_ready').length;
  const unresolved = portfolio.profiles.reduce((sum, profile) => sum + profile.unresolvedDecisions.length, 0);
  const base = `/org/${slug}/funding`;

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <header className="border-b border-[#dbe4df] bg-white px-5 py-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f64]">ACT funding portfolio</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-3xl font-black tracking-tight">Funding control room</h1><p className="mt-1 text-sm text-[#64748b]">One review queue and one readiness standard across every project.</p></div>
            <div className="flex gap-2 text-xs font-semibold"><Link href={`/org/${slug}/pipeline`} className="rounded-md border border-[#cbd5e1] px-3 py-2">Pipeline</Link><Link href={`/org/${slug}/goods/grants`} className="rounded-md bg-[#183426] px-3 py-2 text-white">Goods inbox</Link></div>
          </div>
          <nav aria-label="Project scope" className="mt-5 flex gap-1 overflow-x-auto pb-1 text-xs font-semibold">
            <Link href={base} className={`shrink-0 rounded-md px-3 py-2 ${!sp.project ? 'bg-[#183426] text-white' : 'bg-[#f1f5f9]'}`}>All projects</Link>
            {portfolio.profiles.map(profile => <Link key={profile.projectId} href={`${base}?project=${profile.projectSlug}`} className={`shrink-0 rounded-md px-3 py-2 ${sp.project === profile.projectSlug ? 'bg-[#183426] text-white' : 'bg-[#f1f5f9]'}`}>{profile.projectName}</Link>)}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 lg:px-10">
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#cbd5e1] bg-[#cbd5e1] lg:grid-cols-4">
          <Metric label="Decision queue" value={`${portfolio.weeklyQueue.length}/5`} />
          <Metric label="Profiles ready" value={`${ready}/${portfolio.profiles.length}`} />
          <Metric label="Unresolved facts" value={String(unresolved)} />
          <Metric label="Decisions this week" value={String(digest?.metrics.decisionsThisWeek ?? 0)} />
        </section>

        <section aria-labelledby="weekly-report-title" className="rounded-md border border-[#b8d2c5] bg-white">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dbe4df] px-5 py-4">
            <div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f64]">Weekly operating report</p><h2 id="weekly-report-title" className="mt-1 text-xl font-black">What changed and what needs attention</h2></div>
            <time className="font-mono text-[10px] text-[#64748b]" dateTime={report.generatedAt}>Updated {new Date(report.generatedAt).toLocaleString('en-AU')}</time>
          </div>
          <div className="grid gap-px bg-[#dbe4df] lg:grid-cols-3">
            <ReportColumn title="This week">
              <ReportLine value={report.newOpportunities} label="new opportunities discovered" />
              <ReportLine value={report.promotedThisWeek} label="promoted into a working system" />
              <ReportLine value={report.dismissedThisWeek} label="dismissed with learning recorded" />
              <ReportLine value={report.sourceHealth.stale + report.sourceHealth.failed} label="sources needing attention" warn={report.sourceHealth.stale + report.sourceHealth.failed > 0} />
            </ReportColumn>
            <ReportColumn title={`Upcoming deadlines · ${report.deadlines.length}`}>
              {report.deadlines.slice(0, 5).map(item => <Link key={item.id} href={`/org/${slug}/goods/grants?q=${encodeURIComponent(item.name)}`} className="block border-t border-[#e2e8f0] py-2 first:border-0"><strong className="block text-sm">{item.name}</strong><span className="text-xs text-[#64748b]">{item.days}d · {item.provider || 'Provider unknown'}{item.score != null ? ` · fit ${item.score}` : ''}</span></Link>)}
              {!report.deadlines.length && <p className="text-sm text-[#64748b]">No verified deadline in the next 60 days.</p>}
            </ReportColumn>
            <ReportColumn title={`Overdue relationships · ${report.overdueRelationships.length}`}>
              {report.overdueRelationships.slice(0, 5).map(item => <Link key={item.id} href={`/org/${slug}/goods/network?q=${encodeURIComponent(item.name)}`} className="block border-t border-[#e2e8f0] py-2 first:border-0"><strong className="block text-sm">{item.name}</strong><span className="line-clamp-1 text-xs text-[#64748b]">{item.daysOverdue}d overdue · {item.action}</span></Link>)}
              {!report.overdueRelationships.length && <p className="text-sm text-[#64748b]">No overdue relationship action.</p>}
            </ReportColumn>
          </div>
          <details className="border-t border-[#dbe4df]"><summary className="cursor-pointer px-5 py-3 text-xs font-bold uppercase tracking-wider">What dismissal decisions are teaching us</summary><div className="flex flex-wrap gap-2 border-t border-[#e2e8f0] px-5 py-4">{report.dismissalReasons.map(item => <span key={item.reason} className="rounded bg-[#f1f5f9] px-3 py-2 text-xs"><strong>{item.count}</strong> · {item.reason}</span>)}{!report.dismissalReasons.length && <span className="text-sm text-[#64748b]">No dismissal learning has been recorded in the last 30 days.</span>}</div></details>
        </section>

        <section aria-labelledby="queue-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 id="queue-title" className="text-xl font-black">{selectedProfile ? `${selectedProfile.projectName} decisions` : 'Portfolio decisions'}</h2><p className="mt-1 text-sm text-[#64748b]">Evidence-safe opportunities awaiting a human decision.</p></div>
            <form action={base} className="flex gap-2">{sp.project && <input type="hidden" name="project" value={sp.project} />}<input name="q" defaultValue={sp.q} placeholder="Search queue" className="min-h-10 w-48 rounded-md border border-[#94a3b8] px-3 text-sm" /><button className="rounded-md bg-[#183426] px-3 text-xs font-bold text-white">Search</button></form>
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-[#cbd5e1] bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#183426] text-left text-[10px] font-bold uppercase tracking-wider text-white"><tr><th className="px-4 py-3">Due</th><th className="px-4 py-3">Opportunity</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Fit</th><th className="px-4 py-3">Maximum</th><th className="px-4 py-3">Decision</th></tr></thead>
              <tbody>{queue.map(item => <tr key={`${item.projectCode}-${item.opportunityId}`} className="border-t border-[#e2e8f0] align-top">
                <td className="px-4 py-4 font-mono text-xs"><strong>{item.daysRemaining}d</strong><span className="mt-1 block text-[#64748b]">{new Date(item.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span></td>
                <td className="max-w-md px-4 py-4"><strong>{item.opportunityName}</strong><span className="mt-1 block text-xs text-[#64748b]">{item.funderName || 'Funder not recorded'}</span></td>
                <td className="px-4 py-4"><Link href={`/org/${slug}/${item.projectSlug}/funding`} className="font-semibold text-[#1f734f] hover:underline">{item.projectName}</Link></td>
                <td className="px-4 py-4 font-mono font-bold">{item.fitScore}</td><td className="px-4 py-4 font-semibold">{money(item.maxAmount)}</td>
                <td className="w-64 px-4 py-3"><PursueFundingForm projectCode={item.projectCode} opportunityId={item.opportunityId} projectSlug={item.projectSlug} orgSlug={slug} /><CorrectionForm projectCode={item.projectCode} opportunityId={item.opportunityId} opportunityName={item.opportunityName} /></td>
              </tr>)}{queue.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#64748b]">No decision in the bounded queue matches this scope.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="readiness-title">
          <div><h2 id="readiness-title" className="text-xl font-black">Project readiness</h2><p className="mt-1 text-sm text-[#64748b]">The facts required before matching and applicant-route claims can be trusted.</p></div>
          <div className="mt-4 overflow-x-auto rounded-md border border-[#cbd5e1] bg-white"><table className="w-full min-w-[720px] text-sm"><thead className="bg-[#f1f5f9] text-left text-[10px] font-bold uppercase tracking-wider"><tr><th className="px-4 py-3">Project</th><th className="px-4 py-3">Readiness</th><th className="px-4 py-3">Entities</th><th className="px-4 py-3">Funding blocks</th><th className="px-4 py-3">Open facts</th><th className="px-4 py-3"></th></tr></thead><tbody>{portfolio.profiles.map(profile => <tr key={profile.projectId} className="border-t border-[#e2e8f0]"><td className="px-4 py-4"><strong>{profile.projectName}</strong><span className="block font-mono text-[10px] text-[#64748b]">{profile.projectCode}</span></td><td className="px-4 py-4 capitalize">{profile.completeness.replace('_', ' ')}</td><td className="px-4 py-4 font-mono">{profile.entities}</td><td className="px-4 py-4 font-mono">{profile.fundingBlocks}</td><td className="px-4 py-4 font-mono">{profile.unresolvedDecisions.length}</td><td className="px-4 py-4 text-right"><Link href={`/org/${slug}/${profile.projectSlug}/funding`} className="font-semibold text-[#1f734f] hover:underline">Open project</Link></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-4"><div className="text-2xl font-black tabular-nums">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{label}</div></div>;
}

function ReportColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white p-5"><h3 className="mb-3 text-xs font-black uppercase tracking-wider text-[#475569]">{title}</h3>{children}</div>;
}

function ReportLine({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return <div className="flex items-baseline gap-2 border-t border-[#e2e8f0] py-2 first:border-0"><strong className={`font-mono text-lg ${warn ? 'text-[#b91c1c]' : ''}`}>{value}</strong><span className="text-xs text-[#64748b]">{label}</span></div>;
}
