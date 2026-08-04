'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretDown,
  CaretRight,
  CheckCircle,
  CircleNotch,
  FileText,
  Lightbulb,
  MagnifyingGlass,
  Path,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import type {
  ActResourceDeskItem,
  ActResourceDeskSnapshot,
} from '@/lib/services/act-resource-desk';

type ReviewMove = 'verify' | 'act' | 'close';

function prettyDate(value: string | null) {
  if (!value) return 'No closing date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date needs verification';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function decisionLabel(item: ActResourceDeskItem) {
  if (item.queue === 'needs-decision') return 'Decision ready';
  if (item.evidence.deadline === 'current') return `Closes ${prettyDate(item.deadline)}`;
  if (item.evidence.officialSource === 'connected') return 'Source connected';
  return 'Needs a human read';
}

function ReviewForm({
  item,
  orgProfileId,
  onSaved,
}: {
  item: ActResourceDeskItem;
  orgProfileId: string;
  onSaved: () => void;
}) {
  const [whatChanged, setWhatChanged] = useState('');
  const [nextMove, setNextMove] = useState<ReviewMove>('verify');
  const [learningQuestion, setLearningQuestion] = useState('');
  const [owner, setOwner] = useState('');
  const [action, setAction] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function saveReview() {
    if (!whatChanged.trim()) {
      setMessage('Write the human read first—what did you learn or decide?');
      setState('error');
      return;
    }
    if (nextMove === 'act' && (!owner.trim() || !action.trim())) {
      setMessage('An action needs a responsible person and a concrete commitment.');
      setState('error');
      return;
    }

    setState('saving');
    setMessage('');
    try {
      const response = await fetch('/api/opportunity-intelligence/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'record_review',
          orgProfileId,
          signalId: item.id,
          signal: {
            id: item.id,
            title: item.title,
            source: item.source,
            sourceRef: item.sourceRef,
            sourceUrl: item.sourceUrl,
            lane: item.lane,
            project: item.projectLabel ?? 'ACT',
            projects: item.connections.map((connection) => connection.projectLabel),
            organisation: item.organisation,
            amount: item.amount,
            deadline: item.deadline,
          },
          route: {
            id: item.routeId ?? item.id,
            signalId: item.id,
            title: item.title,
            source: item.source,
            sourceRef: item.sourceRef,
            sourceUrl: item.sourceUrl,
            project: item.projectLabel ?? 'ACT',
            project_code: item.projectCode ?? 'ACT-IN',
            project_name: item.projectLabel ?? 'ACT',
            pathway: item.pathway ?? 'monitor',
            evidence_gaps: item.evidence.gaps,
          },
          evidenceGaps: item.evidence.gaps,
          judgment: {
            schemaVersion: 1,
            whatChanged: whatChanged.trim(),
            nextMove,
            nextLearningQuestion: learningQuestion.trim() || undefined,
            commitment: nextMove === 'act'
              ? {
                  kind: 'commitment',
                  owner: owner.trim(),
                  action: action.trim(),
                  dueAt: dueAt || undefined,
                }
              : undefined,
          },
        }),
      });
      const result = await response.json() as {
        error?: string;
        detail?: string;
        status?: string;
        warnings?: string[];
      };
      if (!response.ok || result.status === 'blocked') {
        throw new Error(result.error ?? result.detail ?? result.warnings?.[0] ?? 'The review was not saved.');
      }
      setState('saved');
      setMessage('Human review saved. It will return only when evidence changes or a new review is due.');
      onSaved();
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'The review was not saved.');
    }
  }

  if (state === 'saved') {
    return (
      <div className="rounded-xl border border-[#1f734f]/20 bg-[#edf7f1] p-4 text-sm text-[#15563c]" role="status">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle size={19} weight="fill" aria-hidden />
          Review recorded
        </div>
        <p className="mt-2 text-xs leading-5">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <label htmlFor={`resource-read-${item.id}`} className="text-xs font-semibold text-slate-700">
          What did you learn or decide?
        </label>
        <textarea
          id={`resource-read-${item.id}`}
          value={whatChanged}
          onChange={(event) => setWhatChanged(event.target.value)}
          rows={3}
          placeholder="For example: the official round is current, but Goods needs a partner applicant and community confirmation before pursuing."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:border-[#2f8f64] focus:ring-4 focus:ring-[#2f8f64]/10"
        />
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-slate-700">What happens next?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([
            ['verify', 'Verify'],
            ['act', 'Act'],
            ['close', 'Close'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={nextMove === value}
              onClick={() => setNextMove(value)}
              className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition ${
                nextMove === value
                  ? 'border-[#2f8f64] bg-[#edf7f1] text-[#15563c]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {nextMove === 'act' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">
            Responsible person
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="Name"
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2f8f64] focus:ring-4 focus:ring-[#2f8f64]/10"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Due date
            <input
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2f8f64] focus:ring-4 focus:ring-[#2f8f64]/10"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
            Concrete commitment
            <input
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="What will this person actually do?"
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2f8f64] focus:ring-4 focus:ring-[#2f8f64]/10"
            />
          </label>
        </div>
      ) : null}

      <label className="block text-xs font-semibold text-slate-700">
        Next learning question <span className="font-normal text-slate-400">(optional)</span>
        <input
          value={learningQuestion}
          onChange={(event) => setLearningQuestion(event.target.value)}
          placeholder="What should new evidence help us understand?"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2f8f64] focus:ring-4 focus:ring-[#2f8f64]/10"
        />
      </label>

      {message ? (
        <p className="text-xs leading-5 text-[#9f1c14]" role="alert">{message}</p>
      ) : null}

      <button
        type="button"
        disabled={state === 'saving'}
        onClick={saveReview}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#183426] px-4 text-sm font-semibold text-white transition hover:bg-[#224a36] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8f64]/25 disabled:opacity-60"
      >
        {state === 'saving' ? <CircleNotch size={18} className="animate-spin" aria-hidden /> : null}
        {state === 'saving' ? 'Saving review…' : 'Record this human read'}
      </button>
    </div>
  );
}

function ShortlistItem({
  item,
  active,
  reviewed,
  onSelect,
}: {
  item: ActResourceDeskItem;
  active: boolean;
  reviewed: boolean;
  onSelect: () => void;
}) {
  const connection = item.connections[0];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8f64]/20 ${
        active
          ? 'border-[#2f8f64] bg-[#f1f8f5] shadow-[0_10px_30px_rgba(47,143,100,0.08)]'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold text-[#2563eb]">
          {connection?.projectLabel ?? item.projectLabel ?? 'ACT'}
        </div>
        {reviewed ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#15563c]">
            <CheckCircle size={14} weight="fill" aria-hidden />
            Reviewed
          </span>
        ) : (
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
            {decisionLabel(item)}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold leading-5 text-slate-950">{item.title}</div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <Path size={14} aria-hidden />
        <span className="truncate">{connection?.matterLabel ?? 'Matter connection needs review'}</span>
      </div>
    </button>
  );
}

function DecisionFocus({
  item,
  orgProfileId,
  reviewed,
  onSaved,
}: {
  item: ActResourceDeskItem;
  orgProfileId: string;
  reviewed: boolean;
  onSaved: () => void;
}) {
  const connection = item.connections[0];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Current resource decision">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#2563eb]">
            {connection?.projectLabel ?? item.projectLabel ?? 'ACT'}
            {connection ? ` · ${connection.resourceRole}` : ''}
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-7 tracking-[-0.025em]">{item.title}</h2>
          {item.organisation ? <p className="mt-1 text-sm text-slate-500">{item.organisation}</p> : null}
        </div>
        <div className="text-left sm:text-right">
          <div className="text-base font-semibold text-[#15563c]">{item.amount ?? 'Amount not published'}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 sm:justify-end">
            <CalendarBlank size={15} aria-hidden />
            {prettyDate(item.deadline)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-[#fffaf1] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7c5f21]">
            <Lightbulb size={17} aria-hidden />
            Why look now
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{item.whyNow}</p>
        </div>
        <div className="rounded-xl bg-[#f3f6ff] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1d4ed8]">
            <Path size={17} aria-hidden />
            What it could resource
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
            {connection?.matterLabel ?? 'No concrete matter connected'}
          </p>
        </div>
        <div className="rounded-xl bg-[#fff7f5] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#9f1c14]">
            <WarningCircle size={17} aria-hidden />
            Before deciding
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {item.evidence.gaps[0]
              ?? (item.evidence.officialSource === 'missing'
                ? 'Connect the official source.'
                : 'Confirm authority, applicant and the useful scope of work.')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowSquareOut size={18} aria-hidden />
            Open official source
          </a>
        ) : null}
        {item.matterHref ? (
          <Link
            href={item.matterHref}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Path size={18} aria-hidden />
            Open matter
          </Link>
        ) : null}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">Human decision</div>
            <p className="mt-1 text-sm font-semibold">Keep the read, not another invisible mental note.</p>
          </div>
          <UserCircle size={28} className="text-slate-400" aria-hidden />
        </div>
        {reviewed ? (
          <div className="rounded-xl border border-[#1f734f]/20 bg-[#edf7f1] p-4 text-sm font-semibold text-[#15563c]">
            This opportunity was reviewed in this session.
          </div>
        ) : (
          <ReviewForm item={item} orgProfileId={orgProfileId} onSaved={onSaved} />
        )}
      </div>
    </section>
  );
}

export function ActResourceDesk({
  snapshot,
  orgProfileId,
}: {
  snapshot: ActResourceDeskSnapshot;
  orgProfileId: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(snapshot.shortlist[0]?.id ?? null);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('all');

  const shortlist = snapshot.shortlist.filter((item) => !reviewedIds.includes(item.id));
  const selected = snapshot.items.find((item) => item.id === selectedId)
    ?? shortlist[0]
    ?? snapshot.shortlist[0]
    ?? null;
  const projects = useMemo(
    () => Array.from(new Map(
      snapshot.items.flatMap((item) => item.connections)
        .map((connection) => [connection.projectId, connection.projectLabel]),
    ).entries()).sort((left, right) => left[1].localeCompare(right[1])),
    [snapshot.items],
  );
  const backlog = useMemo(() => {
    const search = query.trim().toLowerCase();
    return snapshot.items.filter((item) => {
      if (item.lane !== 'grant') return false;
      if (project !== 'all' && !item.connections.some((connection) => connection.projectId === project)) return false;
      if (!search) return true;
      return `${item.title} ${item.organisation ?? ''} ${item.connections.map((connection) => connection.matterLabel).join(' ')}`
        .toLowerCase()
        .includes(search);
    });
  }, [project, query, snapshot.items]);

  function recordSaved(itemId: string) {
    setReviewedIds((current) => [...current, itemId]);
    const next = shortlist.find((item) => item.id !== itemId);
    setSelectedId(next?.id ?? null);
  }

  return (
    <main className="!mx-0 min-h-screen !max-w-none bg-[#f5f7f8] text-slate-950">
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>ACT</span>
              <CaretRight size={12} weight="bold" aria-hidden />
              <span>Resource decisions</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              What should we do next?
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              A small human shortlist from the opportunities already gathered. Read one, decide one, retain what changed.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              [snapshot.shortlist.length, 'worth reading'],
              [snapshot.items.filter((item) => item.lane === 'grant').length, 'grant records'],
              [reviewedIds.length, 'reviewed now'],
            ].map(([value, label]) => (
              <div key={label} className="min-w-[88px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <div className="text-lg font-semibold">{value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="!mx-0 !max-w-none space-y-5 p-4 sm:p-6 lg:p-7">
        {selected ? (
          <div className="grid items-start gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
            <section aria-label="Today's resource shortlist">
              <div className="mb-3 flex items-end justify-between gap-3 px-1">
                <div>
                  <h2 className="text-base font-semibold">Today’s shortlist</h2>
                  <p className="mt-1 text-xs text-slate-500">Not a ranking. The clearest next human reads.</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{shortlist.length} left</span>
              </div>
              <div className="space-y-2">
                {shortlist.map((item) => (
                  <ShortlistItem
                    key={item.id}
                    item={item}
                    active={item.id === selected.id}
                    reviewed={reviewedIds.includes(item.id)}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            </section>
            <DecisionFocus
              key={selected.id}
              item={selected}
              orgProfileId={orgProfileId}
              reviewed={reviewedIds.includes(selected.id)}
              onSaved={() => recordSaved(selected.id)}
            />
          </div>
        ) : (
          <section className="rounded-2xl border border-[#1f734f]/20 bg-[#edf7f1] px-6 py-12 text-center">
            <CheckCircle size={32} weight="fill" className="mx-auto text-[#2f8f64]" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold text-[#15563c]">The shortlist is clear</h2>
            <p className="mt-2 text-sm text-slate-600">New matters return when evidence changes or a review becomes due.</p>
          </section>
        )}

        <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 marker:hidden">
            <div>
              <div className="text-sm font-semibold">All gathered grant signals</div>
              <div className="mt-1 text-xs text-slate-500">
                Use this for retrieval and cleanup—not as the daily work queue.
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              {snapshot.items.filter((item) => item.lane === 'grant').length} records
              <CaretDown size={17} aria-hidden />
            </div>
          </summary>
          <div className="border-t border-slate-200 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block">
                <span className="sr-only">Search gathered grants</span>
                <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a grant, funder or matter"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-[#2f8f64] focus:bg-white focus:ring-4 focus:ring-[#2f8f64]/10"
                />
              </label>
              <label>
                <span className="sr-only">Filter gathered grants by project</span>
                <select
                  value={project}
                  onChange={(event) => setProject(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#2f8f64] focus:ring-4 focus:ring-[#2f8f64]/10"
                >
                  <option value="all">All projects</option>
                  {projects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {backlog.slice(0, 40).map((item) => (
                <div key={item.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_160px_130px] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {item.connections[0]?.projectLabel ?? 'No project'} · {item.sourceLabel}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{prettyDate(item.deadline)}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      document.querySelector('main')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Review this
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>

        <section className="rounded-2xl bg-[#183426] p-5 text-white">
          <div className="flex items-start gap-3">
            <FileText size={22} className="shrink-0 text-[#e7ef65]" aria-hidden />
            <div>
              <div className="text-sm font-semibold">The backlog is evidence, not the interface.</div>
              <p className="mt-1 text-xs leading-5 text-[#c7d1ca]">
                The daily surface stays small. The full collection remains searchable underneath for provenance, repair and future learning.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
