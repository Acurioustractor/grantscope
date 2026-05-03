import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  getOpportunityIntelligence,
  type OpportunityProjectState,
  type OpportunityRelationshipContact,
  type OpportunitySignal,
  type OpportunitySignalLane,
  type OpportunitySignalSource,
  type OpportunitySourceHealth,
} from '@/lib/opportunity-intelligence';
import {
  buildOpportunitySystemSweep,
  type GoodsLaneSweep,
  type GoodsRoadmapPhase,
  type OfflineSourceGap,
  type ProjectSweepRow,
  type SweepCoverage,
  type SweepPriority,
} from '@/lib/opportunity-system-sweep';
import {
  getGoodsReadinessSnapshot,
  type GoodsGovernanceReadinessItem,
  type GoodsReadinessChecklistItem,
  type GoodsReadinessSnapshot,
  type GoodsReadinessSourceHealth,
  type GoodsTopBuyer,
  type GoodsTopCommunity,
  type GoodsTopSignal,
} from '@/lib/goods-readiness-snapshot';
import { getServiceSupabase } from '@/lib/supabase';
import {
  ACT_DEEP_REVIEW_FINDINGS,
  ACT_KNOWLEDGE_LOOP,
  ACT_OPERATING_LAYERS,
  ACT_POSITION,
  ACT_PROJECT_STATES,
  ACT_ROLE_PATTERNS,
  BFGN_PARTNER_ORGANISATIONS,
  BFGN_MAY_2026_PEOPLE,
  BFGN_MAY_2026_SIGNALS,
  ECOSYSTEM_QUERY_PACKS,
  actionTypeLabel,
  rankedEcosystemOpportunities,
  rankedEcosystemActions,
  opportunityRoleLabel,
  opportunityThemeLabel,
  presenceLabel,
  projectLayerLabel,
  projectReadinessLabel,
  reviewStatusLabel,
  type EcosystemAction,
  type CivicGraphPresence,
  type ActRole,
  type ActProjectLayer,
  type ActProjectReadiness,
  type ActReviewFinding,
} from '@/lib/opportunity-alignment';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ACT Opportunity Ecosystem - CivicGraph',
  description:
    'A Curious Tractor opportunity alignment map for the BFGN May 2026 opportunity set, with CivicGraph positioning, partners, signals, and query paths.',
};

interface ActEntityRow {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string | null;
  sector: string | null;
  postcode: string | null;
  state: string | null;
  lga_name: string | null;
}

interface SeqCoverageRow {
  lga_name: string;
  entity_count: number;
}

interface GrantIndexRow {
  id: string;
  name: string;
  provider: string | null;
  closes_at: string | null;
  deadline: string | null;
  amount_min: number | null;
  amount_max: number | null;
  url: string | null;
}

const SEQ_LGAS = [
  'Brisbane',
  'Gold Coast',
  'Ipswich',
  'Lockyer Valley',
  'Logan',
  'Moreton Bay',
  'Noosa',
  'Redland',
  'Scenic Rim',
  'Somerset',
  'Sunshine Coast',
  'Toowoomba',
];

const FALLBACK_SEQ_COVERAGE: SeqCoverageRow[] = [
  { lga_name: 'Brisbane', entity_count: 15179 },
  { lga_name: 'Gold Coast', entity_count: 5353 },
  { lga_name: 'Moreton Bay', entity_count: 3316 },
  { lga_name: 'Sunshine Coast', entity_count: 2872 },
  { lga_name: 'Logan', entity_count: 1930 },
  { lga_name: 'Scenic Rim', entity_count: 1818 },
  { lga_name: 'Toowoomba', entity_count: 1650 },
  { lga_name: 'Redland', entity_count: 1357 },
  { lga_name: 'Ipswich', entity_count: 1107 },
  { lga_name: 'Noosa', entity_count: 825 },
  { lga_name: 'Lockyer Valley', entity_count: 454 },
  { lga_name: 'Somerset', entity_count: 245 },
];

const QUERY_RECIPES = [
  {
    label: 'Opportunity existence',
    sql: "SELECT name, provider, closes_at FROM grant_opportunities WHERE name ILIKE '%SEQ Innovation Economy%';",
  },
  {
    label: 'ACT identity',
    sql: "SELECT gs_id, canonical_name, abn, sector, lga_name FROM gs_entities WHERE canonical_name ILIKE '%Curious Tractor%' OR canonical_name ILIKE '%Kind Tractor%';",
  },
  {
    label: 'SEQ partner discovery',
    sql: "SELECT canonical_name, abn, sector, lga_name FROM gs_entities WHERE state='QLD' AND lga_name IN (...) AND (sector ILIKE '%innovation%' OR canonical_name ILIKE '%university%' OR canonical_name ILIKE '%hub%');",
  },
  {
    label: 'Delivery contractor history',
    sql: "SELECT supplier_name, supplier_abn, COUNT(*), SUM(contract_value) FROM austender_contracts WHERE title ILIKE '%innovation%' OR category ILIKE '%construction%' GROUP BY supplier_name, supplier_abn;",
  },
];

function roleClass(role: ActRole): string {
  if (role === 'lead') return 'bg-bauhaus-red text-white';
  if (role === 'partner') return 'bg-bauhaus-blue text-white';
  if (role === 'contractor') return 'bg-bauhaus-black text-white';
  return 'bg-bauhaus-canvas text-bauhaus-black';
}

function scoreClass(score: number): string {
  if (score >= 80) return 'text-bauhaus-red';
  if (score >= 70) return 'text-bauhaus-blue';
  if (score >= 55) return 'text-bauhaus-black';
  return 'text-bauhaus-muted';
}

function presenceClass(presence: CivicGraphPresence): string {
  if (presence === 'matched') return 'bg-bauhaus-blue text-white';
  if (presence === 'partial') return 'bg-bauhaus-yellow text-bauhaus-black';
  return 'bg-bauhaus-canvas text-bauhaus-black';
}

function priorityClass(priority: EcosystemAction['priority']): string {
  if (priority === 'high') return 'bg-bauhaus-red text-white';
  if (priority === 'medium') return 'bg-bauhaus-blue text-white';
  return 'bg-bauhaus-canvas text-bauhaus-black';
}

function layerClass(layer: ActProjectLayer): string {
  if (layer === 'memory') return 'bg-bauhaus-black text-white';
  if (layer === 'signal') return 'bg-bauhaus-red text-white';
  if (layer === 'ledger') return 'bg-bauhaus-blue text-white';
  if (layer === 'surface') return 'bg-bauhaus-yellow text-bauhaus-black';
  if (layer === 'edge') return 'bg-white text-bauhaus-black';
  return 'bg-bauhaus-canvas text-bauhaus-black';
}

function readinessClass(readiness: ActProjectReadiness): string {
  if (readiness === 'active') return 'text-bauhaus-blue';
  if (readiness === 'live-proof') return 'text-bauhaus-red';
  if (readiness === 'pitch-ready') return 'text-bauhaus-black';
  if (readiness === 'needs-cleanup') return 'text-bauhaus-yellow';
  return 'text-bauhaus-muted';
}

