'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ActPeopleDirectoryPage,
  ActPeopleFilter,
  ActPersonDirectoryRow,
  ActPersonHistoryEvent,
  ActPersonIdentityStatus,
} from '@/lib/services/act-people-directory';

const FILTERS: Array<{ value: ActPeopleFilter; label: string }> = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'connected', label: 'Connected' },
  { value: 'money', label: 'Money' },
  { value: 'unresolved', label: 'Resolve' },
  { value: 'all', label: 'All people' },
];

export function ActPeopleDirectory({ orgProfileId }: { orgProfileId: string }) {
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ActPeopleFilter>('attention');
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState<ActPeopleDirectoryPage | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState<ActPersonHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ filter, page: String(page), page_size: '60' });
      if (query) params.set('q', query);
      const response = await fetch(`/api/org/${orgProfileId}/people-directory?${params}`, { signal });
      const payload = await response.json() as ActPeopleDirectoryPage & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load ACT people');
      setDirectory(payload);
      setSelectedId((current) => payload.people.some((person) => person.id === current)
        ? current
        : payload.people[0]?.id ?? '');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Could not load ACT people');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filter, orgProfileId, page, query]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDirectory(controller.signal);
    return () => controller.abort();
  }, [loadDirectory]);

  const selected = useMemo(
    () => directory?.people.find((person) => person.id === selectedId) ?? directory?.people[0] ?? null,
    [directory?.people, selectedId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setHistory([]);
    if (!selected?.ghlId) {
      setHistoryLoading(false);
      return () => controller.abort();
    }

    setHistoryLoading(true);
    void fetch(`/api/org/${orgProfileId}/people-directory?person=${encodeURIComponent(selected.ghlId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { history?: ActPersonHistoryEvent[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Could not load contact history');
        setHistory(payload.history ?? []);
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setHistory([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [orgProfileId, selected?.ghlId]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  }

  function chooseFilter(value: ActPeopleFilter) {
    setPage(1);
    setFilter(value);
  }

  if (!directory && loading) return <PeopleLoading />;
  if (!directory && error) {
    return (
      <div className="grid min-h-[420px] place-items-center bg-[#fbfcfa] p-8 text-center">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ws-text)]">People could not be loaded</h3>
          <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void loadDirectory()} className="mt-4 min-h-11 rounded-md bg-[#183426] px-4 text-sm font-semibold text-white">Try again</button>
        </div>
      </div>
    );
  }

  if (!directory) return null;

  const pageCount = Math.max(1, Math.ceil(directory.total / directory.pageSize));

  return (
    <div className="min-w-0 bg-[#fbfcfa]">
      <header className="border-b border-[var(--ws-border)] bg-white px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">ACT network</div>
            <h3 className="mt-2 text-xl font-semibold text-[var(--ws-text)]">Every person, connection and next move</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ws-text-secondary)]">
              Canonical people are joined across CivicGraph, CRM, communication summaries, projects and money records.
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[var(--ws-border)] rounded-md border border-[var(--ws-border)] bg-[#f7f8f5] sm:grid-cols-6">
            <PeopleMetric label="People" value={directory.summary.people} />
            <PeopleMetric label="Canonical" value={directory.summary.canonical} />
            <PeopleMetric label="History" value={directory.summary.withHistory} />
            <PeopleMetric label="Money" value={directory.summary.withMoney} />
            <PeopleMetric label="Projects" value={directory.summary.withProjects} />
            <PeopleMetric label="Resolve" value={directory.summary.needsResolution} warning />
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--ws-border)] bg-[#f7f8f5] px-4 py-4 sm:px-6">
        <form onSubmit={submitSearch} className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search people, organisations, projects and tags</span>
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search a person, organisation or project"
              className="min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-sm text-[var(--ws-text)] outline-none focus:border-[#2f6b4a] focus:ring-2 focus:ring-[#2f6b4a]/15"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-md bg-[#183426] px-5 text-sm font-semibold text-white hover:bg-[#244b38]">Search</button>
          {query ? (
            <button type="button" onClick={() => { setDraftQuery(''); setQuery(''); setPage(1); }} className="min-h-11 px-3 text-sm font-semibold text-[#2f6b4a] hover:underline">Clear</button>
          ) : null}
        </form>
        <div className="mt-3 flex gap-1 overflow-x-auto" aria-label="People filters">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => chooseFilter(item.value)}
              aria-pressed={filter === item.value}
              className={`min-h-10 shrink-0 rounded-md px-3 text-xs font-semibold ${filter === item.value ? 'bg-[#dce9df] text-[#183426]' : 'text-[var(--ws-text-secondary)] hover:bg-white'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-7">{error}</div> : null}

      <div className="grid min-w-0 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-[var(--ws-border)] bg-[var(--ws-surface-2)] xl:border-b-0 xl:border-r">
          <div className="flex min-h-12 items-center justify-between border-b border-[var(--ws-border)] px-4">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--ws-text-tertiary)]">
              {directory.total.toLocaleString()} {directory.total === 1 ? 'person' : 'people'}
            </span>
            {loading ? <span className="text-xs text-[#2f6b4a]">Refreshing...</span> : null}
          </div>
          <div className="max-h-[780px] divide-y divide-[var(--ws-border)] overflow-y-auto">
            {directory.people.map((person) => (
              <PersonListRow
                key={person.id}
                person={person}
                selected={selected?.id === person.id}
                onSelect={() => setSelectedId(person.id)}
              />
            ))}
            {directory.people.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-[var(--ws-text-secondary)]">No people match this view.</div>
            ) : null}
          </div>
          {pageCount > 1 ? (
            <div className="flex min-h-14 items-center justify-between border-t border-[var(--ws-border)] bg-white px-3">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-10 px-3 text-xs font-semibold text-[#2f6b4a] disabled:opacity-35">Previous</button>
              <span className="font-mono text-[9px] text-[var(--ws-text-tertiary)]">{page} / {pageCount}</span>
              <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="min-h-10 px-3 text-xs font-semibold text-[#2f6b4a] disabled:opacity-35">Next</button>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 bg-white">
          {selected ? <PersonDossier person={selected} history={history} historyLoading={historyLoading} /> : <EmptyPerson />}
        </main>
      </div>
    </div>
  );
}

function PersonListRow({ person, selected, onSelect }: { person: ActPersonDirectoryRow; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full min-w-0 px-4 py-4 text-left transition ${selected ? 'bg-[#eaf2ec] shadow-[inset_3px_0_0_#2f6b4a]' : 'hover:bg-white'}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--ws-text)]">{person.name}</div>
          <div className="mt-1 truncate text-xs text-[var(--ws-text-secondary)]">{person.organisation || person.role || 'Organisation not linked'}</div>
        </div>
        <IdentityBadge status={person.identityStatus} compact />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">
        <span>{person.touchpoints} touches</span>
        <span>{person.lastContactAt ? `Last ${formatShortDate(person.lastContactAt)}` : 'No dated history'}</span>
        {person.projects[0] ? <span className="text-[#2f6b4a]">{person.projects[0]}</span> : null}
      </div>
      {(person.pipelineValue > 0 || person.receivedFromThem > 0 || person.paidToThem > 0) ? (
        <div className="mt-2 text-[10px] font-semibold text-[#795b12]">Money connected · {formatMoney(Math.max(person.pipelineValue, person.receivedFromThem, person.paidToThem))}</div>
      ) : null}
    </button>
  );
}

