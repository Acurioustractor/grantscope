import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import Link from 'next/link';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Indigenous Justice Intelligence | CivicGraph',
  description: 'What if a Children\'s Commissioner could see every dollar flowing through justice, child protection, and community services for First Nations children?',
  openGraph: {
    title: 'Indigenous Justice Intelligence | CivicGraph',
    description: 'AI-powered accountability infrastructure for First Nations children\'s rights. 333,000+ entities across 8 government systems.',
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

type Row = Record<string, unknown>;

async function getData() {
  const supabase = getServiceSupabase();
  const q = (query: string) =>
    safe(supabase.rpc('exec_sql', { query })) as Promise<Row[] | null>;

  const [
    qldDeserts,
    qldTopDeserts,
    qldAlmaByType,
    qldJusticeByProgram,
  ] = await Promise.all([
    q(`SELECT remoteness, COUNT(DISTINCT lga_name)::int as lga_count, ROUND(AVG(desert_score)::numeric, 0)::int as avg_score
       FROM mv_funding_deserts WHERE state = 'QLD' AND remoteness IS NOT NULL AND desert_score IS NOT NULL
       GROUP BY remoteness ORDER BY avg_score DESC`),
    q(`SELECT lga_name, ROUND(MAX(desert_score)::numeric, 0)::int as desert_score, MAX(remoteness) as remoteness
       FROM mv_funding_deserts WHERE state = 'QLD' AND desert_score IS NOT NULL
       GROUP BY lga_name ORDER BY desert_score DESC LIMIT 8`),
    q(`SELECT type, COUNT(*)::int as cnt FROM alma_interventions
       WHERE geography::text ILIKE '%queensland%' OR geography::text ILIKE '%qld%'
       GROUP BY type ORDER BY cnt DESC LIMIT 10`),
    q(`SELECT program_name, SUM(amount_dollars)::bigint as total, COUNT(*)::int as records
       FROM justice_funding WHERE state = 'QLD' AND topics @> ARRAY['youth_justice']
       GROUP BY program_name ORDER BY total DESC LIMIT 8`),
  ]);

  return {
    qldDeserts: qldDeserts ?? [],
    qldTopDeserts: qldTopDeserts ?? [],
    qldAlmaByType: qldAlmaByType ?? [],
    qldJusticeByProgram: qldJusticeByProgram ?? [],
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HeroStat({ value, label, href }: { value: string; label: string; href: string }) {
  return (
    <Link href={href} className="text-center group">
      <p className="text-3xl md:text-4xl font-black text-bauhaus-red group-hover:text-bauhaus-blue transition-colors">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black mt-1">{label}</p>
      <p className="text-[10px] text-bauhaus-blue opacity-0 group-hover:opacity-100 transition-opacity mt-1">Click to explore &rarr;</p>
    </Link>
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
        <div className="h-full bg-bauhaus-red" style={{ width: `${width}%` }} />
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
        <div className="h-full bg-bauhaus-blue" style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-black text-bauhaus-black w-8 text-right">{count}</span>
    </div>
  );
}

function TryItCTA({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 border-4 border-bauhaus-blue bg-bauhaus-blue/5 p-6">
      <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-4">Try It Yourself</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {children}
      </div>
    </div>
  );
}

function ToolLink({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="border-2 border-bauhaus-blue p-4 hover:bg-bauhaus-blue hover:text-white transition-colors group"
    >
      <p className="font-black text-sm uppercase tracking-wider">{label}</p>
      <p className="text-xs text-bauhaus-muted group-hover:text-white/70 mt-1">{description}</p>
    </Link>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function IndigenousJusticePitchPage() {
  const data = await getData();

  // Pre-computed stable values
  const entityCount = 333068;
  const justiceRecords = 70963;
  const almaCount = 1162;
  const qldDetention = 1880576000;
  const qldCommunity = 1494230000;
  const detentionPct = Math.round((qldDetention / (qldDetention + qldCommunity)) * 100);

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-10">

      {/* ── S1: Hero ── */}
      <div className="mb-16">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">
          Google.org &middot; AI for Government Innovation
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-bauhaus-black mb-4 leading-tight">
          What if a Children&apos;s Commissioner<br />
          could see every dollar?
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-3xl mb-8">
          CivicGraph is AI-powered accountability infrastructure that maps how public money flows
          across procurement, justice, child protection, and community services &mdash; linking spending
          to evidence of what works. Built in partnership with OATSICC for First Nations children&apos;s rights.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-bauhaus-canvas border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
          <HeroStat value={fmt(entityCount)} label="Entities Mapped" href="/graph" />
          <HeroStat value={fmt(justiceRecords)} label="Justice Records" href="/reports/youth-justice" />
          <HeroStat value={fmt(almaCount)} label="Evidence Programs" href="/evidence" />
          <HeroStat value="118x" label="Urban-Remote Gap" href="/reports/funding-deserts" />
        </div>
      </div>

      {/* ── S2: The Crisis ── */}
      <section className="mb-16">
        <SectionHeader
          tag="The Crisis"
          title="First Nations Children: Over-Represented, Under-Served"
          description="First Nations children are 8% of Australia's child population but 48% of children in out-of-home care and over 50% of children in youth justice. The Making Queensland Safer Act (2024) introduces controversial new police powers — without cross-system evidence."
        />

        <div className="border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            Proportion of First Nations Children in Key Systems
          </p>
          <div className="space-y-4">
            {[
              { label: 'Child Population', pct: 8, color: 'bg-bauhaus-blue' },
              { label: 'Out-of-Home Care', pct: 48, color: 'bg-bauhaus-red' },
              { label: 'Youth Justice', pct: 53, color: 'bg-bauhaus-red' },
            ].map(bar => (
              <div key={bar.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold text-bauhaus-black">{bar.label}</span>
                  <span className="font-black text-bauhaus-black">{bar.pct}%</span>
                </div>
                <div className="h-8 bg-gray-100 border-2 border-bauhaus-black">
                  <div className={`h-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-bauhaus-muted mt-4">
            Sources: AIHW Child Protection 2022&ndash;23, AIHW Youth Justice 2022&ndash;23, ABS Census 2021
          </p>
        </div>
      </section>

      {/* ── S3: Follow the Money ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Follow the Money"
          title="Where QLD Youth Justice Dollars Go"
          description="Queensland spends more on locking children up than on keeping them in community. CivicGraph makes this visible across every program."
        />

        <div className="grid md:grid-cols-2 gap-0 mb-6">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-red/10 text-center">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Detention &amp; Supervision</p>
            <p className="text-4xl font-black text-bauhaus-red">{money(qldDetention)}</p>
            <p className="text-lg font-black text-bauhaus-black mt-1">{detentionPct}%</p>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue/10 text-center">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-2">Community Programs</p>
            <p className="text-4xl font-black text-bauhaus-blue">{money(qldCommunity)}</p>
            <p className="text-lg font-black text-bauhaus-black mt-1">{100 - detentionPct}%</p>
          </div>
        </div>

        {data.qldJusticeByProgram.length > 0 && (
          <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
            <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
              Top QLD Youth Justice Programs by Spending
            </p>
            <div className="space-y-2">
              {data.qldJusticeByProgram.map((row, i) => {
                const total = Number(row.total) || 0;
                const maxVal = Number(data.qldJusticeByProgram[0]?.total) || 1;
                const width = Math.min(100, (total / maxVal) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-bauhaus-black w-48 truncate">{String(row.program_name)}</span>
                    <div className="flex-1 h-5 bg-gray-100 border-2 border-bauhaus-black relative">
                      <div className="h-full bg-bauhaus-red/70" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-xs font-black text-bauhaus-black w-16 text-right">{money(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <TryItCTA>
          <ToolLink href="/scenarios" label="Run a What-If" description="Model what happens if QLD shifts 20% from detention to diversion" />
          <ToolLink href="/ask" label="Ask Any Question" description="&quot;How much does QLD spend on youth detention vs community programs?&quot;" />
          <ToolLink href="/reports/youth-justice" label="Full Report" description="Complete youth justice funding analysis with evidence linkage" />
        </TryItCTA>
      </section>

      {/* ── S4: Funding Deserts ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Funding Deserts"
          title="Where Need Is Greatest, Funding Is Lowest"
          description="LGAs scored by disadvantage (SEIFA, remoteness) vs funding received. Higher score = greater gap between need and resources. Maximum score: 140."
        />

        <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm mb-6">
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            Worst-Served QLD Communities
          </p>
          {data.qldTopDeserts.map((d, i) => (
            <DesertBar key={i} name={String(d.lga_name)} score={Number(d.desert_score)} remoteness={String(d.remoteness)} />
          ))}
          <p className="text-xs text-bauhaus-muted mt-4">
            Every maximum-score funding desert in Queensland is a Very Remote community
            with a significant First Nations population.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.qldDeserts.map((d, i) => (
            <div key={i} className="border-2 border-bauhaus-black p-3 text-center">
              <p className="text-xl font-black text-bauhaus-red">{Number(d.avg_score)}</p>
              <p className="text-xs font-bold uppercase tracking-wider">{String(d.remoteness).replace(' Australia', '')}</p>
              <p className="text-xs text-bauhaus-muted">{Number(d.lga_count)} LGAs</p>
            </div>
          ))}
        </div>

        <TryItCTA>
          <ToolLink href="/reports/funding-deserts" label="All 1,582 LGAs" description="Complete funding desert analysis across all states" />
          <ToolLink href="/ask" label="Ask About Deserts" description="&quot;Which QLD communities have the highest need and lowest funding?&quot;" />
          <ToolLink href="/graph?mode=justice&topic=indigenous" label="View Network" description="See how funding flows to remote Indigenous communities" />
        </TryItCTA>
      </section>

      {/* ── S5: Community-Controlled Gap ── */}
      <section className="mb-16">
        <SectionHeader
          tag="The Gap"
          title="Over-Monitored, Under-Funded"
          description="Community-controlled organisations are tracked across multiple government systems but receive a fraction of procurement dollars."
        />

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <div className="space-y-6">
              <div>
                <p className="text-5xl font-black text-bauhaus-black">2.15</p>
                <p className="text-sm text-bauhaus-muted mt-1">Average government systems monitoring each community-controlled org</p>
              </div>
              <div>
                <p className="text-5xl font-black text-bauhaus-red">3.2%</p>
                <p className="text-sm text-bauhaus-muted mt-1">Share of federal procurement dollars going to community-controlled organisations</p>
              </div>
            </div>
          </div>
          <div className="border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
            <div className="space-y-6">
              <div>
                <p className="text-5xl font-black text-bauhaus-blue">4,130</p>
                <p className="text-sm text-bauhaus-muted mt-1">Community-controlled organisations mapped in Queensland</p>
              </div>
              <div>
                <p className="text-5xl font-black text-bauhaus-black">1,507</p>
                <p className="text-sm text-bauhaus-muted mt-1">Indigenous corporations registered with ORIC</p>
              </div>
            </div>
          </div>
        </div>

        <TryItCTA>
          <ToolLink href="/reports/power-concentration" label="Power Analysis" description="Cross-system power concentration for community-controlled orgs" />
          <ToolLink href="/ask" label="Ask About Equity" description="&quot;What percentage of procurement goes to Indigenous organisations?&quot;" />
          <ToolLink href="/graph?mode=hubs" label="Network Graph" description="Visualise how community-controlled orgs connect across systems" />
        </TryItCTA>
      </section>

      {/* ── S6: Evidence Exists (ALMA) ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Australian Living Map of Alternatives"
          title="Evidence Exists &mdash; It&apos;s Just Not Connected to Funding"
          description="1,162 evidence-based interventions documented across Australia. Government spending remains concentrated in detention."
        />

        <div className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            QLD Interventions by Type
          </p>
          {data.qldAlmaByType.map((d, i) => (
            <AlmaBar
              key={i}
              type={String(d.type)}
              count={Number(d.cnt)}
              max={Number(data.qldAlmaByType[0]?.cnt) ?? 177}
            />
          ))}
          <p className="text-sm text-bauhaus-muted mt-4">
            Programs with documented evidence of effectiveness across Queensland.
            Diversion, cultural connection, and community-led programs show strong outcomes &mdash;
            yet {detentionPct}% of youth justice dollars flow to detention.
          </p>
        </div>

        <TryItCTA>
          <ToolLink href="/evidence?topic=indigenous" label="Indigenous Evidence" description="Synthesise evidence for First Nations interventions" />
          <ToolLink href="/evidence?topic=youth-justice" label="Youth Justice Evidence" description="What does the evidence say about youth justice alternatives?" />
          <ToolLink href="/evidence?topic=diversion" label="Diversion Evidence" description="Evidence for diversion programs vs detention" />
        </TryItCTA>
      </section>

      {/* ── S7: Commissioner's AI Toolkit ── */}
      <section className="mb-16">
        <SectionHeader
          tag="The AI Toolkit"
          title="What a Commissioner Gets"
          description="Three AI capabilities and six cross-system data layers — all working today. Not a prototype. Not a proposal."
        />

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[
            {
              title: 'Policy Brief AI',
              description: 'Cross-references funding data, evidence, and community voice to draft policy briefs in hours instead of months.',
              href: '/ask',
              cta: 'Try it now',
            },
            {
              title: 'Community Voice Intelligence',
              description: 'NLP analysis of community stories to identify systemic themes and gaps between lived experience and government allocation.',
              href: '/evidence',
              cta: 'See evidence',
            },
            {
              title: 'Diversion Pathway AI',
              description: 'Recommends evidence-based alternatives to detention with outcome data and cost comparisons for specific community profiles.',
              href: '/scenarios',
              cta: 'Run scenario',
            },
          ].map((tool, i) => (
            <Link
              key={i}
              href={tool.href}
              className="border-4 border-bauhaus-black p-5 bauhaus-shadow-sm hover:bg-bauhaus-canvas transition-colors group"
            >
              <p className="font-black text-bauhaus-black text-lg mb-2">{tool.title}</p>
              <p className="text-sm text-bauhaus-muted mb-4">{tool.description}</p>
              <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest group-hover:text-bauhaus-red transition-colors">
                {tool.cta} &rarr;
              </p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { system: 'Federal Procurement', records: '770K contracts', color: 'border-bauhaus-red bg-bauhaus-red/5' },
            { system: 'Justice Funding', records: '71K records', color: 'border-bauhaus-blue bg-bauhaus-blue/5' },
            { system: 'Charity Registry', records: '66K charities', color: 'border-yellow-500 bg-yellow-50' },
            { system: 'Political Donations', records: '312K records', color: 'border-purple-500 bg-purple-50' },
            { system: 'Tax Transparency', records: '24K entities', color: 'border-green-500 bg-green-50' },
            { system: 'Evidence (ALMA)', records: '1,162 programs', color: 'border-orange-500 bg-orange-50' },
          ].map((s, i) => (
            <div key={i} className={`border-2 ${s.color} p-3`}>
              <p className="text-xs font-black uppercase tracking-wider">{s.system}</p>
              <p className="text-lg font-black text-bauhaus-black">{s.records}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── S8: Indigenous Data Sovereignty ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Indigenous Data Sovereignty"
          title="CARE Principles from Day One"
          description="Collective benefit, Authority to control, Responsibility, Ethics &mdash; embedded in the architecture, not bolted on."
        />

        <div className="grid md:grid-cols-4 gap-4">
          {[
            { letter: 'C', word: 'Collective Benefit', desc: 'Data serves communities first. Insights flow back to community-controlled organisations, not extracted by external parties.' },
            { letter: 'A', word: 'Authority to Control', desc: 'First Nations communities govern access to data about themselves. OATSICC partnership ensures Aboriginal authority over Aboriginal data.' },
            { letter: 'R', word: 'Responsibility', desc: 'Those who collect and use data are accountable to community. Transparent AI with auditable reasoning chains.' },
            { letter: 'E', word: 'Ethics', desc: 'Data practices respect cultural authority and self-determination. Counter-surveillance, not surveillance.' },
          ].map((c, i) => (
            <div key={i} className="border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
              <p className="text-3xl font-black text-bauhaus-red mb-1">{c.letter}</p>
              <p className="text-sm font-black uppercase tracking-wider mb-2">{c.word}</p>
              <p className="text-xs text-bauhaus-muted">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── S9: Final CTA ── */}
      <section className="border-4 border-bauhaus-black p-8 bauhaus-shadow-sm text-center mb-10">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">
          Google.org &middot; AI for Government Innovation
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-bauhaus-black mb-4">
          The data already exists. The question is whether<br />
          a Commissioner should have the AI tools to see it.
        </h2>
        <p className="text-bauhaus-muted font-medium max-w-2xl mx-auto mb-6">
          {fmt(entityCount)} entities. {fmt(justiceRecords)} justice funding records.
          {' '}{fmt(almaCount)} evidence-based programs. Eight government systems linked.
          All live. All queryable. Right now.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/graph?mode=justice&topic=youth-justice"
            className="bg-bauhaus-black text-white px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-red transition-colors"
          >
            Explore the Graph
          </Link>
          <Link
            href="/ask"
            className="bg-bauhaus-blue text-white px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-black transition-colors"
          >
            Ask Any Question
          </Link>
          <Link
            href="/scenarios"
            className="border-4 border-bauhaus-black px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-canvas transition-colors"
          >
            Run a Scenario
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