function reviewStatusClass(status: ActReviewFinding['status']): string {
  if (status === 'verified') return 'bg-bauhaus-blue text-white';
  if (status === 'inferred') return 'bg-bauhaus-yellow text-bauhaus-black';
  return 'bg-bauhaus-canvas text-bauhaus-black';
}

function signalSourceClass(source: OpportunitySignalSource): string {
  if (source === 'wiki') return 'bg-bauhaus-black text-white';
  if (source === 'goods') return 'bg-bauhaus-red text-white';
  if (source === 'grant') return 'bg-bauhaus-blue text-white';
  if (source === 'foundation') return 'bg-bauhaus-yellow text-bauhaus-black';
  if (source === 'crm') return 'bg-white text-bauhaus-black';
  if (source === 'procurement') return 'bg-bauhaus-canvas text-bauhaus-black';
  return 'bg-bauhaus-black text-white';
}

function signalLaneClass(lane: OpportunitySignalLane): string {
  if (lane === 'grant' || lane === 'foundation' || lane === 'capital') return 'text-bauhaus-red';
  if (lane === 'procurement' || lane === 'buyer') return 'text-bauhaus-blue';
  if (lane === 'relationship') return 'text-bauhaus-black';
  return 'text-bauhaus-muted';
}

function sourceHealthClass(status: OpportunitySourceHealth['status']): string {
  if (status === 'ok') return 'bg-bauhaus-blue text-white';
  if (status === 'configured' || status === 'mirror-only') return 'bg-bauhaus-yellow text-bauhaus-black';
  if (status === 'empty') return 'bg-bauhaus-canvas text-bauhaus-black';
  return 'bg-bauhaus-red text-white';
}

function goodsReadinessStatusClass(status: GoodsReadinessChecklistItem['status']): string {
  if (status === 'ready') return 'bg-bauhaus-blue text-white';
  if (status === 'partial') return 'bg-bauhaus-yellow text-bauhaus-black';
  return 'bg-bauhaus-red text-white';
}

function goodsGovernanceStatusClass(status: GoodsGovernanceReadinessItem['status']): string {
  if (status === 'ready') return 'bg-bauhaus-blue text-white';
  if (status === 'partial') return 'bg-bauhaus-yellow text-bauhaus-black';
  if (status === 'blocked' || status === 'gap') return 'bg-bauhaus-red text-white';
  return 'bg-bauhaus-canvas text-bauhaus-black';
}

function goodsSourceStatusClass(status: GoodsReadinessSourceHealth['status']): string {
  if (status === 'ok') return 'bg-bauhaus-blue text-white';
  if (status === 'partial') return 'bg-bauhaus-yellow text-bauhaus-black';
  if (status === 'empty') return 'bg-bauhaus-canvas text-bauhaus-black';
  return 'bg-bauhaus-red text-white';
}

function warmthClass(warmth: OpportunityRelationshipContact['warmth']): string {
  if (warmth === 'hot') return 'bg-bauhaus-red text-white';
  if (warmth === 'warm') return 'bg-bauhaus-blue text-white';
  if (warmth === 'cold') return 'bg-bauhaus-canvas text-bauhaus-black';
  return 'bg-white text-bauhaus-black';
}

function sweepCoverageClass(coverage: SweepCoverage): string {
  if (coverage === 'strong') return 'bg-bauhaus-blue text-white';
  if (coverage === 'partial') return 'bg-bauhaus-yellow text-bauhaus-black';
  if (coverage === 'thin') return 'bg-bauhaus-canvas text-bauhaus-black';
  return 'bg-bauhaus-red text-white';
}

