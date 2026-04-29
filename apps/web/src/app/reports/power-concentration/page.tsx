import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cross-System Power Concentration | CivicGraph Investigation',
  description: '82,967 entities scored across 7 public datasets. Who appears everywhere, who gets the money, and who gets watched but never funded.',
  openGraph: {
    title: 'Cross-System Power Concentration',
    description: '82,967 entities scored across 7 Australian government datasets — procurement, justice funding, political donations, charities, foundations, evidence, and tax transparency.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cross-System Power Concentration',
    description: '82,967 entities. 7 datasets. $918B in tracked flows. The power map of Australia.',
  },
};

import { money, fmt } from '@/lib/format';

function pct(n: number): string { return `${n.toFixed(1)}%`; }

interface PowerEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string;
  state: string;
  system_count: number;
  power_score: number;
  is_community_controlled: boolean;
  remoteness: string;
  in_procurement: boolean;
  in_justice_funding: boolean;
  in_political_donations: boolean;
  in_charity_registry: boolean;
  in_foundation: boolean;
  in_alma_evidence: boolean;
  in_ato_transparency: boolean;
  procurement_dollars: number;
  justice_dollars: number;
  donation_dollars: number;
  total_dollar_flow: number;
  distinct_govt_buyers: number;
  distinct_parties_funded: number;
}

interface RevolvingDoorEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  state: string;
  is_community_controlled: boolean;
  lobbies: boolean;
  donates: boolean;
  contracts: boolean;
  receives_funding: boolean;
  influence_vectors: number;
  revolving_door_score: number;
  total_donated: number;
  total_contracts: number;
  total_funded: number;
  parties_funded: string[];
  distinct_buyers: number;
}

interface FundingDesert {
  lga_name: string;
  state: string;
  remoteness: string;
  avg_irsd_decile: number;
  entity_count: number;
  total_funding: number;
  avg_power_score: number;
  desert_score: number;
}

interface Stats {
  totalEntities: number;
  threeSystemPlus: number;
  fourSystemPlus: number;
  avgSystems: number;
  totalFlowB: number;
  revolvingDoorCount: number;
  threeVectorPlus: number;
  desertCount: number;
  severeDeserts: number;
  communityEntities: number;
  communityAvgSystems: number;
  communityProcurementB: number;
  totalProcurementB: number;
  majorCityFlowB: number;
  veryRemoteFlowB: number;
}

