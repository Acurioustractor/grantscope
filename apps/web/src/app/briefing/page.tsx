import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { BriefingComposer } from './briefing-composer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Briefing Hub | CivicGraph',
  description:
    'Start from a company, funder, procurement pathway, or place and turn the same evidence chain into a memo, pack, report, or story handoff.',
};

type LinkAction = {
  label: string;
  href: string;
};

type StartPoint = {
  eyebrow: string;
  title: string;
  description: string;
  outcome: string;
  primary: LinkAction;
  secondary: LinkAction;
};

type OutputCard = {
  title: string;
  description: string;
  carries: string;
  href: string;
  hrefLabel: string;
};

type EvidenceCard = {
  title: string;
  description: string;
  sources: string[];
};

type AgentCard = {
  title: string;
  description: string;
};

function compactNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
        {title}
      </h2>
      <p className="mt-1 text-sm max-w-3xl" style={{ color: 'var(--ws-text-secondary)' }}>
        {description}
      </p>
    </div>
  );
}

const START_POINTS: StartPoint[] = [
  {
    eyebrow: 'Company / Organisation',
    title: 'Start with the entity that needs a move.',
    description:
      'Pull together company facts, linked entities, funding signals, and relationship context before writing anything.',
    outcome: 'Best when you need a board memo, partner note, or company intelligence pack.',
    primary: { label: 'Compose Board Memo', href: '/briefing?start=company&output=board-memo#composer' },
    secondary: { label: 'Browse Entities', href: '/entities' },
  },
  {
    eyebrow: 'Grant / Funder',
    title: 'Start with the funding pathway.',
    description:
      'Compare grants, foundation logic, and topic coverage, then frame the next move as a brief instead of a search result.',
    outcome: 'Best when you need an opportunity brief, funder read, or topic landscape.',
    primary: { label: 'Compose Funding Brief', href: '/briefing?start=funding&output=funding-brief#composer' },
    secondary: { label: 'Search Funding', href: '/grants' },
  },
  {
    eyebrow: 'Procurement / Market',
    title: 'Start with the procurement decision.',
    description:
      'Review suppliers, shortlist logic, market structure, and approval workflow from the same operating context.',
    outcome: 'Best when you need a tender decision pack or procurement recommendation.',
    primary: { label: 'Compose Tender Pack', href: '/briefing?start=procurement&output=tender-pack#composer' },
    secondary: { label: 'See Market Context', href: '/power' },
  },
  {
    eyebrow: 'Place / Field',
    title: 'Start with the place or system problem.',
    description:
      'Read power, funding concentration, place signals, and under-served territory before pushing a narrative or recommendation.',
    outcome: 'Best when you need a place brief, field scan, or reporting angle.',
    primary: { label: 'Compose Story Handoff', href: '/briefing?start=place&output=story-handoff#composer' },
    secondary: { label: 'Check Data Coverage', href: '/insights' },
  },
];

const OUTPUTS: OutputCard[] = [
  {
    title: 'Board memo',
    description:
      'Turn entity, funder, and network context into a printable memo for leadership, partners, or internal review.',
    carries: 'Entity profile, inbound and outbound relationships, justice funding, and supporting notes.',
    href: '/briefing?start=company&output=board-memo#composer',
    hrefLabel: 'Configure board memo',
  },
  {
    title: 'Funding landscape brief',
    description:
      'Build a topical report that translates the graph into a working view of funders, programs, organisations, and place.',
    carries: 'Topic, geography, top programs, top organisations, and field-level context.',
    href: '/briefing?start=funding&output=funding-brief#composer',
    hrefLabel: 'Configure funding brief',
  },
  {
    title: 'Tender decision pack',
    description:
      'Carry the same evidence into shortlist review, procurement decisions, and sign-off-ready market packs.',
    carries: 'Supplier evidence, review tasks, recommendation text, and approval status.',
    href: '/briefing?start=procurement&output=tender-pack#composer',
    hrefLabel: 'Configure tender pack',
  },
  {
    title: 'Story handoff',
    description:
      'Keep the evidence chain clean so reporting and editorial systems can build company stories or aligned analysis without starting over.',
    carries: 'Place context, power signals, evidence lineage, and a usable narrative brief.',
    href: '/briefing?start=place&output=story-handoff#composer',
    hrefLabel: 'Configure story handoff',
  },
];

