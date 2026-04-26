import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { ReportEmailCapture } from '@/components/report-email-capture';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'The Double-Dippers — CivicGraph',
  description:
    '4,218 entities receive both Australian government grants AND government contracts. Combined: $678 billion in public funding across two separate channels. Who they are, what they get, and which are community-controlled.',
  openGraph: {
    title: 'The Double-Dippers',
    description: '4,218 entities · $678B in combined public funding via grants + contracts. CivicGraph cross-channel investigation.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: { card: 'summary_large_image', title: 'The Double-Dippers — $678B across grants + contracts' },
};

function money(n: number | null | undefined): string {
  if (n == null || n === 0) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

type Row = {
  abn: string;
  recipient_name: string | null;
  supplier_name: string | null;
  grant_count: number;
  grant_total: number;
  contract_count: number;
  contract_total: number;
  combined_public_funding: number;
  funding_profile: string;
  gs_id: string | null;
  entity_type: string | null;
  state: string | null;
  is_community_controlled: boolean | null;
};

async function getData() {
  const db = getServiceSupabase();

  const [{ data: top }, { data: indigenous }, { data: profileBreakdown }, { data: stats }] = await Promise.all([
    db.from('mv_grant_contract_overlap')
      .select('*')
      .order('combined_public_funding', { ascending: false })
      .limit(30),
    db.from('mv_grant_contract_overlap')
      .select('*')
      .eq('is_community_controlled', true)
      .order('combined_public_funding', { ascending: false })
      .limit(20),
    db.rpc('exec_sql', {
      query: `SELECT funding_profile, COUNT(*) as count,
                     SUM(grant_total)::bigint as grants,
                     SUM(contract_total)::bigint as contracts,
                     SUM(combined_public_funding)::bigint as combined
                FROM mv_grant_contract_overlap
               GROUP BY funding_profile ORDER BY combined DESC`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total,
                     SUM(grant_total)::bigint as total_grants,
                     SUM(contract_total)::bigint as total_contracts,
                     SUM(combined_public_funding)::bigint as combined,
                     COUNT(*) FILTER (WHERE is_community_controlled) as cc_count
                FROM mv_grant_contract_overlap`,
    }),
  ]);

  return {
    top: (top ?? []) as Row[],
    indigenous: (indigenous ?? []) as Row[],
    profileBreakdown: (profileBreakdown ?? []) as Array<{ funding_profile: string; count: number; grants: number; contracts: number; combined: number }>,
    stats: ((stats ?? []) as Array<{ total: number; total_grants: number; total_contracts: number; combined: number; cc_count: number }>)[0],
  };
}

export default async function DoubleDippersPage() {
  const data = await getData();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; All Reports
      </Link>

      {/* Hero */}
      <div className="mt-6 mb-8">
        <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-[0.25em] mb-1">Cross-Channel Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">The Double-Dippers</h1>
        <p className="text-lg text-bauhaus-muted leading-relaxed max-w-3xl">
          <strong className="text-bauhaus-red">{data.stats?.total?.toLocaleString()}</strong> Australian
          entities receive both government grants AND government contracts. Two separate funding channels,
          one combined relationship with the public purse — totalling{' '}
          <strong className="text-bauhaus-black">{money(data.stats?.combined)}</strong> across the dataset.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-10 border-4 border-bauhaus-black">
        <div className="p-5 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{data.stats?.total?.toLocaleString()}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Cross-channel entities</div>
        </div>
        <div className="p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{money(data.stats?.total_grants)}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">In grants received</div>
        </div>
        <div className="p-5 border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{money(data.stats?.total_contracts)}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">In contracts won</div>
        </div>
        <div className="p-5">
          <div className="text-3xl font-black text-bauhaus-red">{data.stats?.cc_count}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Community-controlled</div>
        </div>
      </div>

      {/* Profile breakdown */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Funding profile breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-4 border-bauhaus-black">
          {data.profileBreakdown.map((p, i) => (
            <div key={p.funding_profile} className={`p-5 ${i < data.profileBreakdown.length - 1 ? 'border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black' : ''}`}>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-2">
                {p.funding_profile.replace('_', ' ')}
              </div>
              <div className="text-3xl font-black text-bauhaus-black">{p.count.toLocaleString()}</div>
              <div className="text-xs text-bauhaus-muted font-medium mt-1">entities</div>
              <div className="text-sm text-bauhaus-black mt-3">
                <span className="font-mono font-bold">{money(p.combined)}</span> combined
              </div>
              <div className="text-[11px] text-bauhaus-muted mt-1">
                {money(p.grants)} grants · {money(p.contracts)} contracts
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-bauhaus-muted mt-3">
          <strong>Contract-heavy:</strong> contracts &gt; grants. <strong>Grant-heavy:</strong> grants &gt; contracts.
          <strong> Balanced:</strong> close to equal across both channels.
        </p>
      </section>

      {/* Top 30 */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Top 30 entities by combined public funding
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Entity</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Grants</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Contracts</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Combined</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Profile</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((r, i) => (
                <tr key={r.abn} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}>
                  <td className="px-4 py-3 font-medium text-bauhaus-black max-w-xs">
                    {r.gs_id ? (
                      <Link href={`/entities/${encodeURIComponent(r.gs_id)}`} className="font-bold hover:text-bauhaus-red">
                        {r.recipient_name || r.supplier_name}
                      </Link>
                    ) : (
                      <span>{r.recipient_name || r.supplier_name}</span>
                    )}
                    {r.is_community_controlled && (
                      <span className="ml-2 border border-bauhaus-red px-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-red">CC</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-bauhaus-muted">{r.state ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(r.grant_total)}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(r.contract_total)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{money(r.combined_public_funding)}</td>
                  <td className="px-4 py-3 text-[10px] uppercase tracking-widest text-bauhaus-muted">{r.funding_profile.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Indigenous double-dippers */}
      {data.indigenous.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            Top community-controlled double-dippers
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Indigenous-led organisations that successfully draw public funding from BOTH grants and
            contracts. Some of the strongest examples of community-controlled enterprise capability
            recognised by both channels.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Entity</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Grants</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Contracts</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Combined</th>
                </tr>
              </thead>
              <tbody>
                {data.indigenous.map((r, i) => (
                  <tr key={r.abn} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}>
                    <td className="px-4 py-3 font-medium text-bauhaus-black max-w-xs">
                      {r.gs_id ? (
                        <Link href={`/entities/${encodeURIComponent(r.gs_id)}`} className="font-bold hover:text-bauhaus-red">
                          {r.recipient_name || r.supplier_name}
                        </Link>
                      ) : (
                        <span>{r.recipient_name || r.supplier_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-bauhaus-muted">{r.state ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(r.grant_total)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(r.contract_total)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{money(r.combined_public_funding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ReportEmailCapture
        reportSlug="double-dippers"
        source="report-double-dippers"
        headline="Get the next investigation when it drops"
        description="The Double-Dippers is one of several cross-system investigations from the CivicGraph atlas. Subscribe for the next one — IPP scoreboard updates, consulting class deep-dives, and where philanthropic money actually flows."
      />

      {/* Methodology */}
      <section className="mb-8">
        <div className="bg-bauhaus-canvas p-4">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2">Methodology</h3>
          <ul className="text-xs text-bauhaus-muted space-y-1">
            <li><strong>Source:</strong> Inner-join of <code>justice_funding</code> (71K grant records) and <code>austender_contracts</code> (770K contracts) by ABN. Only entities present in BOTH sets appear.</li>
            <li><strong>Grants:</strong> federal + state government grant disbursements from the justice_funding dataset (broader than just justice — covers all flagged government funding).</li>
            <li><strong>Contracts:</strong> AusTender procurement contracts, federal + state.</li>
            <li><strong>Funding profile:</strong> contract_heavy (contracts &gt; grants), grant_heavy (grants &gt; contracts), balanced (close to equal).</li>
            <li><strong>Limitations:</strong> some entities may use multiple ABNs (e.g. parent + subsidiaries) and appear as separate rows. Time-windowed crossover analysis (donation in year Y → contract in year Y+1) is in <code>mv_donation_contract_timing</code>, not here.</li>
            <li><strong>Source MV:</strong> <code>mv_grant_contract_overlap</code> (4,218 rows).</li>
          </ul>
          <p className="text-[10px] text-bauhaus-muted mt-3">
            All data sourced from public records. Last updated: April 2026.
          </p>
        </div>
      </section>
    </div>
  );
}
