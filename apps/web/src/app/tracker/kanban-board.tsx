'use client';

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

export function KanbanBoard({ initialGrants }: { initialGrants: SavedGrantRow[] }) {
  const [grants, setGrants] = useState(initialGrants);
  const [filters, setFilters] = useState<Filters>({ minStars: 0, color: null, search: '', sortByDeadline: false });

  const filtered = applyFilters(grants, filters);

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
      setGrants((prev) => prev.filter((g) => g.grant_id !== grantId));
      fetch(`/api/tracker/${grantId}`, { method: 'DELETE' }).catch(() => {
        setGrants(initialGrants);
      });
    },
    [initialGrants]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const newStage = result.destination.droppableId;
      const grantId = result.draggableId;

      // Optimistic update
      setGrants((prev) =>
        prev.map((g) =>
          g.grant_id === grantId
            ? { ...g, stage: newStage, updated_at: new Date().toISOString() }
            : g
        )
      );

      // Persist
      fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      }).catch(() => {
        // Revert on error
        setGrants(initialGrants);
      });
    },
    [initialGrants]
  );

  return (
    <div>
      <TrackerFilters filters={filters} onChange={setFilters} />

      {grants.length === 0 ? (
        <div className="border-2 border-dashed border-bauhaus-black/20 p-8 text-center">
          <div className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-2">
            No saved grants yet
          </div>
          <p className="text-sm text-bauhaus-muted font-medium">
            Browse <a href="/grants" className="text-bauhaus-blue font-bold hover:underline">grants</a> and
            use the star rating to save them here.
          </p>
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
                        <KanbanCard key={g.grant_id} grant={g} index={i} onRemove={handleRemove} />
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>

          {/* Terminal stages */}
          <div className="grid grid-cols-3 gap-3 mt-4">
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
        </DragDropContext>
      )}
    </div>
  );
}
