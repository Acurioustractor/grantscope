'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VIEW_REGISTRY } from '@/lib/view-registry';
import { EMPTY_RESULTS, SearchResultList, flatResults, toSearchResults, type SearchResults } from './search-results';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<'text' | 'ai'>('text');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Registry views are jump actions: pinned ones surface on an empty query,
  // and any view matches by name/question text. Pure client-side — the
  // registry is a static typed list, no fetch involved.
  const q = query.trim().toLowerCase();
  const viewMatches =
    q.length === 0
      ? VIEW_REGISTRY.filter((v) => v.pinned)
      : VIEW_REGISTRY.filter((v) => `${v.name} ${v.question}`.toLowerCase().includes(q));
  const viewOffset = viewMatches.length;

  // Flatten all results for keyboard navigation (views first)
  const allResults = flatResults(results);
  const navHrefs: string[] = [...viewMatches.map((v) => v.href), ...allResults.map((r) => r.href)];

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
      setResults(EMPTY_RESULTS);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(EMPTY_RESULTS);
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
          setResults(toSearchResults(data));
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
      setSelectedIndex(i => Math.min(i + 1, navHrefs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (navHrefs[selectedIndex]) {
        navigate(navHrefs[selectedIndex]);
      } else if (query.trim().length >= 2) {
        // No typeahead hit — hand off to the full /search page (all 8 kinds).
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }, [navHrefs, selectedIndex, navigate, query]);

  if (!open) return null;

  const hasResults = allResults.length > 0 || viewMatches.length > 0;

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
              placeholder="Search organisations, people, grants..."
              className="flex-1 px-4 py-4 text-lg font-bold text-bauhaus-black placeholder:text-bauhaus-muted placeholder:font-medium outline-none bg-transparent"
            />
            <kbd className="hidden sm:inline-block mr-4 px-2 py-1 text-[10px] font-black text-bauhaus-muted border-2 border-bauhaus-black/20 uppercase tracking-widest">
              ESC
            </kbd>
          </div>

          {/* Results */}
          {hasResults && (
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Views (registry jump actions) */}
              {viewMatches.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                      Views
                    </span>
                  </div>
                  {viewMatches.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => navigate(v.href)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                        selectedIndex === i ? 'bg-bauhaus-canvas' : 'hover:bg-bauhaus-canvas/50'
                      }`}
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0"
                        style={{
                          background:
                            { red: '#D02020', blue: '#1040C0', yellow: '#F0C020', green: '#059669', ink: '#6E6E6E' }[v.colour],
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-bauhaus-black truncate">{v.name}</div>
                        <div className="text-[11px] text-bauhaus-muted font-medium truncate">{v.question}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <SearchResultList results={results} selectedIndex={selectedIndex} onSelect={navigate} offset={viewOffset} />
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

          {/* Full-search handoff */}
          {query.trim().length >= 2 && (
            <button
              onClick={() => navigate(`/search?q=${encodeURIComponent(query.trim())}`)}
              className="w-full text-left px-4 py-2.5 border-t-2 border-bauhaus-black/10 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-canvas transition-colors cursor-pointer"
            >
              All results for &ldquo;{query.trim()}&rdquo; &rarr; reports, questions, people, places &amp; more
            </button>
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
