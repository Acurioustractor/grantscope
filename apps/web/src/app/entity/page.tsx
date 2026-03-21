'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';

interface SearchResult {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  sector: string | null;
  state: string | null;
  lga_name: string | null;
  is_community_controlled: boolean;
  power_score: number | null;
  system_count: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700 border-blue-200',
  charity: 'bg-green-100 text-green-700 border-green-200',
  foundation: 'bg-purple-100 text-purple-700 border-purple-200',
  government_body: 'bg-amber-100 text-amber-700 border-amber-200',
  person: 'bg-gray-100 text-gray-700 border-gray-200',
  university: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function EntitySearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/data/entity/search?q=${encodeURIComponent(q)}&limit=30`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">
              CivicGraph
            </p>
            <div className="flex gap-2">
              <Link href="/entity/top" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Power Index</Link>
              <Link href="/entity/compare" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Compare</Link>
              <Link href="/person" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">People</Link>
              <Link href="/map" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Map</Link>
              <Link href="/graph" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Graph</Link>
            </div>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-wider mb-2">
            Entity Intelligence
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            Search 560,000+ entities across 7 government systems. See contracts, funding, donations,
            board connections, evidence linkage, and cross-system power in one profile.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mx-auto max-w-5xl px-4 -mt-6">
        <div className="bg-white border-2 border-bauhaus-black shadow-lg">
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search by entity name or ABN..."
            className="w-full px-6 py-4 text-lg font-medium outline-none placeholder:text-gray-400"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
            Searching...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <p className="text-gray-400 text-sm">No entities found for &quot;{query}&quot;</p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((r) => (
              <Link
                key={r.gs_id}
                href={`/entity/${encodeURIComponent(r.gs_id)}`}
                className="block bg-white border border-gray-200 hover:border-bauhaus-black transition-colors p-4 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm group-hover:text-bauhaus-red transition-colors truncate">
                      {r.canonical_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 border rounded-sm font-bold uppercase tracking-wider ${TYPE_COLORS[r.entity_type] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {r.entity_type}
                      </span>
                      {r.abn && (
                        <span className="text-xs text-gray-400 font-mono">
                          ABN {r.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}
                        </span>
                      )}
                      {r.state && <span className="text-xs text-gray-400">{r.state}</span>}
                      {r.lga_name && <span className="text-xs text-gray-400">{r.lga_name}</span>}
                      {r.is_community_controlled && (
                        <span className="text-[10px] px-2 py-0.5 bg-bauhaus-red/10 text-bauhaus-red border border-bauhaus-red/20 rounded-sm font-bold uppercase tracking-wider">
                          Community Controlled
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {r.system_count && Number(r.system_count) > 0 && (
                      <div className="text-xs text-gray-400">
                        <span className="font-bold text-bauhaus-black">{r.system_count}</span> system{Number(r.system_count) !== 1 ? 's' : ''}
                      </div>
                    )}
                    {r.power_score && Number(r.power_score) > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Power <span className="font-mono font-bold text-bauhaus-black">{Number(r.power_score).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick stats when no search */}
        {!searched && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Stat label="Entities" value="560K+" />
            <Stat label="Relationships" value="1.5M+" />
            <Stat label="Systems Tracked" value="7" />
            <Stat label="Contracts" value="770K+" />
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}
