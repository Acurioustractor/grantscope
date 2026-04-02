import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { money, fmt } from '@/lib/format';
import { safe } from '@/lib/services/utils';

export const revalidate = 3600;

export const metadata = {
  title: 'Reality Check — CivicGraph',
  description: 'Politicians talk. Data receipts. Political claims vs actual data from public records.',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CardData = {
  id: string;
  claim: string;
  claimAttribution: string;
  reality: string;
  stats: { label: string; value: string }[];
  source: string;
  accent: 'red' | 'yellow' | 'blue';
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getCardData(): Promise<CardData[]> {
  const supabase = getServiceSupabase();
  const cards: CardData[] = [];

  // Card 1: Youth Justice — Detention vs Prevention
  const yjSpend = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      SUM(CASE WHEN program_name ILIKE '%detention%' OR program_name ILIKE '%custod%' THEN amount_dollars ELSE 0 END) as detention,
      SUM(CASE WHEN program_name ILIKE '%prevention%' OR program_name ILIKE '%diversion%' OR program_name ILIKE '%early%interven%' THEN amount_dollars ELSE 0 END) as prevention,
      SUM(amount_dollars) as total
    FROM justice_funding
    WHERE topics @> ARRAY['youth-justice']::text[] AND source NOT IN ('austender-direct')`,
  }), 'yj-spend');

  if (yjSpend && Array.isArray(yjSpend) && yjSpend[0]) {
    const d = yjSpend[0];
    const detention = Number(d.detention) || 0;
    const prevention = Number(d.prevention) || 0;
    const total = Number(d.total) || 1;
    const detPct = ((detention / total) * 100).toFixed(0);
    const prevPct = ((prevention / total) * 100).toFixed(1);

    cards.push({
      id: 'youth-justice',
      claim: '"We are making record investments in keeping young people safe."',
      claimAttribution: 'Common ministerial talking point',
      reality: `${detPct}% of youth justice funding goes to detention. ${prevPct}% goes to prevention. Detention costs $1,562/day per child. 73% reoffend within 12 months. ALMA evidence shows community-led programs cost 1/10th with better outcomes.`,
      stats: [
        { label: 'Detention funding', value: money(detention) },
        { label: 'Prevention funding', value: money(prevention) },
        { label: 'Total YJ spending', value: money(total) },
      ],
      source: 'CivicGraph analysis of justice_funding + ALMA evidence database',
      accent: 'red',
    });
  }

  // Card 2: First Nations — Community-Controlled Procurement
  const ccProcurement = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      ROUND(100.0 * SUM(CASE WHEN is_community_controlled THEN procurement_dollars ELSE 0 END) / NULLIF(SUM(procurement_dollars), 0), 2) as cc_pct_dollars,
      ROUND(100.0 * COUNT(*) FILTER (WHERE is_community_controlled AND in_procurement = 1) / NULLIF(COUNT(*) FILTER (WHERE in_procurement = 1), 0), 2) as cc_pct_entities,
      SUM(CASE WHEN is_community_controlled THEN procurement_dollars ELSE 0 END)::bigint as cc_dollars,
      SUM(procurement_dollars)::bigint as total_dollars
    FROM mv_entity_power_index
    WHERE in_procurement = 1`,
  }), 'cc-procurement');

  if (ccProcurement && Array.isArray(ccProcurement) && ccProcurement[0]) {
    const d = ccProcurement[0];
    cards.push({
      id: 'first-nations',
      claim: '"We are committed to supporting First Nations communities."',
      claimAttribution: 'Every government, every budget',
      reality: `Community-controlled organisations receive ${d.cc_pct_dollars}% of government procurement dollars. They represent ${d.cc_pct_entities}% of procurement suppliers. The communities they serve are the highest-need in the country.`,
      stats: [
        { label: 'CC procurement share', value: `${d.cc_pct_dollars}%` },
        { label: 'CC supplier share', value: `${d.cc_pct_entities}%` },
        { label: 'Total procurement', value: money(Number(d.total_dollars) || 0) },
      ],
      source: 'CivicGraph cross-system entity power index (AusTender + ACNC)',
      accent: 'red',
    });
  }

  // Card 3: Transparent Spending — Donor-Contractors
  const donorContractors = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      COUNT(*)::int as entity_count,
      SUM(total_donated)::bigint as total_donated,
      SUM(total_contract_value)::bigint as total_contracts
    FROM mv_gs_donor_contractors`,
  }), 'donor-contractors');

  if (donorContractors && Array.isArray(donorContractors) && donorContractors[0]) {
    const d = donorContractors[0];
    cards.push({
      id: 'transparency',
      claim: '"Government spending is transparent and accountable."',
      claimAttribution: 'Standard procurement rhetoric',
      reality: `${fmt(Number(d.entity_count))} entities donate to political parties AND hold government contracts. They donated ${money(Number(d.total_donated))}. They received ${money(Number(d.total_contracts))} in contracts. That's a ${Math.round(Number(d.total_contracts) / Number(d.total_donated))}x return.`,
      stats: [
        { label: 'Donor-contractors', value: fmt(Number(d.entity_count)) },
        { label: 'Total donated', value: money(Number(d.total_donated)) },
        { label: 'Contracts received', value: money(Number(d.total_contracts)) },
      ],
      source: 'CivicGraph donor-contractor cross-reference (AEC + AusTender)',
      accent: 'yellow',
    });
  }

  // Card 4: Evidence-Based Policy — ALMA
  const almaStats = await safe(supabase.rpc('exec_sql', {
    query: `SELECT COUNT(*)::int as total FROM alma_interventions`,
  }), 'alma-count');

  const almaFunded = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      COUNT(DISTINCT a.id)::int as funded_interventions,
      COUNT(DISTINCT a.id) FILTER (WHERE a.evidence_level IN ('Strong', 'Promising'))::int as strong_evidence
    FROM alma_interventions a
    LEFT JOIN justice_funding j ON j.gs_entity_id = a.gs_entity_id AND j.gs_entity_id IS NOT NULL
    WHERE j.id IS NOT NULL`,
  }), 'alma-funded');

  if (almaStats?.[0] && almaFunded?.[0]) {
    const total = Number(almaStats[0].total);
    const funded = Number(almaFunded[0].funded_interventions);
    const unfundedPct = (((total - funded) / total) * 100).toFixed(0);

    cards.push({
      id: 'evidence',
      claim: '"Our policies are evidence-based."',
      claimAttribution: 'Every policy document ever written',
      reality: `CivicGraph maps ${fmt(total)} community interventions with real evidence. ${unfundedPct}% have no linked government funding. The programs with the strongest evidence often get the least money.`,
      stats: [
        { label: 'Mapped interventions', value: fmt(total) },
        { label: 'With government funding', value: fmt(funded) },
        { label: 'Unfunded', value: `${unfundedPct}%` },
      ],
      source: 'Australian Living Map of Alternatives (ALMA) + justice_funding linkage',
      accent: 'blue',
    });
  }

  // Card 5: Closing the Gap — Funding Deserts
  const deserts = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      ROUND(AVG(CASE WHEN remoteness IN ('Remote Australia', 'Very Remote Australia') THEN desert_score END)::numeric, 1) as remote_avg,
      ROUND(AVG(CASE WHEN remoteness = 'Major Cities of Australia' THEN desert_score END)::numeric, 1) as metro_avg,
      ROUND(AVG(CASE WHEN remoteness = 'Major Cities of Australia' THEN total_funding_all_sources END)::numeric) as metro_funding,
      ROUND(AVG(CASE WHEN remoteness IN ('Remote Australia', 'Very Remote Australia') THEN total_funding_all_sources END)::numeric) as remote_funding
    FROM mv_funding_deserts`,
  }), 'funding-deserts');

  if (deserts && Array.isArray(deserts) && deserts[0]) {
    const d = deserts[0];
    const ratio = Math.round(Number(d.metro_funding) / Math.max(Number(d.remote_funding), 1));

    cards.push({
      id: 'closing-gap',
      claim: '"We are committed to Closing the Gap."',
      claimAttribution: 'Closing the Gap annual reports',
      reality: `Major cities receive ${ratio}x more funding per LGA than remote communities. Remote areas score ${d.remote_avg} on the funding desert index vs ${d.metro_avg} for metro. The gap isn't closing — it's engineered.`,
      stats: [
        { label: 'Metro avg funding/LGA', value: money(Number(d.metro_funding)) },
        { label: 'Remote avg funding/LGA', value: money(Number(d.remote_funding)) },
        { label: 'Desert score (remote)', value: String(d.remote_avg) },
      ],
      source: 'CivicGraph funding desert analysis (SEIFA + AusTender + justice_funding)',
      accent: 'red',
    });
  }

  // Card 6: Competition in Procurement — Revolving Door
  const revolving = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      COUNT(*)::int as high_score,
      COUNT(*) FILTER (WHERE lobbies)::int as lobbying_entities
    FROM mv_revolving_door
    WHERE revolving_door_score > 5`,
  }), 'revolving-door');

  if (revolving && Array.isArray(revolving) && revolving[0]) {
    const d = revolving[0];
    cards.push({
      id: 'competition',
      claim: '"Government procurement is open and competitive."',
      claimAttribution: 'Commonwealth Procurement Rules',
      reality: `${fmt(Number(d.high_score))} entities have multiple influence vectors: lobbying + donations + contracts. ${fmt(Number(d.lobbying_entities))} of them are registered lobbyists. That's not competition. That's a club with a membership fee.`,
      stats: [
        { label: 'High-influence entities', value: fmt(Number(d.high_score)) },
        { label: 'With lobbying access', value: fmt(Number(d.lobbying_entities)) },
        { label: 'Influence score', value: '> 5/10' },
      ],
      source: 'CivicGraph revolving door analysis (lobbying + AEC + AusTender)',
      accent: 'yellow',
    });
  }

  // Card 7: Disability Services — Thin Markets
  const thinMarkets = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      COUNT(DISTINCT lga_name)::int as thin_lgas,
      SUM(ndis_participants)::int as affected_participants
    FROM mv_funding_deserts
    WHERE ndis_participants > 0 AND ndis_entities = 0`,
  }), 'thin-markets');

  if (thinMarkets && Array.isArray(thinMarkets) && thinMarkets[0]) {
    const d = thinMarkets[0];
    cards.push({
      id: 'disability',
      claim: '"The NDIS ensures choice and control for participants."',
      claimAttribution: 'NDIS marketing materials',
      reality: `${fmt(Number(d.thin_lgas))} local government areas have NDIS participants but zero indexed service providers. ${fmt(Number(d.affected_participants))} participants live in areas where "choice and control" means no choice at all.`,
      stats: [
        { label: 'Thin market LGAs', value: fmt(Number(d.thin_lgas)) },
        { label: 'Affected participants', value: fmt(Number(d.affected_participants)) },
        { label: 'Providers available', value: '0' },
      ],
      source: 'CivicGraph funding desert analysis (NDIS + AusTender)',
      accent: 'blue',
    });
  }

  // Card 8: Coordination — Same LGAs, Different Departments
  const coordination = await safe(supabase.rpc('exec_sql', {
    query: `SELECT
      COUNT(DISTINCT lga_name)::int as overlap_lgas,
      ROUND(AVG(desert_score)::numeric, 1) as avg_desert_score
    FROM mv_funding_deserts
    WHERE justice_entities > 0 AND ndis_participants > 0`,
  }), 'coordination');

  const systemCount = await safe(supabase.rpc('exec_sql', {
    query: `SELECT COUNT(*)::int as multi_system
    FROM mv_entity_power_index
    WHERE system_count >= 4`,
  }), 'multi-system');

  if (coordination?.[0] && systemCount?.[0]) {
    const d = coordination[0];
    cards.push({
      id: 'coordination',
      claim: '"We take a whole-of-government approach."',
      claimAttribution: 'Every departmental strategy document',
      reality: `${fmt(Number(d.overlap_lgas))} LGAs appear in both justice and NDIS systems — different departments, different budgets, same communities, no coordination. ${fmt(Number(systemCount[0].multi_system))} entities touch 4+ government systems. Nobody is joining the dots.`,
      stats: [
        { label: 'Overlapping LGAs', value: fmt(Number(d.overlap_lgas)) },
        { label: 'Multi-system entities', value: fmt(Number(systemCount[0].multi_system)) },
        { label: 'Avg desert score', value: String(d.avg_desert_score) },
      ],
      source: 'CivicGraph cross-system analysis (7 government datasets)',
      accent: 'blue',
    });
  }

  return cards;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Card Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const accentColors = {
  red: { border: 'border-bauhaus-red', text: 'text-bauhaus-red', bg: 'bg-bauhaus-red' },
  yellow: { border: 'border-bauhaus-yellow', text: 'text-bauhaus-yellow', bg: 'bg-bauhaus-yellow' },
  blue: { border: 'border-bauhaus-blue', text: 'text-bauhaus-blue', bg: 'bg-bauhaus-blue' },
} as const;

