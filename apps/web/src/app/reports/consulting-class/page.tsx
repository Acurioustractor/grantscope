import Link from 'next/link';
import { getServiceSupabase } from '@/lib/report-supabase';

export const revalidate = 3600;

const FIRMS = [
  'KPMG', 'Deloitte', 'PricewaterhouseCoopers', 'PwC',
  'Ernst%Young', 'Accenture', 'McKinsey', 'Boston Consulting',
];
const FIRM_PATTERN = FIRMS.map(f => `'%${f}%'`).join(',');

function money(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

type Firm = {
  name: string;
  gs_id: string;
  contracts: number;
  contract_count: number;
  donated: number;
  donation_count: number;
  distinct_buyers: number;
};

type Buyer = {
  buyer_name: string;
  total: number;
  contracts: number;
  firms_used: number;
};

type DonationTarget = {
  party: string;
  total: number;
  donations: number;
  firms: number;
};

type LobbyLink = {
  firm: string;
  firm_gs_id: string;
  lobbies_for: string;
  target_gs_id: string;
};

async function getData() {
  const db = getServiceSupabase();

  const [firmsRes, buyersRes, donationsRes, lobbyRes, concentrationRes] = await Promise.all([
    db.rpc('exec_sql', {
      query: `SELECT ge.canonical_name as name, ge.gs_id,
                COALESCE(c.contracts, 0)::bigint as contracts,
                COALESCE(c.contract_count, 0)::int as contract_count,
                COALESCE(d.donated, 0)::bigint as donated,
                COALESCE(d.donation_count, 0)::int as donation_count,
                COALESCE(c.distinct_buyers, 0)::int as distinct_buyers
              FROM gs_entities ge
              LEFT JOIN (
                SELECT supplier_abn, SUM(contract_value)::bigint as contracts, COUNT(*) as contract_count,
                       COUNT(DISTINCT buyer_name)::int as distinct_buyers
                FROM austender_contracts GROUP BY supplier_abn
              ) c ON c.supplier_abn = ge.abn
              LEFT JOIN (
                SELECT donor_abn, SUM(amount)::bigint as donated, COUNT(*) as donation_count
                FROM political_donations GROUP BY donor_abn
              ) d ON d.donor_abn = ge.abn
              WHERE ge.canonical_name ILIKE ANY(ARRAY[${FIRM_PATTERN}])
                AND ge.entity_type = 'company'
                AND COALESCE(c.contracts, 0) > 5000000
              ORDER BY contracts DESC`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT ac.buyer_name,
                SUM(ac.contract_value)::bigint as total,
                COUNT(*)::int as contracts,
                COUNT(DISTINCT ac.supplier_abn)::int as firms_used
              FROM austender_contracts ac
              JOIN gs_entities ge ON ge.abn = ac.supplier_abn
              WHERE ge.canonical_name ILIKE ANY(ARRAY[${FIRM_PATTERN}])
                AND ge.entity_type = 'company'
              GROUP BY ac.buyer_name
              ORDER BY total DESC
              LIMIT 20`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT pd.donation_to as party,
                SUM(pd.amount)::bigint as total,
                COUNT(*)::int as donations,
                COUNT(DISTINCT ge.canonical_name)::int as firms
              FROM political_donations pd
              JOIN gs_entities ge ON ge.abn = pd.donor_abn
              WHERE ge.canonical_name ILIKE ANY(ARRAY[${FIRM_PATTERN}])
                AND ge.entity_type = 'company'
              GROUP BY pd.donation_to
              HAVING SUM(pd.amount) > 50000
              ORDER BY total DESC
              LIMIT 20`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT ge.canonical_name as firm, ge.gs_id as firm_gs_id,
                t.canonical_name as lobbies_for, t.gs_id as target_gs_id
              FROM gs_relationships r
              JOIN gs_entities ge ON ge.id = r.source_entity_id
              JOIN gs_entities t ON t.id = r.target_entity_id
              WHERE r.relationship_type = 'lobbies_for'
                AND ge.canonical_name ILIKE ANY(ARRAY[${FIRM_PATTERN}])`,
    }),
    db.rpc('exec_sql', {
      query: `WITH consulting AS (
                SELECT SUM(ac.contract_value)::bigint as consulting_total
                FROM austender_contracts ac
                JOIN gs_entities ge ON ge.abn = ac.supplier_abn
                WHERE ge.canonical_name ILIKE ANY(ARRAY[${FIRM_PATTERN}])
                  AND ge.entity_type = 'company'
              ),
              all_contracts AS (
                SELECT SUM(contract_value)::bigint as grand_total,
                       COUNT(DISTINCT supplier_abn)::int as total_suppliers
                FROM austender_contracts WHERE contract_value > 0
              )
              SELECT c.consulting_total, a.grand_total, a.total_suppliers
              FROM consulting c, all_contracts a`,
    }),
  ]);

  const firms = ((firmsRes.data || []) as Firm[]);
  // Consolidate firms by canonical name prefix (merge KPMG entities, Deloitte entities etc)
  const firmMap = new Map<string, Firm>();
  for (const f of firms) {
    const key = f.name.includes('KPMG') ? 'KPMG' :
                f.name.includes('Deloitte') || f.name.includes('DELOITTE') ? 'Deloitte' :
                f.name.includes('PricewaterhouseCoopers') || f.name.includes('PRICEWATERHOUSECOOPERS') || f.name.includes('PwC') ? 'PwC' :
                f.name.includes('Ernst') || f.name.includes('ERNST') ? 'EY' :
                f.name.includes('Accenture') || f.name.includes('ACCENTURE') ? 'Accenture' :
                f.name.includes('McKinsey') || f.name.includes('MCKINSEY') ? 'McKinsey' :
                f.name.includes('Boston') || f.name.includes('BOSTON') ? 'BCG' :
                f.name;
    const existing = firmMap.get(key);
    if (!existing || f.contracts > existing.contracts) {
      firmMap.set(key, { ...f, name: key, contracts: (existing?.contracts ?? 0) + f.contracts, contract_count: (existing?.contract_count ?? 0) + f.contract_count, donated: (existing?.donated ?? 0) + f.donated, donation_count: (existing?.donation_count ?? 0) + f.donation_count, distinct_buyers: Math.max(existing?.distinct_buyers ?? 0, f.distinct_buyers) });
    }
  }
  const consolidatedFirms = Array.from(firmMap.values()).sort((a, b) => b.contracts - a.contracts);

  const totalContracts = consolidatedFirms.reduce((s, f) => s + f.contracts, 0);
  const totalDonated = consolidatedFirms.reduce((s, f) => s + f.donated, 0);
  const roi = totalDonated > 0 ? Math.round(totalContracts / totalDonated) : 0;

  const concentration = ((concentrationRes.data || []) as Array<{ consulting_total: number; grand_total: number; total_suppliers: number }>)[0];
  const pctOfProcurement = concentration ? ((concentration.consulting_total / concentration.grand_total) * 100).toFixed(1) : '0';

  return {
    firms: consolidatedFirms,
    totalContracts,
    totalDonated,
    roi,
    pctOfProcurement,
    buyers: (buyersRes.data || []) as Buyer[],
    donations: (donationsRes.data || []) as DonationTarget[],
    lobbying: (lobbyRes.data || []) as LobbyLink[],
  };
}

export default async function ConsultingClassPage() {
  const data = await getData();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; All Reports
      </Link>

      <div className="mt-4 mb-8">
        <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-[0.25em] mb-1">Cross-System Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The Consulting Class
        </h1>
        <p className="text-lg text-bauhaus-muted leading-relaxed max-w-3xl">
          Seven firms have extracted <strong className="text-bauhaus-black">{money(data.totalContracts)}</strong> in government contracts
          while donating <strong className="text-bauhaus-red">{money(data.totalDonated)}</strong> to political parties.
          They advise on policy, then win the implementation contracts for the policies they recommended.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-10 border-4 border-bauhaus-black">
        <div className="p-5 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{money(data.totalContracts)}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Total Contracts</div>
        </div>
        <div className="p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-red">{money(data.totalDonated)}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Political Donations</div>
        </div>
        <div className="p-5 border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{data.roi}:1</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Return on Donation</div>
        </div>
        <div className="p-5">
          <div className="text-3xl font-black text-bauhaus-black">{data.pctOfProcurement}%</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Of All Procurement</div>
        </div>
      </div>

      {/* Per-Firm Breakdown */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          The Seven Firms
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Firm</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Contracts</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right"># Contracts</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Donated</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Depts Served</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.firms.map((f, i) => (
                <tr key={f.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-bold">
                    <Link href={`/entities/${f.gs_id}`} className="text-bauhaus-black hover:text-bauhaus-red">
                      {f.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{money(f.contracts)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bauhaus-muted">{f.contract_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-bold">{f.donated > 0 ? money(f.donated) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{f.distinct_buyers}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {f.donated > 0 ? `${Math.round(f.contracts / f.donated)}:1` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-4 border-bauhaus-black bg-bauhaus-canvas">
                <td className="px-4 py-3 font-black uppercase tracking-wider text-xs">Total</td>
                <td className="px-4 py-3 text-right font-mono font-black">{money(data.totalContracts)}</td>
                <td className="px-4 py-3 text-right font-mono text-bauhaus-muted">{data.firms.reduce((s, f) => s + f.contract_count, 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-black">{money(data.totalDonated)}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right font-mono font-black">{data.roi}:1</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Who Buys */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Who Buys — Top 20 Government Clients
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Defence alone accounts for {money(data.buyers[0]?.total)} in consulting contracts. The same firms advise on policy, design programs, and then win the contracts to implement them.
        </p>
        <div className="space-y-0">
          {data.buyers.map((b) => {
            const pct = data.totalContracts > 0 ? (b.total / data.totalContracts * 100) : 0;
            return (
              <div key={b.buyer_name} className="flex items-center gap-4 py-2 border-b border-gray-200 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-bauhaus-black truncate">{b.buyer_name}</div>
                  <div className="text-xs text-bauhaus-muted">{b.contracts} contracts · {b.firms_used} firms</div>
                </div>
                <div className="w-32 hidden sm:block">
                  <div className="h-2 bg-gray-100 w-full">
                    <div className="h-2 bg-bauhaus-red" style={{ width: `${Math.min(pct * 3, 100)}%` }} />
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

      {/* Where the Donations Go */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Where the Donations Go
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Every major consulting firm donates to both sides. The Business Council of Australia — the peak lobby group for big business — receives more than any political party.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
          {data.donations.map((d, i) => {
            const isLabor = d.party.toLowerCase().includes('labor') || d.party.toLowerCase().includes('progressive');
            const isLiberal = d.party.toLowerCase().includes('liberal') || d.party.toLowerCase().includes('national');
            const isBCA = d.party.toLowerCase().includes('business council') || d.party.toLowerCase().includes('minerals council');
            return (
              <div key={d.party} className={`flex items-center justify-between p-3 border-b border-r border-gray-200 ${i % 2 === 0 ? '' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-bauhaus-black truncate">{d.party}</div>
                  <div className="text-xs text-bauhaus-muted">{d.donations} donations · {d.firms} firms</div>
                </div>
                <span className={`font-mono text-sm font-bold shrink-0 ml-2 ${
                  isBCA ? 'text-bauhaus-black' : isLabor ? 'text-red-600' : isLiberal ? 'text-blue-600' : 'text-bauhaus-muted'
                }`}>
                  {money(d.total)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lobbying Connections */}
      {data.lobbying.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            Registered Lobbyists
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            In addition to direct political donations, these firms maintain registered lobbying connections — professional influence infrastructure.
          </p>
          <div className="space-y-2">
            {data.lobbying.map((l, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border-2 border-bauhaus-black">
                <Link href={`/entities/${l.firm_gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-red">{l.firm}</Link>
                <span className="text-bauhaus-muted">&rarr;</span>
                <Link href={`/entities/${l.target_gs_id}`} className="font-bold text-bauhaus-blue hover:underline">{l.lobbies_for}</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The Pattern */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-red p-6 bg-red-50">
          <h2 className="text-xl font-black uppercase tracking-widest mb-4">The Pattern</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">Step 1: Donate</div>
              <p className="text-sm text-bauhaus-black font-medium">
                Contribute to both major parties, peak business lobbies, and state branches. {money(data.totalDonated)} across {data.firms.reduce((s, f) => s + f.donation_count, 0)} donations.
              </p>
            </div>
            <div>
              <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">Step 2: Advise</div>
              <p className="text-sm text-bauhaus-black font-medium">
                Win advisory contracts to design policy, review programs, and recommend restructures. The advice shapes what gets built.
              </p>
            </div>
            <div>
              <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">Step 3: Implement</div>
              <p className="text-sm text-bauhaus-black font-medium">
                Win the implementation contracts for the policies you recommended. {money(data.totalContracts)} across {data.firms.reduce((s, f) => s + f.contract_count, 0).toLocaleString()} contracts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explore */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Explore Each Firm
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Click any firm to see their full CivicGraph profile — every contract, every donation, every board member, every lobbying connection.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.firms.map((f) => (
            <Link key={f.name} href={`/entities/${f.gs_id}`}
                  className="border-4 border-bauhaus-black p-4 hover:bg-bauhaus-canvas transition-colors group">
              <div className="font-black text-lg group-hover:text-bauhaus-red">{f.name}</div>
              <div className="text-sm font-mono font-bold mt-1">{money(f.contracts)}</div>
              <div className="text-[10px] text-bauhaus-muted font-black uppercase tracking-widest mt-1">
                {f.contract_count.toLocaleString()} contracts
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Data Sources */}
      <section className="mb-8">
        <div className="bg-bauhaus-canvas p-4">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2">Data Sources</h3>
          <ul className="text-xs text-bauhaus-muted space-y-1">
            <li>AusTender — Federal procurement contracts (all years)</li>
            <li>AEC — Australian Electoral Commission political donation disclosures</li>
            <li>Australian Government Register of Lobbyists</li>
            <li>ACNC — Australian Charities and Not-for-profits Commission</li>
          </ul>
          <p className="text-[10px] text-bauhaus-muted mt-3">
            This is a living investigation. All data is sourced from public datasets. Cross-system entity linkage performed by CivicGraph via ABN matching.
          </p>
        </div>
      </section>
    </div>
  );
}
