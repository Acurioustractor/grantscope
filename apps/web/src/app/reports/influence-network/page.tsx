import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Influence Network | CivicGraph Investigation',
  description: 'Lobby. Donate. Win contracts. Repeat. Entities that combine lobbying, political donations, and government contracts — the full influence cycle mapped.',
  openGraph: {
    title: 'The Influence Network',
    description: 'Entities that combine lobbying, political donations, and government contracts. The full influence cycle mapped across public datasets.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Influence Network',
    description: 'Lobby. Donate. Win contracts. Repeat. The influence cycle mapped.',
  },
};

import { money, fmt } from '@/lib/format';

/* --- Formatting helpers ---------------------------------------- */

function pct(n: number): string { return `${n.toFixed(1)}%`; }
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* --- Types ----------------------------------------------------- */

interface RevolvingDoorEntity {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string;
  state: string | null;
  is_community_controlled: boolean;
  in_procurement: number;
  in_political_donations: number;
  in_foundation: number;
  system_count: number;
  power_score: number;
  revolving_door_score: number;
  procurement_dollars: number;
  donation_dollars: number;
  donation_count: number;
  contract_count: number;
  distinct_govt_buyers: number;
  distinct_parties_funded: number;
  total_dollar_flow: number;
}

interface DonationByPartyRow {
  donor_abn: string;
  total_donated: string;
  parties_donated_to: string;
  parties: string;
}

interface PartyAggRow {
  party: string;
  total_received: string;
  donor_count: string;
}

interface EntityTypeRow {
  entity_type: string;
  count: string;
  avg_score: string;
  total_contracts: string;
  total_donations: string;
}

/* --- Data fetching --------------------------------------------- */

