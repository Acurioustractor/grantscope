'use client';

import { useState } from 'react';
import Link from 'next/link';

function money(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface MarketStats {
  total_contracts: number;
  total_value: number;
  unique_suppliers: number;
  unique_buyers: number;
  earliest_year: number;
  latest_year: number;
}

interface Incumbent { name: string; total: number; count: number; abn: string | null }
interface Contract { buyer_name: string; supplier_name: string; supplier_abn: string | null; value: number; year: number; title: string }
interface Entity { gs_id: string; canonical_name: string; abn: string | null; entity_type: string; state: string; sector: string; is_community_controlled: boolean; seifa_irsd_decile: number | null }
interface AlmaMatch { name: string; type: string; evidence_level: string; geography: string; portfolio_score: number | null }

interface BriefData {
  keywords: string;
  state: string | null;
  generatedAt: string;
  market: MarketStats | null;
  incumbents: Incumbent[];
  recentContracts: Contract[];
  entities: Entity[];
  almaEvidence: AlmaMatch[];
}

const STATES = ['', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export function TenderBriefClient() {
  const [keywords, setKeywords] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [error, setError] = useState('');

  async function analyze() {
    if (!keywords.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tender-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim(), state: state || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to analyze');
        return;
      }
      setBrief(await res.json());
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Search controls */}
      <div className="border-4 border-bauhaus-black p-6 mb-8">
        <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">Tender Keywords</div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="text-xs font-bold text-bauhaus-black block mb-1">Keywords (from tender title or description)</label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder='e.g. "youth services", "disability support", "cleaning services"'
              className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none"
              onKeyDown={e => e.key === 'Enter' && analyze()}
            />
          </div>
          <div className="min-w-[120px]">
            <label className="text-xs font-bold text-bauhaus-black block mb-1">State</label>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none"
            >
              <option value="">All</option>
              {STATES.filter(Boolean).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={analyze}
            disabled={loading || !keywords.trim()}
            className="px-6 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze Market'}
          </button>
        </div>
        {error && <p className="text-sm text-bauhaus-red mt-3">{error}</p>}
      </div>

      {/* Results */}
      {brief && (
        <div className="space-y-8">
          <div className="text-center border-b-4 border-bauhaus-black pb-4 mb-8">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-1">Market Intelligence Brief</div>
            <h2 className="text-xl font-black text-bauhaus-black">
              &ldquo;{brief.keywords}&rdquo;
              {brief.state ? ` — ${brief.state}` : ''}
            </h2>
            <p className="text-xs text-bauhaus-muted mt-1">
              Generated {new Date(brief.generatedAt).toLocaleDateString('en-AU', { dateStyle: 'long' })}
            </p>
          </div>

          {/* Market overview */}
          {brief.market && brief.market.total_contracts > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-0 border-4 border-bauhaus-black">
              <Stat label="Contracts" value={brief.market.total_contracts.toLocaleString()} />
              <Stat label="Total Value" value={money(brief.market.total_value)} />
              <Stat label="Suppliers" value={String(brief.market.unique_suppliers)} />
              <Stat label="Buyers" value={String(brief.market.unique_buyers)} />
              <Stat label="From" value={String(brief.market.earliest_year)} />
              <Stat label="To" value={String(brief.market.latest_year)} />
            </div>
          )}

          {brief.market && brief.market.total_contracts === 0 && (
            <div className="border-2 border-gray-200 p-6 text-center">
              <p className="text-sm text-bauhaus-muted">No matching contracts found in AusTender. Try broader keywords.</p>
            </div>
          )}

          {/* Incumbents */}
          {brief.incumbents.length > 0 && (
            <Section title="Incumbent Suppliers (by contract value)">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Supplier</th>
                    <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Total Value</th>
                    <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {brief.incumbents.map((inc, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{inc.name}</td>
                      <td className="py-2 text-right">{money(inc.total)}</td>
                      <td className="py-2 text-right text-bauhaus-muted">{inc.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Recent contracts */}
          {brief.recentContracts.length > 0 && (
            <Section title="Highest-Value Contracts">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Title</th>
                    <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Buyer</th>
                    <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Value</th>
                    <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {brief.recentContracts.map((c, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 text-xs max-w-[250px] truncate">{c.title}</td>
                      <td className="py-2 text-xs text-bauhaus-muted max-w-[200px] truncate">{c.buyer_name}</td>
                      <td className="py-2 text-right">{money(c.value)}</td>
                      <td className="py-2 text-right text-bauhaus-muted">{c.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Entities in space */}
          {brief.entities.length > 0 && (
            <Section title="Related Entities in CivicGraph">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {brief.entities.slice(0, 12).map(e => (
                  <Link
                    key={e.gs_id}
                    href={`/entities/${e.gs_id}`}
                    className="border-2 border-gray-200 p-3 hover:border-bauhaus-black transition-colors"
                  >
                    <div className="font-bold text-sm">{e.canonical_name}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{e.entity_type}</span>
                      {e.state && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{e.state}</span>}
                      {e.is_community_controlled && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">Community-controlled</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* ALMA evidence */}
          {brief.almaEvidence.length > 0 && (
            <Section title="Related ALMA Evidence-Based Programs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {brief.almaEvidence.map((a, i) => (
                  <div key={i} className="border-2 border-gray-200 p-3">
                    <div className="font-bold text-sm">{a.name}</div>
                    <div className="flex gap-2 mt-1">
                      {a.type && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{a.type}</span>}
                      {a.evidence_level && <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">{a.evidence_level}</span>}
                      {a.geography && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{a.geography}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Empty state */}
      {!brief && !loading && (
        <div className="border-4 border-dashed border-bauhaus-black/20 p-12 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <div className="font-bold text-lg mb-1">Analyze a Tender</div>
          <p className="text-sm text-bauhaus-muted max-w-md mx-auto">
            Enter keywords from a tender title or description. CivicGraph will find incumbent suppliers,
            contract history, related entities, and evidence-based programs in the space.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10 last:border-r-0">
      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xl font-black text-bauhaus-black">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-3">{title}</h3>
      <div className="border-2 border-gray-200 p-4">{children}</div>
    </section>
  );
}