function PersonDossier({ person, history, historyLoading }: { person: ActPersonDirectoryRow; history: ActPersonHistoryEvent[]; historyLoading: boolean }) {
  return (
    <article className="min-w-0">
      <header className="border-b border-[var(--ws-border)] px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <IdentityBadge status={person.identityStatus} />
              {person.relationshipStrength ? <SmallPill label={humanise(person.relationshipStrength)} /> : null}
              {person.stage ? <SmallPill label={humanise(person.stage)} /> : null}
            </div>
            <h3 className="mt-3 break-words text-2xl font-semibold text-[var(--ws-text)]">{person.name}</h3>
            <p className="mt-1 text-sm text-[var(--ws-text-secondary)]">
              {[person.role, person.canonicalOrganisationName || person.organisation].filter(Boolean).join(' · ') || 'Role and organisation not yet verified'}
            </p>
            {person.email ? <p className="mt-2 break-all font-mono text-[10px] text-[var(--ws-text-tertiary)]">{person.email}</p> : null}
          </div>
          <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-[var(--ws-border)] rounded-md border border-[var(--ws-border)] sm:grid-cols-4 sm:divide-y-0">
            <DossierMetric label="Touches" value={person.touchpoints.toLocaleString()} />
            <DossierMetric label="Projects" value={person.projects.length.toLocaleString()} />
            <DossierMetric label="Money in" value={formatMoney(person.receivedFromThem)} />
            <DossierMetric label="Paid out" value={formatMoney(person.paidToThem)} />
          </div>
        </div>
      </header>

      <section className="grid border-b border-[var(--ws-border)] lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
        <div className="border-b border-[var(--ws-border)] bg-[#edf5ef] px-5 py-5 sm:px-7 lg:border-b-0 lg:border-r">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Recommended next move</div>
          <p className="mt-2 text-base font-semibold leading-relaxed text-[#183426]">{person.recommendedMove}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {person.projects.map((project) => <SmallPill key={project} label={project} strong />)}
            {person.riskFlags.map((risk) => <SmallPill key={risk} label={humanise(risk)} warning />)}
          </div>
        </div>
        <div className="px-5 py-5 sm:px-7">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-tertiary)]">Evidence gaps</div>
          {person.evidenceGaps.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs text-[var(--ws-text-secondary)]">
              {person.evidenceGaps.map((gap) => <li key={gap} className="flex gap-2"><span aria-hidden className="text-amber-600">●</span><span>{humanise(gap)}</span></li>)}
            </ul>
          ) : <p className="mt-3 text-xs font-semibold text-emerald-700">Core identity, organisation, history and project evidence are connected.</p>}
        </div>
      </section>

      <section className="grid border-b border-[var(--ws-border)] sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="First contact" value={person.firstContactAt ? formatDate(person.firstContactAt) : 'Not recorded'} />
        <Fact label="Last contact" value={person.lastContactAt ? formatDate(person.lastContactAt) : 'Not recorded'} />
        <Fact label="Pipeline" value={`${person.opportunityCount} opportunities · ${formatMoney(person.pipelineValue)}`} />
        <Fact label="Identity confidence" value={identityConfidence(person)} />
      </section>

      <section className="px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Complete ACT history</div>
            <h4 className="mt-2 text-lg font-semibold text-[var(--ws-text)]">What ACT tried, what happened, what comes next</h4>
          </div>
          <div className="text-xs text-[var(--ws-text-tertiary)]">Summaries only · private message bodies stay out</div>
        </div>

        {historyLoading ? <HistoryLoading /> : history.length > 0 ? (
          <ol className="mt-5 border-l border-[#c8d7cc] pl-5">
            {history.map((event) => <HistoryRow key={event.id} event={event} />)}
          </ol>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-[var(--ws-border)] bg-[#fafbf9] px-5 py-8 text-center">
            <p className="text-sm font-semibold text-[var(--ws-text)]">No dated communication history is connected.</p>
            <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">This may be a new relationship or an identity that still needs resolution.</p>
          </div>
        )}

        <div className="mt-6 grid gap-4 border-t border-[var(--ws-border)] pt-5 lg:grid-cols-2">
          <div>
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-tertiary)]">Identity provenance</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {person.sources.length > 0 ? person.sources.map((source) => <SmallPill key={source} label={humanise(source)} />) : <span className="text-xs text-[var(--ws-text-secondary)]">No source provenance recorded</span>}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-tertiary)]">Contact balance</div>
            <p className="mt-3 text-xs text-[var(--ws-text-secondary)]">{person.inboundCount} inbound · {person.outboundCount} outbound · {person.emailCount} email records</p>
          </div>
        </div>
      </section>
    </article>
  );
}

