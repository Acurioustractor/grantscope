import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Political Money | CivicGraph Investigation',
  description: 'Who funds Australian politics — and what do they get in return? 312K donation records cross-referenced against 770K government contracts.',
  openGraph: {
    title: 'Political Money',
    description: 'Who funds Australian politics — and what do they get in return? $21.9B in tracked political donations cross-referenced against $853B in government contracts.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Political Money',
    description: '312K donation records. 770K government contracts. The donor-to-contractor pipeline.',
  },
};

/* ─── Formatting helpers ─────────────────────────────────── */

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function fmt(n: number): string { return n.toLocaleString(); }

/* ─── Types ──────────────────────────────────────────────── */

interface PartyRow {
  donation_to: string;
  total: string;
  donors: string;
  avg_donation: string;
}

interface DonorRow {
  donor_name: string;
  donor_abn: string | null;
  total: string;
  parties: string;
  years_active: string;
  party_list: string;
  has_contracts: boolean;
  contract_entity: PayToPlayEntity | null;
}

interface PayToPlayEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string;
  state: string | null;
  donation_dollars: number;
  procurement_dollars: number;
  distinct_parties_funded: number;
  contract_count: number;
  ratio: number;
}

interface YearRow {
  financial_year: string;
  total: string;
  donors: string;
}

interface Summary {
  totalRecords: number;
  uniqueDonors: number;
  totalAmount: number;
  donorsWithAbn: number;
  minYear: string;
  maxYear: string;
  payToPlayCount: number;
  payToPlayDonationTotal: number;
  payToPlayContractTotal: number;
}

/* ─── Party color mapping ────────────────────────────────── */

function partyColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('labor') || n.includes('alp') || n.includes('labor holdings')) return 'bg-red-600';
  if (n.includes('liberal') || n.includes('lnp') || n.includes('coalition') || n.includes('national')) return 'bg-blue-600';
  if (n.includes('green')) return 'bg-green-600';
  if (n.includes('united australia') || n.includes('palmer')) return 'bg-yellow-500';
  if (n.includes('one nation')) return 'bg-orange-500';
  if (n.includes('union') || n.includes('employees')) return 'bg-rose-500';
  return 'bg-gray-500';
}

function partyColorText(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('labor') || n.includes('alp') || n.includes('labor holdings')) return 'text-red-600';
  if (n.includes('liberal') || n.includes('lnp') || n.includes('coalition') || n.includes('national')) return 'text-blue-600';
  if (n.includes('green')) return 'text-green-600';
  if (n.includes('united australia') || n.includes('palmer')) return 'text-yellow-600';
  if (n.includes('one nation')) return 'text-orange-500';
  return 'text-gray-600';
}

function isPartyOrCandidate(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('labor') || n.includes('alp') || n.includes('liberal') ||
    n.includes('green') || n.includes('national') || n.includes('one nation') ||
    n.includes('united australia') || n.includes('democrat') || n.includes('palmer') ||
    n.includes('lnp') || n.includes('coalition')
  );
}

/* ─── Data fetching ──────────────────────────────────────── */

