import {
  getOpportunityIntelligence,
  type OpportunityIntelligenceResponse,
  type OpportunitySignal,
  type OpportunitySignalLane,
  type OpportunitySignalSource,
} from '@/lib/opportunity-intelligence';
import { ACT_PROJECT_STATES } from '@/lib/opportunity-alignment';
import { getWikiSupportIndex } from '@/lib/services/wiki-support-index';
import {
  goodsCapitalRows,
  goodsGovernanceRows,
  goodsImpactRows,
  goodsPeopleRows,
  goodsRiskRows,
  goodsRoadmap,
  goodsSourceDocuments,
  goodsSupportRoutes,
  goodsSystemsRows,
  goodsWikiOutputs,
} from '@/lib/services/goods-operating-system';
import {
  getGoodsReadinessSnapshot,
  type GoodsReadinessSnapshot,
} from '@/lib/goods-readiness-snapshot';

export type SweepPriority = 'critical' | 'high' | 'medium' | 'low';
export type SweepCoverage = 'strong' | 'partial' | 'thin' | 'missing';

export interface OfflineSourceGap {
  id: string;
  priority: SweepPriority;
  lane: OpportunitySignalLane | 'source';
  source: string;
  ownedBy: 'wiki' | 'supabase' | 'ghl' | 'notion' | 'goods' | 'external';
  whyItMatters: string;
  currentCoverage: string;
  firstSweepQuery: string;
  suggestedIngestionPath: string;
}

export interface ProjectSweepRow {
  code: string;
  name: string;
  lens: string;
  readiness: string;
  coverage: SweepCoverage;
  signalCount: number;
  lanes: OpportunitySignalLane[];
  sources: OpportunitySignalSource[];
  topSignals: Array<Pick<OpportunitySignal, 'id' | 'title' | 'score' | 'lane' | 'source'>>;
  missingSources: string[];
  nextReviewMove: string;
}

export interface GoodsRoadmapPhase {
  id: string;
  title: string;
  horizon: string;
  priority: SweepPriority;
  outcome: string;
  evidence: string[];
  actions: string[];
  opportunityLanes: OpportunitySignalLane[];
  blockers: string[];
}

export interface GoodsLaneSweep {
  lane: OpportunitySignalLane;
  title: string;
  role: string;
  topSignals: Array<Pick<OpportunitySignal, 'id' | 'title' | 'score' | 'source' | 'nextAction'>>;
  missingInputs: string[];
  decisionNeeded: string;
}

export interface OpportunitySystemSweep {
  generatedAt: string;
  posture: {
    summary: string;
    immediateNext: string[];
    safety: string[];
  };
  projectSweep: ProjectSweepRow[];
  offlineGaps: OfflineSourceGap[];
  goodsFocus: {
    summary: string;
    roadmap: GoodsRoadmapPhase[];
    laneSweep: GoodsLaneSweep[];
    finalDecisions: string[];
    nextSevenDays: string[];
  };
}

const PROJECT_LENS_ALIASES: Record<string, string[]> = {
  'ACT-IN': ['civicgraph'],
  'ACT-CS': ['civicgraph'],
  'ACT-EL': ['empathy-ledger'],
  'ACT-JH': ['justicehub'],
  'ACT-GD': ['goods'],
  'ACT-HV': ['harvest'],
  'ACT-FM': ['farm'],
  'ACT-PI': ['justicehub', 'goods'],
  'ACT-MY': ['justicehub'],
  'ACT-GP': ['empathy-ledger'],
  'ACT-CN': ['contained'],
  'ACT-CORE': ['civicgraph'],
};