function RealityCard({ card }: { card: CardData }) {
  const accent = accentColors[card.accent];

  return (
    <div className="border-4 border-bauhaus-black bg-[#0A0A0A] shadow-[8px_8px_0px_0px_#121212] relative group">
      {/* Social-sized inner container */}
      <div className="p-6 md:p-8 min-h-[314px] flex flex-col justify-between" style={{ maxWidth: 600 }}>
        {/* THE CLAIM */}
        <div className="mb-4">
          <div className="text-[11px] font-satoshi font-bold uppercase tracking-[0.2em] text-[#555] mb-2">
            The Claim
          </div>
          <p className="font-satoshi font-black text-white text-lg md:text-xl leading-tight italic">
            <span className={`${accent.text} text-2xl md:text-3xl leading-none mr-1`}>&ldquo;</span>
            {card.claim.replace(/^"|"$/g, '')}
          </p>
          <p className="text-[11px] text-[#555] mt-1 font-mono">&mdash; {card.claimAttribution}</p>
        </div>

        {/* THE REALITY */}
        <div className={`border-l-4 ${accent.border} pl-4 mb-4`}>
          <div className={`text-[11px] font-satoshi font-bold uppercase tracking-[0.2em] ${accent.text} mb-2`}>
            The Reality
          </div>
          <p className="text-[#B0B0B0] text-sm leading-relaxed">
            {card.reality}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 md:gap-6 mb-4">
          {card.stats.map((stat) => (
            <div key={stat.label} className="flex-1">
              <div className="font-satoshi font-black text-white text-lg md:text-xl">{stat.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#777]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className={`border-t border-[#333] pt-3 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-satoshi font-bold uppercase tracking-[0.15em] ${accent.text} border ${accent.border} px-2 py-0.5`}>
              Reality Check
            </span>
            <span className="text-[10px] text-[#555] font-mono">civicgraph.com.au</span>
          </div>
          <div className="text-[9px] text-[#444] max-w-[200px] text-right">{card.source}</div>
        </div>
      </div>

      {/* Copy hint on hover */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="text-[10px] bg-[#333] text-[#999] px-2 py-1 font-mono">
          Screenshot to share
        </span>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function RealityCheckPage() {
  const cards = await getCardData();

  return (
    <main className="min-h-screen bg-bauhaus-canvas">
      {/* Hero */}
      <section className="bg-bauhaus-black text-white py-16 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[11px] font-satoshi font-bold uppercase tracking-[0.2em] text-bauhaus-red mb-4">
            CivicGraph Reports
          </div>
          <h1 className="font-satoshi font-black text-5xl md:text-7xl uppercase tracking-tight leading-none mb-6">
            Reality<br />Check
          </h1>
          <p className="font-satoshi font-bold text-xl md:text-2xl text-[#B0B0B0] max-w-[600px] leading-snug">
            Politicians talk.<br />
            Data receipts.
          </p>
          <div className="mt-8 border-t border-[#333] pt-4 max-w-[600px]">
            <p className="text-sm text-[#777]">
              Every claim below is something you&apos;ve heard a minister say. Every number comes from
              their own public data. We just connected them.
            </p>
          </div>
        </div>
      </section>

      {/* Cards Grid */}
      <section className="max-w-[1200px] mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          {cards.map((card) => (
            <RealityCard key={card.id} card={card} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <section className="bg-bauhaus-black text-white py-12 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="border-4 border-[#333] p-8 md:p-12">
            <p className="font-satoshi font-bold text-lg md:text-xl text-[#B0B0B0] mb-6 leading-relaxed max-w-[700px]">
              All data sourced from public records. All claims sourced from public statements.
              CivicGraph just connected them.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/reports/convergence"
                className="border-2 border-bauhaus-red text-bauhaus-red px-4 py-2 text-sm font-satoshi font-bold uppercase tracking-wider hover:bg-bauhaus-red hover:text-white transition-colors duration-150"
              >
                Convergence Report
              </Link>
              <Link
                href="/reports/donor-contractors"
                className="border-2 border-bauhaus-yellow text-bauhaus-yellow px-4 py-2 text-sm font-satoshi font-bold uppercase tracking-wider hover:bg-bauhaus-yellow hover:text-bauhaus-black transition-colors duration-150"
              >
                Donor-Contractors
              </Link>
              <Link
                href="/reports/youth-justice"
                className="border-2 border-bauhaus-blue text-bauhaus-blue px-4 py-2 text-sm font-satoshi font-bold uppercase tracking-wider hover:bg-bauhaus-blue hover:text-white transition-colors duration-150"
              >
                Youth Justice
              </Link>
            </div>
          </div>
          <div className="mt-8 text-center">
            <span className="text-[11px] font-satoshi font-bold uppercase tracking-[0.2em] text-[#555]">
              CivicGraph &mdash; Decision Infrastructure for Government &amp; Social Sector
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
