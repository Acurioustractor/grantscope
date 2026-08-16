'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { SmallIndex, IndexedReport, IndexedQuestion, IndexedTheme, IndexedObject } from './search-index';

// --- Live-kind result shapes (from /api/global-search?scope=full) ---

interface EntityResult {
  id: string;
  name: string;
  entityType: string;
  abn: string | null;
  state: string | null;
  sourceCount: number;
  revenue: number | null;
  href: string;
}

interface FoundationResult {
  id: string;
  name: string;
  abn: string | null;
  totalGiving: number | null;
  focus: string[] | null;
  href: string;
}

interface GrantResult {
  id: string;
  name: string;
  amountMin: number | null;
  amountMax: number | null;
  closesAt: string | null;
  programType: string | null;
  source: string | null;
  href: string;
}

interface PersonResult {
  name: string;
  boardCount: number;
  href: string;
}

interface PlaceResult {
  postcode: string;
  locality: string | null;
  state: string | null;
  lga: string | null;
  href: string;
}

interface LiveResults {
  entities: EntityResult[];
  foundations: FoundationResult[];
  grants: GrantResult[];
  people: PersonResult[];
  places: PlaceResult[];
}

const EMPTY_LIVE: LiveResults = { entities: [], foundations: [], grants: [], people: [], places: [] };

const GROUP_CAP = 8;

