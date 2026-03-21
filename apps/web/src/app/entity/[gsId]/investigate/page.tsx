'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { money } from '@/lib/format';

interface Finding {
  type: string;
  severity: string;
  title: string;
  detail: string;
}

interface ContractAlert {
  title: string;
  value: number;
  buyer_name: string;
  contract_start: string;
  contract_end: string | null;
  severity: string;
}

interface FundingTimelineRow {
  financial_year: string;
  program_name: string;
  total: number;
  records: number;
}

interface BoardConnection {
  person_name: string;
  company_name: string;
  company_abn: string;
  role_type: string;
  linked_gs_id: string | null;
  linked_type: string | null;
  linked_cc: boolean | null;
}

interface RelatedEntity {
  name: string;
  gs_id: string;
  entity_type: string;
  relationship_type: string;
  amount: number | null;
  year: string | null;
  dataset: string | null;
}

interface InvestigationData {
  entity: { gs_id: string; canonical_name: string; abn: string | null; entity_type: string; state: string; sector: string; is_community_controlled: boolean };
  findings: Finding[];
  contractAlerts: ContractAlert[];
  fundingTimeline: FundingTimelineRow[];
  boardConnections: BoardConnection[];
  relatedEntities: RelatedEntity[];
  power: { power_score: number; system_count: number; total_dollar_flow: number } | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-50 border-red-500 text-red-800',
  significant: 'bg-amber-50 border-amber-500 text-amber-800',
  notable: 'bg-blue-50 border-blue-500 text-blue-800',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  significant: 'bg-amber-500 text-white',
  notable: 'bg-blue-500 text-white',
};