function HistoryRow({ event }: { event: ActPersonHistoryEvent }) {
  return (
    <li className="relative pb-6 pl-3 last:pb-0">
      <span aria-hidden className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2f6b4a] ring-1 ring-[#8aa795]" />
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase text-[var(--ws-text-tertiary)]">
        <span>{event.happenedAt ? formatDate(event.happenedAt) : 'Date unknown'}</span>
        <span>·</span>
        <span>{humanise(event.channel)}</span>
        {event.direction ? <span>· {humanise(event.direction)}</span> : null}
        {event.waitingForResponse ? <SmallPill label="Waiting for response" warning /> : null}
      </div>
      <h5 className="mt-2 text-sm font-semibold text-[var(--ws-text)]">{event.title}</h5>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--ws-text-secondary)]">{event.summary}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {event.projectCodes.map((code) => <SmallPill key={code} label={code} strong />)}
        {event.decisions.map((decision) => <SmallPill key={decision} label={decision} />)}
        {event.followUpAt ? <SmallPill label={`Follow up ${formatShortDate(event.followUpAt)}`} warning /> : null}
      </div>
    </li>
  );
}

function IdentityBadge({ status, compact = false }: { status: ActPersonIdentityStatus; compact?: boolean }) {
  const styles: Record<ActPersonIdentityStatus, string> = {
    canonical: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    mapped: 'border-blue-200 bg-blue-50 text-blue-700',
    unresolved: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  const label: Record<ActPersonIdentityStatus, string> = {
    canonical: 'Canonical',
    mapped: 'Mapped',
    unresolved: 'Resolve identity',
  };
  return <span className={`shrink-0 rounded border font-mono font-semibold uppercase ${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[9px]'} ${styles[status]}`}>{label[status]}</span>;
}

function SmallPill({ label, strong = false, warning = false }: { label: string; strong?: boolean; warning?: boolean }) {
  const style = warning
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : strong ? 'border-[#b9cbbd] bg-white text-[#2f6b4a]' : 'border-[var(--ws-border)] bg-[#f7f8f5] text-[var(--ws-text-secondary)]';
  return <span className={`rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${style}`}>{label}</span>;
}

function PeopleMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className="min-w-[74px] px-3 py-2 text-center"><div className={`font-mono text-base font-semibold ${warning && value > 0 ? 'text-amber-700' : 'text-[var(--ws-text)]'}`}>{value.toLocaleString()}</div><div className="mt-0.5 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{label}</div></div>;
}

function DossierMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[86px] px-3 py-3 text-center"><div className="text-sm font-semibold text-[var(--ws-text)]">{value}</div><div className="mt-1 font-mono text-[8px] uppercase text-[var(--ws-text-tertiary)]">{label}</div></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-[var(--ws-border)] p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"><div className="font-mono text-[8px] font-semibold uppercase text-[var(--ws-text-tertiary)]">{label}</div><div className="mt-2 break-words text-sm font-semibold text-[var(--ws-text)]">{value}</div></div>;
}

function PeopleLoading() {
  return <div className="grid min-h-[520px] place-items-center bg-[#fbfcfa]"><div className="text-center"><div className="mx-auto h-8 w-8 animate-pulse rounded-full bg-[#dce9df]" /><p className="mt-3 text-sm font-semibold text-[#2f6b4a]">Connecting ACT people and history...</p></div></div>;
}

function HistoryLoading() {
  return <div className="mt-5 space-y-3" aria-label="Loading contact history">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-md bg-[#f1f4f0]" />)}</div>;
}

function EmptyPerson() {
  return <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm text-[var(--ws-text-secondary)]">Choose a person to review their complete ACT relationship.</div>;
}

function identityConfidence(person: ActPersonDirectoryRow): string {
  const confidence = person.identityConfidence ?? person.dataQualityScore;
  if (confidence == null) return person.identityStatus === 'unresolved' ? 'Needs resolution' : 'Mapped';
  return `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}% · ${person.identityStatus}`;
}

function humanise(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}
