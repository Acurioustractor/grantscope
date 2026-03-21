import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import Link from 'next/link';

export const revalidate = 3600; // ISR: regenerate hourly

export const metadata: Metadata = {
  title: 'CivicGraph — AI-Powered Accountability Infrastructure',
  description: 'Cross-system funding intelligence for equitable public investment. 333,000+ entities linked across 8 government systems.',
  openGraph: {
    title: 'CivicGraph — AI-Powered Accountability Infrastructure',
    description: 'Mapping how public money flows, who it reaches, and what the evidence says works.',
    type: 'website',
    siteName: 'CivicGraph',
  },
};

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function fmt(n: number): string { return n.toLocaleString(); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Data fetching
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Row = Record<string, any>;

async function getShowcaseData() {
  const supabase = getServiceSupabase();

  const q = (query: string) =>
    safe(supabase.rpc('exec_sql', { query })) as Promise<Row[] | null>;

  // Only query live data that changes (funding deserts + ALMA breakdowns)
  // National/QLD entity counts and ROGS spending are stable — use pre-computed values
  const [
    qldDeserts,
    qldTopDeserts,
    qldAlmaByType,
  ] = await Promise.all([
    q(`SELECT remoteness, COUNT(*)::int as lga_count, ROUND(AVG(desert_score)::numeric, 0)::int as avg_score
       FROM mv_funding_deserts WHERE state = 'QLD' AND remoteness IS NOT NULL
       GROUP BY remoteness ORDER BY avg_score DESC`),
    q(`SELECT DISTINCT lga_name, desert_score::int, remoteness
       FROM mv_funding_deserts WHERE state = 'QLD'
       ORDER BY desert_score DESC LIMIT 8`),
    q(`SELECT type, COUNT(*)::int as cnt FROM alma_interventions
       WHERE geography::text ILIKE '%queensland%' OR geography::text ILIKE '%qld%'
       GROUP BY type ORDER BY cnt DESC LIMIT 6`),
  ]);

  // Pre-computed from live DB queries (2026-03-20, updated after ABR backfill)
  const entityCount = [{ cnt: 333068 }];
  const qldEntities = [{ cnt: 21739 }];
  const qldCommunityControlled = [{ cnt: 4130 }];
  const qldIndigenousCorps = [{ cnt: 1507 }];
  const qldAlma = [{ cnt: 487 }];
  const nationalStats = [{ justice_records: 70963, alma_count: 1162 }];
  const qldDetentionSpend = [{ total: 1880576000 }];
  const qldCommunitySpend = [{ total: 1494230000 }];

  return {
    entityCount: entityCount?.[0]?.cnt ?? 333068,
    qldEntities: qldEntities?.[0]?.cnt ?? 21739,
    qldCommunityControlled: qldCommunityControlled?.[0]?.cnt ?? 4130,
    qldIndigenousCorps: qldIndigenousCorps?.[0]?.cnt ?? 1507,
    qldDeserts: qldDeserts ?? [],
    qldTopDeserts: qldTopDeserts ?? [],
    qldAlmaCount: qldAlma?.[0]?.cnt ?? 487,
    qldAlmaByType: qldAlmaByType ?? [],
    qldDetention: qldDetentionSpend?.[0]?.total ?? 1880576000,
    qldCommunity: qldCommunitySpend?.[0]?.total ?? 1494230000,
    nationalJustice: nationalStats?.[0]?.justice_records ?? 70963,
    nationalAlma: nationalStats?.[0]?.alma_count ?? 1162,
    nationalFoundations: 10779,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HeroStat({ value, label, sublabel }: { value: string; label: string; sublabel?: string }) {
  return (
    <div className="text-center">
      <p className="text-4xl md:text-5xl font-black text-bauhaus-red">{value}</p>
      <p className="text-sm font-black uppercase tracking-widest text-bauhaus-black mt-1">{label}</p>
      {sublabel && <p className="text-xs text-bauhaus-muted mt-1">{sublabel}</p>}
    </div>
  );
}

function SectionHeader({ tag, title, description }: { tag: string; title: string; description: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">{tag}</p>
      <h2 className="text-2xl md:text-3xl font-black text-bauhaus-black mb-2">{title}</h2>
      <p className="text-bauhaus-muted font-medium max-w-2xl">{description}</p>
    </div>
  );
}

function DesertBar({ name, score, remoteness }: { name: string; score: number; remoteness: string }) {
  const width = Math.min(100, (score / 140) * 100);
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-sm font-bold text-bauhaus-black w-32 truncate">{name}</span>
      <div className="flex-1 h-6 bg-gray-100 border-2 border-bauhaus-black relative">
        <div
          className="h-full bg-bauhaus-red"
          style={{ width: `${width}%` }}
        />
        <span className="absolute right-2 top-0.5 text-xs font-black text-bauhaus-black">{score}</span>
      </div>
      <span className="text-xs text-bauhaus-muted w-24 text-right">{(remoteness ?? '').replace(' Australia', '')}</span>
    </div>
  );
}

function AlmaBar({ type, count, max }: { type: string; count: number; max: number }) {
  const width = Math.min(100, (count / max) * 100);
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-sm font-bold text-bauhaus-black w-40 truncate">{type}</span>
      <div className="flex-1 h-5 bg-gray-100 border-2 border-bauhaus-black relative">
        <div
          className="h-full bg-bauhaus-blue"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs font-black text-bauhaus-black w-8 text-right">{count}</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function ShowcasePage() {
  const data = await getShowcaseData();
  const detentionPct = Math.round((data.qldDetention / (data.qldDetention + data.qldCommunity)) * 100);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* ── Hero ── */}
      <div className="mb-16">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">
          Decision Infrastructure for Government &amp; Social Sector
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-bauhaus-black mb-4 leading-tight">
          What if a Children&apos;s Commissioner<br />
          could see every dollar?
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-3xl mb-8">
          CivicGraph is AI-powered accountability infrastructure that maps how public money flows
          across procurement, justice, child protection, and community services &mdash; linking spending
          to evidence of what works and amplified by community voice.
        </p>

        {/* Hero stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-bauhaus-canvas border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
          <HeroStat value={fmt(data.entityCount)} label="Entities Mapped" sublabel="Across 8 government systems" />
          <HeroStat value={fmt(data.nationalJustice)} label="Justice Funding Records" sublabel="Linked by ABN" />
          <HeroStat value={fmt(data.nationalAlma)} label="Evidence-Based Programs" sublabel="ALMA interventions" />
          <HeroStat value="118x" label="Urban-Remote Gap" sublabel="Funding per LGA" />
        </div>
      </div>

      {/* ── Section 1: The Problem ── */}
      <section className="mb-16">
        <SectionHeader
          tag="The Problem"
          title="Fragmented Systems, Invisible Gaps"
          description="Governments allocate billions through procurement, grants, justice funding, and community services &mdash; with zero cross-system visibility. The result: funding deserts where communities need resources most."
        />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Detention vs Community */}
          <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-4">
              QLD Youth Justice Spending
            </p>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 text-center bg-bauhaus-red/10 border-2 border-bauhaus-red p-4">
                <p className="text-2xl font-black text-bauhaus-red">{money(data.qldDetention)}</p>
                <p className="text-xs font-bold uppercase tracking-wider mt-1">Detention ({detentionPct}%)</p>
              </div>
              <div className="flex-1 text-center bg-bauhaus-blue/10 border-2 border-bauhaus-blue p-4">
                <p className="text-2xl font-black text-bauhaus-blue">{money(data.qldCommunity)}</p>
                <p className="text-xs font-bold uppercase tracking-wider mt-1">Community ({100 - detentionPct}%)</p>
              </div>
            </div>
            <p className="text-sm text-bauhaus-muted">
              {detentionPct}% of QLD youth justice spending goes to detention despite evidence
              that diversion and community-led programs are more effective and less costly.
            </p>
          </div>

          {/* Community-controlled finding */}
          <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-4">
              Over-Monitored, Under-Funded
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-black text-bauhaus-black">2.15</p>
                <p className="text-sm text-bauhaus-muted">Average government systems monitoring community-controlled organisations</p>
              </div>
              <div>
                <p className="text-3xl font-black text-bauhaus-red">3.2%</p>
                <p className="text-sm text-bauhaus-muted">Share of federal procurement dollars going to community-controlled organisations</p>
              </div>
              <p className="text-xs text-bauhaus-muted border-t border-gray-200 pt-3">
                {fmt(data.qldCommunityControlled)} community-controlled organisations in Queensland.
                Tracked across multiple government systems but receiving a fraction of the funding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: QLD Funding Deserts ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Queensland Focus"
          title="Funding Deserts"
          description="LGAs scored by disadvantage (SEIFA, remoteness) vs funding received. Higher score = greater gap between need and resources. Maximum score: 140."
        />

        <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm mb-6">
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            Worst-Served QLD Communities
          </p>
          {data.qldTopDeserts.map((d: any, i: number) => (
            <DesertBar key={i} name={d.lga_name} score={d.desert_score} remoteness={d.remoteness} />
          ))}
          <p className="text-xs text-bauhaus-muted mt-4">
            Every maximum-score funding desert in Queensland is a Very Remote community
            with a significant First Nations population.
          </p>
        </div>

        {/* Remoteness summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.qldDeserts.map((d: any, i: number) => (
            <div key={i} className="border-2 border-bauhaus-black p-3 text-center">
              <p className="text-xl font-black text-bauhaus-red">{d.avg_score}</p>
              <p className="text-xs font-bold uppercase tracking-wider">{d.remoteness.replace(' Australia', '')}</p>
              <p className="text-xs text-bauhaus-muted">{d.lga_count} LGAs</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 3: Evidence ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Australian Living Map of Alternatives"
          title="Evidence Exists &mdash; It&apos;s Just Not Connected to Funding"
          description={`${data.qldAlmaCount} evidence-based interventions are documented in Queensland. Government spending remains concentrated in detention.`}
        />

        <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            QLD Interventions by Type
          </p>
          {data.qldAlmaByType.map((d: any, i: number) => (
            <AlmaBar
              key={i}
              type={d.type}
              count={d.cnt}
              max={data.qldAlmaByType[0]?.cnt ?? 177}
            />
          ))}
          <p className="text-sm text-bauhaus-muted mt-4">
            {data.qldAlmaCount} programs with documented evidence of effectiveness.
            37 diversion programs. 65 cultural connection programs. 65 community-led initiatives.
            Yet {detentionPct}% of youth justice dollars flow to detention.
          </p>
        </div>
      </section>

      {/* ── Section 4: The AI ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Agentic AI Infrastructure"
          title="92 AI Agents Maintaining a Live Knowledge Graph"
          description="CivicGraph deploys autonomous AI agents that continuously harvest, deduplicate, and link data across government systems. This isn't a dashboard &mdash; it's a fleet of AI agents that see what no single department can."
        />

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { system: 'Federal Procurement', records: '770K contracts', color: 'bg-bauhaus-red/10 border-bauhaus-red' },
            { system: 'Justice Funding', records: '71K records', color: 'bg-bauhaus-blue/10 border-bauhaus-blue' },
            { system: 'Charity Registry', records: '66K charities', color: 'bg-yellow-50 border-yellow-500' },
            { system: 'Political Donations', records: '312K records', color: 'bg-purple-50 border-purple-500' },
            { system: 'Tax Transparency', records: '24K entities', color: 'bg-green-50 border-green-500' },
            { system: 'Evidence (ALMA)', records: '1,162 programs', color: 'bg-orange-50 border-orange-500' },
          ].map((s, i) => (
            <div key={i} className={`border-2 ${s.color} p-4`}>
              <p className="text-sm font-black uppercase tracking-wider">{s.system}</p>
              <p className="text-lg font-black text-bauhaus-black">{s.records}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-bauhaus-canvas border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-3">
            The Commissioner&apos;s AI Toolkit
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="font-black text-bauhaus-black mb-1">AI Policy Brief Generator</p>
              <p className="text-sm text-bauhaus-muted">
                Detects emerging patterns in funding data, cross-references evidence
                and community voice, drafts policy briefs in hours instead of months.
              </p>
            </div>
            <div>
              <p className="font-black text-bauhaus-black mb-1">Community Voice Intelligence</p>
              <p className="text-sm text-bauhaus-muted">
                NLP analysis of community stories to identify systemic themes
                and gaps between lived experience and government allocation.
              </p>
            </div>
            <div>
              <p className="font-black text-bauhaus-black mb-1">Diversion Pathway AI</p>
              <p className="text-sm text-bauhaus-muted">
                Recommends evidence-based alternatives to detention for specific
                community profiles with outcome data and cost comparisons.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: QLD Entity Coverage ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Queensland Coverage"
          title="21,739 QLD Entities Mapped"
          description="Every charity, Indigenous corporation, foundation, and government body in Queensland linked across systems."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border-4 border-bauhaus-black p-4 text-center bauhaus-shadow-sm">
            <p className="text-2xl font-black text-bauhaus-black">{fmt(data.qldEntities)}</p>
            <p className="text-xs font-bold uppercase tracking-wider">Total QLD Entities</p>
          </div>
          <div className="border-4 border-bauhaus-black p-4 text-center bauhaus-shadow-sm">
            <p className="text-2xl font-black text-bauhaus-red">{fmt(data.qldCommunityControlled)}</p>
            <p className="text-xs font-bold uppercase tracking-wider">Community-Controlled</p>
          </div>
          <div className="border-4 border-bauhaus-black p-4 text-center bauhaus-shadow-sm">
            <p className="text-2xl font-black text-bauhaus-blue">{fmt(data.qldIndigenousCorps)}</p>
            <p className="text-xs font-bold uppercase tracking-wider">Indigenous Corporations</p>
          </div>
          <div className="border-4 border-bauhaus-black p-4 text-center bauhaus-shadow-sm">
            <p className="text-2xl font-black text-bauhaus-black">{data.qldAlmaCount}</p>
            <p className="text-xs font-bold uppercase tracking-wider">Evidence Programs</p>
          </div>
        </div>
      </section>

      {/* ── Section 6: Scalability ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Scalability"
          title="Every Jurisdiction Needs This"
          description="Every Australian state has a Children's Commissioner. Canada, New Zealand, and the UK have equivalent bodies. The architecture is jurisdiction-agnostic."
        />

        <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-3">
                Australian Replication
              </p>
              <ul className="space-y-2 text-sm">
                {['QLD: OATSICC (Year 1)', 'VIC: Commission for Children', 'NSW: Advocate for Children', 'WA: Commissioner for Children', 'SA: Commissioner for Children', 'NT: Children\'s Commissioner'].map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={`w-2 h-2 ${i === 0 ? 'bg-bauhaus-red' : 'bg-gray-300'}`} />
                    <span className={i === 0 ? 'font-bold' : 'text-bauhaus-muted'}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-3">
                International Replication
              </p>
              <ul className="space-y-2 text-sm text-bauhaus-muted">
                <li>Canada: First Nations Child &amp; Family Caring Society</li>
                <li>New Zealand: Children&apos;s Commissioner</li>
                <li>United Kingdom: Children&apos;s Commissioner for England</li>
                <li>Ireland: Ombudsman for Children</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 7: Data Sovereignty ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Indigenous Data Sovereignty"
          title="CARE Principles from Day One"
          description="Collective benefit, Authority to control, Responsibility, Ethics &mdash; embedded in the architecture, not bolted on."
        />

        <div className="grid md:grid-cols-4 gap-4">
          {[
            { letter: 'C', word: 'Collective Benefit', desc: 'Data serves communities first, not external parties' },
            { letter: 'A', word: 'Authority to Control', desc: 'First Nations communities govern access to data about themselves' },
            { letter: 'R', word: 'Responsibility', desc: 'Those who collect and use data are accountable to community' },
            { letter: 'E', word: 'Ethics', desc: 'Data practices respect cultural authority and self-determination' },
          ].map((c, i) => (
            <div key={i} className="border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
              <p className="text-3xl font-black text-bauhaus-red mb-1">{c.letter}</p>
              <p className="text-sm font-black uppercase tracking-wider mb-2">{c.word}</p>
              <p className="text-xs text-bauhaus-muted">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="border-4 border-bauhaus-black p-8 bauhaus-shadow-sm text-center mb-10">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">
          Google.org AI for Government Innovation
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-bauhaus-black mb-4">
          The question isn&apos;t whether this data should exist.<br />
          It already does.
        </h2>
        <p className="text-bauhaus-muted font-medium max-w-2xl mx-auto mb-6">
          The question is whether a Children&apos;s Commissioner should have the AI tools
          to see it, understand it, and act on it.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/graph?mode=justice&topic=youth-justice"
            className="bg-bauhaus-black text-white px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-red transition-colors"
          >
            Explore the Graph
          </Link>
          <Link
            href="/reports/youth-justice"
            className="border-4 border-bauhaus-black px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-canvas transition-colors"
          >
            Youth Justice Report
          </Link>
        </div>
      </section>

      {/* Attribution */}
      <footer className="text-center text-xs text-bauhaus-muted py-6">
        <p>CivicGraph &mdash; Decision Infrastructure for Government &amp; Social Sector</p>
        <p className="mt-1">Data sourced from AusTender, ACNC, AEC, ROGS, ATO, ORIC, and ALMA (JusticeHub)</p>
      </footer>
    </div>
  );
}
