import { getServiceSupabase } from '@/lib/supabase';
import {
  ACT_PROJECT_STATES,
  ECOSYSTEM_NEXT_ACTIONS,
  type ActProjectState,
} from '@/lib/opportunity-alignment';
import {
  getWikiSupportIndex,
  type WikiSupportAction,
  type WikiSupportProject,
  type WikiSupportRouteType,
} from '@/lib/services/wiki-support-index';
import {
  goodsCapitalRows,
  goodsImpactRows,
  goodsOperatingFacts,
  goodsOperatingOutputs,
  goodsSourceDocuments,
  goodsSupportRoutes,
} from '@/lib/services/goods-operating-system';
import {
  createOpportunity,
  findPipelineByName,
  getPipelines,
  updateOpportunity,
  PIPELINE_NAMES,
} from '@/lib/ghl';

export const DEFAULT_NOTION_GRANT_PIPELINE_DATASOURCE_ID =
  'collection://3179e5da-b77c-4618-ad9a-55ac0798485d';
export const DEFAULT_NOTION_PROJECTS_DATASOURCE_ID =
  'collection://0786139b-85d6-4699-b2bc-5b2effd52457';
export const DEFAULT_NOTION_PEOPLE_DATASOURCE_ID =
  'collection://305ebcf9-81cf-81cb-941e-000b2e75c63a';

export type OpportunitySignalSource =
  | 'wiki'
  | 'grant'
  | 'foundation'
  | 'procurement'
  | 'crm'
  | 'notion'
  | 'goods';

export type OpportunitySignalLane =
  | 'grant'
  | 'foundation'
  | 'procurement'
  | 'capital'
  | 'buyer'
  | 'relationship'
  | 'communications'
  | 'evidence'
  | 'systems';

export type OpportunitySignalStatus =
  | 'discovered'
  | 'researching'
  | 'qualified'
  | 'briefing'
  | 'pursuing'
  | 'submitted'
  | 'won'
  | 'lost'
  | 'monitor'
  | 'no-go';

export type OpportunityReadiness = 'high' | 'medium' | 'low' | 'unknown';
export type OpportunitySourceConfidence = 'high' | 'medium' | 'low';
export type RelationshipWarmth = 'hot' | 'warm' | 'cold' | 'unknown';

export interface OpportunityBrowseLink {
  label: string;
  href: string;
  kind:
    | 'grant'
    | 'foundation'
    | 'entity'
    | 'procurement'
    | 'crm'
    | 'notion'
    | 'wiki'
    | 'goods'
    | 'api';
}

export interface OpportunityEvidenceRef {
  label: string;
  source: string;
  detail: string;
  href?: string;
}

export interface OpportunityRelationshipRef {
  label: string;
  system: 'ghl' | 'notion' | 'civicgraph' | 'wiki';
  warmth: RelationshipWarmth;
  detail: string;
  href?: string;
}

export type OpportunityActionKind =
  | 'promote_to_pipeline'
  | 'send_to_ghl'
  | 'send_to_notion'
  | 'mark_no_go'
  | 'create_brief_task'
  | 'request_ingestion'
  | 'no'
  | 'later'
  | 'research'
  | 'partner_path'
  | 'apply_path'
  | 'add_evidence_gap'
  | 'contact'
  | 'brief'
  | 'qualify'
  | 'monitor'
  | 'ingest'
  | 'no-go';

export interface OpportunityNextAction {
  kind: OpportunityActionKind;
  label: string;
  description: string;
}

export interface OpportunitySignal {
  id: string;
  title: string;
  summary: string;
  source: OpportunitySignalSource;
  sourceLabel: string;
  sourceRef: string;
  sourceUrl: string | null;
  lane: OpportunitySignalLane;
  status: OpportunitySignalStatus;
  project: string;
  projects: string[];
  organisation: string | null;
  amount: string | null;
  deadline: string | null;
  score: number;
  scoreReasons: string[];
  whyNow: string;
  readiness: {
    level: OpportunityReadiness;
    notes: string[];
  };
  evidence: OpportunityEvidenceRef[];
  relationships: OpportunityRelationshipRef[];
  nextAction: OpportunityNextAction;
  browseLinks: OpportunityBrowseLink[];
  lastSyncedAt: string | null;
  sourceConfidence: OpportunitySourceConfidence;
  freshness: 'fresh' | 'stale' | 'unknown';
  matchedKeys: string[];
}

export interface OpportunitySourceHealth {
  key: OpportunitySignalSource | 'pipeline' | 'notion_grants' | 'notion_projects' | 'notion_people';
  label: string;
  status: 'ok' | 'configured' | 'mirror-only' | 'empty' | 'error';
  count: number;
  freshness: string | null;
  detail: string;
  actionNeeded?: string;
}

export interface OpportunityRelationshipContact {
  id: string;
  name: string;
  organisation: string | null;
  system: 'ghl' | 'notion' | 'civicgraph';
  warmth: RelationshipWarmth;
  tags: string[];
  projects: string[];
  lastContactDate: string | null;
  nextTouch: string;
  href: string | null;
}

export interface OpportunityRelationshipContext {
  summary: string;
  warmCount: number;
  staleCount: number;
  priorityContacts: OpportunityRelationshipContact[];
  commonTags: Array<{ tag: string; count: number }>;
}

export interface OpportunityProjectState {
  code: string;
  name: string;
  lens: string;
  readiness: ActProjectState['readiness'];
  currentState: string;
  opportunityAlignment: string;
  nextQuestion: string;
}

export type OpportunityRoutePathway =
  | 'grant'
  | 'foundation'
  | 'procurement'
  | 'buyer'
  | 'capital'
  | 'relationship'
  | 'monitor';

export type OpportunityRecommendedRole = 'lead' | 'partner' | 'contractor' | 'monitor';

export interface OpportunityRoute {
  id: string;
  signalId: string;
  title: string;
  source: OpportunitySignalSource;
  sourceRef: string;
  sourceUrl: string | null;
  project: string;
  project_code: string;
  project_name: string;
  pathway: OpportunityRoutePathway;
  recommended_role: OpportunityRecommendedRole;
  fit_score: number;
  readiness_score: number;
  relationship_score: number;
  urgency_score: number;
  overall_score: number;
  why_recommended: string;
  why_not: string | null;
  evidence_gaps: string[];
  next_action: string;
  ghl: {
    recommendedPipeline: string;
    suggestedStage: string;
    existingOpportunityId: string | null;
    contactId: string | null;
    tags: string[];
  };
  signal: OpportunitySignal;
}

export interface OpportunityProjectQueue {
  project_code: string;
  project_name: string;
  routes: OpportunityRoute[];
  topScore: number;
}

export interface OpportunityLearningSummary {
  decisionCount: number;
  negativeCount: number;
  positiveCount: number;
  moreInfoCount: number;
  commonNoReasons: Array<{ reason: string; count: number }>;
  notes: string[];
}

export interface OpportunityIntelligenceFilters {
  project?: string;
  lane?: OpportunitySignalLane;
  source?: OpportunitySignalSource;
  status?: OpportunitySignalStatus;
  q?: string;
  deadline?: 'overdue' | '30d' | '60d' | '90d' | 'none';
  minScore?: number;
}

export interface OpportunityIntelligenceResponse {
  generatedAt: string;
  filters: OpportunityIntelligenceFilters;
  signals: OpportunitySignal[];
  routes: OpportunityRoute[];
  topDirective: OpportunityRoute | null;
  projectQueues: OpportunityProjectQueue[];
  learningSummary: OpportunityLearningSummary;
  actions: OpportunityNextAction[];
  sourceHealth: OpportunitySourceHealth[];
  projectState: OpportunityProjectState[];
  relationshipContext: OpportunityRelationshipContext;
  safety: {
    mode: 'mirror-plus-actions';
    externalWrites: 'disabled-by-default';
    notes: string[];
  };
}

export interface OpportunityActionRequest {
  kind: OpportunityActionKind;
  signalId?: string;
  signal?: Pick<OpportunitySignal, 'id' | 'title' | 'source' | 'sourceRef' | 'sourceUrl' | 'lane' | 'project' | 'projects' | 'organisation' | 'amount' | 'deadline'>;
  route?: Pick<
    OpportunityRoute,
    | 'id'
    | 'signalId'
    | 'title'
    | 'source'
    | 'sourceRef'
    | 'sourceUrl'
    | 'project'
    | 'project_code'
    | 'project_name'
    | 'pathway'
    | 'recommended_role'
    | 'evidence_gaps'
    | 'next_action'
    | 'ghl'
  >;
  note?: string;
  owner?: string;
  targetSystem?: 'ghl' | 'notion' | 'civicgraph';
  confirmWrite?: boolean;
  orgProfileId?: string;
  reason?: string;
  evidenceGaps?: string[];
}

export interface OpportunityActionContext {
  userId?: string | null;
}

export interface OpportunityIntelligenceActionReceipt {
  id: string;
  kind: OpportunityActionKind;
  signalId: string | null;
  title: string;
  status: 'planned' | 'blocked' | 'written';
  createdAt: string;
  writeMode: 'planned' | 'confirmed';
  externalWrites: Array<{
    system: 'ghl' | 'supabase' | 'supabase_decision' | 'supabase_pipeline';
    id: string;
    status: 'created' | 'updated' | 'recorded' | 'skipped';
  }>;
  warnings: string[];
  nextStep: string;
  payload: {
    source: OpportunitySignalSource | null;
    sourceRef: string | null;
    lane: OpportunitySignalLane | OpportunityRoutePathway | null;
    project: string | null;
    projectCode: string | null;
    owner: string | null;
    note: string | null;
  };
}

export interface OpportunityScoreInput {
  title: string;
  summary?: string | null;
  source: OpportunitySignalSource;
  lane: OpportunitySignalLane;
  projects: string[];
  deadline?: string | null;
  evidenceCount?: number;
  relationshipWarmth?: RelationshipWarmth;
  readiness?: OpportunityReadiness;
  sourceConfidence?: OpportunitySourceConfidence;
  freshness?: 'fresh' | 'stale' | 'unknown';
}

interface ProjectLens {
  id: string;
  label: string;
  codes: string[];
  keywords: string[];
}

interface QueryOutcome<T> {
  rows: T[];
  error: string | null;
}

interface GrantOpportunityRow {
  id: string;
  name: string;
  description: string | null;
  provider: string | null;
  program: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  closes_at: string | null;
  url: string | null;
  focus_areas: unknown;
  categories: unknown;
  aligned_projects: unknown;
  fit_score: number | null;
  relevance_score: number | null;
  requirements_summary: string | null;
  last_verified_at: string | null;
  ghl_opportunity_id: string | null;
  application_status: string | null;
  source: string | null;
}

interface FoundationProgramRow {
  id: string;
  foundation_id: string | null;
  name: string;
  url: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  status: string | null;
  categories: unknown;
  eligibility: string | null;
  program_type: string | null;
  thematic_focus: unknown;
  place_focus: unknown;
  source_urls: unknown;
  scraped_at: string | null;
}

interface FoundationRow {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  total_giving_annual: number | null;
  thematic_focus: unknown;
  geographic_focus: unknown;
  application_tips: string | null;
  enriched_at: string | null;
}

interface SocialEnterpriseRow {
  id: string;
  name: string;
  abn: string | null;
  website: string | null;
  description: string | null;
  org_type: string | null;
  sector: unknown;
  state: string | null;
  city: string | null;
  postcode: string | null;
  certifications: unknown;
  source_primary: string | null;
  enriched_at: string | null;
}

interface AustenderContractRow {
  id: string;
  title: string | null;
  description: string | null;
  contract_value: number | null;
  category: string | null;
  contract_start: string | null;
  contract_end: string | null;
  date_modified: string | null;
  buyer_name: string | null;
  supplier_name: string | null;
  supplier_abn: string | null;
  source_url: string | null;
}

interface GhlContactRow {
  id: string;
  ghl_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  tags: string[] | null;
  projects: string[] | null;
  engagement_status: string | null;
  last_contact_date: string | null;
  ghl_updated_at: string | null;
  updated_at: string | null;
  website: string | null;
  canonical_entity_id: string | null;
}

interface GhlOpportunityRow {
  id: string;
  ghl_id: string | null;
  ghl_contact_id: string | null;
  ghl_pipeline_id: string | null;
  ghl_stage_id: string | null;
  name: string;
  pipeline_name: string | null;
  stage_name: string | null;
  status: string | null;
  monetary_value: number | null;
  assigned_to: string | null;
  ghl_created_at: string | null;
  ghl_updated_at: string | null;
  last_synced_at: string | null;
  project_code: string | null;
}