function formatMoney(amount: number | null): string {
  if (!amount) return '';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

/** In-memory filter over the small kinds. Instant, offline, no round trip. */
function filterSmall(index: SmallIndex, q: string) {
  return {
    reports: index.reports.filter((r) => matches(q, r.label, r.section)),
    questions: index.questions.filter((r) => matches(q, r.question, r.subject, r.slug)),
    themes: index.themes.filter((r) => matches(q, r.title, r.description)),
    objects: index.objects.filter((r) => matches(q, r.key, r.name, r.domain)),
  };
}

export function SearchClient({ index, initialQuery }: { index: SmallIndex; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [live, setLive] = useState<LiveResults>(EMPTY_LIVE);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const active = q.length >= 2;

  // Shareable URL: keep ?q= in sync without a navigation.
  useEffect(() => {
    const url = query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search';
    window.history.replaceState(null, '', url);
  }, [query]);

  // Live kinds: entities, foundations, grants, people, places — debounced.
  useEffect(() => {
    if (!active) {
      setLive(EMPTY_LIVE);
      setLiveLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLiveLoading(true);
      setLiveError(false);
      fetch(`/api/global-search?q=${encodeURIComponent(query.trim())}&scope=full`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          setLive({
            entities: Array.isArray(data.entities) ? data.entities : [],
            foundations: Array.isArray(data.foundations) ? data.foundations : [],
            grants: Array.isArray(data.grants) ? data.grants : [],
            people: Array.isArray(data.people) ? data.people : [],
            places: Array.isArray(data.places) ? data.places : [],
          });
          setLiveLoading(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setLiveLoading(false);
            setLiveError(true);
          }
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, active]);

  const small = useMemo(() => (active ? filterSmall(index, q) : null), [index, q, active]);

  return (
    <div>
      {/* Search input */}
      <div className="border-4 border-bauhaus-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] flex items-center">
        <svg className="w-5 h-5 ml-4 text-bauhaus-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
          <path strokeLinecap="square" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything…"
          className="flex-1 px-4 py-4 text-lg font-bold text-bauhaus-black placeholder:text-bauhaus-muted placeholder:font-medium outline-none bg-transparent"
        />
        {liveLoading && (
          <div className="flex gap-1 mr-4">
            <div className="w-2 h-2 bg-bauhaus-black animate-pulse" />
            <div className="w-2 h-2 bg-bauhaus-black animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-bauhaus-black animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>

      {!active && (
        <p className="mt-6 text-sm font-bold text-bauhaus-muted">
          Type at least two characters. {index.reports.length} reports, {index.questions.length} registered
          questions, {index.themes.length} themes and {index.objects.length.toLocaleString()} data objects are
          searched instantly; entities, people, places and grants query live.
        </p>
      )}

      {active && small && (
        <div className="mt-6 space-y-6">
          <Group title="Reports" count={small.reports.length}>
            {small.reports.slice(0, GROUP_CAP).map((r) => (
              <ReportRow key={r.href} r={r} />
            ))}
          </Group>

          <Group title="Questions" count={small.questions.length}>
            {small.questions.slice(0, GROUP_CAP).map((r) => (
              <QuestionRow key={r.slug} r={r} />
            ))}
          </Group>

          <Group title="Themes" count={small.themes.length}>
            {small.themes.slice(0, GROUP_CAP).map((r) => (
              <ThemeRow key={r.slug} r={r} />
            ))}
          </Group>

          <Group title="Entities" count={live.entities.length} loading={liveLoading} error={liveError}>
            {live.entities.map((r) => (
              <Row key={r.id} href={r.href} title={r.name} right={r.revenue ? formatMoney(r.revenue) : r.entityType}
                sub={[r.abn ? `ABN ${r.abn}` : null, r.state, `${r.sourceCount} source${r.sourceCount === 1 ? '' : 's'}`]} />
            ))}
          </Group>

          <Group title="People" count={live.people.length} loading={liveLoading} error={liveError}>
            {live.people.map((r) => (
              <Row key={r.href} href={r.href} title={r.name} right={`${r.boardCount} boards`} sub={[]} />
            ))}
          </Group>

          <Group title="Places" count={live.places.length} loading={liveLoading} error={liveError}>
            {live.places.map((r) => (
              <Row key={r.postcode} href={r.href} title={`${r.postcode}${r.locality ? ` — ${r.locality}` : ''}`}
                right={r.state ?? ''} sub={[r.lga]} />
            ))}
          </Group>

          <Group title="Grants" count={live.grants.length} loading={liveLoading} error={liveError}>
            {live.grants.map((r) => (
              <Row key={r.id} href={r.href} title={r.name}
                right={r.amountMax || r.amountMin ? formatMoney(r.amountMax || r.amountMin) : ''}
                sub={[r.programType, r.source, r.closesAt ? `Closes ${r.closesAt}` : null]} />
            ))}
          </Group>

          <Group title="Foundations" count={live.foundations.length} loading={liveLoading} error={liveError}>
            {live.foundations.map((r) => (
              <Row key={r.id} href={r.href} title={r.name}
                right={r.totalGiving ? `${formatMoney(r.totalGiving)}/yr` : ''}
                sub={[r.abn ? `ABN ${r.abn}` : null, ...(r.focus?.slice(0, 2) ?? [])]} />
            ))}
          </Group>

          <Group title="Data objects" count={small.objects.length}>
            {small.objects.slice(0, GROUP_CAP).map((r) => (
              <ObjectRow key={r.key} r={r} />
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}

/**
 * A group renders even when empty: "no reports match" is information,
 * not noise — it tells you which kind the thing you want is not.
 */
function Group({ title, count, loading, error, children }: {
  title: string;
  count: number;
  loading?: boolean;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-4 border-bauhaus-black bg-white">
      <div className="px-4 py-2 bg-bauhaus-black flex items-center justify-between">
        <span className="text-[10px] font-black text-white uppercase tracking-widest">{title}</span>
        <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">
          {error ? 'search failed' : loading && count === 0 ? '…' : count === 0 ? 'no matches' : count > GROUP_CAP ? `${GROUP_CAP} of ${count.toLocaleString()}` : count}
        </span>
      </div>
      {count > 0 && <div className="divide-y divide-bauhaus-black/10">{children}</div>}
    </section>
  );
}

function Row({ href, title, right, sub }: { href: string; title: string; right?: string; sub: (string | null | undefined)[] }) {
  const subText = sub.filter(Boolean).join(' · ');
  return (
    <Link href={href} className="block px-4 py-3 hover:bg-bauhaus-canvas transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-bauhaus-black truncate">{title}</div>
          {subText && <div className="text-[11px] text-bauhaus-muted font-medium truncate">{subText}</div>}
        </div>
        {right && <span className="text-xs font-black text-bauhaus-black shrink-0">{right}</span>}
      </div>
    </Link>
  );
}

function ReportRow({ r }: { r: IndexedReport }) {
  return <Row href={r.href} title={r.label} right={r.status ?? undefined} sub={[r.section]} />;
}

function QuestionRow({ r }: { r: IndexedQuestion }) {
  return <Row href={r.href} title={r.question} right={r.headline ?? undefined} sub={[r.subject]} />;
}

function ThemeRow({ r }: { r: IndexedTheme }) {
  return <Row href={r.href} title={r.title} sub={[r.description]} />;
}

function ObjectRow({ r }: { r: IndexedObject }) {
  return <Row href={r.href} title={r.key} right={r.objectKind} sub={[r.name !== r.key ? r.name : null, r.domain]} />;
}
