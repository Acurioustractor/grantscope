'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PortfolioEntity {
  portfolio_entry_id: string;
  gs_id: string;
  notes: string | null;
  added_at: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  sector: string | null;
  total_relationships: number;
  total_inbound_amount: number;
  total_outbound_amount: number;
  is_community_controlled: boolean;
  seifa_irsd_decile: number | null;
  has_donations: boolean;
  has_contracts: boolean;
}

function fmtMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return n > 0 ? `$${n.toLocaleString()}` : '\u2014';
}

export function PortfolioClient({
  portfolioId,
  entities: initialEntities,
}: {
  portfolioId: string;
  entities: PortfolioEntity[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ gs_id: string; canonical_name: string; abn: string | null; entity_type: string; state: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/data?type=entities&q=${encodeURIComponent(searchQuery.trim())}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }

  async function addEntity(gsId: string) {
    setAdding(gsId);
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gs_id: gsId }),
      });
      if (res.ok) {
        setSearchResults([]);
        setSearchQuery('');
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setAdding(null);
    }
  }

  async function removeEntity(gsId: string) {
    setRemoving(gsId);
    try {
      await fetch(`/api/portfolio/${portfolioId}/entities?gs_id=${gsId}`, {
        method: 'DELETE',
      });
      router.refresh();
    } catch {
      // ignore
    } finally {
      setRemoving(null);
    }
  }

  const existingGsIds = new Set(initialEntities.map((e) => e.gs_id));

  return (
    <>
      {/* Add entity */}
      <div className="border-4 border-bauhaus-black p-6 mb-8">
        <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">
          Add Grantee to Portfolio
        </div>
        <form onSubmit={handleSearch} className="flex gap-0 max-w-lg">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or ABN..."
            className="flex-1 px-4 py-2.5 border-4 border-bauhaus-black text-sm font-bold focus:outline-none focus:border-bauhaus-red"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50 border-4 border-bauhaus-black border-l-0"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-3 border-2 border-bauhaus-black/20 divide-y divide-bauhaus-black/10">
            {searchResults.map((r) => (
              <div key={r.gs_id} className="flex items-center justify-between px-4 py-2">
                <div>
                  <span className="text-sm font-bold">{r.canonical_name}</span>
                  <span className="text-xs text-bauhaus-muted ml-2">{r.entity_type}</span>
                  {r.state && <span className="text-xs text-bauhaus-muted ml-1">&bull; {r.state}</span>}
                  {r.abn && <span className="text-xs text-bauhaus-muted ml-1">&bull; ABN {r.abn}</span>}
                </div>
                {existingGsIds.has(r.gs_id) ? (
                  <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Already added</span>
                ) : (
                  <button
                    onClick={() => addEntity(r.gs_id)}
                    disabled={adding === r.gs_id}
                    className="text-[10px] font-black px-3 py-1 border-2 border-bauhaus-black text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-50"
                  >
                    {adding === r.gs_id ? 'Adding...' : 'Add'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entity table */}
      {initialEntities.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-4 border-bauhaus-black">
                <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Entity</th>
                <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Type</th>
                <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">State</th>
                <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Inbound</th>
                <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Outbound</th>
                <th className="text-center text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Flags</th>
                <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {initialEntities.map((e) => (
                <tr key={e.gs_id} className="border-b border-bauhaus-black/10 hover:bg-bauhaus-canvas/50">
                  <td className="py-2 px-2">
                    <Link href={`/entities/${e.gs_id}`} className="font-bold text-bauhaus-blue hover:text-bauhaus-red">
                      {e.canonical_name}
                    </Link>
                    {e.abn && <div className="text-[10px] text-bauhaus-muted">ABN {e.abn}</div>}
                  </td>
                  <td className="py-2 px-2 text-xs">{e.entity_type}</td>
                  <td className="py-2 px-2 text-xs">{e.state || '\u2014'}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmtMoney(e.total_inbound_amount)}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{fmtMoney(e.total_outbound_amount)}</td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {e.has_donations && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 border border-bauhaus-red text-bauhaus-red uppercase">
                          Donor
                        </span>
                      )}
                      {e.is_community_controlled && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 border border-green-600 text-green-600 uppercase">
                          CC
                        </span>
                      )}
                      {(e.seifa_irsd_decile ?? 10) <= 3 && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 border border-bauhaus-blue text-bauhaus-blue uppercase">
                          SEIFA &le;3
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/entities/${e.gs_id}/due-diligence`}
                        className="text-[9px] font-black px-2 py-1 border border-bauhaus-black text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
                      >
                        DD Pack
                      </Link>
                      <button
                        onClick={() => removeEntity(e.gs_id)}
                        disabled={removing === e.gs_id}
                        className="text-[9px] font-black px-2 py-1 border border-bauhaus-red text-bauhaus-red uppercase tracking-widest hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-50"
                      >
                        {removing === e.gs_id ? '...' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-4 border-dashed border-bauhaus-black/20 p-12 text-center">
          <div className="text-xl font-black text-bauhaus-black mb-2">No grantees yet</div>
          <p className="text-sm text-bauhaus-muted max-w-md mx-auto">
            Search for organisations above to add them to your portfolio. You&apos;ll see aggregate funding data,
            risk flags, and geographic coverage across your grantees.
          </p>
        </div>
      )}
    </>
  );
}
