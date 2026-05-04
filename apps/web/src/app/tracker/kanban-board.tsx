'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import type { SavedGrantRow } from './page';
import { KanbanCard } from './kanban-card';
import { TrackerFilters, type Filters } from './tracker-filters';

const ACTIVE_STAGES = [
  'discovered',
  'researching',
  'pursuing',
  'submitted',
  'negotiating',
  'approved',
] as const;

const TERMINAL_STAGES = ['realized', 'lost', 'expired'] as const;

const STAGE_LABELS: Record<string, string> = {
  discovered: 'Discovered',
  researching: 'Researching',
  pursuing: 'Pursuing',
  submitted: 'Submitted',
  negotiating: 'Negotiating',
  approved: 'Approved',
  realized: 'Realized',
  lost: 'Lost',
  expired: 'Expired',
};

function applyFilters(grants: SavedGrantRow[], filters: Filters): SavedGrantRow[] {
  return grants.filter((g) => {
    if (filters.minStars > 0 && g.stars < filters.minStars) return false;
    if (filters.color && g.color !== filters.color) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !g.grant.name.toLowerCase().includes(q) &&
        !g.grant.provider.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}

export function KanbanBoard({
  grants,
  onGrantsChange,
  learningHiddenGrantIds,
  learningHiddenCount = 0,
}: {
  grants: SavedGrantRow[];
  onGrantsChange: (grants: SavedGrantRow[]) => void;
  learningHiddenGrantIds?: Set<string>;
  learningHiddenCount?: number;
}) {
  const [filters, setFilters] = useState<Filters>({ minStars: 0, color: null, search: '', sortByDeadline: false });
  const [showArchive, setShowArchive] = useState(false);
  const [showLearningHidden, setShowLearningHidden] = useState(false);

  const gateFilteredGrants = showLearningHidden
    ? grants
    : grants.filter((grant) => {
      if (grant.stage !== 'discovered') return true;
      return !learningHiddenGrantIds?.has(grant.grant_id);
    });
  const filtered = applyFilters(gateFilteredGrants, filters);

  const byStage = (stage: string) => {
    const stageGrants = filtered.filter((g) => g.stage === stage);
    if (filters.sortByDeadline) {
      stageGrants.sort((a, b) => {
        const aDate = a.grant.closes_at ? new Date(a.grant.closes_at).getTime() : Infinity;
        const bDate = b.grant.closes_at ? new Date(b.grant.closes_at).getTime() : Infinity;
        return aDate - bDate;
      });
    }
    return stageGrants;
  };

  const handleRemove = useCallback(
    (grantId: string) => {
      const previousGrants = grants;
      onGrantsChange(previousGrants.filter((g) => g.grant_id !== grantId));
      fetch(`/api/tracker/${grantId}`, { method: 'DELETE' }).catch(() => {
        onGrantsChange(previousGrants);
      });
    },
    [grants, onGrantsChange]
  );

  const handleNoGo = useCallback(
    (grantId: string) => {
      const previousGrants = grants;
      const now = new Date().toISOString();
      const nextGrants = previousGrants.map((g) =>
        g.grant_id === grantId ? { ...g, stage: 'lost', updated_at: now } : g
      );

      onGrantsChange(nextGrants);

      fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'lost' }),
      }).catch(() => {
        onGrantsChange(previousGrants);
      });
    },
    [grants, onGrantsChange]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const newStage = result.destination.droppableId;
      const grantId = result.draggableId;
      const previousGrants = grants;
      const nextGrants = previousGrants.map((g) =>
        g.grant_id === grantId
          ? { ...g, stage: newStage, updated_at: new Date().toISOString() }
          : g
      );

      // Optimistic update
      onGrantsChange(nextGrants);

      // Persist
      fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      }).catch(() => {
        // Revert on error
        onGrantsChange(previousGrants);
      });
    },
    [grants, onGrantsChange]
  );

  return (
    <div>
      {learningHiddenCount > 0 && (
        <div className="mb-4 flex flex-col gap-3 border-4 border-bauhaus-black bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-red">
              Noise hidden
            </div>
            <p className="mt-1 text-sm font-medium leading-5 text-bauhaus-muted">
              {learningHiddenCount.toLocaleString()} weak or cleanup records are hidden so this board stays usable. Active work and urgent deadlines stay visible.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLearningHidden((value) => !value)}
            className="min-h-10 shrink-0 border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            {showLearningHidden ? 'Hide noise' : 'Show all'}
          </button>
        </div>
      )}

      <TrackerFilters filters={filters} onChange={setFilters} />

      {grants.length === 0 ? (
        <div className="border-4 border-dashed border-bauhaus-black/20 bg-white p-8 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-red">
            Step 3 Needs A Shortlist
          </div>
          <div className="mt-2 text-lg font-black text-bauhaus-black uppercase tracking-tight">
            No tracked grants yet
          </div>
          <p className="mt-2 text-sm text-bauhaus-muted font-medium max-w-xl mx-auto">
            Start with your matched grants if you want the fastest path, or browse the full grants index if you are still exploring.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/profile/matches"
              className="px-4 py-3 border-3 border-bauhaus-black text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Open Matched Grants
            </Link>
            <Link
              href="/grants"
              className="px-4 py-3 border-3 border-bauhaus-blue text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors"
            >
              Browse All Grants
            </Link>
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Active stage columns */}
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ACTIVE_STAGES.map((stage) => (
              <Droppable key={stage} droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-shrink-0 w-64 min-h-[200px] ${
                      snapshot.isDraggingOver ? 'bg-bauhaus-yellow/10' : 'bg-bauhaus-canvas'
                    }`}
                  >
                    <div className="bg-bauhaus-black px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-black text-white uppercase tracking-widest">
                        {STAGE_LABELS[stage]}
                      </span>
                      <span className="text-xs font-bold text-bauhaus-muted tabular-nums">
                        {byStage(stage).length}
                      </span>
                    </div>
                    <div className="p-2 space-y-2">
                      {byStage(stage).map((g, i) => (
                        <KanbanCard
                          key={g.grant_id}
                          grant={g}
                          index={i}
                          onRemove={handleRemove}
                          onNoGo={handleNoGo}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>

          {/* Terminal stages */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowArchive((value) => !value)}
              className="border-2 border-bauhaus-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted transition-colors hover:border-bauhaus-black hover:text-bauhaus-black"
            >
              {showArchive ? 'Hide closed grants' : `Show closed grants (${TERMINAL_STAGES.reduce((sum, stage) => sum + byStage(stage).length, 0)})`}
            </button>

            {showArchive && (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                {TERMINAL_STAGES.map((stage) => (
                  <Droppable key={stage} droppableId={stage}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[80px] border-4 border-dashed ${
                          snapshot.isDraggingOver
                            ? 'border-bauhaus-black bg-bauhaus-yellow/10'
                            : 'border-bauhaus-black/20'
                        }`}
                      >
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">
                            {STAGE_LABELS[stage]}
                          </span>
                          <span className="text-xs font-bold text-bauhaus-muted tabular-nums">
                            {byStage(stage).length}
                          </span>
                        </div>
                        <div className="px-2 pb-2 space-y-2">
                          {byStage(stage).map((g, i) => (
                            <KanbanCard key={g.grant_id} grant={g} index={i} onRemove={handleRemove} />
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            )}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
