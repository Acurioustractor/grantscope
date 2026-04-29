'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { money, fmt } from '@/lib/format';

const CapitalMap = dynamic(
  () => import('./capital-map').then(m => ({ default: m.CapitalMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-bauhaus-canvas border-4 border-bauhaus-black flex items-center justify-center">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
          Loading map...
        </div>
      </div>
    ),
  }
);

const MoneyFlow = dynamic(
  () => import('./money-flow').then(m => ({ default: m.MoneyFlow })),
  {
    ssr: false,
    loading: () => (
      <div className="border-4 border-bauhaus-black p-8 bg-white">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse text-center">
          Loading flows...
        </div>
      </div>
    ),
  }
);

const NetworkGraph = dynamic(
  () => import('./network-graph').then(m => ({ default: m.NetworkGraph })),
  { ssr: false }
);

const PlaceDetail = dynamic(
  () => import('./place-detail').then(m => ({ default: m.PlaceDetail })),
  { ssr: false }
);

const DATA_SOURCES = [
  { name: 'ACNC Charity Register', records: '359,678', updated: 'Monthly' },
  { name: 'AEC Political Donations', records: '50,000+', updated: 'Annual' },
  { name: 'AusTender Contracts', records: '~797,000', updated: 'Weekly' },
  { name: 'Foundation Programs', records: '3,296', updated: 'Ongoing' },
  { name: 'ORIC Indigenous Corps', records: '7,369', updated: 'Quarterly' },
  { name: 'ABS SEIFA 2021', records: '2,300 SA2s', updated: '2021 Census' },
];

interface DataHealth {
  total_entities: number;
  entities_with_postcode: number;
  entities_with_sa2: number;
  sa2_regions_with_data: number;
  sa2_regions_total: number;
  total_relationships: number;
  acnc_records: number;
  foundation_records: number;
  political_donation_records: number;
  postcode_coverage_pct: number;
  sa2_coverage_pct: number;
  map_coverage_pct: number;
  gaps: {
    entities_no_postcode: number;
    entities_postcode_no_sa2: number;
    postcodes_missing_sa2: number;
  };
}

export function PowerPageClient() {
  const searchParams = useSearchParams();
  const initialSA2 = searchParams.get('sa2');
  const [selectedSA2, setSelectedSA2] = useState<string | null>(initialSA2);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [health, setHealth] = useState<DataHealth | null>(null);
  const [accountability, setAccountability] = useState<any>(null);
  const [foundations, setFoundations] = useState<any>(null);
  const [boardPower, setBoardPower] = useState<any[]>([]);
  const [boardPowerTotal, setBoardPowerTotal] = useState(0);

  useEffect(() => {
    fetch('/api/power/health').then(r => r.json()).then(d => {
      if (!d.error) setHealth(d);
    }).catch(() => {});
    fetch('/api/power/accountability').then(r => r.json()).then(d => {
      if (!d.error) setAccountability(d);
    }).catch(() => {});
    fetch('/api/power/foundations').then(r => r.json()).then(d => {
      if (!d.error) setFoundations(d);
    }).catch(() => {});
    fetch('/api/data/board-power?limit=50&min_seats=3').then(r => r.json()).then(d => {
      if (!d.error) {
        setBoardPower(d.results || []);
        setBoardPowerTotal(d.total || 0);
      }
    }).catch(() => {});
  }, []);

  return (
    <>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">
          Investigation
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black leading-tight">
          Where the Money Goes
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium mt-3">
          Mapping Australia&apos;s funding flows — from taxpayers and corporations through foundations
          and government programs to communities. Who benefits, who misses out, and who decides.
        </p>
      </div>

      {/* Community Capital Map — full width */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-3">
            <h2 className="text-2xl font-black text-bauhaus-black">Community Capital Map</h2>
            <p className="text-sm text-bauhaus-muted font-medium mt-1">
              SA2-level view of funding distribution, disadvantage, and community control across Australia.
              Click a region to explore.
            </p>
          </div>
          <CapitalMap onSelectSA2={setSelectedSA2} />
        </div>
      </section>

      {/* Follow the Money — Sankey */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-3">
            <h2 className="text-2xl font-black text-bauhaus-black">Follow the Money</h2>
            <p className="text-sm text-bauhaus-muted font-medium mt-1">
              Trace funding flows from source to outcome. Hover to highlight connections.
            </p>
          </div>
          <MoneyFlow />
        </div>
      </section>

      {/* Power Network — appears when entity selected */}
      {selectedEntity && (
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <NetworkGraph
              gsId={selectedEntity}
              onClose={() => setSelectedEntity(null)}
            />
          </div>
        </section>
      )}

      {/* ── Power Index Table ── */}
      {accountability?.topEntities?.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-3">
              <h2 className="text-2xl font-black text-bauhaus-black">Power Index</h2>
              <p className="text-sm text-bauhaus-muted font-medium mt-1">
                Top 50 entities ranked by cross-system power score. Higher score = more influence vectors
                (procurement, political donations, justice funding, charity registry).
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">#</th>
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Entity</th>
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Type</th>
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">State</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Power</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Systems</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Dollar Flow</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Procurement</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Donations</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Govt Buyers</th>
                  </tr>
                </thead>
                <tbody>
                  {accountability.topEntities.map((e: any, i: number) => (
                    <tr key={e.gs_id} className={`border-b border-gray-100 hover:bg-blue-50/30 ${e.is_community_controlled ? 'bg-green-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-2 text-bauhaus-muted font-medium">{i + 1}</td>
                      <td className="px-4 py-2">
                        <Link href={`/entity/${e.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-red transition-colors">
                          {e.canonical_name}
                        </Link>
                        {e.is_community_controlled && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-green-700 bg-green-100 px-1.5 py-0.5">CC</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-bauhaus-muted font-medium text-xs">{e.entity_type || '—'}</td>
                      <td className="px-4 py-2 text-bauhaus-muted font-medium text-xs">{e.state || '—'}</td>
                      <td className="px-4 py-2 text-right font-black text-bauhaus-black">{Math.round(e.power_score)}</td>
                      <td className="px-4 py-2 text-right font-medium text-bauhaus-muted">{e.system_count}</td>
                      <td className="px-4 py-2 text-right font-medium">{money(e.total_dollar_flow || 0)}</td>
                      <td className="px-4 py-2 text-right font-medium text-bauhaus-muted">{money(e.procurement_dollars || 0)}</td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: e.donation_dollars > 0 ? '#D02020' : undefined }}>
                        {e.donation_dollars > 0 ? money(e.donation_dollars) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-bauhaus-muted">{e.distinct_govt_buyers || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-bauhaus-muted font-medium">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-green-100 border border-green-300 inline-block" /> Community Controlled</span>
              <span>Power score = weighted composite of system presence, dollar flow, and cross-sector reach</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Revolving Door ── */}
      {accountability?.revolvingDoor?.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-3">
              <h2 className="text-2xl font-black text-bauhaus-black">Revolving Door</h2>
              <p className="text-sm text-bauhaus-muted font-medium mt-1">
                Entities appearing across multiple influence systems — procurement contracts, political
                donations, and justice funding. The more systems, the more embedded.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Entity</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Systems</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Procurement</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Donations</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Govt Buyers</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Parties Funded</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {accountability.revolvingDoor.map((e: any, i: number) => (
                    <tr key={e.gs_id} className={`border-b border-gray-100 hover:bg-blue-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-2">
                        <Link href={`/entity/${e.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-red transition-colors">
                          {e.canonical_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right font-black">{e.system_count}</td>
                      <td className="px-4 py-2 text-right font-medium">{money(e.procurement_dollars || 0)}</td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: '#D02020' }}>
                        {e.donation_dollars > 0 ? money(e.donation_dollars) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-bauhaus-muted">{e.distinct_govt_buyers || '—'}</td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: (e.distinct_parties_funded || 0) > 1 ? '#D02020' : undefined }}>
                        {e.distinct_parties_funded || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-black text-bauhaus-black">{Math.round(e.revolving_door_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Board Connectors ── */}
      {accountability?.boardConnectors?.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-3">
              <h2 className="text-2xl font-black text-bauhaus-black">Board Connectors</h2>
              <p className="text-sm text-bauhaus-muted font-medium mt-1">
                People sitting on the boards of multiple top-powered entities.
                Board overlap concentrates decision-making and can create conflicts of interest.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accountability.boardConnectors.map((c: any, i: number) => (
                <div key={i} className="border-4 border-bauhaus-black bg-white p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-bauhaus-black text-white flex items-center justify-center font-black text-sm">
                      {c.board_count}
                    </div>
                    <div>
                      <div className="font-black text-sm text-bauhaus-black">{c.person_name}</div>
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">{c.board_count} boards</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(c.boards || []).map((b: any, j: number) => (
                      <span key={j} className="text-[10px] font-bold bg-bauhaus-canvas text-bauhaus-muted px-2 py-0.5 border border-bauhaus-black/10">
                        {(b.name || '').length > 28 ? (b.name || '').substring(0, 28) + '...' : b.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Board Power Leaderboard ── */}
      {boardPower.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-3">
              <h2 className="text-2xl font-black text-bauhaus-black">Board Power Leaderboard</h2>
              <p className="text-sm text-bauhaus-muted font-medium mt-1">
                {boardPowerTotal.toLocaleString()} people sit on 3+ charity boards simultaneously.
                Combined revenue shows how much money flows through their governance decisions.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">#</th>
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Person</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Boards</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Combined Revenue</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Combined Assets</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Combined FTE</th>
                    <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Top Organisations</th>
                  </tr>
                </thead>
                <tbody>
                  {boardPower.map((p: any, i: number) => (
                    <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-2 text-bauhaus-muted font-medium">{i + 1}</td>
                      <td className="px-4 py-2 font-bold text-bauhaus-black">{p.person_name}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-bauhaus-black text-white font-black text-sm">
                          {p.board_seats}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-green-700">
                        {Number(p.total_org_revenue) > 0 ? money(Number(p.total_org_revenue)) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-bauhaus-muted">
                        {Number(p.total_org_assets) > 0 ? money(Number(p.total_org_assets)) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-bauhaus-muted">
                        {Number(p.total_org_fte) > 0 ? Number(p.total_org_fte).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(p.top_organizations || []).slice(0, 3).map((org: string, j: number) => (
                            <span key={j} className="text-[10px] font-bold bg-bauhaus-canvas text-bauhaus-muted px-1.5 py-0.5 border border-bauhaus-black/10">
                              {org.length > 30 ? org.substring(0, 30) + '...' : org}
                            </span>
                          ))}
                          {(p.org_count || 0) > 3 && (
                            <span className="text-[10px] text-bauhaus-muted font-bold">+{p.org_count - 3}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Foundation Landscape ── */}
      {foundations?.summary && (
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-3">
              <h2 className="text-2xl font-black text-bauhaus-black">Foundation Landscape</h2>
              <p className="text-sm text-bauhaus-muted font-medium mt-1">
                {fmt(foundations.summary.total_foundations)} Australian foundations tracked.
                Where private philanthropy flows — and who it reaches.
              </p>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black text-bauhaus-black">{fmt(foundations.summary.total_foundations)}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Foundations</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black text-bauhaus-black">{money(Number(foundations.summary.total_annual_giving || 0))}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Annual Giving</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black" style={{ color: '#059669' }}>{fmt(foundations.summary.indigenous_focus_count)}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Indigenous Focus</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black text-bauhaus-black">{fmt(foundations.summary.youth_focus_count)}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Youth Focus</div>
              </div>
            </div>

            {/* Foundation type breakdown */}
            {foundations.typeBreakdown?.length > 0 && (
              <div className="border-4 border-bauhaus-black bg-white p-4 mb-4">
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">Giving by Foundation Type</div>
                <div className="space-y-2">
                  {foundations.typeBreakdown.slice(0, 8).map((t: any) => {
                    const maxGiving = Number(foundations.typeBreakdown[0]?.total_giving || 1);
                    const pct = (Number(t.total_giving) / maxGiving) * 100;
                    return (
                      <div key={t.type} className="flex items-center gap-3">
                        <div className="w-36 text-xs font-bold text-bauhaus-black truncate">
                          {(t.type || '').replace(/_/g, ' ')}
                        </div>
                        <div className="flex-1 h-5 bg-bauhaus-canvas border border-bauhaus-black/10 relative">
                          <div
                            className="h-full bg-bauhaus-black"
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                        <div className="w-20 text-right text-xs font-black text-bauhaus-black">
                          {money(Number(t.total_giving))}
                        </div>
                        <div className="w-12 text-right text-[10px] font-medium text-bauhaus-muted">
                          {t.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Thematic focus tags */}
            {foundations.thematicFocus?.length > 0 && (
              <div className="border-4 border-bauhaus-black bg-white p-4 mb-4">
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">Thematic Focus</div>
                <div className="flex flex-wrap gap-2">
                  {foundations.thematicFocus.map((t: any) => {
                    const maxCount = Number(foundations.thematicFocus[0]?.count || 1);
                    const intensity = Math.max(0.15, Number(t.count) / maxCount);
                    const isHighlight = ['indigenous', 'youth', 'justice-reinvestment', 'human_rights'].includes(t.theme);
                    return (
                      <span
                        key={t.theme}
                        className={`px-3 py-1.5 text-xs font-bold border-2 ${
                          isHighlight
                            ? 'border-bauhaus-red text-bauhaus-red bg-red-50'
                            : 'border-bauhaus-black text-bauhaus-black'
                        }`}
                        style={!isHighlight ? { opacity: 0.4 + intensity * 0.6 } : undefined}
                      >
                        {(t.theme || '').replace(/_/g, ' ')} ({t.count})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top foundations table */}
            {foundations.topFoundations?.length > 0 && (
              <div className="border-4 border-bauhaus-black bg-white overflow-hidden overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-black text-white">
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">#</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Foundation</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Type</th>
                      <th className="text-right px-4 py-2 text-[10px] font-black uppercase tracking-widest">Annual Giving</th>
                      <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Focus Areas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foundations.topFoundations.map((f: any, i: number) => (
                      <tr key={f.id} className={`border-b border-gray-100 hover:bg-blue-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-2 text-bauhaus-muted font-medium">{i + 1}</td>
                        <td className="px-4 py-2">
                          {f.gs_entity_id ? (
                            <Link href={`/entity/${f.gs_entity_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-red transition-colors">
                              {f.name.length > 45 ? f.name.substring(0, 45) + '...' : f.name}
                            </Link>
                          ) : (
                            <span className="font-bold text-bauhaus-black">
                              {f.name.length > 45 ? f.name.substring(0, 45) + '...' : f.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-bauhaus-muted font-medium text-xs">
                          {(f.type || '').replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-2 text-right font-black text-bauhaus-black">
                          {money(Number(f.total_giving_annual))}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(f.thematic_focus || []).slice(0, 4).map((t: string) => (
                              <span key={t} className="text-[9px] font-bold bg-bauhaus-canvas text-bauhaus-muted px-1.5 py-0.5 border border-bauhaus-black/10">
                                {t.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Dual-funded callout */}
            {foundations.dualFunded?.length > 0 && (
              <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
                <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">
                  Cross-Sector Funding
                </div>
                <h3 className="text-lg font-black text-bauhaus-black mb-2">
                  Dual-Funded: Government + Philanthropy
                </h3>
                <p className="text-sm text-bauhaus-muted font-medium mb-3">
                  Organisations receiving funding from both government and private foundations.
                  Dual funding can signal strong validation — or capture risk.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {foundations.dualFunded.slice(0, 10).map((d: any, i: number) => (
                    <div key={i} className="border-2 border-bauhaus-black bg-white p-3 flex items-start gap-3">
                      {d.is_indigenous_org && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-green-700 bg-green-100 px-1.5 py-0.5 shrink-0 mt-0.5">
                          ACCO
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-bauhaus-black truncate">{d.name}</div>
                        <div className="text-[10px] text-bauhaus-muted font-medium mt-0.5">
                          {d.state || '—'}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs font-medium">
                          <span className="text-bauhaus-black">
                            Foundation: <span className="font-black">{money(Number(d.foundation_total))}</span>
                          </span>
                          <span className="text-bauhaus-muted">
                            Govt: <span className="font-black">{money(Number(d.govt_total))}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── JusticeHub Cross-link ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">
              Youth Justice Deep Dive
            </div>
            <h3 className="text-xl font-black text-white mb-2">
              See the social services power map on JusticeHub
            </h3>
            <p className="text-sm text-gray-400 font-medium mb-4 max-w-2xl">
              JusticeHub maps $29.6B in social services funding — child protection, youth justice,
              disability, housing — with program accountability and community control analysis.
            </p>
            <a
              href="https://justicehub.org.au/intelligence/power-map"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-black text-white bg-bauhaus-red px-4 py-2 hover:bg-red-700 transition-colors uppercase tracking-widest"
            >
              Open JusticeHub Power Map →
            </a>
          </div>
        </div>
      </section>

      {/* Community Voice placeholder */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="border-4 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-8 text-center">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Coming Soon</div>
            <h3 className="text-xl font-black text-bauhaus-black mb-2">Community Voice</h3>
            <p className="text-sm text-bauhaus-muted font-medium max-w-lg mx-auto">
              Community priorities and lived experience data — because the numbers only tell half the story.
              Communities own their narratives.
            </p>
          </div>
        </div>
      </section>

      {/* Data Health + Sources */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl font-black text-bauhaus-black mb-3">Data Coverage</h2>

          {/* Live health metrics */}
          {health && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black text-bauhaus-black">{health.total_entities.toLocaleString()}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Entities</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black text-bauhaus-black">{health.total_relationships.toLocaleString()}</div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Relationships</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black" style={{ color: health.map_coverage_pct >= 50 ? '#059669' : '#D02020' }}>
                  {health.sa2_regions_with_data}/{health.sa2_regions_total}
                </div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">SA2 Regions ({health.map_coverage_pct}%)</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3 text-center">
                <div className="text-lg font-black" style={{ color: health.sa2_coverage_pct >= 60 ? '#059669' : '#E8961C' }}>
                  {health.sa2_coverage_pct}%
                </div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Entity Geocoverage</div>
              </div>
            </div>
          )}

          {/* Coverage gaps */}
          {health && health.gaps.entities_no_postcode > 0 && (
            <div className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas p-3 mb-4">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Data Gaps</div>
              <div className="flex flex-wrap gap-3 text-xs font-medium text-bauhaus-muted">
                <span>{health.gaps.entities_no_postcode.toLocaleString()} entities without postcode</span>
                <span className="text-bauhaus-black/20">|</span>
                <span>{health.gaps.entities_postcode_no_sa2.toLocaleString()} postcodes unmapped to SA2</span>
                <span className="text-bauhaus-black/20">|</span>
                <span>{health.gaps.postcodes_missing_sa2.toLocaleString()} postcodes without SA2 code</span>
              </div>
            </div>
          )}

          {/* Data sources table */}
          <div className="border-4 border-bauhaus-black bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Source</th>
                  <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Records</th>
                  <th className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest">Updated</th>
                </tr>
              </thead>
              <tbody>
                {DATA_SOURCES.map((ds, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="px-4 py-2 font-bold text-bauhaus-black">{ds.name}</td>
                    <td className="px-4 py-2 text-bauhaus-muted font-medium">{ds.records}</td>
                    <td className="px-4 py-2 text-bauhaus-muted font-medium">{ds.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Place detail panel */}
      <PlaceDetail
        sa2Code={selectedSA2}
        onClose={() => setSelectedSA2(null)}
        onSelectEntity={(gsId) => {
          setSelectedEntity(gsId);
          setSelectedSA2(null);
        }}
      />
    </>
  );
}