const OFFLINE_GAPS: OfflineSourceGap[] = [
  {
    id: 'notion-grant-pipeline-mirror',
    priority: 'critical',
    lane: 'source',
    source: 'Notion Grant Pipeline Tracker, Projects, and People Directory',
    ownedBy: 'notion',
    whyItMatters:
      'The cockpit knows the configured data-source IDs, but it does not yet mirror Notion tracker rows, readiness scores, people links, or missing document fields at runtime.',
    currentCoverage: 'Configured source IDs plus org_pipeline mirror; no Notion row mirror in V1 cockpit.',
    firstSweepQuery: 'Find open Notion tracker rows by Stage, Project, Readiness Score, Missing Documents, and Supabase ID.',
    suggestedIngestionPath:
      'Add a scheduled read-only Notion mirror into Supabase tables or a JSON cache, then dedupe by notion_page_id and Supabase ID.',
  },
  {
    id: 'ghl-opportunity-pipeline-mirror',
    priority: 'critical',
    lane: 'relationship',
    source: 'GoHighLevel opportunities and pipeline stages',
    ownedBy: 'ghl',
    whyItMatters:
      'The cockpit currently reads GHL contacts from the local mirror, but opportunity-stage truth lives in GHL pipelines such as Goods Buyer and Goods Demand.',
    currentCoverage: 'ghl_contacts mirror only; direct GHL opportunities are not part of the read model unless separately synced.',
    firstSweepQuery: 'List GHL opportunities by pipeline, stage, tag, monetary value, last status change, assigned owner, and linked contact.',
    suggestedIngestionPath:
      'Create a read-only GHL opportunities mirror with ghl_opportunity_id, pipeline_id, stage_id, contact_id, tags, value, last_synced_at, and source hash.',
  },
  {
    id: 'goods-demand-and-asset-register-refresh',
    priority: 'critical',
    lane: 'evidence',
    source: 'Goods asset register, QR claims, demand rows, price book, production capacity, and freight quotes',
    ownedBy: 'goods',
    whyItMatters:
      'Goods opportunities are only credible if the system can prove assets deployed, unmet demand, unit economics, delivery capacity, and support model.',
    currentCoverage: 'Wiki support index references Goods CSV and docs; the cockpit does not yet expose live asset lifecycle, price book, or demand pipeline tables.',
    firstSweepQuery: 'Summarise current assets, demand by community, product type, unit cost, freight, repair/support status, and buyer-ready quantities.',
    suggestedIngestionPath:
      'Run goods-lifecycle-sync and add a Goods readiness snapshot API that joins asset lifecycle, GHL demand, unit economics, quotes, and support routes.',
  },
  {
    id: 'state-tenders-and-local-procurement',
    priority: 'high',
    lane: 'procurement',
    source: 'Queensland QTenders, NSW eTendering, VIC Tenders, WA, NT, councils, health, housing, and education procurement portals',
    ownedBy: 'supabase',
    whyItMatters:
      'AusTender is strong federally, but Goods buyers are often state, local, health, housing, aged-care, education, hostel, and community-service procurement buyers.',
    currentCoverage: 'AusTender and some state tender logic exist; the Goods cockpit query is not yet a full state/local buyer sweep.',
    firstSweepQuery: 'Search for beds, furniture, fitout, washing machines, laundry, remote housing, Aboriginal housing, hostels, aged care, and social procurement.',
    suggestedIngestionPath:
      'Add a state/local procurement frontier with source_url, buyer, category, place, close date, contract renewal clue, and Goods lane tags.',
  },
  {
    id: 'indigenous-and-social-procurement-directories',
    priority: 'high',
    lane: 'procurement',
    source: 'Supply Nation, ORIC, Social Traders, ICN, Indigenous chambers, disability enterprise, and B Corp directories',
    ownedBy: 'supabase',
    whyItMatters:
      'Goods needs partners, manufacturers, buyers, local delivery orgs, and procurement credibility beyond grants.',
    currentCoverage: 'social_enterprises table and import scripts exist; certification freshness and Goods-specific partner roles are not complete.',
    firstSweepQuery: 'Find certified Indigenous/social suppliers in logistics, manufacturing, housing, repair, circular economy, health, and community services.',
    suggestedIngestionPath:
      'Refresh directory scrapers, add role tags, and link ABNs to gs_entities, GHL contacts, and Goods buyer/supplier lanes.',
  },
  {
    id: 'foundation-relationship-intelligence',
    priority: 'high',
    lane: 'foundation',
    source: 'Foundation websites, board members, annual reports, grants pages, and philanthropic newsletters',
    ownedBy: 'supabase',
    whyItMatters:
      'Foundation fit is relationship-led. Amount and theme are not enough without trustees, recent grants, application mode, and warm paths.',
    currentCoverage: 'foundations and foundation_programs exist, but board/people and recent-giving coverage is uneven.',
    firstSweepQuery: 'Find funders for First Nations enterprise, remote health, housing, circular economy, social enterprise, and patient capital.',
    suggestedIngestionPath:
      'Run long-tail foundation program discovery, board scraping, recent grants extraction, and GHL/Notion people matching.',
  },
  {
    id: 'grant-frontier-sources',
    priority: 'high',
    lane: 'grant',
    source: 'SmartyGrants portals, GrantConnect, business.gov.au, QLD Grants Finder, FRRR, councils, universities, accelerators, and newsletters',
    ownedBy: 'supabase',
    whyItMatters:
      'The cockpit can rank known grants, but it should know where grant discovery is thin before ACT makes a no-go decision.',
    currentCoverage: 'grant_opportunities has broad rows; source-specific frontier freshness is not visible in the cockpit.',
    firstSweepQuery: 'Search Goods, JusticeHub, Empathy Ledger, CivicGraph, Harvest, Farm, Contained terms across source frontiers and deadlines.',
    suggestedIngestionPath:
      'Store source frontiers with last checked date, query, response count, new rows, and error state, then show it in source health.',
  },
  {
    id: 'story-consent-and-proof-pack-index',
    priority: 'medium',
    lane: 'evidence',
    source: 'Empathy Ledger, Gold.Phone, JusticeHub proof packs, consent state, media assets, and narrative claims',
    ownedBy: 'wiki',
    whyItMatters:
      'ACT can make stronger applications only when data evidence and consented story proof are joined without exposing private fields.',
    currentCoverage: 'Wiki narratives and claims exist; consent-aware evidence packs are not yet a cockpit source.',
    firstSweepQuery: 'For each project, list usable public claims, private proof, consent state, media assets, and approved story fragments.',
    suggestedIngestionPath:
      'Create a consent-safe evidence index with public/private flags, claim IDs, source docs, project code, and expiry/review date.',
  },
  {
    id: 'finance-and-governance-readiness',
    priority: 'medium',
    lane: 'systems',
    source: 'Xero/Dext project codes, receipts, entity decisions, insurance, IP, co-contribution, and applicant readiness',
    ownedBy: 'wiki',
    whyItMatters:
      'Large opportunities fail late when entity, bank, insurance, co-contribution, IP, and governance proof are unresolved.',
    currentCoverage: 'Wiki has operational thesis and project codes; cockpit does not yet score governance readiness per opportunity.',
    firstSweepQuery: 'For each project, check applicant entity, ABN/GST, insurance, co-contribution, budget proof, IP, and authority to apply.',
    suggestedIngestionPath:
      'Add a project-readiness checklist table and make high-value opportunities require it before promotion.',
  },
];

