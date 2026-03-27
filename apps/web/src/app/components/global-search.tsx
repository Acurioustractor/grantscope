'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface EntityResult {
  type: 'entity';
  id: string;
  name: string;
  entityType: string;
  abn: string | null;
  state: string | null;
  sourceCount: number;
  revenue: number | null;
  relationships: number;
  systems: string[];
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

function formatMoney(amount: number | null): string {
  if (!amount) return '';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charity: 'Charity',
    foundation: 'Foundation',
    company: 'Company',
    government_body: 'Govt',
    indigenous_corp: 'Indigenous Corp',
    political_party: 'Political Party',
    social_enterprise: 'Social Enterprise',
    trust: 'Trust',
    person: 'Person',
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

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ entities: EntityResult[]; foundations: FoundationResult[]; grants: GrantResult[] }>({ entities: [], foundations: [], grants: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<'text' | 'ai'>('text');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Flatten all results for keyboard navigation
  const allResults: SearchResult[] = [
    ...results.entities,
    ...results.foundations,
    ...results.grants,
  ];

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ entities: [], foundations: [], grants: [] });
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ entities: [], foundations: [], grants: [] });
      return;
    }

    // Use semantic search for natural language queries (>5 words), text search otherwise
    const wordCount = query.trim().split(/\s+/).length;
    const useAI = searchMode === 'ai' || (searchMode === 'text' && wordCount > 5);

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      const endpoint = useAI
        ? `/api/search/universal?q=${encodeURIComponent(query)}`
        : `/api/global-search?q=${encodeURIComponent(query)}`;

      fetch(endpoint, { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          setResults({
            entities: Array.isArray(data.entities) ? data.entities : [],
            foundations: Array.isArray(data.foundations) ? data.foundations : [],
            grants: Array.isArray(data.grants) ? data.grants : [],
          });
          setSelectedIndex(0);
          setLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') setLoading(false);
        });
    }, useAI ? 500 : 300);

    return () => clearTimeout(timer);
  }, [query, searchMode]);

  const navigate = useCallback((href: string) => {
    onClose();
    window.location.href = href;
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault();
      navigate(allResults[selectedIndex].href);
    }
  }, [allResults, selectedIndex, navigate]);

  if (!open) return null;

  const hasResults = allResults.length > 0;

  return (
    <div className="fixed inset-0 z-[100]" onClick={() => onClose()}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bauhaus-black/40" />

      {/* Modal */}
      <div
        className="relative max-w-2xl mx-auto mt-[15vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
          {/* Search input */}
          <div className="flex items-center border-b-4 border-bauhaus-black">
            <svg className="w-5 h-5 ml-4 text-bauhaus-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="square" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search entities, grants, foundations..."
              className="flex-1 px-4 py-4 text-lg font-bold text-bauhaus-black placeholder:text-bauhaus-muted placeholder:font-medium outline-none bg-transparent"
            />
            <kbd className="hidden sm:inline-block mr-4 px-2 py-1 text-[10px] font-black text-bauhaus-muted border-2 border-bauhaus-black/20 uppercase tracking-widest">
              ESC
            </kbd>
          </div>

          {/* Results */}
          {hasResults && (
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Entities */}
              {results.entities.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                      Entities
                    </span>
                  </div>
                  {results.entities.map((r, i) => {
                    const flatIndex = i;
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(r.href)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${
                          selectedIndex === flatIndex ? 'bg-bauhaus-canvas' : 'hover:bg-bauhaus-canvas/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                          <div className="text-[11px] text-bauhaus-muted font-medium flex items-center gap-1 flex-wrap">
                            {r.state && <span>{r.state}</span>}
                            {r.relationships > 0 && <span>{r.state ? '·' : ''} {r.relationships.toLocaleString()} links</span>}
                            {r.systems.length > 0 && (
                              <>
                                <span>·</span>
                                {r.systems.map(s => (
                                  <span key={s} className={`text-[9px] font-black px-1 py-0 uppercase tracking-wider ${
                                    s === 'donations' ? 'text-bauhaus-red' : s === 'procurement' ? 'text-bauhaus-black' : 'text-bauhaus-blue'
                                  }`}>{s}</span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          {r.revenue ? (
                            <span className="text-xs font-black text-bauhaus-black">{formatMoney(r.revenue)}</span>
                          ) : null}
                          <span className={`text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-widest ${typeBadgeColor('entity')}`}>
                            {entityTypeLabel(r.entityType)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Foundations */}
              {results.foundations.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 border-t-2 border-bauhaus-black/5">
                    <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                      Foundations
                    </span>
                  </div>
                  {results.foundations.map((r, i) => {
                    const flatIndex = results.entities.length + i;
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(r.href)}
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
                          {r.totalGiving ? (
                            <span className="text-xs font-black text-bauhaus-black">{formatMoney(r.totalGiving)}/yr</span>
                          ) : null}
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
              {results.grants.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 border-t-2 border-bauhaus-black/5">
                    <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                      Grants
                    </span>
                  </div>
                  {results.grants.map((r, i) => {
                    const flatIndex = results.entities.length + results.foundations.length + i;
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(r.href)}
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

          {/* Loading */}
          {loading && !hasResults && (
            <div className="px-4 py-8 text-center">
              <div className="flex justify-center gap-1">
                <div className="w-2 h-2 bg-bauhaus-black animate-pulse" />
                <div className="w-2 h-2 bg-bauhaus-black animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-bauhaus-black animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          {/* No results */}
          {query.length >= 2 && !loading && !hasResults && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-bold text-bauhaus-muted">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-bauhaus-muted mt-1">Try a different name, ABN, or keyword</p>
            </div>
          )}

          {/* Empty state */}
          {query.length < 2 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs font-bold text-bauhaus-muted">
                Search across {'>'}80K entities, 14K grants, 9.8K foundations
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t-2 border-bauhaus-black/10 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] font-bold text-bauhaus-muted">
              <span><kbd className="px-1.5 py-0.5 border border-bauhaus-black/20 font-black">&#8593;&#8595;</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 border border-bauhaus-black/20 font-black">&#8629;</kbd> select</span>
              <span><kbd className="px-1.5 py-0.5 border border-bauhaus-black/20 font-black">esc</kbd> close</span>
            </div>
            <button
              onClick={() => setSearchMode(m => m === 'text' ? 'ai' : 'text')}
              className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-2 transition-colors cursor-pointer ${
                searchMode === 'ai'
                  ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                  : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black/40'
              }`}
            >
              {searchMode === 'ai' ? 'AI Search' : 'Text Search'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
