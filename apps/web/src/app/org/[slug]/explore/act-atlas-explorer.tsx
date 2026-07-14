'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ActAtlasConnection, ActAtlasConnectionSection, ActAtlasRecord, ActAtlasRecordType, ActAtlasSearchResult } from '@/lib/services/act-atlas';
import { ActWorkspacePageHeader } from '../_components/act-workspace-page-header';

const ActAtlasMap = dynamic(
  () => import('./act-atlas-map').then((module) => module.ActAtlasMap),
  {
    ssr: false,
    loading: () => <div className="min-h-[520px] animate-pulse bg-[var(--ws-surface-2)]" aria-label="Loading map" />,
  },
);

const TYPE_FILTERS: Array<{ value: ActAtlasRecordType | ''; label: string }> = [
  { value: '', label: 'Everything' },
  { value: 'place', label: 'Place fields' },
  { value: 'community', label: 'Communities' },
  { value: 'person', label: 'People' },
  { value: 'organisation', label: 'Organisations' },
  { value: 'funder', label: 'Funders' },
  { value: 'project', label: 'ACT projects' },
  { value: 'opportunity', label: 'Opportunities' },
];

const STATES = ['', 'ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const TYPE_LABELS: Record<ActAtlasRecordType, string> = {
  place: 'Place field',
  community: 'Community',
  person: 'Person',
  organisation: 'Organisation',
  funder: 'Funder',
  project: 'ACT project',
  opportunity: 'Opportunity',
};

type AtlasDrawerSubject =
  | { kind: 'record'; record: ActAtlasRecord }
  | { kind: 'connection'; item: ActAtlasConnection };

function atlasHref(slug: string, current: { query: string; type?: string; state?: string; mode?: string }, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const next = { q: current.query, type: current.type, state: current.state, mode: current.mode, ...changes };
  Object.entries(next).forEach(([key, value]) => {
    if (value && !(key === 'mode' && value === 'list')) params.set(key, value);
  });
  const suffix = params.toString();
  return `/org/${slug}/explore${suffix ? `?${suffix}` : ''}`;
}

function typeCount(data: ActAtlasSearchResult, type: ActAtlasRecordType | ''): number {
  if (!type) return data.records.length;
  return data.counts[type];
}