export default function InvestigatePage() {
  const params = useParams();
  const gsId = decodeURIComponent(params.gsId as string);
  const [data, setData] = useState<InvestigationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/data/entity/investigate?gsId=${encodeURIComponent(gsId)}`)
      .then(r => {
        if (!r.ok) throw new Error('Investigation failed');
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [gsId]);

  if (loading) return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-bauhaus-red rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Investigating...</p>
        <p className="text-xs text-gray-400 mt-1">Running cross-system analysis</p>
      </div>
    </main>
  );

  if (error || !data) return (
    <main className="min-h-screen bg-gray-50 p-8">
      <p className="text-red-600">Investigation failed: {error}</p>
      <Link href={`/entity/${encodeURIComponent(gsId)}`} className="text-bauhaus-blue underline mt-4 block">Back to entity</Link>
    </main>
  );

  const { entity, findings, contractAlerts, fundingTimeline, boardConnections, relatedEntities, power } = data;

  // Group funding by year
  const yearTotals = new Map<string, number>();
  for (const r of fundingTimeline) {
    yearTotals.set(r.financial_year, (yearTotals.get(r.financial_year) ?? 0) + Number(r.total));
  }
  const sortedYears = [...yearTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxYearTotal = Math.max(...sortedYears.map(([, v]) => v), 1);

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center gap-3 mb-3">
            <Link href={`/entity/${encodeURIComponent(gsId)}`} className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1">
              Back to Profile
            </Link>
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">Investigation</p>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider">{entity.canonical_name}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-300">
            {entity.abn && <span className="font-mono">ABN {entity.abn}</span>}
            <span className="text-[10px] px-2 py-0.5 bg-white/10 border border-white/20 font-bold uppercase tracking-wider">{entity.entity_type}</span>
            {entity.state && <span className="text-gray-400">{entity.state}</span>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Findings */}
        {findings.length > 0 ? (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest mb-4">
              Key Findings
              <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">{findings.length} flags</span>
            </h2>
            <div className="space-y-3">
              {findings.map((f, i) => (
                <div key={i} className={`border-l-4 p-4 ${SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.notable}`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider rounded-sm shrink-0 ${SEVERITY_BADGE[f.severity] || SEVERITY_BADGE.notable}`}>
                      {f.severity}
                    </span>
                    <div>
                      <p className="font-bold text-sm">{f.title}</p>
                      <p className="text-xs mt-1 opacity-80">{f.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="bg-green-50 border border-green-200 p-5">
            <p className="font-bold text-green-800 text-sm">No significant findings</p>
            <p className="text-xs text-green-700 mt-1">This entity does not trigger any investigation flags in the current dataset.</p>
          </section>
        )}

        {/* Power Summary */}
        {power && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3">Power Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border-2 border-bauhaus-black p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Power Score</p>
                <p className="text-3xl font-black mt-1">{Number(power.power_score).toFixed(1)}</p>
              </div>
              <div className="bg-white border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Systems</p>
                <p className="text-3xl font-black mt-1">{power.system_count} <span className="text-sm text-gray-400">/ 7</span></p>
              </div>
              <div className="bg-white border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Flow</p>
                <p className="text-2xl font-black mt-1 text-green-700">{money(Number(power.total_dollar_flow))}</p>
              </div>
            </div>
          </section>
        )}

        {/* Funding Timeline */}
        {sortedYears.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3">Funding Timeline</h2>
            <div className="bg-white border border-gray-200 p-5">
              <div className="space-y-2">
                {sortedYears.map(([year, total]) => (
                  <div key={year} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-16 text-gray-500 shrink-0">{year}</span>
                    <div className="flex-1 h-6 bg-gray-100 relative">
                      <div
                        className="h-full bg-bauhaus-blue/70"
                        style={{ width: `${(total / maxYearTotal) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold w-24 text-right shrink-0">{money(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Contract Alerts */}
        {contractAlerts.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3">
              Contract Alerts
              <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">{contractAlerts.length} contracts over $100K</span>
            </h2>
            <div className="bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Title</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Value</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Buyer</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Date</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {contractAlerts.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-xs truncate max-w-xs">{c.title}</td>
                      <td className="px-4 py-2 text-xs text-right font-mono font-bold text-green-700">{money(Number(c.value))}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 truncate max-w-40">{c.buyer_name}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{c.contract_start?.split('T')[0]}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[9px] px-2 py-0.5 font-bold uppercase rounded-sm ${SEVERITY_BADGE[c.severity] || 'bg-gray-200'}`}>
                          {c.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Board Connections */}
        {boardConnections.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3">
              Board Interlocks
              <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">
                {[...new Set(boardConnections.map(b => b.person_name))].length} people, {boardConnections.length} connections
              </span>
            </h2>
            <div className="bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Person</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Also Serves On</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Role</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {boardConnections.map((b, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-xs font-medium">
                        <Link href={`/person/${encodeURIComponent(b.person_name.replace(/\s+/g, '-'))}`} className="text-bauhaus-blue hover:underline">
                          {b.person_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {b.linked_gs_id ? (
                          <Link href={`/entity/${encodeURIComponent(b.linked_gs_id)}`} className="text-bauhaus-blue hover:underline">
                            {b.company_name}
                          </Link>
                        ) : b.company_name}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">{b.role_type}</td>
                      <td className="px-4 py-2">
                        {b.linked_type && (
                          <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{b.linked_type}</span>
                        )}
                        {b.linked_cc && (
                          <span className="text-[9px] px-2 py-0.5 bg-bauhaus-red/10 text-bauhaus-red rounded-sm ml-1">CC</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Related Entities */}
        {relatedEntities.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest mb-3">
              Key Relationships
              <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">{relatedEntities.length} connections</span>
            </h2>
            <div className="bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Entity</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Type</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Relationship</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-4 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedEntities.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-xs font-medium">
                        <Link href={`/entity/${encodeURIComponent(r.gs_id)}`} className="text-bauhaus-blue hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-sm">{r.entity_type}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-sm">{r.relationship_type}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-right font-mono">{r.amount ? money(Number(r.amount)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t-2 border-bauhaus-black pt-6">
          <p className="text-xs text-gray-400">
            Investigation generated from CivicGraph cross-system analysis. Findings are algorithmic flags, not accusations.
            Sources: austender_contracts, justice_funding, person_roles, gs_relationships, mv_entity_power_index, mv_revolving_door.
          </p>
        </footer>
      </div>
    </main>
  );
}