async function getData() {
  const supabase = getServiceSupabase();

  const [
    summaryResult,
    partyResult,
    topDonorsResult,
    yearResult,
    payToPlayResult,
  ] = await Promise.all([
    // 1. Summary stats
    supabase.rpc('exec_sql', {
      query: `SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT donor_name) as unique_donors,
        ROUND(SUM(amount)) as total_amount,
        COUNT(DISTINCT donor_abn) FILTER (WHERE donor_abn IS NOT NULL) as donors_with_abn,
        MIN(financial_year) as min_year,
        MAX(financial_year) as max_year
      FROM political_donations`,
    }),

    // 2. Party/recipient breakdown — top 20
    supabase.rpc('exec_sql', {
      query: `SELECT
        donation_to,
        ROUND(SUM(amount)) as total,
        COUNT(DISTINCT donor_name) as donors,
        ROUND(AVG(amount)) as avg_donation
      FROM political_donations
      WHERE donation_to IS NOT NULL
      GROUP BY donation_to
      ORDER BY total DESC
      LIMIT 20`,
    }),

    // 3. Top 50 donors
    supabase.rpc('exec_sql', {
      query: `SELECT
        donor_name,
        donor_abn,
        ROUND(SUM(amount)) as total,
        COUNT(DISTINCT donation_to) as parties,
        COUNT(DISTINCT financial_year) as years_active,
        STRING_AGG(DISTINCT donation_to, ', ' ORDER BY donation_to) as party_list
      FROM political_donations
      GROUP BY donor_name, donor_abn
      ORDER BY total DESC
      LIMIT 50`,
    }),

    // 4. Donations by financial year
    supabase.rpc('exec_sql', {
      query: `SELECT
        financial_year,
        ROUND(SUM(amount)) as total,
        COUNT(DISTINCT donor_name) as donors
      FROM political_donations
      GROUP BY financial_year
      ORDER BY financial_year`,
    }),

    // 5. Pay-to-play: entities that both donate and hold contracts
    supabase
      .from('mv_revolving_door')
      .select('gs_id, canonical_name, entity_type, abn, state, donation_dollars, procurement_dollars, distinct_parties_funded, contract_count')
      .eq('in_political_donations', true)
      .eq('in_procurement', true)
      .gt('donation_dollars', 0)
      .gt('procurement_dollars', 0)
      .order('procurement_dollars', { ascending: false })
      .limit(100),
  ]);

  // Parse summary
  const raw = (summaryResult.data as Record<string, string>[])?.[0] || {};
  const parties = (partyResult.data as PartyRow[]) || [];
  const topDonorsRaw = (topDonorsResult.data as DonorRow[]) || [];
  const byYear = (yearResult.data as YearRow[]) || [];
  const payToPlayRaw = (payToPlayResult.data || []) as PayToPlayEntity[];

  // Compute ratio for pay-to-play
  const payToPlay = payToPlayRaw.map(e => ({
    ...e,
    donation_dollars: Number(e.donation_dollars),
    procurement_dollars: Number(e.procurement_dollars),
    ratio: Number(e.donation_dollars) > 0
      ? Math.round(Number(e.procurement_dollars) / Number(e.donation_dollars))
      : 0,
  }));

  const payToPlayAbns = new Set(payToPlay.map(e => e.abn));
  const topDonors = topDonorsRaw.map(d => ({
    ...d,
    has_contracts: d.donor_abn ? payToPlayAbns.has(d.donor_abn) : false,
    contract_entity: d.donor_abn ? payToPlay.find(e => e.abn === d.donor_abn) || null : null,
  }));

  const payToPlayCount = payToPlay.length;
  const payToPlayDonationTotal = payToPlay.reduce((sum, e) => sum + e.donation_dollars, 0);
  const payToPlayContractTotal = payToPlay.reduce((sum, e) => sum + e.procurement_dollars, 0);

  const summary: Summary = {
    totalRecords: Number(raw.total_records) || 0,
    uniqueDonors: Number(raw.unique_donors) || 0,
    totalAmount: Number(raw.total_amount) || 0,
    donorsWithAbn: Number(raw.donors_with_abn) || 0,
    minYear: raw.min_year || '',
    maxYear: raw.max_year || '',
    payToPlayCount,
    payToPlayDonationTotal,
    payToPlayContractTotal,
  };

  // Separate parties from unions/associated entities for cleaner display
  const partyFunding = parties.filter(p => isPartyOrCandidate(p.donation_to));
  const otherRecipients = parties.filter(p => !isPartyOrCandidate(p.donation_to));

  return { summary, parties, partyFunding, otherRecipients, topDonors, byYear, payToPlay };
}

/* ─── Slug helper ────────────────────────────────────────── */

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ─── Page ───────────────────────────────────────────────── */

