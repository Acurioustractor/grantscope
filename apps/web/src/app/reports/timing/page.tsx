import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Donate Today, Win Tomorrow | CivicGraph Temporal Analysis',
  description: 'Statistical analysis of the timing between political donations and government contract awards. 189,937 temporal matches across 134 entities.',
  openGraph: {
    title: 'Donate Today, Win Tomorrow',
    description: 'How quickly do political donors win government contracts? Temporal analysis of 189,937 donation-to-contract correlations.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Donate Today, Win Tomorrow',
    description: 'Temporal analysis: 189,937 correlations between political donations and contract awards.',
  },
};

import { money, fmt } from '@/lib/format';

interface TimingSummary {
  donor_name: string;
  contracts_after_donation: number;
  total_donated: number;
  total_contracts_after: number;
  avg_days_to_contract: number;
  immediate_contracts: number;
  short_window_contracts: number;
  medium_window_contracts: number;
  overall_roi: number;
  parties: string[];
}

interface TimingWindow {
  timing_window: string;
  count: number;
  entities: number;
  contract_value: number;
}

export default async function TimingReportPage() {
  const supabase = getServiceSupabase();

  // Fetch timing window summary via database function
  const { data: windowsRpc } = await supabase.rpc('get_timing_windows');
  const windowsRaw = (windowsRpc || []).map((r: Record<string, unknown>) => ({
    timing_window: String(r.timing_window || ''),
    count: Number(r.match_count || 0),
    entities: Number(r.entity_count || 0),
    contract_value: Number(r.contract_value || 0),
  }));

  // Fetch top entities by ROI
  const { data: topEntitiesRaw } = await supabase
    .from('mv_temporal_summary')
    .select('*')
    .order('total_contracts_after', { ascending: false })
    .limit(25);

  // Fetch fastest wins (shortest time between donation and contract)
  const { data: fastestRaw } = await supabase
    .from('mv_donation_contract_timing')
    .select('donor_name, donation_date, donation_amount, contract_start, contract_value, buyer_name, contract_title, days_between, roi_multiple')
    .gt('contract_value', 1000000)
    .order('days_between', { ascending: true })
    .limit(20);

  // Parse data
  const windows: TimingWindow[] = windowsRaw;

  const topEntities: TimingSummary[] = (topEntitiesRaw || []).map((r: Record<string, unknown>) => ({
    donor_name: String(r.donor_name || ''),
    contracts_after_donation: Number(r.contracts_after_donation || 0),
    total_donated: Number(r.total_donated || 0),
    total_contracts_after: Number(r.total_contracts_after || 0),
    avg_days_to_contract: Number(r.avg_days_to_contract || 0),
    immediate_contracts: Number(r.immediate_contracts || 0),
    short_window_contracts: Number(r.short_window_contracts || 0),
    medium_window_contracts: Number(r.medium_window_contracts || 0),
    overall_roi: Number(r.overall_roi || 0),
    parties: Array.isArray(r.parties) ? r.parties as string[] : [],
  }));

  const fastest = (fastestRaw || []) as Array<{
    donor_name: string;
    donation_date: string;
    donation_amount: number;
    contract_start: string;
    contract_value: number;
    buyer_name: string;
    contract_title: string;
    days_between: number;
    roi_multiple: number;
  }>;

  // Calculate totals
  const totalMatches = windows.reduce((s, w) => s + w.count, 0);
  const totalContractValue = windows.reduce((s, w) => s + w.contract_value, 0);
  const immediateWindow = windows.find(w => w.timing_window === 'immediate');
  const shortWindow = windows.find(w => w.timing_window === 'short');

  const windowLabels: Record<string, string> = {
    immediate: '0–90 days',
    short: '91–180 days',
    medium: '181–365 days',
    long: '1–2 years',
    very_long: '2+ years',
  };

  const windowColors: Record<string, string> = {
    immediate: 'bg-red-600',
    short: 'bg-orange-500',
    medium: 'bg-yellow-500',
    long: 'bg-blue-500',
    very_long: 'bg-gray-400',
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-4">
            <Link href="/reports" className="text-gray-400 hover:text-white text-sm uppercase tracking-widest">
              CivicGraph Reports
            </Link>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
            Donate Today,<br />Win Tomorrow.
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mb-8">
            Statistical analysis of the timing between political donations and government contract awards.
            {fmt(totalMatches)} temporal correlations across {topEntities.length} entities reveal
            the rhythm of Australian political procurement.
          </p>

          {/* Hero stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-black">{fmt(totalMatches)}</div>
              <div className="text-sm text-gray-400 uppercase tracking-widest">Temporal Matches</div>
            </div>
            <div>
              <div className="text-3xl font-black">{money(totalContractValue)}</div>
              <div className="text-sm text-gray-400 uppercase tracking-widest">Contract Value</div>
            </div>
            <div>
              <div className="text-3xl font-black">{fmt(immediateWindow?.count || 0)}</div>
              <div className="text-sm text-gray-400 uppercase tracking-widest">Within 90 Days</div>
            </div>
            <div>
              <div className="text-3xl font-black">{fmt((immediateWindow?.entities || 0) + (shortWindow?.entities || 0))}</div>
              <div className="text-sm text-gray-400 uppercase tracking-widest">Entities Fast-Track</div>
            </div>
          </div>
        </div>
      </div>

      {/* Methodology note */}
      <div className="bg-yellow-50 border-b-2 border-yellow-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-sm text-yellow-800">
            <span className="font-bold">Correlation, not causation.</span>{' '}
            This analysis identifies temporal patterns between AEC donation records and AusTender contract data.
            Many of these entities are large companies that both donate widely and win contracts routinely.
            The data reveals systemic patterns worth investigating, not individual wrongdoing.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Timing windows */}
        <section className="mb-16">
          <h2 className="text-3xl font-black mb-2 uppercase tracking-widest">The Speed of Return</h2>
          <p className="text-gray-600 mb-8">
            How quickly after a political donation does the donor win a government contract?
          </p>

          {/* Visual timeline bar */}
          <div className="mb-8">
            <div className="flex h-16 rounded overflow-hidden border-2 border-bauhaus-black">
              {windows.filter(w => w.timing_window !== 'very_long').map(w => {
                const pct = totalMatches > 0 ? (w.count / totalMatches * 100) : 0;
                return (
                  <div
                    key={w.timing_window}
                    className={`${windowColors[w.timing_window] || 'bg-gray-300'} flex items-center justify-center text-white text-xs font-bold`}
                    style={{ width: `${pct}%` }}
                    title={`${windowLabels[w.timing_window]}: ${fmt(w.count)} matches (${pct.toFixed(1)}%)`}
                  >
                    {pct > 8 && windowLabels[w.timing_window]}
                  </div>
                );
              })}
            </div>
            <div className="flex mt-2 text-xs text-gray-500">
              {windows.filter(w => w.timing_window !== 'very_long').map(w => {
                const pct = totalMatches > 0 ? (w.count / totalMatches * 100) : 0;
                return (
                  <div key={w.timing_window} style={{ width: `${pct}%` }} className="text-center">
                    {windowLabels[w.timing_window]}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Window detail cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {windows.filter(w => w.timing_window !== 'very_long').map(w => (
              <div key={w.timing_window} className="border-2 border-bauhaus-black p-4">
                <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">{windowLabels[w.timing_window]}</div>
                <div className="text-2xl font-black">{fmt(w.count)}</div>
                <div className="text-sm text-gray-600">matches</div>
                <div className="text-lg font-bold mt-2">{money(w.contract_value)}</div>
                <div className="text-xs text-gray-500">{w.entities} entities</div>
              </div>
            ))}
          </div>
        </section>

        {/* Top entities */}
        <section className="mb-16">
          <h2 className="text-3xl font-black mb-2 uppercase tracking-widest">The Fastest Returns</h2>
          <p className="text-gray-600 mb-8">
            Entities ranked by total contract value won within 2 years of making political donations.
            ROI = contract value received per dollar donated.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-4 border-bauhaus-black">
                  <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-xs">Entity</th>
                  <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs">Donated</th>
                  <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs">Contracts Won</th>
                  <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs">ROI</th>
                  <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs">Avg Days</th>
                  <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">&lt;90 Days</th>
                  <th className="text-right py-3 pl-4 font-black uppercase tracking-widest text-xs">Parties</th>
                </tr>
              </thead>
              <tbody>
                {topEntities.slice(0, 20).map((e, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium">{e.donor_name}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{money(e.total_donated)}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold">{money(e.total_contracts_after)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className={e.overall_roi > 10000 ? 'text-red-600 font-bold' : ''}>
                        {fmt(e.overall_roi)}x
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{e.avg_days_to_contract}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {e.immediate_contracts > 0 ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">
                          {fmt(e.immediate_contracts)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 pl-4 text-right text-xs text-gray-500">
                      {e.parties.length > 3
                        ? `${e.parties.length} parties`
                        : e.parties.map(p => p.replace(/Australian Labor Party.*/, 'ALP').replace(/Liberal Party.*/, 'LIB').replace(/National Party.*/, 'NAT')).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Fastest individual matches */}
        {fastest.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-black mb-2 uppercase tracking-widest">Fastest Wins</h2>
            <p className="text-gray-600 mb-8">
              Individual contracts over $1M awarded soonest after a political donation by the same entity.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black">
                    <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-xs">Entity</th>
                    <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs">Donated</th>
                    <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs">Contract</th>
                    <th className="text-left py-3 px-4 font-black uppercase tracking-widest text-xs">Buyer</th>
                    <th className="text-right py-3 px-4 font-black uppercase tracking-widest text-xs">Days</th>
                    <th className="text-right py-3 pl-4 font-black uppercase tracking-widest text-xs">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {fastest.map((f, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium">{f.donor_name}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{money(f.donation_amount)}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold">{money(f.contract_value)}</td>
                      <td className="py-3 px-4 text-xs">{f.buyer_name}</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className={f.days_between <= 30 ? 'bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold' : ''}>
                          {f.days_between}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right tabular-nums">{fmt(f.roi_multiple)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Methodology */}
        <section className="mb-16 border-2 border-bauhaus-black p-8">
          <h2 className="text-2xl font-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="grid md:grid-cols-2 gap-8 text-sm text-gray-700">
            <div>
              <h3 className="font-bold mb-2">Data Sources</h3>
              <ul className="space-y-1">
                <li>AEC Transparency Register — 312,933 political donation records</li>
                <li>AusTender — 671,886 Commonwealth contracts</li>
                <li>ABN used as join key between datasets</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">Matching Rules</h3>
              <ul className="space-y-1">
                <li>Only donations with exact dates (64,285 of 312,933 records)</li>
                <li>Only contracts over $10,000</li>
                <li>Contract must start within 2 years after donation date</li>
                <li>Same ABN links donor to contract supplier</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">Timing Windows</h3>
              <ul className="space-y-1">
                <li><span className="font-bold text-red-600">Immediate:</span> Contract within 0–90 days of donation</li>
                <li><span className="font-bold text-orange-500">Short:</span> 91–180 days</li>
                <li><span className="font-bold text-yellow-600">Medium:</span> 181–365 days</li>
                <li><span className="font-bold text-blue-500">Long:</span> 1–2 years</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">Limitations</h3>
              <ul className="space-y-1">
                <li>Only 20% of AEC donations have exact dates</li>
                <li>Large companies donate and win contracts routinely</li>
                <li>Correlation does not imply causation</li>
                <li>State-level donations not yet included</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 py-8 border-t">
          <p>
            All data sourced from public government registers.
            Analysis by <Link href="/" className="text-bauhaus-blue hover:underline">CivicGraph</Link>.
          </p>
          <p className="mt-2">
            <Link href="/reports/triple-play" className="text-bauhaus-red hover:underline">
              See also: Donate. Lobby. Win. Pay No Tax. →
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