async function getData() {
  const supabase = getServiceSupabase();

  const [
    allEntitiesResult,
    topEntitiesResult,
    donationAggResult,
    partyAggResult,
  ] = await Promise.all([
    // All revolving door entities (small view, ~4.7K rows)
    safe(supabase
      .from('mv_revolving_door')
      .select('gs_id, canonical_name, entity_type, abn, state, is_community_controlled, in_procurement, in_political_donations, in_foundation, system_count, power_score, revolving_door_score, procurement_dollars, donation_dollars, donation_count, contract_count, distinct_govt_buyers, distinct_parties_funded, total_dollar_flow')
      .order('revolving_door_score', { ascending: false })),

    // Top 20 by revolving door score
    safe(supabase
      .from('mv_revolving_door')
      .select('gs_id, canonical_name, entity_type, abn, state, is_community_controlled, in_procurement, in_political_donations, in_foundation, system_count, power_score, revolving_door_score, procurement_dollars, donation_dollars, donation_count, contract_count, distinct_govt_buyers, distinct_parties_funded, total_dollar_flow')
      .order('revolving_door_score', { ascending: false })
      .limit(20)),

    // Donations aggregated by ABN (for entities that also hold contracts)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT donor_abn, SUM(amount) as total_donated, COUNT(DISTINCT donation_to) as parties_donated_to, array_agg(DISTINCT donation_to) as parties FROM political_donations WHERE donor_abn IS NOT NULL GROUP BY donor_abn HAVING SUM(amount) > 10000 ORDER BY total_donated DESC LIMIT 500`,
    })),

    // Which parties benefit most from revolving door donors
    safe(supabase.rpc('exec_sql', {
      query: `SELECT pd.donation_to as party, ROUND(SUM(pd.amount)) as total_received, COUNT(DISTINCT pd.donor_abn) as donor_count FROM political_donations pd INNER JOIN mv_revolving_door rd ON pd.donor_abn = rd.abn WHERE pd.donor_abn IS NOT NULL AND pd.donation_to IS NOT NULL AND rd.in_procurement = 1 AND rd.in_political_donations = 1 GROUP BY pd.donation_to ORDER BY total_received DESC LIMIT 20`,
    })),
  ]);

  const allEntities = ((allEntitiesResult || []) as RevolvingDoorEntity[]).map(e => ({
    ...e,
    procurement_dollars: Number(e.procurement_dollars) || 0,
    donation_dollars: Number(e.donation_dollars) || 0,
    total_dollar_flow: Number(e.total_dollar_flow) || 0,
  }));

  const topEntities = ((topEntitiesResult || []) as RevolvingDoorEntity[]).map(e => ({
    ...e,
    procurement_dollars: Number(e.procurement_dollars) || 0,
    donation_dollars: Number(e.donation_dollars) || 0,
    total_dollar_flow: Number(e.total_dollar_flow) || 0,
  }));

  const donationAgg = (donationAggResult || []) as DonationByPartyRow[];
  const partyAgg = (partyAggResult || []) as PartyAggRow[];

  // Build lookup of donation details by ABN
  const donationByAbn = new Map<string, { total_donated: number; parties_donated_to: number; parties: string[] }>();
  for (const d of donationAgg) {
    donationByAbn.set(d.donor_abn, {
      total_donated: Number(d.total_donated) || 0,
      parties_donated_to: Number(d.parties_donated_to) || 0,
      parties: Array.isArray(d.parties) ? d.parties : [],
    });
  }

  // Stats
  const totalEntities = allEntities.length;
  const threeVectorPlus = allEntities.filter(e =>
    e.in_procurement + e.in_political_donations + e.in_foundation >= 3
  ).length;
  const totalContractValue = allEntities.reduce((s, e) => s + e.procurement_dollars, 0);
  const totalDonationValue = allEntities.reduce((s, e) => s + e.donation_dollars, 0);
  const avgScore = totalEntities > 0
    ? allEntities.reduce((s, e) => s + e.revolving_door_score, 0) / totalEntities
    : 0;

  // Entities that both donate AND hold contracts (the influence cycle)
  const bothDonateAndContract = allEntities.filter(e =>
    e.in_procurement === 1 && e.in_political_donations === 1 && e.procurement_dollars > 0 && e.donation_dollars > 0
  ).sort((a, b) => b.procurement_dollars - a.procurement_dollars);

  // By entity type breakdown
  const typeMap = new Map<string, { count: number; totalScore: number; totalContracts: number; totalDonations: number }>();
  for (const e of allEntities) {
    const t = e.entity_type || 'Unknown';
    const prev = typeMap.get(t) || { count: 0, totalScore: 0, totalContracts: 0, totalDonations: 0 };
    prev.count++;
    prev.totalScore += e.revolving_door_score;
    prev.totalContracts += e.procurement_dollars;
    prev.totalDonations += e.donation_dollars;
    typeMap.set(t, prev);
  }
  const byType: EntityTypeRow[] = Array.from(typeMap.entries())
    .map(([type, v]) => ({
      entity_type: type,
      count: String(v.count),
      avg_score: String(v.count > 0 ? v.totalScore / v.count : 0),
      total_contracts: String(v.totalContracts),
      total_donations: String(v.totalDonations),
    }))
    .sort((a, b) => Number(b.count) - Number(a.count));

  // Party aggregation with contract values from revolving door donors
  const partyWithContracts = (partyAgg || []).map(p => {
    return {
      party: p.party,
      total_received: Number(p.total_received) || 0,
      donor_count: Number(p.donor_count) || 0,
    };
  });

  return {
    allEntities,
    topEntities,
    bothDonateAndContract,
    donationByAbn,
    partyWithContracts,
    byType,
    stats: {
      totalEntities,
      threeVectorPlus,
      totalContractValue,
      totalDonationValue,
      avgScore,
    },
  };
}

/* --- Page ------------------------------------------------------ */

