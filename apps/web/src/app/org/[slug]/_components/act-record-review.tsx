'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  resolveActOpportunityProject,
  type ActOpportunityProjectOption,
} from '@/lib/services/act-opportunity-handoff';
import {
  firstNamedEvidenceGap as firstNamedGap,
  selectRelationalReviewMatters,
  type RelationalReviewItem,
  type RelationalReviewTrigger,
} from '@/lib/services/act-relational-review';
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
    id?: string;
    decision: OrgOpportunityDecision['decision'];
    label: string;
    createdAt: string;
    reason: string | null;
  } | null;
  discoveryState?: 'new' | 'changed' | null;
  relationshipId?: string | null;
  relationshipName?: string | null;
  evidenceChangedAt?: string | null;
  revisitAt?: string | null;
  actObligations?: string[];
  suggestedNextQuestion?: string | null;
  priorCases?: Array<{
    id: string;
    label: string;
    decidedAt: string;
    summary: string;
  }>;
}

type ReviewNextMove = 'act' | 'listen' | 'verify' | 'revisit' | 'close';
type CommitmentKind = 'commitment' | 'return';
type QueueTrigger = RelationalReviewTrigger;
type WeeklyReviewItem = RelationalReviewItem<ActReviewRecord>;

interface ActionReceipt {
  id?: string;
  status?: string;
  nextStep?: string;
  warnings?: string[];
  externalWrites?: Array<{ system: string; id: string; status: string }>;
  error?: string;
  detail?: string;
}

const NEXT_MOVES: Array<{ value: ReviewNextMove; label: string; note: string }> = [
  { value: 'act', label: 'Act', note: 'Make a concrete move now.' },
  { value: 'listen', label: 'Listen / relationship', note: 'Talk with the right people before deciding.' },
  { value: 'verify', label: 'Verify', note: 'Resolve an evidence gap first.' },
  { value: 'revisit', label: 'Revisit', note: 'Return on a named date.' },
  { value: 'close', label: 'Close', note: 'Consciously stop this line of work.' },
];

function triggerLabel(trigger: QueueTrigger): string {
  if (trigger === 'official_evidence_changed') return 'Official evidence changed';
  if (trigger === 'deadline_due') return 'Decision due within 30 days';
  if (trigger === 'evidence_gap') return 'Named evidence gap';
  return 'Revisit due';
}

function triggerClass(trigger: QueueTrigger): string {
  if (trigger === 'official_evidence_changed') return 'border-ql-kind-grant/40 bg-ql-kind-grant/10 text-ql-kind-grant';
  if (trigger === 'deadline_due') return 'border-ql-accent/40 bg-ql-accent/10 text-ql-accent';
  if (trigger === 'evidence_gap') return 'border-ql-border bg-ql-surface2 text-ql-ink';
  return 'border-ql-kind-funder/40 bg-ql-kind-funder/10 text-ql-kind-funder';
}

function whyNow(item: WeeklyReviewItem): string {
  if (item.trigger === 'official_evidence_changed') {
    return 'The official source has changed since the last review. Check what this changes before relying on the earlier understanding.';
  }
  if (item.trigger === 'deadline_due') {
    return `A human decision is needed before ${item.record.date}. No decision is recorded for this source.`;
  }
  if (item.trigger === 'evidence_gap') {
    return `“${firstNamedGap(item.record) ?? 'A named unknown'}” is still unresolved and blocks a responsible decision.`;
  }
  return `The human-set revisit date${item.record.revisitAt ? ` (${formatDate(item.record.revisitAt)})` : ''} has arrived.`;
}

function suggestedQuestion(item: WeeklyReviewItem): string {
  if (item.record.suggestedNextQuestion?.trim()) return item.record.suggestedNextQuestion.trim();
  if (item.trigger === 'official_evidence_changed') {
    return 'What does this new official evidence change about our previous understanding?';
  }
  if (item.trigger === 'deadline_due') {
    return `What must be true for ACT to make a responsible decision before ${item.record.date}?`;
  }
  if (item.trigger === 'evidence_gap') {
    return `What evidence or conversation would resolve “${firstNamedGap(item.record) ?? 'this unknown'}”?`;
  }
  return 'What has changed since ACT chose to revisit this?';
}