export default async function PoliticalMoneyReport() {
  const d = await getData();
  const s = d.summary;

  // Find max party total for bar width scaling
  const maxPartyTotal = d.partyFunding.length > 0
    ? Math.max(...d.partyFunding.map(p => Number(p.total)))
    : 1;

  // Find max year total for bar width scaling
  const maxYearTotal = d.byYear.length > 0
    ? Math.max(...d.byYear.map(y => Number(y.total)))
    : 1;

  return (
    <div>
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Cross-Dataset Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Political Money
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Who funds Australian politics &mdash; and what do they get in return?
          {' '}{fmt(s.totalRecords)} donation records from {s.minYear} to {s.maxYear},
          cross-referenced against 770K government contracts. {fmt(s.payToPlayCount)} entities
          appear on both sides: donating to parties AND winning government work.
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ─── Hero stat cards ─────────────────────────────── */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Donations Tracked</div>
            <div className="text-3xl sm:text-4xl font-black">{money(s.totalAmount)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">{fmt(s.totalRecords)} records</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Unique Donors</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.uniqueDonors)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">{s.minYear} &ndash; {s.maxYear}</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Donor-Contractors</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{fmt(s.payToPlayCount)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">donate AND hold contracts</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Contracts to Donors</div>
            <div className="text-3xl sm:text-4xl font-black">{money(s.payToPlayContractTotal)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">{money(s.payToPlayDonationTotal)} donated</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: Australian Electoral Commission (AEC) disclosure returns &times; AusTender contract data.
            Cross-referenced by Australian Business Number (ABN).
          </p>
        </div>
      </section>

      {/* ─── Section 1: Party Funding ────────────────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Party Funding
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Where the money goes. Total political donations by recipient party or associated entity,
          ranked by total amount received. Includes direct party donations and affiliated organisation flows.
        </p>

        {/* Party bars */}
        <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
          <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            Major Parties &amp; Affiliated Entities
          </h3>
          {d.partyFunding.slice(0, 15).map((p) => (
            <div key={p.donation_to} className="flex items-center gap-3 mb-3">
              <div className="w-48 sm:w-64 text-xs font-bold text-bauhaus-black text-right shrink-0 truncate" title={p.donation_to}>
                {p.donation_to.length > 40 ? p.donation_to.slice(0, 37) + '...' : p.donation_to}
              </div>
              <div className="flex-1 h-7 bg-gray-100 relative">
                <div
                  className={`h-full ${partyColor(p.donation_to)} transition-all`}
                  style={{ width: `${Math.max((Number(p.total) / maxPartyTotal) * 100, 1)}%` }}
                />
              </div>
              <div className="w-20 text-xs font-mono font-bold text-right shrink-0">{money(Number(p.total))}</div>
              <div className="w-16 text-xs text-bauhaus-muted text-right shrink-0 hidden sm:block">{fmt(Number(p.donors))} donors</div>
            </div>
          ))}
        </div>

        {/* Other recipients (unions, clubs) */}
        {d.otherRecipients.length > 0 && (
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <h3 className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
              Other Major Recipients (Unions, Associated Entities)
            </h3>
            {d.otherRecipients.slice(0, 10).map((p) => (
              <div key={p.donation_to} className="flex items-center gap-3 mb-3">
                <div className="w-48 sm:w-64 text-xs font-bold text-bauhaus-black text-right shrink-0 truncate" title={p.donation_to}>
                  {p.donation_to.length > 40 ? p.donation_to.slice(0, 37) + '...' : p.donation_to}
                </div>
                <div className="flex-1 h-7 bg-gray-100 relative">
                  <div
                    className={`h-full ${partyColor(p.donation_to)} transition-all`}
                    style={{ width: `${Math.max((Number(p.total) / maxPartyTotal) * 100, 1)}%` }}
                  />
                </div>
                <div className="w-20 text-xs font-mono font-bold text-right shrink-0">{money(Number(p.total))}</div>
                <div className="w-16 text-xs text-bauhaus-muted text-right shrink-0 hidden sm:block">{fmt(Number(p.donors))} donors</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ReportCTA reportSlug="political-money" reportTitle="Political Money" variant="inline" />

      {/* ─── Section 2: Top 30 Donors ────────────────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Top 30 Political Donors
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The biggest donors to Australian politics by total disclosed amount.
          Entities with a government contract match are flagged &mdash; they appear on both sides.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Donor</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Donated</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Parties</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Years</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
              </tr>
            </thead>
            <tbody>
              {d.topDonors.slice(0, 30).map((donor, i) => (
                <tr key={`${donor.donor_name}-${i}`} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${donor.has_contracts ? 'border-l-4 border-l-bauhaus-red' : ''}`}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    {donor.contract_entity ? (
                      <Link href={`/org/${nameToSlug(donor.donor_name)}`} className="hover:text-bauhaus-red transition-colors">
                        <div className="font-bold text-bauhaus-black">{donor.donor_name}</div>
                        {donor.donor_abn && (
                          <div className="text-xs text-bauhaus-muted">ABN: {donor.donor_abn}</div>
                        )}
                      </Link>
                    ) : (
                      <div>
                        <div className="font-bold text-bauhaus-black">{donor.donor_name}</div>
                        {donor.donor_abn && (
                          <div className="text-xs text-bauhaus-muted">ABN: {donor.donor_abn}</div>
                        )}
                      </div>
                    )}
                    {/* Party badges */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {donor.party_list && donor.party_list.split(', ').slice(0, 5).map(party => (
                        <span
                          key={party}
                          className={`inline-block px-1.5 py-0.5 text-[9px] font-bold text-white rounded ${partyColor(party)}`}
                          title={party}
                        >
                          {party.length > 20 ? party.slice(0, 17) + '...' : party}
                        </span>
                      ))}
                      {donor.party_list && donor.party_list.split(', ').length > 5 && (
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold text-bauhaus-muted bg-gray-200 rounded">
                          +{donor.party_list.split(', ').length - 5} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(Number(donor.total))}</td>
                  <td className="p-3 text-center font-mono hidden sm:table-cell">{donor.parties}</td>
                  <td className="p-3 text-center font-mono hidden md:table-cell">{donor.years_active}</td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                    {donor.has_contracts && donor.contract_entity ? (
                      <span className="text-bauhaus-red">{money(Number(donor.contract_entity.procurement_dollars))}</span>
                    ) : (
                      <span className="text-bauhaus-muted">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Section 3: Pay to Play ──────────────────────── */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-2 text-bauhaus-yellow uppercase tracking-widest">
            Pay to Play?
          </h2>
          <p className="text-sm text-white/80 mb-8 max-w-2xl leading-relaxed">
            {fmt(s.payToPlayCount)} entities that donate to political parties ALSO hold
            government contracts. They donated a combined {money(s.payToPlayDonationTotal)} and
            received {money(s.payToPlayContractTotal)} in government contracts &mdash;
            a return of {s.payToPlayDonationTotal > 0 ? `${Math.round(s.payToPlayContractTotal / s.payToPlayDonationTotal)}x` : 'N/A'} their
            political investment.
          </p>

          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-yellow">{fmt(s.payToPlayCount)}</div>
              <div className="text-xs font-black text-white/50 uppercase tracking-widest mt-2">Donor-Contractors</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-bauhaus-red">{money(s.payToPlayDonationTotal)}</div>
              <div className="text-xs font-black text-white/50 uppercase tracking-widest mt-2">Total Donated</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-white">{money(s.payToPlayContractTotal)}</div>
              <div className="text-xs font-black text-white/50 uppercase tracking-widest mt-2">Contracts Received</div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest w-8">#</th>
                  <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest">Entity</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Donated</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Contracts</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden sm:table-cell">Ratio</th>
                  <th className="text-center p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden md:table-cell">Parties</th>
                </tr>
              </thead>
              <tbody>
                {d.payToPlay.slice(0, 30).map((e, i) => (
                  <tr key={e.gs_id} className="border-b border-white/10">
                    <td className="p-2 font-black text-white/30">{i + 1}</td>
                    <td className="p-2">
                      <Link href={`/org/${nameToSlug(e.canonical_name)}`} className="hover:text-bauhaus-yellow transition-colors">
                        <div className="font-bold text-white">{e.canonical_name}</div>
                        <div className="text-xs text-white/50">
                          {e.entity_type} &middot; {e.state || '---'}
                          {e.contract_count > 0 && <span className="ml-2">{fmt(e.contract_count)} contracts</span>}
                        </div>
                      </Link>
                    </td>
                    <td className="p-2 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                      {money(e.donation_dollars)}
                    </td>
                    <td className="p-2 text-right font-mono font-black text-white whitespace-nowrap">
                      {money(e.procurement_dollars)}
                    </td>
                    <td className="p-2 text-right font-mono font-black text-bauhaus-yellow whitespace-nowrap hidden sm:table-cell">
                      {e.ratio > 0 ? `${fmt(e.ratio)}x` : '---'}
                    </td>
                    <td className="p-2 text-center font-mono text-white/70 hidden md:table-cell">
                      {e.distinct_parties_funded}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-white/40 max-w-xl mx-auto">
              Correlation does not imply causation. Many donor-contractors are large corporations
              for whom political engagement and government contracting are normal operations.
              This table highlights the overlap &mdash; interpretation requires context.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Section 4: Timeline ─────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Donations Over Time
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Total political donations by financial year, from {s.minYear} to {s.maxYear}.
          Spikes typically align with election cycles and changes to disclosure thresholds.
        </p>
        <div className="border-4 border-bauhaus-black p-6 bg-white">
          <div className="space-y-1">
            {d.byYear.map((y) => (
              <div key={y.financial_year} className="flex items-center gap-3">
                <div className="w-20 text-xs font-bold text-bauhaus-black text-right shrink-0">
                  {y.financial_year.length > 7 ? y.financial_year.slice(-7) : y.financial_year}
                </div>
                <div className="flex-1 h-5 bg-gray-100 relative">
                  <div
                    className="h-full bg-bauhaus-red transition-all"
                    style={{ width: `${Math.max((Number(y.total) / maxYearTotal) * 100, 0.5)}%` }}
                  />
                </div>
                <div className="w-16 text-xs font-mono font-bold text-right shrink-0">{money(Number(y.total))}</div>
                <div className="w-14 text-xs text-bauhaus-muted text-right shrink-0 hidden sm:block">{fmt(Number(y.donors))}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 5: Party detail table ───────────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          All Recipients
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Full breakdown of all political donation recipients, including parties, associated entities,
          unions, and other registered organisations. Ranked by total amount received.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Received</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Donors</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Avg Donation</th>
              </tr>
            </thead>
            <tbody>
              {d.parties.slice(0, 20).map((p, i) => (
                <tr key={`${p.donation_to}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-bauhaus-black flex items-center gap-2">
                      <span className={`inline-block w-3 h-3 rounded-sm ${partyColor(p.donation_to)}`} />
                      {p.donation_to}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                    <span className={partyColorText(p.donation_to)}>{money(Number(p.total))}</span>
                  </td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{fmt(Number(p.donors))}</td>
                  <td className="p-3 text-right font-mono hidden md:table-cell">{money(Number(p.avg_donation))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Methodology ─────────────────────────────────── */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Data source:</strong> Australian Electoral Commission (AEC) annual financial
              disclosure returns. Political parties, associated entities, donors, and third-party
              campaigners are required to lodge returns disclosing financial details above the
              applicable disclosure threshold. Current threshold is $16,900 (indexed annually).
            </p>
            <p>
              <strong>Coverage:</strong> {fmt(s.totalRecords)} records from financial
              year {s.minYear} to {s.maxYear}, covering {fmt(s.uniqueDonors)} unique donor
              names. {fmt(s.donorsWithAbn)} donors have an Australian Business Number (ABN) on file,
              enabling cross-referencing against AusTender government contract data.
            </p>
            <p>
              <strong>Cross-referencing:</strong> Donor-contractor identification uses the
              CivicGraph entity resolution system. Entities are matched across the political
              donations and AusTender datasets using ABN as the primary key. The &ldquo;Pay to
              Play&rdquo; section uses the pre-computed <code>mv_revolving_door</code> materialized
              view which scores entities across multiple influence vectors.
            </p>
            <p>
              <strong>What counts as a &ldquo;donation&rdquo;:</strong> AEC disclosure data includes
              donations (gifts), other receipts, debts, and some operational transfers between
              party branches and associated entities (e.g., union affiliation fees). This means
              totals include intra-party flows that may inflate headline numbers. The
              &ldquo;donation_to&rdquo; field reflects the receiving entity as recorded in the
              AEC return.
            </p>
            <p>
              <strong>Caveats:</strong> Below-threshold donations are not disclosed. Donations can
              be split across multiple entities to stay under thresholds. Associated entity
              flows (unions, clubs, holding companies) may be counted separately from their parent
              party. Some large &ldquo;donations&rdquo; are in fact public election funding
              disbursements from the AEC itself. The ratio of contracts-to-donations should not
              be interpreted as a direct return on investment &mdash; correlation does not
              establish causation.
            </p>
            <p>
              <strong>Limitations:</strong> State/territory donation data is not yet included
              (federal AEC only). Real-time donations are not available &mdash; AEC returns are
              lodged annually with significant delay. Some entities operate under multiple ABNs
              or entity names, which may cause undercounting of aggregated totals.
            </p>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Dig Deeper</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Explore the donor-contractor network on the interactive graph, or see the full
            cross-system power analysis with all 7 datasets.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/reports/donor-contractors"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Donor-Contractors Report
            </Link>
            <Link
              href="/reports/power-concentration"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Power Concentration
            </Link>
            <Link
              href="/api/data/political-money"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Raw Data API
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="political-money" reportTitle="Political Money" />
    </div>
  );
}
