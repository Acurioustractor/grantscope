import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'The Pipeline — CivicGraph Ecosystem View',
  description:
    'A single view of every organisation in Australia&rsquo;s civic ecosystem — who receives government money, who donates, who’s community-controlled, who’s in which system. Filterable, shareable, Supabase-native.',
};

type Row = {
  gs_id: string;
  canonical_name: string;
  entity_type: string | null;
  abn: string | null;
  state: string | null;
  lga_name: string | null;
  is_community_controlled: boolean | null;
  in_procurement: number;
  in_justice_funding: number;
  in_political_donations: number;
  in_charity_registry: number;
  in_foundation: number;
  in_alma_evidence: number;
  in_ndis_provider: number;
  system_count: number;
  procurement_dollars: number | null;
  justice_dollars: number | null;
  donation_dollars: number | null;
  foundation_giving: number | null;
  total_dollar_flow: number | null;
  contract_count: number | null;
  justice_record_count: number | null;
  donation_count: number | null;
  power_score: number | null;
  charity_size: string | null;
};

type Stats = {
  total_entities: number;
  filtered: number;
  total_dollar_flow: number;
  cc_count: number;
};

function fmtMoney(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function fmtNum(n: number | null | undefined): string {
  if (!n) return '—';
  return n.toLocaleString();
}

function SystemChip({ active, letter, title }: { active: boolean | number | null; letter: string; title: string }) {
  const on = active === true || (typeof active === 'number' && active > 0);
  return (
    <span
      title={title}
      className={`inline-flex h-5 w-5 items-center justify-center border-2 border-bauhaus-black text-[9px] font-black ${on ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black/20'}`}
    >
      {letter}
    </span>
  );
}

type SP = Record<string, string | string[] | undefined>;

function get(sp: SP, key: string, fallback: string = ''): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const q = get(sp, 'q').trim();
  const entityType = get(sp, 'type');
  const state = get(sp, 'state').toUpperCase();
  const ccOnly = get(sp, 'cc') === 'true';
  const snOnly = get(sp, 'sn') === 'true';
  const minSystems = parseInt(get(sp, 'systems') || '0', 10) || 0;
  const minFlow = parseInt(get(sp, 'min_flow') || '0', 10) || 0;
  const sortBy = get(sp, 'sort') || 'power_score';
  const sortDir = get(sp, 'dir') || 'desc';
  const page = parseInt(get(sp, 'page') || '1', 10);
  const PAGE_SIZE = 50;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = getServiceSupabase();

  let query = supabase
    .from('mv_entity_power_index')
    .select(
      'gs_id, canonical_name, entity_type, abn, state, lga_name, is_community_controlled, in_procurement, in_justice_funding, in_political_donations, in_charity_registry, in_foundation, in_alma_evidence, in_ndis_provider, system_count, procurement_dollars, justice_dollars, donation_dollars, foundation_giving, total_dollar_flow, contract_count, justice_record_count, donation_count, power_score, charity_size',
      { count: 'exact' },
    );

  if (q) query = query.ilike('canonical_name', `%${q}%`);
  if (entityType) query = query.eq('entity_type', entityType);
  if (state) query = query.eq('state', state);
  if (ccOnly) query = query.eq('is_community_controlled', true);
  if (minSystems > 0) query = query.gte('system_count', minSystems);
  if (minFlow > 0) query = query.gte('total_dollar_flow', minFlow);

  query = query.order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false });
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: rows, count, error } = await query;

  const results: Row[] = (rows as Row[] | null) ?? [];

  // Summary stats (separate cheaper query)
  const statsPromise = supabase
    .from('mv_entity_power_index')
    .select('total_dollar_flow.sum(), is_community_controlled.count()', { count: 'exact', head: false })
    .limit(1);
  const { data: statsData } = await statsPromise;
  const totalDollarFlow = ((statsData as Record<string, number>[] | null)?.[0]?.sum) ?? 0;
  const ccCount = ((statsData as Record<string, number>[] | null)?.[0]?.count) ?? 0;

  const stats: Stats = {
    total_entities: count ?? 0,
    filtered: results.length,
    total_dollar_flow: Number(totalDollarFlow) || 0,
    cc_count: Number(ccCount) || 0,
  };

  // Supply Nation filter (post-query because mv_entity_power_index doesn't include the flag yet)
  let filteredResults = results;
  if (snOnly) {
    const abns = results.map((r) => r.abn).filter(Boolean);
    if (abns.length > 0) {
      const { data: snEntities } = await supabase
        .from('gs_entities')
        .select('abn')
        .eq('is_supply_nation_certified', true)
        .in('abn', abns);
      const snAbns = new Set((snEntities ?? []).map((e) => e.abn));
      filteredResults = results.filter((r) => r.abn && snAbns.has(r.abn));
    }
  }

  // Build share URL
  const qp = new URLSearchParams();
  if (q) qp.set('q', q);
  if (entityType) qp.set('type', entityType);
  if (state) qp.set('state', state);
  if (ccOnly) qp.set('cc', 'true');
  if (snOnly) qp.set('sn', 'true');
  if (minSystems > 0) qp.set('systems', String(minSystems));
  if (minFlow > 0) qp.set('min_flow', String(minFlow));
  if (sortBy !== 'power_score') qp.set('sort', sortBy);
  if (sortDir !== 'desc') qp.set('dir', sortDir);
  const shareQp = qp.toString();

  function linkWith(updates: Record<string, string | null>): string {
    const next = new URLSearchParams(qp);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    const qs = next.toString();
    return qs ? `?${qs}` : '/pipeline';
  }

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <main className="space-y-8 pb-16">
      {/* Hero */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="p-6 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">
            The Pipeline · Australia&rsquo;s Civic Ecosystem View
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">
            {stats.total_entities.toLocaleString()} organisations. One view.
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-medium text-white/75 sm:text-base">
            Every Australian organisation in CivicGraph&rsquo;s graph, cross-referenced across
            government procurement, justice funding, political donations, charity register,
            philanthropic giving, ALMA evidence, and NDIS supply. Filter, sort, share the URL.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/reports/ipp-scoreboard"
              className="border-2 border-white bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-yellow hover:text-bauhaus-black hover:border-bauhaus-yellow"
            >
              IPP Scoreboard →
            </Link>
            <Link
              href="/reports/double-dippers"
              className="border-2 border-white bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-yellow hover:text-bauhaus-black hover:border-bauhaus-yellow"
            >
              Double-Dippers →
            </Link>
            <Link
              href="/reports/indigenous-proxy"
              className="border-2 border-white bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-yellow hover:text-bauhaus-black hover:border-bauhaus-yellow"
            >
              Indigenous Proxy →
            </Link>
            <Link
              href="/reports/consulting-class"
              className="border-2 border-white bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-yellow hover:text-bauhaus-black hover:border-bauhaus-yellow"
            >
              Consulting Class →
            </Link>
            <Link
              href="/reports"
              className="border-2 border-bauhaus-yellow bg-bauhaus-yellow/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow transition-colors hover:bg-bauhaus-yellow hover:text-bauhaus-black"
            >
              All investigations →
            </Link>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-4 border-bauhaus-black bg-white">
        <form className="grid gap-4 p-5 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            type="search"
            name="q"
            placeholder="Search by name…"
            defaultValue={q}
            className="border-4 border-bauhaus-black bg-white px-4 py-2 text-sm font-medium focus:outline-none focus:bg-bauhaus-yellow/10"
          />
          <select
            name="type"
            defaultValue={entityType}
            className="border-4 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase tracking-widest"
          >
            <option value="">All types</option>
            <option value="charity">Charity</option>
            <option value="foundation">Foundation</option>
            <option value="company">Company</option>
            <option value="government_body">Government</option>
            <option value="indigenous_corp">Indigenous Corp</option>
            <option value="social_enterprise">Social Enterprise</option>
            <option value="person">Person</option>
            <option value="trust">Trust</option>
          </select>
          <select
            name="state"
            defaultValue={state}
            className="border-4 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase tracking-widest"
          >
            <option value="">All states</option>
            <option value="ACT">ACT</option>
            <option value="NSW">NSW</option>
            <option value="NT">NT</option>
            <option value="QLD">QLD</option>
            <option value="SA">SA</option>
            <option value="TAS">TAS</option>
            <option value="VIC">VIC</option>
            <option value="WA">WA</option>
          </select>
          <select
            name="systems"
            defaultValue={String(minSystems || '')}
            className="border-4 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase tracking-widest"
          >
            <option value="">Any systems</option>
            <option value="2">2+ systems</option>
            <option value="3">3+ systems</option>
            <option value="4">4+ systems</option>
            <option value="5">5+ systems</option>
          </select>
          <button
            type="submit"
            className="border-4 border-bauhaus-black bg-bauhaus-black px-6 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-red"
          >
            Apply
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2 border-t-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-3 text-[11px] font-black uppercase tracking-widest">
          <span className="text-bauhaus-muted">Quick filters:</span>
          <Link
            href={linkWith({ cc: ccOnly ? null : 'true' })}
            className={`border-2 border-bauhaus-black px-3 py-1 transition-colors ${ccOnly ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-yellow'}`}
          >
            Community-controlled
          </Link>
          <Link
            href={linkWith({ sn: snOnly ? null : 'true' })}
            className={`border-2 border-bauhaus-black px-3 py-1 transition-colors ${snOnly ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-yellow'}`}
          >
            Supply Nation
          </Link>
          <Link
            href={linkWith({ sort: 'total_dollar_flow', dir: 'desc' })}
            className="border-2 border-bauhaus-black bg-white px-3 py-1 text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
          >
            Sort: Biggest $
          </Link>
          <Link
            href={linkWith({ sort: 'system_count', dir: 'desc' })}
            className="border-2 border-bauhaus-black bg-white px-3 py-1 text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
          >
            Sort: Most cross-system
          </Link>
          <Link
            href="/pipeline"
            className="ml-auto border-2 border-bauhaus-red bg-white px-3 py-1 text-bauhaus-red transition-colors hover:bg-bauhaus-red hover:text-white"
          >
            Reset
          </Link>
        </div>
      </section>

      {/* Results */}
      <section className="border-4 border-bauhaus-black bg-white">
        <div className="flex items-center justify-between border-b-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-3">
          <p className="text-xs font-black uppercase tracking-widest">
            {(count ?? 0).toLocaleString()} match{count === 1 ? '' : 'es'}
            {' · Page '}{page}{' / '}{Math.max(totalPages, 1)}
          </p>
          <p className="text-[10px] font-medium text-bauhaus-muted">
            Share:&nbsp;
            <span className="font-mono">
              civicgraph.com.au/pipeline{shareQp ? `?${shareQp}` : ''}
            </span>
          </p>
        </div>

        {error && (
          <div className="px-5 py-4 text-sm font-medium text-bauhaus-red">
            Query error: {error.message}
          </div>
        )}

        {filteredResults.length === 0 && !error && (
          <div className="px-5 py-10 text-center text-sm font-medium text-bauhaus-muted">
            No matches. Try widening filters or searching a different name.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Organisation</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Place</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Systems</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">$ Flow</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Contracts</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Justice</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Donations</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((r, i) => (
                <tr
                  key={r.gs_id}
                  className={`border-b border-bauhaus-black/10 ${i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/entities/${encodeURIComponent(r.gs_id)}`}
                      className="font-black text-bauhaus-black hover:text-bauhaus-red"
                    >
                      {r.canonical_name}
                    </Link>
                    {r.is_community_controlled && (
                      <span className="ml-2 border border-bauhaus-red px-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-red">
                        CC
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{r.entity_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.lga_name ? <span className="text-bauhaus-black">{r.lga_name}</span> : null}
                    {r.state && (
                      <span className="ml-1 font-mono text-[10px] text-bauhaus-muted">{r.state}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <SystemChip active={r.in_procurement} letter="P" title="Procurement (AusTender)" />
                      <SystemChip active={r.in_justice_funding} letter="J" title="Justice funding" />
                      <SystemChip active={r.in_political_donations} letter="D" title="Political donations" />
                      <SystemChip active={r.in_charity_registry} letter="C" title="ACNC charity" />
                      <SystemChip active={r.in_foundation} letter="F" title="Foundation" />
                      <SystemChip active={r.in_alma_evidence} letter="A" title="ALMA evidence" />
                      <SystemChip active={r.in_ndis_provider} letter="N" title="NDIS provider" />
                      <span className="ml-2 font-mono text-xs font-black text-bauhaus-black">
                        {r.system_count}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{fmtMoney(r.total_dollar_flow)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmtNum(r.contract_count)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmtNum(r.justice_record_count)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmtNum(r.donation_count)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/entities/${encodeURIComponent(r.gs_id)}`}
                      className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red"
                    >
                      Dossier →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-3 text-xs font-black uppercase tracking-widest">
            {page > 1 ? (
              <Link
                href={`?${new URLSearchParams({ ...Object.fromEntries(qp), page: String(page - 1) }).toString()}`}
                className="border-2 border-bauhaus-black bg-white px-3 py-1 hover:bg-bauhaus-yellow"
              >
                ← Prev
              </Link>
            ) : (
              <span />
            )}
            <span className="text-bauhaus-muted">Page {page} / {totalPages}</span>
            {page < totalPages ? (
              <Link
                href={`?${new URLSearchParams({ ...Object.fromEntries(qp), page: String(page + 1) }).toString()}`}
                className="border-2 border-bauhaus-black bg-white px-3 py-1 hover:bg-bauhaus-yellow"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>

      {/* Legend */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5">
        <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Legend</p>
        <div className="mt-3 grid gap-2 text-xs text-bauhaus-black sm:grid-cols-2 md:grid-cols-4">
          <div><span className="font-black">P</span> — Procurement (AusTender contracts)</div>
          <div><span className="font-black">J</span> — Justice funding records</div>
          <div><span className="font-black">D</span> — Political donations</div>
          <div><span className="font-black">C</span> — ACNC charity register</div>
          <div><span className="font-black">F</span> — Foundation (grant-maker)</div>
          <div><span className="font-black">A</span> — ALMA evidence-based intervention</div>
          <div><span className="font-black">N</span> — NDIS registered provider</div>
          <div><span className="font-black">CC</span> — Community-controlled flag</div>
        </div>
        <p className="mt-4 text-[11px] text-bauhaus-muted">
          Data sourced from: AusTender, AEC, ACNC, GrantConnect, ABR, ATO tax transparency,
          NDIS provider register. Refreshed hourly from materialized view{' '}
          <code className="font-mono">mv_entity_power_index</code>. Every URL with filters is shareable.
        </p>
      </section>
    </main>
  );
}