interface OrgPipelineRow {
  id: string;
  name: string;
  amount_display: string | null;
  amount_numeric: number | null;
  funder: string | null;
  deadline: string | null;
  status: string | null;
  grant_opportunity_id: string | null;
  notes: string | null;
  updated_at: string | null;
  funder_type: string | null;
  ghl_opportunity_id?: string | null;
  source_type?: string | null;
  source_ref?: string | null;
  pathway?: string | null;
  recommended_role?: string | null;
  project_code?: string | null;
}

interface OpportunityDecisionRow {
  id: string;
  source_type: string;
  source_ref: string;
  project_code: string | null;
  pathway: string | null;
  decision: string;
  reason: string | null;
  notes: string | null;
  evidence_gaps: string[] | null;
  outcome: string | null;
  created_at: string | null;
}

const PROJECT_LENSES: ProjectLens[] = [
  {
    id: 'goods',
    label: 'Goods',
    codes: ['ACT-GD'],
    keywords: ['goods', 'bed', 'beds', 'washing', 'washer', 'remote', 'housing', 'circular', 'procurement'],
  },
  {
    id: 'justicehub',
    label: 'JusticeHub',
    codes: ['ACT-JH'],
    keywords: ['justice', 'youth', 'diversion', 'recidivism', 'detention', 'restorative', 'mentor'],
  },
  {
    id: 'empathy-ledger',
    label: 'Empathy Ledger',
    codes: ['ACT-EL'],
    keywords: ['empathy', 'ledger', 'story', 'storytelling', 'storyteller', 'consent', 'lived experience'],
  },
  {
    id: 'civicgraph',
    label: 'CivicGraph',
    codes: ['ACT-CS', 'ACT-IN'],
    keywords: ['civicgraph', 'grantscope', 'data', 'intelligence', 'evidence', 'transparency', 'grant finder'],
  },
  {
    id: 'harvest',
    label: 'Harvest',
    codes: ['ACT-HV'],
    keywords: ['harvest', 'food', 'nutrition', 'community food', 'garden'],
  },
  {
    id: 'farm',
    label: 'Farm',
    codes: ['ACT-FM'],
    keywords: ['farm', 'bcv', 'agriculture', 'land', 'trees', 'regenerative'],
  },
  {
    id: 'contained',
    label: 'Contained',
    codes: ['ACT-CN'],
    keywords: ['contained', 'container', 'tour', 'immersive', 'exhibition', 'installation'],
  },
];

const SOURCE_LABELS: Record<OpportunitySignalSource, string> = {
  wiki: 'Tractorpedia / wiki',
  grant: 'GrantScope grant index',
  foundation: 'Foundation intelligence',
  procurement: 'Procurement and buyer signals',
  crm: 'GoHighLevel mirror',
  notion: 'Notion coordination',
  goods: 'Goods operating system',
};

const LANE_LABELS: Record<OpportunitySignalLane, string> = {
  grant: 'Grant',
  foundation: 'Foundation',
  procurement: 'Procurement',
  capital: 'Capital',
  buyer: 'Buyer',
  relationship: 'Relationship',
  communications: 'Communications',
  evidence: 'Evidence',
  systems: 'Systems',
};

const PROJECT_CODE_BY_LENS: Record<string, string> = Object.fromEntries(
  PROJECT_LENSES.map((lens) => [lens.id, lens.codes[0]]),
) as Record<string, string>;

const PROJECT_NAME_BY_CODE = new Map(ACT_PROJECT_STATES.map((project) => [project.code, project.name]));

const WRITE_DECISIONS = new Set<OpportunityActionKind>([
  'no',
  'later',
  'research',
  'partner_path',
  'apply_path',
  'add_evidence_gap',
  'promote_to_pipeline',
  'send_to_ghl',
  'mark_no_go',
  'no-go',
]);

function normaliseKey(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTextList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean);
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  if (typeof value === 'object') return [JSON.stringify(value)];
  return [String(value)];
}

function textBlock(parts: Array<string | number | null | undefined | string[]>) {
  return parts.flatMap((part) => (Array.isArray(part) ? part : [part])).filter(Boolean).join(' ');
}

function amountLabel(min: number | null | undefined, max: number | null | undefined) {
  if (min && max) return `$${min.toLocaleString()} to $${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return null;
}

function compactDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function normaliseHref(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('www.')) return `https://${trimmed}`;
  return trimmed;
}

function daysUntil(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((parsed.getTime() - now.getTime()) / 86_400_000);
}

function freshnessFromDate(value: string | null | undefined, now = new Date()) {
  const days = daysUntil(value, now);
  if (days === null) return 'unknown' as const;
  if (days < -120) return 'stale' as const;
  return 'fresh' as const;
}

function inferProjects(parts: Array<string | string[] | null | undefined>) {
  const haystack = textBlock(parts).toLowerCase();
  const explicit = new Set<string>();

  for (const lens of PROJECT_LENSES) {
    if (lens.codes.some((code) => haystack.includes(code.toLowerCase()))) explicit.add(lens.id);
    if (lens.keywords.some((keyword) => haystack.includes(keyword))) explicit.add(lens.id);
  }

  return explicit.size > 0 ? Array.from(explicit) : ['civicgraph'];
}

function primaryProject(projects: string[]) {
  return projects[0] ?? 'civicgraph';
}

function readinessFromEvidence(evidenceCount: number, relationshipCount = 0): OpportunityReadiness {
  if (evidenceCount >= 3 && relationshipCount >= 1) return 'high';
  if (evidenceCount >= 2) return 'medium';
  if (evidenceCount >= 1) return 'low';
  return 'unknown';
}

function nextActionForSignal(
  lane: OpportunitySignalLane,
  status: OpportunitySignalStatus,
  source: OpportunitySignalSource,
): OpportunityNextAction {
  if (status === 'no-go') {
    return {
      kind: 'no-go',
      label: 'Keep as no-go',
      description: 'Keep the reason visible so the same opportunity is not reworked later.',
    };
  }
  if (source === 'wiki' || source === 'goods') {
    return {
      kind: 'brief',
      label: 'Create brief',
      description: 'Turn the existing evidence into a focused opportunity brief or ask.',
    };
  }
  if (source === 'crm' || lane === 'relationship' || lane === 'buyer') {
    return {
      kind: 'contact',
      label: 'Queue contact',
      description: 'Use GHL for a human next touch. V1 does not auto-send email or SMS.',
    };
  }
  if (lane === 'grant' || lane === 'foundation' || lane === 'capital') {
    return {
      kind: 'qualify',
      label: 'Qualify fit',
      description: 'Check eligibility, evidence, lead applicant, budget, and relationship path.',
    };
  }
  return {
    kind: 'monitor',
    label: 'Monitor',
    description: 'Keep the signal visible until more evidence or a relationship path appears.',
  };
}

export function scoreOpportunitySignal(input: OpportunityScoreInput, now = new Date()) {
  let score = 50;
  const reasons: string[] = [];

  const sourceBoost: Record<OpportunitySignalSource, number> = {
    wiki: 12,
    grant: 8,
    foundation: 9,
    procurement: 10,
    crm: 6,
    notion: 5,
    goods: 12,
  };
  score += sourceBoost[input.source];
  reasons.push(`${SOURCE_LABELS[input.source]} signal`);

  const projectBoost = input.projects.some((project) => ['goods', 'justicehub', 'empathy-ledger'].includes(project)) ? 10 : 6;
  score += projectBoost;
  reasons.push(`${input.projects.map(projectLabel).join(', ')} project fit`);

  if (input.lane === 'procurement' || input.lane === 'buyer') {
    score += input.projects.includes('goods') ? 15 : 8;
    reasons.push('buyer or procurement lane');
  }
  if (input.lane === 'grant' || input.lane === 'foundation' || input.lane === 'capital') {
    score += 8;
    reasons.push(`${LANE_LABELS[input.lane]} lane`);
  }

  const deadlineDays = daysUntil(input.deadline, now);
  if (deadlineDays !== null) {
    if (deadlineDays < 0) {
      score -= 20;
      reasons.push('deadline appears past');
    } else if (deadlineDays <= 30) {
      score += 12;
      reasons.push('deadline within 30 days');
    } else if (deadlineDays <= 60) {
      score += 7;
      reasons.push('deadline within 60 days');
    } else if (deadlineDays <= 90) {
      score += 3;
      reasons.push('deadline within 90 days');
    }
  }

  if ((input.evidenceCount ?? 0) >= 3) {
    score += 8;
    reasons.push('evidence pack available');
  } else if ((input.evidenceCount ?? 0) >= 1) {
    score += 4;
    reasons.push('some evidence available');
  }

  if (input.relationshipWarmth === 'hot') {
    score += 10;
    reasons.push('hot relationship');
  } else if (input.relationshipWarmth === 'warm') {
    score += 6;
    reasons.push('warm relationship');
  }

  if (input.readiness === 'high') {
    score += 6;
    reasons.push('high readiness');
  } else if (input.readiness === 'low') {
    score -= 5;
    reasons.push('readiness gap');
  }

  if (input.sourceConfidence === 'high') score += 4;
  if (input.sourceConfidence === 'low') score -= 4;
  if (input.freshness === 'stale') score -= 6;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: Array.from(new Set(reasons)).slice(0, 6),
  };
}

function projectLabel(project: string) {
  return PROJECT_LENSES.find((lens) => lens.id === project)?.label ?? project;
}

function routeTypeToLane(routeType: WikiSupportRouteType): OpportunitySignalLane {
  if (routeType === 'grant') return 'grant';
  if (routeType === 'foundation') return 'foundation';
  if (routeType === 'procurement') return 'procurement';
  if (routeType === 'capital') return 'capital';
  if (routeType === 'systems') return 'systems';
  return 'evidence';
}

function createSignal(
  input: Omit<OpportunitySignal, 'score' | 'scoreReasons' | 'nextAction' | 'freshness' | 'matchedKeys'> & {
    scoreOverride?: number;
    scoreReasons?: string[];
    matchedKeys?: string[];
  },
): OpportunitySignal {
  const readiness = input.readiness.level;
  const relationshipWarmth = input.relationships.find((rel) => rel.warmth !== 'unknown')?.warmth ?? 'unknown';
  const freshness = freshnessFromDate(input.lastSyncedAt ?? input.deadline);
  const sourceUrl = normaliseHref(input.sourceUrl);
  const browseLinks = input.browseLinks
    .map((link) => ({ ...link, href: normaliseHref(link.href) ?? link.href }))
    .filter((link) => Boolean(link.href));
  const scored =
    input.scoreOverride !== undefined
      ? { score: input.scoreOverride, reasons: input.scoreReasons ?? ['source score'] }
      : scoreOpportunitySignal({
          title: input.title,
          summary: input.summary,
          source: input.source,
          lane: input.lane,
          projects: input.projects,
          deadline: input.deadline,
          evidenceCount: input.evidence.length,
          relationshipWarmth,
          readiness,
          sourceConfidence: input.sourceConfidence,
          freshness,
        });

  return {
    ...input,
    sourceUrl,
    browseLinks,
    score: scored.score,
    scoreReasons: scored.reasons,
    nextAction: nextActionForSignal(input.lane, input.status, input.source),
    freshness,
    matchedKeys: [
      normaliseKey(input.sourceRef),
      normaliseKey(sourceUrl),
      normaliseKey(`${input.source}:${input.title}`),
      ...(input.matchedKeys ?? []).map(normaliseKey),
    ].filter(Boolean),
  };
}

function wikiSignals(): OpportunitySignal[] {
  const index = getWikiSupportIndex();
  return index.support_actions.slice(0, 18).map((action: WikiSupportAction) => {
    const lane = routeTypeToLane(action.route_type);
    const projects = inferProjects([action.project_slug, action.project_code ?? '', action.title, action.summary]);
    const evidence = action.source_documents.slice(0, 3).map((source) => ({
      label: source.label,
      source: 'ACT wiki',
      detail: source.path,
      href: source.path.startsWith('/') ? source.path : undefined,
    }));

    return createSignal({
      id: `wiki:${action.id}`,
      title: action.title,
      summary: action.summary,
      source: 'wiki',
      sourceLabel: SOURCE_LABELS.wiki,
      sourceRef: action.id,
      sourceUrl: action.grant_finder_href,
      lane,
      status: action.priority === 'high' ? 'qualified' : 'researching',
      project: primaryProject(projects),
      projects,
      organisation: null,
      amount: null,
      deadline: null,
      whyNow: action.next_step,
      readiness: {
        level: readinessFromEvidence(evidence.length),
        notes: action.source_discovery_queries.slice(0, 2),
      },
      evidence,
      relationships: [],
      browseLinks: [
        { label: 'Run grant finder query', href: action.grant_finder_href, kind: 'grant' },
        { label: 'Opportunity intelligence API', href: '/api/opportunity-intelligence', kind: 'api' },
      ],
      lastSyncedAt: index.generated_at,
      sourceConfidence: 'high',
    });
  });
}