export function ActAtlasExplorer({
  slug,
  data,
  initialType,
  initialState,
  initialMode,
}: {
  slug: string;
  data: ActAtlasSearchResult;
  initialType?: ActAtlasRecordType;
  initialState?: string;
  initialMode: 'list' | 'map';
}) {
  const [selectedId, setSelectedId] = useState(data.records[0]?.id ?? null);
  const [drawerSubject, setDrawerSubject] = useState<AtlasDrawerSubject | null>(null);
  const current = useMemo(() => ({
    query: data.query,
    type: initialType,
    state: initialState,
    mode: initialMode,
  }), [data.query, initialMode, initialState, initialType]);

  useEffect(() => {
    setSelectedId(data.records[0]?.id ?? null);
    setDrawerSubject(null);
  }, [data.records]);

  const selected = data.records.find((record) => record.id === selectedId) ?? data.records[0] ?? null;
  const locatedCount = data.records.filter((record) => record.latitude !== null && record.longitude !== null).length;

  return (
    <div className="min-h-screen bg-[var(--ws-surface-0)] text-[var(--ws-text)]" data-testid="atlas-shell">
      <ActWorkspacePageHeader
        eyebrow="ACT knowledge field"
        title="ACT Atlas"
        description="Communities, people, funding, procurement and ACT work."
        testId="atlas-control-bar"
        controls={(
          <form action={`/org/${slug}/explore`} method="get" className="flex min-w-0 gap-2" role="search">
            {initialType ? <input type="hidden" name="type" value={initialType} /> : null}
            {initialState ? <input type="hidden" name="state" value={initialState} /> : null}
            <label htmlFor="atlas-search" className="sr-only">Search ACT Atlas</label>
            <input
              id="atlas-search"
              name="q"
              type="search"
              defaultValue={data.query}
              placeholder="Search a region, community, person, organisation, funder or opportunity"
              className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--ws-border)] bg-white px-3.5 text-sm text-[var(--ws-text)] outline-none placeholder:text-[var(--ws-text-tertiary)] focus:border-[var(--ws-accent)] focus:ring-2 focus:ring-[var(--ws-accent)]/15"
            />
            <button type="submit" className="min-h-11 shrink-0 rounded-md bg-[#183426] px-4 text-sm font-semibold text-white hover:bg-[#244b37] focus:outline-none focus:ring-2 focus:ring-[#183426] focus:ring-offset-2">
              Search
            </button>
          </form>
        )}
        meta={(
          <div className="whitespace-nowrap text-right font-mono text-[9px] uppercase tracking-widest text-[var(--ws-text-tertiary)]">
            {data.records.length} shown · {locatedCount} mapped
          </div>
        )}
      />

      <div className="!mx-0 grid min-w-0 !max-w-none lg:grid-cols-[196px_minmax(0,1fr)]" data-testid="atlas-workspace">
        <aside className="min-w-0 border-b border-[var(--ws-border)] bg-[var(--ws-surface-1)] px-4 py-4 sm:px-5 lg:min-h-[calc(100vh-8.75rem)] lg:border-b-0 lg:border-r lg:px-3" aria-label="Atlas filters">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-tertiary)]">Records</div>
          <nav className="mt-2 flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1" aria-label="Record types">
            {TYPE_FILTERS.map((filter) => {
              const active = (initialType ?? '') === filter.value;
              return (
                <Link
                  key={filter.value || 'all'}
                  href={atlasHref(slug, current, { type: filter.value || undefined })}
                  className={`flex min-h-10 shrink-0 items-center justify-between gap-4 rounded-md px-3 text-xs font-semibold transition-colors ${active ? 'bg-[#e8ecba] text-[#183426]' : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)] hover:text-[var(--ws-text)]'}`}
                >
                  <span>{filter.label}</span>
                  <span className="font-mono text-[10px] tabular-nums opacity-70">{typeCount(data, filter.value)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-tertiary)]">State</div>
          <div className="mt-2">
            <label htmlFor="atlas-state" className="sr-only">Filter by state</label>
            <select
              id="atlas-state"
              value={initialState ?? ''}
              onChange={(event) => { window.location.href = atlasHref(slug, current, { state: event.target.value || undefined }); }}
              className="min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs font-semibold text-[var(--ws-text)] outline-none focus:border-[var(--ws-accent)] focus:ring-2 focus:ring-[var(--ws-accent)]/15"
            >
              {STATES.map((state) => <option key={state || 'all'} value={state}>{state || 'All Australia'}</option>)}
            </select>
          </div>

          {(data.query || initialType || initialState) ? (
            <Link href={`/org/${slug}/explore`} className="mt-4 inline-flex min-h-10 items-center text-xs font-semibold text-[var(--ws-accent)] hover:underline">
              Clear search and filters
            </Link>
          ) : null}
        </aside>

        <section className="min-w-0">
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--ws-border)] px-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">
                {data.query ? `Results for “${data.query}”` : 'Starting points'}
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--ws-text-tertiary)]">{data.records.length} records in this view</p>
            </div>
            <div className="flex shrink-0 rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-1)] p-0.5" aria-label="View mode">
              <Link
                href={atlasHref(slug, current, { mode: undefined })}
                aria-current={initialMode === 'list' ? 'page' : undefined}
                className={`min-h-9 rounded px-3 text-xs font-semibold leading-9 ${initialMode === 'list' ? 'bg-[#183426] text-white' : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)]'}`}
              >
                List
              </Link>
              <Link
                href={atlasHref(slug, current, { mode: 'map' })}
                aria-current={initialMode === 'map' ? 'page' : undefined}
                className={`min-h-9 rounded px-3 text-xs font-semibold leading-9 ${initialMode === 'map' ? 'bg-[#183426] text-white' : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)]'}`}
              >
                Map
              </Link>
            </div>
          </div>

          {data.records.length === 0 ? (
            <AtlasEmpty slug={slug} />
          ) : initialMode === 'map' ? (
            <div className="grid xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 border-b border-[var(--ws-border)] bg-white p-3 sm:p-5 xl:border-b-0 xl:border-r">
                <ActAtlasMap records={data.records} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
              </div>
              {selected ? <RecordPanel slug={slug} record={selected} onOpenConnection={(item) => setDrawerSubject({ kind: 'connection', item })} /> : null}
            </div>
          ) : (
            <div className="grid xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="border-b border-[var(--ws-border)] bg-[var(--ws-surface-1)] xl:min-h-[calc(100vh-12.25rem)] xl:border-b-0 xl:border-r">
                {data.records.map((record) => (
                  <ResultRow
                    key={`${record.type}-${record.id}`}
                    record={record}
                    selected={selected?.id === record.id}
                    onSelect={() => setSelectedId(record.id)}
                    onOpenDetails={() => {
                      setSelectedId(record.id);
                      setDrawerSubject({ kind: 'record', record });
                    }}
                  />
                ))}
              </div>
              {selected ? <RecordPanel slug={slug} record={selected} onOpenConnection={(item) => setDrawerSubject({ kind: 'connection', item })} /> : null}
            </div>
          )}
        </section>
      </div>
      <AtlasEntityDrawer subject={drawerSubject} onClose={() => setDrawerSubject(null)} />
    </div>
  );
}