function projectLabelsForCode(code: string) {
  return PROJECT_LENS_ALIASES[code] ?? ['civicgraph'];
}

function coverageFromCounts(signalCount: number, laneCount: number, missingCount: number): SweepCoverage {
  if (signalCount >= 8 && laneCount >= 4 && missingCount <= 1) return 'strong';
  if (signalCount >= 4 && laneCount >= 2) return 'partial';
  if (signalCount > 0) return 'thin';
  return 'missing';
}

function missingSourcesForProject(projectCode: string, lanes: Set<OpportunitySignalLane>, sources: Set<OpportunitySignalSource>) {
  const missing: string[] = [];
  if (!sources.has('wiki')) missing.push('wiki meaning and source provenance');
  if (!sources.has('crm')) missing.push('GHL relationship mirror');
  if (!sources.has('notion')) missing.push('Notion coordination mirror');
  if (!lanes.has('grant')) missing.push('grant scan');
  if (!lanes.has('foundation')) missing.push('foundation/funder path');

  if (projectCode === 'ACT-GD') {
    if (!lanes.has('procurement') && !lanes.has('buyer')) missing.push('buyer/procurement path');
    if (!lanes.has('capital')) missing.push('capital stack');
    if (!sources.has('goods')) missing.push('Goods operating data');
  }

  if (projectCode === 'ACT-JH' && !lanes.has('evidence')) missing.push('justice evidence pack');
  if (projectCode === 'ACT-EL' && !lanes.has('evidence')) missing.push('consent-safe story proof');
  return missing.slice(0, 5);
}

function nextMoveForProject(projectCode: string, missing: string[]) {
  if (projectCode === 'ACT-GD') return 'Run the Goods final sweep: demand proof, buyer list, capital stack, governance vehicle, and top 10 opportunities.';
  if (projectCode === 'ACT-JH') return 'Refresh JusticeHub evidence and relationship opportunities, then separate policy, philanthropy, and product lanes.';
  if (projectCode === 'ACT-EL') return 'Build a consent-safe evidence index and identify funders that value story infrastructure rather than generic engagement.';
  if (projectCode === 'ACT-CS') return 'Turn the cockpit itself into the product proof: opportunity fit, source health, place evidence, and acquittal proof.';
  if (missing.length > 0) return `Close source gaps first: ${missing.slice(0, 2).join(', ')}.`;
  return 'Keep monitoring and only promote opportunities with clear owner, evidence, and relationship path.';
}

