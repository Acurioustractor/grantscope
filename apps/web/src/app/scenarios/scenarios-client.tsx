'use client';

import { useState } from 'react';

const SOURCES = [
  { value: 'detention', label: 'Detention & Corrective Services' },
  { value: 'procurement', label: 'Detention Procurement (AusTender)' },
];

const TARGETS = [
  { value: 'community', label: 'Community & Diversion Programs' },
  { value: 'evidence-backed', label: 'Evidence-Backed Programs (ALMA)' },
  { value: 'community-controlled', label: 'Community-Controlled Organisations' },
];

const STATES = ['All', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

function money(n: number): string {
  if (!n) return '$0';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString('en-AU')}`;
}

interface ScenarioResult {
  current: {
    source_total: number;
    source_label: string;
    target_total: number;
    target_label: string;
    target_orgs: number;
    desert_count: number;
    avg_desert_score: number;
  };
  scenario: {
    redirect_pct: number;
    redirected_amount: number;
    new_target_total: number;
    pct_increase: number;
  };
  top_impact_lgas: Array<{
    lga_name: string;
    state: string;
    remoteness: string;
    desert_score: number;
    current_funding: number;
    allocated: number;
    current_per_entity: number;
    new_per_entity: number;
  }>;
  benefiting_entities: Array<{
    canonical_name: string;
    entity_type: string;
    is_community_controlled: boolean;
    lga_name: string;
    state: string;
  }>;
}

export function ScenariosClient() {
  const [source, setSource] = useState('detention');
  const [target, setTarget] = useState('community');
  const [redirectPct, setRedirectPct] = useState(10);
  const [state, setState] = useState('All');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          target,
          redirect_pct: redirectPct,
          state: state === 'All' ? undefined : state,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error \u2014 please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Decision Tools</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">Allocation Scenario Modelling</h1>
        <p className="text-bauhaus-muted text-base max-w-2xl font-medium leading-relaxed">
          What happens if we redirect funding from detention to community programs?
          Model the impact on funding deserts and community organisations using real data.
        </p>
      </div>

      {/* Controls */}
      <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 mb-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-yellow-300 mb-2">Redirect From</label>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-white/30 text-sm font-bold text-white bg-white/10"
              disabled={loading}
            >
              {SOURCES.map(s => (
                <option key={s.value} value={s.value} className="text-bauhaus-black">{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-yellow-300 mb-2">Redirect To</label>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-white/30 text-sm font-bold text-white bg-white/10"
              disabled={loading}
            >
              {TARGETS.map(t => (
                <option key={t.value} value={t.value} className="text-bauhaus-black">{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-yellow-300 mb-2">
              Redirect: {redirectPct}%
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={redirectPct}
              onChange={e => setRedirectPct(Number(e.target.value))}
              className="w-full mt-2 accent-bauhaus-red"
              disabled={loading}
            />
            <div className="flex justify-between text-[9px] font-bold text-white/50 mt-1">
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-yellow-300 mb-2">State</label>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-white/30 text-sm font-bold text-white bg-white/10"
              disabled={loading}
            >
              {STATES.map(s => (
                <option key={s} value={s} className="text-bauhaus-black">{s === 'All' ? 'All States' : s}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-4 w-full px-6 py-3 bg-bauhaus-red text-white font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors disabled:opacity-40"
        >
          {loading ? 'Computing\u2026' : 'Run Scenario'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border-4 border-bauhaus-red p-4 mb-6 bg-bauhaus-red/5">
          <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-1">Error</div>
          <p className="text-bauhaus-black font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Before / After cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-8">
            {/* Current state */}
            <div className="border-4 border-bauhaus-black p-6">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-4">Current State</div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-bold text-bauhaus-muted">{result.current.source_label}</div>
                  <div className="text-2xl font-black text-bauhaus-black">{money(result.current.source_total)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-bauhaus-muted">{result.current.target_label}</div>
                  <div className="text-2xl font-black text-bauhaus-black">{money(result.current.target_total)}</div>
                  <div className="text-xs font-bold text-bauhaus-muted">{result.current.target_orgs} organisations</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-bauhaus-muted">Funding Deserts</div>
                  <div className="text-lg font-black text-bauhaus-red">{result.current.desert_count} LGAs</div>
                  <div className="text-xs font-bold text-bauhaus-muted">Avg desert score: {result.current.avg_desert_score}</div>
                </div>
              </div>
            </div>

            {/* Arrow / redirect */}
            <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white flex flex-col items-center justify-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-yellow-300 mb-2">Redirecting</div>
              <div className="text-4xl font-black">{result.scenario.redirect_pct}%</div>
              <div className="text-2xl font-black mt-1">{money(result.scenario.redirected_amount)}</div>
              <div className="mt-4 text-5xl">&rarr;</div>
            </div>

            {/* Scenario */}
            <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue/5">
              <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest mb-4">Scenario Result</div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-bold text-bauhaus-muted">New {result.current.target_label} Funding</div>
                  <div className="text-2xl font-black text-bauhaus-blue">{money(result.scenario.new_target_total)}</div>
                  <div className="text-xs font-black text-green-600">+{result.scenario.pct_increase}% increase</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-bauhaus-muted">Redirected Amount</div>
                  <div className="text-lg font-black text-bauhaus-black">{money(result.scenario.redirected_amount)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-bauhaus-muted">Top Desert LGAs Impacted</div>
                  <div className="text-lg font-black text-bauhaus-black">{result.top_impact_lgas.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Impact LGAs */}
          {result.top_impact_lgas.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
                Top LGAs by Impact (Funding Desert Allocation)
              </h2>
              <div className="border-4 border-bauhaus-black overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-black text-white">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">LGA</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">State</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Remoteness</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-widest">Desert Score</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-widest">Current $/entity</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-widest">Allocated</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-widest">New $/entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_impact_lgas.map((lga, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                        <td className="px-3 py-2 font-bold text-bauhaus-black border-t border-bauhaus-black/10">{lga.lga_name}</td>
                        <td className="px-3 py-2 font-medium text-bauhaus-black border-t border-bauhaus-black/10">{lga.state}</td>
                        <td className="px-3 py-2 font-medium text-bauhaus-muted border-t border-bauhaus-black/10 text-xs">{lga.remoteness}</td>
                        <td className="px-3 py-2 font-black text-bauhaus-red border-t border-bauhaus-black/10 text-right">{lga.desert_score.toFixed(1)}</td>
                        <td className="px-3 py-2 font-medium text-bauhaus-black border-t border-bauhaus-black/10 text-right">${lga.current_per_entity}</td>
                        <td className="px-3 py-2 font-black text-green-700 border-t border-bauhaus-black/10 text-right">{money(lga.allocated)}</td>
                        <td className="px-3 py-2 font-black text-bauhaus-blue border-t border-bauhaus-black/10 text-right">${lga.new_per_entity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Benefiting entities */}
          {result.benefiting_entities.length > 0 && (
            <div>
              <h2 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
                Organisations That Would Benefit
              </h2>
              <div className="border-4 border-bauhaus-black overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-black text-white">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Organisation</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">Type</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">LGA</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">State</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest">Community Controlled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.benefiting_entities.map((e, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                        <td className="px-3 py-2 font-bold text-bauhaus-black border-t border-bauhaus-black/10">{e.canonical_name}</td>
                        <td className="px-3 py-2 font-medium text-bauhaus-muted border-t border-bauhaus-black/10 text-xs uppercase">{e.entity_type}</td>
                        <td className="px-3 py-2 font-medium text-bauhaus-black border-t border-bauhaus-black/10">{e.lga_name}</td>
                        <td className="px-3 py-2 font-medium text-bauhaus-black border-t border-bauhaus-black/10">{e.state}</td>
                        <td className="px-3 py-2 font-black text-center border-t border-bauhaus-black/10">
                          {e.is_community_controlled && (
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-black uppercase tracking-widest">
                              Yes
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