function wikiProjectSignals(): OpportunitySignal[] {
  const index = getWikiSupportIndex();
  return index.projects.slice(0, 8).map((project: WikiSupportProject) => {
    const projects = inferProjects([project.slug, project.name, project.code ?? '', project.themes]);
    const evidence = project.evidence.slice(0, 3).map((item) => ({
      label: item.label,
      source: item.source,
      detail: `${item.value}: ${item.detail}`,
    }));

    return createSignal({
      id: `wiki-project:${project.slug}`,
      title: `${project.name} support routes`,
      summary: project.summary,
      source: 'wiki',
      sourceLabel: SOURCE_LABELS.wiki,
      sourceRef: project.slug,
      sourceUrl: null,
      lane: 'systems',
      status: project.readiness_gaps.length > 0 ? 'researching' : 'qualified',
      project: primaryProject(projects),
      projects,
      organisation: 'A Curious Tractor',
      amount: null,
      deadline: null,
      whyNow: project.routes.map((route) => route.next_action).slice(0, 2).join(' '),
      readiness: {
        level: readinessFromEvidence(evidence.length),
        notes: project.readiness_gaps.slice(0, 3),
      },
      evidence,
      relationships: [],
      browseLinks: [
        { label: 'Source documents', href: `/api/opportunity-intelligence?project=${primaryProject(projects)}`, kind: 'api' },
      ],
      lastSyncedAt: index.generated_at,
      sourceConfidence: 'high',
      matchedKeys: [project.code ?? project.slug],
    });
  });
}

function goodsSignals(): OpportunitySignal[] {
  const evidence = [
    ...goodsOperatingFacts.slice(0, 2).map((fact) => ({
      label: fact.label,
      source: 'Goods operating facts',
      detail: `${fact.value}: ${fact.detail}`,
    })),
    ...goodsSourceDocuments.slice(0, 2).map((doc) => ({
      label: doc.label,
      source: doc.source,
      detail: doc.use,
    })),
  ];

  const routeSignals = goodsSupportRoutes.map((route) => {
    const lane =
      route.lane === 'Grants'
        ? 'grant'
        : route.lane === 'Foundations'
          ? 'foundation'
          : (route.lane.toLowerCase() as OpportunitySignalLane);
    return createSignal({
      id: `goods-route:${normaliseKey(route.lane)}`,
      title: `Goods ${route.lane} route`,
      summary: route.use,
      source: 'goods',
      sourceLabel: SOURCE_LABELS.goods,
      sourceRef: `goods:${route.lane}`,
      sourceUrl: route.nextSurface,
      lane,
      status: 'qualified',
      project: 'goods',
      projects: ['goods'],
      organisation: 'Goods on Country',
      amount: null,
      deadline: null,
      whyNow: 'Goods has operating proof and named lanes. The cockpit should now attach specific funders, buyers, and evidence packs to each lane.',
      readiness: {
        level: 'high',
        notes: goodsOperatingOutputs.slice(0, 2).map((item) => item.use),
      },
      evidence,
      relationships: [
        {
          label: 'Buyer and funder relationships',
          system: 'wiki',
          warmth: 'warm',
          detail: 'Goods operating notes name foundations, mining partners, ACCHOs, hostels, government buyers, and social procurement networks.',
        },
      ],
      browseLinks: [
        { label: 'Goods lane surface', href: route.nextSurface, kind: 'goods' },
        { label: 'Filter cockpit', href: `/api/opportunity-intelligence?project=goods&lane=${lane}`, kind: 'api' },
      ],
      lastSyncedAt: new Date().toISOString(),
      sourceConfidence: 'high',
    });
  });

  const capitalSignals = goodsCapitalRows.map((row) =>
    createSignal({
      id: `goods-capital:${normaliseKey(row.source)}`,
      title: row.source,
      summary: row.ask,
      source: 'goods',
      sourceLabel: SOURCE_LABELS.goods,
      sourceRef: `goods-capital:${row.source}`,
      sourceUrl: null,
      lane: 'capital',
      status: 'researching',
      project: 'goods',
      projects: ['goods'],
      organisation: row.source,
      amount: null,
      deadline: null,
      whyNow: 'Goods needs a capital stack beside grant and procurement lanes so production and stock runway can be financed without collapsing the model.',
      readiness: {
        level: 'medium',
        notes: [row.proof],
      },
      evidence: [
        ...evidence.slice(0, 2),
        {
          label: 'Impact signal',
          source: 'Goods impact rows',
          detail: goodsImpactRows[0]?.evidence ?? 'Goods impact evidence',
        },
      ],
      relationships: [],
      browseLinks: [
        { label: 'Goods cockpit filter', href: '/api/opportunity-intelligence?project=goods&lane=capital', kind: 'api' },
      ],
      lastSyncedAt: new Date().toISOString(),
      sourceConfidence: 'high',
    }),
  );

  return [...routeSignals, ...capitalSignals];
}

async function safeQuery<T>(
  promise: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<QueryOutcome<T>> {
  try {
    const result = await promise;
    if (result.error) return { rows: [], error: result.error.message };
    return { rows: (result.data ?? []) as T[], error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Unknown query error' };
  }
}

async function fetchSupabaseSources() {
  try {
    const db = getServiceSupabase();
    const [
      grants,
      foundationPrograms,
      foundations,
      socialEnterprises,
      contracts,
      ghlContacts,
      ghlOpportunities,
      pipeline,
      decisions,
    ] = await Promise.all([
      safeQuery<GrantOpportunityRow>(
        db
          .from('grant_opportunities')
          .select(
            'id, name, description, provider, program, amount_min, amount_max, deadline, closes_at, url, focus_areas, categories, aligned_projects, fit_score, relevance_score, requirements_summary, last_verified_at, ghl_opportunity_id, application_status, source',
          )
          .order('last_verified_at', { ascending: false, nullsFirst: false })
          .limit(24),
      ),
      safeQuery<FoundationProgramRow>(
        db
          .from('foundation_programs')
          .select(
            'id, foundation_id, name, url, description, amount_min, amount_max, deadline, status, categories, eligibility, program_type, thematic_focus, place_focus, source_urls, scraped_at',
          )
          .order('scraped_at', { ascending: false, nullsFirst: false })
          .limit(18),
      ),
      safeQuery<FoundationRow>(
        db
          .from('foundations')
          .select(
            'id, name, website, description, total_giving_annual, thematic_focus, geographic_focus, application_tips, enriched_at',
          )
          .order('enriched_at', { ascending: false, nullsFirst: false })
          .limit(12),
      ),
      safeQuery<SocialEnterpriseRow>(
        db
          .from('social_enterprises')
          .select(
            'id, name, abn, website, description, org_type, sector, state, city, postcode, certifications, source_primary, enriched_at',
          )
          .order('enriched_at', { ascending: false, nullsFirst: false })
          .limit(12),
      ),
      safeQuery<AustenderContractRow>(
        db
          .from('austender_contracts')
          .select(
            'id, title, description, contract_value, category, contract_start, contract_end, date_modified, buyer_name, supplier_name, supplier_abn, source_url',
          )
          .or(
            [
              'title.ilike.%innovation%',
              'title.ilike.%social enterprise%',
              'title.ilike.%First Nations%',
              'title.ilike.%youth justice%',
              'title.ilike.%washing%',
              'title.ilike.%beds%',
              'description.ilike.%social enterprise%',
              'description.ilike.%First Nations%',
            ].join(','),
          )
          .order('date_modified', { ascending: false, nullsFirst: false })
          .limit(12),
      ),
      safeQuery<GhlContactRow>(
        db
          .from('ghl_contacts')
          .select(
            'id, ghl_id, full_name, first_name, last_name, email, company_name, tags, projects, engagement_status, last_contact_date, ghl_updated_at, updated_at, website, canonical_entity_id',
          )
          .order('ghl_updated_at', { ascending: false, nullsFirst: false })
          .limit(18),
      ),
      safeQuery<GhlOpportunityRow>(
        db
          .from('ghl_opportunities')
          .select(
            'id, ghl_id, ghl_contact_id, ghl_pipeline_id, ghl_stage_id, name, pipeline_name, stage_name, status, monetary_value, assigned_to, ghl_created_at, ghl_updated_at, last_synced_at, project_code',
          )
          .order('ghl_updated_at', { ascending: false, nullsFirst: false })
          .limit(30),
      ),
      safeQuery<OrgPipelineRow>(
        db
          .from('org_pipeline')
          .select('id, name, amount_display, amount_numeric, funder, deadline, status, grant_opportunity_id, notes, updated_at, funder_type, ghl_opportunity_id, source_type, source_ref, pathway, recommended_role, project_code')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(18),
      ),
      safeQuery<OpportunityDecisionRow>(
        db
          .from('opportunity_decisions')
          .select('id, source_type, source_ref, project_code, pathway, decision, reason, notes, evidence_gaps, outcome, created_at')
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(300),
      ),
    ]);

    const pipelineRows = pipeline.error
      ? await safeQuery<OrgPipelineRow>(
          db
            .from('org_pipeline')
            .select('id, name, amount_display, amount_numeric, funder, deadline, status, grant_opportunity_id, notes, updated_at, funder_type')
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(18),
        )
      : pipeline;

    return {
      grants,
      foundationPrograms,
      foundations,
      socialEnterprises,
      contracts,
      ghlContacts,
      ghlOpportunities,
      pipeline: pipelineRows,
      decisions,
    };
  } catch (error) {
    const outcome = { rows: [], error: error instanceof Error ? error.message : 'Supabase client error' };
    return {
      grants: outcome as QueryOutcome<GrantOpportunityRow>,
      foundationPrograms: outcome as QueryOutcome<FoundationProgramRow>,
      foundations: outcome as QueryOutcome<FoundationRow>,
      socialEnterprises: outcome as QueryOutcome<SocialEnterpriseRow>,
      contracts: outcome as QueryOutcome<AustenderContractRow>,
      ghlContacts: outcome as QueryOutcome<GhlContactRow>,
      ghlOpportunities: outcome as QueryOutcome<GhlOpportunityRow>,
      pipeline: outcome as QueryOutcome<OrgPipelineRow>,
      decisions: outcome as QueryOutcome<OpportunityDecisionRow>,
    };
  }
}

function grantSignals(rows: GrantOpportunityRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const categories = toTextList(row.categories);
    const focusAreas = toTextList(row.focus_areas);
    const alignedProjects = toTextList(row.aligned_projects);
    const projects = inferProjects([row.name, row.description, row.provider, row.program, categories, focusAreas, alignedProjects]);
    const deadline = compactDate(row.closes_at ?? row.deadline);
    const evidence: OpportunityEvidenceRef[] = [
      row.requirements_summary
        ? { label: 'Requirements summary', source: 'grant_opportunities', detail: row.requirements_summary }
        : null,
      categories.length ? { label: 'Categories', source: 'grant_opportunities', detail: categories.slice(0, 5).join(', ') } : null,
      focusAreas.length ? { label: 'Focus areas', source: 'grant_opportunities', detail: focusAreas.slice(0, 5).join(', ') } : null,
    ].filter(Boolean) as OpportunityEvidenceRef[];

    return createSignal({
      id: `grant:${row.id}`,
      title: row.name,
      summary: row.description || row.requirements_summary || `${row.provider ?? 'Unknown provider'} grant opportunity`,
      source: 'grant',
      sourceLabel: SOURCE_LABELS.grant,
      sourceRef: row.id,
      sourceUrl: row.url,
      lane: 'grant',
      status: mapPipelineStatus(row.application_status),
      project: primaryProject(projects),
      projects,
      organisation: row.provider,
      amount: amountLabel(row.amount_min, row.amount_max),
      deadline,
      whyNow: deadline ? `Closing or deadline indexed for ${deadline}.` : 'Indexed grant with no deadline, needs monitoring or ingestion refresh.',
      readiness: {
        level: readinessFromEvidence(evidence.length, row.ghl_opportunity_id ? 1 : 0),
        notes: alignedProjects.length ? [`Aligned projects: ${alignedProjects.join(', ')}`] : ['Check applicant, co-contribution, and attachments.'],
      },
      evidence,
      relationships: row.ghl_opportunity_id
        ? [
            {
              label: 'GHL opportunity linked',
              system: 'ghl',
              warmth: 'warm',
              detail: row.ghl_opportunity_id,
            },
          ]
        : [],
      browseLinks: [
        row.url ? { label: 'Grant source', href: row.url, kind: 'grant' } : null,
        { label: 'Grant finder search', href: `/grants?type=open_opportunity&q=${encodeURIComponent(row.name)}`, kind: 'grant' },
        { label: 'Cockpit API row', href: `/api/opportunity-intelligence?source=grant&q=${encodeURIComponent(row.name)}`, kind: 'api' },
      ].filter(Boolean) as OpportunityBrowseLink[],
      lastSyncedAt: row.last_verified_at,
      sourceConfidence: row.last_verified_at ? 'high' : 'medium',
      scoreOverride: normaliseDbScore(row.fit_score ?? row.relevance_score),
      scoreReasons: row.fit_score || row.relevance_score ? ['database fit score'] : undefined,
    });
  });
}