function buildProjectSweep(signals: OpportunitySignal[]): ProjectSweepRow[] {
  return ACT_PROJECT_STATES.map((project) => {
    const labels = projectLabelsForCode(project.code);
    const projectSignals = signals.filter((signal) => signal.projects.some((label) => labels.includes(label)));
    const lanes = new Set(projectSignals.map((signal) => signal.lane));
    const sources = new Set(projectSignals.map((signal) => signal.source));
    const missingSources = missingSourcesForProject(project.code, lanes, sources);
    return {
      code: project.code,
      name: project.name,
      lens: labels[0] ?? 'civicgraph',
      readiness: project.readiness,
      coverage: coverageFromCounts(projectSignals.length, lanes.size, missingSources.length),
      signalCount: projectSignals.length,
      lanes: Array.from(lanes).sort(),
      sources: Array.from(sources).sort(),
      topSignals: projectSignals
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((signal) => ({
          id: signal.id,
          title: signal.title,
          score: signal.score,
          lane: signal.lane,
          source: signal.source,
        })),
      missingSources,
      nextReviewMove: nextMoveForProject(project.code, missingSources),
    };
  });
}

function topGoodsSignalsByLane(signals: OpportunitySignal[], lane: OpportunitySignalLane) {
  return signals
    .filter((signal) => signal.projects.includes('goods') && signal.lane === lane)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((signal) => ({
      id: signal.id,
      title: signal.title,
      score: signal.score,
      source: signal.source,
      nextAction: signal.nextAction,
    }));
}

function buildGoodsLaneSweep(signals: OpportunitySignal[], goodsSnapshot?: GoodsReadinessSnapshot): GoodsLaneSweep[] {
  return [
    {
      lane: 'grant',
      title: 'Grant lane',
      role: goodsSupportRoutes.find((route) => route.lane === 'Grants')?.use ?? 'Subsidise evidence and operating capacity.',
      topSignals: topGoodsSignalsByLane(signals, 'grant'),
      missingInputs: ['Latest grant frontier freshness', 'Applicant/entity decision', 'Budget and co-contribution proof'],
      decisionNeeded: 'Which Goods ask is grant-funded rather than buyer-funded: evidence, deployment, production capacity, or operations?',
    },
    {
      lane: 'foundation',
      title: 'Foundation lane',
      role: goodsSupportRoutes.find((route) => route.lane === 'Foundations')?.use ?? 'Build relationship-led funder asks.',
      topSignals: topGoodsSignalsByLane(signals, 'foundation'),
      missingInputs: ['Warm path to trustees/program staff', 'Recent giving examples', 'One-page foundation brief'],
      decisionNeeded: 'Which funders are relationship-first and which can be handled as open program applications?',
    },
    {
      lane: 'procurement',
      title: 'Procurement lane',
      role: goodsSupportRoutes.find((route) => route.lane === 'Procurement')?.use ?? 'Package Goods as a contractable offer.',
      topSignals: [...topGoodsSignalsByLane(signals, 'procurement'), ...topGoodsSignalsByLane(signals, 'buyer')].slice(0, 5),
      missingInputs: ['Buyer price book', 'MOQ and delivery terms', 'Warranty/support model', 'State/local tender sweep'],
      decisionNeeded: 'Which buyers are ready for a product offer now, not a grant story?',
    },
    {
      lane: 'capital',
      title: 'Capital lane',
      role: goodsSupportRoutes.find((route) => route.lane === 'Capital')?.use ?? 'Finance production and stock runway.',
      topSignals: topGoodsSignalsByLane(signals, 'capital'),
      missingInputs: ['Use-of-funds table', 'Repayment/pre-purchase logic', 'Vehicle and governance memo'],
      decisionNeeded: 'What is the first capital stack: grant capital, patient loan, IBA pathway, pre-purchase, or blended?',
    },
    {
      lane: 'evidence',
      title: 'Evidence lane',
      role: 'Keep Goods credible by joining assets, demand, impact, unit economics, and community authority.',
      topSignals: topGoodsSignalsByLane(signals, 'evidence'),
      missingInputs: goodsSnapshot
        ? goodsSnapshot.checklist
            .filter((item) => item.status !== 'ready')
            .map((item) => `${item.label}: ${item.nextAction}`)
            .slice(0, 4)
        : ['Live demand snapshot', 'Asset lifecycle freshness', 'Community consent and authority notes', 'Unit economics'],
      decisionNeeded: 'What proof can be public, what stays internal, and what needs community approval before use?',
    },
  ];
}