function verificationClass(state: OpportunityVerification['state']): string {
  if (state === 'verified') return 'border-ql-moss/40 bg-ql-moss/10 text-ql-moss';
  if (state === 'forecast') return 'border-ql-kind-grant/40 bg-ql-kind-grant/10 text-ql-kind-grant';
  if (state === 'relationship') return 'border-ql-kind-funder/40 bg-ql-kind-funder/10 text-ql-kind-funder';
  if (state === 'internal') return 'border-ql-border bg-ql-surface2 text-ql-ink';
  return 'border-ql-accent/40 bg-ql-accent/10 text-ql-accent';
}

function VerificationBadge({ verification }: { verification: OpportunityVerification }) {
  return (
    <span className={`rounded border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide ${verificationClass(verification.state)}`}>
      {verification.label}
    </span>
  );
}

function laneLabel(lane: ReviewLane): string {
  if (lane === 'procurement') return 'Procurement';
  return lane.charAt(0).toUpperCase() + lane.slice(1);
}

function compact(text: string, limit = 180): string {
  const value = text.trim();
  if (!value) return 'Not recorded';
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildReviewPayload({
  record,
  orgProfileId,
  project,
  whatChanged,
  nextMove,
  nextLearningQuestion,
  revisitAt,
  commitment,
}: {
  record: ActReviewRecord;
  orgProfileId: string;
  project: ActOpportunityProjectOption | null;
  whatChanged: string;
  nextMove: ReviewNextMove;
  nextLearningQuestion: string;
  revisitAt: string;
  commitment: {
    kind: CommitmentKind;
    owner: string;
    action: string;
    dueAt: string;
  } | null;
}) {
  const projectCode = project?.code ?? record.projectCode;
  const projectName = project?.name ?? record.project;
  const signalLane = record.lane === 'pipeline' || record.lane === 'evidence' || record.lane === 'systems'
    ? 'systems'
    : record.lane;

  return {
    kind: 'record_review',
    orgProfileId,
    signalId: record.id,
    supersedesId: record.decisionMemory?.id,
    signal: {
      id: record.id,
      title: record.title,
      source: record.sourceType,
      sourceRef: record.sourceRef,
      sourceUrl: record.sourceUrl,
      lane: signalLane,
      project: projectName,
      projects: [projectName],
      organisation: record.sourceLabel,
      amount: record.amount,
      deadline: record.date === 'No date' ? null : record.date,
    },
    route: {
      id: record.id,
      signalId: record.id,
      title: record.title,
      source: record.sourceType,
      sourceRef: record.sourceRef,
      sourceUrl: record.sourceUrl,
      project: projectName,
      project_code: projectCode,
      project_name: projectName,
      pathway: record.pathway,
      evidence_gaps: record.evidenceGaps,
    },
    judgment: {
      schemaVersion: 1,
      whatChanged: whatChanged.trim(),
      nextMove,
      nextLearningQuestion: nextLearningQuestion.trim() || undefined,
      revisitAt: nextMove === 'revisit' ? revisitAt : undefined,
      commitment: commitment
        ? {
            kind: commitment.kind,
            owner: commitment.owner.trim(),
            action: commitment.action.trim(),
            dueAt: commitment.dueAt,
          }
        : undefined,
    },
  };
}

export function ActRecordReview({
  records,
  orgProfileId,
  orgSlug,
  projects,
}: {
  records: ActReviewRecord[];
  orgProfileId: string;
  orgSlug: string;
  projects: ActOpportunityProjectOption[];
  initialView?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [lastReceipt, setLastReceipt] = useState<ActionReceipt | null>(null);
  const availableRecords = useMemo(
    () => records.filter((record) => !reviewedIds.includes(record.id)),
    [records, reviewedIds],
  );
  const queue = useMemo(() => selectRelationalReviewMatters(availableRecords), [availableRecords]);
  const selected = useMemo(
    () => queue.find((item) => item.record.id === selectedId) ?? queue[0] ?? null,
    [queue, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setSelectedId(null);
      return;
    }
    if (selected.record.id !== selectedId) setSelectedId(selected.record.id);
  }, [selected, selectedId]);

  function handleRecorded(recordId: string, receipt: ActionReceipt) {
    setLastReceipt(receipt);
    setReviewedIds((current) => current.includes(recordId) ? current : [...current, recordId]);
  }

  return (
    <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_420px]" data-testid="act-relational-review-workbench">
      <div className="min-w-0 xl:border-r xl:border-[var(--ws-border)]">
        <section className="border-b border-[var(--ws-border)] bg-[#F6F1E8] px-4 py-5">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#5F725C]">Goods relational review</div>
          <h3 className="mt-2 font-ql-display text-xl font-semibold tracking-normal text-[var(--ws-text)]">What needs understanding now</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ws-text-secondary)]">
            GrantScope shows at most five matters, and only when official evidence changed, a decision is due within 30 days, a named unknown blocks the work, or a human revisit date has arrived.
          </p>
        </section>

        {lastReceipt ? (
          <div className="border-b border-ql-moss/40 bg-ql-moss/10 px-4 py-3 text-sm text-ql-moss" role="status">
            <div className="font-semibold">Review captured as learning.</div>
            <div className="mt-1 text-xs leading-5 text-ql-moss">
              {lastReceipt.nextStep ?? 'The note was appended without moving a relationship stage or creating a CRM opportunity.'}
            </div>
          </div>
        ) : null}

        <div className="border-b border-[var(--ws-border)] bg-ql-surface px-4 py-3 text-xs text-[var(--ws-text-secondary)]">
          {queue.length === 0
            ? 'No matters currently meet the weekly attention conditions.'
            : `${queue.length} ${queue.length === 1 ? 'matter needs' : 'matters need'} a read · ${reviewedIds.length} captured in this session`}
        </div>

        <div className="divide-y divide-[var(--ws-border)]">
          {queue.map((item) => {
            const record = item.record;
            const isSelected = selected?.record.id === record.id;
            const project = resolveActOpportunityProject(record, projects);
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => {
                  setSelectedId(record.id);
                  setLastReceipt(null);
                }}
                className={`min-h-28 w-full border-l-4 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5F725C] ${
                  isSelected
                    ? 'border-l-[#5F725C] bg-[#F6F1E8]'
                    : 'border-l-transparent bg-ql-surface hover:bg-[var(--ws-surface-2)]'
                }`}
                aria-current={isSelected ? 'true' : undefined}
              >
                <span className="block min-w-0">
                  <span className={`inline-flex rounded border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide ${triggerClass(item.trigger)}`}>
                    {triggerLabel(item.trigger)}
                  </span>
                  <span className="mt-2 block font-semibold leading-snug text-[var(--ws-text)]">{record.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-[var(--ws-text-secondary)]">{compact(record.summary, 150)}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-[var(--ws-text-secondary)]">
                    <span>{project?.name ?? record.project}</span>
                    <span aria-hidden="true">·</span>
                    <span>{laneLabel(record.lane)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{record.date}</span>
                  </span>
                </span>
              </button>
            );
          })}

          {queue.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-base font-semibold text-[var(--ws-text)]">The weekly queue is clear</div>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--ws-text-secondary)]">
                That is a valid result. New work will appear when an explicit evidence, decision, unknown, or revisit condition is met.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="border-t border-[var(--ws-border)] bg-[var(--ws-surface-1)] xl:border-t-0">
        {selected ? (
          <div className="xl:sticky xl:top-24">
            <RelationalMatterNarrative item={selected} orgSlug={orgSlug} projects={projects} />
            <RelationalReviewForm
              key={selected.record.id}
              item={selected}
              orgProfileId={orgProfileId}
              projects={projects}
              onRecorded={handleRecorded}
            />
          </div>
        ) : (
          <div className="p-5 text-sm leading-6 text-[var(--ws-text-secondary)]">
            Nothing needs a relational review right now.
          </div>
        )}
      </aside>
    </div>
  );
}