const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    title: 'Company and entity identity',
    description: 'Work from the resolved organisation record, not from disconnected notes.',
    sources: ['gs_entities', 'entity_identifiers', 'gs_relationships'],
  },
  {
    title: 'Funding and funders',
    description: 'See the opportunity surface and the historical funding environment in one place.',
    sources: ['grant_opportunities', 'foundations', 'justice_funding'],
  },
  {
    title: 'Procurement and market context',
    description: 'Bring procurement pathways and supplier evidence into the same decision thread.',
    sources: ['austender_contracts', 'procurement shortlists', 'procurement pack exports'],
  },
  {
    title: 'Place, power, and influence',
    description: 'Add place need, power concentration, and influence signals before framing the recommendation.',
    sources: ['postcode_geo', 'seifa_2021', 'political_donations'],
  },
];

const AGENT_CARDS: AgentCard[] = [
  {
    title: 'Scout',
    description: 'Find new opportunities, market movement, and relevant signals worth briefing.',
  },
  {
    title: 'Link',
    description: 'Resolve ABNs, entities, places, and related organisations into one clean working context.',
  },
  {
    title: 'Draft',
    description: 'Assemble memo sections, report structure, and recommendation text from approved evidence.',
  },
  {
    title: 'Story layer',
    description: 'Hand off a clear evidence chain so narrative systems can build company stories and aligned analysis.',
  },
];

