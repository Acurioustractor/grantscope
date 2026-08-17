import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import ContractSideBrowser, { type SideRow } from '../ContractSideBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Political donors — CivicGraph' };

const FY_OPTIONS = ['1998-1999', '2014-15', '2019-20', '2022-23'];

const load = unstable_cache(
  async (q: string, from: string, sort: string) => {
    const supabase = getDirectServiceSupabase();
    const [browse, stats] = await Promise.all([
      supabase.rpc('donation_donor_browse', { p_q: q || null, p_from_fy: from, p_sort: sort, p_limit: 200 }),
      supabase.rpc('donation_browse_stats', { p_from_fy: from }),
    ]);
    if (browse.error) throw new Error(browse.error.message);
    return { rows: browse.data ?? [], stats: stats.data ?? null };
  },
  ['donation-donor-browse'],
  { revalidate: 3600 },
);

/** Political donors browser: donations-received only, the 'other receipt' 85% is excluded in SQL. */
export default async function DonationsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const from = typeof sp.from === 'string' && FY_OPTIONS.includes(sp.from) ? sp.from : '2014-15';
  const sortParam = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'total';
  const rpcSort = sortParam === 'contracts' ? 'donations' : sortParam;

  let rows: SideRow[] = [];
  let statsLine = '';
  let why: string | null = null;
  try {
    const { rows: data, stats } = await load(q, from, rpcSort);
    rows = (data as {
      donor_key: string;
      donor_name: string;
      donor_abn: string | null;
      donation_count: number;
      total_dollars: number | null;
      recipient_count: number;
      top_recipient: string | null;
    }[]).map((r) => ({
      key: r.donor_key,
      name: r.donor_name,
      abn: r.donor_abn,
      contracts: r.donation_count,
      value: r.total_dollars,
      counterparties: r.recipient_count,
      topCounterparty: r.top_recipient,
    }));
    const s = stats as { donations: number; total_dollars: number; other_receipt_dollars: number } | null;
    if (s) {
      statsLine = `${s.donations.toLocaleString('en-AU')} declared donations worth $${(s.total_dollars / 1e9).toFixed(1)}bn since ${from} · a further $${(s.other_receipt_dollars / 1e9).toFixed(0)}bn of 'other receipts' is excluded — it is not donations`;
    }
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Political donors</h1>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <ContractSideBrowser
          rows={rows}
          cfg={{
            side: 'donor',
            basePath: '/dashboard/browse/donations',
            counterpartyLabel: 'Recipients',
            detailApi: '/api/browse/donor',
            counterpartySortKey: 'recipients',
            itemLabel: 'donation',
            yearOptions: FY_OPTIONS,
          }}
          q={q}
          fromYear={from}
          sort={sortParam}
          statsLine={statsLine}
          caveat="AEC declared receipts, 'donation received' only — the far larger 'other receipt' category (investment returns, transfers between branches) is excluded in the query. Donors are grouped by ABN where declared, else by name; the same donor under two spellings appears twice. In the drawer's donation list the small line shows the financial year."
        />
      )}
    </div>
  );
}
