import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const revalidate = 3600;

function money(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n === 0) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number, d: number): string {
  if (d === 0) return '0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

type TopSupplier = {
  supplier_abn: string;
  total: number;
  cnt: number;
  canonical_name: string | null;
  gs_id: string | null;
  donated: number;
  donation_count: number;
};

type Buyer = {
  buyer_name: string;
  total: number;
  cnt: number;
};

type SizeBand = {
  band: string;
  suppliers: number;
  value: number;
};

type YearTrend = {
  yr: number;
  grand_total: number;
  top100_total: number;
  pct_top100: number;
};

type DonationTarget = {
  party: string;
  top100_donors: number;
  total_donated: number;
};

type Concentration = {
  total_contracts: number;
  total_value: number;
  unique_suppliers: number;
  top100_total: number;
  top100_pct: number;
  top100_donors: number;
  top100_donated: number;
  top100_lobbyists: number;
};

// Helper to safely extract typed array from exec_sql result
function safe<T>(res: { data: unknown; error: unknown }): T[] {
  if (res.error) {
    console.error('Query error:', res.error);
    return [];
  }
  return (res.data || []) as T[];
}

async function getData() {
  const db = getServiceSupabase();

  // ---- Query 1: Overall stats ----
  const overallRes = await db.rpc('exec_sql', {
    query: `SELECT
              COUNT(*)::int as total_contracts,
              COUNT(DISTINCT supplier_abn)::int as unique_suppliers,
              SUM(contract_value)::bigint as total_value
            FROM austender_contracts
            WHERE contract_value > 0`,
  });
  const overall = safe<{ total_contracts: number; total_value: number; unique_suppliers: number }>(overallRes)[0]
    || { total_contracts: 0, total_value: 0, unique_suppliers: 0 };

  // ---- Query 2: Top 100 concentration ----
  const top100Res = await db.rpc('exec_sql', {
    query: `WITH ranked AS (
              SELECT supplier_abn, SUM(contract_value)::bigint as total
              FROM austender_contracts
              WHERE contract_value > 0 AND supplier_abn IS NOT NULL
              GROUP BY supplier_abn
              ORDER BY total DESC LIMIT 100
            )
            SELECT SUM(total)::bigint as top100_total FROM ranked`,
  });
  const top100 = safe<{ top100_total: number }>(top100Res)[0] || { top100_total: 0 };

  // ---- Query 3: Top 25 supplier ABNs ----
  const topSuppliersRes = await db.rpc('exec_sql', {
    query: `SELECT supplier_abn, SUM(contract_value)::bigint as total, COUNT(*)::int as cnt
            FROM austender_contracts
            WHERE contract_value > 0 AND supplier_abn IS NOT NULL
            GROUP BY supplier_abn
            ORDER BY total DESC LIMIT 25`,
  });
  const topSupplierAbns = safe<{ supplier_abn: string; total: number; cnt: number }>(topSuppliersRes);

  // ---- Query 4: Look up entity names for those ABNs ----
  const abnList = topSupplierAbns.map(s => `'${s.supplier_abn}'`).join(',');
  const entityRes = abnList
    ? await db.rpc('exec_sql', {
        query: `SELECT abn, canonical_name, gs_id FROM gs_entities WHERE abn IN (${abnList})`,
      })
    : { data: [], error: null };
  const entities = safe<{ abn: string; canonical_name: string; gs_id: string }>(entityRes);
  const entityMap = new Map(entities.map(e => [e.abn, e]));

  // ---- Query 5: Donation cross-reference for top 25 ABNs ----
  const donationRes = abnList
    ? await db.rpc('exec_sql', {
        query: `SELECT donor_abn, SUM(amount)::bigint as donated, COUNT(*)::int as donation_count
                FROM political_donations
                WHERE donor_abn IN (${abnList})
                GROUP BY donor_abn`,
      })
    : { data: [], error: null };
  const donations = safe<{ donor_abn: string; donated: number; donation_count: number }>(donationRes);
  const donationMap = new Map(donations.map(d => [d.donor_abn, d]));

  // Build enriched top supplier list
  const topSuppliers: TopSupplier[] = topSupplierAbns.map(s => {
    const entity = entityMap.get(s.supplier_abn);
    const donation = donationMap.get(s.supplier_abn);
    return {
      ...s,
      canonical_name: entity?.canonical_name || null,
      gs_id: entity?.gs_id || null,
      donated: donation?.donated || 0,
      donation_count: donation?.donation_count || 0,
    };
  });

  // ---- Query 6: Top 20 buyers ----
  const buyersRes = await db.rpc('exec_sql', {
    query: `SELECT buyer_name, SUM(contract_value)::bigint as total, COUNT(*)::int as cnt
            FROM austender_contracts
            WHERE contract_value > 0
            GROUP BY buyer_name
            ORDER BY total DESC LIMIT 20`,
  });
  const buyers = safe<Buyer>(buyersRes);

  // ---- Query 7: Size band distribution ----
  const sizeBandRes = await db.rpc('exec_sql', {
    query: `WITH supplier_totals AS (
              SELECT supplier_abn, SUM(contract_value)::bigint as total
              FROM austender_contracts
              WHERE contract_value > 0 AND supplier_abn IS NOT NULL
              GROUP BY supplier_abn
            )
            SELECT
              CASE
                WHEN total >= 1000000000 THEN 'over_1B'
                WHEN total >= 100000000 THEN '100M_1B'
                WHEN total >= 10000000 THEN '10M_100M'
                WHEN total >= 1000000 THEN '1M_10M'
                ELSE 'under_1M'
              END as band,
              COUNT(*)::int as suppliers,
              SUM(total)::bigint as value
            FROM supplier_totals
            GROUP BY band
            ORDER BY value DESC`,
  });
  const sizeBands = safe<SizeBand>(sizeBandRes);

  // ---- Query 8: Year-over-year concentration ----
  const trendRes = await db.rpc('exec_sql', {
    query: `WITH yearly AS (
              SELECT EXTRACT(YEAR FROM contract_start)::int as yr,
                     supplier_abn,
                     SUM(contract_value)::bigint as total
              FROM austender_contracts
              WHERE contract_value > 0 AND contract_start IS NOT NULL
                AND supplier_abn IS NOT NULL
                AND EXTRACT(YEAR FROM contract_start) >= 2018
                AND EXTRACT(YEAR FROM contract_start) <= 2025
              GROUP BY yr, supplier_abn
            ),
            yearly_ranked AS (
              SELECT yr, supplier_abn, total,
                     ROW_NUMBER() OVER(PARTITION BY yr ORDER BY total DESC) as rn
              FROM yearly
            ),
            top100_per_year AS (
              SELECT yr, SUM(total)::bigint as top100_total
              FROM yearly_ranked WHERE rn <= 100 GROUP BY yr
            ),
            all_per_year AS (
              SELECT yr, SUM(total)::bigint as grand_total
              FROM yearly GROUP BY yr
            )
            SELECT a.yr, a.grand_total, t.top100_total,
                   ROUND(t.top100_total * 100.0 / NULLIF(a.grand_total, 0), 1)::float as pct_top100
            FROM all_per_year a JOIN top100_per_year t ON t.yr = a.yr
            ORDER BY a.yr`,
  });
  const trends = safe<YearTrend>(trendRes);

  // ---- Query 9: Top 100 donations by party ----
  const donationPartyRes = await db.rpc('exec_sql', {
    query: `WITH top100abns AS (
              SELECT supplier_abn
              FROM austender_contracts
              WHERE contract_value > 0 AND supplier_abn IS NOT NULL
              GROUP BY supplier_abn
              ORDER BY SUM(contract_value) DESC LIMIT 100
            )
            SELECT pd.donation_to as party,
                   COUNT(DISTINCT t.supplier_abn)::int as top100_donors,
                   SUM(pd.amount)::bigint as total_donated
            FROM top100abns t
            JOIN political_donations pd ON pd.donor_abn = t.supplier_abn
            GROUP BY pd.donation_to
            HAVING SUM(pd.amount) > 50000
            ORDER BY total_donated DESC
            LIMIT 15`,
  });
  const donationTargets = safe<DonationTarget>(donationPartyRes);

  // ---- Query 10: How many top 100 donate + lobby ----
  const crossRes = await db.rpc('exec_sql', {
    query: `WITH top100abns AS (
              SELECT supplier_abn
              FROM austender_contracts
              WHERE contract_value > 0 AND supplier_abn IS NOT NULL
              GROUP BY supplier_abn
              ORDER BY SUM(contract_value) DESC LIMIT 100
            )
            SELECT
              (SELECT COUNT(DISTINCT t.supplier_abn) FROM top100abns t
               INNER JOIN political_donations pd ON pd.donor_abn = t.supplier_abn)::int as donors,
              (SELECT SUM(pd.amount)::bigint FROM top100abns t
               INNER JOIN political_donations pd ON pd.donor_abn = t.supplier_abn) as donated,
              (SELECT COUNT(DISTINCT t.supplier_abn) FROM top100abns t
               INNER JOIN (SELECT DISTINCT ge.abn FROM gs_relationships r
                           JOIN gs_entities ge ON ge.id = r.source_entity_id
                           WHERE r.relationship_type = 'lobbies_for'
                           AND ge.abn IS NOT NULL) l ON l.abn = t.supplier_abn)::int as lobbyists`,
  });
  const cross = safe<{ donors: number; donated: number; lobbyists: number }>(crossRes)[0]
    || { donors: 0, donated: 0, lobbyists: 0 };

  const concentration: Concentration = {
    total_contracts: overall.total_contracts,
    total_value: overall.total_value,
    unique_suppliers: overall.unique_suppliers,
    top100_total: top100.top100_total,
    top100_pct: overall.total_value > 0 ? (top100.top100_total / overall.total_value) * 100 : 0,
    top100_donors: cross.donors,
    top100_donated: cross.donated,
    top100_lobbyists: cross.lobbyists,
  };

  return {
    concentration,
    topSuppliers,
    buyers,
    sizeBands,
    trends,
    donationTargets,
  };
}

const BAND_LABELS: Record<string, string> = {
  over_1B: 'Over $1B',
  '100M_1B': '$100M - $1B',
  '10M_100M': '$10M - $100M',
  '1M_10M': '$1M - $10M',
  under_1M: 'Under $1M',
};

const BAND_ORDER = ['over_1B', '100M_1B', '10M_100M', '1M_10M', 'under_1M'];

function cleanName(name: string | null, abn: string): string {
  if (!name) return `ABN ${abn}`;
  // Trim ABN suffixes like "(32 118 062 258)" from canonical names
  return name.replace(/\s*\(\d{2}\s\d{3}\s\d{3}\s\d{3}\)\s*$/g, '').trim();
}

export default async function ProcurementOligopolyPage() {
  const data = await getData();
  const { concentration: c, topSuppliers, buyers, sizeBands, trends, donationTargets } = data;

  const sortedBands = [...sizeBands].sort(
    (a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band)
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; All Reports
      </Link>

      {/* Hero */}
      <div className="mt-4 mb-8">
        <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-[0.25em] mb-1">Cross-System Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The Procurement Oligopoly
        </h1>
        <p className="text-lg text-bauhaus-muted leading-relaxed max-w-3xl">
          {c.unique_suppliers.toLocaleString()} suppliers compete for federal procurement.{' '}
          <strong className="text-bauhaus-red">100 of them</strong> ({pct(100, c.unique_suppliers)} of all suppliers)
          capture <strong className="text-bauhaus-black">{money(c.top100_total)}</strong> &mdash;{' '}
          <strong className="text-bauhaus-red">{c.top100_pct.toFixed(0)}%</strong> of all spending.
          The rest share what&apos;s left.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-10 border-4 border-bauhaus-black">
        <div className="p-5 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{money(c.total_value)}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Total Procurement</div>
        </div>
        <div className="p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-red">{c.top100_pct.toFixed(0)}%</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Goes to Top 100</div>
        </div>
        <div className="p-5 border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{c.top100_donors}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Top 100 Also Donate</div>
        </div>
        <div className="p-5">
          <div className="text-3xl font-black text-bauhaus-black">{c.top100_lobbyists}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Top 100 Also Lobby</div>
        </div>
      </div>

      {/* The Numbers */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          The Numbers
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Federal government procurement totals <strong className="text-bauhaus-black">{money(c.total_value)}</strong> across{' '}
          {c.total_contracts.toLocaleString()} contracts. {c.unique_suppliers.toLocaleString()} unique
          suppliers have won at least one contract. But the distribution is extreme: 100 suppliers
          capture {c.top100_pct.toFixed(0)}% of all value, while{' '}
          {sortedBands.find(b => b.band === 'under_1M')?.suppliers.toLocaleString() || '42,000'}+ suppliers
          with under $1M in total contracts share just{' '}
          {pct(sortedBands.find(b => b.band === 'under_1M')?.value || 0, c.total_value)} of spending.
        </p>

        {/* Size Pyramid */}
        <div className="border-4 border-bauhaus-black">
          <div className="bg-bauhaus-black text-white px-4 py-3">
            <span className="font-black uppercase tracking-wider text-xs">Supplier Size Pyramid</span>
          </div>
          {sortedBands.map((b, i) => {
            const barWidth = c.total_value > 0 ? Math.max((b.value / c.total_value) * 100, 2) : 0;
            return (
              <div key={b.band} className={`flex items-center gap-4 px-4 py-3 ${i < sortedBands.length - 1 ? 'border-b border-gray-200' : ''}`}>
                <div className="w-28 shrink-0">
                  <div className="text-sm font-bold text-bauhaus-black">{BAND_LABELS[b.band] || b.band}</div>
                  <div className="text-xs text-bauhaus-muted">{b.suppliers.toLocaleString()} suppliers</div>
                </div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-100 w-full">
                    <div
                      className="h-5 bg-bauhaus-red flex items-center justify-end pr-2"
                      style={{ width: `${barWidth}%`, minWidth: barWidth > 5 ? undefined : '40px' }}
                    >
                      {barWidth > 15 && (
                        <span className="text-[10px] font-black text-white uppercase">{pct(b.value, c.total_value)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-20 text-right shrink-0">
                  <span className="font-mono text-sm font-bold text-bauhaus-black">{money(b.value)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top 20 Suppliers */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          The Top 20
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          The 20 largest suppliers by total contract value. Defence contractors dominate, but recruitment,
          construction, IT, and professional services are all represented.{' '}
          {topSuppliers.filter(s => s.donated > 0).length > 0 && (
            <>Of the top 20, <strong className="text-bauhaus-red">{topSuppliers.slice(0, 20).filter(s => s.donated > 0).length}</strong> also make political donations.</>
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs w-8">#</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Supplier</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total Value</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right"># Contracts</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Donated</th>
              </tr>
            </thead>
            <tbody>
              {topSuppliers.slice(0, 20).map((s, i) => {
                const name = cleanName(s.canonical_name, s.supplier_abn);
                return (
                  <tr key={s.supplier_abn} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-bauhaus-muted font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-bold">
                      {s.gs_id ? (
                        <Link href={`/entities/${s.gs_id}`} className="text-bauhaus-black hover:text-bauhaus-red">
                          {name}
                        </Link>
                      ) : (
                        <span className="text-bauhaus-black">{name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{money(s.total)}</td>
                    <td className="px-4 py-3 text-right font-mono text-bauhaus-muted">{s.cnt.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-bold">
                      {s.donated > 0 ? money(s.donated) : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-4 border-bauhaus-black bg-bauhaus-canvas">
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 font-black uppercase tracking-wider text-xs">Top 20 Total</td>
                <td className="px-4 py-3 text-right font-mono font-black">
                  {money(topSuppliers.slice(0, 20).reduce((s, f) => s + f.total, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono text-bauhaus-muted">
                  {topSuppliers.slice(0, 20).reduce((s, f) => s + f.cnt, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-black">
                  {money(topSuppliers.slice(0, 20).reduce((s, f) => s + f.donated, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* The Buyers */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          The Buyers
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Which government departments and agencies spend the most on procurement.{' '}
          {buyers[0] && (
            <>
              <strong className="text-bauhaus-black">{buyers[0].buyer_name}</strong> alone accounts for{' '}
              <strong className="text-bauhaus-black">{money(buyers[0].total)}</strong> &mdash;{' '}
              {pct(buyers[0].total, c.total_value)} of all federal procurement.
            </>
          )}
        </p>
        <div className="space-y-0">
          {buyers.map((b) => {
            const barPct = c.total_value > 0 ? (b.total / c.total_value * 100) : 0;
            return (
              <div key={b.buyer_name} className="flex items-center gap-4 py-2 border-b border-gray-200 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-bauhaus-black truncate">{b.buyer_name}</div>
                  <div className="text-xs text-bauhaus-muted">{b.cnt.toLocaleString()} contracts</div>
                </div>
                <div className="w-32 hidden sm:block">
                  <div className="h-2 bg-gray-100 w-full">
                    <div className="h-2 bg-bauhaus-blue" style={{ width: `${Math.min(barPct * 2, 100)}%` }} />
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-bauhaus-black shrink-0 w-20 text-right">
                  {money(b.total)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* The Influence Pipeline */}
      {donationTargets.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            The Influence Pipeline
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Of the 100 biggest procurement suppliers, <strong className="text-bauhaus-red">{c.top100_donors}</strong> also
            make political donations ({money(c.top100_donated)} total) and{' '}
            <strong className="text-bauhaus-black">{c.top100_lobbyists}</strong> are registered lobbyists.
            Here is where their political money goes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            {donationTargets.map((d, i) => {
              const isLabor = d.party.toLowerCase().includes('labor') || d.party.toLowerCase().includes('progressive');
              const isLiberal = d.party.toLowerCase().includes('liberal') || d.party.toLowerCase().includes('national');
              return (
                <div key={d.party} className={`flex items-center justify-between p-3 border-b border-r border-gray-200 ${i % 2 === 0 ? '' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-bauhaus-black truncate">{d.party}</div>
                    <div className="text-xs text-bauhaus-muted">{d.top100_donors} of top 100 suppliers</div>
                  </div>
                  <span className={`font-mono text-sm font-bold shrink-0 ml-2 ${
                    isLabor ? 'text-red-600' : isLiberal ? 'text-blue-600' : 'text-bauhaus-muted'
                  }`}>
                    {money(d.total_donated)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SME Impact */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-red p-6 bg-red-50">
          <h2 className="text-xl font-black uppercase tracking-widest mb-4">The SME Squeeze</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {(() => {
              const under1M = sortedBands.find(b => b.band === 'under_1M');
              const over1B = sortedBands.find(b => b.band === 'over_1B');
              const mid = sortedBands.find(b => b.band === '1M_10M');
              return (
                <>
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">The Bottom</div>
                    <div className="text-2xl font-black text-bauhaus-black mb-1">
                      {under1M ? under1M.suppliers.toLocaleString() : '42,000'}+
                    </div>
                    <p className="text-sm text-bauhaus-black font-medium">
                      Suppliers with under $1M in total contracts share just{' '}
                      <strong>{under1M ? pct(under1M.value, c.total_value) : '0.6%'}</strong> of procurement.
                      They are {under1M ? pct(under1M.suppliers, c.unique_suppliers) : '76%'} of all suppliers.
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">The Middle</div>
                    <div className="text-2xl font-black text-bauhaus-black mb-1">
                      {mid ? mid.suppliers.toLocaleString() : '9,000'}
                    </div>
                    <p className="text-sm text-bauhaus-black font-medium">
                      Suppliers in the $1M&ndash;$10M band. Many are genuine SMEs.
                      Together they hold {mid ? pct(mid.value, c.total_value) : '2.7%'} of total value.
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">The Top</div>
                    <div className="text-2xl font-black text-bauhaus-black mb-1">
                      {over1B ? over1B.suppliers.toLocaleString() : '147'}
                    </div>
                    <p className="text-sm text-bauhaus-black font-medium">
                      Suppliers with over $1B each in total contracts.
                      They hold <strong>{over1B ? pct(over1B.value, c.total_value) : '64%'}</strong> of all procurement value.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Year-over-Year Trends */}
      {trends.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            Year-over-Year Concentration
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            What share of each year&apos;s procurement goes to the top 100 suppliers in that year.
            Concentration fluctuates with large one-off contracts but consistently stays above 55%.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Year</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total Spend</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Top 100 Share</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Concentration</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t, i) => (
                  <tr key={t.yr} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-bold font-mono">{t.yr}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{money(t.grand_total)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-bauhaus-red">{t.pct_top100}%</td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-gray-100 w-full max-w-48">
                        <div
                          className={`h-4 ${t.pct_top100 >= 80 ? 'bg-bauhaus-red' : t.pct_top100 >= 65 ? 'bg-bauhaus-yellow' : 'bg-bauhaus-blue'}`}
                          style={{ width: `${t.pct_top100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* The Pattern */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6">
          <h2 className="text-xl font-black uppercase tracking-widest mb-4 text-white">The System</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Concentration</div>
              <p className="text-sm text-white/80 font-medium">
                {c.unique_suppliers.toLocaleString()} suppliers, but 100 capture {c.top100_pct.toFixed(0)}%.
                The top {sortedBands.find(b => b.band === 'over_1B')?.suppliers || 147} firms (&gt;$1B each)
                hold {pct(sortedBands.find(b => b.band === 'over_1B')?.value || 0, c.total_value)} of all value.
              </p>
            </div>
            <div>
              <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Influence</div>
              <p className="text-sm text-white/80 font-medium">
                {c.top100_donors} of the top 100 suppliers donate to political parties ({money(c.top100_donated)}).
                {c.top100_lobbyists > 0 && <> {c.top100_lobbyists} are registered lobbyists.</>}
                {' '}They win contracts from the governments they fund.
              </p>
            </div>
            <div>
              <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Exclusion</div>
              <p className="text-sm text-white/80 font-medium">
                {sortedBands.find(b => b.band === 'under_1M')?.suppliers.toLocaleString() || '42,000'}+ small
                suppliers share {pct(sortedBands.find(b => b.band === 'under_1M')?.value || 0, c.total_value)} of
                procurement. Limited tendering ({pct(409859288810, c.total_value)} of value) bypasses open competition.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explore */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Explore the Top Suppliers
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Click any supplier to see their full CivicGraph profile &mdash; every contract, every donation,
          every board member, every lobbying connection.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {topSuppliers.slice(0, 20).filter(s => s.gs_id).map((s) => (
            <Link key={s.supplier_abn} href={`/entities/${s.gs_id}`}
                  className="border-4 border-bauhaus-black p-4 hover:bg-bauhaus-canvas transition-colors group">
              <div className="font-black text-sm group-hover:text-bauhaus-red leading-tight">
                {cleanName(s.canonical_name, s.supplier_abn)}
              </div>
              <div className="text-sm font-mono font-bold mt-1">{money(s.total)}</div>
              <div className="text-[10px] text-bauhaus-muted font-black uppercase tracking-widest mt-1">
                {s.cnt.toLocaleString()} contracts
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Related Investigations */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Related Investigations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/reports/consulting-class" className="border-4 border-bauhaus-black p-5 hover:bg-bauhaus-canvas transition-colors group">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-1">Cross-System Investigation</div>
            <div className="font-black text-lg group-hover:text-bauhaus-red">The Consulting Class</div>
            <p className="text-sm text-bauhaus-muted mt-1">Seven firms that advise on policy then win the implementation contracts.</p>
          </Link>
          <Link href="/reports/donor-contractors" className="border-4 border-bauhaus-black p-5 hover:bg-bauhaus-canvas transition-colors group">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-1">Entity Graph Investigation</div>
            <div className="font-black text-lg group-hover:text-bauhaus-red">Donate. Win Contracts. Repeat.</div>
            <p className="text-sm text-bauhaus-muted mt-1">446 entities that donate to political parties AND hold government contracts.</p>
          </Link>
          <Link href="/reports/triple-play" className="border-4 border-bauhaus-black p-5 hover:bg-bauhaus-canvas transition-colors group">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-1">Cross-Dataset Investigation</div>
            <div className="font-black text-lg group-hover:text-bauhaus-red">Donate. Lobby. Win. Pay No Tax.</div>
            <p className="text-sm text-bauhaus-muted mt-1">The Triple Play: donate, lobby, win contracts, pay minimal tax.</p>
          </Link>
          <Link href="/reports/power-concentration" className="border-4 border-bauhaus-black p-5 hover:bg-bauhaus-canvas transition-colors group">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-1">Cross-System Investigation</div>
            <div className="font-black text-lg group-hover:text-bauhaus-red">Cross-System Power Concentration</div>
            <p className="text-sm text-bauhaus-muted mt-1">82,967 entities scored across 7 public datasets.</p>
          </Link>
        </div>
      </section>

      {/* Data Sources */}
      <section className="mb-8">
        <div className="bg-bauhaus-canvas p-4">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2">Methodology &amp; Data Sources</h3>
          <ul className="text-xs text-bauhaus-muted space-y-1">
            <li><strong>AusTender</strong> &mdash; {c.total_contracts.toLocaleString()} federal procurement contracts, all available years</li>
            <li><strong>AEC</strong> &mdash; Australian Electoral Commission political donation disclosures</li>
            <li><strong>Australian Government Register of Lobbyists</strong> &mdash; registered lobbying relationships</li>
            <li><strong>ABR</strong> &mdash; Australian Business Register for entity matching</li>
          </ul>
          <p className="text-[10px] text-bauhaus-muted mt-3">
            Concentration is calculated by ranking all unique suppliers (by ABN) by total contract value.
            &ldquo;Top 100&rdquo; refers to the 100 ABNs with the highest cumulative contract value across all years.
            Cross-system matching performed by CivicGraph via ABN linkage.
            Some entities operate under multiple ABNs; each ABN is counted separately.
            This is a living investigation &mdash; data updates as new contracts are published.
          </p>
        </div>
      </section>
    </div>
  );
}
