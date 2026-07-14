'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  actionCreatesPipeline,
  resolveActOpportunityProject,
  type ActOpportunityProjectOption,
} from '@/lib/services/act-opportunity-handoff';
import {
  applyDecisionMemory,
  decisionMemoryLabel,
  latestDecisionFor,
  movePriority,
} from '@/lib/services/act-recommendation-memory';
import type { OpportunityVerification } from '@/lib/services/act-opportunity-trust';
import type { OrgOpportunityDecision } from '@/lib/services/org-dashboard-service';

type ReviewLane =
  | 'grant'
  | 'foundation'
  | 'procurement'
  | 'capital'
  | 'relationship'
  | 'evidence'
  | 'systems'
  | 'pipeline';

type ReviewSource = 'wiki' | 'grant' | 'foundation' | 'procurement' | 'crm' | 'notion' | 'goods';
type ReviewPathway = 'grant' | 'foundation' | 'procurement' | 'buyer' | 'capital' | 'relationship' | 'monitor';
type ReviewRole = 'lead' | 'partner' | 'contractor' | 'monitor';
type RelationshipState = 'cold' | 'known' | 'warm' | 'active' | 'stale';
type Readiness = 'ready' | 'needs_proof' | 'needs_applicant' | 'needs_relationship' | 'park';
type RecommendedMove = 'apply_now' | 'approach_now' | 'ask_for_intro' | 'build_proof_pack' | 'watch' | 'park';

export interface ActReviewRecord {
  id: string;
  title: string;
  summary: string;
  lane: ReviewLane;
  sourceLabel: string;
  sourceType: ReviewSource;
  sourceRef: string;
  sourceUrl: string | null;
  score: number;
  project: string;
  projectCode: string;
  role: string;
  recommendedRole: ReviewRole;
  pathway: ReviewPathway;
  amount: string;
  date: string;
  nextAction: string;
  relationshipState: RelationshipState;
  readiness: Readiness;
  recommendedMove: RecommendedMove;
  reason: string;
  confidence: number;
  evidenceGaps: string[];
  tags: string[];
  verification: OpportunityVerification;
  decisionMemory?: {
    decision: OrgOpportunityDecision['decision'];
    label: string;
    createdAt: string;
    reason: string | null;
  } | null;
  discoveryState?: 'new' | 'changed' | null;
  relationshipId?: string | null;
  relationshipName?: string | null;
}

function discoveryStateClass(state: NonNullable<ActReviewRecord['discoveryState']>): string {
  return state === 'new'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-blue-200 bg-blue-50 text-blue-700';
}

function DiscoveryStateBadge({ state }: { state: ActReviewRecord['discoveryState'] }) {
  if (!state) return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${discoveryStateClass(state)}`}>
      {state}
    </span>
  );
}

function verificationClass(state: OpportunityVerification['state']): string {
  if (state === 'verified') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'forecast') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (state === 'relationship') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (state === 'internal') return 'border-stone-200 bg-stone-50 text-stone-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function VerificationBadge({ verification }: { verification: OpportunityVerification }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${verificationClass(verification.state)}`}>
      {verification.label}
    </span>
  );
}

function DecisionMemoryBadge({ memory }: { memory: NonNullable<ActReviewRecord['decisionMemory']> }) {
  return (
    <span className="rounded border border-[#c7d4ca] bg-[#edf3ee] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-[#2f6b4a]">
      {memory.label}
    </span>
  );
}

interface ActionReceipt {
  id?: string;
  status?: string;
  nextStep?: string;
  warnings?: string[];
  externalWrites?: Array<{ system: string; id: string; status: string }>;
  payload?: {
    project?: string | null;
    projectCode?: string | null;
  };
  error?: string;
  detail?: string;
}

type ReviewAction = 'no' | 'later' | 'research' | 'partner_path' | 'apply_path' | 'add_evidence_gap' | 'send_to_ghl';
type ReviewView = 'changes' | 'all' | 'ready' | 'contact' | 'grant' | 'foundation' | 'procurement' | 'capital' | 'pipeline' | 'arts' | 'gaps' | 'decision';