function buildGoodsRoadmap(): GoodsRoadmapPhase[] {
  return [
    {
      id: 'goods-evidence-freeze',
      title: 'Freeze the evidence pack',
      horizon: 'Now to 7 days',
      priority: 'critical',
      outcome: goodsRoadmap[0]?.operatingUse ?? 'Prove Goods is already operating.',
      evidence: [
        goodsRoadmap[0]?.now,
        goodsImpactRows[0]?.evidence,
        goodsSourceDocuments.find((doc) => doc.label.includes('Asset'))?.use,
      ].filter(Boolean) as string[],
      actions: [
        'Run Goods lifecycle sync and produce one current demand/assets snapshot.',
        'Create a funder-safe proof pack: assets, communities, demand, product photos/QR evidence, and source docs.',
        'Mark public, internal, and community-approval-required evidence separately.',
      ],
      opportunityLanes: ['evidence', 'grant', 'foundation'],
      blockers: ['Live demand data not yet visible in cockpit', 'Consent/public-proof boundaries need explicit flags'],
    },
    {
      id: 'goods-buyer-offer',
      title: 'Turn Goods into a buyer-ready offer',
      horizon: '7 to 14 days',
      priority: 'critical',
      outcome: goodsRoadmap[2]?.operatingUse ?? 'Frame Goods as a contractable offer.',
      evidence: [
        goodsPeopleRows.find((row) => row.role === 'Buyer and funder relationships')?.use,
        goodsSystemsRows.find((row) => row.system === 'GHL CRM')?.owns,
      ].filter(Boolean) as string[],
      actions: [
        'Create price book, MOQ, delivery, warranty/support, and reporting terms.',
        'Mirror GHL Goods Buyer and Goods Demand opportunities into the cockpit.',
        'Build a top-25 buyer list across ACCHOs, remote stores, hostels, housing, mining foundations, councils, and health/aged-care buyers.',
      ],
      opportunityLanes: ['buyer', 'procurement', 'relationship'],
      blockers: ['GHL opportunity pipeline is not yet mirrored', 'State/local procurement frontiers are not complete'],
    },
    {
      id: 'goods-capital-stack',
      title: 'Lock the capital stack',
      horizon: '14 to 21 days',
      priority: 'high',
      outcome: goodsRoadmap[3]?.operatingUse ?? 'Give each capital source a specific use of funds and relationship path.',
      evidence: goodsCapitalRows.map((row) => `${row.source}: ${row.proof}`).slice(0, 5),
      actions: [
        'Create one row per capital source: ask, use of funds, evidence, relationship owner, and next date.',
        'Separate grant subsidy, foundation support, patient capital, pre-purchase, R&D, and buyer revenue.',
        'Attach finance/project-code evidence for any claim about spend, receipts, or runway.',
      ],
      opportunityLanes: ['capital', 'foundation', 'grant'],
      blockers: ['Governance vehicle and repayment/pre-purchase logic need final decision'],
    },
    {
      id: 'goods-governance-vehicle',
      title: 'Resolve applicant, contracting, and governance pathway',
      horizon: 'Parallel decision track',
      priority: 'critical',
      outcome: goodsGovernanceRows.find((row) => row.area === 'Goods vehicle')?.decision ?? 'Choose the credible Goods vehicle.',
      evidence: goodsGovernanceRows.map((row) => `${row.area}: ${row.position}`).slice(0, 4),
      actions: [
        'Choose who applies, who contracts, who owns the offer, and how community benefit is recorded.',
        'Write a short IP/licence/community-benefit note for funders and buyers.',
        'Block high-value promotions until entity, bank, insurance, IP, and partner authority are clear.',
      ],
      opportunityLanes: ['systems', 'capital', 'procurement'],
      blockers: goodsRiskRows.map((row) => row.risk).slice(0, 3),
    },
    {
      id: 'goods-communications-rhythm',
      title: 'Run the weekly opportunity rhythm',
      horizon: 'Ongoing weekly',
      priority: 'high',
      outcome: 'Keep Goods opportunities alive through a small number of human next touches and source refreshes.',
      evidence: goodsWikiOutputs.map((output) => `${output.label}: ${output.sections.join(', ')}`).slice(0, 4),
      actions: [
        'Every week: refresh sources, review top signals, choose three next touches, and write one brief.',
        'Use GHL for next touches and Notion for owner/readiness, but keep wiki as meaning and Supabase as ledger.',
        'No-go opportunities quickly when there is no applicant, buyer path, evidence, or relationship owner.',
      ],
      opportunityLanes: ['relationship', 'communications', 'systems'],
      blockers: ['No automatic source frontier freshness dashboard yet'],
    },
  ];
}

