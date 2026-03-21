'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// --- Types ---

interface EntityResult {
  type: 'entity';
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
  type: 'foundation';
  id: string;
  name: string;
  foundationType: string | null;
  abn: string | null;
  totalGiving: number | null;
  focus: string[] | null;
  href: string;
}

interface GrantResult {
  type: 'grant';
  id: string;
  name: string;
  amountMin: number | null;
  amountMax: number | null;
  closesAt: string | null;
  programType: string | null;
  source: string | null;
  href: string;
}

type SearchResult = EntityResult | FoundationResult | GrantResult;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AskResultData = { question: string; generated_sql: string; results: Record<string, any>[]; count: number; explanation: string };

// --- Helpers ---

function formatMoney(amount: number | null): string {
  if (!amount) return '';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charity: 'Charity', foundation: 'Foundation', company: 'Company',
    government_body: 'Govt', indigenous_corp: 'Indigenous Corp',
    political_party: 'Political Party', social_enterprise: 'Social Enterprise',
    trust: 'Trust', person: 'Person',
  };
  return labels[type] || type;
}

function typeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    entity: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-black',
    foundation: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
    grant: 'border-money bg-money-light text-money',
  };
  return colors[type] || 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '\u2014';
  if (typeof v === 'number') return v.toLocaleString('en-AU');
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function detectMode(query: string): 'search' | 'ask' {
  const trimmed = query.trim();
  if (!trimmed) return 'search';
  const isQuestion = /^(how|what|which|who|when|where|why|show|list|give|find|compare)\b/i.test(trimmed);
  if (isQuestion) return 'ask';
  const words = trimmed.split(/\s+/);
  const hasOperators = /\b(and|or|by|from|in|during|with|between|vs|versus)\b/i.test(trimmed);
  if (words.length >= 5 && hasOperators) return 'ask';
  return 'search';
}

// --- Examples ---

const EXAMPLES: { label: string; query: string }[] = [
  { label: 'Commonwealth Bank', query: 'Commonwealth Bank' },
  { label: 'Top 10 by power score', query: 'Show me the top 10 entities by power score' },
  { label: 'Remote NT charities', query: 'Remote NT charities' },
  { label: 'QLD youth justice spend', query: 'How much does QLD spend on youth justice?' },
  { label: 'Funding deserts by state', query: 'Show funding deserts by state' },
];

// --- Component ---

