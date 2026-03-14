'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ShortlistEntity {
  gs_id: string;
  name: string;
  abn: string;
  entity_type: string;
  state: string;
  postcode: string;
  remoteness: string;
  seifa_decile: number | null;
  is_community_controlled: boolean;
  lga: string;
  sector: string | null;
  contract_history: {
    count: number;
    total_value: number;
    unique_buyers: number;
    latest_contract: string | null;
  };
  capability_score: number;
}

interface Gap {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

interface TenderPackResult {
  pack: {
    title: string;
    generated_at: string;
    filters: { lgas: string[]; postcodes: string[]; states: string[]; entity_types: string[]; keywords?: string };
  };
  shortlist: ShortlistEntity[];
  compliance_forecast: {
    ipp_target: number;
    sme_target: number;
    total_available: number;
    indigenous_available: number;
    social_enterprise_available: number;
    community_controlled_available: number;
    with_contract_experience: number;
    ipp_achievable: boolean;
    sme_achievable: boolean;
  };
  gaps: Gap[];
  summary: {
    total_entities: number;
    by_type: Record<string, number>;
    by_state: Record<string, number>;
    total_contract_value: number;
  };
}

function formatMoney(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export default function TenderPackPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TenderPackResult | null>(null);

  // Filters
  const [lgaInput, setLgaInput] = useState('');
  const [postcodeInput, setPostcodeInput] = useState('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [entityTypes, setEntityTypes] = useState<string[]>(['indigenous_corp', 'social_enterprise', 'charity']);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    const lgas = lgaInput.split(/[,;\n]+/).map(l => l.trim()).filter(Boolean);
    const postcodes = postcodeInput.split(/[\s,;]+/).map(p => p.trim()).filter(p => /^\d{4}$/.test(p));

    if (!lgas.length && !postcodes.length && !selectedStates.length) {
      setError('Provide at least one LGA, postcode, or state');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/procurement/tender-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lgas,
          postcodes,
          states: selectedStates,
          entity_types: entityTypes,
          keywords: keywords || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Generation failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    setLgaInput('Dubbo Regional\nBourke\nBrewarrina');
    setSelectedStates(['NSW']);
    setKeywords('');
  };

  return (
    <div className="max-w-6xl">
      <Link href="/procurement" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Procurement Dashboard
      </Link>

      {/* Hero */}
      <div className="mt-4 mb-6">
        <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
          <p className="text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-3">CivicGraph</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Tender Intelligence Pack
          </h1>
          <p className="text-white/70 font-medium max-w-3xl leading-relaxed">
            Input your project&apos;s geographic boundaries and categories. Get a verified local supplier shortlist,
            compliance forecast against IPP/SME targets, and a gap analysis — all exportable as tender evidence.
          </p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-6">
          {/* Filters */}
          <div className="border-4 border-bauhaus-black p-6 space-y-5">
            <h2 className="text-xs font-black uppercase tracking-widest">Project Footprint</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-bauhaus-muted">LGAs (one per line)</label>
                  <button onClick={loadExample} className="text-xs font-bold text-bauhaus-blue hover:underline">Load example</button>
                </div>
                <textarea
                  value={lgaInput}
                  onChange={(e) => setLgaInput(e.target.value)}
                  placeholder="e.g. Dubbo Regional&#10;Bourke&#10;Brewarrina"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border-2 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none resize-y"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-bauhaus-muted block mb-2">Or Postcodes</label>
                <textarea
                  value={postcodeInput}
                  onChange={(e) => setPostcodeInput(e.target.value)}
                  placeholder="e.g. 2830, 2840, 2850"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border-2 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none resize-y"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-bauhaus-muted block mb-2">States</label>
              <div className="flex flex-wrap gap-2">
                {STATES.map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStates(prev =>
                      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
                    )}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 transition-colors ${
                      selectedStates.includes(st)
                        ? 'border-bauhaus-black bg-bauhaus-black text-white'
                        : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-bauhaus-muted block mb-2">Keywords (optional)</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. construction, logistics, catering"
                className="w-full px-3 py-2 text-sm border-2 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-bauhaus-muted block mb-2">Entity Types</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'indigenous_corp', label: 'Indigenous' },
                  { key: 'social_enterprise', label: 'Social Enterprise' },
                  { key: 'charity', label: 'Charity' },
                  { key: 'company', label: 'Company' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setEntityTypes(prev =>
                      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
                    )}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 transition-colors ${
                      entityTypes.includes(key)
                        ? key === 'indigenous_corp' ? 'border-bauhaus-red bg-bauhaus-red text-white'
                          : 'border-bauhaus-black bg-bauhaus-black text-white'
                        : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="border-4 border-bauhaus-red bg-bauhaus-red/10 p-4">
              <p className="text-sm font-bold text-bauhaus-red">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full px-6 py-4 bg-bauhaus-black text-white font-black text-sm uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating pack...' : 'Generate Tender Intelligence Pack'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pack header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black">{result.pack.title}</h2>
            <button
              onClick={() => setResult(null)}
              className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
            >
              New Pack
            </button>
          </div>

          {/* Compliance forecast */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-0">
            {[
              { label: 'Total Found', value: result.compliance_forecast.total_available.toString() },
              { label: 'Indigenous', value: result.compliance_forecast.indigenous_available.toString(), flag: result.compliance_forecast.ipp_achievable },
              { label: 'Social Enterprise', value: result.compliance_forecast.social_enterprise_available.toString() },
              { label: 'Community Ctrl', value: result.compliance_forecast.community_controlled_available.toString() },
              { label: 'W/ Contracts', value: result.compliance_forecast.with_contract_experience.toString() },
            ].map((stat, i) => (
              <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{stat.label}</div>
                <div className="text-2xl font-black">{stat.value}</div>
                {stat.flag !== undefined && (
                  <div className={`text-[10px] font-black ${stat.flag ? 'text-money' : 'text-bauhaus-red'}`}>
                    {stat.flag ? 'IPP achievable' : 'IPP at risk'}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Gaps */}
          {result.gaps.length > 0 && (
            <div className="border-4 border-bauhaus-black">
              <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
                <h2 className="text-xs font-black uppercase tracking-widest">Gap Analysis</h2>
              </div>
              <div className="divide-y divide-bauhaus-black/10">
                {result.gaps.map((gap, i) => (
                  <div key={i} className="p-4 flex gap-3 items-start">
                    <span className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                      gap.severity === 'high' ? 'bg-bauhaus-red' :
                      gap.severity === 'medium' ? 'bg-bauhaus-blue' :
                      'bg-money'
                    }`} />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">{gap.type.replace(/_/g, ' ')}</span>
                      <p className="text-sm text-bauhaus-muted mt-0.5">{gap.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supplier shortlist */}
          <div className="border-4 border-bauhaus-black">
            <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest">Verified Supplier Shortlist</h2>
              <span className="text-xs font-bold text-bauhaus-muted">{result.shortlist.length} entities — {formatMoney(result.summary.total_contract_value)} in prior contracts</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Entity</th>
                    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Type</th>
                    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Location</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Contracts</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Value</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bauhaus-black/10">
                  {result.shortlist.map((entity) => (
                    <tr key={entity.gs_id} className="hover:bg-bauhaus-canvas/50">
                      <td className="px-3 py-2">
                        <Link href={`/entities/${entity.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue underline">
                          {entity.name}
                        </Link>
                        <div className="text-xs font-mono text-bauhaus-muted">{entity.abn}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border ${
                          entity.entity_type === 'indigenous_corp' ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red' :
                          entity.entity_type === 'charity' ? 'border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue' :
                          'border-bauhaus-black/20 text-bauhaus-muted'
                        }`}>
                          {entity.entity_type.replace(/_/g, ' ')}
                        </span>
                        {entity.is_community_controlled && (
                          <span className="ml-1 text-[10px] px-1 py-0.5 font-black border border-money bg-money/10 text-money">CC</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-bauhaus-muted">
                        {entity.lga || entity.state}
                        {entity.remoteness && !entity.remoteness.includes('Major') && (
                          <span className="ml-1 text-[10px] font-bold text-bauhaus-red">{entity.remoteness.replace(' Australia', '')}</span>
                        )}
                        {entity.seifa_decile && entity.seifa_decile <= 3 && (
                          <span className="ml-1 text-[10px] font-bold text-bauhaus-red">SEIFA {entity.seifa_decile}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{entity.contract_history.count}</td>
                      <td className="px-3 py-2 text-xs font-mono text-right">{formatMoney(entity.contract_history.total_value)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-sm font-black ${
                          entity.capability_score >= 60 ? 'text-money' :
                          entity.capability_score >= 30 ? 'text-bauhaus-blue' :
                          'text-bauhaus-muted'
                        }`}>
                          {entity.capability_score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            <div className="border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">By Entity Type</h3>
              {Object.entries(result.summary.by_type).sort(([,a],[,b]) => b - a).map(([type, count]) => (
                <div key={type} className="flex justify-between py-1">
                  <span className="text-sm font-bold text-bauhaus-muted">{type.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-black">{count}</span>
                </div>
              ))}
            </div>
            <div className="border-4 border-bauhaus-black sm:border-l-0 p-4">
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">By State</h3>
              {Object.entries(result.summary.by_state).sort(([,a],[,b]) => b - a).map(([state, count]) => (
                <div key={state} className="flex justify-between py-1">
                  <span className="text-sm font-bold text-bauhaus-muted">{state}</span>
                  <span className="text-sm font-black">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