export default async function BriefingPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/briefing');
  }

  const db = getServiceSupabase();
  const [
    { count: openGrantCount },
    { count: foundationCount },
    { count: entityCount },
    { count: contractCount },
  ] = await Promise.all([
    db.from('grant_opportunities').select('*', { count: 'exact', head: true }).gt('deadline', new Date().toISOString()),
    db.from('foundations').select('*', { count: 'exact', head: true }),
    db.from('gs_entities').select('*', { count: 'exact', head: true }),
    db.from('austender_contracts').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
      <WorkspacePageHeader
        eyebrow="Decision Infrastructure"
        title="Briefing Hub"
        description="Start from a company, funding path, procurement decision, or place. Carry one evidence chain through memo, pack, report, and story handoff."
        actions={(
          <>
            <Link
              href="/briefing?start=company&output=board-memo#composer"
              className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--ws-accent)]"
              style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
            >
              Compose Brief
            </Link>
            <Link
              href="/power"
              className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--ws-accent)]"
              style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
            >
              Open Power Map
            </Link>
            <Link
              href="/insights"
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{ background: 'var(--ws-accent)', color: '#fff' }}
            >
              Story Handoff
            </Link>
          </>
        )}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="space-y-6">
          <CardShell>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                  Start With Action
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
                  The product should route people into the next decision, not into a bigger dashboard.
                </h2>
                <p className="mt-3 text-sm max-w-2xl" style={{ color: 'var(--ws-text-secondary)' }}>
                  Use this page to decide what the subject is, what the output needs to be, and which evidence needs to travel with it.
                  Company information, procurement opportunity analysis, reporting context, and story prep should stay connected.
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      title: 'Start from the decision',
                      text: 'Pick the company, opportunity, market, or place first.',
                    },
                    {
                      title: 'Reuse the same evidence',
                      text: 'Do not rebuild context when moving from memo to report to story.',
                    },
                    {
                      title: 'Let agents support judgement',
                      text: 'Agents should scout, link, and draft. The team still decides.',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border px-4 py-3"
                      style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                    >
                      <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Open funding lines', value: compactNumber(openGrantCount) },
                  { label: 'Foundations indexed', value: compactNumber(foundationCount) },
                  { label: 'Entities linked', value: compactNumber(entityCount) },
                  { label: 'Contracts loaded', value: compactNumber(contractCount) },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border px-4 py-4"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                  >
                    <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>
                      {item.value}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardShell>

          <BriefingComposer />

          <section>
            <SectionTitle
              eyebrow="Choose The Start Point"
              title="Pick the subject of the decision."
              description="Each route starts from a different subject, but each one should still end with a memo, recommendation, or clean handoff."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {START_POINTS.map((item) => (
                <CardShell key={item.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--ws-text-secondary)' }}>
                    {item.description}
                  </p>
                  <p className="mt-3 text-xs leading-5" style={{ color: 'var(--ws-text-tertiary)' }}>
                    {item.outcome}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={item.primary.href}
                      className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                      style={{ background: 'var(--ws-accent)', color: '#fff' }}
                    >
                      {item.primary.label}
                    </Link>
                    <Link
                      href={item.secondary.href}
                      className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--ws-accent)]"
                      style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                    >
                      {item.secondary.label}
                    </Link>
                  </div>
                </CardShell>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle
              eyebrow="Choose The Output"
              title="One context, four outputs."
              description="The same evidence should support internal decision-making, procurement, reporting, and narrative work without spawning four different research processes."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OUTPUTS.map((item) => (
                <CardShell key={item.title}>
                  <h3 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--ws-text-secondary)' }}>
                    {item.description}
                  </p>
                  <div
                    className="mt-4 rounded-lg border px-4 py-3"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                      Carries forward
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--ws-text)' }}>
                      {item.carries}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    className="mt-4 inline-flex rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    style={{ background: 'var(--ws-surface-0)', color: 'var(--ws-accent)' }}
                  >
                    {item.hrefLabel}
                  </Link>
                </CardShell>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle
              eyebrow="Evidence Chain"
              title="Keep the evidence visible."
              description="A useful briefing flow shows where claims came from, which systems are connected, and what kind of confidence the team should have."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {EVIDENCE_CARDS.map((item) => (
                <CardShell key={item.title}>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--ws-text)' }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--ws-text-secondary)' }}>
                    {item.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.sources.map((source) => (
                      <span
                        key={source}
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ background: 'var(--ws-surface-0)', color: 'var(--ws-text-secondary)' }}
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </CardShell>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <CardShell>
            <SectionTitle
              eyebrow="Agent Support"
              title="Agents should reduce lift, not hide the reasoning."
              description="Use agents to do the repetitive work around evidence gathering, linking, and drafting. Keep the decision and sign-off human."
            />
            <div className="space-y-3">
              {AGENT_CARDS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border px-4 py-3"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Story Handoff"
              title="Bridge to the narrative layer."
              description="This hub should make it easy to move from company information and procurement analysis into a story-ready structure without re-researching the basics."
            />
            <div className="space-y-3 text-sm" style={{ color: 'var(--ws-text-secondary)' }}>
              <p>
                Treat the narrative layer as a handoff from the same operating context: company facts, linked organisations,
                procurement signals, place context, and the recommendation logic that came out of the work.
              </p>
              <p>
                That keeps company stories, reporting, and aligned analysis grounded in the same evidence chain instead of becoming a separate editorial exercise.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/insights"
                className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{ background: 'var(--ws-accent)', color: '#fff' }}
              >
                Open clarity layer
              </Link>
              <Link
                href="/reports"
                className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--ws-accent)]"
                style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
              >
                Open reporting
              </Link>
            </div>
          </CardShell>

          <CardShell>
            <SectionTitle
              eyebrow="Run The Loop"
              title="Use this sequence."
              description="Keep the product flow short enough that someone can move from signal to recommendation in one sitting."
            />
            <ol className="space-y-3">
              {[
                'Choose the subject: company, funder, procurement path, or place.',
                'Pull the evidence that matters and drop what does not affect the decision.',
                'Generate the right output: memo, pack, report, or story handoff.',
              ].map((item, index) => (
                <li key={item} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: 'var(--ws-surface-0)', color: 'var(--ws-text)' }}
                  >
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6" style={{ color: 'var(--ws-text-secondary)' }}>
                    {item}
                  </p>
                </li>
              ))}
            </ol>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
