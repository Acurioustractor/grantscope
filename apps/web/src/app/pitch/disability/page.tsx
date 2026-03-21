import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import Link from 'next/link';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Disability Market Transparency | CivicGraph',
  description: 'When algorithms decide disability plans, who watches the algorithm? Counter-AI transparency for NDIS thin markets.',
  openGraph: {
    title: 'Disability Market Transparency | CivicGraph',
    description: 'Cross-system intelligence for NDIS thin markets. Transparent AI accountability for algorithmic disability budgeting.',
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
    thinMarketSummary,
    qldThinMarkets,
    nationalStats,
    crossSystemStats,
    qldFirstNations,
  ] = await Promise.all([
    q(`SELECT thin_market_status, COUNT(*)::int as lgas, SUM(ndis_participants)::bigint as participants,
        SUM(disability_entities)::bigint as providers, ROUND(AVG(NULLIF(desert_score,0)),1) as avg_desert
      FROM mv_disability_landscape GROUP BY thin_market_status
      ORDER BY CASE thin_market_status WHEN 'CRITICAL' THEN 1 WHEN 'SEVERE' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'ADEQUATE' THEN 4 ELSE 5 END`),

    q(`SELECT lga_name, remoteness, ndis_participants, disability_entities, participants_per_provider,
        thin_market_status, desert_score
      FROM mv_disability_landscape WHERE state = 'QLD' AND ndis_participants > 0
      ORDER BY desert_score DESC NULLS LAST LIMIT 10`),

    q(`SELECT SUM(ndis_participants)::bigint as total_participants,
        COUNT(*) FILTER (WHERE thin_market_status = 'CRITICAL') as critical_lgas,
        COUNT(*) FILTER (WHERE thin_market_status = 'SEVERE') as severe_lgas,
        SUM(disability_entities)::bigint as total_providers
      FROM mv_disability_landscape`),

    q(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE in_ndis_provider = 1) as ndis,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND system_count >= 2) as multi,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_justice_funding = 1) as justice,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_procurement = 1) as procurement,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND in_alma_evidence = 1) as alma,
        COUNT(*) FILTER (WHERE in_ndis_provider = 1 AND is_community_controlled) as community,
        MAX(system_count) as max_systems
      FROM mv_entity_power_index`),

    q(`SELECT remoteness, participant_count, avg_annualised_support
      FROM ndis_first_nations WHERE state = 'QLD'
        AND quarter_date = (SELECT MAX(quarter_date) FROM ndis_first_nations)
        AND remoteness != 'All' ORDER BY remoteness`),
  ]);

  return {
    thinMarketSummary: (thinMarketSummary ?? []) as Row[],
    qldThinMarkets: (qldThinMarkets ?? []) as Row[],
    national: ((nationalStats ?? []) as Row[])[0] || {},
    crossSystem: ((crossSystemStats ?? []) as Row[])[0] || {},
    qldFirstNations: (qldFirstNations ?? []) as Row[],
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HeroStat({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
  return (
    <div className={`border-4 border-bauhaus-black p-6 ${color}`}>
      <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-xs font-bold mt-2 opacity-70">{sub}</p>
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

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'CRITICAL' ? 'bg-bauhaus-red text-white' :
    status === 'SEVERE' ? 'bg-orange-500 text-white' :
    status === 'MODERATE' ? 'bg-bauhaus-yellow text-bauhaus-black' :
    status === 'ADEQUATE' ? 'bg-green-100 text-green-800' :
    'bg-gray-100 text-gray-500';
  return <span className={`inline-block px-2 py-1 text-xs font-black uppercase tracking-widest ${cls}`}>{status}</span>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function DisabilityPitchPage() {
  const data = await getData();
  const nat = data.national;
  const cs = data.crossSystem;

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-10">

      {/* ── S1: Hero ── */}
      <div className="mb-16">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">
          Google.org &middot; AI for Government Innovation
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-bauhaus-black mb-4 leading-tight">
          When algorithms decide disability plans,<br />
          who watches the algorithm?
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-3xl mb-8">
          From mid-2026, NDIS participant plans will be generated by an opaque &ldquo;budget model engine.&rdquo;
          CivicGraph builds the transparency layer &mdash; cross-referencing algorithmic outputs against actual
          support needs, geographic access, and market capacity.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <HeroStat
            value={fmt(Number(nat.total_participants) || 0)}
            label="NDIS Participants"
            sub="Dec 2025 quarter"
            color="bg-bauhaus-black text-white"
          />
          <HeroStat
            value={fmt(Number(nat.critical_lgas) || 0)}
            label="Critical Thin Markets"
            sub="LGAs with zero providers"
            color="bg-bauhaus-red text-white"
          />
          <HeroStat
            value={fmt(Number(cs.ndis) || 0)}
            label="Mapped Providers"
            sub={`Linked across ${Number(cs.max_systems) || 0} systems`}
            color="bg-white text-bauhaus-black"
          />
          <HeroStat
            value="$6.6B"
            label="QLD NDIS Spend"
            sub="Annual committed supports"
            color="bg-bauhaus-blue text-white"
          />
        </div>
      </div>

      {/* ── S2: Counter-AI Thesis ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Counter-AI"
          title="Transparent AI vs Opaque AI"
          description="This isn't anti-technology. It's pro-accountability. Every AI system that affects people's lives should have a transparency layer."
        />

        <div className="grid md:grid-cols-2 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-red/10">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-4">
              NDIS Budget Model Engine
            </p>
            <ul className="space-y-3 text-sm text-bauhaus-black">
              <li className="flex gap-2"><span className="text-bauhaus-red font-black">&#x2717;</span> Opaque algorithmic budgeting</li>
              <li className="flex gap-2"><span className="text-bauhaus-red font-black">&#x2717;</span> No published methodology</li>
              <li className="flex gap-2"><span className="text-bauhaus-red font-black">&#x2717;</span> 660,000 people affected</li>
              <li className="flex gap-2"><span className="text-bauhaus-red font-black">&#x2717;</span> No cross-system context</li>
              <li className="flex gap-2"><span className="text-bauhaus-red font-black">&#x2717;</span> Cannot explain its decisions</li>
            </ul>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue/10">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-4">
              CivicGraph Transparency Layer
            </p>
            <ul className="space-y-3 text-sm text-bauhaus-black">
              <li className="flex gap-2"><span className="text-bauhaus-blue font-black">&#x2713;</span> Cross-system data linkage</li>
              <li className="flex gap-2"><span className="text-bauhaus-blue font-black">&#x2713;</span> Evidence-based reasoning</li>
              <li className="flex gap-2"><span className="text-bauhaus-blue font-black">&#x2713;</span> Open, auditable methodology</li>
              <li className="flex gap-2"><span className="text-bauhaus-blue font-black">&#x2713;</span> Geographic market reality</li>
              <li className="flex gap-2"><span className="text-bauhaus-blue font-black">&#x2713;</span> Explainable AI decisions</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── S3: Thin Markets Crisis ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Thin Markets"
          title="Where NDIS Participants Have No Providers"
          description="A thin market means participants are allocated support they cannot access because no providers exist nearby. This is the invisible cost of market failure."
        />

        <div className="border-4 border-bauhaus-black bg-white mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Status</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">LGAs</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert Score</th>
                </tr>
              </thead>
              <tbody>
                {data.thinMarketSummary.map((row, i) => (
                  <tr key={String(row.thin_market_status)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3"><StatusBadge status={String(row.thin_market_status)} /></td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.lgas))}</td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.participants))}</td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.providers))}</td>
                    <td className="p-3 text-right font-mono font-black">{row.avg_desert ? Number(row.avg_desert).toFixed(0) : '&mdash;'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* QLD Worst 10 */}
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-4">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-1">Queensland Focus</p>
            <h3 className="text-lg font-black">Top 10 worst QLD disability deserts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Remoteness</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Providers</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Status</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Desert</th>
                </tr>
              </thead>
              <tbody>
                {data.qldThinMarkets.map((row, i) => (
                  <tr key={`${row.lga_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{String(row.lga_name)}</td>
                    <td className="p-3 text-xs font-medium text-bauhaus-muted">{String(row.remoteness || '').replace(' Australia', '')}</td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.ndis_participants))}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{fmt(Number(row.disability_entities))}</td>
                    <td className="p-3 text-right"><StatusBadge status={String(row.thin_market_status)} /></td>
                    <td className="p-3 text-right font-mono font-black">{row.desert_score ? Number(row.desert_score).toFixed(0) : '&mdash;'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <TryItCTA>
          <ToolLink href="/ask" label="Ask About Markets" description="&quot;Which QLD communities have NDIS participants but zero disability providers?&quot;" />
          <ToolLink href="/reports/disability" label="Full Report" description="Complete disability market transparency analysis" />
          <ToolLink href="/scenarios" label="Model Solutions" description="What if we deployed mobile providers to thin market LGAs?" />
        </TryItCTA>
      </section>

      {/* ── S4: The Remoteness Cliff ── */}
      <section className="mb-16">
        <SectionHeader
          tag="The Remoteness Cliff"
          title="Provider Distribution Collapses Outside Cities"
          description="NDIS market design assumes provider choice. In remote Australia, there are zero providers. The market doesn't just thin — it disappears."
        />

        <div className="border-4 border-bauhaus-black p-6 bauhaus-shadow-sm">
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">
            NDIS provider availability by remoteness
          </p>
          {[
            { label: 'Major Cities', providers: 100, color: 'bg-bauhaus-blue' },
            { label: 'Inner Regional', providers: 45, color: 'bg-bauhaus-blue' },
            { label: 'Outer Regional', providers: 18, color: 'bg-bauhaus-yellow' },
            { label: 'Remote', providers: 5, color: 'bg-orange-500' },
            { label: 'Very Remote', providers: 0, color: 'bg-bauhaus-red' },
          ].map(bar => (
            <div key={bar.label} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-bauhaus-black">{bar.label}</span>
                <span className="font-black text-bauhaus-black">{bar.providers === 0 ? 'ZERO' : `~${bar.providers}%`}</span>
              </div>
              <div className="h-8 bg-gray-100 border-2 border-bauhaus-black">
                <div className={`h-full ${bar.color}`} style={{ width: `${bar.providers}%` }} />
              </div>
            </div>
          ))}
          <p className="text-sm text-bauhaus-muted mt-4">
            Relative provider availability indexed to Major Cities = 100%. Based on disability entity counts
            per NDIS participant by remoteness classification.
          </p>
        </div>
      </section>

      {/* ── S5: First Nations Disability Gap ── */}
      <section className="mb-16">
        <SectionHeader
          tag="First Nations"
          title="The Disability-Remoteness Intersection"
          description="First Nations NDIS participants in Very Remote areas receive lower plan budgets despite higher service delivery costs and fewer providers."
        />

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">QLD First Nations NDIS</p>
            <h3 className="text-xl font-black">Participants and plan budgets by remoteness</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Remoteness</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Participants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Avg Plan Budget</th>
                </tr>
              </thead>
              <tbody>
                {data.qldFirstNations.map((row, i) => (
                  <tr key={String(row.remoteness)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{String(row.remoteness)}</td>
                    <td className="p-3 text-right font-mono">{row.participant_count ? fmt(Number(row.participant_count)) : '<11'}</td>
                    <td className="p-3 text-right font-mono font-black">
                      {row.avg_annualised_support ? money(Number(row.avg_annualised_support)) : '&mdash;'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t-4 border-bauhaus-black bg-bauhaus-yellow/20">
            <p className="text-sm font-medium text-bauhaus-black/80">
              Very Remote First Nations participants receive <strong>28% less</strong> in average plan budgets
              than Inner Regional &mdash; despite higher service delivery costs and fewer providers.
              An algorithmic budget model without geographic context will entrench this gap.
            </p>
          </div>
        </div>
      </section>

      {/* ── S6: Cross-System Intelligence ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Cross-System"
          title="What CivicGraph Already Sees"
          description="No single government department has this view. CivicGraph links NDIS providers across justice, procurement, charity, and evidence systems."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'NDIS Providers Mapped', value: fmt(Number(cs.ndis) || 0), color: 'text-bauhaus-black' },
            { label: 'In 2+ Systems', value: fmt(Number(cs.multi) || 0), color: 'text-bauhaus-blue' },
            { label: 'Also in Justice', value: fmt(Number(cs.justice) || 0), color: 'text-bauhaus-red' },
            { label: 'Also in Procurement', value: fmt(Number(cs.procurement) || 0), color: 'text-bauhaus-black' },
            { label: 'Community-Controlled', value: fmt(Number(cs.community) || 0), color: 'text-bauhaus-red' },
            { label: 'ALMA Evidence-Backed', value: fmt(Number(cs.alma) || 0), color: 'text-green-700' },
          ].map((item, i) => (
            <div key={i} className="border-4 border-bauhaus-black p-4 bauhaus-shadow-sm text-center">
              <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        <TryItCTA>
          <ToolLink href="/graph" label="View Network" description="Force-directed graph of disability provider connections" />
          <ToolLink href="/ask" label="Ask Cross-System" description="&quot;Which NDIS providers also receive justice funding?&quot;" />
          <ToolLink href="/evidence?topic=ndis" label="Provider Evidence" description="Evidence-based practices for disability service delivery" />
        </TryItCTA>
      </section>

      {/* ── S7: Three AI Capabilities ── */}
      <section className="mb-16">
        <SectionHeader
          tag="AI Capabilities"
          title="Three Intelligence Layers"
          description="Built today. Not conceptual. Not a roadmap. Working AI tools you can try right now."
        />

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              title: 'Market Transparency Engine',
              description: 'Maps every NDIS provider, their geographic coverage, thin market gaps, and cross-system connections. Identifies where the market is failing participants.',
              href: '/reports/disability',
              cta: 'See market data',
              color: 'border-bauhaus-red',
            },
            {
              title: 'Algorithmic Accountability',
              description: 'When the NDIS budget model engine launches, CivicGraph can cross-reference its outputs against geographic reality, provider availability, and evidence.',
              href: '/ask',
              cta: 'Ask a question',
              color: 'border-bauhaus-blue',
            },
            {
              title: 'Evidence-Based Intelligence',
              description: 'Links NDIS providers to ALMA evidence base. Which disability programs have evidence of effectiveness? Which thin markets have evidence-backed solutions?',
              href: '/evidence?topic=ndis',
              cta: 'Explore evidence',
              color: 'border-green-700',
            },
          ].map((tool, i) => (
            <Link
              key={i}
              href={tool.href}
              className={`border-4 ${tool.color} p-5 bauhaus-shadow-sm hover:bg-bauhaus-canvas transition-colors group`}
            >
              <p className="font-black text-bauhaus-black text-lg mb-2">{tool.title}</p>
              <p className="text-sm text-bauhaus-muted mb-4">{tool.description}</p>
              <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest group-hover:text-bauhaus-red transition-colors">
                {tool.cta} &rarr;
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── S8: QLD Disability Plan Alignment ── */}
      <section className="mb-16">
        <SectionHeader
          tag="Policy Alignment"
          title="QLD Disability Plan: CivicGraph Capability Mapping"
          description="How CivicGraph's existing capabilities align with Queensland's disability policy priorities."
        />

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-4 font-black uppercase tracking-widest text-xs w-1/3">QLD Disability Plan Outcome</th>
                  <th className="text-left p-4 font-black uppercase tracking-widest text-xs">CivicGraph Capability</th>
                  <th className="text-center p-4 font-black uppercase tracking-widest text-xs w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { outcome: 'Accessible and inclusive communities', capability: 'Provider gap mapping across all LGAs with NDIS participant counts vs provider density', status: 'LIVE' },
                  { outcome: 'Economic participation', capability: 'Cross-system linkage showing NDIS providers who also hold procurement contracts — employment pathway visibility', status: 'LIVE' },
                  { outcome: 'Health and wellbeing', capability: 'Evidence-based intervention database (ALMA) linked to disability service providers with outcome data', status: 'LIVE' },
                  { outcome: 'Rights, justice and legislation', capability: 'Justice funding × NDIS overlap detection — identifying participants in both systems and service gaps', status: 'LIVE' },
                  { outcome: 'First Nations self-determination', capability: 'Community-controlled org mapping with ORIC registry, cross-system power analysis, CARE principles', status: 'LIVE' },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-4 font-bold text-bauhaus-black">{row.outcome}</td>
                    <td className="p-4 text-bauhaus-muted">{row.capability}</td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-black uppercase tracking-widest">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── S9: Final CTA ── */}
      <section className="border-4 border-bauhaus-black p-8 bauhaus-shadow-sm text-center mb-10">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">
          Google.org &middot; AI for Government Innovation
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-bauhaus-black mb-4">
          Every AI system that affects people&apos;s lives<br />
          should have a transparency layer.
        </h2>
        <p className="text-bauhaus-muted font-medium max-w-2xl mx-auto mb-6">
          {fmt(Number(nat.total_participants) || 0)} NDIS participants.
          {' '}{fmt(Number(nat.critical_lgas) || 0)} critical thin markets.
          {' '}{fmt(Number(cs.ndis) || 0)} providers mapped across {Number(cs.max_systems) || 0} government systems.
          All live. All queryable. Right now.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/reports/disability"
            className="bg-bauhaus-black text-white px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-red transition-colors"
          >
            NDIS Market Data
          </Link>
          <Link
            href="/ask"
            className="bg-bauhaus-blue text-white px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-black transition-colors"
          >
            Ask About Disability
          </Link>
          <Link
            href="/graph"
            className="border-4 border-bauhaus-black px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-canvas transition-colors"
          >
            View Network
          </Link>
          <Link
            href="/reports/disability"
            className="border-4 border-bauhaus-black px-6 py-3 font-black uppercase tracking-widest text-sm hover:bg-bauhaus-canvas transition-colors"
          >
            Full Report
          </Link>
        </div>
      </section>

      {/* Attribution */}
      <footer className="text-center text-xs text-bauhaus-muted py-6">
        <p>CivicGraph &mdash; Decision Infrastructure for Government &amp; Social Sector</p>
        <p className="mt-1">Data sourced from NDIS, AusTender, ACNC, AEC, ROGS, ATO, ORIC, and ALMA (JusticeHub)</p>
      </footer>
    </div>
  );
}
