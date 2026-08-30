import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectFundingPortfolio } from '@/lib/services/project-funding-service';
import { getLatestFundingWeeklyDigest } from '@/lib/services/funding-weekly-digest';
import { getFundingControlPlane } from '@/lib/services/funding-control-plane';
import { getFundingApplicantRegistry, toApplicantRouteOption } from '@/lib/services/funding-applicant-registry';
import { FUNDING_GHL_FIELDS, FUNDING_GHL_STAGES, getFundingGhlContractStatus } from '@/lib/services/funding-ghl-contract';
import { PursueFundingForm } from './pursue-funding-form';
import { CorrectionForm } from './correction-form';
import { FundingSystemReconcileButton } from './funding-system-reconcile-button';
import { ApplicantRegistryManager } from './applicant-registry-manager';
import { FundingGhlContractManager } from './funding-ghl-contract-manager';

export const dynamic = 'force-dynamic';

function money(value: number | null): string {
  return value == null ? 'Amount not published' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

export default async function ProjectFundingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [portfolio, digest, controlPlane, applicantRegistry, ghlContract] = await Promise.all([
    getProjectFundingPortfolio(slug),
    getLatestFundingWeeklyDigest(slug),
    getFundingControlPlane(slug),
    getFundingApplicantRegistry(slug),
    getFundingGhlContractStatus(),
  ]);
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
        {controlPlane ? (
          <section aria-labelledby="funding-system-title" className="overflow-hidden rounded-xl border border-[#183426] bg-[#183426] text-white shadow-sm">
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7e4cc]">Portfolio control plane</p>
                <h2 id="funding-system-title" className="mt-2 text-2xl font-black">One funding system across every project</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#dbe9e1]">GrantScope discovers and matches. GHL owns pursued relationships, stages, owners and next actions. Notion holds application writing. Supabase keeps the IDs and reconciliation trail aligned.</p>
              </div>
              <FundingSystemReconcileButton automaticActions={controlPlane.summary.automaticActions} />
            </div>
            <dl className="grid grid-cols-2 border-y border-[#365947] bg-[#10271b] sm:grid-cols-3 lg:grid-cols-10">
              {[
                ['Projects', controlPlane.summary.activeProjects],
                ['Profiles', `${controlPlane.summary.profileCoverage}/${controlPlane.summary.activeProjects}`],
                ['Compiled', `${controlPlane.summary.compiledProfiles}/${controlPlane.summary.activeProjects}`],
                ['Ready', controlPlane.summary.decisionReadyProfiles],
                ['Matches', controlPlane.summary.evidenceSafeMatches],
                ['Opportunities', controlPlane.summary.uniqueOpportunities],
                ['Historic wins', controlPlane.summary.historicalWins],
                ['GHL pursued', controlPlane.summary.ghlLinked],
                ['Notion briefs', controlPlane.summary.notionLinked],
                ['Review batches', controlPlane.summary.humanActions],
              ].map(([label, value]) => (
                <div key={label} className="border-r border-b border-[#365947] p-3 last:border-r-0 sm:p-4">
                  <dt className="font-mono text-[9px] uppercase tracking-wide text-[#b7c8be]">{label}</dt>
                  <dd className="mt-1 text-lg font-black text-white">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-x-auto bg-white text-[#0f172a]">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-[#dbe4df] bg-[#f1f8f5] text-[10px] uppercase tracking-wide text-[#475569]">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Profile</th>
                    <th className="px-4 py-3">Evidence-safe matches</th>
                    <th className="px-4 py-3">Historic wins</th>
                    <th className="px-4 py-3">GHL pursued</th>
                    <th className="px-4 py-3">Notion workspaces</th>
                    <th className="px-4 py-3">System batches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {controlPlane.projects.map(project => (
                    <tr key={project.projectId}>
                      <td className="px-4 py-3">
                        <Link href={`/org/${slug}/${project.projectSlug}/funding`} className="font-bold text-[#183426] hover:underline">{project.projectName}</Link>
                        <div className="font-mono text-[9px] text-[#64748b]">{project.projectCode || 'CODE REQUIRED'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${project.profileStatus === 'decision_ready' ? 'bg-[#dcfce7] text-[#166534]' : project.profileStatus === 'partial' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#e2e8f0] text-[#475569]'}`}>{project.profileStatus.replace('_', ' ')}</span>
                        <span className={`ml-2 text-[9px] font-bold uppercase ${project.compiled ? 'text-[#166534]' : 'text-[#b45309]'}`}>{project.compiled ? 'compiled' : 'compile pending'}</span>
                        {project.unresolvedDecisions ? <span className="ml-2 text-[#64748b]">{project.unresolvedDecisions} gaps</span> : null}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">{project.evidenceSafeMatches}</td>
                      <td className="px-4 py-3 font-mono font-bold">{project.historicalWins}</td>
                      <td className="px-4 py-3 font-mono font-bold">{project.ghlLinked}</td>
                      <td className="px-4 py-3 font-mono font-bold">{project.notionLinked}</td>
                      <td className="px-4 py-3">
                        <span className={project.attention ? 'font-bold text-[#b45309]' : 'font-bold text-[#166534]'}>{project.attention ? `${project.attention} batch${project.attention === 1 ? '' : 'es'}` : 'Aligned'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <section aria-labelledby="ghl-contract-title" className="overflow-hidden rounded-xl border border-[#183426] bg-[#183426] text-white shadow-sm">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7e4cc]">GHL operating contract</p>
              <h2 id="ghl-contract-title" className="mt-2 text-xl font-black">One governed Grants pipeline</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#dbe9e1]">Pursued funding carries a canonical project code, typed GrantScope source, applicant, native GHL owner, next action and Notion workspace. Legacy discovery records stay visible but cannot become governed handoffs through fuzzy matching.</p>
            </div>
            <FundingGhlContractManager ready={ghlContract.ready} />
          </div>
          <dl className="grid grid-cols-2 border-t border-[#365947] bg-[#10271b] sm:grid-cols-3 lg:grid-cols-7">
            {[
              ['Contract', ghlContract.ready ? 'Ready' : 'Needs repair'],
              ['Stages', `${FUNDING_GHL_STAGES.length - ghlContract.missingStages.length}/${FUNDING_GHL_STAGES.length}`],
              ['Identity fields', `${FUNDING_GHL_FIELDS.length - ghlContract.missingFields.length}/${FUNDING_GHL_FIELDS.length}`],
              ['Native owners', ghlContract.users.length],
              ['Governed pursued', ghlContract.metrics.governedHandoffs],
              ['Funder contacts', `${ghlContract.metrics.foundationLinksWithContact}/${ghlContract.metrics.projectFoundationLinks}`],
              ['Legacy unaligned', ghlContract.metrics.unalignedLegacy],
            ].map(([label, value]) => <div key={label} className="border-r border-b border-[#365947] p-4"><dt className="font-mono text-[9px] uppercase tracking-wide text-[#b7c8be]">{label}</dt><dd className="mt-1 text-lg font-black">{value}</dd></div>)}
          </dl>
          {!ghlContract.ready ? <div className="border-t border-[#365947] bg-[#fff7ed] p-4 text-xs leading-5 text-[#9a3412]">
            {ghlContract.error ? <p><strong>Connection:</strong> {ghlContract.error}</p> : null}
            {ghlContract.missingStages.length ? <p><strong>Missing stages:</strong> {ghlContract.missingStages.join(', ')}</p> : null}
            {ghlContract.missingFields.length ? <p><strong>Missing fields:</strong> {ghlContract.missingFields.join(', ')}</p> : null}
          </div> : null}
        </section>
        {applicantRegistry ? (
          <section aria-labelledby="applicant-registry-title" className="overflow-hidden rounded-xl border border-[#b8d2c5] bg-white shadow-sm">
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f64]">Canonical applicant registry</p>
                <h2 id="applicant-registry-title" className="mt-2 text-xl font-black">One legal route reused across the portfolio</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">Projects inherit a governed applicant contract. Opportunity-specific ABN, organisation-type and DGR requirements are checked again before any GHL write.</p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-[#f1f8f5] p-3"><dt className="text-[#64748b]">Verified entities</dt><dd className="mt-1 text-lg font-black">{applicantRegistry.summary.verifiedEntities}/{applicantRegistry.summary.entities}</dd></div>
                <div className="rounded bg-[#f1f8f5] p-3"><dt className="text-[#64748b]">Ready defaults</dt><dd className="mt-1 text-lg font-black">{applicantRegistry.summary.readyDefaultRoutes}/{applicantRegistry.summary.activeProjects}</dd></div>
                <div className="rounded bg-[#fff7ed] p-3"><dt className="text-[#9a3412]">DGR endorsed</dt><dd className="mt-1 text-lg font-black text-[#9a3412]">{applicantRegistry.summary.dgrEndorsedEntities}</dd></div>
              </dl>
            </div>
            <div className="overflow-x-auto border-t border-[#dbe4df]">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#64748b]"><tr><th className="px-4 py-3">Project</th><th className="px-4 py-3">Default applicant</th><th className="px-4 py-3">Legal ID</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">DGR</th><th className="px-4 py-3">Guardrail</th></tr></thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {applicantRegistry.routes.filter(route => route.isDefault).map(route => <tr key={route.id}>
                    <td className="px-4 py-3"><Link href={`/org/${slug}/${route.projectSlug}/funding`} className="font-bold text-[#183426] hover:underline">{route.projectName}</Link><div className="font-mono text-[9px] text-[#64748b]">{route.projectCode}</div></td>
                    <td className="px-4 py-3 font-bold">{route.entity.name}</td>
                    <td className="px-4 py-3 font-mono">{route.entity.abn ? `ABN ${route.entity.abn}` : 'ABN missing'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${route.status === 'ready' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef3c7] text-[#92400e]'}`}>{route.routeType} · {route.status}</span></td>
                    <td className="px-4 py-3 font-bold uppercase text-[#92400e]">{route.entity.dgrStatus.replace('_', ' ')}</td>
                    <td className="max-w-sm px-4 py-3 text-[#64748b]">{route.constraints[0] || 'Opportunity eligibility still requires review.'}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <ApplicantRegistryManager
              entities={applicantRegistry.entities.map(entity => ({ id: entity.id, name: entity.name, verificationStatus: entity.verificationStatus, dgrStatus: entity.dgrStatus }))}
              projects={[...new Map(applicantRegistry.routes.map(route => [route.projectCode, { code: route.projectCode, name: route.projectName }])).values()]}
            />
          </section>
        ) : null}
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
            {portfolio.weeklyQueue.map((item, index) => {
              const routeEvidence = {
                ...(item.eligibilityEvidence || {}),
                eligibility_decision: item.eligibilityDecision,
                profile_completeness: item.profileCompleteness,
              };
              const applicantRoutes = (applicantRegistry?.routes || [])
                .filter(route => route.projectCode === item.projectCode)
                .map(route => toApplicantRouteOption(route, routeEvidence));
              return <article key={item.opportunityId} className="rounded-xl border border-[#dbe4df] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
                    <PursueFundingForm projectCode={item.projectCode} opportunityId={item.opportunityId} projectSlug={item.projectSlug} orgSlug={slug} applicantRoutes={applicantRoutes} ghlUsers={ghlContract.ready ? ghlContract.users : []} />
                    <CorrectionForm projectCode={item.projectCode} opportunityId={item.opportunityId} opportunityName={item.opportunityName} />
                  </div>
                  <dl className="rounded-lg bg-[#f1f8f5] p-4 text-sm">
                    <dt className="text-xs text-[#64748b]">Deadline</dt>
                    <dd className="mt-1 font-black">{new Date(item.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
                    <dd className="text-xs text-[#1f734f]">{item.daysRemaining} days remaining</dd>
                    <dt className="mt-4 text-xs text-[#64748b]">Maximum</dt>
                    <dd className="mt-1 font-black">{money(item.maxAmount)}</dd>
                  </dl>
                </div>
              </article>;
            })}
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