function normaliseDbScore(value: number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value > 0 && value <= 1) return Math.round(value * 100);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function foundationProgramSignals(rows: FoundationProgramRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const categories = toTextList(row.categories);
    const themes = toTextList(row.thematic_focus);
    const places = toTextList(row.place_focus);
    const sourceUrls = toTextList(row.source_urls);
    const projects = inferProjects([row.name, row.description, row.eligibility, row.program_type, categories, themes, places]);
    const evidence: OpportunityEvidenceRef[] = [
      row.eligibility ? { label: 'Eligibility', source: 'foundation_programs', detail: row.eligibility } : null,
      themes.length ? { label: 'Thematic focus', source: 'foundation_programs', detail: themes.slice(0, 5).join(', ') } : null,
      places.length ? { label: 'Place focus', source: 'foundation_programs', detail: places.slice(0, 5).join(', ') } : null,
    ].filter(Boolean) as OpportunityEvidenceRef[];

    return createSignal({
      id: `foundation-program:${row.id}`,
      title: row.name,
      summary: row.description || row.eligibility || 'Foundation program signal',
      source: 'foundation',
      sourceLabel: SOURCE_LABELS.foundation,
      sourceRef: row.id,
      sourceUrl: row.url ?? sourceUrls[0] ?? null,
      lane: 'foundation',
      status: mapPipelineStatus(row.status),
      project: primaryProject(projects),
      projects,
      organisation: row.foundation_id,
      amount: amountLabel(row.amount_min, row.amount_max),
      deadline: compactDate(row.deadline),
      whyNow: row.deadline ? `Program deadline is indexed for ${compactDate(row.deadline)}.` : 'Foundation program has no indexed deadline, so relationship timing matters.',
      readiness: {
        level: readinessFromEvidence(evidence.length),
        notes: [row.program_type, ...categories].filter(Boolean).slice(0, 3) as string[],
      },
      evidence,
      relationships: [],
      browseLinks: [
        row.url ? { label: 'Program source', href: row.url, kind: 'foundation' } : null,
        { label: 'Foundation filter', href: `/api/opportunity-intelligence?source=foundation&q=${encodeURIComponent(row.name)}`, kind: 'api' },
      ].filter(Boolean) as OpportunityBrowseLink[],
      lastSyncedAt: row.scraped_at,
      sourceConfidence: row.scraped_at ? 'high' : 'medium',
    });
  });
}

function foundationSignals(rows: FoundationRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const themes = toTextList(row.thematic_focus);
    const places = toTextList(row.geographic_focus);
    const projects = inferProjects([row.name, row.description, row.application_tips, themes, places]);
    const evidence: OpportunityEvidenceRef[] = [
      themes.length ? { label: 'Thematic focus', source: 'foundations', detail: themes.slice(0, 6).join(', ') } : null,
      places.length ? { label: 'Geographic focus', source: 'foundations', detail: places.slice(0, 6).join(', ') } : null,
      row.application_tips ? { label: 'Application tips', source: 'foundations', detail: row.application_tips } : null,
    ].filter(Boolean) as OpportunityEvidenceRef[];

    return createSignal({
      id: `foundation:${row.id}`,
      title: `${row.name} relationship path`,
      summary: row.description || row.application_tips || 'Foundation relationship and funding intelligence.',
      source: 'foundation',
      sourceLabel: SOURCE_LABELS.foundation,
      sourceRef: row.id,
      sourceUrl: row.website,
      lane: 'relationship',
      status: 'researching',
      project: primaryProject(projects),
      projects,
      organisation: row.name,
      amount: row.total_giving_annual ? `$${row.total_giving_annual.toLocaleString()} annual giving indexed` : null,
      deadline: null,
      whyNow: 'Foundation fit should be handled as relationship-led work, not only as an application deadline.',
      readiness: {
        level: readinessFromEvidence(evidence.length),
        notes: ['Find board links, warm path, and strongest project fit.'],
      },
      evidence,
      relationships: [],
      browseLinks: [
        row.website ? { label: 'Foundation website', href: row.website, kind: 'foundation' } : null,
        { label: 'Foundation search', href: `/foundations?q=${encodeURIComponent(row.name)}`, kind: 'foundation' },
      ].filter(Boolean) as OpportunityBrowseLink[],
      lastSyncedAt: row.enriched_at,
      sourceConfidence: row.enriched_at ? 'high' : 'medium',
    });
  });
}

function socialEnterpriseSignals(rows: SocialEnterpriseRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const sectors = toTextList(row.sector);
    const certifications = toTextList(row.certifications);
    const projects = inferProjects([row.name, row.description, row.org_type, sectors, certifications]);
    return createSignal({
      id: `social-enterprise:${row.id}`,
      title: row.name,
      summary: row.description || `${row.org_type ?? 'Social enterprise'} procurement or partnership signal.`,
      source: 'procurement',
      sourceLabel: SOURCE_LABELS.procurement,
      sourceRef: row.id,
      sourceUrl: row.website,
      lane: projects.includes('goods') ? 'buyer' : 'procurement',
      status: 'researching',
      project: primaryProject(projects),
      projects,
      organisation: row.name,
      amount: null,
      deadline: null,
      whyNow: 'Social enterprise and procurement records help route Goods buyers, delivery partners, and social procurement proof.',
      readiness: {
        level: certifications.length || row.abn ? 'medium' : 'low',
        notes: [row.org_type, row.state, row.city, ...sectors.slice(0, 2)].filter(Boolean) as string[],
      },
      evidence: [
        row.abn ? { label: 'ABN', source: 'social_enterprises', detail: row.abn } : null,
        sectors.length ? { label: 'Sector', source: 'social_enterprises', detail: sectors.slice(0, 4).join(', ') } : null,
        certifications.length ? { label: 'Certification', source: 'social_enterprises', detail: certifications.slice(0, 4).join(', ') } : null,
      ].filter(Boolean) as OpportunityEvidenceRef[],
      relationships: [],
      browseLinks: [
        row.website ? { label: 'Organisation website', href: row.website, kind: 'entity' } : null,
        { label: 'Procurement filter', href: `/api/opportunity-intelligence?source=procurement&q=${encodeURIComponent(row.name)}`, kind: 'api' },
      ].filter(Boolean) as OpportunityBrowseLink[],
      lastSyncedAt: row.enriched_at,
      sourceConfidence: row.enriched_at ? 'medium' : 'low',
    });
  });
}

function contractSignals(rows: AustenderContractRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const projects = inferProjects([row.title, row.description, row.category, row.buyer_name, row.supplier_name]);
    return createSignal({
      id: `contract:${row.id}`,
      title: row.title || 'Procurement contract',
      summary: row.description || `${row.buyer_name ?? 'Buyer'} contracted ${row.supplier_name ?? 'supplier'}.`,
      source: 'procurement',
      sourceLabel: SOURCE_LABELS.procurement,
      sourceRef: row.id,
      sourceUrl: row.source_url,
      lane: 'procurement',
      status: 'monitor',
      project: primaryProject(projects),
      projects,
      organisation: row.buyer_name,
      amount: row.contract_value ? `$${row.contract_value.toLocaleString()}` : null,
      deadline: compactDate(row.contract_end),
      whyNow: 'Procurement history can reveal buyer budgets, suppliers, categories, and upcoming renewal paths.',
      readiness: {
        level: row.buyer_name && row.source_url ? 'medium' : 'low',
        notes: [row.category, row.supplier_name].filter(Boolean) as string[],
      },
      evidence: [
        row.buyer_name ? { label: 'Buyer', source: 'austender_contracts', detail: row.buyer_name } : null,
        row.supplier_name ? { label: 'Supplier', source: 'austender_contracts', detail: row.supplier_name } : null,
        row.category ? { label: 'Category', source: 'austender_contracts', detail: row.category } : null,
      ].filter(Boolean) as OpportunityEvidenceRef[],
      relationships: [],
      browseLinks: [
        row.source_url ? { label: 'Austender source', href: row.source_url, kind: 'procurement' } : null,
        { label: 'Buyer search', href: `/api/opportunity-intelligence?lane=procurement&q=${encodeURIComponent(row.buyer_name ?? row.title ?? '')}`, kind: 'api' },
      ].filter(Boolean) as OpportunityBrowseLink[],
      lastSyncedAt: row.date_modified,
      sourceConfidence: row.source_url ? 'high' : 'medium',
    });
  });
}

function contactDisplayName(row: GhlContactRow) {
  const name = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return name || row.company_name || row.email || 'Unnamed contact';
}

function relationshipWarmth(row: Pick<GhlContactRow, 'engagement_status' | 'tags' | 'last_contact_date'>): RelationshipWarmth {
  const haystack = [row.engagement_status, ...(row.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
  if (/\b(hot|active|priority|warm)\b/.test(haystack)) return haystack.includes('hot') ? 'hot' : 'warm';
  if (/\b(cold|inactive|stale)\b/.test(haystack)) return 'cold';
  if (row.last_contact_date) return 'warm';
  return 'unknown';
}

function ghlContactSignals(rows: GhlContactRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const name = contactDisplayName(row);
    const tags = row.tags ?? [];
    const projects = inferProjects([name, row.company_name, row.email, tags, row.projects ?? []]);
    const lane = tags.some((tag) => /buyer|demand|procurement|goods/i.test(tag)) ? 'buyer' : 'relationship';
    const warmth = relationshipWarmth(row);
    return createSignal({
      id: `crm:${row.ghl_id ?? row.id}`,
      title: name,
      summary: `${row.company_name ?? 'CRM contact'} in the local GoHighLevel mirror.`,
      source: 'crm',
      sourceLabel: SOURCE_LABELS.crm,
      sourceRef: row.ghl_id ?? row.id,
      sourceUrl: row.website,
      lane,
      status: warmth === 'cold' ? 'monitor' : 'researching',
      project: primaryProject(projects),
      projects,
      organisation: row.company_name,
      amount: null,
      deadline: null,
      whyNow: 'GHL owns the relationship action. This cockpit should show who needs a human next touch without sending messages automatically.',
      readiness: {
        level: warmth === 'hot' || warmth === 'warm' ? 'medium' : 'low',
        notes: [row.engagement_status, ...tags.slice(0, 4)].filter(Boolean) as string[],
      },
      evidence: [
        tags.length ? { label: 'GHL tags', source: 'ghl_contacts', detail: tags.slice(0, 6).join(', ') } : null,
        row.last_contact_date ? { label: 'Last contact', source: 'ghl_contacts', detail: row.last_contact_date } : null,
      ].filter(Boolean) as OpportunityEvidenceRef[],
      relationships: [
        {
          label: name,
          system: 'ghl',
          warmth,
          detail: row.company_name || row.email || 'GoHighLevel contact',
          href: row.website ?? undefined,
        },
      ],
      browseLinks: [
        row.website ? { label: 'Contact website', href: row.website, kind: 'entity' } : null,
        { label: 'GHL mirror filter', href: `/api/opportunity-intelligence?source=crm&q=${encodeURIComponent(name)}`, kind: 'crm' },
      ].filter(Boolean) as OpportunityBrowseLink[],
      lastSyncedAt: row.ghl_updated_at ?? row.updated_at,
      sourceConfidence: row.ghl_id ? 'high' : 'medium',
    });
  });
}

