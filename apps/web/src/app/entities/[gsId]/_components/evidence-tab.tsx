'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatMoney } from '../_lib/formatters';
import { Section } from './section';
import { CommunityEvidence } from '../impact-stories';

interface AlmaIntervention {
  id: string;
  name: string;
  type: string;
}

interface JusticeFundingRecord {
  id: string;
  recipient_name: string;
  program_name: string;
  amount_dollars: number | null;
  sector: string | null;
  source: string;
  financial_year: string | null;
  location: string | null;
}

interface EvidenceResponse {
  interventions: AlmaIntervention[];
  justiceFunding: JusticeFundingRecord[];
  totalJusticeFunding: number;
  almaEvidenceCount: number;
  justiceOrgId: string | null;
  justiceOrgSlug: string | null;
}

export function EvidenceTab({ gsId, isPremium }: { gsId: string; isPremium: boolean }) {
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/entities/${gsId}/evidence`)
      .then((r) => r.json())
      .then((d: EvidenceResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gsId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-bauhaus-muted font-bold animate-pulse">Loading evidence...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-bauhaus-muted font-bold">No evidence data available</p>
      </div>
    );
  }

  const hasContent = data.interventions.length > 0 || data.justiceFunding.length > 0;

  return (
    <div>
      {/* ALMA Interventions */}
      {data.interventions.length > 0 && (
        <Section title={`Justice Interventions (${data.interventions.length})`}>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[10px] font-black px-2 py-0.5 border border-bauhaus-blue/30 bg-link-light text-bauhaus-blue uppercase tracking-widest">
              External Evidence
            </span>
            <span className="text-[10px] text-bauhaus-muted font-medium">
              JusticeHub ALMA records linked by shared organisation identifiers.
            </span>
          </div>
          <div className="space-y-0">
            {data.interventions.map((ai) => (
              <div key={ai.id} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-bauhaus-black text-sm truncate">{ai.name}</div>
                  <div className="text-[11px] text-bauhaus-muted font-medium capitalize">{ai.type?.replace(/_/g, ' ')}</div>
                </div>
              </div>
            ))}
          </div>
          {data.almaEvidenceCount > 0 && (
            <div className="mt-3 bg-bauhaus-canvas p-3">
              <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Evidence Base: </span>
              <span className="text-sm font-black text-bauhaus-black">{data.almaEvidenceCount} evidence record{data.almaEvidenceCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="mt-3 text-[10px] text-bauhaus-muted leading-relaxed">
            External ecosystem evidence via JusticeHub ALMA — Australian Living Map of Alternatives.
          </div>
        </Section>
      )}

      {/* Justice Funding */}
      {data.justiceFunding.length > 0 && (
        isPremium ? (
          <Section title={`Justice Funding (${data.justiceFunding.length} records — ${formatMoney(data.totalJusticeFunding)})`}>
            {(() => {
              const byYear = new Map<string, { total: number; records: JusticeFundingRecord[] }>();
              for (const jf of data.justiceFunding) {
                const yr = jf.financial_year || 'Unknown';
                const existing = byYear.get(yr) || { total: 0, records: [] };
                existing.total += jf.amount_dollars || 0;
                existing.records.push(jf);
                byYear.set(yr, existing);
              }
              const sorted = Array.from(byYear.entries()).sort((a, b) => b[0].localeCompare(a[0]));
              return sorted.map(([year, yearData]) => (
                <div key={year} className="mb-4">
                  <div className="flex items-center justify-between py-2 border-b-2 border-bauhaus-black/10">
                    <span className="text-xs font-black text-bauhaus-black uppercase tracking-widest">{year}</span>
                    <span className="font-black text-bauhaus-black">{formatMoney(yearData.total)}</span>
                  </div>
                  {yearData.records.map((jf, i) => (
                    <div key={i} className="flex items-center justify-between py-2 pl-4 border-b border-bauhaus-black/5 last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-bauhaus-black text-sm truncate">{jf.program_name}</div>
                        <div className="text-[11px] text-bauhaus-muted font-medium">
                          {jf.sector && <span className="capitalize">{jf.sector.replace(/_/g, ' ')}</span>}
                          {jf.source && <span> &middot; {jf.source.replace(/_/g, ' ')}</span>}
                          {jf.location && <span> &middot; {jf.location}</span>}
                        </div>
                      </div>
                      {jf.amount_dollars && (
                        <div className="text-right ml-4">
                          <div className="font-black text-bauhaus-black">{formatMoney(jf.amount_dollars)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()}
            {/* Sector breakdown */}
            {(() => {
              const bySector = new Map<string, number>();
              for (const jf of data.justiceFunding) {
                const sec = jf.sector || 'other';
                bySector.set(sec, (bySector.get(sec) || 0) + (jf.amount_dollars || 0));
              }
              const sorted = Array.from(bySector.entries()).sort((a, b) => b[1] - a[1]);
              return (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sorted.map(([sector, total]) => (
                    <div key={sector} className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest capitalize">{sector.replace(/_/g, ' ')}</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(total)}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Section>
        ) : (
          <Section title={`Justice Funding (${data.justiceFunding.length} records)`}>
            <div className="relative">
              <div className="blur-sm pointer-events-none select-none">
                {data.justiceFunding.slice(0, 3).map((jf, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5">
                    <div className="font-bold text-bauhaus-black">{jf.program_name}</div>
                    <div className="font-black text-bauhaus-black">{formatMoney(jf.amount_dollars)}</div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Link href="/pricing" className="px-6 py-3 bg-bauhaus-black text-white font-black text-sm uppercase tracking-widest hover:bg-bauhaus-blue transition-colors">
                  Unlock Full Dossier
                </Link>
              </div>
            </div>
          </Section>
        )
      )}

      {/* Community Evidence */}
      <CommunityEvidence gsId={gsId} isPremium={isPremium} />

      {/* JusticeHub link */}
      {data.justiceOrgSlug && (
        <div className="mt-8 p-4 border-4 border-bauhaus-blue bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-1">JusticeHub</p>
              <p className="text-sm font-medium text-bauhaus-black">View full organisation profile on JusticeHub</p>
            </div>
            <a
              href={`https://justicehub.org.au/organizations/${data.justiceOrgSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Open
            </a>
          </div>
        </div>
      )}

      {!hasContent && (
        <div className="text-center py-12">
          <p className="text-bauhaus-muted font-bold">No evidence records linked to this entity</p>
          <p className="text-xs text-bauhaus-muted mt-2">
            Evidence appears when entities are linked to JusticeHub organisations or have justice funding records.
          </p>
        </div>
      )}
    </div>
  );
}
