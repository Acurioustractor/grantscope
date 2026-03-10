'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type TabKey = 'discover' | 'enrich' | 'pack';

interface SupplierResult {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean;
  lga_name: string | null;
  latest_revenue: number | null;
  contracts: { count: number; total_value: number };
}

interface DiscoverResult {
  suppliers: SupplierResult[];
  summary: {
    total_found: number;
    indigenous_businesses: number;
    social_enterprises: number;
    community_controlled: number;
    with_federal_contracts: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PackResult = { pack: { generated_at: string; filters?: { state?: string; lga?: string }; sections: any } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnrichResult = { enriched: any[]; summary: any };

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const ENTITY_TYPES = [
  { value: 'indigenous_corp', label: 'Indigenous Business' },
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'charity', label: 'Charity / NFP' },
  { value: 'company', label: 'Company' },
];
const REMOTENESS = [
  'Major Cities of Australia',
  'Inner Regional Australia',
  'Outer Regional Australia',
  'Remote Australia',
  'Very Remote Australia',
];

function fmtMoney(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function entityTypeLabel(t: string) {
  return {
    indigenous_corp: 'Indigenous',
    social_enterprise: 'Social Enterprise',
    charity: 'Charity',
    company: 'Company',
    foundation: 'Foundation',
    government_body: 'Government',
  }[t] || t;
}

function entityTypeBadgeColor(t: string) {
  return {
    indigenous_corp: 'bg-bauhaus-yellow text-bauhaus-black',
    social_enterprise: 'bg-money text-white',
    charity: 'bg-bauhaus-blue text-white',
    company: 'bg-bauhaus-black/60 text-white',
  }[t] || 'bg-bauhaus-muted text-white';
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-black transition-colors"
    >
      {label}
    </button>
  );
}

export default function TenderIntelligencePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
    });
  }, []);

  const [tab, setTab] = useState<TabKey>('discover');
  const [loading, setLoading] = useState(false);

  // Discover state
  const [discoverState, setDiscoverState] = useState('');
  const [discoverLga, setDiscoverLga] = useState('');
  const [discoverTypes, setDiscoverTypes] = useState<string[]>(['indigenous_corp', 'social_enterprise']);
  const [discoverRemoteness, setDiscoverRemoteness] = useState('');
  const [discoverCommunity, setDiscoverCommunity] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoverResult | null>(null);

  // Enrich state
  const [enrichCsv, setEnrichCsv] = useState('');
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);

  // Pack state
  const [packState, setPackState] = useState('');
  const [packLga, setPackLga] = useState('');
  const [packSuppliersCsv, setPackSuppliersCsv] = useState('');
  const [packTotalValue, setPackTotalValue] = useState('');
  const [packResult, setPackResult] = useState<PackResult | null>(null);

  async function runDiscover() {
    setLoading(true);
    try {
      const res = await fetch('/api/tender-intelligence/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: discoverState || undefined,
          lga: discoverLga || undefined,
          entity_types: discoverTypes,
          remoteness: discoverRemoteness || undefined,
          community_controlled: discoverCommunity || undefined,
          limit: 50,
        }),
      });
      const data = await res.json();
      setDiscoverResult(data);
    } catch (err) {
      console.error('Discover error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runEnrich() {
    setLoading(true);
    try {
      // Parse CSV: name,abn per line
      const lines = enrichCsv.trim().split('\n').filter(Boolean);
      const suppliers = lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        return { name: parts[0], abn: parts[1] || undefined };
      });

      const res = await fetch('/api/tender-intelligence/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suppliers }),
      });
      const data = await res.json();
      setEnrichResult(data);
    } catch (err) {
      console.error('Enrich error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runPack() {
    setLoading(true);
    try {
      // Parse existing suppliers if provided
      const existingSuppliers = packSuppliersCsv.trim()
        ? packSuppliersCsv.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.split(',').map(s => s.trim());
            return { name: parts[0], abn: parts[1] || undefined, contract_value: parts[2] ? parseFloat(parts[2]) : undefined };
          })
        : [];

      const res = await fetch('/api/tender-intelligence/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: packState || undefined,
          lga: packLga || undefined,
          existing_suppliers: existingSuppliers.length > 0 ? existingSuppliers : undefined,
          total_contract_value: packTotalValue ? parseFloat(packTotalValue) : undefined,
        }),
      });
      const data = await res.json();
      setPackResult(data);
    } catch (err) {
      console.error('Pack error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (authed === null) {
    return (
      <div className="min-h-screen bg-bauhaus-canvas flex items-center justify-center">
        <div className="text-bauhaus-muted font-black text-xs uppercase tracking-widest">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-bauhaus-canvas flex items-center justify-center">
        <div className="border-4 border-bauhaus-black bg-white p-12 max-w-md text-center">
          <h1 className="text-2xl font-black uppercase tracking-widest mb-4">Procurement Intelligence</h1>
          <p className="text-sm text-bauhaus-muted mb-8">
            Sign in to access supplier discovery, list enrichment, and compliance scoring tools.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      {/* Hero */}
      <section className="bg-bauhaus-black text-white py-16 px-6 print:hidden">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-bauhaus-yellow uppercase tracking-[0.4em] font-black mb-4">
            CivicGraph Procurement Intelligence
          </p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            TENDER INTELLIGENCE
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mb-6">
            Discover suppliers, check procurement compliance, and generate
            bid-ready intelligence packs. Powered by 99,000+ entities
            and 672,000 government contracts.
          </p>
          <div className="flex gap-4 text-xs text-white/30 font-bold uppercase tracking-widest">
            <span>Layer 1: Money</span>
            <span>&middot;</span>
            <span>Layer 2: Market</span>
            <span>&middot;</span>
            <span>Layer 3: Proof</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b-4 border-bauhaus-black bg-white print:hidden">
        <div className="max-w-5xl mx-auto flex">
          {[
            { key: 'discover' as TabKey, label: 'Supplier Discovery' },
            { key: 'enrich' as TabKey, label: 'List Enrichment' },
            { key: 'pack' as TabKey, label: 'Intelligence Pack' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-r-4 border-bauhaus-black transition-colors ${
                tab === t.key
                  ? 'bg-bauhaus-black text-white'
                  : 'text-bauhaus-muted hover:bg-bauhaus-canvas'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ═══ TAB: DISCOVER ═══ */}
        {tab === 'discover' && (
          <div>
            <h2 className="text-xl font-black mb-6">Find Suppliers by Capability & Geography</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {/* State */}
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">State</label>
                <select
                  value={discoverState}
                  onChange={e => setDiscoverState(e.target.value)}
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white"
                >
                  <option value="">All States</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* LGA */}
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">LGA / Region</label>
                <input
                  value={discoverLga}
                  onChange={e => setDiscoverLga(e.target.value)}
                  placeholder="e.g. Cairns, Torres"
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white placeholder:text-bauhaus-muted"
                />
              </div>

              {/* Remoteness */}
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">Remoteness</label>
                <select
                  value={discoverRemoteness}
                  onChange={e => setDiscoverRemoteness(e.target.value)}
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white"
                >
                  <option value="">Any</option>
                  {REMOTENESS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Entity types */}
            <div className="mb-6">
              <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">Supplier Types</label>
              <div className="flex flex-wrap gap-2">
                {ENTITY_TYPES.map(et => (
                  <button
                    key={et.value}
                    onClick={() => {
                      setDiscoverTypes(prev =>
                        prev.includes(et.value)
                          ? prev.filter(v => v !== et.value)
                          : [...prev, et.value]
                      );
                    }}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black transition-colors ${
                      discoverTypes.includes(et.value)
                        ? 'bg-bauhaus-black text-white'
                        : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'
                    }`}
                  >
                    {et.label}
                  </button>
                ))}
                <button
                  onClick={() => setDiscoverCommunity(!discoverCommunity)}
                  className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black transition-colors ${
                    discoverCommunity
                      ? 'bg-bauhaus-red text-white'
                      : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'
                  }`}
                >
                  Community Controlled Only
                </button>
              </div>
            </div>

            <button
              onClick={runDiscover}
              disabled={loading}
              className="px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search Suppliers'}
            </button>

            {/* Results */}
            {discoverResult && (
              <div className="mt-10">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-4 border-bauhaus-black mb-8">
                  {[
                    { val: discoverResult.summary.total_found, label: 'Suppliers Found' },
                    { val: discoverResult.summary.indigenous_businesses, label: 'Indigenous' },
                    { val: discoverResult.summary.social_enterprises, label: 'Social Enterprise' },
                    { val: discoverResult.summary.community_controlled, label: 'Community Controlled' },
                    { val: discoverResult.summary.with_federal_contracts, label: 'With Contracts' },
                  ].map((s, i) => (
                    <div key={s.label} className={`p-4 text-center ${i < 4 ? 'border-r-4 border-bauhaus-black' : ''}`}>
                      <div className="text-2xl font-black">{s.val}</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Supplier table */}
                <div className="border-4 border-bauhaus-black bg-white">
                  <div className="bg-bauhaus-black px-4 py-2 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Supplier Shortlist</h3>
                    <ExportButton label="Export CSV" onClick={() => downloadCSV(
                      discoverResult.suppliers.map(s => ({
                        name: s.canonical_name, abn: s.abn, entity_type: entityTypeLabel(s.entity_type),
                        state: s.state, postcode: s.postcode, lga: s.lga_name, remoteness: s.remoteness,
                        seifa_decile: s.seifa_irsd_decile, community_controlled: s.is_community_controlled,
                        revenue: s.latest_revenue, contracts: s.contracts.count, contract_value: s.contracts.total_value,
                      })), 'civicgraph-suppliers.csv'
                    )} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-4 border-bauhaus-black">
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Supplier</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Region</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">Contracts</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">SEIFA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {discoverResult.suppliers.slice(0, 30).map((s: SupplierResult) => (
                          <tr key={s.gs_id} className="border-b border-bauhaus-black/10 hover:bg-bauhaus-canvas">
                            <td className="px-4 py-3">
                              <Link href={`/entities/${s.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-red">
                                {s.canonical_name}
                              </Link>
                              {s.abn && <div className="text-xs text-bauhaus-muted">ABN {s.abn}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 ${entityTypeBadgeColor(s.entity_type)}`}>
                                {entityTypeLabel(s.entity_type)}
                              </span>
                              {s.is_community_controlled && (
                                <span className="ml-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-red text-white">CC</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-bauhaus-muted">
                              <div>{s.lga_name || s.state}</div>
                              {s.remoteness && s.remoteness !== 'Major Cities of Australia' && (
                                <div className="text-xs">{s.remoteness}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {s.contracts.count > 0 ? (
                                <div>
                                  <div className="font-black">{s.contracts.count}</div>
                                  <div className="text-xs text-bauhaus-muted">{fmtMoney(s.contracts.total_value)}</div>
                                </div>
                              ) : (
                                <span className="text-bauhaus-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {s.seifa_irsd_decile ? (
                                <span className={`font-black ${s.seifa_irsd_decile <= 3 ? 'text-bauhaus-red' : ''}`}>
                                  {s.seifa_irsd_decile}
                                </span>
                              ) : '—'}
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
        )}

        {/* ═══ TAB: ENRICH ═══ */}
        {tab === 'enrich' && (
          <div>
            <h2 className="text-xl font-black mb-2">Enrich Your Supplier List</h2>
            <p className="text-sm text-bauhaus-muted mb-6">
              Paste supplier names (one per line). Optionally add ABN after a comma.
              CivicGraph resolves each against the entity graph and returns ownership type,
              contract history, and compliance metadata.
            </p>

            <textarea
              value={enrichCsv}
              onChange={e => setEnrichCsv(e.target.value)}
              placeholder={'Supplier Name, ABN (optional)\nTorres Civil Group, 12345678901\nCape Infrastructure Services\nNorthern Community Works'}
              rows={8}
              className="w-full border-4 border-bauhaus-black p-4 text-sm font-mono bg-white placeholder:text-bauhaus-muted mb-4"
            />

            <button
              onClick={runEnrich}
              disabled={loading || !enrichCsv.trim()}
              className="px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors disabled:opacity-50"
            >
              {loading ? 'Enriching...' : 'Enrich Supplier List'}
            </button>

            {enrichResult && (
              <div className="mt-10">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-4 border-bauhaus-black mb-8">
                  {[
                    { val: enrichResult.summary.total_input, label: 'Input' },
                    { val: `${enrichResult.summary.resolution_rate}%`, label: 'Resolved' },
                    { val: enrichResult.summary.indigenous, label: 'Indigenous' },
                    { val: enrichResult.summary.with_contracts, label: 'With Contracts' },
                  ].map((s, i) => (
                    <div key={s.label} className={`p-4 text-center ${i < 3 ? 'border-r-4 border-bauhaus-black' : ''}`}>
                      <div className="text-2xl font-black">{s.val}</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Results table */}
                <div className="border-4 border-bauhaus-black bg-white">
                  <div className="bg-bauhaus-blue px-4 py-2 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Enriched Results</h3>
                    <ExportButton label="Export CSV" onClick={() => downloadCSV(
                      enrichResult.enriched.map((item: EnrichResult['enriched'][0]) => ({
                        input_name: item.input.name, input_abn: item.input.abn, resolved: item.resolved,
                        canonical_name: item.entity?.canonical_name, entity_type: item.entity ? entityTypeLabel(item.entity.entity_type) : '',
                        abn: item.entity?.abn, state: item.entity?.state, remoteness: item.entity?.remoteness,
                        community_controlled: item.entity?.is_community_controlled, contracts: item.contracts?.count,
                        contract_value: item.contracts?.total_value,
                      })), 'civicgraph-enriched.csv'
                    )} />
                  </div>
                  <div className="divide-y divide-bauhaus-black/10">
                    {enrichResult.enriched.map((item: EnrichResult['enriched'][0], i: number) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm">{item.input.name}</div>
                          {item.resolved && item.entity ? (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 ${entityTypeBadgeColor(item.entity.entity_type)}`}>
                                {entityTypeLabel(item.entity.entity_type)}
                              </span>
                              <span className="text-xs text-bauhaus-muted">{item.entity.state}</span>
                              {item.contracts.count > 0 && (
                                <span className="text-xs text-money font-bold">{item.contracts.count} contracts</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-bauhaus-red font-bold">Not found in entity graph</span>
                          )}
                        </div>
                        <div className={`w-3 h-3 rounded-full ${item.resolved ? 'bg-money' : 'bg-bauhaus-red'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: PACK ═══ */}
        {tab === 'pack' && (
          <div>
            <div className="print:hidden">
            <h2 className="text-xl font-black mb-2">Generate Intelligence Pack</h2>
            <p className="text-sm text-bauhaus-muted mb-6">
              Specify a region and optionally paste your existing supplier list.
              CivicGraph generates a full Tender Intelligence Pack with market overview,
              compliance analysis, shortlist, and recommended partners.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">State</label>
                <select
                  value={packState}
                  onChange={e => setPackState(e.target.value)}
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white"
                >
                  <option value="">All States</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">LGA / Region</label>
                <input
                  value={packLga}
                  onChange={e => setPackLga(e.target.value)}
                  placeholder="e.g. Cairns, Darwin"
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white placeholder:text-bauhaus-muted"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">Total Contract Value ($)</label>
                <input
                  value={packTotalValue}
                  onChange={e => setPackTotalValue(e.target.value)}
                  placeholder="e.g. 5000000"
                  className="w-full border-4 border-bauhaus-black p-3 text-sm font-bold bg-white placeholder:text-bauhaus-muted"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-black uppercase tracking-widest text-bauhaus-muted block mb-2">
                Existing Suppliers (optional — name, ABN, value per line)
              </label>
              <textarea
                value={packSuppliersCsv}
                onChange={e => setPackSuppliersCsv(e.target.value)}
                placeholder={'Supplier Name, ABN, Contract Value\nACME Corp, 12345678901, 500000\nLocal Services Pty Ltd, , 250000'}
                rows={5}
                className="w-full border-4 border-bauhaus-black p-4 text-sm font-mono bg-white placeholder:text-bauhaus-muted"
              />
            </div>

            <button
              onClick={runPack}
              disabled={loading}
              className="px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-black transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating Pack...' : 'Generate Intelligence Pack'}
            </button>
            </div>

            {/* Pack Results */}
            {packResult && (
              <div id="pack-report" className="mt-10 space-y-8">
                <div className="hidden print:block mb-8">
                  <h1 className="text-3xl font-black uppercase tracking-widest mb-1">CivicGraph Tender Intelligence Pack</h1>
                  <p className="text-sm text-bauhaus-muted">
                    {[packResult.pack.filters?.state, packResult.pack.filters?.lga].filter(Boolean).join(' — ') || 'All Regions'}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-bauhaus-muted font-bold">
                    Generated {new Date(packResult.pack.generated_at).toLocaleString('en-AU')}
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors print:hidden"
                  >
                    Save as PDF
                  </button>
                </div>

                {/* Section 1: Market Overview */}
                <div className="border-4 border-bauhaus-black">
                  <div className="bg-bauhaus-blue px-4 py-3">
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">1. Market Capability Overview</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                    {[
                      { val: packResult.pack.sections.market_overview.suppliers_identified, label: 'Suppliers Found' },
                      { val: packResult.pack.sections.market_overview.indigenous_businesses, label: 'Indigenous' },
                      { val: packResult.pack.sections.market_overview.social_enterprises, label: 'Social Enterprise' },
                      { val: packResult.pack.sections.market_overview.with_federal_contracts, label: 'With Contracts' },
                    ].map((s, i) => (
                      <div key={s.label} className={`p-5 text-center ${i < 3 ? 'border-r-4 border-bauhaus-black' : ''} border-b-4 border-bauhaus-black`}>
                        <div className="text-3xl font-black">{s.val}</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-black">{packResult.pack.sections.market_overview.community_controlled}</div>
                      <div className="text-[9px] text-bauhaus-muted uppercase tracking-widest">Community Controlled</div>
                    </div>
                    <div>
                      <div className="text-lg font-black">{packResult.pack.sections.market_overview.charities}</div>
                      <div className="text-[9px] text-bauhaus-muted uppercase tracking-widest">Charities</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-money">{fmtMoney(packResult.pack.sections.market_overview.total_contract_value)}</div>
                      <div className="text-[9px] text-bauhaus-muted uppercase tracking-widest">Total Contract Value</div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Compliance Analysis */}
                {packResult.pack.sections.compliance_analysis && (
                  <div className="border-4 border-bauhaus-black">
                    <div className="bg-bauhaus-red px-4 py-3">
                      <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">2. Procurement Compliance</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="border-4 border-bauhaus-black p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-black uppercase tracking-widest">Indigenous</span>
                            <span className={`text-xs font-black px-2 py-0.5 ${
                              packResult.pack.sections.compliance_analysis.indigenous.meets_target
                                ? 'bg-money text-white' : 'bg-bauhaus-red text-white'
                            }`}>
                              {packResult.pack.sections.compliance_analysis.indigenous.meets_target ? 'MEETS TARGET' : 'BELOW TARGET'}
                            </span>
                          </div>
                          <div className="text-3xl font-black">{packResult.pack.sections.compliance_analysis.indigenous.pct}%</div>
                          <div className="text-xs text-bauhaus-muted">Target: 3% | {packResult.pack.sections.compliance_analysis.indigenous.count} suppliers</div>
                          {packResult.pack.sections.compliance_analysis.indigenous.shortfall_value > 0 && (
                            <div className="text-xs text-bauhaus-red font-bold mt-1">
                              Shortfall: {fmtMoney(packResult.pack.sections.compliance_analysis.indigenous.shortfall_value)}
                            </div>
                          )}
                        </div>
                        <div className="border-4 border-bauhaus-black p-4">
                          <span className="text-xs font-black uppercase tracking-widest">Social Enterprise</span>
                          <div className="text-3xl font-black mt-2">{packResult.pack.sections.compliance_analysis.social_enterprise.pct}%</div>
                          <div className="text-xs text-bauhaus-muted">{packResult.pack.sections.compliance_analysis.social_enterprise.count} suppliers</div>
                        </div>
                        <div className="border-4 border-bauhaus-black p-4">
                          <span className="text-xs font-black uppercase tracking-widest">Regional</span>
                          <div className="text-3xl font-black mt-2">{packResult.pack.sections.compliance_analysis.regional.pct}%</div>
                          <div className="text-xs text-bauhaus-muted">{packResult.pack.sections.compliance_analysis.regional.count} suppliers</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Supplier Shortlist */}
                <div className="border-4 border-bauhaus-black">
                  <div className="bg-bauhaus-black px-4 py-3 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">3. Supplier Shortlist</h3>
                    <ExportButton label="Export CSV" onClick={() => downloadCSV(
                      packResult.pack.sections.supplier_shortlist.map((s: { name: string; abn: string | null; entity_type: string; state: string | null; lga: string | null; revenue: number | null; contracts: { count: number; total_value: number }; is_community_controlled: boolean }) => ({
                        name: s.name, abn: s.abn, entity_type: entityTypeLabel(s.entity_type),
                        state: s.state, lga: s.lga, community_controlled: s.is_community_controlled,
                        revenue: s.revenue, contracts: s.contracts.count, contract_value: s.contracts.total_value,
                      })), 'civicgraph-pack-shortlist.csv'
                    )} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Supplier</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest">Region</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">Contracts</th>
                          <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packResult.pack.sections.supplier_shortlist.map((s: { gs_id: string; name: string; abn: string | null; entity_type: string; state: string | null; lga: string | null; revenue: number | null; contracts: { count: number; total_value: number }; is_community_controlled: boolean }) => (
                          <tr key={s.gs_id} className="border-b border-bauhaus-black/10 hover:bg-bauhaus-canvas">
                            <td className="px-4 py-3">
                              <Link href={`/entities/${s.gs_id}`} className="font-bold hover:text-bauhaus-red">{s.name}</Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 ${entityTypeBadgeColor(s.entity_type)}`}>
                                {entityTypeLabel(s.entity_type)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-bauhaus-muted">{s.lga || s.state}</td>
                            <td className="px-4 py-3 text-right font-black tabular-nums">{s.contracts.count || '—'}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-bauhaus-muted">
                              {s.revenue ? fmtMoney(s.revenue) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 4: Bid Strength */}
                {packResult.pack.sections.bid_strength.insights.length > 0 && (
                  <div className="border-4 border-bauhaus-black">
                    <div className="bg-bauhaus-yellow px-4 py-3">
                      <h3 className="text-xs font-black text-bauhaus-black uppercase tracking-[0.2em]">4. Bid Strength Analysis</h3>
                    </div>
                    <div className="p-6 space-y-3">
                      {packResult.pack.sections.bid_strength.insights.map((insight: string, i: number) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="text-bauhaus-yellow font-black shrink-0">&#9654;</span>
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 5: Recommended Partners */}
                {packResult.pack.sections.recommended_partners.length > 0 && (
                  <div className="border-4 border-bauhaus-black">
                    <div className="bg-money px-4 py-3">
                      <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">5. Recommended Partners</h3>
                    </div>
                    <div className="divide-y divide-bauhaus-black/10">
                      {packResult.pack.sections.recommended_partners.map((r: { gs_id: string; name: string; abn: string | null; entity_type: string; state: string | null; remoteness: string | null; is_community_controlled: boolean; contracts: { count: number; total_value: number }; revenue: number | null; gap_type?: string }, i: number) => (
                        <div key={r.gs_id || i} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <Link href={`/entities/${r.gs_id}`} className="font-bold text-sm hover:text-bauhaus-red">
                              {r.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 ${entityTypeBadgeColor(r.entity_type)}`}>
                                {entityTypeLabel(r.entity_type)}
                              </span>
                              <span className="text-xs text-bauhaus-muted">{r.state}</span>
                              {r.contracts.count > 0 && (
                                <span className="text-xs font-bold text-money">{r.contracts.count} contracts ({fmtMoney(r.contracts.total_value)})</span>
                              )}
                            </div>
                          </div>
                          {r.revenue && (
                            <span className="text-sm font-bold tabular-nums">{fmtMoney(r.revenue)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
