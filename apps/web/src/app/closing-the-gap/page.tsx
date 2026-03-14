'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface StateData {
  state: string;
  indigenous_entities: number;
  indigenous_corps: number;
  community_controlled: number;
  justice_funding_total: number;
  justice_funding_indigenous: number;
  alma_interventions: number;
  alma_jr_interventions: number;
  alma_linked: number;
  avg_seifa: number | null;
}

function formatMoney(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

// Target 11: Reduce First Nations youth (10-17) detention rate by 30% from 2018-19 baseline of 31.9 per 10,000
const TARGET_11_BASELINE = 31.9; // per 10,000 in 2018-19
const TARGET_11_GOAL = TARGET_11_BASELINE * 0.7; // 30% reduction = 22.33
const TARGET_11_YEAR = 2031;

export default function ClosingTheGapPage() {
  const [data, setData] = useState<StateData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/justice/closing-the-gap');
      const json = await res.json();
      if (res.ok) setData(json.states);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="max-w-6xl">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      {/* Hero */}
      <div className="mt-4 mb-6">
        <div className="bg-bauhaus-red border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
          <p className="text-xs font-black text-white/60 uppercase tracking-[0.3em] mb-3">CivicGraph — Allocation Intelligence</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Closing the Gap — Target 11 Tracker
          </h1>
          <p className="text-white/80 font-medium max-w-3xl leading-relaxed">
            Target 11: Reduce the rate of First Nations young people (10-17) in detention by 30% by 2031.
            Baseline: 31.9 per 10,000 (2018-19). Goal: {TARGET_11_GOAL.toFixed(1)} per 10,000.
            This dashboard maps the organisations, interventions, and funding flows that can move this target.
          </p>
        </div>
      </div>

      {/* Target 11 visual */}
      <div className="border-4 border-bauhaus-black p-6 mb-6">
        <h2 className="text-xs font-black uppercase tracking-widest mb-4">National Agreement on Closing the Gap — Target 11</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl font-black text-bauhaus-red">{TARGET_11_BASELINE}</div>
            <div className="text-xs font-bold text-bauhaus-muted mt-1">per 10,000 — 2018-19 Baseline</div>
            <div className="text-[10px] text-bauhaus-muted">First Nations youth in detention</div>
          </div>
          <div className="text-center flex flex-col justify-center">
            <div className="text-lg font-black text-bauhaus-muted">30% reduction by {TARGET_11_YEAR}</div>
            <div className="h-1 bg-bauhaus-black/20 mt-2 relative">
              <div className="absolute inset-y-0 left-0 bg-bauhaus-red" style={{ width: '70%' }} />
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-money">{TARGET_11_GOAL.toFixed(1)}</div>
            <div className="text-xs font-bold text-bauhaus-muted mt-1">per 10,000 — 2031 Target</div>
            <div className="text-[10px] text-bauhaus-muted">15 of 19 targets currently off-track</div>
          </div>
        </div>
      </div>

      {/* The CivicGraph question */}
      <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 mb-6 text-white">
        <h2 className="text-xs font-black uppercase tracking-widest text-white/50 mb-3">The Question This Answers</h2>
        <p className="text-lg font-black leading-relaxed">
          &ldquo;Which organisations receive justice funding, which deliver evidence-rated interventions
          from the Australian Living Map of Alternatives (ALMA), and where are the gaps between
          where money flows and where overrepresentation is worst?&rdquo;
        </p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-sm font-black text-bauhaus-muted uppercase tracking-widest animate-pulse">Loading data...</p>
        </div>
      )}

      {data && (
        <>
          {/* National summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6">
            {[
              { label: 'Indigenous Orgs', value: data.reduce((s, d) => s + d.indigenous_corps, 0).toString(), sub: 'Receiving justice funding' },
              { label: 'Community Controlled', value: data.reduce((s, d) => s + d.community_controlled, 0).toString(), sub: 'Self-determined governance' },
              { label: 'ALMA Interventions', value: data.reduce((s, d) => s + d.alma_interventions, 0).toString(), sub: 'Evidence-rated programs' },
              { label: 'Justice Reinvestment', value: data.reduce((s, d) => s + d.alma_jr_interventions, 0).toString(), sub: 'JR-specific interventions' },
            ].map((stat, i) => (
              <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{stat.label}</div>
                <div className="text-2xl font-black">{stat.value}</div>
                <div className="text-[10px] font-bold text-bauhaus-muted">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* State-by-state */}
          <div className="border-4 border-bauhaus-black mb-6">
            <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
              <h2 className="text-xs font-black uppercase tracking-widest">State &amp; Territory Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">State</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Indigenous Orgs</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Community Ctrl</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Justice Funding</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Indigenous Funding</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">ALMA Programs</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">JR Programs</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Linked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bauhaus-black/10">
                  {data.sort((a, b) => b.justice_funding_total - a.justice_funding_total).map(st => (
                    <tr
                      key={st.state}
                      className={`hover:bg-bauhaus-canvas/50 cursor-pointer ${selectedState === st.state ? 'bg-bauhaus-canvas' : ''}`}
                      onClick={() => setSelectedState(selectedState === st.state ? null : st.state)}
                    >
                      <td className="px-3 py-2 font-black">{st.state}</td>
                      <td className="px-3 py-2 text-right">{st.indigenous_corps}</td>
                      <td className="px-3 py-2 text-right">{st.community_controlled}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatMoney(st.justice_funding_total)}</td>
                      <td className="px-3 py-2 text-right font-mono text-bauhaus-red font-bold">{formatMoney(st.justice_funding_indigenous)}</td>
                      <td className="px-3 py-2 text-right">{st.alma_interventions}</td>
                      <td className="px-3 py-2 text-right font-bold text-bauhaus-red">{st.alma_jr_interventions}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={st.alma_linked > 0 ? 'text-money font-bold' : 'text-bauhaus-muted'}>{st.alma_linked}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-6">
            <Link
              href="/justice-reinvestment"
              className="p-6 border-4 border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
            >
              <h3 className="text-sm font-black uppercase tracking-wider mb-2">Explore Interventions</h3>
              <p className="text-sm text-bauhaus-muted">
                Browse all 1,155 Australian Living Map of Alternatives (ALMA) interventions with evidence ratings,
                linked delivery organisations, and justice funding flows.
              </p>
            </Link>
            <Link
              href="/procurement/gap-map"
              className="p-6 border-4 border-bauhaus-black md:border-l-0 hover:bg-bauhaus-canvas transition-colors"
            >
              <h3 className="text-sm font-black uppercase tracking-wider mb-2">Supply Chain Gap Map</h3>
              <p className="text-sm text-bauhaus-muted">
                Identify LGAs with no Indigenous organisations or evidence-rated interventions.
                See where the gaps are between funding flows and community need.
              </p>
            </Link>
          </div>

          {/* What this enables */}
          <div className="border-4 border-bauhaus-black">
            <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
              <h2 className="text-xs font-black uppercase tracking-widest">What This Data Enables</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-bauhaus-black/10">
              {[
                {
                  title: 'Justice Reinvestment Site Intelligence',
                  desc: 'For the $81.5M federal JR commitment: map the 62 JR interventions from the Australian Living Map of Alternatives (ALMA) to LGAs, show which delivery organisations exist in target communities, and identify gaps.',
                },
                {
                  title: 'Cross-System Linkage',
                  desc: 'Link justice funding recipients to their Australian Living Map of Alternatives (ALMA) intervention evidence. 189 organisations have both funding records AND deliver evidence-rated programs — trace money to outcomes.',
                },
                {
                  title: 'Audit Readiness',
                  desc: 'Every entity has SEIFA disadvantage, remoteness, community-controlled status, and political donation data. When auditors ask whether programs were offered in the right places, we have the answer.',
                },
                {
                  title: 'Evidence-Based Allocation',
                  desc: 'Don\'t fund blindly. The Australian Living Map of Alternatives (ALMA) has 570 evidence records including 37 quasi-experimental studies and 4 RCTs. Match proven interventions to the places that need them most.',
                },
              ].map((item, i) => (
                <div key={i} className="p-5">
                  <h3 className="text-sm font-black uppercase tracking-wider mb-2">{item.title}</h3>
                  <p className="text-sm text-bauhaus-muted leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