function pickImmediateNext(projectSweep: ProjectSweepRow[], goodsSnapshot?: GoodsReadinessSnapshot) {
  const goods = projectSweep.find((project) => project.code === 'ACT-GD');
  const thin = projectSweep.filter((project) => project.coverage === 'thin' || project.coverage === 'missing').slice(0, 3);
  return [
    goodsSnapshot
      ? `Goods snapshot is live: ${goodsSnapshot.demand.communityCount.toLocaleString()} communities, ${goodsSnapshot.assets.assetCount.toLocaleString()} assets, ${goodsSnapshot.procurement.signalCount.toLocaleString()} procurement signals, and ${goodsSnapshot.ghlMirror.goodsOpportunityCount.toLocaleString()} GHL Goods opportunities.`
      : 'Mirror Notion and GHL opportunity data read-only before enabling any writeback.',
    'Run a source frontier freshness sweep across grants, foundations, procurement, social procurement, Goods evidence, and relationship systems.',
    goods?.nextReviewMove,
    ...thin.map((project) => `${project.code}: ${project.nextReviewMove}`),
  ].filter(Boolean) as string[];
}

function offlineGapsWithGoodsSnapshot(goodsSnapshot?: GoodsReadinessSnapshot): OfflineSourceGap[] {
  if (!goodsSnapshot) return OFFLINE_GAPS;

  return OFFLINE_GAPS.map((gap) => {
    if (gap.id === 'ghl-opportunity-pipeline-mirror') {
      return {
        ...gap,
        currentCoverage: `${goodsSnapshot.ghlMirror.goodsOpportunityCount.toLocaleString()} Goods opportunities mirrored across ${goodsSnapshot.ghlMirror.pipelineCount} GHL pipelines. Last sync: ${goodsSnapshot.ghlMirror.lastSyncedAt ?? 'unknown'}.`,
        suggestedIngestionPath:
          'Keep the GHL mirror read-only in the cockpit; next maturity step is dedupe against org_pipeline and action receipts.',
      };
    }

    if (gap.id === 'goods-demand-and-asset-register-refresh') {
      return {
        ...gap,
        currentCoverage: `${goodsSnapshot.demand.communityCount.toLocaleString()} communities, ${goodsSnapshot.assets.assetCount.toLocaleString()} assets, ${goodsSnapshot.procurement.signalCount.toLocaleString()} procurement signals, ${goodsSnapshot.products.productCount.toLocaleString()} product price-book rows, and ${goodsSnapshot.governance.itemCount.toLocaleString()} governance rows are visible in the cockpit.`,
        suggestedIngestionPath:
          'Use /api/goods-readiness-snapshot as the proof surface, then add governance, consent, and production-capacity rows beside it.',
      };
    }

    if (gap.id === 'finance-and-governance-readiness') {
      return {
        ...gap,
        currentCoverage:
          goodsSnapshot.governance.sourceMode === 'supabase'
            ? `${goodsSnapshot.governance.itemCount.toLocaleString()} Supabase governance readiness rows, ${goodsSnapshot.governance.criticalGapCount.toLocaleString()} critical gaps, promotion blocked: ${goodsSnapshot.governance.promotionBlocked ? 'yes' : 'no'}.`
            : `${goodsSnapshot.governance.itemCount.toLocaleString()} wiki fallback governance rows. Apply the goods_governance_readiness migration to make this a live Supabase source. Critical gaps: ${goodsSnapshot.governance.criticalGapCount.toLocaleString()}.`,
        suggestedIngestionPath:
          'Use goods_governance_readiness for applicant, contracting, IP/licence, insurance, bank, authority, and public/private proof before promotion.',
      };
    }

    return gap;
  });
}

