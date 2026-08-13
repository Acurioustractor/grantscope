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
import { GoodsViewToggle, resolveViewMode } from '../_components/goods-view-toggle';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Network', description: 'Evidence-backed people, capital and production pathways for GOODS.' };
}

function words(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normaliseName(value: string): string {
  return value.toLocaleLowerCase('en-AU').replace(/\b(the|foundation|trust|limited|ltd)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
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

export default async function GoodsNetworkPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const peopleView = resolveViewMode(sp.people);
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
  const query = typeof sp.q === 'string' ? sp.q.trim().toLocaleLowerCase('en-AU') : '';
  const relationshipView = typeof sp.relationship === 'string' ? sp.relationship : 'all';
  const relationshipRows = network.pathways.filter((pathway) => {
    const people = network.people.filter((person) => person.relationshipId === pathway.id);
    const isDesired = pathway.evidenceForm === 'public_research' || ['identified', 'researching'].includes(pathway.stage);
    if (relationshipView === 'active' && isDesired) return false;
    if (relationshipView === 'desired' && !isDesired) return false;
    if (relationshipView === 'capital' && !['qbe_anchor', 'capital', 'capability', 'support'].includes(pathway.lane)) return false;
    return !query || [pathway.displayName, pathway.evidenceSummary, pathway.qbeRelevance, pathway.nextAction, ...people.map(person => person.name)]
      .some(value => value?.toLocaleLowerCase('en-AU').includes(query));
  });
  const relationshipHref = (relationship?: string) => {
    const params = new URLSearchParams();
    if (relationship && relationship !== 'all') params.set('relationship', relationship);
    if (query) params.set('q', query);
    const suffix = params.toString();
    return suffix ? `/org/${slug}/goods/network?${suffix}` : `/org/${slug}/goods/network`;
  };

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
      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <DataModeBanner warning={combinedWarning} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Capital required" value={`${money(workspace.summary.needMinAud)}–${money(workspace.summary.needMaxAud)}`} detail="Five concrete GOODS uses" tone="blue" />
          <Metric label="Planning targets" value={money(workspace.summary.targetAud)} detail="Targets only; still unallocated" />
          <Metric label="Asks evidenced" value={money(workspace.summary.askMadeAud)} detail="A conversation is not an ask" tone="yellow" />
          <Metric label="Committed" value={money(workspace.summary.committedAud)} detail="Written, allocated commitments only" tone="dark" />
        </div>

        <section className="mt-8" aria-labelledby="relationship-portfolio-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle
              eyebrow="Relationship portfolio"
              title="Who can move the work"
              description="Current relationships and desired pathways, with the evidence, owner and next action kept separate from any funding claim."
            />
            <Link href={`/org/${slug}/funding`} className="border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase hover:bg-bauhaus-black hover:text-white">All-project funding</Link>
          </div>
          <div className="mt-4 border-4 border-bauhaus-black bg-white p-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {[['all', `All ${network.pathways.length}`], ['active', 'Working now'], ['desired', 'Want closer'], ['capital', 'Capital + philanthropy']].map(([value, label]) => (
                <Link key={value} href={relationshipHref(value)} className={`border-2 border-bauhaus-black px-2 py-1 font-black uppercase ${relationshipView === value ? 'bg-bauhaus-black text-white' : 'bg-white hover:bg-bauhaus-canvas'}`}>{label}</Link>
              ))}
            </div>
            <form action={`/org/${slug}/goods/network`} className="mt-3 flex gap-2">
              {relationshipView !== 'all' && <input type="hidden" name="relationship" value={relationshipView} />}
              <input name="q" defaultValue={typeof sp.q === 'string' ? sp.q : ''} placeholder="Search organisation, person, evidence or next action" className="min-h-10 min-w-0 flex-1 border-2 border-bauhaus-black px-3 text-sm" />
              <button className="border-2 border-bauhaus-black bg-bauhaus-black px-4 text-xs font-black uppercase text-white">Search</button>
            </form>
          </div>
          <div className="overflow-x-auto border-x-4 border-b-4 border-bauhaus-black bg-white">
            <table className="w-full min-w-[960px] text-xs">
              <thead className="bg-bauhaus-black text-left text-white"><tr>{['Organisation', 'Relationship', 'Evidence', 'Owner', 'Next action', 'Funding'].map(label => <th key={label} className="px-3 py-2 font-mono text-[9px] font-black uppercase tracking-widest">{label}</th>)}</tr></thead>
              <tbody>{relationshipRows.map((pathway, index) => {
                const owners = network.people.filter(person => person.relationshipId === pathway.id);
                const desired = pathway.evidenceForm === 'public_research' || ['identified', 'researching'].includes(pathway.stage);
                const dossier = workspace.dossiers.find(item => normaliseName(item.matter.counterpartyName).includes(normaliseName(pathway.displayName)) || normaliseName(pathway.displayName).includes(normaliseName(item.matter.counterpartyName)));
                const commitment = dossier?.route && ['accepted', 'fulfilled'].includes(dossier.route.commitmentState) ? dossier.route.commitmentAmountAud : null;
                return <tr key={pathway.id} className={index % 2 ? 'bg-bauhaus-canvas' : ''}>
                  <td className="border-b border-gray-300 px-3 py-3 align-top"><strong className="block text-sm">{pathway.displayName}</strong><span className="mt-1 block font-mono text-[9px] uppercase text-bauhaus-muted">{goodsNetworkLaneLabel(pathway.lane)}</span></td>
                  <td className="border-b border-gray-300 px-3 py-3 align-top"><StatusPill tone={desired ? 'neutral' : 'good'}>{desired ? 'Want closer' : words(pathway.stage)}</StatusPill></td>
                  <td className="max-w-xs border-b border-gray-300 px-3 py-3 align-top"><StatusPill tone={evidenceTone(pathway.evidenceForm)}>{goodsInterestEvidenceLabel(pathway.evidenceForm)}</StatusPill><p className="mt-2 line-clamp-2 leading-5 text-bauhaus-muted">{pathway.evidenceSummary}</p></td>
                  <td className="border-b border-gray-300 px-3 py-3 align-top">{owners.length ? owners.map(person => person.name).join(', ') : <span className="font-bold text-amber-800">Owner needed</span>}</td>
                  <td className="max-w-sm border-b border-gray-300 px-3 py-3 align-top"><strong>{pathway.nextAction || 'Set a specific next action.'}</strong>{pathway.nextActionDue && <span className="mt-1 block text-[10px] text-bauhaus-muted">Due {formatWorkspaceDate(pathway.nextActionDue)}</span>}</td>
                  <td className="border-b border-gray-300 px-3 py-3 align-top"><span className="block font-bold">{commitment ? `${money(commitment)} committed` : dossier?.route?.targetAmountAud ? `${money(dossier.route.targetAmountAud)} target` : 'No support evidenced'}</span><Link href={`/org/${slug}/goods/grants?q=${encodeURIComponent(pathway.displayName)}`} className="mt-2 inline-block font-black text-bauhaus-blue underline">Find opportunities</Link></td>
                </tr>;
              })}{relationshipRows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-bauhaus-muted">No relationship matches this view.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle
              eyebrow="Current human signals"
              title="People who have opened a door"
              description={`${network.people.length} people are attached to a specific pathway. ${directInbound} is direct inbound evidence; reported interest remains labelled as reported until the next conversation produces a concrete route.`}
            />
            <GoodsViewToggle basePath={`/org/${slug}/goods/network`} param="people" active={peopleView} />
          </div>
          {peopleView === 'table' ? (
            <div className="overflow-x-auto border-4 border-bauhaus-black bg-white">
              <table className="w-full text-xs">
                <thead className="bg-bauhaus-black text-white">
                  <tr>
                    {['Person', 'Role · Org', 'Evidence', 'Lane', 'Stage', 'Next move', 'Last touch', ''].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-mono text-[9px] font-black uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {network.people.map((person, i) => (
                    <tr key={person.id} className={i % 2 === 1 ? 'bg-bauhaus-canvas' : ''}>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top font-black">{person.name}</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top">{person.role ?? 'Role to confirm'}{person.organisation ? ` · ${person.organisation}` : ''}</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top"><StatusPill tone={evidenceTone(person.evidenceForm)}>{goodsInterestEvidenceLabel(person.evidenceForm)}</StatusPill></td>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top"><StatusPill tone={laneTone(person.lane)}>{goodsNetworkLaneLabel(person.lane)}</StatusPill></td>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top font-mono uppercase text-[10px]">{words(person.stage)}</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top max-w-80">{person.nextAction ?? 'Set a specific next action.'}</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top whitespace-nowrap">{formatWorkspaceDate(person.lastContactedAt)}</td>
                      <td className="border-b border-gray-300 px-2 py-1.5 align-top">
                        {person.linkedinUrl ? <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="font-black text-bauhaus-blue hover:underline">↗</a> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : peopleView === 'compact' ? (
            <div className="border-4 border-bauhaus-black bg-white">
              {network.people.map((person, i) => (
                <details key={person.id} className={i > 0 ? 'border-t-2 border-bauhaus-black/20' : ''}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 hover:bg-bauhaus-canvas">
                    <span className="font-black">{person.name}</span>
                    <span className="text-xs text-bauhaus-muted">{person.role ?? 'Role to confirm'}{person.organisation ? ` · ${person.organisation}` : ''}</span>
                    <span className="ml-auto flex gap-2">
                      <StatusPill tone={evidenceTone(person.evidenceForm)}>{goodsInterestEvidenceLabel(person.evidenceForm)}</StatusPill>
                      <StatusPill tone={laneTone(person.lane)}>{goodsNetworkLaneLabel(person.lane)}</StatusPill>
                    </span>
                  </summary>
                  <div className="border-t border-bauhaus-black/10 px-4 py-3 text-sm leading-6">
                    <p>{person.summary}</p>
                    <p className="mt-2 text-xs"><span className="font-black uppercase tracking-wider text-bauhaus-blue">QBE:</span> {person.qbeRelevance}</p>
                    <p className="mt-1 text-xs font-bold">Next: {person.nextAction ?? 'Set a specific next action.'}</p>
                  </div>
                </details>
              ))}
            </div>
          ) : (
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
          )}
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
