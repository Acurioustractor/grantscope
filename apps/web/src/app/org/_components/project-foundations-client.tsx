'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ProjectFoundationStage = 'saved' | 'priority' | 'approach_now' | 'in_conversation' | 'parked';
type EngagementStatus =
  | 'researching'
  | 'ready_to_approach'
  | 'approached'
  | 'meeting'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'parked';

type FoundationSearchResult = {
  id: string;
  name: string;
  type: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
};

type ApplicantEntity = {
  id: string;
  name: string;
  entity_type: string;
  status: string;
  abn: string | null;
  is_default: boolean;
};

type PipelineFoundationCandidate = {
  pipeline_id: string;
  name: string;
  funder: string | null;
  status: string | null;
  foundation_id: string;
  foundation_name: string;
  notes: string | null;
};

type ResearchStatus = 'ready' | 'partial' | 'missing';
type InteractionType = 'note' | 'email' | 'call' | 'meeting' | 'proposal' | 'decision';

type ProjectFoundationResearch = {
  id: string;
  foundation_thesis: string | null;
  evidence_summary: string | null;
  relationship_path: string | null;
  ask_shape: string | null;
  fit_status: ResearchStatus;
  proof_status: ResearchStatus;
  applicant_status: ResearchStatus;
  relationship_status: ResearchStatus;
  ask_status: ResearchStatus;
  missing_items: string[];
  updated_at: string;
};

type ProjectFoundationInteraction = {
  id: string;
  interaction_type: InteractionType;
  summary: string;
  notes: string | null;
  happened_at: string;
  status_snapshot: EngagementStatus | null;
  created_at: string;
};

type ProjectFoundationRow = {
  id: string;
  org_profile_id: string;
  org_project_id: string;
  foundation_id: string;
  applicant_entity_id: string | null;
  stage: ProjectFoundationStage;
  engagement_status: EngagementStatus;
  engagement_updated_at: string;
  fit_score: number | null;
  fit_summary: string | null;
  message_alignment: string | null;
  next_step: string | null;
  next_touch_at: string | null;
  next_touch_note: string | null;
  last_interaction_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  applicant_entity: ApplicantEntity | null;
  research: ProjectFoundationResearch[] | null;
  interactions: ProjectFoundationInteraction[] | null;
  foundation: FoundationSearchResult;
};

type ProjectFoundationUpdate = Omit<Partial<ProjectFoundationRow>, 'research'> & {
  research?: Partial<ProjectFoundationResearch>;
  new_interaction?: Partial<ProjectFoundationInteraction> & Pick<ProjectFoundationInteraction, 'interaction_type' | 'summary' | 'happened_at'>;
};

const STAGES: Array<{ value: ProjectFoundationStage; label: string }> = [
  { value: 'saved', label: 'Saved' },
  { value: 'priority', label: 'Priority' },
  { value: 'approach_now', label: 'Approach Now' },
  { value: 'in_conversation', label: 'In Conversation' },
  { value: 'parked', label: 'Parked' },
];

const ENGAGEMENT_STATUSES: Array<{ value: EngagementStatus; label: string }> = [
  { value: 'researching', label: 'Shortlisting' },
  { value: 'ready_to_approach', label: 'Ready' },
  { value: 'approached', label: 'Approached' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'parked', label: 'Parked' },
];

