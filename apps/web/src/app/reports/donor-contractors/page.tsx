import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import Link from 'next/link';
import { DatasetEmailGate, ShareButtons } from './report-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Donate. Win Contracts. Repeat. | CivicGraph Investigation',
  description: 'Live analysis: Australian entities that donate to political parties AND hold government contracts. Cross-referenced by ABN across AEC and AusTender data.',
  openGraph: {
    title: 'Donate. Win Contracts. Repeat.',
    description: 'Live donor-contractor analysis from CivicGraph — cross-referenced by ABN across AEC political donations and AusTender contract data.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Donate. Win Contracts. Repeat.',
    description: 'Live donor-contractor analysis from CivicGraph, showing entities that both donate to political parties and hold government contracts.',
  },
};

import { money, fmt } from '@/lib/format';

interface DonorContractor {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string;
  total_donated: string;
  donation_count: number;
  parties_donated_to: string[];
  donation_years: number[];
  total_contract_value: string;
  contract_count: number;
  government_buyers: string[];
  contract_years: number[];
}

async function getData() {
  const supabase = getServiceSupabase();

  const [
    { data: donorContractors },
    { count: totalEntities },
    { count: totalRels },
    { count: totalDonations },
    { count: totalContracts },
  ] = await Promise.all([
    supabase.from('mv_gs_donor_contractors').select('*').order('total_donated', { ascending: false }),
    supabase.from('gs_entities').select('*', { count: 'exact', head: true }),
    supabase.from('gs_relationships').select('*', { count: 'exact', head: true }),
    supabase.from('gs_relationships').select('*', { count: 'exact', head: true }).eq('relationship_type', 'donation'),
    supabase.from('gs_relationships').select('*', { count: 'exact', head: true }).eq('relationship_type', 'contract'),
  ]);

  const all = (donorContractors || []) as DonorContractor[];

  // Aggregate stats
  let sumDonated = 0, sumContracts = 0, totalDonationRecords = 0, totalContractRecords = 0;
  const allParties = new Set<string>();
  const allBuyers = new Set<string>();
  const yearSpan = { minDonation: Infinity, maxDonation: 0, minContract: Infinity, maxContract: 0 };

  for (const dc of all) {
    sumDonated += Number(dc.total_donated);
    sumContracts += Number(dc.total_contract_value);
    totalDonationRecords += dc.donation_count;
    totalContractRecords += dc.contract_count;
    for (const p of dc.parties_donated_to) allParties.add(p);
    for (const b of dc.government_buyers) allBuyers.add(b);
    for (const y of dc.donation_years) {
      if (y > 1900 && y < yearSpan.minDonation) yearSpan.minDonation = y;
      if (y > yearSpan.maxDonation) yearSpan.maxDonation = y;
    }
    for (const y of dc.contract_years) {
      if (y > 1900 && y < yearSpan.minContract) yearSpan.minContract = y;
      if (y > yearSpan.maxContract) yearSpan.maxContract = y;
    }
  }

  // Top by contract value (different ranking)
  const byContractValue = [...all].sort((a, b) => Number(b.total_contract_value) - Number(a.total_contract_value));

  // Party distribution — how many donor-contractors donate to each party
  const partyDonorCounts: Record<string, { count: number; totalDonated: number }> = {};
  for (const dc of all) {
    for (const party of dc.parties_donated_to) {
      if (!partyDonorCounts[party]) partyDonorCounts[party] = { count: 0, totalDonated: 0 };
      partyDonorCounts[party].count++;
    }
  }
  // We don't have per-party amounts from the MV, so just count entities
  const topParties = Object.entries(partyDonorCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  // Buyer distribution
  const buyerCounts: Record<string, number> = {};
  for (const dc of all) {
    for (const buyer of dc.government_buyers) {
      buyerCounts[buyer] = (buyerCounts[buyer] || 0) + 1;
    }
  }
  const topBuyers = Object.entries(buyerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Both-sides donors (donate to both major parties)
  const laborKeywords = ['Labor', 'ALP'];
  const liberalKeywords = ['Liberal', 'LNP', 'National Party'];
  const bothSides = all.filter(dc => {
    const hasLabor = dc.parties_donated_to.some(p => laborKeywords.some(k => p.includes(k)));
    const hasLiberal = dc.parties_donated_to.some(p => liberalKeywords.some(k => p.includes(k)));
    return hasLabor && hasLiberal;
  });

  return {
    all,
    byContractValue,
    topParties,
    topBuyers,
    bothSides,
    stats: {
      count: all.length,
      sumDonated,
      sumContracts,
      totalDonationRecords,
      totalContractRecords,
      uniqueParties: allParties.size,
      uniqueBuyers: allBuyers.size,
      yearSpan,
    },
    graphStats: {
      totalEntities: totalEntities || 0,
      totalRels: totalRels || 0,
      totalDonations: totalDonations || 0,
      totalContracts: totalContracts || 0,
    },
  };
}

export default async function DonorContractorsReport() {
  const d = await getData();
  const s = d.stats;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Live Entity Graph Analysis</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Donate. Win Contracts. Repeat.
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {s.count} entities in Australia donate to political parties AND hold government contracts.
          Together they donated {money(s.sumDonated)} to {s.uniqueParties} political parties
          and received {money(s.sumContracts)} in government contracts from {s.uniqueBuyers} departments.
          This is what the connected data reveals.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ShareButtons title="Donate. Win Contracts. Repeat." entityCount={s.count} />
          <span className="text-xs text-bauhaus-muted font-bold">
            Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Donated to Parties</div>
            <div className="text-4xl sm:text-5xl font-black">{money(s.sumDonated)}</div>
            <div className="text-white/60 text-sm font-bold mt-2">{fmt(s.totalDonationRecords)} donation records</div>
            <div className="text-white/40 text-xs font-bold mt-1">{s.yearSpan.minDonation}–{s.yearSpan.maxDonation}</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Received in Contracts</div>
            <div className="text-4xl sm:text-5xl font-black">{money(s.sumContracts)}</div>
            <div className="text-white/60 text-sm font-bold mt-2">{fmt(s.totalContractRecords)} government contracts</div>
            <div className="text-white/40 text-xs font-bold mt-1">from {s.uniqueBuyers} departments</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Return on Donation</div>
            <div className="text-4xl sm:text-5xl font-black text-bauhaus-red">
              {s.sumDonated > 0 ? `${Math.round(s.sumContracts / s.sumDonated)}x` : '—'}
            </div>
            <div className="text-bauhaus-muted text-sm font-bold mt-2">contract value per dollar donated</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-1">correlation, not causation</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: {fmt(d.graphStats.totalEntities)} entities and {fmt(d.graphStats.totalRels)} relationships
            in the CivicGraph Entity Graph. AEC political donations cross-referenced with AusTender contracts by ABN.
          </p>
        </div>
      </section>

      {/* Both-sides donors */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Hedging Their Bets</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {d.bothSides.length} of {s.count} donor-contractors donate to BOTH Labor and Liberal/National parties.
          These entities maintain relationships across the political spectrum — regardless of who governs,
          the contracts keep flowing.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Parties</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Depts</th>
              </tr>
            </thead>
            <tbody>
              {d.bothSides.slice(0, 30).map((dc, i) => (
                <tr key={dc.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3">
                    <Link href={`/entities/${dc.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{dc.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted font-mono">ABN {dc.abn}</div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(Number(dc.total_donated))}</td>
                  <td className="p-3 text-right font-mono font-black">{money(Number(dc.total_contract_value))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{dc.parties_donated_to.length}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{dc.government_buyers.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-red p-6 bg-bauhaus-red/5">
          <p className="text-sm font-bold text-bauhaus-red">
            These {d.bothSides.length} entities donated to an average of{' '}
            {d.bothSides.length > 0 ? Math.round(d.bothSides.reduce((sum, dc) => sum + dc.parties_donated_to.length, 0) / d.bothSides.length) : 0} parties each.
            The most prolific donated to {Math.max(...d.bothSides.map(dc => dc.parties_donated_to.length), 0)} different parties across the political spectrum.
          </p>
        </div>
      </section>

      {/* Top by Donations */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Top Donors with Government Contracts</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 20 largest political donors who also hold federal government contracts, ranked by total donations.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Donations</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contract Value</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Contracts</th>
              </tr>
            </thead>
            <tbody>
              {d.all.slice(0, 20).map((dc, i) => (
                <tr key={dc.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/entities/${dc.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{dc.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted">{dc.entity_type} &middot; ABN {dc.abn}</div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(Number(dc.total_donated))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmt(dc.donation_count)}</td>
                  <td className="p-3 text-right font-mono font-black">{money(Number(dc.total_contract_value))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmt(dc.contract_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top by Contract Value */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Top Contract Recipients who Donate</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The same {s.count} entities, now ranked by total government contract value. Even modest donations
          correlate with billions in public procurement.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contract Value</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Parties</th>
              </tr>
            </thead>
            <tbody>
              {d.byContractValue.slice(0, 20).map((dc, i) => (
                <tr key={dc.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/entities/${dc.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{dc.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted">{dc.entity_type} &middot; ABN {dc.abn}</div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black">{money(Number(dc.total_contract_value))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmt(dc.contract_count)}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(Number(dc.total_donated))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{dc.parties_donated_to.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Party Distribution */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Which Parties Receive Donor-Contractor Money?</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          How many of the {s.count} donor-contractor entities donate to each political party.
          Both major parties benefit — this is a structural feature, not a partisan issue.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-blue p-3">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Parties by Donor-Contractor Count</h3>
            </div>
            <div className="divide-y divide-bauhaus-black/5">
              {d.topParties.map(([party, data]) => {
                const barWidth = Math.max(4, (data.count / s.count) * 100);
                return (
                  <div key={party} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-bauhaus-black truncate max-w-[70%]">{party}</div>
                      <div className="text-xs font-black text-bauhaus-muted">{data.count}</div>
                    </div>
                    <div className="w-full bg-bauhaus-canvas h-1.5">
                      <div
                        className={`h-1.5 ${party.includes('Labor') || party.includes('ALP') ? 'bg-bauhaus-red' : party.includes('Liberal') || party.includes('National') || party.includes('LNP') ? 'bg-bauhaus-blue' : 'bg-bauhaus-muted'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Government buyers */}
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-black p-3">
              <h3 className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest">Departments Awarding Contracts</h3>
            </div>
            <div className="divide-y divide-bauhaus-black/5">
              {d.topBuyers.map(([buyer, count]) => {
                const barWidth = Math.max(4, (count / s.count) * 100);
                return (
                  <div key={buyer} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-bauhaus-black truncate max-w-[70%]">{buyer}</div>
                      <div className="text-xs font-black text-bauhaus-muted">{count}</div>
                    </div>
                    <div className="w-full bg-bauhaus-canvas h-1.5">
                      <div className="h-1.5 bg-bauhaus-black/40" style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* All 140 entities */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">All {s.count} Donor-Contractors</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Every entity in the CivicGraph Entity Graph that appears in both AEC political donation
          records and AusTender government contracts. Click any entity for its full dossier.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contract Value</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Parties</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Depts</th>
              </tr>
            </thead>
            <tbody>
              {d.all.map((dc, i) => (
                <tr key={dc.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3">
                    <Link href={`/entities/${dc.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{dc.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted">{dc.entity_type} &middot; ABN {dc.abn}</div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">{money(Number(dc.total_donated))}</td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(Number(dc.total_contract_value))}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{dc.parties_donated_to.length}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{dc.government_buyers.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-4 text-bauhaus-yellow uppercase tracking-widest">Methodology &amp; Data Sources</h2>
          <div className="text-white/90 leading-relaxed space-y-4">
            <p>
              This report is generated from the <strong>CivicGraph Entity Graph</strong> — {fmt(d.graphStats.totalEntities)} entities
              and {fmt(d.graphStats.totalRels)} relationships built from cross-referencing Australian public datasets by ABN.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
              <div>
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Donation Data</div>
                <p className="text-sm text-white/70">
                  Australian Electoral Commission (AEC) political donation disclosures.
                  {fmt(d.graphStats.totalDonations)} donation records spanning 1998–2024.
                  Includes donations to parties, associated entities, and third-party campaigners.
                </p>
              </div>
              <div>
                <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Contract Data</div>
                <p className="text-sm text-white/70">
                  AusTender federal procurement data (data.gov.au OCDS API).
                  {fmt(d.graphStats.totalContracts)} government contracts.
                  Covers federal departments and agencies only (not state/territory).
                </p>
              </div>
            </div>
            <p className="text-sm text-white/50">
              <strong className="text-white/80">Cross-reference method:</strong> Entities are matched by Australian Business Number (ABN).
              Donor names without ABNs are resolved using exact and normalised name matching against the entity registry.
              This report shows <em>correlation</em> between political donations and government contracts — it does not imply causation.
              Many entities have legitimate reasons to both participate in political processes and bid for government work.
            </p>
            <p className="text-sm text-white/50">
              <strong className="text-white/80">Limitations:</strong> Some entities operate through subsidiaries with different ABNs.
              State-level donations (not yet included) may reveal additional connections.
              Donation data relies on self-reporting by parties and associated entities, with a disclosure threshold.
            </p>
          </div>
        </div>
      </section>

      {/* Email Gate — Full Dataset */}
      <section className="mb-12">
        <DatasetEmailGate reportSlug="donor-contractors" entityCount={s.count} />
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Explore the Full Entity Graph</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Every entity in this report has a full dossier — political donations by party,
            government contracts by department, corporate financials, and cross-registry identity matches.
          </p>
          <Link
            href="/entities"
            className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
          >
            Open Entity Graph
          </Link>
        </div>
      </section>
    </div>
  );
}