function ResultRow({
  record,
  selected,
  onSelect,
  onOpenDetails,
}: {
  record: ActAtlasRecord;
  selected: boolean;
  onSelect: () => void;
  onOpenDetails: () => void;
}) {
  return (
    <div className={`border-b border-[var(--ws-border)] transition-colors ${selected ? 'bg-[#f1f3d6]' : 'bg-white hover:bg-[var(--ws-surface-2)]'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="block w-full px-4 pb-2 pt-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--ws-accent)]"
      >
        <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-accent)]">{TYPE_LABELS[record.type]}</div>
        <div className="mt-1 text-sm font-semibold leading-5 text-[var(--ws-text)]">{record.name}</div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{record.subtitle || 'No location or identifier recorded'}</div>
        {record.facts[0] ? <div className="mt-2 font-mono text-[10px] text-[var(--ws-text-tertiary)]">{record.facts[0].label}: {record.facts[0].value}</div> : null}
      </button>
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onOpenDetails}
          className="min-h-8 rounded-md border border-[var(--ws-border)] bg-white px-2.5 text-[10px] font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)]"
        >
          Open drawer
        </button>
      </div>
    </div>
  );
}

function RecordPanel({ slug, record, onOpenConnection }: { slug: string; record: ActAtlasRecord; onOpenConnection: (item: ActAtlasConnection) => void }) {
  const relationshipHref = `/org/${slug}?view=relationships#relationships`;
  const secondaryHref = record.type === 'place'
    ? `/org/${slug}/explore?type=community&q=${encodeURIComponent(record.name)}`
    : record.type === 'community' && record.postcode
    ? `/places/${record.postcode}`
    : record.type === 'opportunity'
      ? `/org/${slug}?view=opportunities#opportunities`
      : relationshipHref;
  const secondaryLabel = record.type === 'place'
    ? 'Explore member communities'
    : record.type === 'community' && record.postcode
    ? 'Open place evidence'
    : record.type === 'opportunity'
      ? 'Open ACT opportunities'
      : 'Open relationship desk';

  return (
    <article className="min-w-0 bg-white px-5 py-6 sm:px-7 sm:py-8" data-testid="atlas-record-panel">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-accent)]">{TYPE_LABELS[record.type]}</div>
      <h2 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight tracking-normal sm:text-[30px]">{record.name}</h2>
      {record.subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--ws-text-secondary)]">{record.subtitle}</p> : null}

      {record.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {record.tags.slice(0, 8).map((tag) => (
            <span key={tag} className="rounded bg-[var(--ws-surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--ws-text-secondary)]">{tag.replaceAll('_', ' ')}</span>
          ))}
        </div>
      ) : null}

      {record.context && (record.context.relationshipState || record.context.lastContactAt) ? (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-[var(--ws-border)] py-3 text-xs text-[var(--ws-text-secondary)]">
          {record.context.relationshipState ? (
            <span><strong className="font-semibold text-[var(--ws-text)]">ACT relationship:</strong> {record.context.relationshipState.replaceAll('_', ' ')}</span>
          ) : null}
          {record.context.lastContactAt ? (
            <span><strong className="font-semibold text-[var(--ws-text)]">Last contact:</strong> {formatAtlasDate(record.context.lastContactAt)}</span>
          ) : null}
        </div>
      ) : null}

      {record.facts.length > 0 ? (
        <dl className="mt-7 grid grid-cols-2 border-l border-t border-[var(--ws-border)] sm:grid-cols-3">
          {record.facts.map((fact) => (
            <div key={fact.label} className="min-h-24 border-b border-r border-[var(--ws-border)] p-4">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">{fact.label}</dt>
              <dd className="mt-2 break-words text-lg font-semibold leading-6 tabular-nums text-[var(--ws-text)]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {record.description ? (
        <section className="mt-7 border-t border-[var(--ws-border)] pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">What we know</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ws-text-secondary)]">{record.description}</p>
        </section>
      ) : null}

      {record.context?.sections.length ? (
        <section className="mt-7 border-t border-[var(--ws-border)] pt-6" data-testid="atlas-connections">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">Connection field</h3>
          <ConnectionField key={record.id} sections={record.context.sections} onOpenConnection={onOpenConnection} />
        </section>
      ) : null}

      {record.context?.unknowns.length ? (
        <section className="mt-7 border-l-2 border-[#ad691c] bg-[#fbf8ed] px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#835218]">Still missing</h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--ws-text-secondary)]">
            {record.context.unknowns.slice(0, 3).map((unknown) => <li key={unknown}>{unknown}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="mt-7 border-t border-[var(--ws-border)] pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">{record.context?.nextMove ? 'Recommended next move' : 'Move from here'}</h3>
        {record.context?.nextMove ? (
          <div className="mt-3 max-w-2xl">
            <div className="text-base font-semibold text-[var(--ws-text)]">{record.context.nextMove.title}</div>
            <p className="mt-1 text-sm leading-6 text-[var(--ws-text-secondary)]">{record.context.nextMove.detail}</p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {record.context?.nextMove ? (
            <AtlasHref href={record.context.nextMove.href} className="inline-flex min-h-11 items-center rounded-md bg-[#183426] px-4 text-xs font-semibold text-white hover:bg-[#244b37]">
              Do this next
            </AtlasHref>
          ) : null}
          <Link href={record.href} className={`inline-flex min-h-11 items-center rounded-md px-4 text-xs font-semibold ${record.context?.nextMove ? 'border border-[var(--ws-border)] bg-white text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)]' : 'bg-[#183426] text-white hover:bg-[#244b37]'}`}>
            Open full record
          </Link>
          <Link href={secondaryHref} className="inline-flex min-h-11 items-center rounded-md border border-[var(--ws-border)] bg-white px-4 text-xs font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)]">
            {secondaryLabel}
          </Link>
        </div>
      </section>

      <div className="mt-8 border-t border-[var(--ws-border)] pt-4 font-mono text-[9px] uppercase tracking-widest text-[var(--ws-text-tertiary)]">
        Source: {record.sourceLabel}
      </div>
    </article>
  );
}

function formatAtlasDate(value: string): string {
  if (Number.isNaN(Date.parse(value))) return 'Unknown';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AtlasHref({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

function ConnectionRow({ item, onOpenConnection }: { item: ActAtlasConnection; onOpenConnection: (item: ActAtlasConnection) => void }) {
  return (
    <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-5">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[8px] font-semibold uppercase tracking-widest text-[var(--ws-accent)]">{item.kind}</span>
          <span className="text-sm font-semibold leading-5 text-[var(--ws-text)]">{item.name}</span>
        </div>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--ws-text-secondary)]">{item.detail}</p>
        {item.meta ? <p className="mt-1 text-[11px] leading-5 text-[var(--ws-text-secondary)]">{item.meta}</p> : null}
      </div>
      <div className="flex flex-wrap items-start gap-2 sm:max-w-40 sm:justify-end">
        <div className="w-full font-mono text-[8px] uppercase tracking-widest text-[var(--ws-text-tertiary)] sm:text-right">{item.sourceLabel}</div>
        <button
          type="button"
          onClick={() => onOpenConnection(item)}
          className="min-h-8 rounded-md border border-[var(--ws-border)] bg-white px-2.5 text-[10px] font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)]"
        >
          Open drawer
        </button>
        {item.href ? (
          <AtlasHref href={item.href} className="inline-flex min-h-8 items-center rounded-md border border-[var(--ws-border)] bg-white px-2.5 text-[10px] font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)]">
            Full record
          </AtlasHref>
        ) : null}
      </div>
    </div>
  );
}

function ConnectionField({ sections, onOpenConnection }: { sections: ActAtlasConnectionSection[]; onOpenConnection: (item: ActAtlasConnection) => void }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');
  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  if (!active) return null;

  return (
    <div className="mt-3">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--ws-border)] pb-2" role="tablist" aria-label="Connection groups">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active.id === section.id}
            onClick={() => setActiveId(section.id)}
            className={`min-h-10 shrink-0 rounded-md px-3 text-left text-xs font-semibold ${active.id === section.id ? 'bg-[#e8ecba] text-[#183426]' : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)]'}`}
          >
            {section.title} <span className="ml-1 font-mono text-[9px] opacity-70">{section.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="border-b border-[var(--ws-border)] py-3">
        <div className="divide-y divide-[var(--ws-border)]">
          {active.items.map((item) => <ConnectionRow key={`${item.kind}-${item.id}`} item={item} onOpenConnection={onOpenConnection} />)}
        </div>
        {active.count > active.items.length ? (
          <div className="mt-2 text-[10px] text-[var(--ws-text-tertiary)]">Showing {active.items.length} of {active.count}. Open the full record for the complete evidence.</div>
        ) : null}
      </div>
    </div>
  );
}

function AtlasEntityDrawer({ subject, onClose }: { subject: AtlasDrawerSubject | null; onClose: () => void }) {
  if (!subject) return null;

  const isRecord = subject.kind === 'record';
  const title = isRecord ? subject.record.name : subject.item.name;
  const eyebrow = isRecord ? TYPE_LABELS[subject.record.type] : subject.item.kind.replaceAll('_', ' ');
  const subtitle = isRecord ? subject.record.subtitle : subject.item.detail;
  const description = isRecord ? subject.record.description : subject.item.meta;
  const href = isRecord ? subject.record.href : subject.item.href;
  const sourceLabel = isRecord ? subject.record.sourceLabel : subject.item.sourceLabel;
  const facts = isRecord ? subject.record.facts : [];
  const tags = isRecord ? subject.record.tags : [];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="atlas-entity-drawer-title" data-testid="atlas-entity-drawer">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/30"
        aria-label="Close entity drawer"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-[var(--ws-border)] bg-white shadow-2xl">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--ws-border)] px-5">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-tertiary)]">Atlas drawer</div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)]"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-accent)]">{eyebrow}</div>
          <h2 id="atlas-entity-drawer-title" className="mt-2 text-2xl font-semibold leading-tight tracking-normal">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--ws-text-secondary)]">{subtitle}</p> : null}

          {tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.slice(0, 8).map((tag) => (
                <span key={tag} className="rounded bg-[var(--ws-surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--ws-text-secondary)]">{tag.replaceAll('_', ' ')}</span>
              ))}
            </div>
          ) : null}

          {facts.length > 0 ? (
            <dl className="mt-7 grid grid-cols-2 border-l border-t border-[var(--ws-border)]">
              {facts.map((fact) => (
                <div key={fact.label} className="min-h-20 border-b border-r border-[var(--ws-border)] p-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">{fact.label}</dt>
                  <dd className="mt-2 break-words text-base font-semibold leading-6 tabular-nums text-[var(--ws-text)]">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {description ? (
            <section className="mt-7 border-t border-[var(--ws-border)] pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">Context</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ws-text-secondary)]">{description}</p>
            </section>
          ) : null}

          <section className="mt-7 border-t border-[var(--ws-border)] pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)]">Move from here</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {href ? (
                <AtlasHref href={href} className="inline-flex min-h-11 items-center rounded-md bg-[#183426] px-4 text-xs font-semibold text-white hover:bg-[#244b37]">
                  Open full record
                </AtlasHref>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--ws-border)] bg-white px-4 text-xs font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--ws-accent)]"
              >
                Return to Atlas
              </button>
            </div>
          </section>

          <div className="mt-8 border-t border-[var(--ws-border)] pt-4 font-mono text-[9px] uppercase tracking-widest text-[var(--ws-text-tertiary)]">
            Source: {sourceLabel}
          </div>
        </div>
      </aside>
    </div>
  );
}

function AtlasEmpty({ slug }: { slug: string }) {
  const examples = ['Barkly', 'Tennant Creek', 'Snow Foundation', 'Goods on Country', 'Indigenous housing'];
  return (
    <div className="bg-white px-5 py-14 sm:px-8">
      <h2 className="text-xl font-semibold">No matching records</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ws-text-secondary)]">Try a broader name, place, project or funding theme.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {examples.map((example) => (
          <Link key={example} href={`/org/${slug}/explore?q=${encodeURIComponent(example)}`} className="inline-flex min-h-10 items-center rounded-md border border-[var(--ws-border)] px-3 text-xs font-semibold hover:bg-[var(--ws-surface-2)]">
            {example}
          </Link>
        ))}
      </div>
    </div>
  );
}