function ghlOpportunitySignals(rows: GhlOpportunityRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const pipelineName = row.pipeline_name ?? '';
    const stageName = row.stage_name ?? '';
    const haystack = [row.name, pipelineName, stageName, row.project_code].join(' ').toLowerCase();
    const projects = inferProjects([row.name, pipelineName, stageName, row.project_code]);
    const lane: OpportunitySignalLane =
      haystack.includes('demand') || haystack.includes('buyer')
        ? 'buyer'
        : haystack.includes('grant')
          ? 'grant'
          : haystack.includes('procurement')
            ? 'procurement'
            : 'relationship';
    const status = mapPipelineStatus([row.status, stageName].filter(Boolean).join(' '));

    return createSignal({
      id: `crm-opportunity:${row.ghl_id ?? row.id}`,
      title: row.name,
      summary: `Mirrored GHL opportunity in ${pipelineName || 'an unknown pipeline'}${stageName ? `, stage ${stageName}` : ''}.`,
      source: 'crm',
      sourceLabel: SOURCE_LABELS.crm,
      sourceRef: row.ghl_id ?? row.id,
      sourceUrl: null,
      lane,
      status,
      project: primaryProject(projects),
      projects,
      organisation: pipelineName || null,
      amount: row.monetary_value ? `$${row.monetary_value.toLocaleString()}` : null,
      deadline: null,
      whyNow: 'This is already in HighLevel, so the cockpit should reconcile meaning, evidence, and next touch before changing CRM state.',
      readiness: {
        level: row.ghl_id && row.ghl_pipeline_id ? 'medium' : 'low',
        notes: [pipelineName, stageName, row.status, row.assigned_to].filter(Boolean) as string[],
      },
      evidence: [
        pipelineName ? { label: 'GHL pipeline', source: 'ghl_opportunities', detail: pipelineName } : null,
        stageName ? { label: 'GHL stage', source: 'ghl_opportunities', detail: stageName } : null,
        row.monetary_value ? { label: 'Value', source: 'ghl_opportunities', detail: `$${row.monetary_value.toLocaleString()}` } : null,
      ].filter(Boolean) as OpportunityEvidenceRef[],
      relationships: [
        row.ghl_contact_id
          ? {
              label: 'GHL contact',
              system: 'ghl',
              warmth: 'warm',
              detail: row.ghl_contact_id,
            }
          : null,
      ].filter(Boolean) as OpportunityRelationshipRef[],
      browseLinks: [
        { label: 'GHL mirror filter', href: `/api/opportunity-intelligence?source=crm&q=${encodeURIComponent(row.name)}`, kind: 'crm' },
      ],
      lastSyncedAt: row.last_synced_at ?? row.ghl_updated_at ?? row.ghl_created_at,
      sourceConfidence: row.ghl_id ? 'high' : 'medium',
      matchedKeys: [row.ghl_id ?? '', row.id, row.name],
    });
  });
}

function pipelineSignals(rows: OrgPipelineRow[]): OpportunitySignal[] {
  return rows.map((row) => {
    const projects = inferProjects([row.name, row.funder, row.notes, row.funder_type]);
    const lane: OpportunitySignalLane =
      row.pathway && ['grant', 'foundation', 'procurement', 'capital', 'buyer', 'relationship'].includes(row.pathway)
        ? (row.pathway as OpportunitySignalLane)
        : row.funder_type?.toLowerCase().includes('foundation') ? 'foundation' : 'grant';
    return createSignal({
      id: `pipeline:${row.id}`,
      title: row.name,
      summary: row.notes || `${row.funder ?? 'Funder'} tracked in the ACT pipeline.`,
      source: 'notion',
      sourceLabel: SOURCE_LABELS.notion,
      sourceRef: row.id,
      sourceUrl: row.grant_opportunity_id ? `/grants/${row.grant_opportunity_id}` : null,
      lane,
      status: mapPipelineStatus(row.status),
      project: primaryProject(projects),
      projects,
      organisation: row.funder,
      amount: row.amount_display ?? (row.amount_numeric ? `$${row.amount_numeric.toLocaleString()}` : null),
      deadline: row.deadline,
      whyNow: 'This row is already tracked by ACT and should be reconciled with GHL, Notion, and source evidence before the next touch.',
      readiness: {
        level: row.grant_opportunity_id ? 'medium' : 'low',
        notes: [row.status, row.funder_type].filter(Boolean) as string[],
      },
      evidence: [
        row.grant_opportunity_id
          ? { label: 'Grant opportunity ID', source: 'org_pipeline', detail: row.grant_opportunity_id }
          : null,
        row.notes ? { label: 'Pipeline notes', source: 'org_pipeline', detail: row.notes } : null,
      ].filter(Boolean) as OpportunityEvidenceRef[],
      relationships: [],
      browseLinks: [
        row.grant_opportunity_id ? { label: 'Grant record', href: `/grants/${row.grant_opportunity_id}`, kind: 'grant' } : null,
        { label: 'Pipeline filter', href: `/api/opportunity-intelligence?source=notion&q=${encodeURIComponent(row.name)}`, kind: 'api' },
      ].filter(Boolean) as OpportunityBrowseLink[],
      lastSyncedAt: row.updated_at,
      sourceConfidence: 'medium',
    });
  });
}

function notionConfigSignals(): OpportunitySignal[] {
  const grantSource = process.env.NOTION_GRANT_PIPELINE_DATASOURCE_ID || DEFAULT_NOTION_GRANT_PIPELINE_DATASOURCE_ID;
  const projectsSource = process.env.NOTION_PROJECTS_DATASOURCE_ID || DEFAULT_NOTION_PROJECTS_DATASOURCE_ID;
  const peopleSource = process.env.NOTION_PEOPLE_DATASOURCE_ID || DEFAULT_NOTION_PEOPLE_DATASOURCE_ID;
  return [
    createSignal({
      id: 'notion-config:grant-pipeline',
      title: 'Notion Grant Pipeline Tracker mirror',
      summary: 'Configured coordination source for promoted opportunities, missing documents, readiness scores, and human ownership.',
      source: 'notion',
      sourceLabel: SOURCE_LABELS.notion,
      sourceRef: grantSource,
      sourceUrl: null,
      lane: 'systems',
      status: 'monitor',
      project: 'civicgraph',
      projects: ['civicgraph'],
      organisation: 'A Curious Tractor',
      amount: null,
      deadline: null,
      whyNow: 'Notion owns coordination, but V1 should mirror and explicitly promote records instead of syncing full page bodies.',
      readiness: {
        level: 'medium',
        notes: ['Grant Pipeline Tracker', 'Projects data source', 'People Directory'],
      },
      evidence: [
        { label: 'Grant Pipeline Tracker', source: 'env', detail: grantSource },
        { label: 'Projects data source', source: 'env', detail: projectsSource },
        { label: 'People Directory', source: 'env', detail: peopleSource },
      ],
      relationships: [],
      browseLinks: [
        { label: 'Actions endpoint', href: '/api/opportunity-intelligence/actions', kind: 'api' },
      ],
      lastSyncedAt: new Date().toISOString(),
      sourceConfidence: 'medium',
    }),
  ];
}

function mapPipelineStatus(value: string | null | undefined): OpportunitySignalStatus {
  const normalized = (value ?? '').toLowerCase();
  if (/\b(no[- ]?go|lost|rejected)\b/.test(normalized)) return normalized.includes('no') ? 'no-go' : 'lost';
  if (/\b(won|approved|success)\b/.test(normalized)) return 'won';
  if (/\b(submitted|lodged)\b/.test(normalized)) return 'submitted';
  if (/\b(draft|pursuing|apply|application)\b/.test(normalized)) return 'pursuing';
  if (/\b(qualif|research|review)\b/.test(normalized)) return 'researching';
  if (/\b(monitor|watch)\b/.test(normalized)) return 'monitor';
  return 'discovered';
}

export function dedupeOpportunitySignals(signals: OpportunitySignal[]) {
  const byKey = new Map<string, OpportunitySignal>();
  for (const signal of signals) {
    const keys = signal.matchedKeys.length ? signal.matchedKeys : [normaliseKey(`${signal.source}:${signal.title}`)];
    const existing = keys.map((key) => byKey.get(key)).find(Boolean);
    if (existing) {
      if (signal.score > existing.score) {
        for (const key of existing.matchedKeys) byKey.delete(key);
        for (const key of keys) byKey.set(key, signal);
      }
      continue;
    }
    for (const key of keys) byKey.set(key, signal);
  }

  return Array.from(new Set(byKey.values())).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function filterOpportunitySignals(
  signals: OpportunitySignal[],
  filters: OpportunityIntelligenceFilters,
  now = new Date(),
) {
  return signals.filter((signal) => {
    if (filters.project && !signal.projects.includes(filters.project.toLowerCase())) return false;
    if (filters.lane && signal.lane !== filters.lane) return false;
    if (filters.source && signal.source !== filters.source) return false;
    if (filters.status && signal.status !== filters.status) return false;
    if (filters.minScore !== undefined && signal.score < filters.minScore) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = textBlock([
        signal.title,
        signal.summary,
        signal.organisation,
        signal.projects,
        signal.evidence.map((item) => `${item.label} ${item.detail}`),
        signal.relationships.map((item) => `${item.label} ${item.detail}`),
      ]).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.deadline) {
      if (filters.deadline === 'none') return !signal.deadline;
      const days = daysUntil(signal.deadline, now);
      if (filters.deadline === 'overdue') return days !== null && days < 0;
      if (filters.deadline === '30d') return days !== null && days >= 0 && days <= 30;
      if (filters.deadline === '60d') return days !== null && days >= 0 && days <= 60;
      if (filters.deadline === '90d') return days !== null && days >= 0 && days <= 90;
    }
    return true;
  });
}

function buildProjectState(): OpportunityProjectState[] {
  return ACT_PROJECT_STATES.map((project) => {
    const lens =
      PROJECT_LENSES.find((item) => item.codes.includes(project.code))?.id ??
      inferProjects([project.code, project.name, project.opportunityAlignment])[0] ??
      'civicgraph';
    return {
      code: project.code,
      name: project.name,
      lens,
      readiness: project.readiness,
      currentState: project.currentState,
      opportunityAlignment: project.opportunityAlignment,
      nextQuestion: project.nextQuestion,
    };
  });
}