export function buildOpportunitySystemSweep(
  intelligence: OpportunityIntelligenceResponse,
  goodsSnapshot?: GoodsReadinessSnapshot,
): OpportunitySystemSweep {
  const projectSweep = buildProjectSweep(intelligence.signals);
  const wiki = getWikiSupportIndex();
  const goodsSignals = intelligence.signals.filter((signal) => signal.projects.includes('goods'));
  const goodsSummary = goodsSnapshot
    ? ` Live Goods ledger: ${goodsSnapshot.demand.communityCount.toLocaleString()} communities, ${goodsSnapshot.procurement.signalCount.toLocaleString()} procurement signals, ${goodsSnapshot.ghlMirror.goodsOpportunityCount.toLocaleString()} mirrored GHL Goods opportunities, and ${goodsSnapshot.governance.criticalGapCount.toLocaleString()} critical governance gaps.`
    : '';

  return {
    generatedAt: new Date().toISOString(),
    posture: {
      summary: `The cockpit has ${intelligence.signals.length} ranked signals, ${wiki.summary.project_count} wiki-indexed projects, and ${intelligence.sourceHealth.length} source-health rows.${goodsSummary} The next maturity step is source-frontier coverage: prove what has and has not been scraped into the offline ledger.`,
      immediateNext: pickImmediateNext(projectSweep, goodsSnapshot),
      safety: intelligence.safety.notes,
    },
    projectSweep,
    offlineGaps: offlineGapsWithGoodsSnapshot(goodsSnapshot),
    goodsFocus: {
      summary: goodsSnapshot
        ? `Goods currently has ${goodsSignals.length} ranked signals across ${new Set(goodsSignals.map((signal) => signal.lane)).size} lanes, plus live readiness evidence from ${goodsSnapshot.demand.communityCount.toLocaleString()} communities, ${goodsSnapshot.assets.assetCount.toLocaleString()} assets, ${goodsSnapshot.procurement.signalCount.toLocaleString()} procurement signals, ${goodsSnapshot.products.productCount.toLocaleString()} products, ${goodsSnapshot.ghlMirror.goodsOpportunityCount.toLocaleString()} mirrored GHL Goods opportunities, and ${goodsSnapshot.governance.itemCount.toLocaleString()} governance readiness rows. The roadmap should move from proof freeze to buyer offer, then capital stack and governance vehicle.`
        : `Goods currently has ${goodsSignals.length} ranked signals across ${new Set(goodsSignals.map((signal) => signal.lane)).size} lanes. The roadmap should move from proof freeze to buyer offer, then capital stack and governance vehicle.`,
      roadmap: buildGoodsRoadmap(),
      laneSweep: buildGoodsLaneSweep(intelligence.signals, goodsSnapshot),
      finalDecisions: [
        'Choose the Goods applicant/contracting vehicle before any major grant, procurement, or capital ask is promoted.',
        'Separate buyer revenue, pre-purchase, patient capital, grant subsidy, foundation support, and R&D evidence instead of treating all as fundraising.',
        'Decide which Goods evidence can be public, which is internal, and which requires community approval.',
        'Pick the first five buyer/funder next touches and put them in GHL with owners and dates.',
        'Choose the first Goods opportunity brief to ship from the cockpit rather than adding more undifferentiated leads.',
      ],
      nextSevenDays: [
        'Refresh Goods asset/demand evidence and create one current snapshot.',
        'Mirror GHL Goods Buyer and Goods Demand opportunities read-only.',
        'Run a state/local procurement sweep for remote housing, furniture, beds, laundry, hostels, aged care, and Aboriginal housing.',
        'Shortlist 10 foundations/capital partners and 15 buyers with one next touch each.',
        'Create one Goods funder brief, one buyer offer, one capital stack table, and one no-go list.',
      ],
    },
  };
}

export async function getOpportunitySystemSweep(): Promise<OpportunitySystemSweep> {
  const [intelligence, goodsSnapshot] = await Promise.all([
    getOpportunityIntelligence({ minScore: 45 }),
    getGoodsReadinessSnapshot().catch(() => undefined),
  ]);
  return buildOpportunitySystemSweep(intelligence, goodsSnapshot);
}
