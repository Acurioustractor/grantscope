import { getServiceSupabase } from '@/lib/supabase';
import { fmt } from '@/lib/format';
import { UnifiedSearch } from './components/unified-search';

export const dynamic = 'force-dynamic';

async function getDonorContractorHeadlineStats(
  supabase: ReturnType<typeof getServiceSupabase>,
) {
  const [{ count }, { data }] = await Promise.all([
    supabase.from('mv_gs_donor_contractors').select('gs_id', { count: 'exact', head: true }),
    supabase.from('mv_gs_donor_contractors').select('total_donated, total_contract_value'),
  ]);

  let totalDonated = 0;
  let totalContracts = 0;

  for (const row of data || []) {
    totalDonated += Number(row.total_donated || 0);
    totalContracts += Number(row.total_contract_value || 0);
  }

  return {
    count: count || 0,
    totalDonated,
    totalContracts,
  };
}

/** Safe count helper — returns 0 on failure instead of throwing */
async function safeCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count } = await query;
    return count || 0;
  } catch {
    return 0;
  }
}

async function getStats() {
  const supabase = getServiceSupabase();

  const [
    totalGrants,
    totalFoundations,
    profiledFoundations,
    openGrants,
    totalPrograms,
    totalEntities,
    totalRelationships,
    donorContractorStats,
  ] = await Promise.all([
    safeCount(supabase.from('grant_opportunities').select('*', { count: 'exact', head: true })),
    safeCount(supabase.from('foundations').select('*', { count: 'exact', head: true })),
    safeCount(
      supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    ),
    safeCount(
      supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).gt('closes_at', new Date().toISOString()),
    ),
    safeCount(
      supabase.from('foundation_programs').select('*', { count: 'exact', head: true }).in('status', ['open', 'closed']),
    ),
    safeCount(supabase.from('gs_entities').select('*', { count: 'estimated', head: true })),
    safeCount(supabase.from('gs_relationships').select('*', { count: 'estimated', head: true })),
    getDonorContractorHeadlineStats(supabase),
  ]);

  let sourceCount = 0;
  try {
    const { data: sourceSample } = await supabase.from('grant_opportunities').select('source').limit(10000);
    sourceCount = sourceSample ? new Set(sourceSample.map((row: { source: string }) => row.source)).size : 0;
  } catch {
    sourceCount = 0;
  }

  return {
    totalGrants,
    totalFoundations,
    profiledFoundations,
    openGrants,
    totalPrograms,
    totalEntities,
    totalRelationships,
    donorContractorCount: donorContractorStats.count,
    sourceCount,
  };
}

