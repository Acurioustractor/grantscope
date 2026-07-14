import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActWorkspacePageHeader } from '../../../_components/act-workspace-page-header';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  getGoodsCommunityDetail,
  type CommunityRelationshipPerson,
  type LocalEntity,
} from '@/lib/services/goods-community-detail';
import { RecordDeploymentButton } from './record-deployment';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const detail = await getGoodsCommunityDetail(communityId);
  return {
    title: detail ? `${detail.community.community_name} — ACT Community Dossier — CivicGraph` : 'Community — CivicGraph',
  };
}

export default async function GoodsCommunityPage({
  params,
}: {
  params: Promise<{ slug: string; communityId: string }>;
}) {
  const { slug, communityId } = await params;
  const storedProfile = await getOrgProfileBySlug(slug);
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : storedProfile;
  if (!profile) notFound();

  const detail = await getGoodsCommunityDetail(communityId, storedProfile?.id);
  if (!detail) notFound();

  const {
    community,
    mappedBuyers,
    localEntities,
    signals,
    matchedGrants,
    matchedFoundations,
    assets,
    deploymentBatches,
    timeline,
    funding,
    relationshipPeople,
    projectConnections,
    operatingModel,
  } = detail;
  const totalDemand = community.demand_beds + community.demand_washers;
  const activeSignals = signals.filter((signal) => ['new', 'reviewing'].includes(signal.status));
  const authorityIds = new Set(operatingModel.authority.candidates.map((entity) => entity.id));
  const adjacentEntities = localEntities.filter((entity) => !authorityIds.has(entity.id)).slice(0, 12);

  return (
    <main className="min-h-screen bg-[var(--ws-surface-0)] text-[var(--ws-text)]" data-testid="community-dossier">
      <ActWorkspacePageHeader
        eyebrow="ACT community dossier"
        title={community.community_name}
        description={[community.region_label || community.service_region, community.state, community.postcode, community.remoteness || funding.remoteness].filter(Boolean).join(' · ')}
        testId="community-dossier-header"
        meta={(
          <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
            {community.priority ? <Pill label={community.priority} strong /> : null}
            <Pill label={operatingModel.authority.label} warning={operatingModel.authority.state !== 'context_recorded'} />
          </div>
        )}
      />

      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-[var(--ws-text-secondary)]" aria-label="Breadcrumb">
          <Link href={`/org/${slug}/explore?type=community`} className="font-semibold text-[#2f6b4a] hover:underline">Atlas communities</Link>
          <span>/</span>
          <Link href={`/org/${slug}/goods`} className="font-semibold text-[#2f6b4a] hover:underline">Goods on Country</Link>
          <span>/</span>
          <span>{community.community_name}</span>
        </nav>

        <section className="mt-4 grid overflow-hidden rounded-md border border-[#a8c1ae] bg-[#eaf3ec] lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.5fr)]" aria-labelledby="community-next-move">
          <div className="px-5 py-5 sm:px-7">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Relational next move</div>
            <h2 id="community-next-move" className="mt-2 text-xl font-semibold text-[#183426]">{operatingModel.next_move.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#365442]">{operatingModel.next_move.detail}</p>
          </div>
          <div className="border-t border-[#b9cdbd] bg-white/55 px-5 py-5 lg:border-l lg:border-t-0">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#56705e]">Why now</div>
            <p className="mt-2 text-xs leading-5 text-[#365442]">{operatingModel.next_move.why_now}</p>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 overflow-hidden rounded-md border border-[var(--ws-border)] bg-white sm:grid-cols-3 xl:grid-cols-6" aria-label="Community operating snapshot">
          <Metric label="Recorded need" value={totalDemand.toLocaleString('en-AU')} detail="beds + washers" />
          <Metric label="Assets" value={assets.total.toLocaleString('en-AU')} detail={`${assets.overdue.toLocaleString('en-AU')} overdue`} warning={assets.overdue > 0} />
          <Metric label="ACT people" value={relationshipPeople.length.toLocaleString('en-AU')} detail="through local orgs" />
          <Metric label="Local orgs" value={funding.entity_count.toLocaleString('en-AU')} detail={`${funding.community_controlled_count} community-controlled`} />
          <Metric label="Tracked funding" value={formatMoney(funding.total_funding)} detail={`${formatMoney(funding.community_controlled_funding)} community-controlled`} />
          <Metric label="Active signals" value={activeSignals.length.toLocaleString('en-AU')} detail="interpret locally" warning={activeSignals.length > 0} />
        </section>

        <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
          <div className="min-w-0 space-y-5">
            <Section title="Authority and consent" eyebrow="Start here" testId="community-authority">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-sm font-semibold text-amber-900">{operatingModel.authority.label}</div>
                <p className="mt-1 text-xs leading-5 text-amber-800">{operatingModel.authority.summary}</p>
                <p className="mt-2 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-800">Consent recorded: no</p>
              </div>
              {operatingModel.authority.candidates.length > 0 ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {operatingModel.authority.candidates.map((entity) => (
                    <EntityRow key={entity.id} entity={entity} note="Potential authority holder · not verified mandate" />
                  ))}
                </div>
              ) : null}
            </Section>

            <Section title="People ACT knows here" eyebrow="Relationship paths" testId="community-people">
              {relationshipPeople.length > 0 ? (
                <div className="divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
                  {relationshipPeople.slice(0, 10).map((person) => <PersonRow key={person.id} person={person} />)}
                </div>
              ) : <Empty text="No named ACT relationship is connected to a local organisation yet." />}
              <Link href={`/org/${slug}?view=relationships#relationships`} className="mt-4 inline-flex min-h-11 items-center rounded-md border border-[var(--ws-border)] bg-white px-4 text-xs font-semibold text-[#2f6b4a] hover:bg-[var(--ws-surface-2)]">
                Open complete relationship history
              </Link>
            </Section>

            <Section title="ACT work connected to this place" eyebrow="Work and commitments" testId="community-work">
              <div className="space-y-2">
                {projectConnections.map((project) => (
                  <div key={project.code} className="grid gap-2 rounded-md border border-[var(--ws-border)] bg-[#fafbf9] px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                    <div><Pill label={project.code} strong /><div className="mt-2 text-sm font-semibold">{project.name}</div></div>
                    <div className="text-xs leading-5 text-[var(--ws-text-secondary)]">
                      <p>{project.basis}</p>
                      <p className="mt-1">{project.people.length > 0 ? `Connected people: ${project.people.slice(0, 5).join(', ')}` : 'No project-specific relationship owner recorded.'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CompactFact label="Asset records" value={`${assets.total} · ${assets.attributed} attributed`} />
                <CompactFact label="Deployment batches" value={deploymentBatches.length.toLocaleString('en-AU')} />
                <CompactFact label="Latest deployment" value={assets.latest_deployment_at ? formatDate(assets.latest_deployment_at) : 'Not recorded'} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <RecordDeploymentButton communityId={community.id} communityName={community.community_name} />
                <Link href={`/org/${slug}/goods`} className="inline-flex min-h-10 items-center rounded-md border border-[var(--ws-border)] px-3 text-xs font-semibold hover:bg-[var(--ws-surface-2)]">Open Goods record</Link>
              </div>
            </Section>

            <Section title="Adjacent organisations and activity" eyebrow="Useful context, not a lead list" testId="community-adjacent">
              <p className="mb-4 max-w-3xl text-xs leading-5 text-[var(--ws-text-secondary)]">These organisations share place or service context. Adjacency does not establish consent, fit or a relationship; ask local people what is relevant before approaching anyone.</p>
              {adjacentEntities.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {adjacentEntities.map((entity) => <EntityRow key={entity.id} entity={entity} />)}
                </div>
              ) : <Empty text="No adjacent organisations are indexed for this place." />}
            </Section>

            <Section title="Recorded activity" eyebrow="Evidence timeline">
              {timeline.length > 0 ? (
                <ol className="border-l border-[#b9cbbd] pl-5">
                  {timeline.slice(0, 20).map((event, index) => (
                    <li key={`${event.kind}-${event.at}-${index}`} className="relative pb-5 last:pb-0">
                      <span aria-hidden className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2f6b4a] ring-1 ring-[#8aa795]" />
                      <div className="font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">{formatDate(event.at)} · {humanise(event.kind)}</div>
                      <div className="mt-1 text-sm font-semibold">{event.summary}</div>
                      {event.detail ? <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">{event.detail}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : <Empty text="No accountable deployment batch, contact outcome or actioned signal is dated in this record." />}
            </Section>
          </div>

          <aside className="min-w-0 space-y-5">
            <Section title="What is still missing" eyebrow="Trust before action" testId="community-gaps">
              <ol className="space-y-3">
                {operatingModel.evidence_gaps.map((gap, index) => (
                  <li key={gap} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-xs leading-5 text-[var(--ws-text-secondary)]">
                    <span className="font-mono font-semibold text-amber-700">{String(index + 1).padStart(2, '0')}</span><span>{gap}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="Place funding footprint" eyebrow="Public evidence">
              <dl className="divide-y divide-[var(--ws-border)]">
                <FactRow label="Tracked funding" value={formatMoney(funding.total_funding)} />
                <FactRow label="To community-controlled orgs" value={formatMoney(funding.community_controlled_funding)} />
                <FactRow label="Funding relationships" value={funding.relationship_count.toLocaleString('en-AU')} />
                <FactRow label="SEIFA national decile" value={funding.seifa_irsd_decile?.toString() || 'Unknown'} />
              </dl>
              <p className="mt-3 text-[10px] leading-4 text-[var(--ws-text-tertiary)]">Place-level public records are context, not evidence that ACT or a specific community received this money.</p>
            </Section>

            <Section title="Logistics and governance context" eyebrow="Recorded facts">
              <dl className="divide-y divide-[var(--ws-border)]">
                <FactRow label="Land council" value={community.land_council || 'Not recorded'} />
                <FactRow label="Local government" value={community.local_government || community.lga_name || 'Not recorded'} />
                <FactRow label="Main language" value={community.main_language || 'Not recorded'} />
                <FactRow label="Staging hub" value={community.nearest_staging_hub || 'Not recorded'} />
                <FactRow label="Freight corridor" value={community.freight_corridor || 'Not recorded'} />
                <FactRow label="Last-mile method" value={community.last_mile_method || 'Not recorded'} />
              </dl>
            </Section>

            <Section title="Procurement and funding signals" eyebrow="Verify before action">
              <div className="grid grid-cols-2 gap-2">
                <CompactFact label="Mapped buyers" value={mappedBuyers.length.toLocaleString('en-AU')} />
                <CompactFact label="Active signals" value={activeSignals.length.toLocaleString('en-AU')} />
                <CompactFact label="Matched grants" value={matchedGrants.length.toLocaleString('en-AU')} />
                <CompactFact label="Foundations" value={matchedFoundations.length.toLocaleString('en-AU')} />
              </div>
              {activeSignals.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {activeSignals.slice(0, 6).map((signal) => (
                    <li key={signal.id} className="rounded-md border border-[var(--ws-border)] px-3 py-2 text-xs">
                      <div className="font-semibold">{signal.title}</div>
                      <div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{humanise(signal.signal_type)} · {signal.priority} · {signal.funding_confidence || 'confidence unknown'}</div>
                    </li>
                  ))}
                </ul>
              ) : <Empty text="No live signals are recorded." />}
            </Section>

            <div className="rounded-md border border-[var(--ws-border)] bg-white px-4 py-3 font-mono text-[9px] uppercase leading-5 tracking-wide text-[var(--ws-text-tertiary)]">
              Profiled: {community.last_profiled_at ? formatDate(community.last_profiled_at) : 'not recorded'}<br />
              Sources: {community.data_sources?.length ?? 0}<br />
              Data quality: {community.data_quality_score == null ? 'unscored' : `${Math.round(community.data_quality_score)}%`}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Section({ title, eyebrow, children, testId }: { title: string; eyebrow: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="rounded-md border border-[var(--ws-border)] bg-white px-4 py-5 sm:px-5" data-testid={testId}>
      <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">{eyebrow}</div>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <div className="min-w-0 border-b border-r border-[var(--ws-border)] p-4"><div className={`text-xl font-semibold tabular-nums ${warning ? 'text-amber-700' : ''}`}>{value}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">{label}</div><div className="mt-1 truncate text-[10px] text-[var(--ws-text-secondary)]">{detail}</div></div>;
}

function CompactFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-[var(--ws-border)] bg-[#fafbf9] p-3"><div className="text-sm font-semibold">{value}</div><div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{label}</div></div>;
}

function FactRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 py-2.5 text-xs"><dt className="text-[var(--ws-text-secondary)]">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>;
}

function EntityRow({ entity, note }: { entity: LocalEntity; note?: string }) {
  const content = (
    <div className="rounded-md border border-[var(--ws-border)] bg-[#fafbf9] px-3 py-3 transition-colors hover:bg-[#f2f5f1]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="text-sm font-semibold leading-5">{entity.canonical_name}</div><div className="mt-1 text-[10px] text-[var(--ws-text-secondary)]">{humanise(entity.entity_type || 'organisation')} · {entity.sector || 'sector unknown'}</div></div>
        {entity.is_community_controlled ? <Pill label="Community-controlled" strong /> : null}
      </div>
      {note ? <div className="mt-2 text-[10px] leading-4 text-amber-700">{note}</div> : null}
    </div>
  );
  return entity.gs_id ? <Link href={`/entities/${entity.gs_id}`} className="block focus:outline-none focus:ring-2 focus:ring-[#2f6b4a]">{content}</Link> : content;
}

function PersonRow({ person }: { person: CommunityRelationshipPerson }) {
  const hasCountedTouches = person.touchpoints > 0;
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0"><div className="text-sm font-semibold">{person.name}</div><div className="mt-1 text-xs text-[var(--ws-text-secondary)]">{person.linked_organisation_name || person.organisation || 'Organisation not verified'}</div><div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{person.source} · {person.project_codes.join(', ') || 'no project code'}</div></div>
      <div className="text-left sm:text-right"><div className="text-xs font-semibold">{hasCountedTouches ? `${person.touchpoints} touches` : 'No counted touches'}</div><div className="mt-1 text-[10px] text-[var(--ws-text-secondary)]">{person.last_contact_at ? `${hasCountedTouches ? 'Last contact' : 'Activity date'} ${formatDate(person.last_contact_at)}` : 'No dated contact'}</div></div>
    </div>
  );
}

function Pill({ label, strong = false, warning = false }: { label: string; strong?: boolean; warning?: boolean }) {
  const style = warning ? 'border-amber-200 bg-amber-50 text-amber-800' : strong ? 'border-[#b6cbbd] bg-[#edf5ef] text-[#2f6b4a]' : 'border-[var(--ws-border)] bg-white text-[var(--ws-text-secondary)]';
  return <span className={`shrink-0 rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${style}`}>{humanise(label)}</span>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-[var(--ws-border)] bg-[#fafbf9] px-4 py-5 text-xs leading-5 text-[var(--ws-text-secondary)]">{text}</p>;
}

function humanise(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}