function formatMoney(amount: number | null) {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString('en-AU')}`;
}

function formatType(type: string | null | undefined) {
  if (!type) return 'Foundation';
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function focusLabel(values: string[] | null | undefined) {
  if (!values || values.length === 0) return 'No focus tags';
  return values.slice(0, 3).join(' · ');
}

function stageTone(stage: ProjectFoundationStage) {
  if (stage === 'priority') return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
  if (stage === 'approach_now') return 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red';
  if (stage === 'in_conversation') return 'border-money bg-money-light text-money';
  if (stage === 'parked') return 'border-bauhaus-black/20 bg-white text-bauhaus-muted';
  return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black';
}

function engagementTone(status: EngagementStatus) {
  if (status === 'won') return 'border-money bg-money-light text-money';
  if (status === 'proposal') return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
  if (status === 'meeting' || status === 'approached') return 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red';
  if (status === 'parked' || status === 'lost') return 'border-bauhaus-black/20 bg-white text-bauhaus-muted';
  return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black';
}

function formatEntityType(value: string | null | undefined) {
  if (!value) return 'Entity';
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function applicantEntityLabel(entity: ApplicantEntity | null | undefined) {
  if (!entity) return 'No applicant set';
  const suffix = entity.abn ? ` · ABN ${entity.abn}` : entity.status === 'pending' ? ' · pending' : '';
  return `${entity.name}${suffix}`;
}

const RESEARCH_STATUSES: Array<{ value: ResearchStatus; label: string }> = [
  { value: 'ready', label: 'Ready' },
  { value: 'partial', label: 'Partial' },
  { value: 'missing', label: 'Missing' },
];

const INTERACTION_TYPES: Array<{ value: InteractionType; label: string }> = [
  { value: 'note', label: 'Note' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'decision', label: 'Decision' },
];

function researchStatusTone(status: ResearchStatus) {
  if (status === 'ready') return 'border-money bg-money-light text-money';
  if (status === 'partial') return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
  return 'border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red';
}

function firstResearch(item: ProjectFoundationRow): ProjectFoundationResearch | null {
  return item.research?.[0] ?? null;
}

function missingItemsText(items: string[] | null | undefined) {
  if (!items || items.length === 0) return '';
  return items.join('\n');
}

function strategyReadiness(research: ProjectFoundationResearch | null) {
  const statuses = [
    research?.fit_status ?? 'missing',
    research?.proof_status ?? 'missing',
    research?.applicant_status ?? 'missing',
    research?.relationship_status ?? 'missing',
    research?.ask_status ?? 'missing',
  ];
  const readyCount = statuses.filter((status) => status === 'ready').length;
  const missingCount = statuses.filter((status) => status === 'missing').length;

  if (readyCount >= 4 && missingCount === 0) {
    return {
      label: 'Ready now',
      tone: 'border-money bg-money-light text-money',
      summary: 'This pair is clear enough to contact now.',
    };
  }

  if (readyCount >= 2 && missingCount <= 2) {
    return {
      label: 'Needs work',
      tone: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
      summary: 'This pair looks promising, but it still needs a few things tightened before contact.',
    };
  }

  return {
    label: 'Early',
    tone: 'border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red',
    summary: 'This pair is still early and needs more clarity before it is worth pursuing.',
  };
}

function topNames(items: ProjectFoundationRow[]) {
  return items.slice(0, 3).map((item) => item.foundation.name).join(' · ');
}

function sortInteractions(interactions: ProjectFoundationInteraction[] | null | undefined) {
  return [...(interactions ?? [])].sort(
    (left, right) => new Date(right.happened_at).getTime() - new Date(left.happened_at).getTime(),
  );
}

function isDueNow(nextTouchAt: string | null) {
  if (!nextTouchAt) return false;
  return new Date(nextTouchAt).getTime() <= Date.now();
}

function isUpcoming(nextTouchAt: string | null) {
  if (!nextTouchAt) return false;
  const now = Date.now();
  const then = new Date(nextTouchAt).getTime();
  const in14Days = now + 14 * 24 * 60 * 60 * 1000;
  return then > now && then <= in14Days;
}

function isStale(item: ProjectFoundationRow) {
  if (!['approached', 'meeting', 'proposal'].includes(item.engagement_status)) return false;
  const lastInteractionAt = item.last_interaction_at ?? item.interactions?.[0]?.happened_at ?? null;
  if (!lastInteractionAt) return true;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(lastInteractionAt).getTime() < thirtyDaysAgo;
}

function FoundationCard({
  item,
  applicantEntities,
  onUpdate,
  onRemove,
}: {
  item: ProjectFoundationRow;
  applicantEntities: ApplicantEntity[];
  onUpdate: (id: string, updates: ProjectFoundationUpdate) => void;
  onRemove: (id: string) => void;
}) {
  const research = firstResearch(item);
  const readiness = strategyReadiness(research);
  const interactions = sortInteractions(item.interactions);
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState({
    fit_score: item.fit_score?.toString() ?? '',
    fit_summary: item.fit_summary ?? '',
    message_alignment: item.message_alignment ?? '',
    next_step: item.next_step ?? '',
    next_touch_at: item.next_touch_at ? item.next_touch_at.slice(0, 16) : '',
    next_touch_note: item.next_touch_note ?? '',
    notes: item.notes ?? '',
    foundation_thesis: research?.foundation_thesis ?? '',
    evidence_summary: research?.evidence_summary ?? '',
    relationship_path: research?.relationship_path ?? '',
    ask_shape: research?.ask_shape ?? '',
    fit_status: research?.fit_status ?? 'missing',
    proof_status: research?.proof_status ?? 'missing',
    applicant_status: research?.applicant_status ?? 'missing',
    relationship_status: research?.relationship_status ?? 'missing',
    ask_status: research?.ask_status ?? 'missing',
    missing_items_text: missingItemsText(research?.missing_items),
  });
  const [interactionDraft, setInteractionDraft] = useState({
    interaction_type: 'note' as InteractionType,
    happened_at: new Date().toISOString().slice(0, 16),
    summary: '',
    notes: '',
    status_snapshot: '' as '' | EngagementStatus,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal({
      fit_score: item.fit_score?.toString() ?? '',
      fit_summary: item.fit_summary ?? '',
      message_alignment: item.message_alignment ?? '',
      next_step: item.next_step ?? '',
      next_touch_at: item.next_touch_at ? item.next_touch_at.slice(0, 16) : '',
      next_touch_note: item.next_touch_note ?? '',
      notes: item.notes ?? '',
      foundation_thesis: research?.foundation_thesis ?? '',
      evidence_summary: research?.evidence_summary ?? '',
      relationship_path: research?.relationship_path ?? '',
      ask_shape: research?.ask_shape ?? '',
      fit_status: research?.fit_status ?? 'missing',
      proof_status: research?.proof_status ?? 'missing',
      applicant_status: research?.applicant_status ?? 'missing',
      relationship_status: research?.relationship_status ?? 'missing',
      ask_status: research?.ask_status ?? 'missing',
      missing_items_text: missingItemsText(research?.missing_items),
    });
  }, [item.fit_score, item.fit_summary, item.message_alignment, item.next_step, item.next_touch_at, item.next_touch_note, item.notes, research]);

  function queueUpdate(patch: Partial<typeof local>) {
    const next = { ...local, ...patch };
    setLocal(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(item.id, {
        fit_score: next.fit_score === '' ? null : Number(next.fit_score),
        fit_summary: next.fit_summary,
        message_alignment: next.message_alignment,
        next_step: next.next_step,
        next_touch_at: next.next_touch_at ? new Date(next.next_touch_at).toISOString() : null,
        next_touch_note: next.next_touch_note,
        notes: next.notes,
        research: {
          foundation_thesis: next.foundation_thesis,
          evidence_summary: next.evidence_summary,
          relationship_path: next.relationship_path,
          ask_shape: next.ask_shape,
          fit_status: next.fit_status,
          proof_status: next.proof_status,
          applicant_status: next.applicant_status,
          relationship_status: next.relationship_status,
          ask_status: next.ask_status,
          missing_items: next.missing_items_text
            .split('\n')
            .map((itemText) => itemText.trim())
            .filter(Boolean),
        },
      });
    }, 700);
  }

  async function addInteraction() {
    if (!interactionDraft.summary.trim()) return;
    const happenedAt = interactionDraft.happened_at
      ? new Date(interactionDraft.happened_at).toISOString()
      : new Date().toISOString();
    onUpdate(item.id, {
      new_interaction: {
        interaction_type: interactionDraft.interaction_type,
        summary: interactionDraft.summary.trim(),
        notes: interactionDraft.notes.trim() || null,
        happened_at: happenedAt,
        status_snapshot: interactionDraft.status_snapshot || null,
      },
    });
    setInteractionDraft({
      interaction_type: 'note',
      happened_at: new Date().toISOString().slice(0, 16),
      summary: '',
      notes: '',
      status_snapshot: '',
    });
  }

  return (
    <div className="border-2 border-bauhaus-black bg-white">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded((value) => !value)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
              {formatType(item.foundation.type)} · {formatMoney(item.foundation.total_giving_annual)}/yr
            </div>
            <div className="mt-1 text-lg font-black text-bauhaus-black">{item.foundation.name}</div>
            <div className="mt-2 text-xs font-medium text-bauhaus-muted">
              {focusLabel(item.foundation.thematic_focus)}
            </div>
            {item.fit_summary ? (
              <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted line-clamp-2">
                {item.fit_summary}
              </p>
            ) : null}
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
              Apply via {applicantEntityLabel(item.applicant_entity)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${stageTone(item.stage)}`}>
              {STAGES.find((stage) => stage.value === item.stage)?.label}
            </span>
            <span className={`border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${engagementTone(item.engagement_status)}`}>
              {ENGAGEMENT_STATUSES.find((status) => status.value === item.engagement_status)?.label ?? item.engagement_status}
            </span>
            {item.next_touch_at ? (
              <span className={`border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isDueNow(item.next_touch_at) ? 'border-bauhaus-red bg-bauhaus-red/5 text-bauhaus-red' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black'}`}>
                Next {new Date(item.next_touch_at).toLocaleDateString('en-AU')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="border-t-2 border-bauhaus-black/10 p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                Contact stage
              </label>
              <select
                value={item.engagement_status}
                onChange={(event) => onUpdate(item.id, { engagement_status: event.target.value as EngagementStatus })}
                className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
              >
                {ENGAGEMENT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <a
                href={`/foundations/${item.foundation_id}`}
                className="inline-flex border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Open profile
              </a>
            </div>
          </div>

          <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                  Contact Plan
                </div>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                  Keep this simple: why this philanthropist fits, how you would contact them, and what happens next.
                </p>
              </div>
              <span className={`border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${readiness.tone}`}>
                {readiness.label}
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Why they fit
                </label>
                <textarea
                  rows={3}
                  value={local.fit_summary}
                  onChange={(event) => queueUpdate({ fit_summary: event.target.value })}
                  placeholder="Why is this foundation a fit for this project?"
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  First contact
                </label>
                <textarea
                  rows={3}
                  value={local.message_alignment}
                  onChange={(event) => queueUpdate({ message_alignment: event.target.value })}
                  placeholder="What should the first contact say or lead with?"
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Next step
                </label>
                <textarea
                  rows={3}
                  value={local.next_step}
                  onChange={(event) => queueUpdate({ next_step: event.target.value })}
                  placeholder="What should happen next for this relationship?"
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Best way in
                </label>
                <textarea
                  rows={3}
                  value={local.relationship_path}
                  onChange={(event) => queueUpdate({ relationship_path: event.target.value })}
                  placeholder="Best route in, opener, or likely contact path."
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Next planned touch
                </label>
                <input
                  type="datetime-local"
                  value={local.next_touch_at}
                  onChange={(event) => queueUpdate({ next_touch_at: event.target.value })}
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Next touch note
                </label>
                <input
                  value={local.next_touch_note}
                  onChange={(event) => queueUpdate({ next_touch_note: event.target.value })}
                  placeholder="Short reminder for the next follow-up."
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="border-2 border-bauhaus-black/10 bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                  Last interaction
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {item.last_interaction_at
                    ? new Date(item.last_interaction_at).toLocaleString('en-AU')
                    : 'No interaction recorded yet.'}
                </p>
              </div>
              <div className="border-2 border-bauhaus-black/10 bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                  Follow-up rhythm
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {isDueNow(item.next_touch_at)
                    ? 'Follow-up is due now.'
                    : isUpcoming(item.next_touch_at)
                      ? 'Follow-up is scheduled soon.'
                      : isStale(item)
                        ? 'Relationship is stale and needs attention.'
                        : 'No active follow-up risk flagged.'}
                </p>
              </div>
            </div>
          </div>

          <details className="border-2 border-bauhaus-black/10 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              More detail
            </summary>
            <div className="space-y-4 border-t border-bauhaus-black/10 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                    Priority
                  </label>
                  <select
                    value={item.stage}
                    onChange={(event) => onUpdate(item.id, { stage: event.target.value as ProjectFoundationStage })}
                    className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                  >
                    {STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                    Apply as
                  </label>
                  <select
                    value={item.applicant_entity_id ?? ''}
                    onChange={(event) => {
                      const nextId = event.target.value || null;
                      const nextEntity = applicantEntities.find((entity) => entity.id === nextId) ?? null;
                      onUpdate(item.id, {
                        applicant_entity_id: nextId,
                        applicant_entity: nextEntity,
                      });
                    }}
                    className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                  >
                    <option value="">No applicant selected</option>
                    {applicantEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name}
                      </option>
                    ))}
                  </select>
                  {item.applicant_entity ? (
                    <div className="mt-2 text-xs font-medium text-bauhaus-muted">
                      {formatEntityType(item.applicant_entity.entity_type)}
                      {item.applicant_entity.status === 'pending' ? ' · Pending' : ''}
                      {item.applicant_entity.abn ? ` · ABN ${item.applicant_entity.abn}` : ''}
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Why they should care
                </label>
                <textarea
                  rows={3}
                  value={local.foundation_thesis}
                  onChange={(event) => queueUpdate({ foundation_thesis: event.target.value })}
                  placeholder="Why should this foundation care about this project right now?"
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Proof we already have
                </label>
                <textarea
                  rows={3}
                  value={local.evidence_summary}
                  onChange={(event) => queueUpdate({ evidence_summary: event.target.value })}
                  placeholder="What proof, documents, case studies, portfolio data, or quotes already support this pair?"
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Ask
                </label>
                <textarea
                  rows={3}
                  value={local.ask_shape}
                  onChange={(event) => queueUpdate({ ask_shape: event.target.value })}
                  placeholder="Operating support, pilot, infrastructure, fellowship, evidence layer, or partnership shape."
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Fit
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={local.fit_score}
                  onChange={(event) => queueUpdate({ fit_score: event.target.value })}
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-5">
                {(
                  [
                    ['fit_status', 'Fit'],
                    ['proof_status', 'Proof'],
                    ['applicant_status', 'Applicant'],
                    ['relationship_status', 'Relationship'],
                    ['ask_status', 'Ask'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                      {label}
                    </label>
                    <select
                      value={local[field]}
                      onChange={(event) => queueUpdate({ [field]: event.target.value as ResearchStatus })}
                      className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                    >
                      {RESEARCH_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Missing Pieces
                </label>
                <textarea
                  rows={4}
                  value={local.missing_items_text}
                  onChange={(event) => queueUpdate({ missing_items_text: event.target.value })}
                  placeholder="One missing item per line."
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Working Notes
                </label>
                <textarea
                  rows={3}
                  value={local.notes}
                  onChange={(event) => queueUpdate({ notes: event.target.value })}
                  placeholder="Internal notes."
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>
          </details>

          <div className="border-2 border-bauhaus-black bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                  Interaction log
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                  Record actual contact, meetings, proposals, and decisions so the engagement state has real evidence behind it.
                </p>
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                {interactions.length} entr{interactions.length === 1 ? 'y' : 'ies'}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[160px_180px_1fr]">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Type
                </label>
                <select
                  value={interactionDraft.interaction_type}
                  onChange={(event) =>
                    setInteractionDraft((draft) => ({ ...draft, interaction_type: event.target.value as InteractionType }))
                  }
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                >
                  {INTERACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Happened at
                </label>
                <input
                  type="datetime-local"
                  value={interactionDraft.happened_at}
                  onChange={(event) => setInteractionDraft((draft) => ({ ...draft, happened_at: event.target.value }))}
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Summary
                </label>
                <input
                  value={interactionDraft.summary}
                  onChange={(event) => setInteractionDraft((draft) => ({ ...draft, summary: event.target.value }))}
                  placeholder="Sent intro email to program lead..."
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            {interactionDraft.interaction_type === 'decision' ? (
              <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                    Decision outcome
                  </label>
                  <select
                    value={interactionDraft.status_snapshot}
                    onChange={(event) =>
                      setInteractionDraft((draft) => ({
                        ...draft,
                        status_snapshot: event.target.value as '' | EngagementStatus,
                      }))
                    }
                    className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                  >
                    <option value="">Keep current status</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="parked">Parked</option>
                  </select>
                </div>
                <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                    Decision rule
                  </div>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                    Use this when a foundation gives a clear outcome. The decision interaction will set the engagement
                    state to the selected result.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={interactionDraft.notes}
                  onChange={(event) => setInteractionDraft((draft) => ({ ...draft, notes: event.target.value }))}
                  placeholder="Who was involved, what was learned, what changed, what needs to happen next."
                  className="w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addInteraction}
                  className="inline-flex border-2 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-bauhaus-black"
                >
                  Add interaction
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {interactions.length === 0 ? (
                <div className="border-2 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-4 text-sm font-medium text-bauhaus-muted">
                  No interactions recorded yet.
                </div>
              ) : (
                interactions.map((interaction) => (
                  <div key={interaction.id} className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="border border-bauhaus-black/20 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black">
                            {INTERACTION_TYPES.find((type) => type.value === interaction.interaction_type)?.label ?? interaction.interaction_type}
                          </span>
                          {interaction.status_snapshot ? (
                            <span className={`border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${engagementTone(interaction.status_snapshot)}`}>
                              {ENGAGEMENT_STATUSES.find((status) => status.value === interaction.status_snapshot)?.label ?? interaction.status_snapshot}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm font-black text-bauhaus-black">{interaction.summary}</div>
                        {interaction.notes ? (
                          <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">{interaction.notes}</p>
                        ) : null}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                        {new Date(interaction.happened_at).toLocaleString('en-AU')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              Updated {new Date(item.updated_at).toLocaleDateString('en-AU')}
            </div>
            <button
              onClick={() => onRemove(item.id)}
              className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted transition-colors hover:text-bauhaus-red"
            >
              Remove from project
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function projectNameBrief(foundationName: string) {
  return `${foundationName} brief`;
}

function previewNote(note: string | null | undefined) {
  if (!note) return 'No pipeline note yet.';
  return note.length > 180 ? `${note.slice(0, 177)}…` : note;
}

export function ProjectFoundationsClient({
  orgProfileId,
  projectId,
  projectName,
}: {
  orgProfileId: string;
  projectId: string;
  projectName: string;
}) {
  const [items, setItems] = useState<ProjectFoundationRow[]>([]);
  const [applicantEntities, setApplicantEntities] = useState<ApplicantEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pipelineCandidates, setPipelineCandidates] = useState<PipelineFoundationCandidate[]>([]);
  const [importingPipeline, setImportingPipeline] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/org/${orgProfileId}/projects/${projectId}/foundations`)
      .then((response) => (response.ok ? response.json() : { items: [], applicant_entities: [], pipeline_candidates: [] }))
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data);
          setApplicantEntities([]);
          setPipelineCandidates([]);
          return;
        }
        if (data && Array.isArray(data.items)) setItems(data.items);
        if (data && Array.isArray(data.applicant_entities)) setApplicantEntities(data.applicant_entities);
        if (data && Array.isArray(data.pipeline_candidates)) setPipelineCandidates(data.pipeline_candidates);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgProfileId, projectId]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(() => {
      fetch(`/api/org/${orgProfileId}/projects/${projectId}/foundations?q=${encodeURIComponent(query.trim())}`)
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setResults(data);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
  }, [orgProfileId, projectId, query]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => (right.fit_score ?? -1) - (left.fit_score ?? -1)),
    [items],
  );

  const portfolioBoard = useMemo(() => {
    const outreachReady = sortedItems.filter((item) => strategyReadiness(firstResearch(item)).label === 'Ready now');
    const buildBeforeOutreach = sortedItems.filter(
      (item) => strategyReadiness(firstResearch(item)).label === 'Needs work',
    );
    const discoveryBrief = sortedItems.filter(
      (item) => strategyReadiness(firstResearch(item)).label === 'Early',
    );

    const needsRelationship = sortedItems.filter(
      (item) => (firstResearch(item)?.relationship_status ?? 'missing') !== 'ready',
    );
    const needsProof = sortedItems.filter((item) => (firstResearch(item)?.proof_status ?? 'missing') !== 'ready');
    const needsApplicant = sortedItems.filter(
      (item) => (firstResearch(item)?.applicant_status ?? 'missing') !== 'ready',
    );
    const needsAsk = sortedItems.filter((item) => (firstResearch(item)?.ask_status ?? 'missing') !== 'ready');
    const readyToApproach = sortedItems.filter((item) => item.engagement_status === 'ready_to_approach');
    const activeConversations = sortedItems.filter((item) =>
      ['approached', 'meeting', 'proposal'].includes(item.engagement_status),
    );
    const dueNow = sortedItems.filter((item) => isDueNow(item.next_touch_at));
    const upcoming = sortedItems.filter((item) => isUpcoming(item.next_touch_at));
    const stale = sortedItems.filter((item) => isStale(item));

    return {
      outreachReady,
      buildBeforeOutreach,
      discoveryBrief,
      needsRelationship,
      needsProof,
      needsApplicant,
      needsAsk,
      readyToApproach,
      activeConversations,
      dueNow,
      upcoming,
      stale,
    };
  }, [sortedItems]);
  const readyFoundationItems = [
    ...portfolioBoard.outreachReady,
    ...portfolioBoard.readyToApproach,
  ].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
  const pipelineCandidateNames = pipelineCandidates
    .slice(0, 3)
    .map((candidate) => candidate.foundation_name)
    .join(' · ');
  const readyNowCount = readyFoundationItems.length > 0 ? readyFoundationItems.length : pipelineCandidates.length;
  const readyNowSummary =
    readyFoundationItems.length > 0
      ? topNames(readyFoundationItems)
      : pipelineCandidates.length > 0
        ? `Pipeline prospect${pipelineCandidates.length === 1 ? '' : 's'} waiting to import: ${pipelineCandidateNames}`
        : 'No strong contact targets yet.';

  async function addFoundation(foundation: FoundationSearchResult) {
    const response = await fetch(`/api/org/${orgProfileId}/projects/${projectId}/foundations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foundation_id: foundation.id, applicant_entity_id: applicantEntities.find((entity) => entity.is_default)?.id ?? null }),
    });

    if (!response.ok) return;
    const created = await response.json();
    setItems((prev) => [created, ...prev.filter((item) => item.foundation_id !== foundation.id)]);
    setQuery('');
    setResults([]);
  }

  async function importPipelineCandidates() {
    try {
      setImportingPipeline(true);
      setImportMessage(null);
      const response = await fetch(`/api/org/${orgProfileId}/projects/${projectId}/foundations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_pipeline_candidates: true,
          applicant_entity_id: applicantEntities.find((entity) => entity.is_default)?.id ?? null,
        }),
      });

      if (!response.ok) {
        setImportMessage('Pipeline import failed.');
        return;
      }

      const data = await response.json();
      if (data && Array.isArray(data.items)) setItems(data.items);
      if (data && Array.isArray(data.applicant_entities)) setApplicantEntities(data.applicant_entities);
      if (data && Array.isArray(data.pipeline_candidates)) setPipelineCandidates(data.pipeline_candidates);

      if (typeof data?.imported_count === 'number') {
        setImportMessage(
          data.imported_count > 0
            ? `Imported ${data.imported_count} pipeline foundation prospect${data.imported_count === 1 ? '' : 's'}.`
            : 'No matched pipeline foundation prospects to import.'
        );
      }
    } catch {
      setImportMessage('Pipeline import failed.');
    } finally {
      setImportingPipeline(false);
    }
  }

  async function updateFoundation(id: string, updates: ProjectFoundationUpdate) {
    const { new_interaction: newInteraction, research, ...rowUpdates } = updates;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextResearch =
          research === undefined
            ? item.research
            : [
                {
                  id: item.research?.[0]?.id ?? '',
                  foundation_thesis: research.foundation_thesis ?? item.research?.[0]?.foundation_thesis ?? null,
                  evidence_summary: research.evidence_summary ?? item.research?.[0]?.evidence_summary ?? null,
                  relationship_path: research.relationship_path ?? item.research?.[0]?.relationship_path ?? null,
                  ask_shape: research.ask_shape ?? item.research?.[0]?.ask_shape ?? null,
                  fit_status: research.fit_status ?? item.research?.[0]?.fit_status ?? 'missing',
                  proof_status: research.proof_status ?? item.research?.[0]?.proof_status ?? 'missing',
                  applicant_status: research.applicant_status ?? item.research?.[0]?.applicant_status ?? 'missing',
                  relationship_status: research.relationship_status ?? item.research?.[0]?.relationship_status ?? 'missing',
                  ask_status: research.ask_status ?? item.research?.[0]?.ask_status ?? 'missing',
                  missing_items: research.missing_items ?? item.research?.[0]?.missing_items ?? [],
                  updated_at: new Date().toISOString(),
                },
              ];
        const nextInteractions =
          newInteraction === undefined
            ? item.interactions
            : [
                {
                  id: `draft-${Date.now()}`,
                  interaction_type: newInteraction.interaction_type,
                  summary: newInteraction.summary,
                  notes: newInteraction.notes ?? null,
                  happened_at: newInteraction.happened_at,
                  status_snapshot: newInteraction.status_snapshot ?? item.engagement_status,
                  created_at: new Date().toISOString(),
                },
                ...(item.interactions ?? []),
              ];

        return {
          ...item,
          ...rowUpdates,
          research: nextResearch,
          interactions: nextInteractions,
          last_interaction_at: newInteraction?.happened_at ?? item.last_interaction_at,
          updated_at: new Date().toISOString(),
        };
      }),
    );

    await fetch(`/api/org/${orgProfileId}/projects/${projectId}/foundations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(() => {});
  }

  async function removeFoundation(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/org/${orgProfileId}/projects/${projectId}/foundations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  return (
    <section className="border-4 border-bauhaus-black bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-red">
            Foundation Contacts
          </div>
          <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-bauhaus-black">
            Philanthropy lane for {projectName}
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            Save likely foundations, decide why they fit, and track the next move.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pipelineCandidates.length > 0 ? (
            <button
              type="button"
              onClick={() => void importPipelineCandidates()}
              disabled={importingPipeline}
              className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importingPipeline ? 'Importing…' : `Import ${pipelineCandidates.length} pipeline prospects`}
            </button>
          ) : null}
          <a
            href="/foundations"
            className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Browse directory
          </a>
        </div>
      </div>

      {importMessage ? (
        <div className="mt-3 border-2 border-bauhaus-black/10 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-bauhaus-muted">
          {importMessage}
        </div>
      ) : null}

      {pipelineCandidates.length > 0 ? (
        <details className="mt-4 border-2 border-bauhaus-blue/20 bg-link-light/40 p-3">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">
                  Pipeline-Matched Foundation Prospects
                </div>
                <div className="mt-1 text-sm font-medium text-bauhaus-muted">
                  {pipelineCandidates.length} waiting to import from pipeline
                </div>
              </div>
              <span className="border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">
                Expand
              </span>
            </div>
          </summary>

          <div className="mt-3 grid gap-3">
            {pipelineCandidates.slice(0, 4).map((candidate) => (
              <div key={candidate.pipeline_id} className="border-2 border-bauhaus-black/10 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                      {candidate.status || 'Prospect'} · {candidate.funder || candidate.foundation_name}
                    </div>
                    <div className="mt-1 text-sm font-black text-bauhaus-black">{candidate.foundation_name}</div>
                    <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                      {previewNote(candidate.notes)}
                    </p>
                  </div>
                  <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                    {candidate.name}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pipelineCandidates.length > 4 ? (
            <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-bauhaus-muted">
              Plus {pipelineCandidates.length - 4} more matched pipeline prospect{pipelineCandidates.length - 4 === 1 ? '' : 's'}.
            </div>
          ) : null}
        </details>
      ) : null}

      <div className="mt-5 border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
        <div className="mb-3 grid gap-3">
          <div className="border-2 border-bauhaus-black bg-white p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
              Contact board
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              Best next foundation moves for {projectName}.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="border-2 border-money bg-money-light p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">
                  Ready now
                </div>
                <div className="mt-2 text-2xl font-black text-money">
                  {readyNowCount}
                </div>
                <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {readyNowSummary}
                </p>
              </div>
              <div className="border-2 border-bauhaus-blue bg-link-light p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">
                  Active now
                </div>
                <div className="mt-2 text-2xl font-black text-bauhaus-blue">{portfolioBoard.activeConversations.length}</div>
                <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {portfolioBoard.activeConversations.length > 0
                    ? topNames(portfolioBoard.activeConversations)
                    : 'No active conversations yet.'}
                </p>
              </div>
              <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                  Next up
                </div>
                <div className="mt-2 text-2xl font-black text-bauhaus-red">
                  {portfolioBoard.dueNow.length + portfolioBoard.upcoming.length}
                </div>
                <p className="mt-2 line-clamp-3 text-sm font-medium leading-relaxed text-bauhaus-black">
                  {portfolioBoard.dueNow.length + portfolioBoard.upcoming.length > 0
                    ? topNames(
                        [...portfolioBoard.dueNow, ...portfolioBoard.upcoming].filter(
                          (item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index,
                        ),
                      )
                    : 'No follow-ups scheduled right now.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <details className="mb-4 border-2 border-bauhaus-black/10 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
            What still needs work
          </summary>
          <div className="grid gap-3 border-t border-bauhaus-black/10 p-4 md:grid-cols-2">
            <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                Need intro path
              </div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{portfolioBoard.needsRelationship.length}</div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                {portfolioBoard.needsRelationship.length > 0
                  ? topNames(portfolioBoard.needsRelationship)
                  : 'All saved pairs have a clear way in.'}
              </p>
            </div>
            <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                Stale relationships
              </div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{portfolioBoard.stale.length}</div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                {portfolioBoard.stale.length > 0
                  ? topNames(portfolioBoard.stale)
                  : 'No active relationships are stale.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Need proof</div>
                <div className="mt-2 text-2xl font-black text-bauhaus-black">{portfolioBoard.needsProof.length}</div>
              </div>
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Need vehicle</div>
                <div className="mt-2 text-2xl font-black text-bauhaus-black">{portfolioBoard.needsApplicant.length}</div>
              </div>
              <div className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Need ask</div>
                <div className="mt-2 text-2xl font-black text-bauhaus-black">{portfolioBoard.needsAsk.length}</div>
              </div>
            </div>
          </div>
        </details>

        <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted mb-2">
          Add philanthropist to this project
        </label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search philanthropists or foundations by name..."
          className="w-full border-2 border-bauhaus-black bg-white px-3 py-3 text-sm font-medium focus:outline-none"
        />
        {query.trim().length >= 2 ? (
          <div className="mt-3 border-2 border-bauhaus-black bg-white">
            {searching ? (
              <div className="px-3 py-3 text-xs font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                Searching foundations...
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-bauhaus-black/10">
                {results.map((foundation) => (
                  <button
                    key={foundation.id}
                    onClick={() => addFoundation(foundation)}
                    className="w-full px-3 py-3 text-left transition-colors hover:bg-bauhaus-yellow"
                  >
                    <div className="text-sm font-black text-bauhaus-black">{foundation.name}</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-bauhaus-muted">
                      {formatType(foundation.type)} · {formatMoney(foundation.total_giving_annual)}/yr
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-xs font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                No foundations found.
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4">
        {loading ? (
          <div className="border-2 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-4 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
            Loading project foundations...
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="border-2 border-dashed border-bauhaus-black/20 bg-bauhaus-canvas p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              {pipelineCandidates.length > 0
                ? `${pipelineCandidates.length} pipeline-matched foundation prospect${pipelineCandidates.length === 1 ? '' : 's'} waiting to import.`
                : 'No saved foundations for this project yet.'}
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
              {pipelineCandidates.length > 0
                ? 'Use Import pipeline prospects above to seed this board, then record why each funder fits, the relationship path, and the next move.'
                : 'Start with one or two foundations you think are the best fit, then write down why, how to frame the work, and what the next move should be.'}
            </p>
          </div>
        ) : (
          sortedItems.map((item) => (
            <FoundationCard
              key={item.id}
              item={item}
              applicantEntities={applicantEntities}
              onUpdate={updateFoundation}
              onRemove={removeFoundation}
            />
          ))
        )}
      </div>
    </section>
  );
}