export function UnifiedSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'ask'>('search');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ entities: EntityResult[]; foundations: FoundationResult[]; grants: GrantResult[] } | null>(null);
  const [askResult, setAskResult] = useState<AskResultData | null>(null);
  const [error, setError] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update mode as user types
  useEffect(() => {
    setMode(detectMode(query));
  }, [query]);

  // Debounced search for entity mode
  useEffect(() => {
    if (mode !== 'search' || !query || query.length < 2) {
      if (mode === 'search') setSearchResults(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError('');

      fetch(`/api/global-search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          setSearchResults(data);
          setSelectedIndex(0);
          setLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            setLoading(false);
            setError('Search failed');
          }
        });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  // Submit ask query
  const handleAskSubmit = useCallback(async (q?: string) => {
    const queryText = q || query;
    if (!queryText.trim()) return;

    abortRef.current?.abort();
    setLoading(true);
    setError('');
    setAskResult(null);
    setSearchResults(null);
    setShowSql(false);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: queryText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (data.generated_sql) setAskResult(data);
      } else {
        setAskResult(data);
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Handle enter key + keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (mode === 'ask' && e.key === 'Enter') {
      e.preventDefault();
      handleAskSubmit();
      return;
    }

    const allResults: SearchResult[] = searchResults
      ? [...searchResults.entities, ...searchResults.foundations, ...searchResults.grants]
      : [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault();
      router.push(allResults[selectedIndex].href);
    }
  }, [mode, searchResults, selectedIndex, handleAskSubmit, router]);

  // Handle example chip click
  const handleExample = useCallback((ex: { label: string; query: string }) => {
    setQuery(ex.query);
    const exMode = detectMode(ex.query);
    setMode(exMode);
    if (exMode === 'ask') {
      // Need to trigger ask immediately
      setTimeout(() => handleAskSubmit(ex.query), 0);
    }
    // search mode triggers automatically via useEffect
  }, [handleAskSubmit]);

  const allResults: SearchResult[] = searchResults
    ? [...searchResults.entities, ...searchResults.foundations, ...searchResults.grants]
    : [];
  const hasSearchResults = allResults.length > 0;
  const hasAskResults = askResult?.results && askResult.results.length > 0;
  const hasAnyResults = hasSearchResults || hasAskResults;
  const askColumns = askResult?.results?.[0] ? Object.keys(askResult.results[0]) : [];

  return (
    <div className="mb-10 max-w-2xl">
      {/* Search input */}
      <div className="border-4 border-bauhaus-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
        <div className="flex items-center">
          <svg className="w-5 h-5 ml-4 text-bauhaus-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="square" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search entities or ask a question..."
            className="flex-1 px-4 py-4 text-base font-bold text-bauhaus-black placeholder:text-bauhaus-muted placeholder:font-medium outline-none bg-transparent"
            disabled={loading && mode === 'ask'}
          />
          {/* Mode indicator */}
          <span className={`mr-2 text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-widest transition-colors ${
            mode === 'ask'
              ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
              : 'border-bauhaus-black/20 text-bauhaus-muted'
          }`}>
            {mode === 'ask' ? 'AI Query' : 'Search'}
          </span>
          {mode === 'ask' && (
            <button
              onClick={() => handleAskSubmit()}
              disabled={loading || !query.trim()}
              className="px-5 py-4 bg-bauhaus-black text-white font-black uppercase tracking-widest text-xs hover:bg-bauhaus-red transition-colors disabled:opacity-40"
            >
              {loading ? '\u2026' : 'Ask'}
            </button>
          )}
        </div>
      </div>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-1">Try:</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex.label}
            onClick={() => handleExample(ex)}
            className="px-3 py-1 text-xs font-bold text-bauhaus-black border-2 border-bauhaus-black/15 hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
            disabled={loading}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && !hasAnyResults && (
        <div className="mt-4 border-4 border-bauhaus-black/20 p-6 bg-white flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-bauhaus-black animate-pulse" />
            <div className="w-2 h-2 bg-bauhaus-black animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-bauhaus-black animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <span className="text-sm font-bold text-bauhaus-muted">
            {mode === 'ask' ? 'Generating SQL, querying database\u2026' : 'Searching\u2026'}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 border-4 border-bauhaus-red p-4 bg-bauhaus-red/5">
          <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-1">Error</div>
          <p className="text-bauhaus-black font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Search results (entity/foundation/grant cards) */}
      {hasSearchResults && mode === 'search' && (
        <div className="mt-4 border-4 border-bauhaus-black bg-white max-h-[50vh] overflow-y-auto">
          {/* Entities */}
          {searchResults!.entities.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Entities</span>
              </div>
              {searchResults!.entities.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => router.push(r.href)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${
                    selectedIndex === i ? 'bg-bauhaus-canvas' : 'hover:bg-bauhaus-canvas/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                    <div className="text-[11px] text-bauhaus-muted font-medium">
                      {r.abn && <span>ABN {r.abn} &middot; </span>}
                      {r.state && <span>{r.state} &middot; </span>}
                      {r.sourceCount} source{r.sourceCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {r.revenue ? <span className="text-xs font-black text-bauhaus-black">{formatMoney(r.revenue)}</span> : null}
                    <span className={`text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-widest ${typeBadgeColor('entity')}`}>
                      {entityTypeLabel(r.entityType)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Foundations */}
          {searchResults!.foundations.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 border-t-2 border-bauhaus-black/5">
                <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Foundations</span>
              </div>
              {searchResults!.foundations.map((r, i) => {
                const flatIndex = searchResults!.entities.length + i;
                return (
                  <button
                    key={r.id}
                    onClick={() => router.push(r.href)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${
                      selectedIndex === flatIndex ? 'bg-bauhaus-canvas' : 'hover:bg-bauhaus-canvas/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                      <div className="text-[11px] text-bauhaus-muted font-medium">
                        {r.abn && <span>ABN {r.abn} &middot; </span>}
                        {r.focus?.slice(0, 2).join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {r.totalGiving ? <span className="text-xs font-black text-bauhaus-black">{formatMoney(r.totalGiving)}/yr</span> : null}
                      <span className={`text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-widest ${typeBadgeColor('foundation')}`}>
                        Foundation
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Grants */}
          {searchResults!.grants.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 border-t-2 border-bauhaus-black/5">
                <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Grants</span>
              </div>
              {searchResults!.grants.map((r, i) => {
                const flatIndex = searchResults!.entities.length + searchResults!.foundations.length + i;
                return (
                  <button
                    key={r.id}
                    onClick={() => router.push(r.href)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${
                      selectedIndex === flatIndex ? 'bg-bauhaus-canvas' : 'hover:bg-bauhaus-canvas/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                      <div className="text-[11px] text-bauhaus-muted font-medium">
                        {r.programType && <span>{r.programType} &middot; </span>}
                        {r.source && <span>{r.source} &middot; </span>}
                        {r.closesAt && <span>Closes {r.closesAt}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {(r.amountMin || r.amountMax) && (
                        <span className="text-xs font-black text-bauhaus-black">
                          {r.amountMin && r.amountMax
                            ? `${formatMoney(r.amountMin)}-${formatMoney(r.amountMax)}`
                            : formatMoney(r.amountMax || r.amountMin)}
                        </span>
                      )}
                      <span className={`text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-widest ${typeBadgeColor('grant')}`}>
                        Grant
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* No search results */}
      {mode === 'search' && query.length >= 2 && !loading && searchResults && !hasSearchResults && (
        <div className="mt-4 border-4 border-bauhaus-black/20 p-6 bg-white text-center">
          <p className="text-sm font-bold text-bauhaus-muted">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-bauhaus-muted mt-1">Try a different name, ABN, or ask a question</p>
        </div>
      )}

      {/* Ask results (explanation + data table) */}
      {hasAskResults && (
        <div className="mt-4">
          {/* Explanation */}
          {askResult!.explanation && (
            <div className="border-4 border-bauhaus-blue p-5 mb-4 bg-bauhaus-blue/5">
              <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-2">Analysis</div>
              <p className="text-bauhaus-black font-medium text-sm leading-relaxed">{askResult!.explanation}</p>
            </div>
          )}

          {/* Stats bar */}
          <div className="flex gap-6 mb-3 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
            <span>{askResult!.count} rows</span>
            <button onClick={() => setShowSql(!showSql)} className="text-bauhaus-blue hover:underline">
              {showSql ? 'Hide SQL' : 'Show SQL'}
            </button>
          </div>

          {/* SQL */}
          {showSql && askResult!.generated_sql && (
            <div className="border-4 border-bauhaus-black/20 p-4 mb-4 bg-bauhaus-canvas">
              <pre className="text-xs font-mono text-bauhaus-black overflow-x-auto whitespace-pre-wrap">{askResult!.generated_sql}</pre>
            </div>
          )}

          {/* Data table */}
          {askColumns.length > 0 && (
            <div className="border-4 border-bauhaus-black overflow-x-auto bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    {askColumns.map(col => (
                      <th key={col} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {askResult!.results.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                      {askColumns.map(col => (
                        <td key={col} className="px-3 py-2 font-medium text-bauhaus-black border-t border-bauhaus-black/10 whitespace-nowrap">
                          {formatValue(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
