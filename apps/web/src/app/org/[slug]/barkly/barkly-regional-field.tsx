'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  ActPlaceFieldData,
  ActPlaceFieldInitiative,
  ActPlaceFieldInitiativeStatus,
  ActPlaceFieldLens,
} from '@/lib/services/act-barkly-field';
import type { ActPlaceFieldDefinition } from '@/lib/services/act-place-fields';

type FieldView = 'overview' | 'communities' | 'initiatives' | 'relationships' | 'evidence';
type InitiativeFilter = 'all' | ActPlaceFieldInitiativeStatus | ActPlaceFieldLens;

const VIEWS: Array<{ id: FieldView; label: string }> = [
  { id: 'overview', label: 'Regional picture' },
  { id: 'communities', label: 'Communities' },
  { id: 'initiatives', label: 'Workstreams' },
  { id: 'relationships', label: 'People + organisations' },
  { id: 'evidence', label: 'Evidence + consent' },
];

const FILTERS: Array<{ id: InitiativeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'underway', label: 'Underway' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'ready_for_closure', label: 'Ready to close' },
  { id: 'complete', label: 'Complete' },
  { id: 'goods', label: 'Goods lens' },
  { id: 'justice', label: 'JusticeHub lens' },
  { id: 'story', label: 'Story lens' },
  { id: 'relationships', label: 'Relationship lens' },
];

