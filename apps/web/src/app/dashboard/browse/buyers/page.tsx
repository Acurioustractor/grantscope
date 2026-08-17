import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import ContractSideBrowser, { type SideRow } from '../ContractSideBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Government buyers — CivicGraph' };

const load = unstable_cache(
  async (q: string, from: number, sort: string) => {
    const supabase = getDirectServiceSupabase();
    const [browse, stats] = await Promise.all([
      supabase.rpc('contract_buyer_browse', { p_q: q || null, p_from_year: from, p_sort: sort, p_limit: 200 }),
      supabase.rpc('contract_browse_stats', { p_from_year: from }),
    ]);
    if (browse.error) throw new Error(browse.error.message);
    return { rows: browse.data ?? [], stats: stats.data ?? null };
  },
  ['contract-buyer-browse'],
  { revalidate: 3600 },
);

/** Buyer side of AusTender: which agencies let the contracts. */
export default async function BuyersBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const from = typeof sp.from === 'string' && /^\d{4}$/.test(sp.from) ? parseInt(sp.from, 10) : 2020;
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'total';

  let rows: SideRow[] = [];
  let statsLine = '';
  let why: string | null = null;
  try {
    const { rows: data, stats } = await load(q, from, sort);
    rows = (data as {
      buyer_key: string;
      buyer_name: string;
      contract_count: number;
      total_value: number | null;
      supplier_count: number;
      top_supplier: string | null;
    }[]).map((r) => ({
      key: r.buyer_key,
      name: r.buyer_name,
      abn: null,
      contracts: r.contract_count,
      value: r.total_value,
      counterparties: r.supplier_count,
      topCounterparty: r.top_supplier,
    }));
    const s = stats as { contracts: number; total_value: number; suppliers: number; buyers: number } | null;
    if (s) {
      statsLine = `${s.buyers.toLocaleString('en-AU')} buying agencies · ${s.contracts.toLocaleString('en-AU')} contracts worth $${(s.total_value / 1e9).toFixed(0)}bn since ${from}`;
    }
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Government buyers</h1>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <ContractSideBrowser
          rows={rows}
          cfg={{ side: 'buyer', basePath: '/dashboard/browse/buyers', counterpartyLabel: 'Suppliers', detailApi: '/api/browse/contract-buyer', counterpartySortKey: 'suppliers' }}
          q={q}
          fromYear={String(from)}
          sort={sort}
          statsLine={statsLine}
          caveat="AusTender: Commonwealth agencies only. A buyer's supplier mix is the procurement story a supply-side pitch lands into. The since-year floor is applied in the query."
        />
      )}
    </div>
  );
}
