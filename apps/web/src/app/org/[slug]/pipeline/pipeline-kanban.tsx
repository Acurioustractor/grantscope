'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { SlidePanel, SlidePanelBody, SlidePanelHeader } from '@/app/components/slide-panel';
import { FunderDossier, type FunderContext } from '@/app/ops/grant-recommendations/funder-dossier';
import { FunderTimeline } from '@/app/ops/grant-recommendations/funder-timeline';
import {
  PIPELINE_COLUMNS,
  type OrgPipelineCard,
  type OrgPipelineProject,
  type PipelineColumn,
} from '@/lib/services/org-pipeline-service';

const COLUMN_LABELS: Record<PipelineColumn, string> = {
  discovered: 'Discovered',
  watching: 'Watching',
  pursuing: 'Pursuing',
  applied: 'Applied',
  submitted: 'Submitted',
  won: 'Won',
  lost: 'Lost',
  passed: 'Passed',
};

const COLUMN_ACCENT: Record<PipelineColumn, string> = {
  discovered: 'bg-bauhaus-black text-white',
  watching: 'bg-bauhaus-yellow text-bauhaus-black',
  pursuing: 'bg-bauhaus-blue text-white',
  applied: 'bg-bauhaus-blue text-white',
  submitted: 'bg-bauhaus-blue text-white',
  won: 'bg-green-600 text-white',
  lost: 'bg-bauhaus-red text-white',
  passed: 'bg-gray-400 text-white',
};

const TEMPERATURE_CLASS: Record<OrgPipelineCard['temperature'], string> = {
  WARM: 'bg-green-600 text-white',
  TEPID: 'bg-bauhaus-yellow text-bauhaus-black',
  LIGHT: 'bg-gray-300 text-bauhaus-black',
  COLD: 'bg-gray-200 text-bauhaus-muted',
};

const FLAG_LABELS: Record<string, { text: string; classes: string }> = {
  requires_dgr: { text: 'DGR req.', classes: 'bg-bauhaus-red text-white' },
  partner_required: { text: 'Partner req.', classes: 'bg-bauhaus-yellow text-bauhaus-black' },
  tight_deadline: { text: 'Tight', classes: 'bg-bauhaus-red text-white' },
  national: { text: 'National', classes: 'bg-bauhaus-blue text-white' },
  large_grant: { text: 'Large $', classes: 'bg-green-600 text-white' },
  small_grant: { text: 'Small $', classes: 'bg-gray-300 text-bauhaus-black' },
};

function formatAmount(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (max != null) return `≤ $${max.toLocaleString()}`;
  if (min != null) return `≥ $${min.toLocaleString()}`;
  return '—';
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'Rolling';
  const d = new Date(deadline);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  if (days < 0) return `${dateStr} (past)`;
  if (days === 0) return `${dateStr} (today)`;
  if (days < 14) return `${dateStr} (${days}d)`;
  return dateStr;
}

function deadlineUrgency(deadline: string | null): 'past' | 'tight' | 'soon' | 'normal' | 'rolling' {
  if (!deadline) return 'rolling';
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'past';
  if (days <= 14) return 'tight';
  if (days <= 45) return 'soon';
  return 'normal';
}

