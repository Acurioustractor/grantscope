import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectFundingPortfolio } from '@/lib/services/project-funding-service';

export const dynamic = 'force-dynamic';

export default async function FundingProfilePage({ params }: { params: Promise<{ slug: string; projectSlug: string }> }) {
  const { slug, projectSlug } = await params;
  const portfolio = await getProjectFundingPortfolio(slug);
  const profile = portfolio?.profiles.find(item => item.projectSlug === projectSlug);
  if (!portfolio || !profile) notFound();
  const queue = portfolio.weeklyQueue.filter(item => item.projectCode === profile.projectCode);

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

        <section className="mt-6 rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">What must be resolved</h2>
          <p className="mt-1 text-sm text-[#64748b]">These gaps prevent the system from asserting direct eligibility.</p>
          <ol className="mt-4 grid gap-3">{profile.unresolvedDecisions.map((decision, index) => <li key={decision} className="flex gap-3 rounded-lg bg-[#fff7ed] p-4 text-sm leading-6"><span className="font-mono font-black text-[#9a3412]">{index + 1}</span><span>{decision}</span></li>)}</ol>
          {profile.unresolvedDecisions.length === 0 ? <p className="mt-4 rounded-lg bg-[#dcfce7] p-4 text-sm text-[#166534]">No unresolved profile decisions.</p> : null}
        </section>

        <section className="mt-6 rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">This week</h2><p className="mt-1 text-sm text-[#64748b]">Portfolio queue opportunities currently assigned to this project.</p>
          <div className="mt-4 grid gap-3">{queue.map(item => <article key={item.opportunityId} className="rounded-lg border border-[#e2e8f0] p-4"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><h3 className="font-black">{item.opportunityName}</h3><p className="mt-1 text-sm text-[#64748b]">{item.funderName} · project score {item.recommendationScore ?? item.fitScore}</p></div><span className="text-sm font-bold text-[#1f734f]">{item.daysRemaining} days</span></div><p className="mt-3 text-sm leading-6 text-[#475569]">{item.eligibilityReason}</p>{item.hybridScore != null ? <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] text-[#475569]"><span>hybrid {item.hybridScore.toFixed(1)}</span><span>lexical {(item.lexicalScore || 0).toFixed(2)}</span><span>semantic {(item.semanticScore || 0).toFixed(2)}</span></div> : null}</article>)}{queue.length === 0 ? <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-[#64748b]">No opportunity from this project is in the five-place portfolio queue this week.</p> : null}</div>
        </section>
      </div>
    </main>
  );
}
