import { fmt } from '@/lib/format';
import { UnifiedSearch } from './components/unified-search';

export const dynamic = 'force-dynamic';

type HomeStats = {
  totalGrants: number;
  totalFoundations: number;
  totalPrograms: number;
  totalEntities: number;
  totalRelationships: number;
  donorContractorCount: number;
  revolvingDoorCount: number;
};

const EMPTY_STATS: HomeStats = {
  totalGrants: 0,
  totalFoundations: 0,
  totalPrograms: 0,
  totalEntities: 0,
  totalRelationships: 0,
  donorContractorCount: 0,
  revolvingDoorCount: 0,
};

// Verified from GrantScope Supabase on 2026-04-29.
// The homepage should not block on live aggregate counts; those calls can exceed
// the dev/runtime statement timeout on large tables and previously rendered 0s.
const VERIFIED_HOME_STATS: HomeStats = {
  totalGrants: 32018,
  totalFoundations: 10918,
  totalPrograms: 3296,
  totalEntities: 591761,
  totalRelationships: 1526943,
  donorContractorCount: 1442,
  revolvingDoorCount: 6628,
};

const DATA_SNAPSHOT_LABEL = 'April 2026 data snapshot';

async function getStats() {
  return VERIFIED_HOME_STATS;
}

export default async function HomePage() {
  let stats = EMPTY_STATS;

  try {
    stats = await getStats();
  } catch {
    // DB not yet configured
  }

  const scaleLine =
    stats.totalEntities > 0 && stats.totalRelationships > 0
      ? `${fmt(stats.totalEntities)} resolved entities. ${fmt(stats.totalRelationships)} cross-system relationships. ${fmt(stats.totalGrants)} indexed grant records. One public graph.`
      : 'Resolved entities, cross-system relationships, and live opportunities in one public graph.';

  const thesisLine =
    stats.donorContractorCount > 0
      ? `${fmt(stats.donorContractorCount)} entities already flagged as donor-contractors — the same orgs giving political money and winning government work. This is what the atlas is for.`
      : 'Built so community organisations, journalists, and researchers can see the system they operate inside and act on it.';

  return (
    <div className="space-y-16 pb-10">
      <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8 sm:p-12 lg:p-14">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.35em] text-bauhaus-yellow">
              Australia&rsquo;s Accountability Atlas &middot;{' '}
              <a href="/about/curious-tractor" className="underline decoration-bauhaus-yellow/40 underline-offset-4 hover:decoration-bauhaus-yellow">
                A Curious Tractor
              </a>
            </p>
            <h1 className="mb-6 text-4xl font-black leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl">
              See How Power
              <br />
              Actually Moves.
            </h1>
            <p className="max-w-2xl text-lg font-medium leading-relaxed text-white/72 sm:text-xl">
              CivicGraph is the public graph of Australian money, power, and accountability. Contracts,
              donations, grants, boards, and lived outcomes resolved into one picture. Built for the
              organisations, journalists, and communities who want to act on what they find, not wait for
              someone else to fix it.
            </p>
            <p className="mt-5 max-w-2xl text-sm font-bold leading-relaxed text-white/55">
              {scaleLine} {thesisLine}
            </p>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-white/35">
              {DATA_SNAPSHOT_LABEL}
            </p>

            <div className="mt-10 max-w-3xl">
              <UnifiedSearch />
            </div>

            <div className="mt-8 flex flex-wrap gap-0">
              <a
                href="/reports"
                className="border-4 border-bauhaus-black bg-bauhaus-red px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
              >
                Read The Investigations
              </a>
              <a
                href="/graph"
                className="border-y-4 border-r-4 border-bauhaus-black bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
              >
                Explore The Graph
              </a>
              <a
                href="/support"
                className="border-y-4 border-r-4 border-bauhaus-black bg-bauhaus-black px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-blue"
              >
                Partner With Us
              </a>
            </div>
          </div>

          <div className="border-t-4 border-bauhaus-black bg-bauhaus-canvas lg:border-l-4 lg:border-t-0">
            <div className="grid h-full grid-cols-1 divide-y-4 divide-bauhaus-black">
              <div className="p-8 sm:p-10">
                <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
                  What The Atlas Does
                </p>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      title: 'Expose',
                      copy: 'Who holds power, where money flows, who is cut out. Across contracts, donations, grants, boards, and lived outcomes.',
                    },
                    {
                      title: 'Resolve',
                      copy: 'The same organisation across AusTender, ACNC, AEC, and state registers. Entity resolution nobody else does.',
                    },
                    {
                      title: 'Publish',
                      copy: 'Flagship investigations: Consulting Class, Indigenous Proxy Problem, revolving door, board interlocks.',
                    },
                    {
                      title: 'Enable',
                      copy: 'Free for community orgs, journalists, and researchers. Track action rather than wait for others.',
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
                  { label: 'Grants', value: fmt(stats.totalGrants) || '0', tone: 'bg-bauhaus-blue text-white' },
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
              title: 'For Community Organisations',
              copy: 'Understand the ecosystem you operate in. Find potential partners, unexpected funders, and the procurement pathways you&rsquo;ve been locked out of.',
            },
            {
              title: 'For Journalists And Researchers',
              copy: 'Query the atlas directly. Follow the money. Cross-reference boards, contracts, and donations across every system. Evidence for the next investigation.',
            },
            {
              title: 'For Communities Pushing Back',
              copy: 'Who&rsquo;s taking the money in your region? Who&rsquo;s being cut out? Accountability briefs and data you can put in front of your MP, your council, your funders.',
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
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">The Curious Tractor Portfolio</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black sm:text-4xl">
            Four Lenses. One Philosophy.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            CivicGraph is civic infrastructure inside the A Curious Tractor portfolio. Track action rather
            than wait for others. Each project is a different lens on the same civil society operating
            system.
          </p>
        </div>

        <div className="grid gap-0 md:grid-cols-4">
          {[
            ['CivicGraph', 'The power atlas. Who holds it, where it flows, who&rsquo;s cut out. Contracts, donations, grants, boards in one graph.'],
            ['JusticeHub', 'Sector evidence. ALMA interventions, outcomes, what actually works for youth justice and community-led change.'],
            ['Empathy Ledger', 'First-person stories from inside the systems. The lived reality behind the data the atlas exposes.'],
            ['Goods', 'Commerce with accountability. Buy from community-controlled and Indigenous-led organisations doing the work.'],
          ].map(([title, copy], index) => (
            <div
              key={title as string}
              className={`p-6 sm:p-8 ${index < 3 ? 'border-b-4 border-bauhaus-black md:border-b-0 md:border-r-4' : ''}`}
            >
              <p className="text-lg font-black text-bauhaus-black">{title}</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted" dangerouslySetInnerHTML={{ __html: copy as string }} />
            </div>
          ))}
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Live Investigations</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black sm:text-4xl">
            What The Atlas Has Already Found
          </h2>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            The reports aren&rsquo;t marketing. They&rsquo;re the product in action. Each one uses the same
            live graph to surface patterns that were previously scattered across a dozen disconnected
            government registers.
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-4">
          {[
            ['Consulting Class', '$9.1B in government contracts to 7 firms. $10.5M in donations. 863:1 ROI on political giving. The Donate → Advise → Implement pattern.'],
            ['Indigenous Proxy', '57% of &ldquo;Indigenous funding&rdquo; flows to non-Indigenous organisations. Where the money actually lands vs. where it&rsquo;s promised.'],
            ['Revolving Door', `Entities with two or more influence vectors: lobbying, donations, contracts, funding. ${fmt(stats.revolvingDoorCount)} orgs mapped, scored by concentration.`],
            ['Board Interlocks', 'People sitting on multiple boards across funders, recipients, and contractors. Who&rsquo;s adjudicating whose funding.'],
          ].map(([title, copy], index) => (
            <div
              key={title as string}
              className={`p-6 sm:p-8 ${index < 3 ? 'border-b-4 border-bauhaus-black md:border-b-0 md:border-r-4' : ''}`}
            >
              <p className="text-lg font-black text-bauhaus-black">{title}</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted" dangerouslySetInnerHTML={{ __html: copy as string }} />
            </div>
          ))}
        </div>
        <div className="border-t-4 border-bauhaus-black bg-bauhaus-canvas px-8 py-5 text-center">
          <a
            href="/reports"
            className="inline-block text-xs font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-red transition-colors"
          >
            See all investigations &rarr;
          </a>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border-4 border-bauhaus-black bg-white p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Why This Matters</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black">
            Nobody Else Connects These Systems.
          </h2>
          <div className="mt-6 space-y-4">
            {[
              'AusTender shows contracts. AEC shows donations. ACNC shows charities. Nobody joins them.',
              'Two years of entity resolution across every public Australian dataset.',
              'Community-controlled and Indigenous-led organisations flagged and searchable.',
              'Published under open access for researchers, journalists, and communities.',
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
            Track Action Rather Than Wait
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            The Atlas Is A Tool For Acting, Not A Dashboard.
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/70">
            The Four Corners episode might never come. The Royal Commission might not see this pattern. The
            Auditor General is five years behind. CivicGraph exists so communities, journalists, and small
            organisations don&rsquo;t have to wait for institutions to get there. The evidence is here.
            Take it. Use it. Act.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              'Contracts',
              'Donations',
              'Grants',
              'Boards',
              'Lobbying',
              'ALMA Evidence',
              'Place',
              'Indigenous',
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
                label: 'donor-contractor entities already flagged in the graph',
              },
              {
                value: fmt(stats.totalRelationships) || '0',
                label: 'cross-system relationships available for investigation',
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
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-muted">Self-Funded Civic Infrastructure</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-bauhaus-black sm:text-4xl">
            Free For The People It&rsquo;s Built For.
          </h2>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          {[
            {
              title: 'Communities',
              copy: 'Small organisations, Indigenous-led groups, and community orgs use CivicGraph free. No tiers. No gates. This is what it exists for.',
              tone: 'bg-white',
            },
            {
              title: 'Journalism & Research',
              copy: 'Investigative journalists and researchers get data access, collaboration on stories, and co-production. Reach out — we want your byline.',
              tone: 'bg-bauhaus-red text-white',
            },
            {
              title: 'Institutions',
              copy: 'Government agencies, universities, and peak bodies commission custom research, briefings, and bespoke analyses. Revenue funds the public good.',
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
            Built by A Curious Tractor. Self-funded. No investors. No customers to keep quiet for. Track action rather than wait for others.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/support"
              className="inline-block border-4 border-white bg-white px-8 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
            >
              Partner With Us
            </a>
            <a
              href="/reports"
              className="inline-block border-4 border-white px-8 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
            >
              Read The Investigations
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