function RelationalMatterNarrative({
  item,
  orgSlug,
  projects,
}: {
  item: WeeklyReviewItem;
  orgSlug: string;
  projects: ActOpportunityProjectOption[];
}) {
  const { record } = item;
  const project = resolveActOpportunityProject(record, projects);
  const obligations = record.actObligations?.filter((value) => value.trim().length > 0) ?? [];

  return (
    <div className="divide-y divide-[var(--ws-border)]">
      <section className="px-4 py-4">
        <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#5F725C]">Read before deciding</div>
        <h3 className="mt-2 text-lg font-semibold leading-snug tracking-normal text-[var(--ws-text)]">{record.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--ws-text-secondary)]">
          <span>{project?.name ?? record.project}</span>
          <span aria-hidden="true">·</span>
          <span>{record.sourceLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{record.amount}</span>
        </div>
      </section>

      <NarrativeSection title="What’s happening">
        <p>{record.summary}</p>
      </NarrativeSection>

      <NarrativeSection title="Why now">
        <div className={`mb-2 inline-flex rounded border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide ${triggerClass(item.trigger)}`}>
          {triggerLabel(item.trigger)}
        </div>
        <p>{whyNow(item)}</p>
      </NarrativeSection>

      <NarrativeSection title="Evidence & unknowns">
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge verification={record.verification} />
          {record.verification.verifiedAt ? (
            <span className="text-[10px] text-[var(--ws-text-secondary)]">
              Checked {formatDate(record.verification.verifiedAt)}
            </span>
          ) : null}
        </div>
        <p className="mt-2">{record.verification.detail}</p>
        {record.evidenceGaps.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {record.evidenceGaps.map((gap) => (
              <li key={gap} className="flex gap-2">
                <span className="text-ql-accent" aria-hidden="true">?</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[var(--ws-text-secondary)]">No named evidence gap is attached.</p>
        )}
        {record.priorCases && record.priorCases.length > 0 ? (
          <div className="mt-3 rounded border border-[var(--ws-border)] bg-ql-surface px-3 py-2">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">What earlier cases remember</div>
            <ul className="mt-2 space-y-2">
              {record.priorCases.slice(0, 3).map((priorCase) => (
                <li key={priorCase.id}>
                  <div className="font-semibold text-[var(--ws-text)]">
                    {priorCase.label} · {formatDate(priorCase.decidedAt)}
                  </div>
                  <p className="mt-0.5 text-[var(--ws-text-secondary)]">{priorCase.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : record.decisionMemory ? (
          <div className="mt-3 rounded border border-[var(--ws-border)] bg-ql-surface px-3 py-2">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">Prior human read</div>
            <p className="mt-1">{record.decisionMemory.label} · {formatDate(record.decisionMemory.createdAt)}</p>
            {record.decisionMemory.reason ? <p className="mt-1 text-[var(--ws-text-secondary)]">{record.decisionMemory.reason}</p> : null}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {record.sourceUrl ? (
            <Link
              href={record.sourceUrl}
              className="inline-flex min-h-11 items-center rounded border border-[var(--ws-border)] bg-ql-surface px-3 font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F725C]"
            >
              Open source
            </Link>
          ) : null}
          <Link
            href="/opportunities/ecosystem"
            className="inline-flex min-h-11 items-center rounded border border-[var(--ws-border)] bg-ql-surface px-3 font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F725C]"
          >
            See connected evidence
          </Link>
          {record.relationshipId ? (
            <Link
              href={`/org/${orgSlug}?view=relationships&relationship=${encodeURIComponent(record.relationshipId)}#relationships`}
              className="inline-flex min-h-11 items-center rounded border border-[var(--ws-border)] bg-ql-surface px-3 font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F725C]"
            >
              See relationship
            </Link>
          ) : null}
        </div>
      </NarrativeSection>

      <NarrativeSection title="What ACT owes or promised">
        {obligations.length > 0 ? (
          <ul className="space-y-1.5">
            {obligations.map((obligation) => <li key={obligation}>• {obligation}</li>)}
          </ul>
        ) : (
          <p>No confirmed promise or return is attached to this matter. Add one below only if a person actually made it.</p>
        )}
      </NarrativeSection>

      <NarrativeSection title="Suggested next question">
        <p className="font-medium text-[var(--ws-text)]">{suggestedQuestion(item)}</p>
        <p className="mt-1 text-[11px] text-[var(--ws-text-secondary)]">This is a prompt, not a pre-filled judgment.</p>
      </NarrativeSection>
    </div>
  );
}

function NarrativeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-4 text-xs leading-5 text-[var(--ws-text-secondary)]">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ws-text)]">{title}</h4>
      {children}
    </section>
  );
}

function RelationalReviewForm({
  item,
  orgProfileId,
  projects,
  onRecorded,
}: {
  item: WeeklyReviewItem;
  orgProfileId: string;
  projects: ActOpportunityProjectOption[];
  onRecorded: (recordId: string, receipt: ActionReceipt) => void;
}) {
  const { record } = item;
  const project = resolveActOpportunityProject(record, projects);
  const [whatChanged, setWhatChanged] = useState('');
  const [nextMove, setNextMove] = useState<ReviewNextMove | null>(null);
  const [nextLearningQuestion, setNextLearningQuestion] = useState('');
  const [revisitAt, setRevisitAt] = useState('');
  const [commitmentKind, setCommitmentKind] = useState<CommitmentKind>('commitment');
  const [commitmentOwner, setCommitmentOwner] = useState('');
  const [commitmentAction, setCommitmentAction] = useState('');
  const [commitmentDueAt, setCommitmentDueAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCommitment = Boolean(commitmentOwner.trim() || commitmentAction.trim() || commitmentDueAt);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!whatChanged.trim()) {
      setError('Write one short note about what changed in your understanding.');
      return;
    }
    if (!nextMove) {
      setError('Choose one next move.');
      return;
    }
    if (nextMove === 'revisit' && !revisitAt) {
      setError('Choose the date when this matter should return.');
      return;
    }
    if (hasCommitment && (!commitmentOwner.trim() || !commitmentAction.trim())) {
      setError('A promise or return needs a person and a concrete action.');
      return;
    }

    const payload = buildReviewPayload({
      record,
      orgProfileId,
      project,
      whatChanged,
      nextMove,
      nextLearningQuestion,
      revisitAt,
      commitment: hasCommitment
        ? {
            kind: commitmentKind,
            owner: commitmentOwner,
            action: commitmentAction,
            dueAt: commitmentDueAt,
          }
        : null,
    });

    setPending(true);
    try {
      const response = await fetch('/api/opportunity-intelligence/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ActionReceipt;
      if (!response.ok) {
        setError(body.detail || body.error || `Review could not be recorded (${response.status}).`);
        return;
      }
      onRecorded(record.id, body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Review could not be recorded.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitReview} className="border-t-4 border-[#211F1C] bg-ql-surface px-4 py-5">
      <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#5F725C]">Human reflection</div>
      <h4 className="mt-2 text-base font-semibold text-[var(--ws-text)]">Record only the material change</h4>
      <p className="mt-1 text-xs leading-5 text-[var(--ws-text-secondary)]">
        The system keeps the evidence. You add the meaning, any real obligation, and what happens next.
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-semibold text-[var(--ws-text)]">What changed?</span>
        <span className="mt-1 block text-[11px] text-[var(--ws-text-secondary)]">One or two sentences. Name what you stopped assuming where possible.</span>
        <textarea
          value={whatChanged}
          onChange={(event) => setWhatChanged(event.target.value)}
          rows={3}
          maxLength={600}
          required
          className="mt-2 w-full rounded-md border border-[var(--ws-border)] bg-ql-surface px-3 py-2 text-sm leading-6 outline-none focus:border-[#5F725C] focus:ring-2 focus:ring-[#DDD4C7]"
        />
      </label>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-[var(--ws-text)]">What is the next move?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {NEXT_MOVES.map((move) => {
            const selected = nextMove === move.value;
            return (
              <button
                key={move.value}
                type="button"
                onClick={() => {
                  setNextMove(move.value);
                  if (move.value !== 'revisit') setRevisitAt('');
                }}
                aria-pressed={selected}
                className={`min-h-14 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F725C] ${
                  selected
                    ? 'border-[#5F725C] bg-[#F6F1E8] text-[#211F1C]'
                    : 'border-[var(--ws-border)] bg-ql-surface text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)]'
                }`}
              >
                <span className="block text-sm font-semibold">{move.label}</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-[var(--ws-text-secondary)]">{move.note}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {nextMove === 'revisit' ? (
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-[var(--ws-text)]">Bring this back on</span>
          <input
            type="date"
            value={revisitAt}
            onChange={(event) => setRevisitAt(event.target.value)}
            required
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-ql-surface px-3 text-sm outline-none focus:border-[#5F725C] focus:ring-2 focus:ring-[#DDD4C7]"
          />
        </label>
      ) : null}

      <label className="mt-5 block">
        <span className="text-xs font-semibold text-[var(--ws-text)]">Next learning question <span className="font-normal text-[var(--ws-text-secondary)]">(optional)</span></span>
        <span className="mt-1 block text-[11px] text-[var(--ws-text-secondary)]">Use this when another question would help; the suggested question above is deliberately not copied in.</span>
        <input
          type="text"
          value={nextLearningQuestion}
          onChange={(event) => setNextLearningQuestion(event.target.value)}
          maxLength={300}
          className="mt-2 min-h-11 w-full rounded-md border border-[var(--ws-border)] bg-ql-surface px-3 text-sm outline-none focus:border-[#5F725C] focus:ring-2 focus:ring-[#DDD4C7]"
        />
      </label>

      <details className="mt-5 rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-2)]">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-[var(--ws-text)]">
          Add a promise or return <span className="ml-2 text-xs font-normal text-[var(--ws-text-secondary)]">(optional)</span>
        </summary>
        <div className="space-y-3 border-t border-[var(--ws-border)] bg-ql-surface p-3">
          <fieldset>
            <legend className="text-xs font-semibold text-[var(--ws-text)]">What kind of obligation is this?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                ['commitment', 'Promise'],
                ['return', 'Return owed'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCommitmentKind(value)}
                  aria-pressed={commitmentKind === value}
                  className={`min-h-11 rounded border px-3 text-sm font-semibold ${
                    commitmentKind === value
                      ? 'border-[#5F725C] bg-[#F6F1E8] text-[#211F1C]'
                      : 'border-[var(--ws-border)] bg-ql-surface text-[var(--ws-text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ws-text)]">Who owns it?</span>
            <input
              type="text"
              value={commitmentOwner}
              onChange={(event) => setCommitmentOwner(event.target.value)}
              maxLength={160}
              className="mt-1 min-h-11 w-full rounded border border-[var(--ws-border)] px-3 text-sm outline-none focus:border-[#5F725C] focus:ring-2 focus:ring-[#DDD4C7]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ws-text)]">What exactly was promised or must be returned?</span>
            <input
              type="text"
              value={commitmentAction}
              onChange={(event) => setCommitmentAction(event.target.value)}
              maxLength={300}
              className="mt-1 min-h-11 w-full rounded border border-[var(--ws-border)] px-3 text-sm outline-none focus:border-[#5F725C] focus:ring-2 focus:ring-[#DDD4C7]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--ws-text)]">By when? <span className="font-normal text-[var(--ws-text-secondary)]">(optional)</span></span>
            <input
              type="date"
              value={commitmentDueAt}
              onChange={(event) => setCommitmentDueAt(event.target.value)}
              className="mt-1 min-h-11 w-full rounded border border-[var(--ws-border)] px-3 text-sm outline-none focus:border-[#5F725C] focus:ring-2 focus:ring-[#DDD4C7]"
            />
          </label>
        </div>
      </details>

      {error ? (
        <p className="mt-4 rounded-md border border-ql-alert/40 bg-ql-alert/10 p-3 text-xs leading-5 text-ql-alert" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 flex min-h-12 w-full items-center justify-between rounded-md bg-[#211F1C] px-4 text-sm font-semibold text-white hover:bg-[#27221D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F725C] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        <span>{pending ? 'Recording reflection…' : 'Record reflection and continue'}</span>
        <span aria-hidden="true">→</span>
      </button>
      <p className="mt-2 text-[10px] leading-4 text-[var(--ws-text-secondary)]">
        This appends learning and obligations. It does not score a relationship, advance a stage, or create a HighLevel deal.
      </p>
    </form>
  );
}
