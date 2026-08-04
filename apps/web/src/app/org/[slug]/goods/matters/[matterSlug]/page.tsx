import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import {
  getGoodsCapitalWorkspace,
  matterBySlug,
  matterRoute,
  money,
} from '@/lib/services/goods-capital-workspace';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  DataModeBanner,
  formatWorkspaceDate,
  GoodsWorkspaceHeader,
  PrimaryLink,
  SectionTitle,
  StatusPill,
} from '../../_components/goods-capital-ui';
import { GoodsMatterReviewForm } from '../../_components/goods-matter-review-form';

export const dynamic = 'force-dynamic';

export default async function GoodsMatterPage({ params }: { params: Promise<{ slug: string; matterSlug: string }> }) {
  const { slug, matterSlug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const workspace = await getGoodsCapitalWorkspace();
  const matter = matterBySlug(workspace, matterSlug);
  if (!matter) notFound();
  const route = matterRoute(workspace, matter);
  const application = route ? workspace.applications.find((item) => item.route.id === route.id) ?? null : null;
  const dossier = workspace.dossiers.find((item) => item.matter.id === matter.id) ?? null;
  const decisions = workspace.decisions.filter((decision) => decision.sourceRef === matter.slug);
  const latestDecision = decisions[0] ?? null;
  const events = workspace.events.filter((event) => event.decisionId && decisions.some((decision) => decision.id === event.decisionId));

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="matters"
        eyebrow="Matter room"
        title={matter.counterpartyName}
        description={matter.title}
        aside={route ? (
          <div className="border-4 border-white bg-white px-4 py-3 text-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Capital target</div>
            <div className="mt-1 text-3xl font-black tabular-nums">{money(route.targetAmountAud)}</div>
            <div className="mt-1 text-[10px] font-bold text-bauhaus-muted">Committed {money(route.commitmentAmountAud && ['accepted', 'fulfilled'].includes(route.commitmentState) ? route.commitmentAmountAud : 0)}</div>
          </div>
        ) : undefined}
      />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataModeBanner warning={workspace.dataWarning} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-5">
            <section className="border-4 border-bauhaus-black bg-white p-5">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="info">{matter.state}</StatusPill>
                {route ? <StatusPill>{route.routeType.replaceAll('_', ' ')}</StatusPill> : <StatusPill tone="warn">Campaign rule</StatusPill>}
                {route ? <StatusPill tone={route.eligibilityState === 'eligible' ? 'good' : route.eligibilityState === 'ineligible' ? 'bad' : 'warn'}>Eligibility {route.eligibilityState}</StatusPill> : null}
                {route ? <StatusPill tone={route.matchAssessment === 'eligible' ? 'good' : route.matchAssessment === 'ineligible' ? 'bad' : 'warn'}>QBE {route.matchAssessment}</StatusPill> : null}
              </div>
              <h2 className="mt-4 text-2xl font-black">{matter.title}</h2>
              <p className="mt-2 text-sm leading-6 text-bauhaus-muted">{matter.purpose}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="border-2 border-bauhaus-black bg-link-light p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Why this is active</div>
                  <p className="mt-2 text-sm leading-6">{matter.whyNow ?? 'No trigger recorded.'}</p>
                </div>
                <div className="border-2 border-bauhaus-black bg-bauhaus-yellow p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest">Next learning question</div>
                  <p className="mt-2 text-sm leading-6">{matter.currentLearningQuestion ?? 'No question recorded.'}</p>
                </div>
              </div>
            </section>

            {route ? (
              <section className="border-4 border-bauhaus-black bg-white p-5">
                <SectionTitle title="Route facts" description="Application state, commitment state and match assessment describe different facts." action={<PrimaryLink href={`/org/${slug}/goods/applications/${route.routeCode}`}>Open application room</PrimaryLink>} />
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Named route', route.namedRoute ?? 'Not verified'],
                    ['Instrument', route.instrumentLabel ?? 'Unknown'],
                    ['Legal recipient', route.legalRecipientName ?? 'Unknown'],
                    ['Application state', route.applicationState.replaceAll('_', ' ')],
                    ['Ask actually made', route.askMadeAt ? formatWorkspaceDate(route.askMadeAt) : 'Not evidenced'],
                    ['Decision due', formatWorkspaceDate(route.decisionDueAt)],
                    ['Commitment', `${route.commitmentState} · ${money(route.commitmentAmountAud)}`],
                    ['Commitment evidence', route.commitmentEvidenceRef ?? route.commitmentEvidenceForm],
                  ].map(([label, value]) => (
                    <div key={label} className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas p-3">
                      <dt className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</dt>
                      <dd className="mt-1 text-sm font-bold leading-5">{value}</dd>
                    </div>
                  ))}
                </dl>
                {route.nextAction ? (
                  <div className="mt-4 border-l-4 border-bauhaus-blue bg-link-light px-4 py-3 text-sm leading-6">
                    <strong>Owned next action:</strong> {route.nextAction}<br />
                    <span className="text-xs text-bauhaus-muted">{route.nextActionOwner ?? 'No owner'} · due {formatWorkspaceDate(route.nextActionDue)}</span>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="border-4 border-bauhaus-black bg-white p-5">
              <SectionTitle title="Evidence and unknowns" description="Every public claim stays attached to its source and review date." />
              {dossier?.officialEvidence.length ? (
                <div className="space-y-3">
                  {dossier.officialEvidence.map((item) => (
                    <article key={`${item.url}-${item.label}`} className="border-2 border-bauhaus-black p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={item.url} target="_blank" rel="noreferrer" className="font-black text-bauhaus-blue underline">{item.label} ↗</a>
                        <StatusPill tone="good">Checked {formatWorkspaceDate(item.checkedAt)}</StatusPill>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-bauhaus-muted">{item.detail}</p>
                    </article>
                  ))}
                </div>
              ) : <p className="text-sm text-bauhaus-muted">No official evidence is linked yet.</p>}
              <div className="mt-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Still unknown or contested</div>
                <ul className="mt-2 space-y-2">
                  {Array.from(new Set([...matter.evidenceGaps, ...(route?.evidenceGaps ?? [])])).map((gap) => (
                    <li key={gap} className="flex gap-2 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950"><span aria-hidden="true">?</span><span>{gap}</span></li>
                  ))}
                </ul>
              </div>
            </section>

            {application ? (
              <section className="border-4 border-bauhaus-black bg-white p-5">
                <SectionTitle title="Application readiness" description={`${application.readyGateCount} of ${application.gates.length} hard gates pass. A thematic fit cannot override a blocked gate.`} />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {application.gates.map((gate) => (
                    <div key={gate.key} className={`border-2 p-3 ${gate.state === 'pass' ? 'border-emerald-300 bg-emerald-50' : gate.state === 'blocked' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                      <StatusPill tone={gate.state === 'pass' ? 'good' : gate.state === 'blocked' ? 'bad' : 'warn'}>{gate.state}</StatusPill>
                      <div className="mt-2 text-xs font-black uppercase tracking-wider">{gate.label}</div>
                      <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{gate.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="border-4 border-bauhaus-black bg-white p-5">
              <SectionTitle title="Decision and episode memory" description="New human reads supersede earlier judgments without deleting them." />
              {decisions.length === 0 && events.length === 0 ? (
                <p className="text-sm leading-6 text-bauhaus-muted">No human read has been appended for this matter yet.</p>
              ) : (
                <div className="space-y-3">
                  {decisions.map((decision) => (
                    <article key={decision.id} className="border-l-4 border-bauhaus-blue bg-link-light px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2"><StatusPill tone="info">{decision.judgment.nextMove ?? decision.decision}</StatusPill><span className="text-[10px] text-bauhaus-muted">{formatWorkspaceDate(decision.createdAt)}</span></div>
                      <p className="mt-2 text-sm leading-6">{decision.judgment.whatChanged ?? decision.reason ?? 'No material-delta note.'}</p>
                      {decision.judgment.nextLearningQuestion ? <p className="mt-1 text-xs text-bauhaus-muted"><strong>Next question:</strong> {decision.judgment.nextLearningQuestion}</p> : null}
                    </article>
                  ))}
                  {events.map((event) => (
                    <article key={event.id} className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{event.signalKind} · {formatWorkspaceDate(event.happenedAt)}</div>
                      <div className="mt-1 text-sm font-black">{event.title}</div>
                      <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{event.summary}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <GoodsMatterReviewForm slug={slug} matter={matter} route={route} orgProfileId={profile.id} latestDecision={latestDecision} />
            <Link href={`/org/${slug}/goods/matters`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center border-2 border-bauhaus-black bg-white px-4 text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-canvas">← All matters</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