export function ActPlaceFieldWorkspace({
  slug,
  place,
  field,
  empathyLedgerUrl,
}: {
  slug: string;
  place: ActPlaceFieldDefinition;
  field: ActPlaceFieldData;
  empathyLedgerUrl: string | null;
}) {
  const [view, setView] = useState<FieldView>('overview');
  const [initiativeFilter, setInitiativeFilter] = useState<InitiativeFilter>('all');
  const [initiativeQuery, setInitiativeQuery] = useState('');
  const [selectedInitiativeNumber, setSelectedInitiativeNumber] = useState(14);
  const selectedInitiative = field.initiatives.find((initiative) => initiative.number === selectedInitiativeNumber) ?? field.initiatives[0];
  const initiatives = useMemo(() => {
    const query = initiativeQuery.trim().toLocaleLowerCase('en-AU');
    return field.initiatives.filter((initiative) => {
      const matchesFilter = initiativeFilter === 'all'
        || initiative.status === initiativeFilter
        || initiative.lenses.includes(initiativeFilter as ActPlaceFieldLens);
      const matchesQuery = !query
        || initiative.title.toLocaleLowerCase('en-AU').includes(query)
        || initiative.summary.toLocaleLowerCase('en-AU').includes(query)
        || initiative.lead.toLocaleLowerCase('en-AU').includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [field.initiatives, initiativeFilter, initiativeQuery]);
  const primaryCommunity = field.communities.find((community) => community.name.toLocaleLowerCase('en-AU').includes(place.primaryCommunityName.toLocaleLowerCase('en-AU')));

  function openView(nextView: FieldView) {
    setView(nextView);
    window.requestAnimationFrame(() => document.getElementById('place-field-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <main className="min-h-screen bg-[var(--ws-surface-0)] text-[var(--ws-text)]" data-testid="act-place-field">
      <header className="border-b border-[var(--ws-border)] bg-[#f8faf7] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2f6b4a]">ACT {place.kind} field · {place.name}</div>
            <h1 className="mt-2 max-w-5xl text-2xl font-semibold tracking-[-0.025em] text-[#14291d] sm:text-3xl">Understand the region before deciding the work</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--ws-text-secondary)]">{place.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <StatusPill label="Official progress" value={place.officialProgressLabel} tone="verified" />
            <StatusPill label="Live field" value={formatDateTime(field.generatedAt)} tone="live" />
            <StatusPill label="Regional consent" value="Not recorded" tone="warning" />
          </div>
        </div>
      </header>

      {field.errors.length > 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 sm:px-6 lg:px-8" role="status">
          Some live CivicGraph sources could not be loaded. Official initiative evidence remains available. {field.errors.join(' · ')}
        </div>
      ) : null}

      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-[var(--ws-text-secondary)]" aria-label="Breadcrumb">
          <Link href={`/org/${slug}`} className="font-semibold text-[#2f6b4a] hover:underline">ACT Field Desk</Link>
          <span>/</span>
          <Link href={`/org/${slug}/explore?type=community`} className="font-semibold text-[#2f6b4a] hover:underline">Atlas</Link>
          <span>/</span>
          <span>{place.name} {place.kind} field</span>
        </nav>

        <section className="mt-4 grid overflow-hidden rounded-lg border border-[#9fb9a7] bg-[#e7f1e9] xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]" aria-labelledby="place-next-move">
          <div className="px-5 py-6 sm:px-7">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Relational next move</div>
            <h2 id="place-next-move" className="mt-2 text-xl font-semibold text-[#183426]">{field.summary.nextMove.title}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#365442]">{field.summary.nextMove.detail}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => openView('initiatives')} className="min-h-11 rounded-md bg-[#173d2b] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#24563d] focus:outline-none focus:ring-2 focus:ring-[#2f8f64] focus:ring-offset-2">Review workstreams</button>
              {primaryCommunity ? <Link href={`/org/${slug}/goods/community/${primaryCommunity.id}`} className="inline-flex min-h-11 items-center rounded-md border border-[#83a38e] bg-white/70 px-4 text-xs font-semibold text-[#214c35] hover:bg-white">Open {titleCase(primaryCommunity.name)} dossier</Link> : null}
            </div>
          </div>
          <div className="border-t border-[#b9cdbd] bg-white/55 px-5 py-6 xl:border-l xl:border-t-0">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#56705e]">Why now</div>
            <p className="mt-2 text-xs leading-5 text-[#365442]">{field.summary.nextMove.whyNow}</p>
            <a href={place.evidenceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center text-xs font-semibold text-[#2f6b4a] underline decoration-[#8eb19a] underline-offset-4">Open official {place.initiativeRegisterLabel} evidence ↗</a>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--ws-border)] bg-white md:grid-cols-4 2xl:grid-cols-8" aria-label={`${place.name} field snapshot`}>
          <Metric label="Communities indexed" value={field.summary.communityCount.toLocaleString('en-AU')} detail="starting set" />
          <Metric label="Program initiatives" value={place.initiativeCount.toLocaleString('en-AU')} detail={place.initiativeRegisterLabel} />
          <Metric label="Still underway" value={countStatus(field.initiatives, 'underway').toString()} detail="May 2026" warning />
          <Metric label="Completed" value={countStatus(field.initiatives, 'complete').toString()} detail="endorsed complete" />
          <Metric label="Regional orgs" value={field.summary.organisationCount.toLocaleString('en-AU')} detail={`${field.summary.communityControlledOrganisationCount} community-controlled`} />
          <Metric label="ACT people" value={field.summary.relationshipCount.toLocaleString('en-AU')} detail="linked to regional orgs" warning={field.summary.relationshipCount === 0} />
          <Metric label="Goods assets" value={field.summary.recordedAssets.toLocaleString('en-AU')} detail={`${field.summary.recordedNeed.toLocaleString('en-AU')} recorded need`} />
          <Metric label="Justice records" value={field.summary.justiceRecordCount.toLocaleString('en-AU')} detail="matched public evidence" />
        </section>

        <div id="place-field-content" className="scroll-mt-4">
          <nav className="mt-5 flex gap-1 overflow-x-auto rounded-lg border border-[var(--ws-border)] bg-white p-1" aria-label={`${place.name} field views`}>
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
                className={`min-h-11 shrink-0 rounded-md px-4 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#2f8f64] ${view === item.id ? 'bg-[#173d2b] text-white' : 'text-[var(--ws-text-secondary)] hover:bg-[#f1f5f1]'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {view === 'overview' ? <Overview field={field} place={place} openView={openView} /> : null}
          {view === 'communities' ? <Communities field={field} slug={slug} place={place} /> : null}
          {view === 'initiatives' ? (
            <Initiatives
              place={place}
              initiatives={initiatives}
              selected={selectedInitiative}
              filter={initiativeFilter}
              query={initiativeQuery}
              onFilter={setInitiativeFilter}
              onQuery={setInitiativeQuery}
              onSelect={setSelectedInitiativeNumber}
            />
          ) : null}
          {view === 'relationships' ? <Relationships field={field} place={place} slug={slug} /> : null}
          {view === 'evidence' ? <Evidence field={field} place={place} empathyLedgerUrl={empathyLedgerUrl} /> : null}
        </div>
      </div>
    </main>
  );
}

function Overview({ field, place, openView }: { field: ActPlaceFieldData; place: ActPlaceFieldDefinition; openView: (view: FieldView) => void }) {
  return (
    <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
      <div className="min-w-0 space-y-5">
        <Section eyebrow="What good looks like" title="Five outcomes hold the field together">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {place.outcomes.map((outcome) => (
              <article key={outcome.number} className="rounded-md border border-[var(--ws-border)] bg-[#fafbf9] p-4">
                <div className="font-mono text-[9px] font-semibold text-[#2f6b4a]">{outcome.number}</div>
                <h3 className="mt-2 text-sm font-semibold leading-5">{outcome.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{outcome.detail}</p>
                <div className="mt-3 flex flex-wrap gap-1">{outcome.lenses.map((lens) => <Pill key={lens} label={lens} />)}</div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-4 text-[var(--ws-text-tertiary)]">{place.outcomesSourceNote}</p>
        </Section>

        <Section eyebrow="How ACT can help" title="Four support pathways, one relational sequence">
          <div className="grid gap-3 md:grid-cols-2">
            {place.supportPaths.map((path) => (
              <article key={path.label} className="rounded-md border border-[var(--ws-border)] bg-white p-4 transition-shadow hover:shadow-sm">
                <Pill label={path.label} strong />
                <h3 className="mt-3 text-base font-semibold">{path.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{path.detail}</p>
                <div className="mt-4 border-l-2 border-[#8fb19b] pl-3 text-xs font-medium leading-5 text-[#315c42]">{path.next}</div>
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="Regional operating sequence" title="Evidence becomes useful only after authority and interpretation">
          <ol className="grid gap-2 lg:grid-cols-7">
            {['Listen', 'Confirm authority', 'Validate evidence', 'Choose a shared priority', 'Resource the work', 'Deliver accountably', 'Report back + learn'].map((step, index) => (
              <li key={step} className="rounded-md border border-[var(--ws-border)] bg-[#fafbf9] p-3">
                <div className="font-mono text-[9px] font-semibold text-[#2f6b4a]">{String(index + 1).padStart(2, '0')}</div>
                <div className="mt-2 text-xs font-semibold leading-5">{step}</div>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <aside className="min-w-0 space-y-5">
        <Section eyebrow="Official position" title={`${place.initiativeRegisterLabel} progress`}>
          <dl className="divide-y divide-[var(--ws-border)]">
            <FactRow label="Underway" value={countStatus(field.initiatives, 'underway').toString()} />
            <FactRow label="Ongoing to program end" value={countStatus(field.initiatives, 'ongoing').toString()} />
            <FactRow label="Ready for closure" value={countStatus(field.initiatives, 'ready_for_closure').toString()} />
            <FactRow label="Endorsed complete" value={countStatus(field.initiatives, 'complete').toString()} />
          </dl>
          <button type="button" onClick={() => openView('initiatives')} className="mt-4 min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-4 text-xs font-semibold text-[#2f6b4a] hover:bg-[#f4f7f4]">See all initiatives</button>
        </Section>

        <Section eyebrow="Trust before action" title="Evidence gaps">
          <GapList gaps={field.summary.evidenceGaps} />
          <button type="button" onClick={() => openView('evidence')} className="mt-4 min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-4 text-xs font-semibold text-[#2f6b4a] hover:bg-[#f4f7f4]">Review sources and consent</button>
        </Section>

        <div className="rounded-lg border border-[#c8d8cb] bg-[#edf4ee] p-4">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Interpretation rule</div>
          <p className="mt-2 text-xs leading-5 text-[#365442]">A public record, nearby organisation or community-controlled entity is context. It does not establish authority, consent, fit or an invitation for ACT.</p>
        </div>
      </aside>
    </div>
  );
}

function Communities({ field, slug, place }: { field: ActPlaceFieldData; slug: string; place: ActPlaceFieldDefinition }) {
  return (
    <div className="mt-5 space-y-5">
      <Section eyebrow="Place is plural" title={`${field.communities.length} ${place.name} community records currently indexed`}>
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">This is a starting set from Goods data, not a complete list of {place.name} communities or homelands. A regional service hub is not the whole region.</div>
        {field.communities.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {field.communities.map((community) => (
              <article key={community.id} className="rounded-md border border-[var(--ws-border)] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#8eaa96] hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[8px] font-semibold uppercase text-[#2f6b4a]">Community · {community.state || 'NT'}</div>
                    <h3 className="mt-2 text-base font-semibold">{titleCase(community.name)}</h3>
                    <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">{[community.postcode, community.remoteness].filter(Boolean).join(' · ') || 'Location context incomplete'}</p>
                  </div>
                  <span className="font-mono text-[8px] uppercase text-[#52745f]">{place.name}</span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2">
                  <CompactFact label="Recorded need" value={community.need.toLocaleString('en-AU')} />
                  <CompactFact label="Goods assets" value={community.assets.toLocaleString('en-AU')} />
                  <CompactFact label="Mapped buyers" value={community.buyers.toLocaleString('en-AU')} />
                  <CompactFact label="Evidence sources" value={community.sourceCount.toLocaleString('en-AU')} />
                </dl>
                <div className="mt-3 text-[10px] text-[var(--ws-text-tertiary)]">Data quality: {community.dataQuality == null ? 'unscored' : `${Math.round(community.dataQuality)}%`} · authority requires confirmation</div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--ws-border)] pt-3">
                  <Link href={`/org/${slug}/explore?type=community&q=${encodeURIComponent(community.name)}`} className="inline-flex min-h-10 items-center rounded-md bg-[#173d2b] px-3 text-[10px] font-semibold text-white hover:bg-[#24563d] focus:outline-none focus:ring-2 focus:ring-[#2f8f64] focus:ring-offset-2">Investigate in Atlas</Link>
                  <Link href={`/org/${slug}/goods/community/${community.id}`} className="inline-flex min-h-10 items-center rounded-md border border-[var(--ws-border)] bg-white px-3 text-[10px] font-semibold text-[#2f6b4a] hover:bg-[#f4f7f4] focus:outline-none focus:ring-2 focus:ring-[#2f8f64]">Open Goods dossier</Link>
                </div>
              </article>
            ))}
          </div>
        ) : <Empty text={`No live ${place.name} community records could be loaded. Official program evidence is still available in the initiatives view.`} />}
      </Section>
    </div>
  );
}

function Initiatives({
  place,
  initiatives,
  selected,
  filter,
  query,
  onFilter,
  onQuery,
  onSelect,
}: {
  place: ActPlaceFieldDefinition;
  initiatives: ActPlaceFieldInitiative[];
  selected: ActPlaceFieldInitiative;
  filter: InitiativeFilter;
  query: string;
  onFilter: (value: InitiativeFilter) => void;
  onQuery: (value: string) => void;
  onSelect: (number: number) => void;
}) {
  return (
    <div className="mt-5 space-y-5">
      <Section eyebrow="Official initiative register" title={`Track ${place.initiativeRegisterLabel} without losing community meaning`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,0.6fr)_minmax(0,1.4fr)]">
          <label className="block">
            <span className="sr-only">Search initiatives</span>
            <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search initiative, lead or purpose" className="min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-4 text-sm outline-none placeholder:text-[var(--ws-text-tertiary)] focus:border-[#2f8f64] focus:ring-2 focus:ring-[#2f8f64]/20" />
          </label>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" onClick={() => onFilter(item.id)} className={`min-h-11 shrink-0 rounded-md border px-3 text-[10px] font-semibold ${filter === item.id ? 'border-[#173d2b] bg-[#173d2b] text-white' : 'border-[var(--ws-border)] bg-white text-[var(--ws-text-secondary)] hover:bg-[#f4f7f4]'}`}>{item.label}</button>
            ))}
          </div>
        </div>
      </Section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section className="min-w-0 rounded-lg border border-[var(--ws-border)] bg-white" aria-label={`${place.initiativeRegisterLabel} initiatives`}>
          <div className="border-b border-[var(--ws-border)] px-4 py-3 text-xs text-[var(--ws-text-secondary)]">{initiatives.length} initiatives shown · official status checked {formatDate(place.evidenceCheckedAt)}</div>
          {initiatives.length > 0 ? (
            <div className="divide-y divide-[var(--ws-border)]">
              {initiatives.map((initiative) => (
                <button key={initiative.number} type="button" onClick={() => onSelect(initiative.number)} className={`grid w-full gap-3 px-4 py-4 text-left transition-colors sm:grid-cols-[48px_minmax(0,1fr)_auto] ${selected.number === initiative.number ? 'bg-[#edf5ef]' : 'hover:bg-[#fafbf9]'}`}>
                  <div className="font-mono text-sm font-semibold text-[#2f6b4a]">{String(initiative.number).padStart(2, '0')}</div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-5">{initiative.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{initiative.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{initiative.lenses.map((lens) => <Pill key={lens} label={lensLabel(lens)} />)}</div>
                  </div>
                  <StatusBadge status={initiative.status} />
                </button>
              ))}
            </div>
          ) : <Empty text="No initiatives match the current filter." />}
        </section>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-lg border border-[#9fb9a7] bg-white p-5" aria-labelledby="selected-initiative">
            <div className="flex items-start justify-between gap-3">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Initiative {String(selected.number).padStart(2, '0')}</div>
              <StatusBadge status={selected.status} />
            </div>
            <h2 id="selected-initiative" className="mt-3 text-xl font-semibold leading-7">{selected.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ws-text-secondary)]">{selected.summary}</p>
            <dl className="mt-5 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
              <FactRow label="Theme" value={humanise(selected.category)} />
              <FactRow label="Lead responsibility" value={selected.lead} />
              <FactRow label="Status evidence" value="Official · May 2026" />
            </dl>
            <div className="mt-5">
              <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-tertiary)]">ACT lenses</div>
              <div className="mt-2 flex flex-wrap gap-2">{selected.lenses.map((lens) => <Pill key={lens} label={lensLabel(lens)} strong />)}</div>
            </div>
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-xs font-semibold text-amber-900">Community interpretation still required</div>
              <p className="mt-1 text-xs leading-5 text-amber-800">Official completion or progress does not establish whether communities experienced the intended outcome, who holds the relationship or what ACT should do.</p>
            </div>
            <a href={selected.officialUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#173d2b] px-4 text-xs font-semibold text-white hover:bg-[#24563d]">Open official initiative record ↗</a>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Relationships({ field, place, slug }: { field: ActPlaceFieldData; place: ActPlaceFieldDefinition; slug: string }) {
  return (
    <div className="mt-5 grid min-w-0 gap-5 2xl:grid-cols-2">
      <div className="min-w-0 space-y-5">
        <Section eyebrow="ACT relationship paths" title={`People connected to indexed ${place.name} organisations`}>
          {field.relationships.length > 0 ? (
            <div className="divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
              {field.relationships.map((relationship) => (
                <div key={relationship.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <Link href={`/org/${slug}/explore?type=person&q=${encodeURIComponent(relationship.name)}`} className="text-sm font-semibold text-[#244c34] hover:underline">{relationship.name}</Link>
                    <div className="mt-1 text-xs text-[var(--ws-text-secondary)]">{[relationship.role, relationship.organisation].filter(Boolean).join(' · ') || 'Role and organisation need verification'}</div>
                    {relationship.expertise.length > 0 ? <div className="mt-2 flex flex-wrap gap-1">{relationship.expertise.slice(0, 4).map((expertise) => <Pill key={expertise} label={expertise} />)}</div> : null}
                  </div>
                  <div className="text-xs font-medium text-[var(--ws-text-secondary)] sm:text-right">{relationship.lastContactedAt ? `Last contact ${formatDate(relationship.lastContactedAt)}` : 'No dated contact'}</div>
                </div>
              ))}
            </div>
          ) : <Empty text={`No ACT contact is directly linked to an indexed ${place.name} organisation. This is an identity-link gap, not proof that ACT has no regional relationships.`} />}
          <Link href={`/org/${slug}?view=relationships#relationships`} className="mt-4 inline-flex min-h-11 items-center rounded-md border border-[var(--ws-border)] bg-white px-4 text-xs font-semibold text-[#2f6b4a] hover:bg-[#f4f7f4]">Open complete ACT relationship history</Link>
        </Section>

        <Section eyebrow="Regional organisation field" title={`${field.organisations.length} deduplicated organisations`}>
          <p className="mb-4 text-xs leading-5 text-[var(--ws-text-secondary)]">Community-controlled status identifies a possible authority or delivery context. It does not prove a mandate, relationship or permission to approach.</p>
          {field.organisations.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {field.organisations.slice(0, 30).map((organisation) => (
                <Link key={organisation.id} href={`/org/${slug}/explore?type=organisation&q=${encodeURIComponent(organisation.name)}`} className="rounded-md border border-[var(--ws-border)] bg-[#fafbf9] p-3 hover:border-[#9cb3a2] hover:bg-white">
                  <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold leading-5">{organisation.name}</h3>{organisation.communityControlled ? <Pill label="Community-controlled" strong /> : null}</div>
                  <p className="mt-2 text-[10px] text-[var(--ws-text-secondary)]">{humanise(organisation.entityType)} · {organisation.sector || 'sector unclassified'} · {organisation.postcode || 'postcode unknown'}</p>
                </Link>
              ))}
            </div>
          ) : <Empty text="No regional organisations could be loaded from CivicGraph." />}
        </Section>
      </div>

      <div className="min-w-0 space-y-5">
        <Section eyebrow="JusticeHub evidence" title="Matched public justice funding">
          <EvidenceRecords
            empty={`No ${place.name} justice-funding records matched the live public index.`}
            records={field.justiceRecords.map((record) => ({ id: record.id, title: record.program, actor: record.recipient, meta: [record.location, record.announcementDate ? formatDate(record.announcementDate) : null, record.amount == null ? null : formatMoney(record.amount)].filter(Boolean).join(' · '), url: record.sourceUrl }))}
          />
          <p className="mt-3 text-[10px] leading-4 text-[var(--ws-text-tertiary)]">Matched by place and {place.name} terms. Verify program scope and recipient before drawing regional conclusions.</p>
        </Section>

        <Section eyebrow="Procurement evidence" title="Recent contracts to indexed regional suppliers">
          <EvidenceRecords
            empty="No supplier contracts matched the ABNs of the indexed regional organisation set."
            records={field.contracts.map((record) => ({ id: record.id, title: record.title, actor: `${record.supplier} · buyer: ${record.buyer}`, meta: [record.publishedAt ? formatDate(record.publishedAt) : null, record.value == null ? null : formatMoney(record.value)].filter(Boolean).join(' · '), url: record.sourceUrl }))}
          />
          <p className="mt-3 text-[10px] leading-4 text-[var(--ws-text-tertiary)]">This is a supplier-ABN sample, not a complete account of regional procurement or local benefit.</p>
        </Section>
      </div>
    </div>
  );
}

function Evidence({ field, place, empathyLedgerUrl }: { field: ActPlaceFieldData; place: ActPlaceFieldDefinition; empathyLedgerUrl: string | null }) {
  return (
    <div className="mt-5 grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="min-w-0 space-y-5">
        <Section eyebrow="Source register" title="What can be claimed, and from where">
          <div className="divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
            {field.evidenceSources.map((source) => (
              <article key={source.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{source.title}</h3><EvidenceBadge kind={source.kind} /></div>
                  <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{source.summary}</p>
                  <div className="mt-2 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{source.checkedAt ? `Checked ${formatDate(source.checkedAt)}` : 'Loaded or resolved at request time'}</div>
                </div>
                {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-xs font-semibold text-[#2f6b4a] underline underline-offset-4">Open source ↗</a> : null}
              </article>
            ))}
          </div>
        </Section>

        <Section eyebrow="Community knowledge governance" title="Stories stay governed at the source">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['Purpose-specific consent', 'Collection, use, sharing and storage are separate decisions. Permission for one does not imply permission for another.'],
              ['Audience and sensitivity', 'Public, community-only and restricted knowledge require distinct access controls and review paths.'],
              ['Attribution and location', 'A storyteller may allow a story but not their name, precise location or connection to a sensitive initiative.'],
              ['Withdrawal and review', 'Consent needs an expiry, withdrawal path, accountable custodian and a record of every reuse decision.'],
            ].map(([title, detail]) => (
              <article key={title} className="rounded-md border border-[var(--ws-border)] bg-[#fafbf9] p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{detail}</p></article>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-[#c7d8cb] bg-[#edf4ee] p-4">
            <div className="text-sm font-semibold text-[#244c34]">Empathy Ledger integration state</div>
            <p className="mt-2 text-xs leading-5 text-[#365442]">CivicGraph can link stories to an organisation today. This field deliberately does not copy regional story content until place-, initiative- and purpose-level consent can travel with the link.</p>
            {empathyLedgerUrl ? <a href={`${empathyLedgerUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(place.name)}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[#173d2b] px-4 text-xs font-semibold text-white hover:bg-[#24563d]">Search {place.name} stories on Empathy Ledger ↗</a> : <div className="mt-4 font-mono text-[9px] uppercase text-[#5d7664]">Empathy Ledger URL is not configured in this environment</div>}
          </div>
        </Section>
      </div>

      <aside className="min-w-0 space-y-5">
        <Section eyebrow="Blocked claims" title="What ACT cannot safely say yet">
          <GapList gaps={field.summary.evidenceGaps} />
        </Section>
        <Section eyebrow="Historical inconsistency" title="Roundtable vote needs resolution">
          <p className="text-xs leading-5 text-[var(--ws-text-secondary)]">The April 2025 report records 27 votes for a Hub and 13 for a Shelter in one section, then 27 and 17 later. CivicGraph should retain both claims against the same source and mark the count contested until the authors confirm it.</p>
        </Section>
        <Section eyebrow="Safe map rule" title="No individual youth risk map">
          <p className="text-xs leading-5 text-[var(--ws-text-secondary)]">Do not display homes, informal gathering places, case records or precise story locations. Regional service coverage can be aggregated; individual young people must not become map markers.</p>
        </Section>
      </aside>
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-[var(--ws-border)] bg-white p-4 sm:p-5"><div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">{eyebrow}</div><h2 className="mt-1 text-lg font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <div className="min-w-0 border-b border-r border-[var(--ws-border)] p-4"><div className={`text-xl font-semibold tabular-nums ${warning ? 'text-amber-700' : ''}`}>{value}</div><div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">{label}</div><div className="mt-1 truncate text-[10px] text-[var(--ws-text-secondary)]">{detail}</div></div>;
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'verified' | 'live' | 'warning' }) {
  const style = tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : tone === 'verified' ? 'border-[#b7cdbd] bg-[#edf5ef] text-[#28533a]' : 'border-blue-200 bg-blue-50 text-blue-800';
  return <div className={`rounded-md border px-3 py-2 ${style}`}><div className="font-mono text-[8px] font-semibold uppercase tracking-wide opacity-70">{label}</div><div className="mt-1 text-xs font-semibold">{value}</div></div>;
}

function StatusBadge({ status }: { status: ActPlaceFieldInitiativeStatus }) {
  const styles: Record<ActPlaceFieldInitiativeStatus, string> = { underway: 'border-amber-200 bg-amber-50 text-amber-800', ongoing: 'border-blue-200 bg-blue-50 text-blue-800', ready_for_closure: 'border-purple-200 bg-purple-50 text-purple-800', complete: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  return <span className={`shrink-0 rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${styles[status]}`}>{humanise(status)}</span>;
}

function EvidenceBadge({ kind }: { kind: ActPlaceFieldData['evidenceSources'][number]['kind'] }) {
  const styles = kind === 'integration_gap' ? 'border-amber-200 bg-amber-50 text-amber-800' : kind === 'official_current' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : kind === 'live_civicgraph' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-stone-200 bg-stone-50 text-stone-700';
  return <span className={`rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${styles}`}>{humanise(kind)}</span>;
}

function Pill({ label, strong = false }: { label: string; strong?: boolean }) {
  return <span className={`rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${strong ? 'border-[#b6cbbd] bg-[#edf5ef] text-[#2f6b4a]' : 'border-[var(--ws-border)] bg-white text-[var(--ws-text-secondary)]'}`}>{label}</span>;
}

function FactRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-3 text-xs"><dt className="text-[var(--ws-text-secondary)]">{label}</dt><dd className="max-w-[65%] text-right font-semibold">{value}</dd></div>;
}

function CompactFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-[var(--ws-border)] bg-[#fafbf9] p-2.5"><div className="text-sm font-semibold">{value}</div><div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{label}</div></div>;
}

function GapList({ gaps }: { gaps: string[] }) {
  return <ol className="space-y-3">{gaps.map((gap, index) => <li key={gap} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-xs leading-5 text-[var(--ws-text-secondary)]"><span className="font-mono font-semibold text-amber-700">{String(index + 1).padStart(2, '0')}</span><span>{gap}</span></li>)}</ol>;
}

function EvidenceRecords({ records, empty }: { records: Array<{ id: string; title: string; actor: string; meta: string; url: string | null }>; empty: string }) {
  if (records.length === 0) return <Empty text={empty} />;
  return <div className="divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">{records.slice(0, 12).map((record) => { const content = <><div className="text-sm font-semibold leading-5">{record.title}</div><div className="mt-1 text-xs text-[var(--ws-text-secondary)]">{record.actor}</div><div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{record.meta || 'Date and value not recorded'}</div></>; return record.url ? <a key={record.id} href={record.url} target="_blank" rel="noreferrer" className="block py-3 hover:text-[#2f6b4a]">{content}</a> : <div key={record.id} className="py-3">{content}</div>; })}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-[var(--ws-border)] bg-[#fafbf9] px-4 py-5 text-xs leading-5 text-[var(--ws-text-secondary)]">{text}</p>;
}

function countStatus(initiatives: ActPlaceFieldInitiative[], status: ActPlaceFieldInitiativeStatus): number {
  return initiatives.filter((initiative) => initiative.status === status).length;
}

function lensLabel(lens: ActPlaceFieldLens): string {
  if (lens === 'justice') return 'JusticeHub';
  if (lens === 'story') return 'Empathy Ledger';
  if (lens === 'relationships') return 'Relationships';
  return 'Goods';
}

function humanise(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

function titleCase(value: string): string {
  return value.toLocaleLowerCase('en-AU').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('en-AU'));
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Live' : date.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatMoney(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}