export default async function HomePage() {
  let stats = {
    totalGrants: 0,
    totalFoundations: 0,
    profiledFoundations: 0,
    openGrants: 0,
    totalPrograms: 0,
    totalEntities: 0,
    totalRelationships: 0,
    donorContractorCount: 0,
    sourceCount: 0,
  };

  try {
    stats = await getStats();
  } catch {
    // DB not yet configured
  }

  const discoveryLine =
    stats.totalGrants > 0 && stats.totalFoundations > 0 && stats.totalPrograms > 0
      ? `Search ${fmt(stats.totalGrants)} grant opportunities, track ${fmt(stats.totalPrograms)} foundation programs, and prospect across ${fmt(stats.totalFoundations)} funders from one workflow.`
      : 'Track grants, foundation programs, and prospecting signals from one workflow.';

  const evidenceLine =
    stats.sourceCount > 0 && stats.totalEntities > 0 && stats.totalRelationships > 0
      ? `Behind the pipeline sits ${fmt(stats.sourceCount)} connected sources, ${fmt(stats.totalEntities)} entities, and ${fmt(stats.totalRelationships)} relationship edges.`
      : 'Behind the pipeline sits a connected public-data graph, not a static grants directory.';

  return (
    <div className="space-y-16 pb-10">
      <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8 sm:p-12 lg:p-14">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.35em] text-bauhaus-yellow">
              Funding, Power, Procurement, And Reporting
            </p>
            <h1 className="mb-6 text-4xl font-black leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl">
              See What Is Happening.
              <br />
              Decide What To Do Next.
            </h1>
            <p className="max-w-2xl text-lg font-medium leading-relaxed text-white/72 sm:text-xl">
              CivicGraph starts with an always-on funding pipeline, then uses the same graph to read
              companies, procurement pathways, philanthropy, and place. The point is not to show off the
              data. It is to help a team act, write the brief, and build a reporting or story surface from
              the same evidence chain.
            </p>
            <p className="mt-5 max-w-2xl text-sm font-bold leading-relaxed text-white/55">
              {discoveryLine} {evidenceLine}
            </p>

            <div className="mt-10 max-w-3xl">
              <UnifiedSearch />
            </div>

            <div className="mt-8 flex flex-wrap gap-0">
              <a
                href="/register"
                className="border-4 border-bauhaus-black bg-bauhaus-red px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
              >
                Start Free
              </a>
              <a
                href="/reports/civicgraph-thesis"
                className="border-y-4 border-r-4 border-bauhaus-black bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
              >
                Read The Thesis
              </a>
              <a
                href="/support"
                className="border-y-4 border-r-4 border-bauhaus-black bg-bauhaus-black px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-blue"
              >
                View Pricing
              </a>
            </div>
          </div>

          <div className="border-t-4 border-bauhaus-black bg-bauhaus-canvas lg:border-l-4 lg:border-t-0">
            <div className="grid h-full grid-cols-1 divide-y-4 divide-bauhaus-black">
              <div className="p-8 sm:p-10">
                <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
                  The Decision Loop
                </p>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      title: 'See',
                      copy: 'Track opportunities, foundations, company records, and movement in the field from one graph.',
                    },
                    {
                      title: 'Decide',
                      copy: 'Compare fit, timing, procurement context, and power signals before you commit the team.',
                    },
                    {
                      title: 'Brief',
                      copy: 'Turn the same evidence into a board memo, partner pack, procurement note, or next-action export.',
                    },
                    {
                      title: 'Tell',
                      copy: 'Carry approved context into reporting and company-story surfaces rather than rebuilding the argument from scratch.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="border-4 border-bauhaus-black bg-white p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{item.title}</p>
                      <p className="mt-2 text-sm font-medium text-bauhaus-muted">{item.copy}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2">
                {[
                  { label: 'Open Now', value: fmt(stats.openGrants) || '0', tone: 'bg-bauhaus-blue text-white' },
                  { label: 'Foundations', value: fmt(stats.totalFoundations) || '0', tone: 'bg-white text-bauhaus-black' },
                  { label: 'Entities', value: fmt(stats.totalEntities) || '0', tone: 'bg-bauhaus-red text-white' },
                  { label: 'Links', value: fmt(stats.totalRelationships) || '0', tone: 'bg-bauhaus-yellow text-bauhaus-black' },
                ].map((item) => (
                  <div key={item.label} className={`border-b-4 border-r-4 border-bauhaus-black p-6 last:border-r-0 [&:nth-child(n+3)]:border-b-0 ${item.tone}`}>
                    <p className="text-3xl font-black tabular-nums sm:text-4xl">{item.value}</p>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-widest opacity-70">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-white">
        <div className="grid gap-0 md:grid-cols-3">
          {[
            {
              title: 'For Funding Teams',
              copy: 'Run the live pipeline, keep signal over noise, and generate the next brief without rebuilding the research every week.',
            },
            {
              title: 'For Place-Based Funders And Commissioners',
              copy: 'Use the same graph to understand who is credible, where money already flows, what procurement paths exist, and what is still missing.',
            },
            {
              title: 'For Research, Reporting, And Story Teams',
              copy: 'Move from raw company or field data into defensible public argument, partner reporting, and story-ready context.',
            },
          ].map((card, index) => (
            <div
              key={card.title}
              className={`p-8 ${index < 2 ? 'border-b-4 border-bauhaus-black md:border-b-0 md:border-r-4' : ''}`}
            >
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Built For</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-bauhaus-black">{card.title}</h2>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{card.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-bauhaus-canvas">
        <div className="border-b-4 border-bauhaus-black bg-white p-8 text-center sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">How It Works</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black sm:text-4xl">
            One Workflow. Four Outputs.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            The product should not feel like a directory or a demo. It should feel like a decision workspace
            that can generate the next move, the next brief, and the next narrative from one shared base.
          </p>
        </div>

        <div className="grid gap-0 md:grid-cols-4">
          {[
            ['1. See Reality', 'Follow the live graph across grants, funders, entities, place, and procurement context.'],
            ['2. Choose A Move', 'Rank what matters now instead of forcing people to browse disconnected modules.'],
            ['3. Build The Brief', 'Generate a memo, pack, or report with a visible evidence chain.'],
            ['4. Tell The Story', 'Carry the approved analysis into reporting and Empathy Ledger-style narrative work.'],
          ].map(([title, copy], index) => (
            <div
              key={title}
              className={`p-6 sm:p-8 ${index < 3 ? 'border-b-4 border-bauhaus-black md:border-b-0 md:border-r-4' : ''}`}
            >
              <p className="text-lg font-black text-bauhaus-black">{title}</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Agent Support</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black sm:text-4xl">
            Same Evidence Chain. Different Agents.
          </h2>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            Agents should not create a second system. They should keep the main loop moving: scout what changed,
            link the relevant entities, draft the next pack, then prepare reporting or story outputs from the same
            underlying context.
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-4">
          {[
            ['Scout', 'Watches frontier pages, deadlines, and funder movement so the team sees what changed first.'],
            ['Analyst', 'Connects company, foundation, procurement, and place data into a usable decision view.'],
            ['Brief Builder', 'Turns the evidence into board notes, partner packs, and opportunity memos.'],
            ['Story Layer', 'Prepares approved analysis for reporting and narrative outputs instead of leaving it trapped in ops.'],
          ].map(([title, copy], index) => (
            <div
              key={title}
              className={`p-6 sm:p-8 ${index < 3 ? 'border-b-4 border-bauhaus-black md:border-b-0 md:border-r-4' : ''}`}
            >
              <p className="text-lg font-black text-bauhaus-black">{title}</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border-4 border-bauhaus-black bg-white p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Why It Wins</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black">
            Better Than A Static Grants Product
          </h2>
          <div className="mt-6 space-y-4">
            {[
              'Continuous frontier polling instead of one-off scraping.',
              'Entity and relationship context, not just opportunity rows.',
              'Foundation, procurement, place, and company data in one surface.',
              'The same context can drive alerts, briefs, reporting, and stories.',
            ].map((line) => (
              <div key={line} className="flex gap-3 border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
                <span className="text-lg font-black text-bauhaus-red">+</span>
                <p className="text-sm font-bold text-bauhaus-black">{line}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-black p-8 text-white sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">
            From Signal To Story
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            Company Data That Can Become A Brief Or A Story.
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/70">
            CivicGraph should be able to start with an entity, a field, or a procurement pathway, then
            carry that analysis forward into reporting and narrative work. That is where the bridge to
            Empathy Ledger becomes valuable: shared context, governed voice, and a cleaner path from
            operational evidence to public story.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              'Company profile',
              'Funder fit',
              'Procurement read',
              'Place context',
              'Evidence chain',
              'Reporting narrative',
            ].map((chip, index) => (
              <span
                key={chip}
                className={`border-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                  index % 3 === 0
                    ? 'border-bauhaus-yellow/40 bg-bauhaus-yellow/10 text-bauhaus-yellow'
                    : index % 3 === 1
                      ? 'border-white/20 bg-white/5 text-white/70'
                      : 'border-bauhaus-blue/40 bg-bauhaus-blue/10 text-bauhaus-blue'
                }`}
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                value: fmt(stats.donorContractorCount) || '0',
                label: 'linked power cases already visible in the graph',
              },
              {
                value: fmt(stats.totalRelationships) || '0',
                label: 'relationship edges available for analysis, packs, and reporting',
              },
            ].map((item) => (
              <div key={item.label} className="border-4 border-white/20 p-5">
                <p className="text-3xl font-black text-bauhaus-yellow">{item.value}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-widest text-white/45">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-muted">Paid Plans Focus On Outcomes</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black sm:text-4xl">
            What People Pay For
          </h2>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          {[
            {
              title: 'Professional',
              copy: 'Best for solo grant consultants and grants managers who need better matching, alerts, and a cleaner pipeline.',
              tone: 'bg-white',
            },
            {
              title: 'Organisation',
              copy: 'Best for teams that need shared tracking, briefing, reporting, and a consistent prospecting workflow across multiple submissions.',
              tone: 'bg-bauhaus-red text-white',
            },
            {
              title: 'Intelligence / Enterprise',
              copy: 'Good later for portfolio intelligence, procurement analysis, reporting pipelines, and API workflows. Valuable, but not the first wedge.',
              tone: 'bg-bauhaus-canvas',
            },
          ].map((item, index) => (
            <div
              key={item.title}
              className={`${item.tone} p-8 sm:p-10 ${index < 2 ? 'border-b-4 border-bauhaus-black md:border-b-0 md:border-r-4' : ''}`}
            >
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">{item.title}</p>
              <p className={`mt-4 text-sm font-medium leading-relaxed ${item.tone.includes('text-white') ? 'text-white/75' : 'text-bauhaus-muted'}`}>
                {item.copy}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t-4 border-bauhaus-black bg-bauhaus-black px-8 py-6 text-center text-white">
          <p className="text-sm font-bold text-white/70">
            Sell the pipeline first. Let the broader data graph strengthen the proof, not dilute the message.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/support"
              className="inline-block border-4 border-white bg-white px-8 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
            >
              See Plans
            </a>
            <a
              href="/register"
              className="inline-block border-4 border-white px-8 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
            >
              Start Free
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