export function OrgPipelineKanban({
  slug,
  cards: initialCards,
  projects,
  contexts,
  discoveredMinScore,
}: {
  slug: string;
  cards: OrgPipelineCard[];
  projects: OrgPipelineProject[];
  contexts: FunderContext[];
  discoveredMinScore: number;
}) {
  void slug;
  const contextByFunder = useMemo(() => {
    const m = new Map<string, FunderContext>();
    for (const c of contexts) {
      m.set(c.funder_name, c);
      for (const alias of c.funder_aliases ?? []) m.set(alias, c);
    }
    return m;
  }, [contexts]);

  const [cards, setCards] = useState<OrgPipelineCard[]>(initialCards);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [strongOnly, setStrongOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<PipelineColumn>>(() => new Set(['lost', 'passed']));

  const previewCard = useMemo(
    () => (previewKey ? cards.find((c) => c.key === previewKey) ?? null : null),
    [cards, previewKey],
  );

  const search = searchQuery.trim().toLowerCase();
  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (projectFilter !== 'all') {
        if (c.project_code !== projectFilter && !c.also_fits_projects.includes(projectFilter)) {
          return false;
        }
      }
      if (strongOnly && !c.is_strong_fit) return false;
      if (search) {
        const hay = `${c.opportunity_name} ${c.funder_name ?? ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [cards, projectFilter, strongOnly, search]);

  const cardsByColumn = useMemo(() => {
    const m = new Map<PipelineColumn, OrgPipelineCard[]>();
    for (const col of PIPELINE_COLUMNS) m.set(col, []);
    for (const c of filteredCards) {
      m.get(c.decision)!.push(c);
    }
    // Within each column: strong fits first, then by fit_score, then by deadline.
    for (const list of m.values()) {
      list.sort((a, b) => {
        if (a.is_strong_fit !== b.is_strong_fit) return a.is_strong_fit ? -1 : 1;
        if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
        const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return ad - bd;
      });
    }
    return m;
  }, [filteredCards]);

  const visibleColumns = PIPELINE_COLUMNS.filter((c) => !hiddenColumns.has(c));

  const toggleColumn = useCallback((col: PipelineColumn) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setError(null);
      if (!result.destination) return;
      const next = result.destination.droppableId as PipelineColumn;
      const cardKey = result.draggableId;
      const card = cards.find((c) => c.key === cardKey);
      if (!card) return;
      if (card.decision === next) return;
      if (!PIPELINE_COLUMNS.includes(next)) return;

      const previous = cards;
      const nowIso = new Date().toISOString();
      setCards(previous.map((c) =>
        c.key === cardKey
          ? { ...c, decision: next, decided_at: nowIso }
          : c,
      ));
      setPendingKey(cardKey);

      if (next === 'discovered') {
        // No API for "undo to discovered" — surface an inline note and revert.
        // (Drag back to Discovered isn't a supported decision on the server.)
        setError('Cannot move back to Discovered — Discovered is the undecided state.');
        setCards(previous);
        setPendingKey(null);
        return;
      }

      fetch('/api/ops/grant-recommendations/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_code: card.project_code,
          opportunity_id: card.opportunity_id,
          decision: next,
        }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const text = await r.text();
            throw new Error(text);
          }
          return r.json();
        })
        .then((body: { decision: { grant_opportunity_id?: string | null } }) => {
          setCards((current) =>
            current.map((c) =>
              c.key === cardKey
                ? {
                    ...c,
                    grant_opportunity_id: body.decision?.grant_opportunity_id ?? c.grant_opportunity_id,
                  }
                : c,
            ),
          );
        })
        .catch((err) => {
          console.error('decision failed', err);
          setError(`Decision write failed: ${(err as Error).message}`);
          setCards(previous);
        })
        .finally(() => setPendingKey(null));
    },
    [cards],
  );

  const setDecisionFromPanel = useCallback(
    (card: OrgPipelineCard, decision: PipelineColumn) => {
      handleDragEnd({
        draggableId: card.key,
        type: 'DEFAULT',
        source: { droppableId: card.decision, index: 0 },
        destination: { droppableId: decision, index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null,
      } as DropResult);
    },
    [handleDragEnd],
  );

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 border-4 border-bauhaus-black bg-bauhaus-canvas p-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search name or funder…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[220px] border-2 border-bauhaus-black bg-white px-3 py-1.5 text-sm font-mono placeholder:text-bauhaus-muted"
        />
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest">Project</label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="border-2 border-bauhaus-black bg-white px-2 py-1 text-xs font-mono"
          >
            <option value="all">All ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.project_code} value={p.project_code}>
                {p.project_code}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest cursor-pointer">
          <input
            type="checkbox"
            checked={strongOnly}
            onChange={(e) => setStrongOnly(e.target.checked)}
            className="w-4 h-4 border-2 border-bauhaus-black"
          />
          Strong fits only
        </label>
        <div className="text-[10px] font-mono text-bauhaus-muted ml-auto">
          {filteredCards.length} of {cards.length} cards · discovered ≥ {discoveredMinScore}
        </div>
      </div>

      {/* Column visibility chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mr-1">
          Columns:
        </span>
        {PIPELINE_COLUMNS.map((col) => {
          const active = !hiddenColumns.has(col);
          const count = cardsByColumn.get(col)?.length ?? 0;
          return (
            <button
              key={col}
              type="button"
              onClick={() => toggleColumn(col)}
              className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-colors ${
                active
                  ? `${COLUMN_ACCENT[col]} border-bauhaus-black`
                  : 'border-bauhaus-black bg-white text-bauhaus-muted hover:bg-bauhaus-canvas'
              }`}
              title={active ? `Hide ${COLUMN_LABELS[col]}` : `Show ${COLUMN_LABELS[col]}`}
            >
              {COLUMN_LABELS[col]} <span className="font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-3 border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-xs font-mono text-bauhaus-red">
          {error}
        </div>
      )}

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-6">
          {visibleColumns.map((col) => {
            const colCards = cardsByColumn.get(col) ?? [];
            return (
              <Droppable key={col} droppableId={col}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-shrink-0 w-72 min-h-[400px] border-4 border-bauhaus-black ${
                      snapshot.isDraggingOver ? 'bg-bauhaus-yellow/10' : 'bg-bauhaus-canvas'
                    }`}
                  >
                    <div className={`${COLUMN_ACCENT[col]} px-3 py-2 flex items-center justify-between border-b-4 border-bauhaus-black`}>
                      <span className="text-xs font-black uppercase tracking-widest">
                        {COLUMN_LABELS[col]}
                      </span>
                      <span className="text-xs font-bold tabular-nums">
                        {colCards.length}
                      </span>
                    </div>
                    <div className="p-2 space-y-2">
                      {colCards.length === 0 && (
                        <div className="text-[10px] font-mono text-bauhaus-muted italic px-1 py-3 text-center">
                          {col === 'discovered'
                            ? 'No undecided opportunities meet the score floor.'
                            : `Drag cards here to mark ${COLUMN_LABELS[col]}.`}
                        </div>
                      )}
                      {colCards.map((card, idx) => (
                        <Draggable key={card.key} draggableId={card.key} index={idx}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`border-2 bg-white p-2 transition-colors ${
                                dragSnapshot.isDragging
                                  ? 'border-bauhaus-red shadow-lg'
                                  : 'border-bauhaus-black'
                              } ${pendingKey === card.key ? 'opacity-50' : ''}`}
                              onClick={(e) => {
                                if (dragSnapshot.isDragging) return;
                                // Don't fire on accidental drag-clicks
                                if ((e.target as HTMLElement).closest('a')) return;
                                setPreviewKey(card.key);
                              }}
                            >
                              <div className="flex items-start gap-1 flex-wrap mb-1">
                                <span
                                  className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${TEMPERATURE_CLASS[card.temperature]}`}
                                  title={card.relationship_score != null ? `Relationship score ${card.relationship_score}` : 'No funder context'}
                                >
                                  {card.temperature}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider tabular-nums ${
                                    card.is_strong_fit
                                      ? 'bg-bauhaus-black text-white'
                                      : card.fit_score >= 55
                                        ? 'bg-bauhaus-blue text-white'
                                        : 'bg-gray-200 text-bauhaus-black'
                                  }`}
                                >
                                  Fit {card.fit_score}
                                </span>
                                {(() => {
                                  const u = deadlineUrgency(card.deadline);
                                  if (u === 'past') return <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-gray-400 text-white">PAST</span>;
                                  if (u === 'tight') return <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-bauhaus-red text-white">TIGHT</span>;
                                  if (u === 'soon') return <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-bauhaus-yellow text-bauhaus-black">SOON</span>;
                                  return null;
                                })()}
                              </div>

                              <div className="text-sm font-black text-bauhaus-black leading-snug line-clamp-2">
                                {card.opportunity_name}
                              </div>
                              <div className="text-[11px] text-bauhaus-muted line-clamp-1 mt-0.5">
                                {card.funder_name ?? 'Unknown funder'}
                              </div>

                              <div className="flex items-center justify-between mt-2 text-[10px] font-mono">
                                <span className="text-bauhaus-black">
                                  {formatDeadline(card.deadline)}
                                </span>
                                <span className="text-bauhaus-muted">
                                  {formatAmount(card.min_grant_amount, card.max_grant_amount)}
                                </span>
                              </div>

                              <div className="flex gap-0.5 flex-wrap mt-1.5">
                                <span
                                  className="px-1 py-0.5 text-[8px] font-black uppercase tracking-wider border-2 border-bauhaus-black bg-bauhaus-black text-white"
                                  title="Best-fit project"
                                >
                                  {card.project_code}
                                </span>
                                {card.also_fits_projects.slice(0, 3).map((pc) => (
                                  <span
                                    key={pc}
                                    className="px-1 py-0.5 text-[8px] font-black uppercase tracking-wider border border-bauhaus-black/40 text-bauhaus-muted"
                                    title="Also fits"
                                  >
                                    {pc}
                                  </span>
                                ))}
                                {card.also_fits_projects.length > 3 && (
                                  <span className="px-1 py-0.5 text-[8px] font-mono text-bauhaus-muted">
                                    +{card.also_fits_projects.length - 3}
                                  </span>
                                )}
                              </div>

                              {card.grant_opportunity_id && (
                                <div className="mt-1.5 text-[9px] font-mono text-bauhaus-blue">
                                  ↗ in /tracker
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      <SlidePanel open={previewCard !== null} onClose={() => setPreviewKey(null)} width={520}>
        {previewCard && (
          <>
            <SlidePanelHeader
              onClose={() => setPreviewKey(null)}
              href={previewCard.grant_opportunity_id ? `/grants/${previewCard.grant_opportunity_id}` : undefined}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${COLUMN_ACCENT[previewCard.decision]}`}>
                  {COLUMN_LABELS[previewCard.decision]}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${TEMPERATURE_CLASS[previewCard.temperature]}`}>
                  {previewCard.temperature}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  {previewCard.project_code}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    previewCard.fit_score >= 80
                      ? 'bg-green-600 text-white'
                      : previewCard.fit_score >= 60
                        ? 'bg-bauhaus-yellow text-bauhaus-black'
                        : 'bg-gray-200 text-bauhaus-black'
                  }`}
                >
                  Fit {previewCard.fit_score}
                </span>
              </div>
              <h2 className="mt-1 text-base font-black text-bauhaus-black leading-tight">
                {previewCard.opportunity_name}
              </h2>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-5 text-sm">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                    Funder
                  </div>
                  <div className="font-medium mb-2">{previewCard.funder_name ?? '—'}</div>
                  {previewCard.funder_name && (
                    <>
                      <FunderDossier context={contextByFunder.get(previewCard.funder_name) ?? null} />
                      <div className="mt-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                          History (all-time timeline)
                        </div>
                        <FunderTimeline funderName={previewCard.funder_name} />
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                      Deadline
                    </div>
                    <div className="font-mono">{formatDeadline(previewCard.deadline)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
                      Amount
                    </div>
                    <div className="font-mono">
                      {formatAmount(previewCard.min_grant_amount, previewCard.max_grant_amount)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                    Fit breakdown · {previewCard.fit_score}/100
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Theme', value: previewCard.theme_score, max: 50 },
                      { label: 'Geo', value: previewCard.geography_score, max: 15 },
                      { label: 'Elig', value: previewCard.eligibility_score, max: 20 },
                      { label: 'Timing', value: previewCard.timing_score, max: 15 },
                    ].map((d) => (
                      <div key={d.label} className="border-2 border-bauhaus-black p-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">
                          {d.label}
                        </div>
                        <div className="text-lg font-black tabular-nums">
                          {d.value}
                          <span className="text-[10px] font-mono text-bauhaus-muted ml-0.5">/{d.max}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {previewCard.flags && previewCard.flags.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                      Flags
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {previewCard.flags.map((f) => {
                        const lab = FLAG_LABELS[f] ?? { text: f, classes: 'bg-gray-200 text-bauhaus-black' };
                        return (
                          <span
                            key={f}
                            className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${lab.classes}`}
                          >
                            {lab.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {previewCard.also_fits_projects.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                      Also fits
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {previewCard.also_fits_projects.map((pc) => (
                        <span
                          key={pc}
                          className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black bg-white"
                        >
                          {pc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap pt-2 border-t-2 border-bauhaus-black/20">
                  {previewCard.source_url && (
                    <a
                      href={previewCard.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white hover:bg-bauhaus-canvas"
                    >
                      Funder page ↗
                    </a>
                  )}
                  {previewCard.application_url && previewCard.application_url !== previewCard.source_url && (
                    <a
                      href={previewCard.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white hover:bg-bauhaus-canvas"
                    >
                      Apply form ↗
                    </a>
                  )}
                  {previewCard.grant_opportunity_id && (
                    <Link
                      href="/tracker"
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                    >
                      Open in /tracker
                    </Link>
                  )}
                </div>

                <div className="pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">
                    Move to
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {PIPELINE_COLUMNS.filter((c) => c !== 'discovered' && c !== previewCard.decision).map((col) => (
                      <button
                        key={col}
                        onClick={() => setDecisionFromPanel(previewCard, col)}
                        disabled={pendingKey === previewCard.key}
                        className={`px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${COLUMN_ACCENT[col]} hover:bg-bauhaus-black hover:text-white disabled:opacity-50`}
                      >
                        {COLUMN_LABELS[col]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>
    </div>
  );
}