const ACTIONS: Array<{ kind: ReviewAction; label: string; note: string }> = [
  { kind: 'research', label: 'Research path', note: 'Records a research path and can create/update CivicGraph pipeline work.' },
  { kind: 'partner_path', label: 'Partner path', note: 'Records that ACT should work this through relationship or partner development.' },
  { kind: 'apply_path', label: 'Application path', note: 'Records that ACT may lead the application once gaps are cleared.' },
  { kind: 'add_evidence_gap', label: 'Proof needed', note: 'Records missing proof so the next scan keeps it visible.' },
  { kind: 'send_to_ghl', label: 'Plan HighLevel', note: 'Plans CRM handoff only; no HighLevel write without explicit confirmation.' },
];

const REVIEW_VIEWS: Array<{ id: ReviewView; label: string }> = [
  { id: 'changes', label: 'New / changed' },
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'contact', label: 'Reach out' },
  { id: 'grant', label: 'Grants' },
  { id: 'foundation', label: 'Funders' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'capital', label: 'Capital' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'arts', label: 'Arts / festivals' },
  { id: 'gaps', label: 'Evidence gaps' },
  { id: 'decision', label: 'Previously decided' },
];

const DAILY_REVIEW_VIEWS = REVIEW_VIEWS.filter((view) => ['changes', 'all', 'ready', 'contact'].includes(view.id));
const TYPE_REVIEW_VIEWS = REVIEW_VIEWS.filter((view) => ['grant', 'foundation', 'procurement', 'capital', 'pipeline', 'arts', 'gaps', 'decision'].includes(view.id));

const ARTS_PATTERNS = [
  /\barts?\b/,
  /\bartists?\b/,
  /\bfestivals?\b/,
  /\bcreative\b/,
  /\bculture\b/,
  /\bcultural\b/,
  /\btouring\b/,
  /\bperformance\b/,
  /\bmusic\b/,
  /\bgallery\b/,
];

function decisionForAction(kind: ReviewAction): OrgOpportunityDecision['decision'] | null {
  if (kind === 'no') return 'no';
  if (kind === 'later') return 'later';
  if (kind === 'research') return 'research';
  if (kind === 'partner_path') return 'partner';
  if (kind === 'apply_path') return 'apply';
  if (kind === 'add_evidence_gap') return 'more_info';
  if (kind === 'send_to_ghl') return 'send_to_ghl';
  return null;
}

function laneLabel(lane: ReviewLane): string {
  if (lane === 'procurement') return 'Procurement';
  return lane.charAt(0).toUpperCase() + lane.slice(1);
}

function moveLabel(move: RecommendedMove): string {
  if (move === 'apply_now') return 'Apply now';
  if (move === 'approach_now') return 'Approach now';
  if (move === 'ask_for_intro') return 'Ask for intro';
  if (move === 'build_proof_pack') return 'Build proof pack';
  if (move === 'park') return 'Park';
  return 'Watch';
}

function moveClass(move: RecommendedMove): string {
  if (move === 'apply_now' || move === 'approach_now' || move === 'ask_for_intro') return 'border-[#cbd8cf] bg-[#edf3ee] text-[#2f6b4a]';
  if (move === 'build_proof_pack') return 'border-[var(--ws-border)] bg-[var(--ws-surface-2)] text-[var(--ws-text)]';
  if (move === 'park') return 'border-stone-300 bg-stone-100 text-stone-600';
  return 'border-[var(--ws-border)] bg-white text-[var(--ws-text-secondary)]';
}

function primaryActionFor(record: ActReviewRecord): { kind: ReviewAction; label: string; note: string } {
  if (record.recommendedMove === 'apply_now') {
    return { kind: 'apply_path', label: 'Accept application path', note: 'Record this as an application path and create/update CivicGraph pipeline work.' };
  }
  if (record.recommendedMove === 'approach_now' || record.recommendedMove === 'ask_for_intro') {
    return { kind: 'partner_path', label: 'Accept relationship path', note: 'Record this as relationship work and create/update CivicGraph pipeline work.' };
  }
  if (record.recommendedMove === 'build_proof_pack' || record.readiness === 'needs_proof' || record.readiness === 'needs_applicant') {
    return { kind: 'add_evidence_gap', label: 'Record proof gap', note: 'Keep the missing proof visible in future recommendation scoring.' };
  }
  if (record.recommendedMove === 'park') {
    return { kind: 'later', label: 'Park this', note: 'Record a later decision and reduce urgency in future ranking.' };
  }
  return { kind: 'research', label: 'Accept research path', note: 'Record this as research work and create/update CivicGraph pipeline work.' };
}