function buildRelationshipContext(rows: GhlContactRow[]): OpportunityRelationshipContext {
  const contacts = rows.map((row) => {
    const warmth = relationshipWarmth(row);
    const name = contactDisplayName(row);
    const tags = row.tags ?? [];
    const projects = inferProjects([name, row.company_name, tags, row.projects ?? []]);
    const lastContactDays = daysUntil(row.last_contact_date);
    const stale = !row.last_contact_date || (lastContactDays !== null && lastContactDays < -45);
    return {
      id: row.ghl_id ?? row.id,
      name,
      organisation: row.company_name,
      system: 'ghl' as const,
      warmth,
      tags,
      projects,
      lastContactDate: row.last_contact_date,
      nextTouch: stale ? 'Check whether the relationship needs a human next touch.' : 'Use only if tied to a current opportunity.',
      href: row.website,
    };
  });

  const tagCounts = new Map<string, number>();
  for (const contact of contacts) {
    for (const tag of contact.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const warmCount = contacts.filter((contact) => contact.warmth === 'hot' || contact.warmth === 'warm').length;
  const staleCount = contacts.filter((contact) => !contact.lastContactDate || (daysUntil(contact.lastContactDate) ?? 0) < -45).length;

  return {
    summary:
      contacts.length > 0
        ? `${contacts.length} mirrored GHL contacts are available for relationship routing.`
        : 'No GHL contacts were returned from the local mirror.',
    warmCount,
    staleCount,
    priorityContacts: contacts
      .sort((a, b) => {
        const warmthRank = (warmth: RelationshipWarmth) => ({ hot: 0, warm: 1, unknown: 2, cold: 3 })[warmth];
        return warmthRank(a.warmth) - warmthRank(b.warmth) || a.name.localeCompare(b.name);
      })
      .slice(0, 8),
    commonTags: Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 10),
  };
}

function pathwayFromSignal(signal: OpportunitySignal): OpportunityRoutePathway {
  if (signal.lane === 'grant') return 'grant';
  if (signal.lane === 'foundation') return 'foundation';
  if (signal.lane === 'procurement') return 'procurement';
  if (signal.lane === 'buyer') return 'buyer';
  if (signal.lane === 'capital') return 'capital';
  if (signal.lane === 'relationship' || signal.lane === 'communications') return 'relationship';
  return 'monitor';
}

function projectCodeForSignal(signal: OpportunitySignal) {
  const project = signal.projects[0] ?? signal.project ?? 'civicgraph';
  return PROJECT_CODE_BY_LENS[project] ?? 'ACT-IN';
}

function routeProjectName(projectCode: string) {
  return PROJECT_NAME_BY_CODE.get(projectCode) ?? projectLabel(projectCode.toLowerCase());
}

function recommendedRoleFor(signal: OpportunitySignal, pathway: OpportunityRoutePathway): OpportunityRecommendedRole {
  if (pathway === 'monitor') return 'monitor';
  if (pathway === 'procurement') return signal.projects.includes('goods') ? 'contractor' : 'partner';
  if (pathway === 'buyer') return signal.source === 'crm' ? 'lead' : 'contractor';
  if (pathway === 'relationship') return 'partner';
  return 'lead';
}

function readinessScore(level: OpportunityReadiness) {
  if (level === 'high') return 90;
  if (level === 'medium') return 68;
  if (level === 'low') return 38;
  return 28;
}

function relationshipScore(signal: OpportunitySignal) {
  const warmth = signal.relationships.find((relationship) => relationship.warmth !== 'unknown')?.warmth ?? 'unknown';
  if (warmth === 'hot') return 92;
  if (warmth === 'warm') return 72;
  if (warmth === 'cold') return 25;
  return signal.source === 'crm' ? 55 : 32;
}

function urgencyScore(signal: OpportunitySignal) {
  const days = daysUntil(signal.deadline);
  if (days === null) return signal.status === 'pursuing' || signal.status === 'researching' ? 58 : 42;
  if (days < 0) return 8;
  if (days <= 14) return 92;
  if (days <= 30) return 82;
  if (days <= 60) return 66;
  if (days <= 90) return 52;
  return 40;
}

function routeDecisionAdjustment(
  source: OpportunitySignalSource,
  sourceRef: string,
  projectCode: string,
  pathway: OpportunityRoutePathway,
  decisions: OpportunityDecisionRow[],
) {
  let adjustment = 0;
  const notes: string[] = [];
  const gaps = new Set<string>();
  for (const decision of decisions) {
    const sameSource =
      decision.source_type === source && normaliseKey(decision.source_ref) === normaliseKey(sourceRef);
    const sameShape =
      decision.project_code === projectCode && (!decision.pathway || decision.pathway === pathway);
    if (!sameSource && !sameShape) continue;

    if (decision.decision === 'no' || decision.decision === 'lost') {
      adjustment -= sameSource ? 30 : 10;
      if (decision.reason) notes.push(`Past no/loss: ${decision.reason}`);
    } else if (['won', 'apply', 'partner', 'send_to_ghl'].includes(decision.decision)) {
      adjustment += sameSource ? 18 : 8;
      notes.push(`Past positive ${decision.decision}`);
    } else if (decision.decision === 'more_info') {
      adjustment -= 6;
      for (const gap of decision.evidence_gaps ?? []) gaps.add(gap);
    } else if (decision.decision === 'later') {
      adjustment -= sameSource ? 8 : 2;
    } else if (decision.decision === 'research') {
      adjustment += 4;
    }
  }
  return {
    adjustment: Math.max(-38, Math.min(24, adjustment)),
    notes: Array.from(new Set(notes)).slice(0, 3),
    evidenceGaps: Array.from(gaps).slice(0, 4),
  };
}

function evidenceGapsForRoute(
  signal: OpportunitySignal,
  pathway: OpportunityRoutePathway,
  decisionGaps: string[],
) {
  const gaps = new Set<string>(decisionGaps);
  if (!signal.sourceUrl && (pathway === 'grant' || pathway === 'foundation' || pathway === 'procurement')) {
    gaps.add('Source URL or current program page');
  }
  if (!signal.relationships.length && pathway !== 'monitor') gaps.add('Relationship owner or warm path');
  if (signal.readiness.level === 'low' || signal.readiness.level === 'unknown') gaps.add('Eligibility/readiness proof');
  if ((pathway === 'grant' || pathway === 'foundation' || pathway === 'capital') && !signal.amount) gaps.add('Budget or ask size');
  if (pathway === 'buyer' || pathway === 'procurement') gaps.add('Buyer problem, offer, and procurement lane');
  for (const note of signal.readiness.notes.slice(0, 2)) {
    if (/missing|gap|required|unknown/i.test(note)) gaps.add(note);
  }
  return Array.from(gaps).slice(0, 5);
}

function routeNextAction(pathway: OpportunityRoutePathway, role: OpportunityRecommendedRole, gaps: string[]) {
  if (gaps.length > 0) return `Close evidence gap: ${gaps[0]}.`;
  if (pathway === 'grant' || pathway === 'foundation' || pathway === 'capital') {
    return role === 'partner'
      ? 'Confirm lead applicant and partner value before drafting.'
      : 'Qualify eligibility, budget, evidence pack, and submission owner.';
  }
  if (pathway === 'buyer' || pathway === 'procurement') {
    return 'Confirm buyer need, contact owner, and next touch before sending to GHL.';
  }
  if (pathway === 'relationship') return 'Find the relationship owner and set a human next touch.';
  return 'Monitor source freshness and rescore after the next scan.';
}

function routePipeline(pathway: OpportunityRoutePathway, projectCode: string, title: string) {
  const text = `${projectCode} ${pathway} ${title}`.toLowerCase();
  if (projectCode === 'ACT-GD' && text.includes('demand')) {
    return process.env.GHL_GOODS_DEMAND_PIPELINE_NAME || PIPELINE_NAMES.goodsDemand;
  }
  if (projectCode === 'ACT-GD' && (pathway === 'buyer' || pathway === 'procurement')) {
    return process.env.GHL_GOODS_BUYER_PIPELINE_NAME || PIPELINE_NAMES.goodsBuyer;
  }
  if (pathway === 'grant' || pathway === 'foundation' || pathway === 'capital') {
    return process.env.GHL_GRANTS_PIPELINE_NAME || PIPELINE_NAMES.grants;
  }
  return process.env.GHL_DEFAULT_OPPORTUNITY_PIPELINE_NAME || PIPELINE_NAMES.grants;
}

function routeStage(pathway: OpportunityRoutePathway, projectCode: string, title: string) {
  const text = `${projectCode} ${pathway} ${title}`.toLowerCase();
  if (projectCode === 'ACT-GD' && text.includes('demand')) return process.env.GHL_GOODS_DEMAND_STAGE_NAME || 'New';
  if (projectCode === 'ACT-GD' && (pathway === 'buyer' || pathway === 'procurement')) return process.env.GHL_GOODS_BUYER_STAGE_NAME || 'New';
  if (pathway === 'grant' || pathway === 'foundation' || pathway === 'capital') {
    return process.env.GHL_GRANTS_INITIAL_STAGE_NAME || 'Grant Opportunity Identified';
  }
  return process.env.GHL_DEFAULT_INITIAL_STAGE_NAME || 'New';
}

function parseMoneyLabel(value: string | null | undefined) {
  if (!value) return 0;
  const match = value.replace(/,/g, '').match(/\$?\s*([0-9]+(?:\.[0-9]+)?)([kKmM])?/);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'm') return Math.round(amount * 1_000_000);
  if (suffix === 'k') return Math.round(amount * 1_000);
  return Math.round(amount);
}

export function buildOpportunityRoutes(
  signals: OpportunitySignal[],
  decisions: OpportunityDecisionRow[] = [],
): OpportunityRoute[] {
  return signals
    .map((signal) => {
      const pathway = pathwayFromSignal(signal);
      const projectCode = projectCodeForSignal(signal);
      const recommendedRole = recommendedRoleFor(signal, pathway);
      const readiness = readinessScore(signal.readiness.level);
      const relationship = relationshipScore(signal);
      const urgency = urgencyScore(signal);
      const decisionEffect = routeDecisionAdjustment(signal.source, signal.sourceRef, projectCode, pathway, decisions);
      const evidenceGaps = evidenceGapsForRoute(signal, pathway, decisionEffect.evidenceGaps);
      const overallScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(signal.score * 0.45 + readiness * 0.2 + relationship * 0.15 + urgency * 0.2 + decisionEffect.adjustment),
        ),
      );
      const pipeline = routePipeline(pathway, projectCode, signal.title);
      const routeId = `route:${normaliseKey(`${projectCode}:${pathway}:${signal.source}:${signal.sourceRef}`)}`;
      const whyParts = [
        `${routeProjectName(projectCode)} ${pathway} path`,
        `${recommendedRole} role`,
        ...signal.scoreReasons.slice(0, 2),
        ...decisionEffect.notes,
      ];
      return {
        id: routeId,
        signalId: signal.id,
        title: signal.title,
        source: signal.source,
        sourceRef: signal.sourceRef,
        sourceUrl: signal.sourceUrl,
        project: signal.project,
        project_code: projectCode,
        project_name: routeProjectName(projectCode),
        pathway,
        recommended_role: recommendedRole,
        fit_score: signal.score,
        readiness_score: readiness,
        relationship_score: relationship,
        urgency_score: urgency,
        overall_score: overallScore,
        why_recommended: Array.from(new Set(whyParts)).join(' · '),
        why_not:
          overallScore < 55
            ? 'Low confidence after ACT fit, readiness, relationship, urgency, and past decisions.'
            : evidenceGaps.length > 2
              ? 'Promising, but evidence gaps need closing before promotion.'
              : null,
        evidence_gaps: evidenceGaps,
        next_action: routeNextAction(pathway, recommendedRole, evidenceGaps),
        ghl: {
          recommendedPipeline: pipeline,
          suggestedStage: routeStage(pathway, projectCode, signal.title),
          existingOpportunityId:
            signal.source === 'crm' && signal.id.startsWith('crm-opportunity:')
              ? signal.sourceRef
              : null,
          contactId:
            signal.source === 'crm' && signal.id.startsWith('crm:')
              ? signal.sourceRef
              : signal.relationships.find((relationship) => relationship.system === 'ghl' && relationship.label === 'GHL contact')?.detail ?? null,
          tags: [
            `cg-project:${projectCode.toLowerCase()}`,
            `cg-pathway:${pathway}`,
            `cg-role:${recommendedRole}`,
            `cg-source:${signal.source}`,
          ],
        },
        signal,
      };
    })
    .sort((a, b) => b.overall_score - a.overall_score || b.fit_score - a.fit_score || a.title.localeCompare(b.title));
}

function buildProjectQueues(routes: OpportunityRoute[]): OpportunityProjectQueue[] {
  const grouped = new Map<string, OpportunityRoute[]>();
  for (const route of routes) {
    const existing = grouped.get(route.project_code) ?? [];
    if (existing.length < 6) existing.push(route);
    grouped.set(route.project_code, existing);
  }
  return Array.from(grouped.entries())
    .map(([projectCode, projectRoutes]) => ({
      project_code: projectCode,
      project_name: routeProjectName(projectCode),
      routes: projectRoutes,
      topScore: projectRoutes[0]?.overall_score ?? 0,
    }))
    .sort((a, b) => b.topScore - a.topScore || a.project_name.localeCompare(b.project_name));
}

function buildLearningSummary(decisions: OpportunityDecisionRow[]): OpportunityLearningSummary {
  const reasonCounts = new Map<string, number>();
  for (const decision of decisions) {
    if ((decision.decision === 'no' || decision.decision === 'lost') && decision.reason) {
      reasonCounts.set(decision.reason, (reasonCounts.get(decision.reason) ?? 0) + 1);
    }
  }
  const negativeCount = decisions.filter((decision) => decision.decision === 'no' || decision.decision === 'lost').length;
  const positiveCount = decisions.filter((decision) =>
    ['research', 'partner', 'apply', 'send_to_ghl', 'won'].includes(decision.decision),
  ).length;
  const moreInfoCount = decisions.filter((decision) => decision.decision === 'more_info').length;
  return {
    decisionCount: decisions.length,
    negativeCount,
    positiveCount,
    moreInfoCount,
    commonNoReasons: Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
      .slice(0, 5),
    notes: [
      decisions.length
        ? `${decisions.length} opportunity decisions are available for scoring.`
        : 'No opportunity_decisions rows yet; scoring is using source fit and grant feedback only.',
      negativeCount ? `${negativeCount} no/loss decisions lower similar future routes.` : 'No no/loss learning rows yet.',
      moreInfoCount ? `${moreInfoCount} more-info rows keep evidence gaps visible.` : 'More-info requests will become evidence-gap memory.',
    ],
  };
}

