/**
 * Ask GrantScope v1 — graph-guided, evidence-gated retrieval over ACT projects,
 * open opportunities and the national entity graph.
 *
 * The contract this file enforces, and the reason it is deterministic:
 *
 *   A language model must never be the thing that decides eligibility, timing or
 *   amount. Those are hard gates over verified source records. The model may
 *   phrase an answer later, but it may not manufacture one. So every statement
 *   this service emits carries a grade, and only records that clear
 *   `applyEvidenceGate` are allowed to be graded `verified_fact`.
 *
 * Answer shape is fixed: facts, inference, unknowns, next action. An answer with
 * no verified facts is a legitimate answer — it says so rather than reaching.
 */

import { getServiceSupabase } from '@/lib/supabase';

export type ClaimGrade =
  | 'verified_fact'
  | 'structured_inference'
  | 'model_suggestion'
  | 'missing_evidence'
  | 'human_decision';

export interface Provenance {
  /** Human label for where this came from, e.g. "GrantConnect listing". */
  label: string;
  /** Official source URL. Null means the record cannot support a verified fact. */
  url: string | null;
  /** Table or view the record was read from — makes every claim traceable. */
  origin: string;
  verifiedAt: string | null;
  /** Days since verification. Null when never verified. */
  freshnessDays: number | null;
}

export interface EvidenceClaim {
  statement: string;
  grade: ClaimGrade;
  sources: Provenance[];
}

export type AskIntentKind =
  | 'project_funding'
  | 'eligibility'
  | 'place'
  | 'funder_history'
  | 'changed_recently'
  | 'unknown';

export interface AskIntent {
  kind: AskIntentKind;
  /** Resolved ACT project code, e.g. ACT-GD. Null when the question is not project-scoped. */
  projectCode: string | null;
  /** Resolved state code, e.g. NT. */
  state: string | null;
  /** Free-text place mention that did not resolve to a state. */
  placeMention: string | null;
  /** Named organisation or funder mentioned in the question. */
  organisationMention: string | null;
}

export interface GatedOpportunity {
  opportunityId: string;
  name: string;
  funderName: string | null;
  deadline: string | null;
  maxAmount: number | null;
  sourceUrl: string | null;
  applicationUrl: string | null;
  feedStatus: string | null;
  verificationStatus: string | null;
  verifiedAt: string | null;
  evidenceCompleteness: number | null;
  failedRequirements: string[];
  jurisdictions: string[];
  isNational: boolean;
  eligibleOrgTypes: string[];
  requiresDgr: boolean | null;
  /**
   * Hybrid lexical + semantic + recommendation fit against the asking project.
   * Null when the question was not project-scoped, in which case there is no
   * basis for ranking by fit and results fall back to soonest deadline.
   */
  fitScore: number | null;
}

export interface EvidenceGateResult {
  passed: boolean;
  /** Reasons the record failed. Empty when passed. */
  failures: string[];
  daysRemaining: number | null;
  freshnessDays: number | null;
}

export interface AskProjectContext {
  projectCode: string;
  projectName: string;
  projectSlug: string;
  orgProjectId: string;
  completeness: string;
  unresolvedDecisions: string[];
  geographies: string[];
  applicantEntities: string[];
  partnerPathways: string[];
}