async function getData() {
  const supabase = getServiceSupabase();

  // Fetch all data in parallel
  const [
    powerTopResult,
    revolvingDoorResult,
    desertsResult,
    communityTopResult,
    summaryResult,
    communityStatsResult,
    remotenessResult,
    revolvingCountResult,
    desertCountResult,
  ] = await Promise.all([
    // Top power entities (4+ systems)
    supabase
      .from('mv_entity_power_index')
      .select('gs_id, canonical_name, entity_type, abn, state, system_count, power_score, is_community_controlled, remoteness, in_procurement, in_justice_funding, in_political_donations, in_charity_registry, in_foundation, in_alma_evidence, in_ato_transparency, procurement_dollars, justice_dollars, donation_dollars, total_dollar_flow, distinct_govt_buyers, distinct_parties_funded')
      .gte('system_count', 3)
      .order('power_score', { ascending: false })
      .limit(30),
    // Top revolving door entities
    supabase
      .from('mv_revolving_door')
      .select('gs_id, canonical_name, entity_type, state, is_community_controlled, lobbies, donates, contracts, receives_funding, influence_vectors, revolving_door_score, total_donated, total_contracts, total_funded, parties_funded, distinct_buyers')
      .order('revolving_door_score', { ascending: false })
      .limit(25),
    // Worst funding deserts
    supabase
      .from('mv_funding_deserts')
      .select('*')
      .not('desert_score', 'is', null)
      .order('desert_score', { ascending: false })
      .limit(20),
    // Top community-controlled entities
    supabase
      .from('mv_entity_power_index')
      .select('gs_id, canonical_name, entity_type, state, system_count, power_score, remoteness, procurement_dollars, justice_dollars, total_dollar_flow')
      .eq('is_community_controlled', true)
      .gte('system_count', 2)
      .order('power_score', { ascending: false })
      .limit(15),
    // Summary stats
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(CASE WHEN system_count >= 3 THEN 1 END) as three_plus, COUNT(CASE WHEN system_count >= 4 THEN 1 END) as four_plus, ROUND(AVG(system_count)::numeric,2) as avg_systems, ROUND(SUM(total_dollar_flow)/1e9,1) as total_flow_b FROM mv_entity_power_index`,
    }),
    // Community stats
    supabase.rpc('exec_sql', {
      query: `SELECT is_community_controlled as cc, COUNT(*) as entities, ROUND(AVG(system_count)::numeric,2) as avg_systems, ROUND(SUM(procurement_dollars)/1e9,2) as procurement_b FROM mv_entity_power_index GROUP BY is_community_controlled`,
    }),
    // Remoteness stats
    supabase.rpc('exec_sql', {
      query: `SELECT remoteness, ROUND(SUM(total_dollar_flow)/1e9,2) as flow_b FROM mv_entity_power_index WHERE remoteness IS NOT NULL GROUP BY remoteness ORDER BY flow_b DESC`,
    }),
    // Revolving door count
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(CASE WHEN influence_vectors >= 3 THEN 1 END) as three_plus FROM mv_revolving_door`,
    }),
    // Desert count
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total_lgas, COUNT(CASE WHEN desert_score > 50 THEN 1 END) as severe FROM mv_funding_deserts`,
    }),
  ]);

  const powerTop = (powerTopResult.data || []) as PowerEntity[];
  const revolvingDoor = (revolvingDoorResult.data || []) as RevolvingDoorEntity[];
  const deserts = (desertsResult.data || []) as FundingDesert[];
  const communityTop = (communityTopResult.data || []) as PowerEntity[];

  // Parse summary stats
  const summary = (summaryResult.data as Record<string, string>[])?.[0];
  const communityStats = (communityStatsResult.data as Record<string, string>[]) || [];
  const remotenessStats = (remotenessResult.data as Record<string, string>[]) || [];
  const revolvingStats = (revolvingCountResult.data as Record<string, string>[])?.[0];
  const desertStats = (desertCountResult.data as Record<string, string>[])?.[0];

  const ccRow = communityStats.find(r => r.cc === 'true' || r.cc === true as unknown as string);
  const nonCcRow = communityStats.find(r => r.cc === 'false' || r.cc === false as unknown as string);
  const majorCity = remotenessStats.find(r => r.remoteness === 'Major Cities of Australia');
  const veryRemote = remotenessStats.find(r => r.remoteness === 'Very Remote Australia');

  const stats: Stats = {
    totalEntities: Number(summary?.total) || 0,
    threeSystemPlus: Number(summary?.three_plus) || 0,
    fourSystemPlus: Number(summary?.four_plus) || 0,
    avgSystems: Number(summary?.avg_systems) || 0,
    totalFlowB: Number(summary?.total_flow_b) || 0,
    revolvingDoorCount: Number(revolvingStats?.total) || 0,
    threeVectorPlus: Number(revolvingStats?.three_plus) || 0,
    desertCount: Number(desertStats?.total_lgas) || 0,
    severeDeserts: Number(desertStats?.severe) || 0,
    communityEntities: Number(ccRow?.entities) || 0,
    communityAvgSystems: Number(ccRow?.avg_systems) || 0,
    communityProcurementB: Number(ccRow?.procurement_b) || 0,
    totalProcurementB: (Number(ccRow?.procurement_b) || 0) + (Number(nonCcRow?.procurement_b) || 0),
    majorCityFlowB: Number(majorCity?.flow_b) || 0,
    veryRemoteFlowB: Number(veryRemote?.flow_b) || 0,
  };

  return { powerTop, revolvingDoor, deserts, communityTop, stats };
}

const SYSTEM_LABELS: Record<string, string> = {
  in_procurement: 'Procurement',
  in_justice_funding: 'Justice Funding',
  in_political_donations: 'Donations',
  in_charity_registry: 'Charity',
  in_foundation: 'Foundation',
  in_alma_evidence: 'ALMA Evidence',
  in_ato_transparency: 'ATO Tax',
};

const SYSTEM_COLORS: Record<string, string> = {
  in_procurement: 'bg-blue-600',
  in_justice_funding: 'bg-amber-500',
  in_political_donations: 'bg-red-600',
  in_charity_registry: 'bg-green-600',
  in_foundation: 'bg-purple-600',
  in_alma_evidence: 'bg-teal-500',
  in_ato_transparency: 'bg-gray-600',
};

function SystemBadges({ entity }: { entity: PowerEntity }) {
  const systems = Object.entries(SYSTEM_LABELS).filter(
    ([key]) => entity[key as keyof PowerEntity]
  );
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {systems.map(([key, label]) => (
        <span
          key={key}
          className={`inline-block px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${SYSTEM_COLORS[key]}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function VectorBadges({ entity }: { entity: RevolvingDoorEntity }) {
  const vectors = [
    { active: entity.lobbies, label: 'LOBBIES', color: 'bg-red-700' },
    { active: entity.donates, label: 'DONATES', color: 'bg-red-500' },
    { active: entity.contracts, label: 'CONTRACTS', color: 'bg-blue-600' },
    { active: entity.receives_funding, label: 'FUNDED', color: 'bg-amber-500' },
  ];
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {vectors.filter(v => v.active).map(v => (
        <span key={v.label} className={`inline-block px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${v.color}`}>
          {v.label}
        </span>
      ))}
    </div>
  );
}