function sourceHealth(
  sources: Awaited<ReturnType<typeof fetchSupabaseSources>>,
  signalCountBySource: Map<OpportunitySignalSource, number>,
): OpportunitySourceHealth[] {
  const wikiIndex = getWikiSupportIndex();
  const notionGrantSource = process.env.NOTION_GRANT_PIPELINE_DATASOURCE_ID || DEFAULT_NOTION_GRANT_PIPELINE_DATASOURCE_ID;
  const notionProjectsSource = process.env.NOTION_PROJECTS_DATASOURCE_ID || DEFAULT_NOTION_PROJECTS_DATASOURCE_ID;
  const notionPeopleSource = process.env.NOTION_PEOPLE_DATASOURCE_ID || DEFAULT_NOTION_PEOPLE_DATASOURCE_ID;

  return [
    {
      key: 'wiki',
      label: 'Tractorpedia / wiki support index',
      status: 'ok',
      count: wikiIndex.support_actions.length,
      freshness: wikiIndex.generated_at,
      detail: `${wikiIndex.summary.project_count} projects, ${wikiIndex.summary.route_count} support routes, ${wikiIndex.summary.support_action_count} actions.`,
    },
    healthFromOutcome('grant', 'Grant opportunities', sources.grants, signalCountBySource.get('grant') ?? 0),
    healthFromOutcome('foundation', 'Foundations and foundation programs', {
      rows: [...sources.foundationPrograms.rows, ...sources.foundations.rows],
      error: sources.foundationPrograms.error ?? sources.foundations.error,
    }, signalCountBySource.get('foundation') ?? 0),
    healthFromOutcome('procurement', 'Procurement and social enterprise rows', {
      rows: [...sources.socialEnterprises.rows, ...sources.contracts.rows],
      error: sources.socialEnterprises.error ?? sources.contracts.error,
    }, signalCountBySource.get('procurement') ?? 0),
    healthFromOutcome('crm', 'GoHighLevel local mirror', {
      rows: [...sources.ghlContacts.rows, ...sources.ghlOpportunities.rows],
      error: sources.ghlContacts.error ?? sources.ghlOpportunities.error,
    }, signalCountBySource.get('crm') ?? 0),
    healthFromOutcome('pipeline', 'ACT tracked pipeline', sources.pipeline, signalCountBySource.get('notion') ?? 0),
    {
      key: 'notion_grants',
      label: 'Notion Grant Pipeline Tracker',
      status: 'configured',
      count: 0,
      freshness: null,
      detail: notionGrantSource,
      actionNeeded: 'Mirror or explicitly promote records; no full-page body sync in V1.',
    },
    {
      key: 'notion_projects',
      label: 'Notion Projects',
      status: 'configured',
      count: 0,
      freshness: null,
      detail: notionProjectsSource,
      actionNeeded: 'Use as project coordination source; do not duplicate wiki truth.',
    },
    {
      key: 'notion_people',
      label: 'Notion People Directory',
      status: 'configured',
      count: 0,
      freshness: null,
      detail: notionPeopleSource,
      actionNeeded: 'Use with GHL mirror for relationship context.',
    },
    {
      key: 'goods',
      label: 'Goods operating system',
      status: 'ok',
      count: goodsSupportRoutes.length + goodsCapitalRows.length,
      freshness: new Date().toISOString(),
      detail: `${goodsOperatingFacts.length} facts, ${goodsSourceDocuments.length} source documents, ${goodsSupportRoutes.length} support routes.`,
    },
  ];
}

function healthFromOutcome<T>(
  key: OpportunitySourceHealth['key'],
  label: string,
  outcome: QueryOutcome<T>,
  signalCount: number,
): OpportunitySourceHealth {
  if (outcome.error) {
    return {
      key,
      label,
      status: 'error',
      count: 0,
      freshness: null,
      detail: outcome.error,
      actionNeeded: 'Check schema, credentials, or source availability.',
    };
  }
  if (outcome.rows.length === 0) {
    return {
      key,
      label,
      status: 'empty',
      count: 0,
      freshness: null,
      detail: 'No rows returned for the cockpit source query.',
      actionNeeded: 'Request ingestion or loosen source filters.',
    };
  }
  return {
    key,
    label,
    status: key === 'crm' || key === 'pipeline' ? 'mirror-only' : 'ok',
    count: signalCount || outcome.rows.length,
    freshness: null,
    detail: `${outcome.rows.length} source rows available.`,
  };
}

export async function getOpportunityIntelligence(
  filters: OpportunityIntelligenceFilters = {},
): Promise<OpportunityIntelligenceResponse> {
  const generatedAt = new Date().toISOString();
  const sources = await fetchSupabaseSources();
  const allSignals = dedupeOpportunitySignals([
    ...wikiSignals(),
    ...wikiProjectSignals(),
    ...goodsSignals(),
    ...grantSignals(sources.grants.rows),
    ...foundationProgramSignals(sources.foundationPrograms.rows),
    ...foundationSignals(sources.foundations.rows),
    ...socialEnterpriseSignals(sources.socialEnterprises.rows),
    ...contractSignals(sources.contracts.rows),
    ...ghlContactSignals(sources.ghlContacts.rows),
    ...ghlOpportunitySignals(sources.ghlOpportunities.rows),
    ...pipelineSignals(sources.pipeline.rows),
    ...notionConfigSignals(),
  ]);

  const signalCountBySource = new Map<OpportunitySignalSource, number>();
  for (const signal of allSignals) {
    signalCountBySource.set(signal.source, (signalCountBySource.get(signal.source) ?? 0) + 1);
  }

  const normalisedFilters = normaliseFilters(filters);
  const filteredSignals = filterOpportunitySignals(allSignals, normalisedFilters).slice(0, 60);
  const filteredSignalIds = new Set(filteredSignals.map((signal) => signal.id));
  const routes = buildOpportunityRoutes(allSignals, sources.decisions.rows)
    .filter((route) => filteredSignalIds.has(route.signalId))
    .slice(0, 40);

  return {
    generatedAt,
    filters: normalisedFilters,
    signals: filteredSignals,
    routes,
    topDirective: routes[0] ?? null,
    projectQueues: buildProjectQueues(routes),
    learningSummary: buildLearningSummary(sources.decisions.rows),
    actions: [
      { kind: 'no', label: 'No', description: 'Record why this route is not ACT-fit and lower similar future recommendations.' },
      { kind: 'later', label: 'Later', description: 'Keep the signal visible but reduce immediate priority.' },
      { kind: 'research', label: 'Research', description: 'Mark the route as worth deeper evidence and eligibility work.' },
      { kind: 'partner_path', label: 'Partner path', description: 'Treat ACT as a partner or coalition member, not necessarily lead applicant.' },
      { kind: 'apply_path', label: 'Apply path', description: 'Treat ACT as a lead or application owner after evidence gaps are closed.' },
      { kind: 'add_evidence_gap', label: 'Add evidence gap', description: 'Store missing evidence so future scans keep asking for it.' },
      { kind: 'send_to_ghl', label: 'Send to GHL', description: 'Confirm-first CRM opportunity handoff; no automatic email/SMS.' },
      ...ECOSYSTEM_NEXT_ACTIONS.slice(0, 6).map((action) => ({
        kind: ecosystemActionKind(action.type),
        label: action.title,
        description: action.nextStep,
      })),
      {
        kind: 'promote_to_pipeline',
        label: 'Promote signal into pipeline',
        description: 'Human-triggered action only; stores source refs before any external sync is allowed.',
      },
    ],
    sourceHealth: sourceHealth(sources, signalCountBySource),
    projectState: buildProjectState(),
    relationshipContext: buildRelationshipContext(sources.ghlContacts.rows),
    safety: {
      mode: 'mirror-plus-actions',
      externalWrites: 'disabled-by-default',
      notes: [
        'No email or SMS is sent by the opportunity cockpit.',
        'No GHL or Notion stage is changed automatically.',
        'GHL writes require an explicit confirmed send_to_ghl action.',
      ],
    },
  };
}

function ecosystemActionKind(type: (typeof ECOSYSTEM_NEXT_ACTIONS)[number]['type']): OpportunityActionKind {
  if (type === 'ingest') return 'request_ingestion';
  if (type === 'brief') return 'create_brief_task';
  if (type === 'outreach') return 'contact';
  return 'monitor';
}

function normaliseFilters(filters: OpportunityIntelligenceFilters): OpportunityIntelligenceFilters {
  return {
    ...filters,
    project: filters.project?.toLowerCase(),
    minScore:
      typeof filters.minScore === 'number' && Number.isFinite(filters.minScore)
        ? Math.max(0, Math.min(100, filters.minScore))
        : undefined,
  };
}

function decisionForAction(kind: OpportunityActionKind): OpportunityDecisionRow['decision'] | null {
  if (kind === 'no' || kind === 'mark_no_go' || kind === 'no-go') return 'no';
  if (kind === 'later') return 'later';
  if (kind === 'research') return 'research';
  if (kind === 'partner_path') return 'partner';
  if (kind === 'apply_path') return 'apply';
  if (kind === 'send_to_ghl') return 'send_to_ghl';
  if (kind === 'add_evidence_gap') return 'more_info';
  return null;
}

function routeSignalLike(request: OpportunityActionRequest) {
  const route = request.route;
  const signal = request.signal;
  return {
    signalId: request.signalId ?? route?.signalId ?? signal?.id ?? null,
    title: route?.title ?? signal?.title ?? `${request.kind.replace(/_/g, ' ')} action`,
    source: route?.source ?? signal?.source ?? null,
    sourceRef: route?.sourceRef ?? signal?.sourceRef ?? null,
    sourceUrl: route?.sourceUrl ?? signal?.sourceUrl ?? null,
    lane: route?.pathway ?? signal?.lane ?? null,
    project: route?.project ?? signal?.project ?? null,
    projectCode: route?.project_code ?? null,
  };
}

