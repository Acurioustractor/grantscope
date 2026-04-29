import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/report-supabase';
import { ReportCTA } from '../_components/report-cta';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'State Procurement Intelligence | CivicGraph',
  description:
    '200,000 state government procurement disclosures worth $37.8 billion. Queensland departments, suppliers, and contracts — fully searchable.',
  openGraph: {
    title: 'State Procurement Intelligence',
    description:
      '$37.8B in state government procurement contracts — who\'s buying, who\'s supplying, where the money flows.',
    type: 'article',
    siteName: 'CivicGraph',
  },
};

function money(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

type HeroStats = {
  total_contracts: number;
  total_value: number;
  state_count: number;
  dept_count: number;
  supplier_count: number;
};

type DeptRow = {
  buyer_department: string;
  cnt: number;
  total: number;
};

type SupplierRow = {
  supplier_name: string;
  supplier_abn: string | null;
  cnt: number;
  total: number;
  gs_id: string | null;
  is_community_controlled: boolean | null;
};

type SourceRow = {
  source: string;
  cnt: number;
  total: number;
};

const SOURCE_LABELS: Record<string, string> = {
  qld_doe_disclosure: 'QLD — Dept of Education',
  qld_dcyjma_disclosure: 'QLD — Children, Youth Justice & Multicultural Affairs',
  qld_dcssds_disclosure: 'QLD — Child Safety, Seniors & Disability',
  qld_corrective_disclosure: 'QLD — Corrective Services',
  qld_dcsyw_disclosure: 'QLD — Child Safety, Youth & Women',
  qld_desbt_disclosure: 'QLD — Employment, Small Business & Training',
  qld_dyj_disclosure: 'QLD — Youth Justice & Victim Services',
  nsw_etender: 'NSW — eTendering',
};

async function getData() {
  const supabase = getServiceSupabase();

  function safe<T>(result: { data: T | null; error: unknown }): T | null {
    return result.error ? null : result.data;
  }

  const [heroResult, deptsResult, suppliersResult, sourcesResult] = await Promise.all([
    supabase.rpc('exec_sql', {
      query: `SELECT
        COUNT(*) AS total_contracts,
        SUM(contract_value) AS total_value,
        COUNT(DISTINCT state) AS state_count,
        COUNT(DISTINCT buyer_department) AS dept_count,
        COUNT(DISTINCT supplier_name) AS supplier_count
      FROM state_tenders`,
    }),
    supabase.rpc('exec_sql', {
      query: `SELECT
        COALESCE(buyer_department, '(Unknown)') AS buyer_department,
        COUNT(*) AS cnt,
        SUM(contract_value) AS total
      FROM state_tenders
      WHERE buyer_department IS NOT NULL AND buyer_department != ''
      GROUP BY buyer_department
      ORDER BY total DESC NULLS LAST
      LIMIT 20`,
    }),
    supabase.rpc('exec_sql', {
      query: `SELECT
        st.supplier_name,
        st.supplier_abn,
        COUNT(*) AS cnt,
        SUM(st.contract_value) AS total,
        e.gs_id,
        e.is_community_controlled
      FROM state_tenders st
      LEFT JOIN gs_entities e ON e.id = st.gs_entity_id
      WHERE st.supplier_name IS NOT NULL
        AND st.supplier_name NOT IN ('', '-')
      GROUP BY st.supplier_name, st.supplier_abn, e.gs_id, e.is_community_controlled
      ORDER BY total DESC NULLS LAST
      LIMIT 25`,
    }),
    supabase.rpc('exec_sql', {
      query: `SELECT
        source,
        COUNT(*) AS cnt,
        SUM(contract_value) AS total
      FROM state_tenders
      GROUP BY source
      ORDER BY cnt DESC`,
    }),
  ]);

  const heroRows = safe(heroResult) as HeroStats[] | null;
  const hero = heroRows?.[0] ?? null;

  return {
    hero,
    depts: (safe(deptsResult) as DeptRow[] | null) ?? [],
    suppliers: (safe(suppliersResult) as SupplierRow[] | null) ?? [],
    sources: (safe(sourcesResult) as SourceRow[] | null) ?? [],
  };
}

export default async function StateProcurementPage() {
  const { hero, depts, suppliers, sources } = await getData();

  const totalContracts = Number(hero?.total_contracts ?? 0);
  const totalValue = Number(hero?.total_value ?? 0);
  const deptCount = Number(hero?.dept_count ?? 0);
  const supplierCount = Number(hero?.supplier_count ?? 0);

  const maxDeptTotal = depts.length > 0 ? Number(depts[0].total) : 1;
  const maxSupplierTotal = suppliers.length > 0 ? Number(suppliers[0].total) : 1;

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow border border-bauhaus-yellow px-2 py-1">
              Procurement Intelligence
            </span>
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tight mb-4 font-satoshi">
            State Procurement
          </h1>
          <p className="text-lg text-[#B0B0B0] max-w-2xl mb-12">
            {fmt(totalContracts)} state government contracts worth {money(totalValue)}.
            Queensland departments, suppliers, and their networks — fully mapped.
          </p>

          {/* Hero stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-2 border-[#333333]">
            <div className="border-r-2 border-[#333333] p-6">
              <div className="text-4xl font-black font-satoshi text-white mb-1">
                {money(totalValue)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                Total Contract Value
              </div>
            </div>
            <div className="border-r-2 border-[#333333] p-6">
              <div className="text-4xl font-black font-satoshi text-bauhaus-yellow mb-1">
                {fmt(totalContracts)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                Contracts Disclosed
              </div>
            </div>
            <div className="border-r-2 border-[#333333] p-6">
              <div className="text-4xl font-black font-satoshi text-bauhaus-blue mb-1">
                {fmt(deptCount)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                Departments
              </div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-black font-satoshi text-bauhaus-red mb-1">
                {fmt(supplierCount)}
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-[#777777]">
                Unique Suppliers
              </div>
            </div>
          </div>

          {/* Dataset coverage */}
          {sources.length > 0 && (
            <div className="mt-8 border-t border-[#333333] pt-6">
              <div className="text-xs font-black uppercase tracking-widest text-[#777777] mb-3">
                Data Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <span
                    key={s.source}
                    className="text-xs font-medium bg-[#1A1A1A] border border-[#333333] px-3 py-1 text-[#B0B0B0]"
                  >
                    {SOURCE_LABELS[s.source] ?? s.source} — {fmt(Number(s.cnt))}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

        {/* ── By Department ─────────────────────────────────── */}
        <section>
          <div className="border-b-4 border-bauhaus-black mb-8 pb-3">
            <h2 className="text-2xl font-black uppercase tracking-tight font-satoshi">
              By Department
            </h2>
            <p className="text-sm text-[#555555] mt-1">
              State government departments ranked by total procurement spend
            </p>
          </div>

          <div className="border-4 border-bauhaus-black" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
            <div className="bg-bauhaus-black text-white grid grid-cols-12 px-4 py-2">
              <div className="col-span-5 text-xs font-black uppercase tracking-widest">Department</div>
              <div className="col-span-2 text-xs font-black uppercase tracking-widest text-right">Contracts</div>
              <div className="col-span-2 text-xs font-black uppercase tracking-widest text-right">Total Value</div>
              <div className="col-span-3 text-xs font-black uppercase tracking-widest text-right">Share</div>
            </div>
            {depts.slice(0, 15).map((dept, i) => {
              const total = Number(dept.total);
              const pct = maxDeptTotal > 0 ? (total / maxDeptTotal) * 100 : 0;
              return (
                <div
                  key={dept.buyer_department}
                  className={`grid grid-cols-12 px-4 py-3 items-center border-b border-[#E8E8E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}`}
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <span className="text-xs font-black text-[#B0B0B0] w-5 shrink-0">{i + 1}</span>
                    <span className="text-sm font-medium text-bauhaus-black leading-tight">
                      {dept.buyer_department}
                    </span>
                  </div>
                  <div className="col-span-2 text-sm text-right tabular-nums text-[#555555]">
                    {fmt(Number(dept.cnt))}
                  </div>
                  <div className="col-span-2 text-sm font-bold text-right tabular-nums">
                    {money(total)}
                  </div>
                  <div className="col-span-3 flex items-center gap-2 justify-end">
                    <div className="w-20 h-2 bg-[#E8E8E8] border border-[#D0D0D0]">
                      <div
                        className="h-full bg-bauhaus-black"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#777777] w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Top Suppliers ─────────────────────────────────── */}
        <section>
          <div className="border-b-4 border-bauhaus-black mb-8 pb-3">
            <h2 className="text-2xl font-black uppercase tracking-tight font-satoshi">
              Top Suppliers
            </h2>
            <p className="text-sm text-[#555555] mt-1">
              Suppliers ranked by total contract value — linked to CivicGraph entities where available
            </p>
          </div>

          <div className="border-4 border-bauhaus-black" style={{ boxShadow: '8px 8px 0px 0px #121212' }}>
            <div className="bg-bauhaus-black text-white grid grid-cols-12 px-4 py-2">
              <div className="col-span-5 text-xs font-black uppercase tracking-widest">Supplier</div>
              <div className="col-span-2 text-xs font-black uppercase tracking-widest text-right">Contracts</div>
              <div className="col-span-3 text-xs font-black uppercase tracking-widest text-right">Total Value</div>
              <div className="col-span-2 text-xs font-black uppercase tracking-widest text-right">Status</div>
            </div>
            {suppliers.map((sup, i) => {
              const total = Number(sup.total);
              const pct = maxSupplierTotal > 0 ? (total / maxSupplierTotal) * 100 : 0;
              return (
                <div
                  key={`${sup.supplier_name}-${i}`}
                  className={`grid grid-cols-12 px-4 py-3 items-center border-b border-[#E8E8E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F8F8]'}`}
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <span className="text-xs font-black text-[#B0B0B0] w-5 shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      {sup.gs_id ? (
                        <Link
                          href={`/entity/${sup.gs_id}`}
                          className="text-sm font-medium text-bauhaus-blue hover:underline leading-tight block truncate"
                        >
                          {sup.supplier_name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium leading-tight block truncate">
                          {sup.supplier_name}
                        </span>
                      )}
                      {sup.supplier_abn && (
                        <span className="text-xs text-[#777777] font-mono">ABN {sup.supplier_abn}</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-right tabular-nums text-[#555555]">
                    {fmt(Number(sup.cnt))}
                  </div>
                  <div className="col-span-3 flex items-center gap-2 justify-end">
                    <div className="w-16 h-2 bg-[#E8E8E8] border border-[#D0D0D0] hidden sm:block">
                      <div
                        className="h-full bg-bauhaus-red"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-black tabular-nums">{money(total)}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    {sup.is_community_controlled && (
                      <span className="text-xs font-black uppercase tracking-wider text-[#059669] border border-[#059669] px-1.5 py-0.5">
                        Community
                      </span>
                    )}
                    {sup.gs_id && !sup.is_community_controlled && (
                      <span className="text-xs font-black uppercase tracking-wider text-bauhaus-blue border border-bauhaus-blue px-1.5 py-0.5">
                        Linked
                      </span>
                    )}
                    {!sup.gs_id && (
                      <span className="text-xs font-black uppercase tracking-wider text-[#B0B0B0] border border-[#D0D0D0] px-1.5 py-0.5">
                        Unlinked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Accountability Note ───────────────────────────── */}
        <section>
          <div className="border-l-4 border-bauhaus-red bg-white p-6 border-t border-r border-b border-[#E8E8E8]">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">
              Coverage Note
            </div>
            <p className="text-sm text-[#555555] leading-relaxed">
              This dataset covers Queensland state government procurement disclosures from 7 departments
              and a small NSW eTender sample. We&apos;re actively expanding coverage to include Victoria,
              South Australia, Western Australia, and the ACT. Federal procurement is separately covered
              in the AusTender dataset ({fmt(769811)} contracts).
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/charities?q="
                className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black hover:bg-[#333333] transition-colors"
              >
                Search All Entities →
              </Link>
              <Link
                href="/reports/consulting-class"
                className="px-4 py-2 bg-white text-bauhaus-black text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black hover:bg-[#F0F0F0] transition-colors"
              >
                Consulting Class Report →
              </Link>
            </div>
          </div>
        </section>

        <ReportCTA reportSlug="state-procurement" reportTitle="State Procurement Intelligence" />
      </div>
    </div>
  );
}
