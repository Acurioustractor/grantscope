'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Person {
  person_name: string;
  person_name_normalised: string;
  board_count: number;
  acco_boards: number;
  entity_types: string[];
  data_sources: string[];
  total_procurement: number;
  total_contracts: number;
  total_justice: number;
  total_donations: number;
  max_influence_score: number;
  financial_system_count: number;
}

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function PersonSearchPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // Load top people on mount
  useEffect(() => {
    fetch('/api/data/person?limit=100')
      .then(r => r.json())
      .then(data => { setPeople(data.results || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) {
      // Reset to top people
      setLoading(true);
      fetch('/api/data/person?limit=100')
        .then(r => r.json())
        .then(data => { setPeople(data.results || []); setLoading(false); })
        .catch(() => setLoading(false));
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/data/person?q=${encodeURIComponent(q)}&limit=100`)
        .then(r => r.json())
        .then(data => { setPeople(data.results || []); setSearching(false); })
        .catch(() => setSearching(false));
    }, 300);
  }, []);

  const personUrl = (name: string) => `/person/${encodeURIComponent(name.replace(/\s+/g, '-'))}`;

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph</p>
            <div className="flex gap-2">
              <Link href="/entity" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Entities</Link>
              <Link href="/entity/top" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Power Index</Link>
              <Link href="/map" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Map</Link>
              <Link href="/graph" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">Graph</Link>
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider">Who Runs Australia?</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            People who sit on multiple boards, control procurement dollars, receive justice funding, or make political donations.
            Ranked by influence score across all connected entities.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Search */}
        <div className="mb-6 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search people by name..."
            className="w-full border-2 border-bauhaus-black px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bauhaus-red"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block w-4 h-4 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin" />
          )}
        </div>

        {/* Results */}
        <div className="bg-white border-2 border-bauhaus-black shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-bauhaus-red rounded-full animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50/50">
                  <th className="text-left py-3 pl-4 pr-2 font-black uppercase tracking-widest text-[10px] text-gray-400 w-10">#</th>
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Name</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Board Seats</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Orgs</th>
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Entity Types</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Procurement $</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Justice $</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Donations $</th>
                  <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Influence</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p, i) => (
                  <tr
                    key={p.person_name_normalised}
                    className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    <td className="py-3 pl-4 pr-2 text-xs text-gray-400 font-mono">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <Link href={personUrl(p.person_name)} className="font-medium text-bauhaus-blue hover:underline">
                        {p.person_name}
                      </Link>
                      {p.financial_system_count > 0 && (
                        <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-sm font-bold">
                          {p.financial_system_count} fin. sys
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-bold">{p.board_count}</td>
                    <td className="py-3 pr-4 text-right font-mono text-gray-500">{p.acco_boards}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.entity_types || []).map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-green-700">
                      {Number(p.total_procurement) > 0 ? money(Number(p.total_procurement)) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-green-700">
                      {Number(p.total_justice) > 0 ? money(Number(p.total_justice)) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {Number(p.total_donations) > 0 ? (
                        <span className="text-bauhaus-red">{money(Number(p.total_donations))}</span>
                      ) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-bold">{Number(p.max_influence_score).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
