import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import ContractSideBrowser, { type SideRow } from '@/components/browse/ContractSideBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Contract suppliers — CivicGraph' };

// The rollup scans up to 767K rows (~3.5s): cache per (q, from, sort) for an hour.
const load = unstable_cache(
  async (q: string, from: number, sort: string, dir: string, state: string) => {
    const supabase = getDirectServiceSupabase();
    const [browse, stats] = await Promise.all([
      supabase.rpc('contract_supplier_browse', { p_q: q || null, p_from_year: from, p_state: state || null, p_sort: sort, p_dir: dir || null, p_limit: 200 }),
      supabase.rpc('contract_browse_stats', { p_from_year: from }),
    ]);
    if (browse.error) throw new Error(browse.error.message);
    return { rows: browse.data ?? [], stats: stats.data ?? null };
  },
  ['contract-supplier-browse'],
  { revalidate: 3600 },
);

/** Suppliers side of AusTender: who wins Commonwealth contracts. */
export default async function ContractsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const from = typeof sp.from === 'string' && /^\d{4}$/.test(sp.from) ? parseInt(sp.from, 10) : 2020;
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'total';
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : '';
  const state = typeof sp.state === 'string' && /^[A-Z]{2,3}$/.test(sp.state) ? sp.state : '';

  let rows: SideRow[] = [];
  let statsLine = '';
  let why: string | null = null;
  try {
    const { rows: data, stats } = await load(q, from, sort, dir, state);
    rows = (data as {
      supplier_key: string;
      supplier_name: string;
      supplier_abn: string | null;
      contract_count: number;
      total_value: number | null;
      buyer_count: number;
      top_buyer: string | null;
    }[]).map((r) => ({
      key: r.supplier_key,
      name: r.supplier_name,
      abn: r.supplier_abn,
      contracts: r.contract_count,
      value: r.total_value,
      counterparties: r.buyer_count,
      topCounterparty: r.top_buyer,
    }));
    const s = stats as { contracts: number; total_value: number; suppliers: number; buyers: number } | null;
    if (s) {
      statsLine = `${s.contracts.toLocaleString('en-AU')} contracts worth $${(s.total_value / 1e9).toFixed(0)}bn since ${from} · ${s.suppliers.toLocaleString('en-AU')} suppliers · ${s.buyers.toLocaleString('en-AU')} buying agencies`;
    }
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Contract suppliers</h1>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <ContractSideBrowser
          rows={rows}
          cfg={{ side: 'supplier', basePath: '/dashboard/browse/contracts', counterpartyLabel: 'Buyers', detailApi: '/api/browse/contract-supplier', counterpartySortKey: 'buyers', stateFacets: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'] }}
          state={state}
          q={q}
          fromYear={String(from)}
          sort={sort} dir={dir}
          statsLine={statsLine}
          caveat="AusTender: Commonwealth contracts only — state contracts live in their own registers. Suppliers are grouped by ABN where recorded, else by a normalised name — case, punctuation and the company suffix (PTY LTD / PTY LIMITED / P/L) are treated as the same word. The since-year floor is applied in the query; contracts with junk start dates are excluded by it."
        />
      )}
    </div>
  );
}
