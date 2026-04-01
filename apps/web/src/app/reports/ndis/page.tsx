import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

export const revalidate = 3600;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Row = Record<string, unknown>;

function fmt(n: number) {
  return n.toLocaleString('en-AU');
}

function money(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number | null | undefined) {
  return n == null ? '—' : `${Math.round(Number(n))}%`;
}

function num(v: unknown): number {
  return Number(v) || 0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getData() {
  const supabase = getServiceSupabase();
  const q = (query: string) => safe(supabase.rpc('exec_sql', { query })) as Promise<Row[] | null>;

  const [
    nationalStats,
    participantsByState,
    disabilityBreakdown,
    utilisationByClass,
    utilisationByState,
    marketConcentration,
    providersByState,
    registeredProviders,
    geographicGaps,
    topDesertLgas,
    crossSystemStats,
  ] = await Promise.all([

    // National headline stats
    q(`SELECT
        SUM(active_participants) FILTER (WHERE state = 'ALL' AND disability_group = 'ALL' AND age_band = 'ALL' AND support_class = 'ALL') as total_participants,
        AVG(avg_annual_budget) FILTER (WHERE state = 'ALL' AND disability_group = 'ALL' AND age_band = 'ALL' AND support_class = 'ALL') as avg_plan_budget
      FROM ndis_participants
      WHERE report_date = (SELECT MAX(report_date) FROM ndis_participants)`),

    // Participants by state (latest quarter, ALL groups)
    q(`SELECT state, SUM(active_participants) as participants, ROUND(AVG(avg_annual_budget)::numeric, 0) as avg_budget
      FROM ndis_participants
      WHERE report_date = (SELECT MAX(report_date) FROM ndis_participants)
        AND disability_group = 'ALL' AND age_band = 'ALL' AND support_class = 'ALL'
        AND state NOT IN ('ALL', 'OT', 'State_Missing')
      GROUP BY state ORDER BY participants DESC`),

    // Top disability types nationally
    q(`SELECT disability_group, SUM(active_participants) as participants
      FROM ndis_participants
      WHERE report_date = (SELECT MAX(report_date) FROM ndis_participants)
        AND state = 'ALL' AND age_band = 'ALL' AND support_class = 'ALL'
        AND disability_group NOT IN ('ALL')
      GROUP BY disability_group ORDER BY participants DESC LIMIT 10`),

    // Utilisation by support class (national)
    q(`SELECT support_class, ROUND(AVG(utilisation_rate)::numeric, 1) as avg_util
      FROM ndis_utilisation
      WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation)
        AND state = 'ALL' AND age_group = 'ALL' AND disability_type = 'ALL'
        AND service_district = 'ALL'
        AND support_class NOT IN ('ALL', 'SuppClass_Missing')
      GROUP BY support_class ORDER BY avg_util ASC`),

    // Utilisation by state
    q(`SELECT state, ROUND(AVG(utilisation_rate)::numeric, 1) as avg_util,
        ROUND(MIN(utilisation_rate)::numeric, 1) as min_util,
        ROUND(MAX(utilisation_rate)::numeric, 1) as max_util
      FROM ndis_utilisation
      WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation)
        AND disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL'
        AND service_district != 'ALL' AND state NOT IN ('ALL', 'OT', 'State_Missing')
      GROUP BY state ORDER BY avg_util ASC`),

    // Market concentration — most concentrated districts (Core support)
    q(`SELECT state_code, service_district_name,
        ROUND(AVG(payment_share_top10_pct)::numeric, 1) as avg_top10_share
      FROM ndis_market_concentration
      WHERE report_date = (SELECT MAX(report_date) FROM ndis_market_concentration)
        AND support_class = 'Core'
        AND state_code NOT IN ('ALL', 'OT', 'State_Missing')
        AND service_district_name NOT IN ('ALL')
        AND service_district_name NOT ILIKE '%Missing%'
        AND service_district_name NOT ILIKE '%Other%'
        AND payment_share_top10_pct IS NOT NULL
      GROUP BY state_code, service_district_name
      ORDER BY avg_top10_share DESC LIMIT 15`),

    // Active providers by state
    q(`SELECT state_code, SUM(provider_count) as providers
      FROM ndis_active_providers
      WHERE report_date = (SELECT MAX(report_date) FROM ndis_active_providers)
        AND service_district_name = 'ALL' AND disability_group_name = 'ALL'
        AND age_band = 'ALL' AND support_class = 'ALL'
        AND state_code NOT IN ('ALL', 'OT', 'State_Missing')
      GROUP BY state_code ORDER BY providers DESC`),

    // Registered providers by state
    q(`SELECT state_code, COUNT(*) as approved
      FROM ndis_registered_providers
      WHERE registration_status = 'Approved'
        AND state_code IS NOT NULL AND state_code != ''
      GROUP BY state_code ORDER BY approved DESC LIMIT 10`),

    // LGAs with NDIS participants in top funding deserts
    q(`SELECT l.lga_name, l.state, l.participant_count,
        d.desert_score, d.remoteness, d.disability_entities as providers,
        d.thin_market_status
      FROM ndis_participants_lga l
      JOIN mv_disability_landscape d ON l.lga_name = d.lga_name AND l.state = d.state
      WHERE l.quarter_date = (SELECT MAX(quarter_date) FROM ndis_participants_lga)
        AND d.desert_score IS NOT NULL AND l.participant_count > 200
      ORDER BY d.desert_score DESC LIMIT 20`),

    // Top underserved LGAs (participants with few providers)
    q(`SELECT lga_name, state, remoteness, ndis_participants, disability_entities as providers,
        thin_market_status, desert_score
      FROM mv_disability_landscape
      WHERE ndis_participants > 100
        AND thin_market_status IN ('CRITICAL', 'SEVERE')
      ORDER BY desert_score DESC NULLS LAST LIMIT 15`),

    // Cross-system: NDIS providers in other systems
    q(`SELECT
        COUNT(*) FILTER (WHERE in_ndis_provider = 1) as ndis_providers,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND system_count >= 2) as multi_system,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_justice_funding = 1) as also_justice,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_procurement = 1) as also_procurement,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND is_community_controlled) as community_controlled
      FROM mv_entity_power_index`),
  ]);

  // Aggregate provider counts (active vs registered) by state for comparison
  const activeMap = new Map<string, number>();
  for (const row of (providersByState || []) as Row[]) {
    activeMap.set(String(row.state_code), num(row.providers));
  }

  const registeredMap = new Map<string, number>();
  for (const row of (registeredProviders || []) as Row[]) {
    registeredMap.set(String(row.state_code), num(row.approved));
  }

  // National totals
  const natRow = ((nationalStats || []) as Row[])[0] || {};
  const totalParticipants = num(natRow.total_participants);
  const avgBudget = num(natRow.avg_plan_budget);

  return {
    totalParticipants,
    avgBudget,
    participantsByState: (participantsByState || []) as Row[],
    disabilityBreakdown: (disabilityBreakdown || []) as Row[],
    utilisationByClass: (utilisationByClass || []) as Row[],
    utilisationByState: (utilisationByState || []) as Row[],
    marketConcentration: (marketConcentration || []) as Row[],
    providersByState: (providersByState || []) as Row[],
    registeredProviders: (registeredProviders || []) as Row[],
    activeMap,
    registeredMap,
    geographicGaps: (geographicGaps || []) as Row[],
    topDesertLgas: (topDesertLgas || []) as Row[],
    crossSystem: ((crossSystemStats || []) as Row[])[0] || {},
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Subcomponents
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ThinMarketBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    CRITICAL: 'bg-bauhaus-red text-white',
    SEVERE: 'bg-orange-500 text-white',
    MODERATE: 'bg-bauhaus-yellow text-bauhaus-black',
    ADEQUATE: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase tracking-widest ${colorMap[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

function UtilBar({ value, max = 100 }: { value: number; max?: number }) {
  const w = Math.min((value / max) * 100, 100);
  const color = value < 60 ? 'bg-bauhaus-red' : value < 75 ? 'bg-bauhaus-yellow' : 'bg-green-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-100 border border-gray-200">
        <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-black tabular-nums w-10 text-right">{value}%</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function NdisReportPage() {
  const data = await getData();
  const cs = data.crossSystem;

  const totalRegistered = Array.from(data.registeredMap.values()).reduce((a, b) => a + b, 0);

  // Largest disability groups (exclude ALL, limit 6)
  const topDisabilities = data.disabilityBreakdown.slice(0, 6);

  // National avg utilisation from utilisationByClass (ALL class)
  const avgUtil = data.utilisationByState.length > 0
    ? Math.round(data.utilisationByState.reduce((a, r) => a + num(r.avg_util), 0) / data.utilisationByState.length)
    : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-blue mt-4 mb-1 uppercase tracking-widest">NDIS Intelligence</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">The Disability Dollar</h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Where NDIS money flows, who provides services, and which communities are underserved.{' '}
          {fmt(data.totalParticipants)} Australians hold active NDIS plans — but not all of them can use their funding.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
          <Link href="/reports/ndis-market" className="px-3 py-2 border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
            NDIS Market Report
          </Link>
          <Link href="/reports/disability" className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors">
            Disability Overview
          </Link>
          <Link href="/reports/convergence" className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            Convergence Report
          </Link>
          <Link href="/map" className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
            Geographic Map
          </Link>
        </div>
      </div>

      {/* ── Hero Stats ── */}
      <section className="mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Active Participants</div>
            <div className="text-3xl font-black">{fmt(data.totalParticipants)}</div>
            <div className="text-white/60 text-xs font-bold mt-2">Australians with NDIS plans</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Avg Plan Budget</div>
            <div className="text-3xl font-black">{money(data.avgBudget)}</div>
            <div className="text-white/70 text-xs font-bold mt-2">Annual per participant</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Registered Providers</div>
            <div className="text-3xl font-black">{fmt(totalRegistered)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">Approved to deliver NDIS</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Avg Utilisation</div>
            <div className="text-3xl font-black">{avgUtil}%</div>
            <div className="text-white/70 text-xs font-bold mt-2">Plans actually being used</div>
          </div>
        </div>
        {/* Cross-system callout */}
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest block mb-1">CivicGraph Mapped</span>
            <span className="text-xl font-black">{fmt(num(cs.ndis_providers))}</span>
            <span className="text-bauhaus-muted font-medium ml-2 text-xs">NDIS providers</span>
          </div>
          <div>
            <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest block mb-1">Multi-System</span>
            <span className="text-xl font-black">{fmt(num(cs.multi_system))}</span>
            <span className="text-bauhaus-muted font-medium ml-2 text-xs">in 2+ gov systems</span>
          </div>
          <div>
            <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest block mb-1">Also Justice</span>
            <span className="text-xl font-black">{fmt(num(cs.also_justice))}</span>
            <span className="text-bauhaus-muted font-medium ml-2 text-xs">NDIS + justice funding</span>
          </div>
          <div>
            <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest block mb-1">Community-Controlled</span>
            <span className="text-xl font-black">{fmt(num(cs.community_controlled))}</span>
            <span className="text-bauhaus-muted font-medium ml-2 text-xs">NDIS providers</span>
          </div>
        </div>
      </section>

      {/* ── Section 1: Participants by State ── */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Participants by State</p>
            <h2 className="text-2xl font-black">Who has NDIS plans — and where</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Plan</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Share</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Active Providers</th>
                </tr>
              </thead>
              <tbody>
                {data.participantsByState.map((row, i) => {
                  const state = String(row.state);
                  const part = num(row.participants);
                  const share = data.totalParticipants > 0 ? (part / data.totalParticipants) * 100 : 0;
                  const activeProv = data.activeMap.get(state) || 0;
                  return (
                    <tr key={state} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}>
                      <td className="p-3 font-black text-xs uppercase tracking-widest">
                        <Link href={`/reports/disability/${state.toLowerCase()}`} className="hover:text-bauhaus-blue">
                          {state}
                        </Link>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">{fmt(part)}</td>
                      <td className="p-3 text-right font-mono text-bauhaus-muted">{row.avg_budget ? money(num(row.avg_budget)) : '—'}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-100 border border-gray-200">
                            <div className="h-full bg-bauhaus-blue" style={{ width: `${Math.min(share, 100)}%` }} />
                          </div>
                          <span className="text-xs font-black tabular-nums w-8">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-bauhaus-muted">{activeProv > 0 ? fmt(activeProv) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disability Breakdown */}
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Disability Profile</p>
            <h2 className="text-2xl font-black">Who is the NDIS for</h2>
          </div>
          <div className="p-4 space-y-3">
            {topDisabilities.map((row) => {
              const group = String(row.disability_group);
              const part = num(row.participants);
              const share = data.totalParticipants > 0 ? (part / data.totalParticipants) * 100 : 0;
              return (
                <div key={group}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold truncate pr-2">{group}</span>
                    <span className="text-xs font-black tabular-nums text-bauhaus-muted shrink-0">{fmt(part)}</span>
                  </div>
                  <div className="h-3 bg-gray-100 border border-gray-200">
                    <div className="h-full bg-bauhaus-blue" style={{ width: `${Math.min(share, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t-4 border-bauhaus-black bg-[#F0F0F0]">
            <p className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Note</p>
            <p className="text-xs text-bauhaus-muted mt-1 leading-relaxed">
              Autism represents the largest single disability group. All participant counts exclude double-counting across groups.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Utilisation ── */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-yellow text-bauhaus-black border-b-4 border-bauhaus-black p-5">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2">Utilisation Patterns</p>
            <h2 className="text-2xl font-black">Are plans being used?</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">By Support Class</p>
              {data.utilisationByClass.map((row) => (
                <div key={String(row.support_class)} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold">{String(row.support_class)}</span>
                  </div>
                  <UtilBar value={num(row.avg_util)} />
                </div>
              ))}
            </div>
            <div className="pt-4 border-t-2 border-gray-200">
              <p className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">By State</p>
              {data.utilisationByState.map((row) => (
                <div key={String(row.state)} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-black uppercase tracking-widest">{String(row.state)}</span>
                    <span className="text-[10px] text-bauhaus-muted">
                      min {num(row.min_util)}% / max {num(row.max_util)}%
                    </span>
                  </div>
                  <UtilBar value={num(row.avg_util)} />
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 bg-[#FFF8E0] border-t-4 border-bauhaus-yellow">
            <p className="text-xs font-bold text-bauhaus-black leading-relaxed">
              Utilisation below 75% signals that participants have plans but cannot access supports — often due to thin provider markets, transport barriers, or workforce shortages.
            </p>
          </div>
        </div>

        {/* Market Concentration */}
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Market Concentration</p>
            <h2 className="text-2xl font-black">Where top 10 providers dominate</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">District</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Top 10 Share</th>
                </tr>
              </thead>
              <tbody>
                {data.marketConcentration.map((row, i) => {
                  const label = String(row.service_district_name).replace(/~[A-Z]+$/, '');
                  const share = num(row.avg_top10_share);
                  return (
                    <tr key={`${row.state_code}:${row.service_district_name}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}>
                      <td className="p-3 font-medium text-xs">{label}</td>
                      <td className="p-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{String(row.state_code)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-100">
                            <div className={`h-full ${share >= 90 ? 'bg-bauhaus-red' : share >= 70 ? 'bg-orange-400' : 'bg-bauhaus-yellow'}`}
                              style={{ width: `${Math.min(share, 100)}%` }} />
                          </div>
                          <span className="text-xs font-black tabular-nums w-8">{pct(share)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-[#FFE8E8] border-t-4 border-bauhaus-red">
            <p className="text-xs font-bold text-bauhaus-black leading-relaxed">
              High concentration in Core supports means participants have few alternatives. Where top-10 providers control 90%+ of payments, market failure is systemic.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: Provider Landscape ── */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Provider Landscape</p>
            <h2 className="text-2xl font-black">Active vs registered providers by state</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Active Providers</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Registered (Approved)</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Activation Rate</th>
                </tr>
              </thead>
              <tbody>
                {(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'NT', 'TAS', 'ACT'] as const).map((state, i) => {
                  const active = data.activeMap.get(state) || 0;
                  const registered = data.registeredMap.get(state) || 0;
                  const activationRate = registered > 0 ? (active / registered) * 100 : null;
                  return (
                    <tr key={state} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}>
                      <td className="p-3 font-black text-xs uppercase tracking-widest">
                        <Link href={`/reports/disability/${state.toLowerCase()}`} className="hover:text-bauhaus-blue">
                          {state}
                        </Link>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">{active > 0 ? fmt(active) : '—'}</td>
                      <td className="p-3 text-right font-mono text-bauhaus-muted">{registered > 0 ? fmt(registered) : '—'}</td>
                      <td className="p-3 text-right">
                        {activationRate != null ? (
                          <span className={`text-xs font-black ${activationRate < 40 ? 'text-bauhaus-red' : activationRate < 70 ? 'text-orange-500' : 'text-green-600'}`}>
                            {pct(activationRate)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-[#F0F0F0] border-t-4 border-bauhaus-black">
            <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">
              Active providers = currently delivering supports to at least one participant.
              Registered providers = approved by NDIS Quality and Safeguards Commission.
              A low activation rate indicates registered providers not yet operating in the market.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Geographic Gaps ── */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NDIS + Desert cross-reference */}
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Geographic Gaps</p>
            <h2 className="text-2xl font-black">Participants in funding deserts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert Score</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Market</th>
                </tr>
              </thead>
              <tbody>
                {data.geographicGaps.slice(0, 12).map((row, i) => (
                  <tr key={`${row.lga_name}-${row.state}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}>
                    <td className="p-3 font-medium text-xs">{String(row.lga_name)}</td>
                    <td className="p-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{String(row.state)}</td>
                    <td className="p-3 text-right font-mono font-bold">{fmt(num(row.participant_count))}</td>
                    <td className="p-3 text-right">
                      <span className={`text-xs font-black ${num(row.desert_score) >= 70 ? 'text-bauhaus-red' : num(row.desert_score) >= 50 ? 'text-orange-500' : 'text-bauhaus-muted'}`}>
                        {num(row.desert_score).toFixed(1)}
                      </span>
                    </td>
                    <td className="p-3">
                      {row.thin_market_status ? <ThinMarketBadge status={String(row.thin_market_status)} /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top underserved LGAs */}
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Thin Markets</p>
            <h2 className="text-2xl font-black">Critical and severe supply gaps</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Linked Providers</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.topDesertLgas.map((row, i) => (
                  <tr key={`${row.lga_name}-${row.state}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}>
                    <td className="p-3">
                      <div className="text-xs font-bold">{String(row.lga_name)}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{String(row.state)} — {String(row.remoteness || '')}</div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">{fmt(num(row.ndis_participants))}</td>
                    <td className="p-3 text-right font-mono text-bauhaus-muted">{num(row.providers) > 0 ? fmt(num(row.providers)) : <span className="text-bauhaus-red font-black">0</span>}</td>
                    <td className="p-3">
                      {row.thin_market_status ? <ThinMarketBadge status={String(row.thin_market_status)} /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-[#FFE8E8] border-t-4 border-bauhaus-red">
            <p className="text-xs font-bold text-bauhaus-black leading-relaxed">
              &ldquo;Linked Providers&rdquo; = NDIS registered providers matched to CivicGraph entities in this LGA via ABN.
              Zero does not mean no providers exist — it means none are linked in our entity graph yet.
              CRITICAL = participants present, zero linked providers. SEVERE = participants outnumber linked providers by 100:1+.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer Links ── */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
          <p className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-4">Explore Further</p>
          <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest">
            <Link href="/reports/disability" className="px-4 py-3 border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
              Disability Overview
            </Link>
            <Link href="/reports/ndis-market" className="px-4 py-3 border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors">
              NDIS Market Report
            </Link>
            <Link href="/reports/convergence" className="px-4 py-3 border-2 border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
              Convergence
            </Link>
            <Link href="/reports/funding-deserts" className="px-4 py-3 border-2 border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
              Funding Deserts
            </Link>
            <Link href="/places" className="px-4 py-3 border-2 border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
              Place Briefs
            </Link>
            <Link href="/map" className="px-4 py-3 border-2 border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
              Geographic Map
            </Link>
          </div>
          <div className="mt-6 pt-4 border-t-2 border-bauhaus-black/20">
            <p className="text-[10px] text-bauhaus-muted font-medium">
              Data sources: NDIS Quarterly Reports (NDIA), CivicGraph entity graph, NDIS Quality and Safeguards Commission.
              Participant counts represent active plan holders. Provider counts represent entities with at least one active participant.
              Desert scores from mv_disability_landscape (CivicGraph synthesis). Updated quarterly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
