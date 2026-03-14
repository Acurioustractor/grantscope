'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Intervention {
  id: string;
  name: string;
  type: string;
  description: string;
  target_cohort: string[] | null;
  geography: string[] | null;
  evidence_level: string | null;
  cultural_authority: string | null;
  implementation_cost: string | null;
  cost_per_young_person: number | null;
  scalability: string | null;
  replication_readiness: string | null;
  years_operating: number | null;
  serves_youth_justice: boolean | null;
  estimated_annual_capacity: number | null;
  portfolio_score: number | null;
  signals: { evidence_strength: string | null; community_authority: string | null };
  linked_entity: {
    gs_id: string;
    name: string;
    abn: string;
    entity_type: string;
    state: string;
    postcode: string;
    remoteness: string;
    seifa_decile: number;
    is_community_controlled: boolean;
    lga: string;
  } | null;
  justice_funding: {
    total: number;
    records: number;
    programs: string[];
    states: string[];
  };
}

interface ApiResult {
  interventions: Intervention[];
  summary: {
    total: number;
    with_entity: number;
    with_funding: number;
    total_funding: number;
    by_type: Record<string, number>;
    by_evidence_level: Record<string, number>;
  };
  evidence_records: number;
  outcome_records: number;
}

function formatMoney(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

const TYPES = [
  'All', 'Justice Reinvestment', 'Diversion', 'Prevention', 'Early Intervention',
  'Cultural Connection', 'Community-Led', 'Wraparound Support', 'Therapeutic',
  'Family Strengthening', 'Education/Employment',
];

const EVIDENCE_LEVELS = [
  'All', 'RCT (Randomized Control Trial)', 'Quasi-experimental', 'Program evaluation',
  'Community-led research', 'Case study', 'Policy analysis',
];

const STATES = ['All', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export default function JusticeReinvestmentPage() {
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (typeFilter !== 'All') params.set('type', typeFilter);
    if (stateFilter !== 'All') params.set('state', stateFilter);
    if (linkedOnly) params.set('linked', 'true');
    if (searchQuery) params.set('q', searchQuery);

    try {
      const res = await fetch(`/api/justice/interventions?${params}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.error || 'Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, stateFilter, linkedOnly, searchQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const evidenceBadgeColor = (level: string | null) => {
    if (!level) return 'border-bauhaus-black/20 text-bauhaus-muted';
    if (level.includes('RCT')) return 'border-money bg-money/10 text-money';
    if (level.includes('Quasi')) return 'border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue';
    if (level.includes('Program')) return 'border-bauhaus-blue/60 bg-bauhaus-blue/5 text-bauhaus-blue';
    return 'border-bauhaus-black/20 text-bauhaus-muted';
  };

  return (
    <div className="max-w-7xl">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      {/* Hero */}
      <div className="mt-4 mb-6">
        <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
          <p className="text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-3">CivicGraph — Allocation Intelligence</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Justice Reinvestment Intelligence
          </h1>
          <p className="text-white/70 font-medium max-w-3xl leading-relaxed">
            Map evidence-rated interventions from the Australian Living Map of Alternatives (ALMA)
            to the organisations that deliver them, the justice funding they receive, and the communities they serve.
            Cross-system linkage across 1,155 interventions, 71K funding records, and 143K entities.
          </p>
        </div>
      </div>

      {/* Top stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 mb-6">
          {[
            { label: 'Interventions', value: data.summary.total.toString() },
            { label: 'Linked to Entities', value: data.summary.with_entity.toString() },
            { label: 'With Justice Funding', value: data.summary.with_funding.toString() },
            { label: 'Evidence Records', value: data.evidence_records.toString() },
            { label: 'Total Funding', value: formatMoney(data.summary.total_funding) },
          ].map((stat, i) => (
            <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{stat.label}</div>
              <div className="text-xl font-black">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="border-4 border-bauhaus-black p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted w-12">Type</span>
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border transition-colors ${
                typeFilter === t ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted w-12">State</span>
          {STATES.map(s => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border transition-colors ${
                stateFilter === s ? 'border-bauhaus-red bg-bauhaus-red text-white' : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={linkedOnly} onChange={(e) => setLinkedOnly(e.target.checked)} className="w-4 h-4" />
            <span className="text-xs font-bold text-bauhaus-muted">Entity-linked only</span>
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search interventions..."
            className="flex-1 max-w-xs px-3 py-1.5 text-sm border-2 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="border-4 border-bauhaus-red bg-bauhaus-red/10 p-4 mb-6">
          <p className="text-sm font-bold text-bauhaus-red">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <p className="text-sm font-black text-bauhaus-muted uppercase tracking-widest animate-pulse">Loading interventions...</p>
        </div>
      )}

      {/* Type breakdown */}
      {data && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 mb-6">
            {Object.entries(data.summary.by_type).sort(([,a],[,b]) => b - a).slice(0, 5).map(([type, count], i) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`p-3 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''} text-left hover:bg-bauhaus-canvas transition-colors ${
                  typeFilter === type ? 'bg-bauhaus-canvas' : ''
                }`}
              >
                <div className="text-lg font-black">{count}</div>
                <div className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">{type}</div>
              </button>
            ))}
          </div>

          {/* Intervention list */}
          <div className="space-y-3">
            {data.interventions.map(intervention => (
              <div
                key={intervention.id}
                className="border-4 border-bauhaus-black hover:border-bauhaus-blue transition-colors"
              >
                <button
                  onClick={() => setExpandedId(expandedId === intervention.id ? null : intervention.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 items-center flex-wrap mb-1">
                        <h3 className="font-black text-bauhaus-black">{intervention.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border ${evidenceBadgeColor(intervention.evidence_level)}`}>
                          {intervention.evidence_level || 'No evidence rating'}
                        </span>
                        {intervention.serves_youth_justice && (
                          <span className="text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red">Youth Justice</span>
                        )}
                      </div>
                      <p className="text-sm text-bauhaus-muted line-clamp-2">{intervention.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border ${
                        intervention.type === 'Justice Reinvestment' ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red' :
                        intervention.type === 'Diversion' ? 'border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue' :
                        'border-bauhaus-black/20 text-bauhaus-muted'
                      }`}>
                        {intervention.type}
                      </span>
                      {intervention.justice_funding.total > 0 && (
                        <div className="text-sm font-black text-money mt-1">{formatMoney(intervention.justice_funding.total)}</div>
                      )}
                    </div>
                  </div>
                </button>

                {expandedId === intervention.id && (
                  <div className="border-t-4 border-bauhaus-black p-4 bg-bauhaus-canvas/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Details */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Details</h4>
                        {intervention.target_cohort && intervention.target_cohort.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-bauhaus-muted">Cohort: </span>
                            <span className="text-xs">{intervention.target_cohort.join(', ')}</span>
                          </div>
                        )}
                        {intervention.geography && intervention.geography.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-bauhaus-muted">Geography: </span>
                            <span className="text-xs">{intervention.geography.join(', ')}</span>
                          </div>
                        )}
                        {intervention.cultural_authority && (
                          <div>
                            <span className="text-[10px] font-bold text-bauhaus-muted">Cultural authority: </span>
                            <span className="text-xs">{intervention.cultural_authority}</span>
                          </div>
                        )}
                        {intervention.implementation_cost && (
                          <div>
                            <span className="text-[10px] font-bold text-bauhaus-muted">Cost level: </span>
                            <span className="text-xs">{intervention.implementation_cost}</span>
                          </div>
                        )}
                        {intervention.scalability && (
                          <div>
                            <span className="text-[10px] font-bold text-bauhaus-muted">Scalability: </span>
                            <span className="text-xs">{intervention.scalability}</span>
                          </div>
                        )}
                        {intervention.years_operating && (
                          <div>
                            <span className="text-[10px] font-bold text-bauhaus-muted">Years operating: </span>
                            <span className="text-xs">{intervention.years_operating}</span>
                          </div>
                        )}
                      </div>

                      {/* Linked entity */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">Delivery Organisation</h4>
                        {intervention.linked_entity ? (
                          <div className="border-2 border-bauhaus-black/20 p-3">
                            <Link href={`/entities/${intervention.linked_entity.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue underline">
                              {intervention.linked_entity.name}
                            </Link>
                            <div className="text-xs font-mono text-bauhaus-muted mt-0.5">{intervention.linked_entity.abn}</div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className={`text-[10px] px-1 py-0.5 font-black border ${
                                intervention.linked_entity.entity_type === 'indigenous_corp' ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red' :
                                'border-bauhaus-black/20 text-bauhaus-muted'
                              }`}>
                                {intervention.linked_entity.entity_type.replace(/_/g, ' ')}
                              </span>
                              {intervention.linked_entity.is_community_controlled && (
                                <span className="text-[10px] px-1 py-0.5 font-black border border-money bg-money/10 text-money">Community Controlled</span>
                              )}
                            </div>
                            <div className="text-xs text-bauhaus-muted mt-1">
                              {intervention.linked_entity.lga}, {intervention.linked_entity.state}
                              {intervention.linked_entity.remoteness && !intervention.linked_entity.remoteness.includes('Major') && (
                                <span className="ml-1 font-bold text-bauhaus-red">{intervention.linked_entity.remoteness.replace(' Australia', '')}</span>
                              )}
                              {intervention.linked_entity.seifa_decile <= 3 && (
                                <span className="ml-1 font-bold text-bauhaus-red">SEIFA {intervention.linked_entity.seifa_decile}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-bauhaus-muted italic">Not yet linked to a CivicGraph entity</p>
                        )}
                      </div>

                      {/* Justice funding */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">Justice Funding</h4>
                        {intervention.justice_funding.total > 0 ? (
                          <div className="border-2 border-money/30 bg-money/5 p-3">
                            <div className="text-xl font-black text-money">{formatMoney(intervention.justice_funding.total)}</div>
                            <div className="text-xs text-bauhaus-muted mt-1">{intervention.justice_funding.records} funding records</div>
                            {intervention.justice_funding.programs.length > 0 && (
                              <div className="text-xs text-bauhaus-muted mt-1">
                                Programs: {intervention.justice_funding.programs.join(', ')}
                              </div>
                            )}
                            {intervention.justice_funding.states.length > 0 && (
                              <div className="text-xs text-bauhaus-muted mt-1">
                                States: {intervention.justice_funding.states.join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-bauhaus-muted italic">No linked justice funding records</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {data.interventions.length === 0 && (
            <div className="text-center py-12 border-4 border-bauhaus-black/20">
              <p className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">No interventions match your filters</p>
            </div>
          )}
        </>
      )}

      {/* Data provenance */}
      <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-canvas p-5">
        <h3 className="text-xs font-black uppercase tracking-widest mb-3">Data Sources</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-bauhaus-muted">
          <div>
            <span className="font-black text-bauhaus-black">Australian Living Map of Alternatives (ALMA)</span>
            <p>1,155 interventions with evidence ratings, outcome measurements, and cultural authority assessments. Maintained by JusticeHub.</p>
          </div>
          <div>
            <span className="font-black text-bauhaus-black">CivicGraph Entity Graph</span>
            <p>143K entities with ABN, SEIFA, remoteness, community-controlled status, and cross-system relationship mapping.</p>
          </div>
          <div>
            <span className="font-black text-bauhaus-black">Justice Funding Database</span>
            <p>71,407 funding records across 3,932 programs totalling $97.9B. Linked to entities and interventions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
