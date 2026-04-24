'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BriefingEntrySection } from '@/app/components/briefing-entry-section';

function money(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface Entity {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  sector: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  lga_name: string | null;
  description: string | null;
  website: string | null;
}

interface Relationship {
  id: string;
  relationship_type: string;
  amount: number | null;
  year: number | null;
  target_name?: string;
  source_name?: string;
}

interface JusticeFunding {
  program_name: string;
  total: number;
  financial_year: string;
}

interface AlmaIntervention {
  name: string;
  type: string | null;
  evidence_level: string | null;
  description: string | null;
}

interface BoardReportData {
  entity: Entity;
  relationships: {
    outbound: Relationship[];
    inbound: Relationship[];
  };
  justice_funding: JusticeFunding[];
  alma_interventions: AlmaIntervention[];
  generated_at: string;
}

interface EntitySearchResult {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
}

interface BoardReportClientProps {
  initialSearchTerm?: string;
  autoSearch?: boolean;
}

export function BoardReportClient({
  initialSearchTerm = '',
  autoSearch = false,
}: BoardReportClientProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BoardReportData | null>(null);
  const [error, setError] = useState('');
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  async function searchEntities(explicitTerm?: string) {
    const query = (explicitTerm ?? searchTerm).trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/data?type=entities&q=${encodeURIComponent(query)}&limit=10`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.data || []);
    } catch {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!autoSearch || hasAutoSearched || !initialSearchTerm.trim()) return;
    setHasAutoSearched(true);
    void searchEntities(initialSearchTerm);
  }, [autoSearch, hasAutoSearched, initialSearchTerm]);

  async function generateReport(gsId: string) {
    setLoading(true);
    setError('');
    setSearchResults([]);
    try {
      const res = await fetch('/api/board-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_gs_id: gsId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to generate report');
        return;
      }
      setReport(await res.json());
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const totalInbound = report?.relationships.inbound.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  const totalOutbound = report?.relationships.outbound.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  const relationshipCount = (report?.relationships.inbound.length || 0) + (report?.relationships.outbound.length || 0);

  return (
    <div>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
          body {
            background: white;
          }
        }
      `}</style>

      {/* Search section */}
      <BriefingEntrySection
        title="Entity Search"
        className="no-print"
        note={
          initialSearchTerm.trim()
            ? `Prefilled from the briefing hub${autoSearch ? ' and searched automatically' : ''}.`
            : undefined
        }
        error={error || undefined}
        rowClassName="flex gap-3 items-start"
        footer={
          searchResults.length > 0 ? (
            <div className="mt-4 border-2 border-gray-200">
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest px-3 py-2 bg-gray-50 border-b-2 border-gray-200">
                Select Entity
              </div>
              <div className="max-h-64 overflow-y-auto">
                {searchResults.map((entity) => (
                  <button
                    key={entity.gs_id}
                    onClick={() => generateReport(entity.gs_id)}
                    className="w-full px-3 py-3 text-left hover:bg-bauhaus-muted/5 border-b border-gray-100 transition-colors"
                  >
                    <div className="font-bold text-sm">{entity.canonical_name}</div>
                    <div className="text-xs text-bauhaus-muted mt-1">
                      {entity.abn && <span className="mr-3">ABN: {entity.abn}</span>}
                      <span className="mr-3">{entity.entity_type}</span>
                      {entity.state && <span>{entity.state}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null
        }
        action={
          <button
            onClick={() => void searchEntities()}
            disabled={searching || !searchTerm.trim()}
            className="px-6 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        }
      >
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchEntities()}
            placeholder="Search by entity name or ABN..."
            className="w-full px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none"
          />
        </div>
      </BriefingEntrySection>

      {loading && (
        <div className="text-center py-12">
          <div className="text-lg font-black text-bauhaus-black">Generating Report...</div>
        </div>
      )}

      {/* Report output */}
      {report && (
        <div>
          <div className="no-print mb-6 flex justify-end">
            <button
              onClick={handlePrint}
              className="px-6 py-2 bg-bauhaus-red text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Print Report
            </button>
          </div>

          <div className="space-y-8 bg-white">
            {/* Header */}
            <div className="border-b-4 border-bauhaus-black pb-6">
              <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">
                Board Report
              </div>
              <h1 className="text-3xl font-black text-bauhaus-black mb-2">
                {report.entity.canonical_name}
              </h1>
              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                <div>
                  <span className="font-bold text-bauhaus-muted">ABN:</span>{' '}
                  {report.entity.abn || '—'}
                </div>
                <div>
                  <span className="font-bold text-bauhaus-muted">Type:</span>{' '}
                  {report.entity.entity_type}
                </div>
                <div>
                  <span className="font-bold text-bauhaus-muted">State:</span>{' '}
                  {report.entity.state || '—'}
                </div>
                <div>
                  <span className="font-bold text-bauhaus-muted">Sector:</span>{' '}
                  {report.entity.sector || '—'}
                </div>
              </div>
              <div className="text-xs text-bauhaus-muted mt-4">
                Generated: {new Date(report.generated_at).toLocaleDateString('en-AU', { dateStyle: 'long' })}
              </div>
            </div>

            {/* Financial Overview */}
            <section>
              <h2 className="text-lg font-black text-bauhaus-black border-l-4 border-bauhaus-red pl-3 mb-4">
                Financial Overview
              </h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="border-2 border-bauhaus-black p-4">
                  <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">
                    Total Inbound
                  </div>
                  <div className="text-2xl font-black text-bauhaus-black">
                    {money(totalInbound)}
                  </div>
                </div>
                <div className="border-2 border-bauhaus-black p-4">
                  <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">
                    Total Outbound
                  </div>
                  <div className="text-2xl font-black text-bauhaus-black">
                    {money(totalOutbound)}
                  </div>
                </div>
                <div className="border-2 border-bauhaus-black p-4">
                  <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">
                    Relationships
                  </div>
                  <div className="text-2xl font-black text-bauhaus-black">
                    {relationshipCount}
                  </div>
                </div>
              </div>
            </section>

            {/* Top Relationships */}
            {(report.relationships.inbound.length > 0 || report.relationships.outbound.length > 0) && (
              <section className="print-break">
                <h2 className="text-lg font-black text-bauhaus-black border-l-4 border-bauhaus-red pl-3 mb-4">
                  Top Relationships
                </h2>

                {report.relationships.inbound.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-widest mb-3">
                      Inbound (Funding Received)
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-bauhaus-black">
                          <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Source</th>
                          <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Type</th>
                          <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Amount</th>
                          <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.relationships.inbound.map((rel) => (
                          <tr key={rel.id} className="border-b border-gray-100">
                            <td className="py-2 font-medium">{rel.source_name}</td>
                            <td className="py-2 text-bauhaus-muted">{rel.relationship_type}</td>
                            <td className="py-2 text-right">{money(rel.amount)}</td>
                            <td className="py-2 text-right text-bauhaus-muted">{rel.year || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {report.relationships.outbound.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-widest mb-3">
                      Outbound (Payments Made)
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-bauhaus-black">
                          <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Target</th>
                          <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Type</th>
                          <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Amount</th>
                          <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.relationships.outbound.map((rel) => (
                          <tr key={rel.id} className="border-b border-gray-100">
                            <td className="py-2 font-medium">{rel.target_name}</td>
                            <td className="py-2 text-bauhaus-muted">{rel.relationship_type}</td>
                            <td className="py-2 text-right">{money(rel.amount)}</td>
                            <td className="py-2 text-right text-bauhaus-muted">{rel.year || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Government Funding */}
            {report.justice_funding.length > 0 && (
              <section className="print-break">
                <h2 className="text-lg font-black text-bauhaus-black border-l-4 border-bauhaus-red pl-3 mb-4">
                  Government Funding
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-bauhaus-black">
                      <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Program</th>
                      <th className="text-left py-2 font-black text-xs uppercase tracking-wider">Financial Year</th>
                      <th className="text-right py-2 font-black text-xs uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.justice_funding.map((funding, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 font-medium">{funding.program_name}</td>
                        <td className="py-2 text-bauhaus-muted">{funding.financial_year}</td>
                        <td className="py-2 text-right">{money(funding.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Evidence & Programs */}
            {report.alma_interventions.length > 0 && (
              <section>
                <h2 className="text-lg font-black text-bauhaus-black border-l-4 border-bauhaus-red pl-3 mb-4">
                  Evidence & Programs
                </h2>
                <div className="text-xs text-bauhaus-muted mb-3">
                  Australian Living Map of Alternatives (ALMA) — Linked Interventions
                </div>
                <div className="space-y-3">
                  {report.alma_interventions.map((intervention, i) => (
                    <div key={i} className="border-l-2 border-bauhaus-blue pl-4 py-2">
                      <div className="font-bold text-sm mb-1">{intervention.name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {intervention.type && <span className="mr-3">Type: {intervention.type}</span>}
                        {intervention.evidence_level && <span>Evidence: {intervention.evidence_level}</span>}
                      </div>
                      {intervention.description && (
                        <div className="text-sm text-bauhaus-muted mt-1">{intervention.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Footer */}
            <div className="border-t-2 border-bauhaus-black pt-4 mt-8 text-center">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                Generated by CivicGraph Decision Intelligence
              </div>
              {report.entity.website && (
                <div className="text-xs text-bauhaus-muted mt-1">
                  <Link href={report.entity.website} className="hover:text-bauhaus-red">
                    {report.entity.website}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