export interface AskAnswer {
  question: string;
  intent: AskIntent;
  headline: string;
  facts: EvidenceClaim[];
  inference: EvidenceClaim[];
  unknowns: EvidenceClaim[];
  nextAction: string;
  /** The small ranked result set. Never a dump of everything that matched. */
  results: GatedOpportunity[];
  /** Records that were retrieved but withheld because they failed the gate. */
  withheld: Array<{ opportunityId: string; name: string; failures: string[] }>;
  generatedAt: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Verification older than this needs a re-check before use. Kept identical to
 * the `stale_verification` rule inside act_funding_opportunity_current_status —
 * two different freshness standards would let an answer contradict the feed.
 */
export const FRESHNESS_LIMIT_DAYS = 7;

/** Answers stay a decision set, not a search result page. */
export const MAX_RESULTS = 5;

const STATE_ALIASES: Record<string, string> = {
  qld: 'QLD',
  queensland: 'QLD',
  nsw: 'NSW',
  'new south wales': 'NSW',
  vic: 'VIC',
  victoria: 'VIC',
  wa: 'WA',
  'western australia': 'WA',
  sa: 'SA',
  'south australia': 'SA',
  nt: 'NT',
  'northern territory': 'NT',
  tas: 'TAS',
  tasmania: 'TAS',
  'australian capital territory': 'ACT',
};

/**
 * Well-known places that imply a state. Kept deliberately small and explicit:
 * guessing a jurisdiction from a place name is exactly the kind of inference
 * that must not silently become an eligibility filter.
 */
const PLACE_TO_STATE: Record<string, string> = {
  'tennant creek': 'NT',
  'alice springs': 'NT',
  darwin: 'NT',
  'palm island': 'QLD',
  witta: 'QLD',
  brisbane: 'QLD',
  cairns: 'QLD',
  melbourne: 'VIC',
  sydney: 'NSW',
  adelaide: 'SA',
  perth: 'WA',
  hobart: 'TAS',
};

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function freshnessDays(verifiedAt: string | null, now: Date): number | null {
  const verified = parseDate(verifiedAt);
  if (!verified) return null;
  return Math.max(0, daysBetween(verified, now));
}

/**
 * The hard gate. An opportunity may only be presented as relevant when an
 * official source says it is currently open, we verified that recently, and we
 * can link a human to the source. Everything else is withheld with reasons.
 */
export function applyEvidenceGate(
  opportunity: GatedOpportunity,
  now: Date = new Date(),
): EvidenceGateResult {
  const failures: string[] = [];

  if (opportunity.feedStatus !== 'apply_now') {
    failures.push(`Feed status is ${opportunity.feedStatus || 'unknown'}, not apply_now.`);
  }
  if (opportunity.verificationStatus !== 'verified') {
    failures.push(`Verification status is ${opportunity.verificationStatus || 'unknown'}, not verified.`);
  }
  if (!opportunity.sourceUrl) {
    failures.push('No official source URL, so the claim cannot be checked.');
  }

  const deadline = parseDate(opportunity.deadline);
  const daysRemaining = deadline ? daysBetween(now, deadline) : null;
  if (!deadline) {
    failures.push('No published deadline.');
  } else if (deadline <= now) {
    failures.push('Deadline has passed.');
  }

  const fresh = freshnessDays(opportunity.verifiedAt, now);
  if (fresh === null) {
    failures.push('Never verified against the official source.');
  } else if (fresh > FRESHNESS_LIMIT_DAYS) {
    failures.push(`Last verified ${fresh} days ago, beyond the ${FRESHNESS_LIMIT_DAYS} day limit.`);
  }

  for (const requirement of opportunity.failedRequirements) {
    failures.push(`Unmet evidence requirement: ${requirement}.`);
  }

  return { passed: failures.length === 0, failures, daysRemaining, freshnessDays: fresh };
}

export function provenanceFor(opportunity: GatedOpportunity, now: Date = new Date()): Provenance {
  return {
    label: opportunity.funderName
      ? `${opportunity.funderName} — ${opportunity.name}`
      : opportunity.name,
    url: opportunity.sourceUrl,
    origin: 'act_funding_opportunity_current_status',
    verifiedAt: opportunity.verifiedAt,
    freshnessDays: freshnessDays(opportunity.verifiedAt, now),
  };
}

export interface ProjectMatchTarget {
  projectCode: string;
  projectName: string;
  projectSlug: string;
}

/**
 * Resolve intent from the question plus the caller's real project list. Project
 * matching is lexical and explicit — we do not guess which project someone meant.
 */
export function parseAskIntent(question: string, projects: ProjectMatchTarget[]): AskIntent {
  const q = question.toLowerCase();

  const matchedProject = projects
    .map(project => {
      const candidates = [project.projectCode, project.projectName, project.projectSlug]
        .filter(Boolean)
        .map(value => value.toLowerCase());
      const hit = candidates.find(candidate =>
        candidate.length >= 3 && new RegExp(`\\b${escapeRegExp(candidate)}\\b`).test(q),
      );
      return hit ? { project, length: hit.length } : null;
    })
    .filter((entry): entry is { project: ProjectMatchTarget; length: number } => entry !== null)
    .sort((left, right) => right.length - left.length)[0]?.project ?? null;

  const stateAlias = Object.keys(STATE_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find(alias => new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(q));
  const placeKey = Object.keys(PLACE_TO_STATE)
    .sort((a, b) => b.length - a.length)
    .find(place => q.includes(place));
  const state = stateAlias ? STATE_ALIASES[stateAlias] : placeKey ? PLACE_TO_STATE[placeKey] : null;

  const kind: AskIntentKind =
    /\b(what changed|changed this week|new this week|since last week)\b/.test(q)
      ? 'changed_recently'
      : /\b(eligib|ineligible|who can apply|which applicant|can we apply|auspice|dgr)\b/.test(q)
        ? 'eligibility'
        : /\b(who (has |ha)?funded|funding history|previously funded|who funds)\b/.test(q)
          ? 'funder_history'
          : matchedProject || /\b(fund|funding|grant|grants|opportunit)\w*\b/.test(q)
            ? 'project_funding'
            : placeKey || stateAlias
              ? 'place'
              : 'unknown';

  return {
    kind,
    projectCode: matchedProject?.projectCode ?? null,
    state,
    placeMention: placeKey ?? null,
    organisationMention: null,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Compose the answer. Pure: given retrieved records and project context it
 * always produces the same graded answer, which is what makes it auditable.
 */
export function composeAnswer({
  question,
  intent,
  opportunities,
  project,
  now = new Date(),
  limit = MAX_RESULTS,
}: {
  question: string;
  intent: AskIntent;
  opportunities: GatedOpportunity[];
  project: AskProjectContext | null;
  now?: Date;
  limit?: number;
}): AskAnswer {
  const graded = opportunities.map(opportunity => ({
    opportunity,
    gate: applyEvidenceGate(opportunity, now),
  }));

  // Rank by project fit where we have it, and only fall back to urgency when we
  // do not. Sorting an unranked set by deadline is how a decision set decays
  // into a list of whatever happens to close soonest.
  const passed = graded
    .filter(entry => entry.gate.passed)
    .sort((left, right) => {
      const fitGap = (right.opportunity.fitScore ?? -1) - (left.opportunity.fitScore ?? -1);
      if (Math.abs(fitGap) > 1e-9) return fitGap;
      return (left.gate.daysRemaining ?? 0) - (right.gate.daysRemaining ?? 0);
    })
    .slice(0, limit);
  const withheld = graded
    .filter(entry => !entry.gate.passed)
    .map(entry => ({
      opportunityId: entry.opportunity.opportunityId,
      name: entry.opportunity.name,
      failures: entry.gate.failures,
    }));

  const facts: EvidenceClaim[] = passed.map(({ opportunity, gate }) => {
    const amount = opportunity.maxAmount ? ` up to ${formatAud(opportunity.maxAmount)}` : '';
    const funder = opportunity.funderName ? `${opportunity.funderName} ` : '';
    return {
      statement: `${funder}${opportunity.name} is open${amount} and closes in ${gate.daysRemaining} day${gate.daysRemaining === 1 ? '' : 's'}.`,
      grade: 'verified_fact',
      sources: [provenanceFor(opportunity, now)],
    };
  });

  const inference: EvidenceClaim[] = [];
  const unknowns: EvidenceClaim[] = [];

  // Published applicant constraints are facts about the opportunity, but whether
  // this project satisfies them is a human call, so they surface as unknowns.
  for (const { opportunity } of passed) {
    if (opportunity.requiresDgr === true) {
      unknowns.push({
        statement: `${opportunity.name} requires a deductible gift recipient applicant.${
          project?.partnerPathways.length
            ? ` Recorded partner routes: ${project.partnerPathways.join(', ')}.`
            : ' No DGR applicant route is recorded on the project profile.'
        }`,
        grade: 'human_decision',
        sources: [provenanceFor(opportunity, now)],
      });
    }
    if (opportunity.eligibleOrgTypes.length > 0) {
      inference.push({
        statement: `${opportunity.name} lists eligible applicant types: ${opportunity.eligibleOrgTypes.join(', ')}.`,
        grade: 'structured_inference',
        sources: [provenanceFor(opportunity, now)],
      });
    }
  }

  if (project) {
    const routeSource: Provenance = {
      label: `${project.projectName} funding profile`,
      url: null,
      origin: 'project_funding_profiles',
      verifiedAt: null,
      freshnessDays: null,
    };

    if (project.applicantEntities.length > 0) {
      inference.push({
        statement: `${project.projectName} has ${project.applicantEntities.length} recorded applicant entit${project.applicantEntities.length === 1 ? 'y' : 'ies'}: ${project.applicantEntities.join(', ')}. Applicant eligibility per opportunity still needs checking against published criteria.`,
        grade: 'structured_inference',
        sources: [routeSource],
      });
    } else {
      unknowns.push({
        statement: `${project.projectName} has no applicant entity recorded, so no applicant route can be proposed.`,
        grade: 'missing_evidence',
        sources: [routeSource],
      });
    }

    if (project.partnerPathways.length > 0) {
      inference.push({
        statement: `Partner or auspice routes on file: ${project.partnerPathways.join(', ')}.`,
        grade: 'structured_inference',
        sources: [routeSource],
      });
    }

    if (intent.state && project.geographies.length > 0 && !project.geographies.some(geography => geography.toUpperCase().includes(intent.state as string))) {
      unknowns.push({
        statement: `The question is about ${intent.state} but ${project.projectName} records delivery geographies as ${project.geographies.join(', ')}. Geographic eligibility is unconfirmed.`,
        grade: 'missing_evidence',
        sources: [routeSource],
      });
    }

    for (const decision of project.unresolvedDecisions) {
      unknowns.push({
        statement: decision,
        grade: 'human_decision',
        sources: [routeSource],
      });
    }
  } else if (intent.kind !== 'place') {
    unknowns.push({
      statement: 'No project was resolved from the question, so applicant eligibility cannot be assessed.',
      grade: 'missing_evidence',
      sources: [],
    });
  }

  if (withheld.length > 0) {
    unknowns.push({
      statement: `${withheld.length} retrieved opportunit${withheld.length === 1 ? 'y was' : 'ies were'} withheld because they did not clear the evidence gate.`,
      grade: 'missing_evidence',
      sources: [],
    });
  }

  const scope = [project?.projectName, intent.state].filter(Boolean).join(' in ');
  const headline = passed.length === 0
    ? `No opportunity currently clears the evidence gate${scope ? ` for ${scope}` : ''}.`
    : `${passed.length} verified open opportunit${passed.length === 1 ? 'y' : 'ies'}${scope ? ` for ${scope}` : ''}.`;

  const nextAction = passed.length === 0
    ? withheld.length > 0
      ? 'Re-verify the withheld opportunities against their official sources, then ask again.'
      : 'Widen the question, or run source ingestion to refresh the opportunity feed.'
    : project && project.unresolvedDecisions.length > 0
      ? `Resolve the open profile decisions for ${project.projectName} before committing effort, then review the ${passed.length} listed opportunit${passed.length === 1 ? 'y' : 'ies'} against published eligibility.`
      : `Review the ${passed.length} listed opportunit${passed.length === 1 ? 'y' : 'ies'} against published eligibility and record a decision.`;

  return {
    question,
    intent,
    headline,
    facts,
    inference,
    unknowns,
    nextAction,
    results: passed.map(entry => entry.opportunity),
    withheld,
    generatedAt: now.toISOString(),
  };
}

interface RawProfileRow {
  org_project_id: string;
  completeness_status: string;
  profile: Record<string, unknown>;
}

interface RawProjectRow {
  id: string;
  code: string;
  name: string;
  slug: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Entities and pathways are objects in profile v1; take a readable label from each. */
function labelsFrom(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (typeof item === 'string') return [item];
    const record = asRecord(item);
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) return [candidate.trim()];
    }
    return [];
  });
}

export function buildProjectContext(
  project: RawProjectRow,
  row: RawProfileRow | undefined,
): AskProjectContext {
  const profile = asRecord(row?.profile);
  return {
    projectCode: project.code,
    projectName: project.name,
    projectSlug: project.slug,
    orgProjectId: project.id,
    completeness: row?.completeness_status ?? 'baseline',
    unresolvedDecisions: asStringArray(profile.unresolvedDecisions),
    geographies: labelsFrom(profile.geographies, ['name', 'label', 'place']),
    applicantEntities: labelsFrom(profile.entities, ['name', 'legalName', 'entityName']),
    partnerPathways: labelsFrom(profile.partnerPathways, ['name', 'partner', 'description']),
  };
}

/**
 * Retrieve the evidence packet for a question and answer it. Reads only; this
 * never writes a label, a decision or a recommendation.
 */
export async function askGrantScope({
  question,
  now = new Date(),
  limit = MAX_RESULTS,
}: {
  question: string;
  now?: Date;
  limit?: number;
}): Promise<AskAnswer> {
  const db = getServiceSupabase();

  const projectsResult = await db
    .from('org_projects')
    .select('id, code, name, slug')
    .eq('status', 'active');
  if (projectsResult.error) {
    throw new Error(`Ask GrantScope could not load projects: ${projectsResult.error.message}`);
  }
  const projects = (projectsResult.data || []) as RawProjectRow[];

  const intent = parseAskIntent(
    question,
    projects.map(project => ({
      projectCode: project.code,
      projectName: project.name,
      projectSlug: project.slug,
    })),
  );

  const matchedProject = intent.projectCode
    ? projects.find(project => project.code === intent.projectCode) ?? null
    : null;

  let projectContext: AskProjectContext | null = null;
  if (matchedProject) {
    const profileResult = await db
      .from('project_funding_profiles')
      .select('org_project_id, completeness_status, profile')
      .eq('org_project_id', matchedProject.id)
      .eq('is_current', true)
      .maybeSingle();
    if (profileResult.error) {
      throw new Error(`Ask GrantScope could not load the funding profile: ${profileResult.error.message}`);
    }
    projectContext = buildProjectContext(
      matchedProject,
      (profileResult.data as RawProfileRow | null) ?? undefined,
    );
  }

  const opportunities = await retrieveOpportunities({
    db,
    intent,
    limit,
    orgProjectId: projectContext?.orgProjectId ?? null,
  });
  return composeAnswer({ question, intent, opportunities, project: projectContext, now, limit });
}

type ServiceClient = ReturnType<typeof getServiceSupabase>;

interface RawStatusRow {
  opportunity_id: string;
  feed_status: string | null;
  verification_status: string | null;
  verified_at: string | null;
  evidence_completeness: number | null;
  failed_requirements: string[] | null;
  deadline: string | null;
  source_url: string | null;
  application_url: string | null;
}

/**
 * Retrieval is deliberately over-inclusive of status: we pull quarantined
 * records too, so the answer can say what was withheld and why rather than
 * silently pretending those opportunities do not exist.
 */
async function retrieveOpportunities({
  db,
  intent,
  limit,
  orgProjectId,
}: {
  db: ServiceClient;
  intent: AskIntent;
  limit: number;
  orgProjectId: string | null;
}): Promise<GatedOpportunity[]> {
  // Project-scoped questions get hybrid lexical + semantic + recommendation
  // ranking from the same RPC the weekly funding queue uses, so Ask and the
  // desk cannot disagree about what fits a project.
  const fitByOpportunity = new Map<string, number>();
  if (orgProjectId) {
    const hybrid = await db.rpc('search_project_funding_hybrid', {
      p_org_project_id: orgProjectId,
      p_match_count: Math.max(limit * 4, 20),
    });
    if (hybrid.error) {
      console.warn(`[ask-grantscope] Hybrid ranking unavailable: ${hybrid.error.message}`);
    } else {
      for (const row of (hybrid.data || []) as Array<{ opportunity_id: string; hybrid_score: number }>) {
        fitByOpportunity.set(row.opportunity_id, row.hybrid_score);
      }
    }
  }

  const statusResult = await db
    .from('act_funding_opportunity_current_status')
    .select('opportunity_id, feed_status, verification_status, verified_at, evidence_completeness, failed_requirements, deadline, source_url, application_url')
    .order('deadline', { ascending: true })
    .limit(400);
  if (statusResult.error) {
    throw new Error(`Ask GrantScope could not load opportunity status: ${statusResult.error.message}`);
  }
  const statuses = (statusResult.data || []) as RawStatusRow[];
  if (statuses.length === 0) return [];

  // Prefer gate-passing records, but keep a slice of withheld ones so the answer
  // can be honest about what exists and failed.
  const openIds = statuses
    .filter(row => row.feed_status === 'apply_now')
    // With a ranked project, an open opportunity the ranker did not surface is
    // not a near miss — it is off-topic, and listing it would be noise.
    .filter(row => fitByOpportunity.size === 0 || fitByOpportunity.has(row.opportunity_id))
    .map(row => row.opportunity_id);
  const withheldIds = statuses.filter(row => row.feed_status !== 'apply_now').slice(0, limit * 2).map(row => row.opportunity_id);
  const wantedIds = [...openIds, ...withheldIds];
  if (wantedIds.length === 0) return [];

  const detailResult = await db
    .from('alma_funding_opportunities')
    .select('id, name, funder_name, max_grant_amount, jurisdictions, is_national, eligible_org_types, requires_deductible_gift_recipient')
    .in('id', wantedIds);
  if (detailResult.error) {
    throw new Error(`Ask GrantScope could not load opportunity detail: ${detailResult.error.message}`);
  }
  const details = new Map(
    ((detailResult.data || []) as Array<{
      id: string;
      name: string;
      funder_name: string | null;
      max_grant_amount: number | null;
      jurisdictions: string[] | null;
      is_national: boolean | null;
      eligible_org_types: string[] | null;
      requires_deductible_gift_recipient: boolean | null;
    }>).map(row => [row.id, row]),
  );

  const statusById = new Map(statuses.map(row => [row.opportunity_id, row]));
  return wantedIds.flatMap((id): GatedOpportunity[] => {
    const status = statusById.get(id);
    const detail = details.get(id);
    if (!status || !detail) return [];
    const jurisdictions = detail.jurisdictions || [];
    const isNational = detail.is_national === true;
    // Jurisdiction is a hard filter only where the record actually states one.
    if (intent.state && !jurisdictionAllows(jurisdictions, isNational, intent.state)) return [];
    return [{
      opportunityId: id,
      name: detail.name,
      funderName: detail.funder_name,
      deadline: status.deadline,
      maxAmount: detail.max_grant_amount,
      sourceUrl: status.source_url,
      applicationUrl: status.application_url,
      feedStatus: status.feed_status,
      verificationStatus: status.verification_status,
      verifiedAt: status.verified_at,
      evidenceCompleteness: status.evidence_completeness,
      failedRequirements: status.failed_requirements || [],
      jurisdictions,
      isNational,
      eligibleOrgTypes: detail.eligible_org_types || [],
      requiresDgr: detail.requires_deductible_gift_recipient,
      fitScore: fitByOpportunity.get(id) ?? null,
    }];
  });
}

/**
 * National coverage allows every state. A record that states no jurisdiction at
 * all is allowed through rather than silently dropped — the unstated case is an
 * unknown for a human to resolve, not a disqualification.
 */
export function jurisdictionAllows(
  jurisdictions: string[],
  isNational: boolean,
  state: string,
): boolean {
  if (isNational) return true;
  if (jurisdictions.length === 0) return true;
  return jurisdictions.some(jurisdiction => {
    const value = jurisdiction.trim().toLowerCase();
    if (/^(national|australia|australia[- ]wide|all states|nationwide)$/.test(value)) return true;
    return value === state.toLowerCase() || STATE_ALIASES[value] === state;
  });
}
