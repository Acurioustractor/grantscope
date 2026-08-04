import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import {
  applicationByRouteCode,
  getGoodsCapitalWorkspace,
  money,
} from '@/lib/services/goods-capital-workspace';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  DataModeBanner,
  formatWorkspaceDate,
  GoodsWorkspaceHeader,
  SectionTitle,
  StatusPill,
} from '../../_components/goods-capital-ui';
import { GoodsRouteControls } from '../../_components/goods-route-controls';

export const dynamic = 'force-dynamic';

export default async function GoodsApplicationRoomPage({ params }: { params: Promise<{ slug: string; routeCode: string }> }) {
  const { slug, routeCode } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const workspace = await getGoodsCapitalWorkspace();
  const application = applicationByRouteCode(workspace, routeCode);
  if (!application) notFound();
  const { matter, route, gates, allocations } = application;
  const sourceUrl = route.officialSourceUrl ?? matter.officialSourceUrl;

  const artifacts = [
    { label: 'Two-page concept', ready: ['drafting', 'ready', 'submitted', 'due_diligence', 'decided'].includes(route.applicationState), detail: 'Plain-language problem, proposed use and funding route.' },
    { label: 'Full-cost budget', ready: allocations.length > 0, detail: 'Target is explicitly allocated to one or more GOODS capital blocks.' },
    { label: 'Eligibility evidence', ready: route.eligibilityState === 'eligible', detail: 'Legal recipient and every route condition are verified.' },
    { label: 'Community authority', ready: matter.authorityState === 'not_required' || ['evidenced', 'confirmed'].includes(matter.authorityState), detail: 'Any community or First Nations representation is linked to authority.' },
    { label: 'Written commitment', ready: ['letter', 'executed_agreement'].includes(route.commitmentEvidenceForm) && Boolean(route.commitmentEvidenceRef), detail: 'Amount, instrument, legal name and contact are on record.' },
    { label: 'Submission receipt', ready: Boolean(route.submittedAt), detail: 'Submission timestamp and receipt are attached.' },
  ];

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="applications"
        eyebrow="Application room"
        title={matter.counterpartyName}
        description={route.namedRoute ?? 'Named route not yet verified'}
        aside={(
          <div className="border-4 border-white bg-white px-4 py-3 text-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Target</div>
            <div className="mt-1 text-4xl font-black tabular-nums">{money(route.targetAmountAud)}</div>
            <div className="mt-1 text-[10px] font-bold text-bauhaus-muted">{route.askMadeAt ? `Asked ${formatWorkspaceDate(route.askMadeAt)}` : 'Target only · ask not evidenced'}</div>
          </div>
        )}
      />

      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <DataModeBanner warning={workspace.dataWarning} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-5">
            <section className="border-4 border-bauhaus-black bg-white p-5">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="info">{route.applicationState.replaceAll('_', ' ')}</StatusPill>
                <StatusPill tone={route.eligibilityState === 'eligible' ? 'good' : route.eligibilityState === 'ineligible' ? 'bad' : 'warn'}>Eligibility {route.eligibilityState}</StatusPill>
                <StatusPill tone={route.commitmentState === 'none' ? 'neutral' : ['letter', 'executed_agreement'].includes(route.commitmentEvidenceForm) ? 'good' : 'warn'}>Commitment {route.commitmentState}</StatusPill>
                <StatusPill tone={route.matchAssessment === 'eligible' ? 'good' : route.matchAssessment === 'ineligible' ? 'bad' : 'warn'}>QBE {route.matchAssessment}</StatusPill>
              </div>
              <h2 className="mt-4 text-2xl font-black">{matter.title}</h2>
              <p className="mt-2 text-sm leading-6 text-bauhaus-muted">{matter.purpose}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ['Instrument', route.instrumentLabel ?? 'Unknown'],
                  ['Legal recipient', route.legalRecipientName ?? 'Unknown'],
                  ['Recipient basis', route.legalRecipientBasis ?? 'Not recorded'],
                  ['Decision due', formatWorkspaceDate(route.decisionDueAt)],
                  ['GHL record', route.ghlOpportunityId ? `Linked · ${route.ghlOpportunityId}` : 'Not linked'],
                  ['Official source', sourceUrl ? 'Linked below' : 'Missing'],
                ].map(([label, value]) => (
                  <div key={label} className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas p-3"><dt className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</dt><dd className="mt-1 text-sm font-bold leading-5">{value}</dd></div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center border-2 border-bauhaus-black bg-white px-4 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:bg-link-light">Official source ↗</a> : null}
                {route.notionUrl ? <a href={route.notionUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center border-2 border-bauhaus-black bg-white px-4 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:bg-link-light">Working draft ↗</a> : null}
                {route.applicationUrl ? <a href={route.applicationUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center border-2 border-bauhaus-black bg-white px-4 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:bg-link-light">Application portal ↗</a> : null}
                <Link href={`/org/${slug}/goods/matters/${matter.slug}`} className="inline-flex min-h-11 items-center border-2 border-bauhaus-black bg-white px-4 text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-canvas">Relationship matter</Link>
              </div>
            </section>

            <section className="border-4 border-bauhaus-black bg-white p-5">
              <SectionTitle title="Six hard gates" description={`${application.readyGateCount} pass · ${application.blockedGateCount} blocked. A public thematic match cannot override a failed gate.`} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gates.map((gate) => (
                  <article key={gate.key} className={`border-2 p-3 ${gate.state === 'pass' ? 'border-emerald-300 bg-emerald-50' : gate.state === 'blocked' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                    <StatusPill tone={gate.state === 'pass' ? 'good' : gate.state === 'blocked' ? 'bad' : 'warn'}>{gate.state}</StatusPill>
                    <h3 className="mt-2 text-xs font-black uppercase tracking-wider">{gate.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{gate.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="border-4 border-bauhaus-black bg-white p-5">
              <SectionTitle title="Application artifacts" description="GrantScope holds status and evidence links. Working documents remain in Notion or Drive." />
              <div className="grid gap-2 sm:grid-cols-2">
                {artifacts.map((artifact) => (
                  <div key={artifact.label} className={`border-2 p-3 ${artifact.ready ? 'border-emerald-300 bg-emerald-50' : 'border-bauhaus-black/20 bg-bauhaus-canvas'}`}>
                    <div className="flex items-center justify-between gap-2"><div className="text-xs font-black">{artifact.label}</div><StatusPill tone={artifact.ready ? 'good' : 'neutral'}>{artifact.ready ? 'Present' : 'Needed'}</StatusPill></div>
                    <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{artifact.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-4 border-bauhaus-black bg-bauhaus-yellow p-5">
              <div className="text-[10px] font-black uppercase tracking-widest">Current next action</div>
              <p className="mt-2 text-sm leading-6">{route.nextAction ?? 'No owned action is recorded.'}</p>
              <p className="mt-2 text-xs text-bauhaus-muted">{route.nextActionOwner ?? 'No owner'} · due {formatWorkspaceDate(route.nextActionDue)}</p>
            </section>
          </div>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <div className="mb-3">
              <SectionTitle eyebrow="Human-controlled writes" title="Update this route" description="No outreach is sent. Every change remains a factual edit or explicit evidence record." />
            </div>
            <GoodsRouteControls slug={slug} route={route} blocks={workspace.blocks} allocations={allocations} />
          </aside>
        </div>
      </div>
    </main>
  );
}