export default async function PowerConcentrationReport() {
  const d = await getData();
  const s = d.stats;

  const communityProcurementPct = s.totalProcurementB > 0
    ? (s.communityProcurementB / s.totalProcurementB) * 100
    : 0;
  const cityRemoteRatio = s.veryRemoteFlowB > 0
    ? Math.round(s.majorCityFlowB / s.veryRemoteFlowB)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Cross-System Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Cross-System Power Concentration
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {fmt(s.totalEntities)} Australian entities scored across 7 public datasets:
          procurement, justice funding, political donations, charity registry, foundations,
          evidence programs, and tax transparency. {fmt(s.threeSystemPlus)} appear in 3+
          systems. {fmt(s.revolvingDoorCount)} entities operate through multiple influence
          channels simultaneously.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Entities Scored</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.totalEntities)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">across 7 datasets</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Dollar Flow</div>
            <div className="text-3xl sm:text-4xl font-black">${s.totalFlowB}B</div>
            <div className="text-white/50 text-xs font-bold mt-2">procurement + justice + donations</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Revolving Door</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{fmt(s.revolvingDoorCount)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">2+ influence channels</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Funding Deserts</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.severeDeserts)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">of {fmt(s.desertCount)} LGAs scored &gt;50</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: AusTender &times; Justice Funding &times; AEC Donations &times; ACNC Registry &times; Foundations &times; ALMA Evidence &times; ATO Tax Transparency.
            All cross-referenced by ABN.
          </p>
        </div>
      </section>

      {/* Top Power Entities */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Highest Cross-System Power
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Entities appearing in the most government datasets simultaneously.
          Power score weights procurement and political donations highest, with
          bonus points for network breadth (distinct government buyers, parties funded).
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Systems</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Power Score</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Dollar Flow</th>
              </tr>
            </thead>
            <tbody>
              {d.powerTop.slice(0, 20).map((e, i) => (
                <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/entities/${e.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{e.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {e.entity_type} &middot; {e.state || '—'}
                        {e.is_community_controlled && <span className="ml-2 text-green-700 font-black">COMMUNITY</span>}
                      </div>
                      <SystemBadges entity={e} />
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{e.system_count}</td>
                  <td className="p-3 text-right font-mono font-black hidden sm:table-cell">{e.power_score}</td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(Number(e.total_dollar_flow))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-right">
          <Link href="/graph?mode=power&min_systems=4" className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
            View Power Map &rarr;
          </Link>
        </div>
      </section>

      <ReportCTA reportSlug="power-concentration" reportTitle="Cross-System Power Concentration" variant="inline" />

      {/* Revolving Door */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Revolving Door
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(s.revolvingDoorCount)} entities operate through 2+ influence channels:
          lobbying, political donations, government contracts, and/or justice funding.
          {s.threeVectorPlus > 0 && ` ${fmt(s.threeVectorPlus)} use 3 or more channels simultaneously.`}
          {' '}Scored by influence type: lobbying (5&times;), donations (3&times;),
          contracts (2&times;), funding (1&times;), plus dollar thresholds.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Vectors</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Score</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
              </tr>
            </thead>
            <tbody>
              {d.revolvingDoor.slice(0, 20).map((e, i) => (
                <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/entities/${e.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{e.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {e.entity_type} &middot; {e.state || '—'}
                        {e.is_community_controlled && <span className="ml-2 text-green-700 font-black">COMMUNITY</span>}
                      </div>
                      <VectorBadges entity={e} />
                    </Link>
                  </td>
                  <td className="p-3 text-center font-mono font-black text-bauhaus-red">{e.influence_vectors}</td>
                  <td className="p-3 text-right font-mono font-black hidden sm:table-cell">{e.revolving_door_score}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap hidden sm:table-cell">{money(Number(e.total_donated))}</td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(Number(e.total_contracts))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Community-Controlled Disparity */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-6 text-bauhaus-yellow uppercase tracking-widest">
            Over-Monitored, Under-Funded
          </h2>
          <p className="text-sm text-white/80 mb-8 max-w-2xl leading-relaxed">
            Community-controlled organisations appear in more government datasets than
            average ({s.communityAvgSystems} systems vs {s.avgSystems} overall) — but
            receive a fraction of the money. They are more visible to government, yet
            less resourced by it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-yellow">{fmt(s.communityEntities)}</div>
              <div className="text-xs font-black text-white/50 uppercase tracking-widest mt-2">Community-Controlled Orgs</div>
              <div className="text-sm text-white/70 mt-1">{pct((s.communityEntities / s.totalEntities) * 100)} of all entities</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-yellow">{s.communityAvgSystems}</div>
              <div className="text-xs font-black text-white/50 uppercase tracking-widest mt-2">Avg Datasets Appearing In</div>
              <div className="text-sm text-white/70 mt-1">vs {s.avgSystems} overall average</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-red">{pct(communityProcurementPct)}</div>
              <div className="text-xs font-black text-white/50 uppercase tracking-widest mt-2">Of Procurement Dollars</div>
              <div className="text-sm text-white/70 mt-1">${s.communityProcurementB}B of ${s.totalProcurementB}B</div>
            </div>
          </div>

          {/* Top community orgs */}
          {d.communityTop.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-3">Top Community-Controlled Entities by Power Score</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest">Entity</th>
                      <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Systems</th>
                      <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden sm:table-cell">Score</th>
                      <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Dollar Flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.communityTop.slice(0, 10).map((e) => (
                      <tr key={e.gs_id} className="border-b border-white/10">
                        <td className="p-2">
                          <Link href={`/entities/${e.gs_id}`} className="hover:text-bauhaus-yellow transition-colors">
                            <div className="font-bold text-white">{e.canonical_name}</div>
                            <div className="text-xs text-white/50">{e.state} &middot; {e.remoteness || '—'}</div>
                          </Link>
                        </td>
                        <td className="p-2 text-right font-mono font-black text-bauhaus-yellow">{e.system_count}</td>
                        <td className="p-2 text-right font-mono text-white/70 hidden sm:table-cell">{e.power_score}</td>
                        <td className="p-2 text-right font-mono font-black text-white whitespace-nowrap">{money(Number(e.total_dollar_flow))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Geographic Disparity */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Geography of Power
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Major cities receive {cityRemoteRatio > 0 ? `${cityRemoteRatio}x` : 'vastly more'} dollar flow
          compared to Very Remote Australia. {fmt(s.severeDeserts)} of {fmt(s.desertCount)} LGAs
          score above 50 on our desert index — meaning high disadvantage, low funding,
          and sparse entity coverage.
        </p>

        {/* Remoteness bar chart */}
        <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
          <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">Dollar Flow by Remoteness</h3>
          {[
            { label: 'Major Cities', value: s.majorCityFlowB, color: 'bg-bauhaus-black' },
            { label: 'Inner Regional', value: 12.91, color: 'bg-gray-700' },
            { label: 'Outer Regional', value: 10.04, color: 'bg-gray-500' },
            { label: 'Remote', value: 0.85, color: 'bg-bauhaus-red' },
            { label: 'Very Remote', value: s.veryRemoteFlowB, color: 'bg-bauhaus-red' },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-3 mb-2">
              <div className="w-32 text-xs font-bold text-bauhaus-black text-right shrink-0">{r.label}</div>
              <div className="flex-1 h-6 bg-gray-100 relative">
                <div
                  className={`h-full ${r.color} transition-all`}
                  style={{ width: `${Math.max((r.value / s.majorCityFlowB) * 100, 0.5)}%` }}
                />
              </div>
              <div className="w-16 text-xs font-mono font-bold text-right shrink-0">${r.value}B</div>
            </div>
          ))}
        </div>

        {/* Worst deserts table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-blue text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">IRSD Decile</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Remoteness</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Entities</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert Score</th>
              </tr>
            </thead>
            <tbody>
              {d.deserts.slice(0, 15).map((desert, i) => (
                <tr key={`${desert.lga_name}-${desert.state}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black">{desert.lga_name}</div>
                    <div className="text-xs text-bauhaus-muted">{desert.state}</div>
                  </td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">
                    <span className={Number(desert.avg_irsd_decile) <= 3 ? 'text-bauhaus-red font-black' : ''}>
                      {Number(desert.avg_irsd_decile).toFixed(1)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-xs hidden sm:table-cell">{desert.remoteness || '—'}</td>
                  <td className="p-3 text-right font-mono">{desert.entity_count}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{Number(desert.desert_score).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-right">
          <Link href="/api/data/power-index?view=deserts&limit=100" className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
            Full Desert Data (API) &rarr;
          </Link>
        </div>
      </section>

      {/* How The System Works */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-6 text-bauhaus-yellow uppercase tracking-widest">7 Datasets. One Map.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { n: '1', name: 'Procurement', desc: `${money(853.56e9)} in AusTender contracts. Who wins government business.`, color: 'text-blue-400' },
              { n: '2', name: 'Justice Funding', desc: `${money(33.85e9)} in social program funding. Who gets state money.`, color: 'text-amber-400' },
              { n: '3', name: 'Political Donations', desc: 'AEC donation records. Who funds the politicians.', color: 'text-red-400' },
              { n: '4', name: 'Charity Registry', desc: '66K ACNC charities. The formal nonprofit sector.', color: 'text-green-400' },
              { n: '5', name: 'Foundations', desc: '10.8K grant-makers. Who controls philanthropy.', color: 'text-purple-400' },
              { n: '6', name: 'ALMA Evidence', desc: '1,155 interventions. What actually works.', color: 'text-teal-400' },
              { n: '7', name: 'ATO Tax', desc: '24K entities. Who pays tax on their income.', color: 'text-gray-400' },
            ].map(sys => (
              <div key={sys.n} className="text-center">
                <div className={`text-3xl font-black ${sys.color} mb-2`}>{sys.n}</div>
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">{sys.name}</div>
                <p className="text-sm text-white/60">{sys.desc}</p>
              </div>
            ))}
          </div>
          <div className="pt-6 border-t border-white/20 text-center">
            <p className="text-sm text-white/50 max-w-2xl mx-auto">
              Each dataset is public. Each entity is matched by ABN.
              CivicGraph is the first platform to cross-reference all seven simultaneously —
              revealing who appears everywhere, who holds power across systems, and who gets
              watched but never funded.
            </p>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Entity resolution:</strong> Entities are matched across datasets using
              Australian Business Number (ABN). For justice funding records without ABNs,
              exact canonical name matching is used as a fallback. 88.6% of justice funding
              records are now linked to a resolved entity.
            </p>
            <p>
              <strong>Power score:</strong> Composite score weighting system presence (3 points
              per system) plus dollar-weighted bonuses for procurement (&gt;$1M/10M/100M),
              donations (&gt;$10K/100K), and justice funding (&gt;$1M/10M). Network breadth
              adds points for distinct government buyers (capped at 10) and political parties
              funded (capped at 8).
            </p>
            <p>
              <strong>Revolving door score:</strong> Weighted by influence type — lobbying (5&times;),
              political donations (3&times;), contracts (2&times;), funding (1&times;). Additional
              points for high-dollar donations (&gt;$100K) and large contracts (&gt;$10M), plus
              the number of political parties funded (capped at 5).
            </p>
            <p>
              <strong>Desert score:</strong> Composite of SEIFA IRSD decile (inverted, 0-100),
              remoteness category (0-40), entity coverage gap (0-30), and funding gap (0-20).
              Higher score means more disadvantaged, more remote, fewer entities, and less funding.
            </p>
            <p>
              <strong>Community-controlled:</strong> Entities flagged as community-controlled in the
              entity registry. Includes Indigenous community organisations, community cooperatives,
              and locally governed service providers.
            </p>
            <p>
              <strong>Limitations:</strong> ABN matching misses entities that operate under different
              ABNs across datasets. Political donations data has a reporting threshold. ATO tax
              transparency only covers entities above $100M income (or $200M for non-reporting).
              Board interlock data is limited to ACNC responsible persons for small charities —
              ASIC officeholder data would significantly expand this coverage.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore the Power Map</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            See these entities on the interactive force-directed graph. Filter by system count,
            explore connections, and trace power flows across Australia.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/graph?mode=power&min_systems=3"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Power Map (3+ Systems)
            </Link>
            <Link
              href="/graph?mode=power&min_systems=4"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Power Elite (4+ Systems)
            </Link>
            <Link
              href="/api/data/power-index?view=summary"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Raw Data API
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="power-concentration" reportTitle="Cross-System Power Concentration" />
    </div>
  );
}
