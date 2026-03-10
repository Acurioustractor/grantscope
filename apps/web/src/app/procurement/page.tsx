'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Supplier {
  abn: string;
  name: string | null;
  matched: boolean;
  is_indigenous: boolean;
  is_social_enterprise: boolean;
  is_community_controlled: boolean;
  is_charity: boolean;
  entity_type: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  lga: string | null;
  certifications: Array<{ body: string }> | null;
  source: string | null;
  contract_value: number | null;
}

interface SegmentStat {
  count: number;
  percentage: number;
  value?: number;
  value_percentage?: number;
}

interface DisadvantageBreakdown {
  count: number;
  value: number;
  label: string;
}

interface AnalysisResult {
  summary: {
    total_suppliers: number;
    matched_suppliers: number;
    match_rate: number;
    indigenous: SegmentStat;
    social_enterprise: SegmentStat;
    community_controlled: SegmentStat;
    charity: SegmentStat;
    by_remoteness: Record<string, { count: number; value: number }>;
    by_state: Record<string, { count: number; value: number }>;
    by_disadvantage: Record<string, DisadvantageBreakdown>;
    total_contract_value: number | null;
  };
  suppliers: Supplier[];
}

function formatMoney(amount: number | null | undefined): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function ProcurementPage() {
  const [abnInput, setAbnInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  const handleAnalyse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    // Parse ABNs from input (comma, newline, or space separated)
    const abns = abnInput
      .split(/[\s,;]+/)
      .map(a => a.replace(/\D/g, ''))
      .filter(a => a.length === 11);

    if (abns.length === 0) {
      setError('Enter at least one valid ABN (11 digits)');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/procurement/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abns }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Analysis failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    // Real ABNs of well-known Indigenous/social enterprises
    setAbnInput([
      '91604482966',  // Indigenous enterprise
      '55606241203',  // Arrilla Indigenous Consulting
      '42093279985',  // Brotherhood of St Laurence
      '86008474422',  // Mission Australia
      '53169542648',  // Goodstart Early Learning
      '78004085330',  // St Vincent de Paul
      '88610252511',  // Random company
      '47110995518',  // Random company
    ].join('\n'));
  };

  return (
    <div className="max-w-5xl">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      {/* Hero */}
      <div className="mt-4 mb-8">
        <div className="bg-bauhaus-blue border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
          <p className="text-xs font-black text-white/60 uppercase tracking-[0.3em] mb-3">Procurement Intelligence</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Social Impact Analyser
          </h1>
          <p className="text-white/80 font-medium max-w-2xl leading-relaxed">
            Paste your supplier ABNs to instantly see your social procurement profile: Indigenous, social enterprise, community-controlled, disability enterprise, and charity suppliers mapped by location, remoteness, and disadvantage.
          </p>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleAnalyse} className="mb-8">
        <div className="border-4 border-bauhaus-black">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Supplier ABNs</span>
            <button type="button" onClick={loadExample} className="text-xs font-bold text-bauhaus-blue hover:text-bauhaus-black underline">
              Load example
            </button>
          </div>
          <textarea
            value={abnInput}
            onChange={(e) => setAbnInput(e.target.value)}
            placeholder="Paste ABNs here — one per line, comma-separated, or space-separated. Up to 500 ABNs."
            rows={6}
            className="w-full px-4 py-3 text-sm font-mono focus:outline-none resize-y"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-0 w-full px-6 py-3 bg-bauhaus-black text-white font-black text-sm uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50 border-4 border-bauhaus-black border-t-0"
        >
          {loading ? 'Analysing...' : 'Analyse Supplier Base'}
        </button>
      </form>

      {error && (
        <div className="border-4 border-bauhaus-red bg-bauhaus-red/10 p-4 mb-8">
          <p className="text-sm font-bold text-bauhaus-red">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Top-line stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
            {[
              { label: 'Suppliers', value: result.summary.total_suppliers.toString(), sub: `${result.summary.matched_suppliers} matched (${pct(result.summary.match_rate)})` },
              { label: 'Indigenous', value: pct(result.summary.indigenous.percentage), sub: `${result.summary.indigenous.count} suppliers`, color: 'bauhaus-red' },
              { label: 'Social Enterprise', value: pct(result.summary.social_enterprise.percentage), sub: `${result.summary.social_enterprise.count} suppliers`, color: 'bauhaus-blue' },
              { label: 'Community Controlled', value: pct(result.summary.community_controlled.percentage), sub: `${result.summary.community_controlled.count} suppliers`, color: 'money' },
            ].map((stat, i) => (
              <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''} ${stat.color ? `bg-${stat.color}/5` : 'bg-white'}`}>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">{stat.label}</div>
                <div className="text-2xl font-black text-bauhaus-black">{stat.value}</div>
                <div className="text-xs font-bold text-bauhaus-muted mt-1">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Disadvantage breakdown */}
          <div className="border-4 border-bauhaus-black">
            <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
              <h2 className="text-xs font-black uppercase tracking-widest">Spend by Disadvantage (SEIFA)</h2>
            </div>
            <div className="divide-y-4 divide-bauhaus-black">
              {Object.entries(result.summary.by_disadvantage)
                .filter(([, v]) => v.count > 0)
                .map(([key, val]) => {
                  const totalSuppliers = result.summary.total_suppliers;
                  const barWidth = totalSuppliers > 0 ? (val.count / totalSuppliers) * 100 : 0;
                  return (
                    <div key={key} className="p-3 flex items-center gap-4">
                      <div className="w-48 text-xs font-bold text-bauhaus-muted truncate">{val.label}</div>
                      <div className="flex-1 h-6 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
                        <div
                          className={`h-full ${key === 'most_disadvantaged' ? 'bg-bauhaus-red' : key === 'disadvantaged' ? 'bg-bauhaus-red/60' : key === 'most_advantaged' ? 'bg-money' : 'bg-bauhaus-blue/40'}`}
                          style={{ width: `${Math.max(barWidth, 2)}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm font-black">{val.count}</div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Remoteness breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            <div className="border-4 border-bauhaus-black">
              <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
                <h2 className="text-xs font-black uppercase tracking-widest">By Remoteness</h2>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(result.summary.by_remoteness)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-sm font-bold text-bauhaus-muted">{key}</span>
                      <span className="text-sm font-black">{val.count}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="border-4 border-bauhaus-black border-l-0">
              <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
                <h2 className="text-xs font-black uppercase tracking-widest">By State</h2>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(result.summary.by_state)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-sm font-bold text-bauhaus-muted">{key}</span>
                      <span className="text-sm font-black">{val.count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Supplier table */}
          <div className="border-4 border-bauhaus-black">
            <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest">Supplier Detail</h2>
              <span className="text-xs font-bold text-bauhaus-muted">{result.suppliers.length} suppliers</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                    <th className="px-3 py-2 text-left text-xs font-black uppercase tracking-wider">Supplier</th>
                    <th className="px-3 py-2 text-left text-xs font-black uppercase tracking-wider">ABN</th>
                    <th className="px-3 py-2 text-left text-xs font-black uppercase tracking-wider">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-black uppercase tracking-wider">Location</th>
                    <th className="px-3 py-2 text-left text-xs font-black uppercase tracking-wider">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bauhaus-black/10">
                  {result.suppliers.map((s) => (
                    <tr key={s.abn} className={`${!s.matched ? 'opacity-50' : ''} hover:bg-bauhaus-canvas/50`}>
                      <td className="px-3 py-2 font-bold text-bauhaus-black">{s.name || 'Unknown'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-bauhaus-muted">{s.abn}</td>
                      <td className="px-3 py-2">
                        {s.entity_type && (
                          <span className={`text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border ${
                            s.entity_type === 'indigenous_corp' ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red' :
                            s.entity_type === 'charity' ? 'border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue' :
                            'border-bauhaus-black/20 text-bauhaus-muted'
                          }`}>
                            {s.entity_type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-bauhaus-muted">
                        {s.state}{s.postcode ? ` ${s.postcode}` : ''}
                        {s.remoteness && !s.remoteness.includes('Major') && (
                          <span className="ml-1 text-[10px] font-bold text-bauhaus-red">{s.remoteness.replace(' Australia', '')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {s.is_indigenous && <span className="text-[10px] px-1 py-0.5 font-black border border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red">INDIGENOUS</span>}
                          {s.is_social_enterprise && <span className="text-[10px] px-1 py-0.5 font-black border border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue">SE</span>}
                          {s.is_community_controlled && <span className="text-[10px] px-1 py-0.5 font-black border border-money bg-money/10 text-money">CC</span>}
                          {s.is_charity && <span className="text-[10px] px-1 py-0.5 font-black border border-bauhaus-black/20 text-bauhaus-muted">CHARITY</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* API callout */}
          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5">
            <h3 className="text-xs font-black uppercase tracking-widest mb-2">Integrate This</h3>
            <p className="text-sm font-medium text-bauhaus-muted mb-3">
              Use the Procurement Analysis API to integrate social impact scoring into your procurement systems.
            </p>
            <pre className="text-xs font-mono bg-bauhaus-black text-white p-3 overflow-x-auto">
{`POST /api/procurement/analyse
Content-Type: application/json

{
  "abns": ["91604482966", "42093279985", ...],
  "values": { "91604482966": 150000, ... }  // optional contract values
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Empty state with value prop */}
      {!result && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 mt-4">
          {[
            { title: 'IPP Compliance', desc: 'Track Indigenous Procurement Policy targets across your supplier base. See exactly which suppliers count toward your 3-4% targets.' },
            { title: 'Social Procurement', desc: 'Map social enterprise, community-controlled, and disability enterprise suppliers. Identify gaps and opportunities by region.' },
            { title: 'Place Intelligence', desc: 'See where your spend lands — by remoteness, disadvantage, and LGA. Understand the community impact of your procurement.' },
          ].map((card, i) => (
            <div key={i} className={`p-5 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
              <h3 className="text-sm font-black uppercase tracking-wider mb-2">{card.title}</h3>
              <p className="text-sm text-bauhaus-muted font-medium leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