function readinessLabel(readiness: Readiness): string {
  if (readiness === 'needs_proof') return 'Needs proof';
  if (readiness === 'needs_applicant') return 'Needs applicant';
  if (readiness === 'needs_relationship') return 'Needs relationship';
  if (readiness === 'park') return 'Park';
  return 'Ready';
}

function relationshipLabel(state: RelationshipState): string {
  if (state === 'active') return 'Active';
  if (state === 'warm') return 'Warm';
  if (state === 'known') return 'Known';
  if (state === 'stale') return 'Stale';
  return 'Cold';
}

function compact(text: string, limit = 150): string {
  const value = text.trim();
  if (!value) return 'Not set';
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function recordHaystack(record: ActReviewRecord): string {
  return [
    record.title,
    record.summary,
    record.lane,
    record.sourceLabel,
    record.sourceType,
    record.sourceRef,
    record.project,
    record.projectCode,
    record.role,
    record.recommendedRole,
    record.pathway,
    record.amount,
    record.date,
    record.nextAction,
    record.relationshipState,
    record.readiness,
    record.recommendedMove,
    record.reason,
    record.verification.label,
    record.verification.detail,
    record.decisionMemory?.label,
    record.decisionMemory?.reason,
    ...record.evidenceGaps,
    ...record.tags,
  ]
    .join(' ')
    .toLowerCase();
}

function recordMatchesView(record: ActReviewRecord, view: ReviewView): boolean {
  if (view === 'changes') return record.discoveryState === 'new' || record.discoveryState === 'changed';
  if (view === 'all') return true;
  if (view === 'ready') return record.readiness === 'ready' || record.recommendedMove === 'apply_now' || record.recommendedMove === 'approach_now';
  if (view === 'contact') return record.recommendedMove === 'approach_now' || record.recommendedMove === 'ask_for_intro';
  if (view === 'gaps') return record.evidenceGaps.length > 0;
  if (view === 'decision') return Boolean(record.decisionMemory);
  if (view === 'arts') {
    const haystack = recordHaystack(record);
    return ARTS_PATTERNS.some((pattern) => pattern.test(haystack));
  }
  return record.lane === view;
}

function recordMatchesQuery(record: ActReviewRecord, query: string): boolean {
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return recordHaystack(record).includes(value);
}

function buildActionPayload(record: ActReviewRecord, orgProfileId: string, kind: ReviewAction) {
  const signal = {
    id: record.id,
    title: record.title,
    source: record.sourceType,
    sourceRef: record.sourceRef,
      sourceUrl: record.sourceUrl,
      lane: record.lane === 'pipeline' || record.lane === 'evidence' || record.lane === 'systems' ? 'systems' : record.lane,
      project: record.project,
      projects: [record.project],
      organisation: record.sourceLabel,
      amount: record.amount,
      deadline: record.date === 'No date' ? null : record.date,
      recommendedMove: record.recommendedMove,
      readiness: record.readiness,
      relationshipState: record.relationshipState,
      reason: record.reason,
      confidence: record.confidence,
    };

  return {
    kind,
    signalId: record.id,
    signal,
    orgProfileId,
    route: {
      id: record.id,
      signalId: record.id,
      title: record.title,
      source: record.sourceType,
      sourceRef: record.sourceRef,
      sourceUrl: record.sourceUrl,
      project: record.project,
      project_code: record.projectCode,
      project_name: record.project,
      pathway: record.pathway,
      recommended_role: record.recommendedRole,
      recommended_move: record.recommendedMove,
      relationship_state: record.relationshipState,
      readiness: record.readiness,
      reason: record.reason,
      confidence: record.confidence,
      evidence_gaps: record.evidenceGaps,
      next_action: record.nextAction,
      ghl: {
        recommendedPipeline: record.pathway === 'procurement' ? 'Procurement' : 'Grants',
        suggestedStage: kind === 'send_to_ghl' ? 'Researching' : 'Triage',
        existingOpportunityId: null,
        contactId: null,
        tags: record.tags,
      },
    },
    note: `${record.nextAction} Source: ${record.sourceLabel}.`,
    targetSystem: kind === 'send_to_ghl' ? 'ghl' : 'civicgraph',
    confirmWrite: false,
    reason: record.reason,
    evidenceGaps: record.evidenceGaps,
  };
}

function localDecisionFromAction(record: ActReviewRecord, kind: ReviewAction, receipt: ActionReceipt): OrgOpportunityDecision | null {
  const decision = decisionForAction(kind);
  if (!decision) return null;
  return {
    id: receipt.id ?? `local:${kind}:${record.id}:${Date.now()}`,
    source_type: record.sourceType,
    source_ref: record.sourceRef,
    project_code: record.projectCode,
    pathway: record.pathway,
    decision,
    reason: record.reason,
    notes: `${record.nextAction} Source: ${record.sourceLabel}.`,
    evidence_gaps: record.evidenceGaps,
    outcome: receipt.id ?? null,
    created_at: new Date().toISOString(),
  };
}

function sortRecommendationRecords(records: ActReviewRecord[]): ActReviewRecord[] {
  return [...records].sort((left, right) =>
    movePriority(left.recommendedMove) - movePriority(right.recommendedMove)
    || right.confidence - left.confidence
    || right.score - left.score
    || left.title.localeCompare(right.title),
  );
}

function decisionSummary(decision: OrgOpportunityDecision): NonNullable<ActReviewRecord['decisionMemory']> {
  return {
    decision: decision.decision,
    label: decisionMemoryLabel(decision),
    createdAt: decision.created_at,
    reason: decision.reason,
  };
}

export function ActRecordReview({
  records,
  orgProfileId,
  orgSlug,
  projects,
  initialView = 'ready',
}: {
  records: ActReviewRecord[];
  orgProfileId: string;
  orgSlug: string;
  projects: ActOpportunityProjectOption[];
  initialView?: string;
}) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? null);
  const [activeView, setActiveView] = useState<ReviewView>(
    REVIEW_VIEWS.some((view) => view.id === initialView) ? initialView as ReviewView : 'ready',
  );
  const [activeProject, setActiveProject] = useState('all');
  const [query, setQuery] = useState('');
  const [projectOverrides, setProjectOverrides] = useState<Record<string, string>>({});
  const [pendingKind, setPendingKind] = useState<ReviewAction | null>(null);
  const [receipt, setReceipt] = useState<ActionReceipt | null>(null);
  const [receiptContext, setReceiptContext] = useState<{ record: ActReviewRecord; kind: ReviewAction } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localDecisions, setLocalDecisions] = useState<OrgOpportunityDecision[]>([]);
  const displayRecords = useMemo(() => {
    if (localDecisions.length === 0) return records;
    return sortRecommendationRecords(records.map((record) => {
      const adjusted = applyDecisionMemory(record, localDecisions);
      const latest = latestDecisionFor(record, localDecisions);
      return latest ? { ...adjusted, decisionMemory: decisionSummary(latest) } : adjusted;
    }));
  }, [localDecisions, records]);
  const coverage = useMemo(() => ({
    grant: displayRecords.filter((record) => record.lane === 'grant').length,
    foundation: displayRecords.filter((record) => record.lane === 'foundation').length,
    procurement: displayRecords.filter((record) => record.lane === 'procurement').length,
    capital: displayRecords.filter((record) => record.lane === 'capital').length,
    pipeline: displayRecords.filter((record) => record.lane === 'pipeline').length,
    verified: displayRecords.filter((record) => record.verification.state === 'verified').length,
    unverified: displayRecords.filter((record) => record.verification.state === 'unverified' || record.verification.state === 'forecast').length,
    decided: displayRecords.filter((record) => Boolean(record.decisionMemory)).length,
  }), [displayRecords]);
  const viewCounts = useMemo(
    () =>
      REVIEW_VIEWS.reduce<Record<ReviewView, number>>(
        (counts, view) => {
          counts[view.id] = displayRecords.filter((record) => recordMatchesView(record, view.id)).length;
          return counts;
        },
        {
          changes: 0,
          all: 0,
          ready: 0,
          contact: 0,
          grant: 0,
          foundation: 0,
          procurement: 0,
          capital: 0,
          pipeline: 0,
          arts: 0,
          gaps: 0,
          decision: 0,
        },
      ),
    [displayRecords],
  );
  const filteredRecords = useMemo(
    () => displayRecords.filter((record) => {
      const project = resolveActOpportunityProject(record, projects);
      const projectCode = projectOverrides[record.id] ?? project?.code ?? 'unassigned';
      return recordMatchesView(record, activeView)
        && recordMatchesQuery(record, query)
        && (activeProject === 'all' || activeProject === projectCode);
    }),
    [activeProject, activeView, displayRecords, projectOverrides, projects, query],
  );
  const selected = useMemo(
    () => filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null,
    [filteredRecords, selectedId],
  );
  const primaryAction = selected ? primaryActionFor(selected) : null;
  const inferredProject = selected ? resolveActOpportunityProject(selected, projects) : null;
  const selectedProjectCode = selected ? projectOverrides[selected.id] ?? inferredProject?.code ?? '' : '';
  const selectedProject = projects.find((project) => project.code === selectedProjectCode) ?? null;
  const activeTypeView = TYPE_REVIEW_VIEWS.some((view) => view.id === activeView) ? activeView : 'all';
  const receiptProject = receipt?.payload?.projectCode
    ? projects.find((project) => project.code === receipt.payload?.projectCode) ?? null
    : null;
  const pipelineWrite = receipt?.externalWrites?.find((write) => write.system === 'supabase_pipeline') ?? null;

  useEffect(() => {
    if (filteredRecords.length === 0) return;
    if (!selectedId || !filteredRecords.some((record) => record.id === selectedId)) {
      setSelectedId(filteredRecords[0].id);
      setReceipt(null);
      setReceiptContext(null);
      setError(null);
    }
  }, [filteredRecords, selectedId]);

  async function runAction(kind: ReviewAction) {
    if (!selected) return;
    if (actionCreatesPipeline(kind) && !selectedProject) {
      setError('Choose the ACT project that will own this opening before accepting it.');
      return;
    }
    const actionRecord = selectedProject
      ? { ...selected, project: selectedProject.name, projectCode: selectedProject.code }
      : selected;
    setPendingKind(kind);
    setError(null);
    setReceipt(null);
    try {
      const response = await fetch('/api/opportunity-intelligence/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildActionPayload(actionRecord, orgProfileId, kind)),
      });
      const body = (await response.json()) as ActionReceipt;
      if (!response.ok) {
        setError(body.detail || body.error || `Action failed with ${response.status}`);
      } else {
          setReceipt(body);
          setReceiptContext({ record: actionRecord, kind });
          const localDecision = localDecisionFromAction(actionRecord, kind, body);
          if (localDecision) {
            setLocalDecisions((current) => [localDecision, ...current]);
          }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPendingKind(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]" data-testid="act-opportunity-trust-workbench">
      <div className="min-w-0 xl:border-r xl:border-[var(--ws-border)]">
        <section className="border-b border-[var(--ws-border)] bg-[#f6f8f5] px-3 py-4" data-testid="act-opportunity-coverage">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Coverage and trust</div>
              <h3 className="mt-1 text-base font-semibold">All current ACT-scoped openings in one review queue</h3>
            </div>
            <p className="max-w-md text-xs leading-5 text-[var(--ws-text-secondary)]">Public programs, philanthropy relationships, procurement signals and committed pipeline work stay distinct. Official verification is never inferred from an email alone.</p>
          </div>
          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-md border border-[var(--ws-border)] bg-white sm:grid-cols-4">
            <CoverageMetric label="Grants" value={coverage.grant} />
            <CoverageMetric label="Philanthropy" value={coverage.foundation} />
            <CoverageMetric label="Procurement" value={coverage.procurement} />
            <CoverageMetric label="Capital" value={coverage.capital} />
            <CoverageMetric label="Tracked pipeline" value={coverage.pipeline} />
            <CoverageMetric label="Officially verified" value={coverage.verified} tone="good" />
            <CoverageMetric label="Needs verification" value={coverage.unverified} tone="warning" />
            <CoverageMetric label="Remembered decisions" value={coverage.decided} />
          </div>
        </section>
        <div className="border-b border-[var(--ws-border)] bg-white px-3 py-3">
          <div className="flex flex-col gap-3">
            <div className="inline-flex w-fit rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-2)] p-1" role="tablist" aria-label="Opportunity review views">
              {DAILY_REVIEW_VIEWS.map((view) => {
                const isActive = activeView === view.id;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => {
                      setActiveView(view.id);
                      setReceipt(null);
                      setReceiptContext(null);
                      setError(null);
                    }}
                    className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded px-3 text-xs font-semibold ${
                      isActive
                        ? 'bg-white text-[var(--ws-text)] shadow-sm'
                        : 'text-[var(--ws-text-secondary)] hover:text-[var(--ws-text)]'
                    }`}
                    aria-pressed={isActive}
                  >
                    <span>{view.label}</span>
                    <span className={isActive ? 'text-white/70' : 'text-[var(--ws-text-secondary)]'}>{viewCounts[view.id]}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
              <label className="relative block w-full">
                <span className="sr-only">Search opportunity records</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search openings"
                  className="min-h-10 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-sm outline-none focus:border-[var(--ws-text)] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label>
                <span className="sr-only">Filter by opening type</span>
                <select
                  value={activeTypeView}
                  onChange={(event) => setActiveView(event.target.value as ReviewView)}
                  className="min-h-10 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-sm font-medium outline-none focus:border-[#2f6b4a] focus:ring-2 focus:ring-[#dce9df]"
                >
                  <option value="all">All types</option>
                  {TYPE_REVIEW_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by ACT project</span>
                <select
                  value={activeProject}
                  onChange={(event) => setActiveProject(event.target.value)}
                  className="min-h-10 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-sm font-medium outline-none focus:border-[#2f6b4a] focus:ring-2 focus:ring-[#dce9df]"
                >
                  <option value="all">All projects</option>
                  {projects.map((project) => <option key={project.code} value={project.code}>{project.name}</option>)}
                  <option value="unassigned">Needs a project</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--ws-text-secondary)]">
            Showing {filteredRecords.length} of {displayRecords.length} records
            {localDecisions.length > 0 ? ` · ${localDecisions.length} local decision${localDecisions.length === 1 ? '' : 's'} applied` : ''}
          </div>
        </div>
        <div className="divide-y divide-[var(--ws-border)]">
          {filteredRecords.map((record) => {
            const isSelected = selected?.id === record.id;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => {
                  setSelectedId(record.id);
                  setReceipt(null);
                  setReceiptContext(null);
                  setError(null);
                }}
                className={`grid w-full grid-cols-[42px_minmax(0,1fr)] gap-3 border-l-4 px-3 py-4 text-left transition-colors ${
                  isSelected ? 'border-l-[#2f6b4a] bg-[#f1f5f2]' : 'border-l-transparent bg-white hover:bg-[var(--ws-surface-2)]'
                }`}
                aria-current={isSelected ? 'true' : undefined}
              >
                <span className="font-mono text-sm font-semibold tabular-nums text-[var(--ws-text-secondary)]">{record.score}</span>
                <span className="min-w-0">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold leading-snug text-[var(--ws-text)]">{record.title}</span>
                    <span className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold ${moveClass(record.recommendedMove)}`}>
                      {moveLabel(record.recommendedMove)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(record.nextAction, 120)}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[var(--ws-text-secondary)]">
                    <DiscoveryStateBadge state={record.discoveryState} />
                    <VerificationBadge verification={record.verification} />
                    {record.decisionMemory ? <DecisionMemoryBadge memory={record.decisionMemory} /> : null}
                    <span>{record.project}</span><span>·</span><span>{laneLabel(record.lane)}</span><span>·</span><span>{relationshipLabel(record.relationshipState)}</span><span>·</span><span>{record.date}</span>
                  </span>
                </span>
              </button>
            );
          })}
          {filteredRecords.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--ws-text-secondary)]">No openings match these filters.</div>
          ) : null}
        </div>
      </div>

      <aside className="border-t border-[var(--ws-border)] bg-[var(--ws-surface-1)] xl:border-t-0">
        {selected ? (
          <div className="sticky top-24">
            <div className="border-b border-[var(--ws-border)] px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">Review record</div>
              <h3 className="mt-1 text-lg font-semibold tracking-normal">{selected.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{selected.summary}</p>
            </div>

            <div className="border-b border-[var(--ws-border)] px-3 py-3 text-xs text-[var(--ws-text-secondary)]">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <DiscoveryStateBadge state={selected.discoveryState} />
                <span>{laneLabel(selected.lane)}</span><span>·</span>
                <span>{selected.amount}</span><span>·</span>
                <span>{selected.date}</span><span>·</span>
                <span>{relationshipLabel(selected.relationshipState)}</span>
              </div>
              <div className="mt-2 truncate">{selected.sourceLabel}</div>
            </div>

            <div className="border-b border-[var(--ws-border)] px-3 py-3" data-testid="act-opportunity-source-evidence">
              <div className="flex flex-wrap items-center gap-2">
                <VerificationBadge verification={selected.verification} />
                {selected.verification.verifiedAt ? <span className="text-[10px] text-[var(--ws-text-secondary)]">Checked {formatDecisionDate(selected.verification.verifiedAt)}</span> : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">{selected.verification.detail}</p>
              <div className="mt-3 rounded-md border border-[var(--ws-border)] bg-white px-3 py-2">
                <div className="font-mono text-[9px] font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">Decision memory</div>
                {selected.decisionMemory ? (
                  <div className="mt-1">
                    <DecisionMemoryBadge memory={selected.decisionMemory} />
                    <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">Recorded {formatDecisionDate(selected.decisionMemory.createdAt)}{selected.decisionMemory.reason ? ` · ${selected.decisionMemory.reason}` : ''}</p>
                  </div>
                ) : <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">No Apply, Partner, Park or Bad-match decision has been recorded for this source reference.</p>}
              </div>
            </div>

            <div className="border-b border-[var(--ws-border)] px-3 py-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">ACT project</span>
                <select
                  value={selectedProjectCode}
                  onChange={(event) => {
                    setProjectOverrides((current) => ({ ...current, [selected.id]: event.target.value }));
                    setReceipt(null);
                    setReceiptContext(null);
                    setError(null);
                  }}
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--ws-text)] focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Choose the project</option>
                  {projects.map((project) => <option key={project.code} value={project.code}>{project.name} · {project.code}</option>)}
                </select>
              </label>
            </div>

            <div className="border-b border-[var(--ws-border)] px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">Next move</div>
              <div className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${moveClass(selected.recommendedMove)}`}>
                {moveLabel(selected.recommendedMove)}
              </div>
              <p className="mt-3 text-sm leading-relaxed">{selected.nextAction}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{selected.reason}</p>
              {selected.evidenceGaps.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {selected.evidenceGaps.map((gap) => (
                    <span key={gap} className="rounded border border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-2 py-1 text-xs text-[var(--ws-text-secondary)]">
                      {gap}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2 border-b border-[var(--ws-border)] px-3 py-3">
              {primaryAction ? (
                <button
                  type="button"
                  onClick={() => runAction(primaryAction.kind)}
                  disabled={pendingKind !== null || (actionCreatesPipeline(primaryAction.kind) && !selectedProject)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-[#183426] px-3 py-2 text-left text-sm font-semibold text-white hover:bg-[#24523b] disabled:cursor-wait disabled:opacity-50"
                  title={primaryAction.note}
                >
                  <span>
                    {pendingKind === primaryAction.kind
                      ? 'Working...'
                      : !selectedProject && actionCreatesPipeline(primaryAction.kind)
                        ? 'Choose a project first'
                        : primaryAction.label}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => runAction('later')}
                  disabled={pendingKind !== null}
                  className="min-h-11 rounded-md border border-[var(--ws-border)] bg-white px-3 py-2 text-left text-sm font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] disabled:cursor-wait disabled:opacity-60"
                  title="Record a later decision and reduce urgency in future ranking."
                >
                  {pendingKind === 'later' ? 'Working...' : 'Park'}
                </button>
                <button
                  type="button"
                  onClick={() => runAction('no')}
                  disabled={pendingKind !== null}
                  className="min-h-11 rounded-md border border-[var(--ws-border)] bg-white px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-[var(--ws-surface-2)] disabled:cursor-wait disabled:opacity-60"
                  title="Record a bad match so similar rows score lower later."
                >
                  {pendingKind === 'no' ? 'Working...' : 'Bad match'}
                </button>
              </div>
              <details className="rounded-md border border-[var(--ws-border)] bg-white">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-[var(--ws-text)]">
                  More actions
                </summary>
                <div className="space-y-2 border-t border-[var(--ws-border)] p-2">
                  {ACTIONS.map((action) => (
                    <button
                      key={action.kind}
                      type="button"
                      onClick={() => runAction(action.kind)}
                      disabled={pendingKind !== null}
                      className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-[var(--ws-border)] bg-white px-3 py-2 text-left text-sm font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] disabled:cursor-wait disabled:opacity-60"
                      title={action.note}
                    >
                      <span>{pendingKind === action.kind ? 'Working...' : action.label}</span>
                      <span className="text-xs font-normal text-[var(--ws-text-secondary)]">record</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>

            <div className="space-y-2 px-3 py-3">
              {selected.sourceUrl ? (
                <Link
                  href={selected.sourceUrl}
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--ws-border)] px-3 text-sm font-semibold hover:bg-[var(--ws-surface-2)]"
                >
                  Open source
                </Link>
              ) : null}
              <Link
                href="/opportunities/ecosystem"
                className="ml-2 inline-flex min-h-10 items-center rounded-md border border-[var(--ws-border)] px-3 text-sm font-semibold hover:bg-[var(--ws-surface-2)]"
              >
                Deep view
              </Link>
              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs leading-relaxed text-red-700">
                  {error}
                </p>
              ) : null}
              {receipt ? (
                <div className="overflow-hidden rounded-md border border-emerald-200 bg-emerald-50 text-xs leading-relaxed text-emerald-900">
                  <div className="border-b border-emerald-200 px-3 py-2">
                    <div className="font-semibold">{pipelineWrite ? 'Now in Action' : 'Decision learned'}</div>
                    <div className="mt-1 text-emerald-800">
                      {pipelineWrite
                        ? `Pipeline ${pipelineWrite.status}. The opening now has a project and next action.`
                        : receipt.nextStep ?? `Recorded: ${receipt.status ?? 'planned'}`}
                    </div>
                  </div>
                  {pipelineWrite && receiptContext ? (
                    <div className="divide-y divide-emerald-200 bg-white/70">
                      {receiptProject ? (
                        <HandoffLink
                          label="Project"
                          value={receiptProject.name}
                          href={`/org/${orgSlug}/${receiptProject.slug}`}
                        />
                      ) : null}
                      <HandoffLink
                        label="Relationship"
                        value={receiptContext.record.relationshipName ?? 'Find the person path'}
                        href={receiptContext.record.relationshipId
                          ? `/org/${orgSlug}?view=relationships&relationship=${encodeURIComponent(receiptContext.record.relationshipId)}#relationships`
                          : `/org/${orgSlug}?view=relationships#relationships`}
                      />
                      <HandoffLink
                        label="Action"
                        value={receiptContext.record.nextAction}
                        href={`/org/${orgSlug}?view=pipeline#pipeline`}
                      />
                    </div>
                  ) : null}
                  {receipt.warnings?.some((warning) => /was not|failed|blocked/i.test(warning)) ? (
                    <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                      {receipt.warnings.find((warning) => /was not|failed|blocked/i.test(warning))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-3 text-sm text-[var(--ws-text-secondary)]">Select a visible row to review it.</div>
        )}
      </aside>
    </div>
  );
}

function HandoffLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="grid min-h-11 grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 hover:bg-emerald-50">
      <span className="font-semibold uppercase text-emerald-700">{label}</span>
      <span className="min-w-0 font-medium text-[var(--ws-text)]">{value}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function CoverageMetric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'good' | 'warning' }) {
  const valueClass = tone === 'good' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-[var(--ws-text)]';
  return (
    <div className="min-w-0 border-b border-r border-[var(--ws-border)] px-3 py-3">
      <div className={`text-lg font-semibold tabular-nums ${valueClass}`}>{value.toLocaleString('en-AU')}</div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">{label}</div>
    </div>
  );
}

function formatDecisionDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown date' : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
