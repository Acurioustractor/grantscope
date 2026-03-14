'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';

interface LgaGap {
  lga_name: string;
  state: string;
  total_entities: number;
  indigenous_entities: number;
  social_enterprises: number;
  community_controlled: number;
  total_contracts: number;
  total_contract_value: number;
  remoteness: string | null;
  avg_seifa: number | null;
  gap_score: number; // 0-100, higher = bigger gap
  gap_type: 'no_indigenous' | 'low_indigenous' | 'no_contracts' | 'underserved' | 'adequate';
}

function formatMoney(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function GapMapPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedState, setSelectedState] = useState('NSW');
  const [gaps, setGaps] = useState<LgaGap[] | null>(null);
  const [sortBy, setSortBy] = useState<'gap_score' | 'indigenous_entities' | 'total_contract_value'>('gap_score');

  const handleAnalyse = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/procurement/gap-map?state=${selectedState}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Analysis failed');
      } else {
        setGaps(data.gaps);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [selectedState]);

  const sorted = gaps?.sort((a, b) => {
    if (sortBy === 'gap_score') return b.gap_score - a.gap_score;
    if (sortBy === 'indigenous_entities') return a.indigenous_entities - b.indigenous_entities;
    return b.total_contract_value - a.total_contract_value;
  });

  const gapColorClass = (gap: LgaGap) => {
    if (gap.gap_score >= 80) return 'bg-bauhaus-red';
    if (gap.gap_score >= 60) return 'bg-bauhaus-red/60';
    if (gap.gap_score >= 40) return 'bg-bauhaus-blue/60';
    if (gap.gap_score >= 20) return 'bg-bauhaus-blue/30';
    return 'bg-money/30';
  };

  return (
    <div className="max-w-6xl">
      <Link href="/procurement" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Procurement Dashboard
      </Link>

      <div className="mt-4 mb-6">
        <div className="bg-bauhaus-red border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
          <p className="text-xs font-black text-white/60 uppercase tracking-[0.3em] mb-3">CivicGraph</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Supply Chain Gap Map
          </h1>
          <p className="text-white/80 font-medium max-w-3xl leading-relaxed">
            Identify LGAs where your supply chain has no Indigenous or social enterprise suppliers.
            See exactly where the gaps are to target supplier development and meet IPP/SME targets.
          </p>
        </div>
      </div>

      {/* State selector */}
      <div className="flex gap-2 mb-6 items-center">
        <span className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mr-2">State:</span>
        {['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'].map(st => (
          <button
            key={st}
            onClick={() => { setSelectedState(st); setGaps(null); }}
            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 transition-colors ${
              selectedState === st
                ? 'border-bauhaus-black bg-bauhaus-black text-white'
                : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black'
            }`}
          >
            {st}
          </button>
        ))}
        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="ml-4 px-4 py-1.5 bg-bauhaus-blue text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Analyse Gaps'}
        </button>
      </div>

      {error && (
        <div className="border-4 border-bauhaus-red bg-bauhaus-red/10 p-4 mb-6">
          <p className="text-sm font-bold text-bauhaus-red">{error}</p>
        </div>
      )}

      {sorted && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
            {[
              { label: 'LGAs Analysed', value: sorted.length.toString() },
              { label: 'No Indigenous Supply', value: sorted.filter(g => g.gap_type === 'no_indigenous').length.toString(), color: 'text-bauhaus-red' },
              { label: 'Low Indigenous', value: sorted.filter(g => g.gap_type === 'low_indigenous').length.toString(), color: 'text-bauhaus-blue' },
              { label: 'Adequate', value: sorted.filter(g => g.gap_type === 'adequate').length.toString(), color: 'text-money' },
            ].map((stat, i) => (
              <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{stat.label}</div>
                <div className={`text-2xl font-black ${stat.color || ''}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Visual gap map (heatmap-style) */}
          <div className="border-4 border-bauhaus-black">
            <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest">LGA Gap Heatmap — {selectedState}</h2>
              <div className="flex gap-2">
                {(['gap_score', 'indigenous_entities', 'total_contract_value'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 ${
                      sortBy === s ? 'bg-bauhaus-black text-white' : 'text-bauhaus-muted hover:text-bauhaus-black'
                    }`}
                  >
                    {s === 'gap_score' ? 'By Gap' : s === 'indigenous_entities' ? 'By Indigenous' : 'By Value'}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-1">
                {sorted.map(gap => (
                  <div
                    key={gap.lga_name}
                    className={`${gapColorClass(gap)} px-2 py-1 text-[10px] font-bold text-white cursor-default group relative`}
                    title={`${gap.lga_name}: ${gap.indigenous_entities} Indigenous, ${gap.total_entities} total, Gap: ${gap.gap_score}`}
                  >
                    {gap.lga_name.length > 15 ? gap.lga_name.slice(0, 12) + '...' : gap.lga_name}
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 bg-bauhaus-black text-white p-2 text-[10px] w-48 shadow-lg">
                      <div className="font-black">{gap.lga_name}</div>
                      <div>Indigenous: {gap.indigenous_entities}</div>
                      <div>Social Enterprise: {gap.social_enterprises}</div>
                      <div>Total entities: {gap.total_entities}</div>
                      <div>Contracts: {formatMoney(gap.total_contract_value)}</div>
                      <div>SEIFA avg: {gap.avg_seifa?.toFixed(0) || '—'}</div>
                      <div>Gap score: {gap.gap_score}/100</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-4 text-[10px] font-bold text-bauhaus-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-red inline-block" /> Critical gap</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-red/60 inline-block" /> High gap</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-blue/60 inline-block" /> Moderate</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-money/30 inline-block" /> Adequate</span>
              </div>
            </div>
          </div>

          {/* Detail table */}
          <div className="border-4 border-bauhaus-black">
            <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
              <h2 className="text-xs font-black uppercase tracking-widest">LGA Detail</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">LGA</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Indigenous</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">SE</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Total</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Contracts</th>
                    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Remoteness</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">SEIFA</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Gap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bauhaus-black/10">
                  {sorted.slice(0, 50).map(gap => (
                    <tr key={gap.lga_name} className="hover:bg-bauhaus-canvas/50">
                      <td className="px-3 py-2 font-bold">{gap.lga_name}</td>
                      <td className={`px-3 py-2 text-right font-black ${gap.indigenous_entities === 0 ? 'text-bauhaus-red' : ''}`}>
                        {gap.indigenous_entities}
                      </td>
                      <td className="px-3 py-2 text-right">{gap.social_enterprises}</td>
                      <td className="px-3 py-2 text-right">{gap.total_entities}</td>
                      <td className="px-3 py-2 text-right text-xs font-mono">{formatMoney(gap.total_contract_value)}</td>
                      <td className="px-3 py-2 text-xs text-bauhaus-muted">
                        {gap.remoteness?.replace(' Australia', '') || '—'}
                      </td>
                      <td className={`px-3 py-2 text-right ${gap.avg_seifa && gap.avg_seifa <= 3 ? 'font-black text-bauhaus-red' : ''}`}>
                        {gap.avg_seifa?.toFixed(1) || '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-sm font-black ${
                          gap.gap_score >= 60 ? 'text-bauhaus-red' :
                          gap.gap_score >= 30 ? 'text-bauhaus-blue' :
                          'text-money'
                        }`}>
                          {gap.gap_score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