export default async function InfluenceNetworkReport() {
  const d = await getData();
  if (!d) return <div className="p-8 text-bauhaus-muted">No data available.</div>;

  const s = d.stats;

  return (
    <div>
      {/* --- Hero / Header --- */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Cross-Dataset Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The Influence Network
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Lobby. Donate. Win contracts. Repeat. {fmt(s.totalEntities)} entities operate across 2 or more
          influence vectors &mdash; political donations, government procurement, and foundation networks.
          {s.threeVectorPlus > 0 && ` ${fmt(s.threeVectorPlus)} entities span all three systems simultaneously.`}
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* --- Section 1: Key Stats --- */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Triple Threat</div>
            <div className="text-3xl sm:text-4xl font-black">{fmt(s.threeVectorPlus)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">3+ influence vectors</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Contracts Won</div>
            <div className="text-3xl sm:text-4xl font-black">{money(s.totalContractValue)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">by revolving door entities</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Donated</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{money(s.totalDonationValue)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">to political parties</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Avg Score</div>
            <div className="text-3xl sm:text-4xl font-black">{s.avgScore.toFixed(1)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">revolving door score</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: AusTender procurement &times; AEC political donations &times; foundation giving &times; lobbying register.
            All cross-referenced by ABN.
          </p>
        </div>
      </section>

      {/* --- Section 2: The Triple Play - Top 20 --- */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Triple Play &mdash; Top 20
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 20 entities with the highest revolving door score. These organisations combine
          the most influence vectors: political donations, government procurement, and foundation networks.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Score</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Vectors</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Donated</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Parties</th>
              </tr>
            </thead>
            <tbody>
              {d.topEntities.map((e, i) => {
                const vectors: string[] = [];
                if (e.in_procurement === 1) vectors.push('PROCUREMENT');
                if (e.in_political_donations === 1) vectors.push('DONATIONS');
                if (e.in_foundation === 1) vectors.push('FOUNDATION');

                return (
                  <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3">
                      <Link href={`/org/${slugify(e.canonical_name)}`} className="hover:text-bauhaus-red transition-colors">
                        <div className="font-bold text-bauhaus-black">{e.canonical_name}</div>
                        <div className="text-xs text-bauhaus-muted">
                          {e.entity_type} &middot; {e.state || '---'}
                          {e.contract_count > 0 && <span className="ml-2">{fmt(e.contract_count)} contracts</span>}
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-1 text-xs font-black rounded ${
                        e.revolving_door_score >= 5 ? 'bg-bauhaus-red text-white' :
                        e.revolving_door_score >= 4 ? 'bg-orange-500 text-white' :
                        e.revolving_door_score >= 3 ? 'bg-bauhaus-yellow text-bauhaus-black' :
                        'bg-gray-200 text-bauhaus-black'
                      }`}>
                        {e.revolving_door_score}
                      </span>
                    </td>
                    <td className="p-3 text-center hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {vectors.map(v => (
                          <span key={v} className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${
                            v === 'PROCUREMENT' ? 'bg-bauhaus-black text-white' :
                            v === 'DONATIONS' ? 'bg-bauhaus-red text-white' :
                            'bg-bauhaus-blue text-white'
                          }`}>
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(e.procurement_dollars)}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap hidden sm:table-cell">{money(e.donation_dollars)}</td>
                    <td className="p-3 text-center font-mono hidden md:table-cell">{e.distinct_parties_funded || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ReportCTA reportSlug="influence-network" reportTitle="The Influence Network" variant="inline" />

      {/* --- Section 3: Donation -> Contract Correlation --- */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-2 text-bauhaus-yellow uppercase tracking-widest">
            The ROI of Influence
          </h2>
          <p className="text-sm text-white/80 mb-8 max-w-2xl leading-relaxed">
            Entities that both donate to political parties AND hold government contracts. The &ldquo;ROI&rdquo;
            column shows the ratio of contract dollars received per donation dollar spent. This is correlation,
            not causation &mdash; but the numbers tell a story.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest w-8">#</th>
                  <th className="text-left p-2 text-xs font-black text-white/50 uppercase tracking-widest">Entity</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Donated</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest">Contracts</th>
                  <th className="text-right p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden sm:table-cell">ROI</th>
                  <th className="text-center p-2 text-xs font-black text-white/50 uppercase tracking-widest hidden md:table-cell">Parties</th>
                </tr>
              </thead>
              <tbody>
                {d.bothDonateAndContract.slice(0, 30).map((e, i) => {
                  const roi = e.donation_dollars > 0
                    ? Math.round(e.procurement_dollars / e.donation_dollars)
                    : 0;

                  return (
                    <tr key={e.gs_id} className="border-b border-white/10">
                      <td className="p-2 font-black text-white/30">{i + 1}</td>
                      <td className="p-2">
                        <Link href={`/org/${slugify(e.canonical_name)}`} className="hover:text-bauhaus-yellow transition-colors">
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
                        {roi > 0 ? `${fmt(roi)}x` : '---'}
                      </td>
                      <td className="p-2 text-center font-mono text-white/70 hidden md:table-cell">
                        {e.distinct_parties_funded || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-white/40 max-w-xl mx-auto">
              &ldquo;ROI&rdquo; is illustrative, not causal. Large corporations engage in political
              donations and government contracting as separate business activities. The ratio
              highlights the scale differential between political investment and public procurement outcomes.
            </p>
          </div>
        </div>
      </section>

      {/* --- Section 4: Which Parties Benefit Most --- */}
      {d.partyWithContracts.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
            Which Parties Benefit Most?
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Political donations to each party from entities that also hold government contracts.
            These are revolving door entities &mdash; organisations that participate in both
            political funding and government procurement.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-red text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Party / Recipient</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Received</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Revolving Door Donors</th>
                </tr>
              </thead>
              <tbody>
                {d.partyWithContracts.slice(0, 15).map((p, i) => (
                  <tr key={`${p.party}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                    <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="p-3 font-bold text-bauhaus-black">{p.party}</td>
                    <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(p.total_received)}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">{fmt(p.donor_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --- Section 5: By Entity Type --- */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          By Entity Type
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          How revolving door entities break down by type. Corporate entities dominate procurement
          value, but charities and foundations also appear across multiple influence vectors.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
          {d.byType.slice(0, 6).map((t, i) => (
            <div
              key={t.entity_type}
              className={`border-4 border-bauhaus-black p-6 ${
                i > 0 ? 'sm:border-l-0' : ''
              } ${i >= 2 ? 'lg:border-t-0' : ''} ${i >= 1 ? 'max-sm:border-t-0' : ''} ${
                i === 0 ? 'bg-bauhaus-black text-white' :
                i === 1 ? 'bg-bauhaus-red text-white' :
                'bg-white'
              }`}
            >
              <div className={`text-xs font-black uppercase tracking-widest mb-3 ${
                i === 0 ? 'text-bauhaus-yellow' :
                i === 1 ? 'text-red-200' :
                'text-bauhaus-muted'
              }`}>
                {t.entity_type}
              </div>
              <div className={`text-3xl font-black mb-2 ${
                i >= 2 ? 'text-bauhaus-black' : ''
              }`}>
                {fmt(Number(t.count))}
              </div>
              <div className={`text-xs font-bold space-y-1 ${
                i < 2 ? 'text-white/60' : 'text-bauhaus-muted'
              }`}>
                <div>Avg score: {Number(t.avg_score).toFixed(1)}</div>
                <div>Contracts: {money(Number(t.total_contracts))}</div>
                <div>Donations: {money(Number(t.total_donations))}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- The Influence Cycle Diagram --- */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-6 text-bauhaus-yellow uppercase tracking-widest">How The Influence Cycle Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">1</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Donate</div>
              <p className="text-sm text-white/70">
                Donate to political parties &mdash; often to multiple parties simultaneously.
                {money(s.totalDonationValue)} from {fmt(s.totalEntities)} revolving door entities.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">2</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Connect</div>
              <p className="text-sm text-white/70">
                Sit on foundation boards, lobby government, and build networks
                across the public-private divide. {fmt(s.threeVectorPlus)} entities span 3+ systems.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">3</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Win</div>
              <p className="text-sm text-white/70">
                Win government contracts.
                {money(s.totalContractValue)} in public procurement from revolving door entities.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/20 text-center">
            <p className="text-sm text-white/50 max-w-2xl mx-auto">
              Each step is legal. Each dataset is public. CivicGraph cross-references AEC donations,
              AusTender contracts, the ACNC charity register, and foundation data &mdash; all linked
              by ABN &mdash; to reveal the system as a whole.
            </p>
          </div>
        </div>
      </section>

      {/* --- Methodology --- */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Data source:</strong> This report uses the <code>mv_revolving_door</code> materialized
              view, which identifies entities present in 2 or more &ldquo;influence systems&rdquo;: government
              procurement (AusTender), political donations (AEC), and foundation/philanthropy networks (ACNC).
            </p>
            <p>
              <strong>Revolving door score:</strong> A composite score based on presence across influence
              vectors, with bonus points for high donation volume (&gt;$50K) and high contract frequency
              (&gt;10 contracts). Higher scores indicate deeper cross-system engagement.
            </p>
            <p>
              <strong>Matching:</strong> Entities are matched across datasets using Australian Business
              Number (ABN) as the primary key. This means entities without ABNs in donation records
              are excluded from cross-referencing.
            </p>
            <p>
              <strong>ROI calculation:</strong> The &ldquo;ROI&rdquo; ratio (contract dollars per
              donation dollar) is illustrative only. It does not imply that donations cause contract
              awards. Many revolving door entities are large corporations for whom political engagement
              and government contracting are separate, routine business activities.
            </p>
            <p>
              <strong>Correlation, not causation:</strong> This report identifies entities that
              participate simultaneously in political donations, government procurement, and
              foundation networks. It does not claim that participation in one system influences
              outcomes in another. The &ldquo;influence network&rdquo; label describes the structural
              pattern, not intent.
            </p>
          </div>
        </div>
      </section>

      {/* --- Final CTA --- */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">Go Deeper</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Explore the full power concentration analysis, see who runs Australia&apos;s boards,
            or trace the political money trail.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/reports/power-concentration"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Power Concentration
            </Link>
            <Link
              href="/reports/political-money"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Political Money
            </Link>
            <Link
              href="/reports/triple-play"
              className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Triple Play
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="influence-network" reportTitle="The Influence Network" />
    </div>
  );
}
