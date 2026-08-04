import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getGoodsCapitalWorkspace, money } from '@/lib/services/goods-capital-workspace';
import {
  getGoodsNetworkSnapshot,
  goodsInterestEvidenceLabel,
  goodsNetworkLaneLabel,
  type GoodsInterestEvidenceForm,
  type GoodsNetworkLane,
} from '@/lib/services/goods-network-people';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  DataModeBanner,
  formatWorkspaceDate,
  GoodsWorkspaceHeader,
  Metric,
  SectionTitle,
  StatusPill,
} from '../_components/goods-capital-ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Network', description: 'Evidence-backed people, capital and production pathways for GOODS.' };
}

function words(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceTone(form: GoodsInterestEvidenceForm): 'neutral' | 'good' | 'warn' | 'info' {
  if (form === 'direct_message' || form === 'program_participant') return 'good';
  if (form === 'user_reported') return 'warn';
  if (form === 'crm_contacted') return 'info';
  return 'neutral';
}

function laneTone(lane: GoodsNetworkLane): 'neutral' | 'good' | 'warn' | 'info' | 'dark' {
  if (lane === 'qbe_anchor') return 'dark';
  if (lane === 'capital') return 'good';
  if (lane === 'production') return 'info';
  if (lane === 'capability') return 'warn';
  return 'neutral';
}

export default async function GoodsNetworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const [workspace, network] = await Promise.all([
    getGoodsCapitalWorkspace(),
    getGoodsNetworkSnapshot(),
  ]);
  const withNamedRoute = workspace.dossiers.filter((dossier) => dossier.route?.namedRoute).length;
  const withOfficialEvidence = workspace.dossiers.filter((dossier) => dossier.officialEvidence.length > 0).length;
  const openPromises = workspace.dossiers.reduce((sum, dossier) => sum + dossier.openPromises.length, 0);
  const combinedWarning = [workspace.dataWarning, network.dataWarning].filter(Boolean).join(' ') || null;
  const directInbound = network.people.filter((person) => person.evidenceForm === 'direct_message').length;
  const researchedPathways = network.pathways.filter((pathway) => pathway.evidenceForm === 'public_research').length;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="network"
        eyebrow="People · capital · production · obligations"
        title="Network"
        description="The human and institutional pathways that can move GOODS toward the QBE raise—while keeping interest, an ask, a commitment and cash as four different facts."
      />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataModeBanner warning={combinedWarning} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Capital required" value={`${money(workspace.summary.needMinAud)}–${money(workspace.summary.needMaxAud)}`} detail="Five concrete GOODS uses" tone="blue" />
          <Metric label="Planning targets" value={money(workspace.summary.targetAud)} detail="Targets only; still unallocated" />
          <Metric label="Asks evidenced" value={money(workspace.summary.askMadeAud)} detail="A conversation is not an ask" tone="yellow" />
          <Metric label="Committed" value={money(workspace.summary.committedAud)} detail="Written, allocated commitments only" tone="dark" />
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Current human signals"
            title="People who have opened a door"
            description={`${network.people.length} people are attached to a specific pathway. ${directInbound} is direct inbound evidence; reported interest remains labelled as reported until the next conversation produces a concrete route.`}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {network.people.map((person) => (
              <article key={person.id} className="flex h-full flex-col border-4 border-bauhaus-black bg-white">
                <div className="border-b-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black">{person.name}</h2>
                      <p className="mt-1 text-xs font-bold leading-5 text-bauhaus-muted">{person.role ?? 'Role to confirm'}{person.organisation ? ` · ${person.organisation}` : ''}</p>
                    </div>
                    {person.linkedinUrl ? (
                      <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="shrink-0 border-2 border-bauhaus-black bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-link-light">
                        LinkedIn ↗
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone={evidenceTone(person.evidenceForm)}>{goodsInterestEvidenceLabel(person.evidenceForm)}</StatusPill>
                    <StatusPill tone={laneTone(person.lane)}>{goodsNetworkLaneLabel(person.lane)}</StatusPill>
                    <StatusPill>{words(person.stage)}</StatusPill>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">What is actually evidenced</div>
                    <p className="mt-1 text-sm leading-6">{person.summary}</p>
                  </div>
                  <div className="border-l-4 border-bauhaus-blue bg-link-light px-3 py-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-blue">How this helps QBE</div>
                    <p className="mt-1 text-xs leading-5">{person.qbeRelevance}</p>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Next move</div>
                    <p className="mt-1 text-xs font-bold leading-5">{person.nextAction ?? 'Set a specific next action.'}</p>
                  </div>
                  <div className="mt-auto border-t-2 border-bauhaus-black/15 pt-3">
                    <p className="text-[10px] leading-5 text-bauhaus-muted"><span className="font-black uppercase tracking-wider">Guardrail:</span> {person.guardrail}</p>
                    <p className="mt-1 text-[10px] text-bauhaus-muted">Last evidenced touch: {formatWorkspaceDate(person.lastContactedAt)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="QBE-aligned pathway map"
            title="What to move next"
            description={`${network.pathways.length} priority pathways are separated by what they can actually do. ${researchedPathways} are research-only and must not be described as interested.`}
          />
          <div className="border-4 border-bauhaus-black bg-white">
            {network.pathways.map((pathway, index) => (
              <article key={pathway.id} className={`grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(280px,0.8fr)] ${index > 0 ? 'border-t-2 border-bauhaus-black' : ''}`}>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={laneTone(pathway.lane)}>{goodsNetworkLaneLabel(pathway.lane)}</StatusPill>
                    <StatusPill tone={evidenceTone(pathway.evidenceForm)}>{goodsInterestEvidenceLabel(pathway.evidenceForm)}</StatusPill>
                  </div>
                  <h3 className="mt-2 text-sm font-black leading-5">{pathway.displayName}</h3>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-bauhaus-muted">{words(pathway.stage)} · {words(pathway.relationshipType)}</p>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence and fit</div>
                  <p className="mt-1 text-xs leading-5">{pathway.evidenceSummary}</p>
                  <p className="mt-2 text-xs leading-5 text-bauhaus-blue"><span className="font-black">QBE:</span> {pathway.qbeRelevance}</p>
                  {pathway.officialEvidence.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {pathway.officialEvidence.map((item) => (
                        <a key={`${pathway.id}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" title={item.detail} className="text-[10px] font-black text-bauhaus-blue underline decoration-2 underline-offset-2">
                          {item.label} ↗
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="border-l-4 border-bauhaus-yellow bg-amber-50 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-amber-900">Next action{pathway.nextActionDue ? ` · ${formatWorkspaceDate(pathway.nextActionDue)}` : ''}</div>
                  <p className="mt-1 text-xs font-bold leading-5 text-amber-950">{pathway.nextAction ?? 'Set a next action.'}</p>
                  <p className="mt-2 text-[10px] leading-5 text-amber-900">{pathway.guardrail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Funder and expert theses"
            title="Evidence before approach"
            description={`${workspace.dossiers.length} bounded matters · ${withOfficialEvidence} officially sourced · ${withNamedRoute} named routes · ${openPromises} open returns. Use public material to prepare a better question, never to imply access or permission.`}
          />
          <div className="space-y-4">
            {workspace.dossiers.map((dossier) => {
              const { matter, route } = dossier;
              return (
                <article key={matter.id} className="border-4 border-bauhaus-black bg-white">
                  <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {dossier.catalogueThemes.map((theme) => <StatusPill key={theme} tone="info">{theme}</StatusPill>)}
                        {dossier.catalogueGeography ? <StatusPill>{dossier.catalogueGeography}</StatusPill> : null}
                      </div>
                      <h2 className="mt-3 text-xl font-black">{matter.counterpartyName}</h2>
                      <p className="mt-2 text-sm leading-6 text-bauhaus-muted">{matter.purpose}</p>
                      <div className="mt-4 border-l-4 border-bauhaus-blue bg-link-light px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Question to carry into the next conversation</div>
                        <p className="mt-1 text-sm leading-6">{matter.currentLearningQuestion ?? 'No next question recorded.'}</p>
                      </div>
                      {route ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="border-2 border-bauhaus-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Target</div><div className="mt-1 text-lg font-black">{money(route.targetAmountAud)}</div></div>
                          <div className="border-2 border-bauhaus-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Route</div><div className="mt-1 text-xs font-bold leading-5">{route.namedRoute ?? 'Not verified'}</div></div>
                          <div className="border-2 border-bauhaus-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Recipient</div><div className="mt-1 text-xs font-bold leading-5">{route.legalRecipientName ?? 'Unknown'}</div></div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Official evidence</div>
                          <span className="text-[10px] text-bauhaus-muted">Reviewed {formatWorkspaceDate(dossier.lastReviewedAt)}</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {dossier.officialEvidence.map((item) => (
                            <a key={`${item.url}-${item.label}`} href={item.url} target="_blank" rel="noreferrer" className="block border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-2 hover:bg-link-light">
                              <div className="text-xs font-black text-bauhaus-blue">{item.label} ↗</div>
                              <p className="mt-1 text-[11px] leading-5 text-bauhaus-muted">{item.detail}</p>
                            </a>
                          ))}
                          {dossier.officialEvidence.length === 0 ? <div className="border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">No current official source is attached.</div> : null}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Unknowns that block a responsible ask</div>
                        <ul className="mt-2 space-y-1.5">
                          {dossier.activeUnknowns.slice(0, 5).map((unknown) => <li key={unknown} className="flex gap-2 text-xs leading-5 text-bauhaus-muted"><span className="font-black text-amber-700">?</span><span>{unknown}</span></li>)}
                        </ul>
                      </div>

                      {dossier.openPromises.length > 0 ? (
                        <div className="border-2 border-red-300 bg-red-50 p-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-red-800">GOODS owes</div>
                          {dossier.openPromises.map((promise) => <p key={promise.id} className="mt-1 text-xs leading-5 text-red-900">{promise.summary}</p>)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-bauhaus-black bg-bauhaus-canvas px-5 py-3">
                    <div className="text-xs text-bauhaus-muted">Public evidence informs the brief. Human conversation creates understanding and commitment.</div>
                    <Link href={`/org/${slug}/goods/matters/${matter.slug}`} className="inline-flex min-h-11 items-center border-2 border-bauhaus-black bg-bauhaus-black px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue">Open matter</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