function sweepPriorityClass(priority: SweepPriority): string {
  if (priority === 'critical') return 'bg-bauhaus-red text-white';
  if (priority === 'high') return 'bg-bauhaus-blue text-white';
  if (priority === 'medium') return 'bg-bauhaus-yellow text-bauhaus-black';
  return 'bg-bauhaus-canvas text-bauhaus-black';
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function amountLabel(row: Pick<GrantIndexRow, 'amount_min' | 'amount_max'>): string {
  if (row.amount_min && row.amount_max) return `$${row.amount_min.toLocaleString()} to $${row.amount_max.toLocaleString()}`;
  if (row.amount_max) return `Up to $${row.amount_max.toLocaleString()}`;
  if (row.amount_min) return `From $${row.amount_min.toLocaleString()}`;
  return 'Amount not indexed';
}

function currencyLabel(value: number | null | undefined): string {
  if (!value) return '$0';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function numberLabel(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString();
}

async function getLiveContext(): Promise<{
  actEntities: ActEntityRow[];
  seqCoverage: SeqCoverageRow[];
  indexedMatches: GrantIndexRow[];
}> {
  const db = getServiceSupabase();

  const [actEntitiesResult, seqCoverageResult, indexedMatchesResult] = await Promise.all([
    db
      .from('gs_entities')
      .select('gs_id, canonical_name, abn, entity_type, sector, postcode, state, lga_name')
      .or('canonical_name.ilike.%Curious Tractor%,canonical_name.ilike.%Curioustractor%,canonical_name.ilike.%Kind Tractor%')
      .limit(10),
    db.rpc('exec_sql', {
      query: `
        SELECT lga_name, COUNT(*)::int AS entity_count
        FROM gs_entities
        WHERE state='QLD'
          AND lga_name IN (${SEQ_LGAS.map((lga) => `'${lga.replace(/'/g, "''")}'`).join(',')})
        GROUP BY lga_name
        ORDER BY entity_count DESC
      `,
    }),
    db
      .from('grant_opportunities')
      .select('id, name, provider, closes_at, deadline, amount_min, amount_max, url')
      .or(
        [
          'name.ilike.%Social Justice Fund%',
          'name.ilike.%CRC-P%',
          'name.ilike.%UNSW Founders%',
          'name.ilike.%26Ten%',
          'name.ilike.%Collier Charitable%',
          'name.ilike.%Protostars%',
          'name.ilike.%Westpac Social Change%',
          'name.ilike.%Strengthening Rural Communities%',
          'name.ilike.%SEQ Innovation Economy%',
          'name.ilike.%Trees on Farms%',
        ].join(','),
      )
      .limit(25),
  ]);

  return {
    actEntities: ((actEntitiesResult.data || []) as ActEntityRow[]).sort((a, b) =>
      a.canonical_name.localeCompare(b.canonical_name),
    ),
    seqCoverage: (((seqCoverageResult.data || []) as SeqCoverageRow[]).length > 0
      ? ((seqCoverageResult.data || []) as SeqCoverageRow[])
      : FALLBACK_SEQ_COVERAGE
    ).slice(0, 12),
    indexedMatches: ((indexedMatchesResult.data || []) as GrantIndexRow[]).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}

export default async function OpportunityEcosystemPage() {
  const opportunities = rankedEcosystemOpportunities();
  const actions = rankedEcosystemActions();
  const [live, intelligence, goodsSnapshot] = await Promise.all([
    getLiveContext(),
    getOpportunityIntelligence({ minScore: 55 }),
    getGoodsReadinessSnapshot(),
  ]);
  const sweep = buildOpportunitySystemSweep(intelligence, goodsSnapshot);
  const cockpitSignals = intelligence.signals.slice(0, 12);
  const sourceCount = intelligence.sourceHealth.filter((source) => source.status !== 'error').length;
  const projectLenses = intelligence.projectState.filter((project) =>
    ['goods', 'justicehub', 'empathy-ledger', 'civicgraph', 'harvest', 'farm', 'contained'].includes(project.lens),
  );

  return (
    <div className="min-h-screen bg-bauhaus-canvas pb-16">
      <section className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">Opportunity Alignment</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">
                Where A Curious Tractor sits in the ecosystem.
              </h1>
              <p className="mt-5 max-w-3xl text-base font-medium leading-relaxed text-white/75 sm:text-lg">
                A working brief for ACT as decentralised civic intelligence: current project state,
                source provenance, opportunity fit, partner paths, and how CivicGraph should query the
                system quickly next time.
              </p>
            </div>
            <div className="grid grid-cols-3 border-4 border-white bg-white text-bauhaus-black">
              <Metric label="Signals" value={String(intelligence.signals.length)} />
              <Metric label="Warm Rel" value={String(intelligence.relationshipContext.warmCount)} />
              <Metric label="Sources" value={String(sourceCount)} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <section className="grid gap-0 border-4 border-bauhaus-black bg-white lg:grid-cols-3">
          <PositionBlock label="System Role" title="Civic infrastructure" copy={ACT_POSITION.summary} />
          <PositionBlock label="Lead When" title="The ask is ACT-shaped" copy={ACT_POSITION.leadWhen} />
          <PositionBlock label="Partner When" title="The fund needs an anchor" copy={ACT_POSITION.partnerWhen} last />
        </section>

        <section id="opportunity-cockpit" className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Opportunity Cockpit"
            title="What is in front of ACT now"
            copy="A single ranked workbench across wiki memory, CivicGraph/Supabase, Goods operating data, GHL relationship mirrors, Notion coordination sources, grants, foundations, and procurement signals."
          />
          <div className="grid gap-0 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="divide-y-4 divide-bauhaus-black xl:border-r-4 xl:border-bauhaus-black">
              {cockpitSignals.length > 0 ? (
                cockpitSignals.map((signal) => <OpportunitySignalCard key={signal.id} signal={signal} />)
              ) : (
                <p className="p-5 text-sm font-medium leading-relaxed text-bauhaus-muted">
                  No signals matched the current cockpit filters.
                </p>
              )}
            </div>

            <div className="space-y-0">
              <div className="border-b-4 border-bauhaus-black">
                <SectionHeader
                  kicker="Project Lenses"
                  title="Fit by ACT project"
                  copy="Each signal is scored against these current ACT lenses rather than treated as a generic grant lead."
                />
                <div className="divide-y-4 divide-bauhaus-black">
                  {projectLenses.slice(0, 8).map((project) => (
                    <ProjectLensRow key={project.code} project={project} />
                  ))}
                </div>
              </div>

              <div id="relationship-queue" className="border-b-4 border-bauhaus-black">
                <SectionHeader
                  kicker="Relationship Queue"
                  title="GHL and people context"
                  copy={intelligence.relationshipContext.summary}
                />
                <div className="grid grid-cols-2 border-b-4 border-bauhaus-black">
                  <Metric label="Warm" value={String(intelligence.relationshipContext.warmCount)} />
                  <Metric label="Stale" value={String(intelligence.relationshipContext.staleCount)} />
                </div>
                <div className="divide-y-4 divide-bauhaus-black">
                  {intelligence.relationshipContext.priorityContacts.slice(0, 6).map((contact) => (
                    <RelationshipContactRow key={contact.id} contact={contact} />
                  ))}
                </div>
              </div>

              <div className="border-b-4 border-bauhaus-black">
                <SectionHeader
                  kicker="Source Health"
                  title="Can we trust the scan?"
                  copy="Freshness and source errors stay visible so the cockpit can request ingestion before acting on stale data."
                />
                <div className="divide-y-4 divide-bauhaus-black">
                  {intelligence.sourceHealth.map((source) => (
                    <SourceHealthRow key={source.key} source={source} />
                  ))}
                </div>
              </div>

              <div className="bg-bauhaus-black p-6 text-white">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">Explicit Actions</p>
                <h3 className="mt-3 text-2xl font-black uppercase leading-tight tracking-tight">Mirror plus actions</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-white/75">
                  The cockpit can qualify, brief, monitor, request ingestion, or prepare promotion to pipeline. V1 does not auto-send communications and does not change GHL or Notion stages.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {intelligence.actions.slice(0, 7).map((action) => (
                    <span key={`${action.kind}-${action.label}`} className="border-2 border-white px-2 py-1 text-xs font-black uppercase tracking-widest text-white">
                      {action.kind.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/api/opportunity-intelligence"
                    className="inline-flex border-2 border-white px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                  >
                    View Cockpit API
                  </Link>
                  <Link
                    href="/api/opportunity-intelligence/actions"
                    className="inline-flex border-2 border-white px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                  >
                    Actions Endpoint
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="system-sweep" className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="End-to-End Sweep"
            title="What still needs to be scraped into the offline ledger"
            copy={sweep.posture.summary}
          />
          <div className="grid gap-0 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b-4 border-bauhaus-black xl:border-b-0 xl:border-r-4">
              <div className="border-b-4 border-bauhaus-black bg-bauhaus-black p-6 text-white">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">Immediate Next</p>
                <ul className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-white/75">
                  {sweep.posture.immediateNext.slice(0, 6).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link
                  href="/api/opportunity-system-sweep"
                  className="mt-5 inline-flex border-2 border-white px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                >
                  View Sweep API
                </Link>
              </div>
              <div className="divide-y-4 divide-bauhaus-black">
                {sweep.offlineGaps.slice(0, 9).map((gap) => (
                  <OfflineGapRow key={gap.id} gap={gap} />
                ))}
              </div>
            </div>

            <div>
              <SectionHeader
                kicker="Project Matrix"
                title="Coverage across ACT projects"
                copy="This is the full-system review surface: every project gets a lane/source coverage status, top signals, missing sources, and one next review move."
              />
              <div className="divide-y-4 divide-bauhaus-black">
                {sweep.projectSweep.map((project) => (
                  <ProjectSweepCard key={project.code} project={project} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="goods-final-roadmap" className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Goods Final Sweep"
            title="Roadmap and opportunity lanes"
            copy={sweep.goodsFocus.summary}
          />
          <GoodsReadinessSnapshotPanel snapshot={goodsSnapshot} />
          <div className="grid gap-0 xl:grid-cols-[1fr_0.9fr]">
            <div className="divide-y-4 divide-bauhaus-black xl:border-r-4 xl:border-bauhaus-black">
              {sweep.goodsFocus.roadmap.map((phase) => (
                <GoodsRoadmapCard key={phase.id} phase={phase} />
              ))}
            </div>
            <div>
              <div className="border-b-4 border-bauhaus-black">
                <SectionHeader
                  kicker="Lane Sweep"
                  title="Goods opportunities by route"
                  copy="Goods should not collapse all support into grants. The useful split is grants, foundations, procurement, capital, evidence, and relationships."
                />
                <div className="divide-y-4 divide-bauhaus-black">
                  {sweep.goodsFocus.laneSweep.map((lane) => (
                    <GoodsLaneCard key={lane.lane} lane={lane} />
                  ))}
                </div>
              </div>
              <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-1">
                <div className="border-b-4 border-bauhaus-black p-6 md:border-r-4 xl:border-r-0">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Final Decisions</p>
                  <ul className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                    {sweep.goodsFocus.finalDecisions.map((decision) => (
                      <li key={decision}>{decision}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-6">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">Next Seven Days</p>
                  <ul className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                    {sweep.goodsFocus.nextSevenDays.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Deep Review"
            title="ACT as decentralised civic intelligence"
            copy={ACT_POSITION.deepReview}
          />
          <div className="grid gap-0 lg:grid-cols-3">
            {ACT_OPERATING_LAYERS.map((layer, index) => (
              <article
                key={layer.id}
                className={`p-5 ${index < 3 ? 'lg:border-b-4 lg:border-bauhaus-black' : ''} ${index % 3 !== 2 ? 'lg:border-r-4 lg:border-bauhaus-black' : ''} border-b-4 border-bauhaus-black`}
              >
                <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${layerClass(layer.layer)}`}>
                  {projectLayerLabel(layer.layer)}
                </div>
                <h3 className="mt-4 text-xl font-black uppercase tracking-tight text-bauhaus-black">{layer.title}</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{layer.role}</p>
                <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
                  {layer.opportunityUse}
                </p>
                <p className="mt-4 font-mono text-xs font-bold leading-relaxed text-bauhaus-muted">{layer.source}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="ACT Current State"
            title="Project state across the ecosystem"
            copy="The opportunity engine should score against this wider ACT map: what is live, what is pitch-ready, what needs cleanup, and what evidence source backs the claim."
          />
          <div className="divide-y-4 divide-bauhaus-black">
            {ACT_PROJECT_STATES.map((project) => (
              <article key={project.code} className="grid gap-0 lg:grid-cols-[220px_1fr_300px]">
                <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
                  <p className="font-mono text-2xl font-black text-bauhaus-black">{project.code}</p>
                  <div className={`mt-4 inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${layerClass(project.layer)}`}>
                    {projectLayerLabel(project.layer)}
                  </div>
                  <p className={`mt-4 text-xs font-black uppercase tracking-widest ${readinessClass(project.readiness)}`}>
                    {projectReadinessLabel(project.readiness)}
                  </p>
                </div>
                <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black">{project.name}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{project.currentState}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <MiniBrief label="Intelligence Role" copy={project.intelligenceRole} />
                    <MiniBrief label="Opportunity Alignment" copy={project.opportunityAlignment} />
                  </div>
                </div>
                <div className="bg-bauhaus-black p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Next Question</p>
                  <p className="mt-3 text-sm font-black leading-relaxed text-white">{project.nextQuestion}</p>
                  <p className="mt-5 font-mono text-xs font-bold leading-relaxed text-white/55">{project.source}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-4 border-bauhaus-black bg-white">
            <SectionHeader
              kicker="Role Pattern"
              title="Small core, big edge"
              copy="This is the operating model from the decentralised intelligence frame: the system holds context, people hold judgment, relationships, taste, and accountability."
            />
            <div className="divide-y-4 divide-bauhaus-black">
              {ACT_ROLE_PATTERNS.map((pattern) => (
                <div key={pattern.role} className="p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{pattern.role}</p>
                  <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-bauhaus-black">{pattern.label}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{pattern.useInAct}</p>
                  <p className="mt-3 border-l-4 border-bauhaus-blue pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
                    {pattern.opportunityQuestion}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-white">
            <SectionHeader
              kicker="Alignment Loop"
              title="How every opportunity improves the system"
              copy="Capture, compress, attach, steward, use, and improve. This keeps opportunity work from becoming one-off grant chasing."
            />
            <div className="grid gap-0 sm:grid-cols-2">
              {ACT_KNOWLEDGE_LOOP.map((step, index) => (
                <article
                  key={step.step}
                  className={`p-5 ${index < 4 ? 'sm:border-b-4 sm:border-bauhaus-black' : ''} ${index % 2 === 0 ? 'sm:border-r-4 sm:border-bauhaus-black' : ''} border-b-4 border-bauhaus-black`}
                >
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">{step.step}</p>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{step.job}</p>
                  <p className="mt-3 font-mono text-xs font-bold leading-relaxed text-bauhaus-black">{step.system}</p>
                  <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
                    {step.opportunityUse}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Review Findings"
            title="What the wider ACT scan changes"
            copy="These findings separate what was verified in the wiki from what is an operating inference, so future briefs can keep claims disciplined."
          />
          <div className="divide-y-4 divide-bauhaus-black">
            {ACT_DEEP_REVIEW_FINDINGS.map((finding) => (
              <article key={finding.title} className="grid gap-0 lg:grid-cols-[220px_1fr_1fr]">
                <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
                  <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${reviewStatusClass(finding.status)}`}>
                    {reviewStatusLabel(finding.status)}
                  </div>
                </div>
                <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
                  <h3 className="text-xl font-black uppercase tracking-tight text-bauhaus-black">{finding.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{finding.evidence}</p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Implication</p>
                  <p className="mt-3 text-sm font-black leading-relaxed text-bauhaus-black">{finding.implication}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Next Actions"
            title="What happens after the scan"
            copy="This turns the newsletter into a work queue: briefs to write, entities to resolve, partners to approach, and product surfaces to build."
          />
          <div className="divide-y-4 divide-bauhaus-black">
            {actions.map((action) => (
              <article key={action.id} className="grid gap-0 lg:grid-cols-[220px_1fr_280px]">
                <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
                  <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${priorityClass(action.priority)}`}>
                    {action.priority}
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
                    {actionTypeLabel(action.type)}
                  </p>
                  <p className="mt-2 text-sm font-black text-bauhaus-black">{action.owner}</p>
                </div>
                <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
                  <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black">{action.title}</h2>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{action.whyNow}</p>
                  <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
                    {action.nextStep}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {action.relatedTo.map((item) => (
                      <span key={item} className="border-2 border-bauhaus-black px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-bauhaus-black p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Action Query</p>
                  <p className="mt-3 text-sm font-mono leading-relaxed text-white/80">{action.query || 'No query needed'}</p>
                  {action.query && (
                    <Link
                      href={`/grants?type=open_opportunity&sort=closing_asc&project=civicgraph&q=${encodeURIComponent(action.query)}`}
                      className="mt-5 inline-flex border-2 border-white px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                    >
                      Run Search
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Ranked Opportunities"
            title="BFGN May 2026 opportunity alignment"
            copy="Sorted by ACT fit. The role label is the practical stance: lead, partner, contractor, or monitor."
          />
          <div className="divide-y-4 divide-bauhaus-black">
            {opportunities.map((opportunity) => (
              <article key={opportunity.id} className="grid gap-0 lg:grid-cols-[220px_1fr_280px]">
                <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
                  <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${roleClass(opportunity.actRole)}`}>
                    {opportunityRoleLabel(opportunity.actRole)}
                  </div>
                  <div className={`mt-5 text-5xl font-black ${scoreClass(opportunity.fitScore)}`}>
                    {opportunity.fitScore}
                  </div>
                  <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
                    {opportunityThemeLabel(opportunity.theme)}
                  </p>
                </div>
                <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
                  <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
                    <span>{opportunity.amount}</span>
                    <span>{opportunity.geography}</span>
                    {opportunity.deadline && <span>Closes {dateLabel(opportunity.deadline)}</span>}
                  </div>
                  <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-bauhaus-black">
                    {opportunity.name}
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{opportunity.why}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <MiniBrief label="Evidence Needed" copy={opportunity.evidenceNeed} />
                    <MiniBrief label="Next Move" copy={opportunity.nextMove} />
                  </div>
                </div>
                <div className="bg-bauhaus-black p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Fast Query</p>
                  <p className="mt-3 text-sm font-mono leading-relaxed text-white/80">{opportunity.query}</p>
                  <Link
                    href={`/grants?type=open_opportunity&sort=closing_asc&project=civicgraph&q=${encodeURIComponent(opportunity.query)}`}
                    className="mt-5 inline-flex border-2 border-white px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                  >
                    Search Grants
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="border-4 border-bauhaus-black bg-white">
            <SectionHeader
              kicker="People"
              title="Relationship map"
              copy="People and organisations from the newsletter that matter to ACT's ecosystem position."
            />
            <div className="divide-y-4 divide-bauhaus-black">
              {BFGN_MAY_2026_PEOPLE.map((person) => (
                <div key={`${person.name}-${person.org}`} className="p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">{person.role}</p>
                  <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-bauhaus-black">
                    {person.name} <span className="text-bauhaus-muted">/ {person.org}</span>
                  </h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{person.relevance}</p>
                  <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
                    {person.relationshipMove}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="border-4 border-bauhaus-black bg-white">
              <SectionHeader
                kicker="Live CivicGraph"
                title="ACT entity footing"
                copy="Current entity records found for A Curious Tractor / A Kind Tractor."
              />
              <div className="divide-y-4 divide-bauhaus-black">
                {live.actEntities.length > 0 ? (
                  live.actEntities.map((entity) => (
                    <div key={entity.gs_id} className="p-5">
                      <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black">{entity.canonical_name}</h3>
                      <p className="mt-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
                        {entity.entity_type || 'Entity'} / {entity.sector || 'No sector'} / {entity.lga_name || entity.state || 'No place'}
                      </p>
                      <p className="mt-2 font-mono text-xs text-bauhaus-muted">{entity.abn || entity.gs_id}</p>
                    </div>
                  ))
                ) : (
                  <p className="p-5 text-sm font-medium text-bauhaus-muted">No ACT entities returned from the live graph.</p>
                )}
              </div>
            </div>

            <div className="border-4 border-bauhaus-black bg-white">
              <SectionHeader
                kicker="SEQ Coverage"
                title="Eligible-place graph depth"
                copy="Entity coverage in SEQ LGAs for partner and precinct discovery."
              />
              <div className="grid grid-cols-2 border-t-4 border-bauhaus-black sm:grid-cols-3">
                {live.seqCoverage.map((row) => (
                  <div key={row.lga_name} className="border-b-4 border-r-4 border-bauhaus-black p-4">
                    <p className="text-2xl font-black text-bauhaus-black">{row.entity_count.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">{row.lga_name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="BFGN Supporters"
            title="Are these organisations in CivicGraph?"
            copy="Most are already in the graph or adjacent data sources. Missing and ambiguous names become ingestion work."
          />
          <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
            {BFGN_PARTNER_ORGANISATIONS.map((org, index) => (
              <article
                key={org.name}
                className={`p-5 ${index % 3 !== 2 ? 'xl:border-r-4 xl:border-bauhaus-black' : ''} ${index % 2 === 0 ? 'md:border-r-4 md:border-bauhaus-black xl:border-r-4' : ''} border-b-4 border-bauhaus-black`}
              >
                <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${presenceClass(org.presence)}`}>
                  {presenceLabel(org.presence)}
                </div>
                <h3 className="mt-4 text-xl font-black uppercase tracking-tight text-bauhaus-black">{org.name}</h3>
                {org.civicGraphName && (
                  <p className="mt-2 font-mono text-xs font-bold text-bauhaus-muted">{org.civicGraphName}</p>
                )}
                <p className="mt-3 text-xs font-black uppercase tracking-widest text-bauhaus-blue">
                  {org.entityType} / {org.geography}
                </p>
                <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{org.relationship}</p>
                <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
                  {org.actRelevance}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="News Signals"
            title="What the ecosystem is telling us"
            copy="These are not just news items. They identify gaps, capital movement, and where ACT should stand."
          />
          <div className="grid gap-0 md:grid-cols-2">
            {BFGN_MAY_2026_SIGNALS.map((signal, index) => (
              <div
                key={signal.title}
                className={`p-5 ${index < 2 ? 'border-b-4 border-bauhaus-black' : ''} ${index % 2 === 0 ? 'md:border-r-4 md:border-bauhaus-black' : ''}`}
              >
                <h3 className="text-xl font-black uppercase tracking-tight text-bauhaus-black">{signal.title}</h3>
                <p className="mt-3 text-xs font-black uppercase tracking-widest text-bauhaus-blue">
                  {signal.organisations.join(' / ')}
                </p>
                <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{signal.relevance}</p>
                <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
                  {signal.actPosition}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">Query System</p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight">
              The repeatable workflow
            </h2>
            <ol className="mt-5 space-y-3 text-sm font-medium leading-relaxed text-white/75">
              <li>1. Paste the opportunity list or URL.</li>
              <li>2. Extract amount, place, deadline, eligibility, and assessment criteria.</li>
              <li>3. Join against entities, places, contracts, grants, foundations, and ACT profiles.</li>
              <li>4. Score ACT as lead, partner, contractor, or monitor.</li>
              <li>5. Produce the brief, partner list, evidence gaps, and next action.</li>
            </ol>
            <Link
              href="/api/opportunity-alignment"
              className="mt-6 inline-flex border-2 border-white px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
            >
              View JSON API
            </Link>
          </div>
          <div className="border-4 border-bauhaus-black bg-white">
            <SectionHeader
              kicker="SQL Recipes"
              title="How we query it quickly"
              copy="These are the query shapes the alignment API should automate."
            />
            <div className="divide-y-4 divide-bauhaus-black">
              {QUERY_RECIPES.map((recipe) => (
                <div key={recipe.label} className="p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{recipe.label}</p>
                  <pre className="mt-3 overflow-x-auto bg-bauhaus-canvas p-4 text-xs font-bold leading-relaxed text-bauhaus-black">
                    {recipe.sql}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Query Packs"
            title="Reusable CivicGraph workflows"
            copy="These are the actual query modes this page is proving out. They can become buttons, API modes, or scheduled briefs."
          />
          <div className="grid gap-0 md:grid-cols-2">
            {ECOSYSTEM_QUERY_PACKS.map((pack, index) => (
              <article
                key={pack.id}
                className={`p-5 ${index < 2 ? 'border-b-4 border-bauhaus-black' : ''} ${index % 2 === 0 ? 'md:border-r-4 md:border-bauhaus-black' : ''}`}
              >
                <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{pack.id}</p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-bauhaus-black">{pack.title}</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{pack.purpose}</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Prompts</p>
                    <ul className="mt-2 space-y-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                      {pack.prompts.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Tables</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pack.tables.map((table) => (
                        <span key={table} className="bg-bauhaus-canvas px-2 py-1 font-mono text-xs font-bold text-bauhaus-black">
                          {table}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <SectionHeader
            kicker="Indexed Matches"
            title="What the live grant index already knows"
            copy="This is a rough name match against the current grant_opportunities table."
          />
          {live.indexedMatches.length > 0 ? (
            <div className="divide-y-4 divide-bauhaus-black">
              {live.indexedMatches.map((match) => (
                <div key={match.id} className="grid gap-3 p-5 md:grid-cols-[1fr_180px_160px] md:items-center">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black">{match.name}</h3>
                    <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
                      {match.provider || 'No provider'} / {dateLabel(match.closes_at || match.deadline)}
                    </p>
                  </div>
                  <p className="text-sm font-black text-bauhaus-black">{amountLabel(match)}</p>
                  {match.url ? (
                    <Link href={match.url} className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
                      Source
                    </Link>
                  ) : (
                    <span className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">No URL</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t-4 border-bauhaus-black p-5">
              <p className="text-sm font-medium leading-relaxed text-bauhaus-muted">
                No exact BFGN May 2026 opportunity names matched the live grant index. That makes this
                page an ingestion worklist as well as an alignment brief.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r-4 border-bauhaus-black p-4 last:border-r-0">
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">{label}</p>
    </div>
  );
}

function PositionBlock({ label, title, copy, last }: { label: string; title: string; copy: string; last?: boolean }) {
  return (
    <div className={`p-6 ${last ? '' : 'border-b-4 border-bauhaus-black lg:border-b-0 lg:border-r-4'}`}>
      <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{label}</p>
      <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-bauhaus-black">{title}</h2>
      <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{copy}</p>
    </div>
  );
}

function SectionHeader({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div className="border-b-4 border-bauhaus-black p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">{kicker}</p>
      <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-bauhaus-black">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">{copy}</p>
    </div>
  );
}

function MiniBrief({ label, copy }: { label: string; copy: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
      <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{label}</p>
      <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{copy}</p>
    </div>
  );
}

function GoodsReadinessSnapshotPanel({ snapshot }: { snapshot: GoodsReadinessSnapshot }) {
  const totalDemand =
    snapshot.demand.totalDemand.beds +
    snapshot.demand.totalDemand.washers +
    snapshot.demand.totalDemand.fridges +
    snapshot.demand.totalDemand.mattresses;

  return (
    <div className="border-b-4 border-bauhaus-black">
      <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Communities" value={numberLabel(snapshot.demand.communityCount)} />
        <Metric label="Demand Units" value={numberLabel(totalDemand)} />
        <Metric label="Assets" value={numberLabel(snapshot.assets.assetCount)} />
        <Metric label="Signals" value={numberLabel(snapshot.procurement.signalCount)} />
        <Metric label="GHL Goods" value={numberLabel(snapshot.ghlMirror.goodsOpportunityCount)} />
      </div>

      <div className="grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="border-b-4 border-bauhaus-black xl:border-b-0 xl:border-r-4">
          <div className="border-b-4 border-bauhaus-black p-6">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Goods Readiness</p>
            <h3 className="mt-3 text-2xl font-black uppercase leading-tight tracking-tight text-bauhaus-black">
              Offline evidence now visible
            </h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
              This is the current read-only Goods ledger: demand, assets, procurement signals, product price book, buyer rows, and GHL opportunity mirror. It is a proof surface, not a CRM writeback surface.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/api/goods-readiness-snapshot"
                className="inline-flex border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Goods Snapshot API
              </Link>
              <span className="inline-flex border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">
                Read-only
              </span>
            </div>
          </div>

          <div className="divide-y-4 divide-bauhaus-black">
            {snapshot.checklist.map((item) => (
              <GoodsChecklistRow key={item.id} item={item} />
            ))}
          </div>
          <GoodsGovernanceReadinessPanel snapshot={snapshot} />
        </div>

        <div>
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b-4 border-bauhaus-black p-5 md:border-r-4">
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">GHL Mirror</p>
              <p className="mt-3 text-3xl font-black text-bauhaus-black">
                {currencyLabel(snapshot.ghlMirror.openValue)}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">Open Goods value</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                {snapshot.ghlMirror.pipelineCount} Goods pipelines; last synced {dateLabel(snapshot.ghlMirror.lastSyncedAt)}.
              </p>
            </div>
            <div className="border-b-4 border-bauhaus-black p-5">
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Procurement</p>
              <p className="mt-3 text-3xl font-black text-bauhaus-black">
                {numberLabel(snapshot.procurement.newCount)}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">New signals</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                {numberLabel(snapshot.procurement.syncedToGhlCount)} linked to GHL; {numberLabel(snapshot.procurement.matchedGrantCount)} have grant matches.
              </p>
            </div>
          </div>

          <div className="border-b-4 border-bauhaus-black">
            <p className="p-5 pb-0 text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Source Freshness</p>
            <div className="grid gap-0 md:grid-cols-2">
              {snapshot.sourceHealth.map((source) => (
                <GoodsSourceHealthRow key={source.key} source={source} />
              ))}
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-3">
            <GoodsTopList
              title="Top Communities"
              items={snapshot.topCommunities.slice(0, 5)}
              renderItem={(item) => <GoodsCommunityMini key={item.id} item={item} />}
            />
            <GoodsTopList
              title="Top Signals"
              items={snapshot.topSignals.slice(0, 5)}
              renderItem={(item) => <GoodsSignalMini key={item.id} item={item} />}
            />
            <GoodsTopList
              title="Top Buyers"
              items={snapshot.topBuyers.slice(0, 5)}
              renderItem={(item) => <GoodsBuyerMini key={item.id} item={item} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function GoodsChecklistRow({ item }: { item: GoodsReadinessChecklistItem }) {
  return (
    <div className="grid gap-0 lg:grid-cols-[150px_1fr]">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
        <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${goodsReadinessStatusClass(item.status)}`}>
          {item.status}
        </div>
      </div>
      <div className="p-5">
        <h4 className="text-lg font-black uppercase tracking-tight text-bauhaus-black">{item.label}</h4>
        <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{item.detail}</p>
        <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
          {item.nextAction}
        </p>
      </div>
    </div>
  );
}

function GoodsGovernanceReadinessPanel({ snapshot }: { snapshot: GoodsReadinessSnapshot }) {
  return (
    <div className="border-t-4 border-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">Governance Readiness</p>
        <h3 className="mt-3 text-2xl font-black uppercase leading-tight tracking-tight">
          {snapshot.governance.promotionBlocked ? 'Promotion blocked until critical gaps close' : 'Governance source ready'}
        </h3>
        <p className="mt-3 text-sm font-medium leading-relaxed text-white/75">
          {snapshot.governance.sourceMode === 'supabase'
            ? 'Live Supabase governance rows are now part of the Goods readiness source.'
            : 'Using wiki fallback rows until the goods_governance_readiness migration is applied.'}
        </p>
        <div className="mt-5 grid grid-cols-4 border-2 border-white">
          <Metric label="Ready" value={numberLabel(snapshot.governance.readyCount)} />
          <Metric label="Partial" value={numberLabel(snapshot.governance.partialCount)} />
          <Metric label="Gaps" value={numberLabel(snapshot.governance.gapCount)} />
          <Metric label="Critical" value={numberLabel(snapshot.governance.criticalGapCount)} />
        </div>
      </div>
      <div className="divide-y-4 divide-bauhaus-black">
        {snapshot.governance.items.map((item) => (
          <GoodsGovernanceRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function GoodsGovernanceRow({ item }: { item: GoodsGovernanceReadinessItem }) {
  return (
    <div className="grid gap-0 lg:grid-cols-[150px_1fr]">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
        <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${goodsGovernanceStatusClass(item.status)}`}>
          {item.status}
        </div>
        <p className="mt-3 text-xs font-black uppercase tracking-widest text-bauhaus-muted">{item.priority}</p>
      </div>
      <div className="p-5">
        <h4 className="text-lg font-black uppercase tracking-tight text-bauhaus-black">{item.area}</h4>
        <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{item.position}</p>
        <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
          {item.nextAction}
        </p>
        {item.blocker && (
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-bauhaus-red">{item.blocker}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
            {item.owner || 'No owner'}
          </span>
          <span className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
            {item.publicVisibility}
          </span>
          {item.opportunityLanes.slice(0, 4).map((lane) => (
            <span key={`${item.id}-${lane}`} className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
              {lane}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoodsSourceHealthRow({ source }: { source: GoodsReadinessSourceHealth }) {
  return (
    <div className="border-b-4 border-r-4 border-bauhaus-black p-5">
      <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${goodsSourceStatusClass(source.status)}`}>
        {source.status}
      </div>
      <h4 className="mt-3 text-sm font-black uppercase tracking-tight text-bauhaus-black">{source.label}</h4>
      <p className="mt-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
        {numberLabel(source.count)} rows / {dateLabel(source.freshness)}
      </p>
      <p className="mt-2 text-xs font-medium leading-relaxed text-bauhaus-muted">{source.error || source.detail}</p>
    </div>
  );
}

function GoodsTopList<T>({ title, items, renderItem }: { title: string; items: T[]; renderItem: (item: T) => ReactNode }) {
  return (
    <div className="border-b-4 border-r-4 border-bauhaus-black p-5">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">{title}</p>
      <div className="mt-4 space-y-4">{items.map(renderItem)}</div>
    </div>
  );
}

function GoodsCommunityMini({ item }: { item: GoodsTopCommunity }) {
  return (
    <div>
      <p className="text-sm font-black uppercase leading-tight text-bauhaus-black">{item.name}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
        {item.state || 'No state'} / {item.priority} / {numberLabel(item.demandUnits)} units
      </p>
      <p className="mt-1 text-xs font-medium leading-relaxed text-bauhaus-muted">
        {item.knownBuyerName || 'No known buyer'} / {item.stagingHub || 'No hub'}
      </p>
    </div>
  );
}

function GoodsSignalMini({ item }: { item: GoodsTopSignal }) {
  return (
    <div>
      <p className="text-sm font-black uppercase leading-tight text-bauhaus-black">{item.title}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
        {item.priority} / {item.status} / {numberLabel(item.estimatedUnits)} units
      </p>
      <p className="mt-1 text-xs font-medium leading-relaxed text-bauhaus-muted">
        {item.syncedToGhl ? 'GHL linked' : 'Needs GHL link'} / {item.fundingConfidence || 'No funding status'}
      </p>
    </div>
  );
}

function GoodsBuyerMini({ item }: { item: GoodsTopBuyer }) {
  return (
    <div>
      <p className="text-sm font-black uppercase leading-tight text-bauhaus-black">{item.name}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
        {item.role} / fit {item.fitScore} / {currencyLabel(item.govtContractValue)}
      </p>
      <p className="mt-1 text-xs font-medium leading-relaxed text-bauhaus-muted">
        {item.nextAction || item.relationshipStatus}
      </p>
    </div>
  );
}

function OpportunitySignalCard({ signal }: { signal: OpportunitySignal }) {
  return (
    <article className="grid gap-0 lg:grid-cols-[150px_1fr_260px]">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
        <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${signalSourceClass(signal.source)}`}>
          {signal.source}
        </div>
        <div className={`mt-5 text-5xl font-black ${scoreClass(signal.score)}`}>{signal.score}</div>
        <p className={`mt-2 text-xs font-black uppercase tracking-widest ${signalLaneClass(signal.lane)}`}>
          {signal.lane}
        </p>
        <p className="mt-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted">{signal.status}</p>
      </div>
      <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
          <span>{signal.project}</span>
          {signal.organisation && <span>{signal.organisation}</span>}
          {signal.amount && <span>{signal.amount}</span>}
          {signal.deadline && <span>Due {dateLabel(signal.deadline)}</span>}
        </div>
        <h3 className="mt-3 text-2xl font-black uppercase tracking-tight text-bauhaus-black">{signal.title}</h3>
        <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{signal.summary}</p>
        <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
          {signal.whyNow}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {signal.scoreReasons.slice(0, 4).map((reason) => (
            <span key={reason} className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
              {reason}
            </span>
          ))}
        </div>
      </div>
      <div className="bg-bauhaus-black p-5 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Next Action</p>
        <p className="mt-3 text-sm font-black leading-relaxed text-white">{signal.nextAction.label}</p>
        <p className="mt-2 text-xs font-medium leading-relaxed text-white/70">{signal.nextAction.description}</p>
        <div className="mt-4 space-y-2">
          {signal.evidence.slice(0, 2).map((item) => (
            <div key={`${signal.id}-${item.label}`} className="border-l-4 border-bauhaus-yellow pl-3">
              <p className="text-xs font-black uppercase tracking-widest text-white">{item.label}</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-white/65">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {signal.browseLinks.slice(0, 3).map((link) => (
            <Link
              key={`${signal.id}-${link.label}`}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
              className="inline-flex border-2 border-white px-2 py-1 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

function ProjectLensRow({ project }: { project: OpportunityProjectState }) {
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-bauhaus-black px-2 py-1 font-mono text-xs font-black text-white">{project.code}</span>
        <span className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
          {project.lens}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-black uppercase tracking-tight text-bauhaus-black">{project.name}</h3>
      <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{project.opportunityAlignment}</p>
    </div>
  );
}

function RelationshipContactRow({ contact }: { contact: OpportunityRelationshipContact }) {
  return (
    <div className="p-5">
      <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${warmthClass(contact.warmth)}`}>
        {contact.warmth}
      </div>
      <h3 className="mt-3 text-lg font-black uppercase tracking-tight text-bauhaus-black">{contact.name}</h3>
      <p className="mt-1 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
        {contact.organisation || 'No organisation'} / {contact.lastContactDate ? dateLabel(contact.lastContactDate) : 'No last contact'}
      </p>
      <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{contact.nextTouch}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {contact.tags.slice(0, 4).map((tag) => (
          <span key={`${contact.id}-${tag}`} className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function SourceHealthRow({ source }: { source: OpportunitySourceHealth }) {
  return (
    <div className="grid gap-0 sm:grid-cols-[140px_1fr]">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 sm:border-b-0 sm:border-r-4">
        <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${sourceHealthClass(source.status)}`}>
          {source.status}
        </div>
        <p className="mt-4 text-3xl font-black text-bauhaus-black">{source.count}</p>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black">{source.label}</h3>
        <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{source.detail}</p>
        {source.actionNeeded && (
          <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
            {source.actionNeeded}
          </p>
        )}
      </div>
    </div>
  );
}

function OfflineGapRow({ gap }: { gap: OfflineSourceGap }) {
  return (
    <article className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-3 py-2 text-xs font-black uppercase tracking-widest ${sweepPriorityClass(gap.priority)}`}>
          {gap.priority}
        </span>
        <span className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
          {gap.lane}
        </span>
        <span className="bg-white px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
          {gap.ownedBy}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black uppercase tracking-tight text-bauhaus-black">{gap.source}</h3>
      <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{gap.whyItMatters}</p>
      <p className="mt-3 border-l-4 border-bauhaus-blue pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
        {gap.suggestedIngestionPath}
      </p>
      <p className="mt-3 font-mono text-xs font-bold leading-relaxed text-bauhaus-muted">{gap.firstSweepQuery}</p>
    </article>
  );
}

function ProjectSweepCard({ project }: { project: ProjectSweepRow }) {
  return (
    <article className="grid gap-0 lg:grid-cols-[170px_1fr_260px]">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
        <p className="font-mono text-2xl font-black text-bauhaus-black">{project.code}</p>
        <div className={`mt-4 inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${sweepCoverageClass(project.coverage)}`}>
          {project.coverage}
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
          {project.signalCount} signals
        </p>
      </div>
      <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
          <span>{project.lens}</span>
          <span>{project.readiness}</span>
        </div>
        <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-bauhaus-black">{project.name}</h3>
        <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
          {project.nextReviewMove}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {project.lanes.slice(0, 5).map((lane) => (
            <span key={`${project.code}-${lane}`} className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
              {lane}
            </span>
          ))}
        </div>
      </div>
      <div className="bg-bauhaus-black p-5 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Missing Sources</p>
        <ul className="mt-3 space-y-2 text-xs font-medium leading-relaxed text-white/70">
          {(project.missingSources.length > 0 ? project.missingSources : ['No immediate source gap flagged']).map((source) => (
            <li key={`${project.code}-${source}`}>{source}</li>
          ))}
        </ul>
        <p className="mt-5 text-xs font-black uppercase tracking-widest text-bauhaus-yellow">Top Signals</p>
        <ul className="mt-3 space-y-2 text-xs font-medium leading-relaxed text-white/70">
          {project.topSignals.slice(0, 3).map((signal) => (
            <li key={signal.id}>
              {signal.score} / {signal.title}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function GoodsRoadmapCard({ phase }: { phase: GoodsRoadmapPhase }) {
  return (
    <article className="grid gap-0 lg:grid-cols-[180px_1fr]">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-5 lg:border-b-0 lg:border-r-4">
        <div className={`inline-flex px-3 py-2 text-xs font-black uppercase tracking-widest ${sweepPriorityClass(phase.priority)}`}>
          {phase.priority}
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-muted">{phase.horizon}</p>
      </div>
      <div className="p-5">
        <h3 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black">{phase.title}</h3>
        <p className="mt-3 text-sm font-black leading-relaxed text-bauhaus-black">{phase.outcome}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Actions</p>
            <ul className="mt-2 space-y-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              {phase.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Blockers</p>
            <ul className="mt-2 space-y-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              {phase.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {phase.opportunityLanes.map((lane) => (
            <span key={`${phase.id}-${lane}`} className="bg-bauhaus-canvas px-2 py-1 text-xs font-black uppercase tracking-widest text-bauhaus-black">
              {lane}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function GoodsLaneCard({ lane }: { lane: GoodsLaneSweep }) {
  return (
    <article className="p-5">
      <div className="flex flex-wrap gap-2">
        <span className={`px-3 py-2 text-xs font-black uppercase tracking-widest ${signalLaneClass(lane.lane)}`}>
          {lane.lane}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black uppercase tracking-tight text-bauhaus-black">{lane.title}</h3>
      <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{lane.role}</p>
      <p className="mt-3 border-l-4 border-bauhaus-red pl-3 text-sm font-black leading-relaxed text-bauhaus-black">
        {lane.decisionNeeded}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Top Signals</p>
          <ul className="mt-2 space-y-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
            {(lane.topSignals.length > 0 ? lane.topSignals : []).slice(0, 3).map((signal) => (
              <li key={signal.id}>
                {signal.score} / {signal.title}
              </li>
            ))}
            {lane.topSignals.length === 0 && <li>No ranked signal yet.</li>}
          </ul>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Missing Inputs</p>
          <ul className="mt-2 space-y-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
            {lane.missingInputs.map((input) => (
              <li key={input}>{input}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