async function recordOpportunityDecision(
  request: OpportunityActionRequest,
  context: OpportunityActionContext | undefined,
  receiptId: string,
) {
  const decision = decisionForAction(request.kind);
  const route = request.route;
  const signal = request.signal;
  const sourceType = route?.source ?? signal?.source;
  const sourceRef = route?.sourceRef ?? signal?.sourceRef ?? request.signalId;
  if (!decision || !sourceType || !sourceRef) return null;

  const db = getServiceSupabase();
  const row = {
    user_id: context?.userId ?? null,
    org_profile_id: request.orgProfileId ?? null,
    source_type: sourceType,
    source_ref: sourceRef,
    project_code: route?.project_code ?? null,
    pathway: route?.pathway ?? signal?.lane ?? null,
    decision,
    reason: request.reason ?? null,
    notes: request.note ?? null,
    evidence_gaps: request.evidenceGaps ?? route?.evidence_gaps ?? [],
    outcome: receiptId,
  };
  const { data, error } = await db.from('opportunity_decisions').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

type GhlPipeline = {
  id?: string;
  name?: string;
  stages?: Array<{ id?: string; name?: string }>;
};

function normalisePipelineList(payload: unknown): GhlPipeline[] {
  if (Array.isArray(payload)) return payload as GhlPipeline[];
  if (payload && typeof payload === 'object') {
    const object = payload as { pipelines?: unknown; data?: unknown };
    if (Array.isArray(object.pipelines)) return object.pipelines as GhlPipeline[];
    if (Array.isArray(object.data)) return object.data as GhlPipeline[];
  }
  return [];
}

function opportunityName(route: OpportunityActionRequest['route']) {
  if (!route) return 'ACT opportunity';
  return `[${route.project_code}] ${route.pathway}: ${route.title}`;
}

async function recordGhlSyncLog(payload: Record<string, unknown>) {
  const db = getServiceSupabase();
  await db.from('ghl_sync_log').insert(payload);
}

function safeUuid(value: string | null | undefined) {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function resolveOrgProfileId(request: OpportunityActionRequest, context?: OpportunityActionContext) {
  if (request.orgProfileId) return request.orgProfileId;
  if (!context?.userId) return null;

  const db = getServiceSupabase();
  const { data } = await db
    .from('org_profiles')
    .select('id')
    .eq('user_id', context.userId)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

async function upsertRoutePipelineItem(
  request: OpportunityActionRequest,
  context: OpportunityActionContext | undefined,
  status: 'researching' | 'pursuing',
) {
  const route = request.route;
  if (!route) throw new Error('A route payload is required to create pipeline work.');

  const orgProfileId = await resolveOrgProfileId(request, context);
  if (!orgProfileId) throw new Error('No org profile found for this user.');

  const db = getServiceSupabase();
  const sourceType = route.source;
  const sourceRef = route.sourceRef || route.signalId || route.id;
  const pipelinePayload = {
    org_profile_id: orgProfileId,
    name: route.title,
    amount_display: request.signal?.amount ?? null,
    amount_numeric: parseMoneyLabel(request.signal?.amount) || null,
    funder: request.signal?.organisation ?? null,
    deadline: request.signal?.deadline ?? null,
    status,
    grant_opportunity_id: route.source === 'grant' ? safeUuid(route.sourceRef) : null,
    notes: request.note ?? route.next_action,
    source_type: sourceType,
    source_ref: sourceRef,
    pathway: route.pathway,
    recommended_role: route.recommended_role,
    project_code: route.project_code,
    owner_name: request.owner ?? null,
    next_action: route.next_action,
    last_synced_at: new Date().toISOString(),
  };

  const existing = await db
    .from('org_pipeline')
    .select('id')
    .eq('org_profile_id', orgProfileId)
    .eq('source_type', sourceType)
    .eq('source_ref', sourceRef)
    .maybeSingle();

  if (existing.data?.id) {
    const { error } = await db
      .from('org_pipeline')
      .update(pipelinePayload)
      .eq('id', existing.data.id);
    if (error) throw new Error(error.message);
    return { id: String(existing.data.id), operation: 'updated' as const, orgProfileId };
  }

  const { data, error } = await db
    .from('org_pipeline')
    .insert(pipelinePayload)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data?.id ?? sourceRef), operation: 'created' as const, orgProfileId };
}

async function sendRouteToGhl(request: OpportunityActionRequest) {
  const route = request.route;
  if (!route) throw new Error('send_to_ghl requires a route payload');
  if (!request.confirmWrite) throw new Error('send_to_ghl requires confirmWrite=true');

  const pipelines = normalisePipelineList(await getPipelines());
  const preferredPipeline =
    findPipelineByName(pipelines, route.ghl.recommendedPipeline) ||
    findPipelineByName(pipelines, process.env.GHL_DEFAULT_OPPORTUNITY_PIPELINE_NAME || '') ||
    findPipelineByName(pipelines, PIPELINE_NAMES.grants);
  if (!preferredPipeline?.id) throw new Error(`No matching GHL pipeline found for ${route.ghl.recommendedPipeline}`);

  const preferredStage =
    preferredPipeline.stages?.find((stage) => stage.name?.toLowerCase() === route.ghl.suggestedStage.toLowerCase()) ||
    preferredPipeline.stages?.[0];
  if (!preferredStage?.id) throw new Error(`No GHL stage found for ${preferredPipeline.name ?? route.ghl.recommendedPipeline}`);

  const monetaryValue = parseMoneyLabel(request.signal?.amount);
  let result: unknown;
  let operation: 'created' | 'updated' = 'created';
  const startedAt = new Date();
  const logBase = {
    entity_type: 'opportunity',
    direction: 'civicgraph_to_ghl',
    records_processed: 1,
    records_skipped: 0,
    started_at: startedAt.toISOString(),
    metadata: {
      route_id: route.id,
      project_code: route.project_code,
      pathway: route.pathway,
      pipeline: preferredPipeline.name ?? route.ghl.recommendedPipeline,
      stage: preferredStage.name ?? route.ghl.suggestedStage,
      tags: route.ghl.tags,
    },
  };

  try {
    if (route.ghl.existingOpportunityId) {
      operation = 'updated';
      result = await updateOpportunity(route.ghl.existingOpportunityId, {
        pipelineStageId: preferredStage.id,
        status: 'open',
        monetaryValue,
      });
    } else {
      result = await createOpportunity({
        name: opportunityName(route),
        stage: route.pathway,
        monetaryValue,
        pipelineId: preferredPipeline.id,
        pipelineStageId: preferredStage.id,
        contactId: route.ghl.contactId ?? undefined,
      });
    }
  } catch (error) {
    try {
      const completedAt = new Date();
      await recordGhlSyncLog({
        ...logBase,
        operation: operation === 'created' ? 'opportunity_create' : 'opportunity_update',
        entity_id: route.ghl.existingOpportunityId ?? route.id,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'unknown error',
        records_created: 0,
        records_updated: 0,
        records_failed: 1,
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      });
    } catch {
      // Preserve the GHL error as the actionable failure.
    }
    throw error;
  }

  const objectResult = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const opportunity = (objectResult.opportunity && typeof objectResult.opportunity === 'object')
    ? objectResult.opportunity as Record<string, unknown>
    : objectResult;
  const opportunityId = String(opportunity.id ?? opportunity._id ?? route.ghl.existingOpportunityId ?? '');
  if (!opportunityId) throw new Error('GHL did not return an opportunity id');

  const logPayload = {
    ...logBase,
    operation: operation === 'created' ? 'opportunity_create' : 'opportunity_update',
    entity_id: opportunityId,
    direction: 'civicgraph_to_ghl',
    status: 'success',
    records_created: operation === 'created' ? 1 : 0,
    records_updated: operation === 'updated' ? 1 : 0,
    records_failed: 0,
    error_message: null,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt.getTime(),
  };
  try {
    await recordGhlSyncLog(logPayload);
  } catch {
    // Some environments have older ghl_sync_log schemas; the confirmed GHL write remains the primary result.
  }

  if (request.orgProfileId) {
    const db = getServiceSupabase();
    const pipelinePayload = {
      org_profile_id: request.orgProfileId,
      name: route.title,
      amount_display: request.signal?.amount ?? null,
      amount_numeric: monetaryValue || null,
      funder: request.signal?.organisation ?? null,
      deadline: request.signal?.deadline ?? null,
      status: route.pathway === 'grant' || route.pathway === 'foundation' ? 'researching' : 'pursuing',
      notes: request.note ?? route.next_action,
      ghl_opportunity_id: opportunityId,
      source_type: route.source,
      source_ref: route.sourceRef,
      pathway: route.pathway,
      recommended_role: route.recommended_role,
      project_code: route.project_code,
      owner_name: request.owner ?? null,
      next_action: route.next_action,
      last_synced_at: new Date().toISOString(),
    };
    const existing = await db
      .from('org_pipeline')
      .select('id')
      .eq('org_profile_id', request.orgProfileId)
      .eq('source_type', route.source)
      .eq('source_ref', route.sourceRef)
      .maybeSingle();
    if (existing.data?.id) {
      await db.from('org_pipeline').update(pipelinePayload).eq('id', existing.data.id);
    } else {
      await db.from('org_pipeline').insert(pipelinePayload);
    }
  }

  return {
    opportunityId,
    operation,
  };
}

export function buildOpportunityActionReceipt(
  request: OpportunityActionRequest,
  now = new Date(),
): OpportunityIntelligenceActionReceipt {
  const signal = request.signal;
  const routeLike = routeSignalLike(request);
  const signalId = routeLike.signalId;
  const kind = request.kind;
  const blocked = !kind || (['send_to_ghl', 'send_to_notion', 'promote_to_pipeline'].includes(kind) && !signalId);
  const warnings = [
    request.confirmWrite
      ? 'Confirmed action requested. No email or SMS is sent by this workflow.'
      : 'Mirror-plus-actions: no external write occurs unless confirmWrite=true on an explicit write action.',
    kind === 'send_to_ghl' && !request.confirmWrite ? 'GHL writeback needs confirmation before creating or updating an opportunity.' : null,
    kind === 'send_to_notion' ? 'Notion writeback must be confirmed in a dedicated workflow before enabling.' : null,
  ].filter(Boolean) as string[];

  return {
    id: `op-action:${normaliseKey(`${kind}:${signalId ?? routeLike.title ?? now.toISOString()}`)}`,
    kind,
    signalId,
    title: routeLike.title,
    status: blocked ? 'blocked' : 'planned',
    createdAt: now.toISOString(),
    writeMode: request.confirmWrite ? 'confirmed' : 'planned',
    externalWrites: [],
    warnings,
    nextStep: blocked
      ? 'Attach a signalId or full signal before promoting this action.'
      : nextStepForAction(kind, request.targetSystem),
    payload: {
      source: routeLike.source,
      sourceRef: routeLike.sourceRef,
      lane: routeLike.lane,
      project: routeLike.project,
      projectCode: routeLike.projectCode,
      owner: request.owner ?? null,
      note: request.note ?? null,
    },
  };
}

export async function createOpportunityIntelligenceAction(
  request: OpportunityActionRequest,
  context?: OpportunityActionContext,
): Promise<OpportunityIntelligenceActionReceipt> {
  const receipt = buildOpportunityActionReceipt(request);
  const externalWrites = [...receipt.externalWrites];
  const warnings = [...receipt.warnings];

  if (receipt.status === 'blocked') return receipt;

  if (WRITE_DECISIONS.has(request.kind)) {
    try {
      const decisionId = await recordOpportunityDecision(request, context, receipt.id);
      if (decisionId) externalWrites.push({ system: 'supabase_decision', id: decisionId, status: 'recorded' });
    } catch (error) {
      warnings.push(`Decision memory was not recorded: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  if (request.kind === 'research' || request.kind === 'partner_path' || request.kind === 'apply_path') {
    try {
      const pipelineStatus = request.kind === 'research' ? 'researching' : 'pursuing';
      const result = await upsertRoutePipelineItem(request, context, pipelineStatus);
      externalWrites.push({ system: 'supabase_pipeline', id: result.id, status: result.operation });
    } catch (error) {
      warnings.push(`Pipeline work item was not created: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  if (request.kind === 'promote_to_pipeline') {
    if (!request.confirmWrite || !request.orgProfileId || !request.route) {
      warnings.push('Promotion stayed planned because confirmWrite, orgProfileId, and route are required.');
    } else {
      try {
        const db = getServiceSupabase();
        const { data, error } = await db.from('org_pipeline').insert({
          org_profile_id: request.orgProfileId,
          name: request.route.title,
          amount_display: request.signal?.amount ?? null,
          amount_numeric: parseMoneyLabel(request.signal?.amount) || null,
          funder: request.signal?.organisation ?? null,
          deadline: request.signal?.deadline ?? null,
          status: 'researching',
          notes: request.note ?? request.route.next_action,
          source_type: request.route.source,
          source_ref: request.route.sourceRef,
          pathway: request.route.pathway,
          recommended_role: request.route.recommended_role,
          project_code: request.route.project_code,
          last_synced_at: new Date().toISOString(),
        }).select('id').single();
        if (error) throw new Error(error.message);
        externalWrites.push({ system: 'supabase_pipeline', id: String(data?.id ?? request.route.id), status: 'created' });
      } catch (error) {
        warnings.push(`Pipeline promotion failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
  }

  if (request.kind === 'send_to_ghl') {
    if (!request.confirmWrite) {
      warnings.push('No GHL write was made. Confirm the send_to_ghl action to create/update CRM.');
    } else {
      try {
        const result = await sendRouteToGhl(request);
        externalWrites.push({ system: 'ghl', id: result.opportunityId, status: result.operation });
      } catch (error) {
        warnings.push(`GHL write failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        return {
          ...receipt,
          status: 'blocked',
          externalWrites,
          warnings,
          nextStep: 'Fix the GHL pipeline/stage/contact configuration, then retry the confirmed send.',
        };
      }
    }
  }

  return {
    ...receipt,
    status: externalWrites.length > 0 ? 'written' : receipt.status,
    externalWrites,
    warnings,
  };
}

function nextStepForAction(kind: OpportunityActionKind, targetSystem?: OpportunityActionRequest['targetSystem']) {
  if (kind === 'promote_to_pipeline') return 'Review the source refs, then explicitly create or update an org_pipeline row.';
  if (kind === 'send_to_ghl') return 'Open the GHL write workflow and confirm pipeline, stage, contact, and next touch.';
  if (kind === 'send_to_notion') return 'Open the Notion write workflow and confirm tracker row fields before sync.';
  if (kind === 'mark_no_go' || kind === 'no-go') return 'Record the no-go reason locally so it remains visible in future scans.';
  if (kind === 'create_brief_task' || kind === 'brief') return 'Create a brief task with evidence, relationship path, owner, and deadline.';
  if (kind === 'request_ingestion' || kind === 'ingest') return 'Queue ingestion with source URL, source owner, and dedupe keys.';
  if (kind === 'contact') return `Queue a human next touch${targetSystem ? ` in ${targetSystem}` : ''}; do not auto-send.`;
  if (kind === 'qualify') return 'Check eligibility, evidence, applicant, budget, co-contribution, and source confidence.';
  if (kind === 'research') return 'Create a visible research item in the internal pipeline and keep learning from the decision.';
  if (kind === 'partner_path') return 'Create a visible partner-path item in the internal pipeline.';
  if (kind === 'apply_path') return 'Create a visible application-path item in the internal pipeline.';
  if (kind === 'later') return 'Park this route for now and make it less urgent in the next ranking pass.';
  if (kind === 'no') return 'Record the no decision and make similar routes less likely.';
  if (kind === 'add_evidence_gap') return 'Record the missing proof so future scans keep asking for it.';
  return 'Monitor the signal and refresh source health before acting.';
}
