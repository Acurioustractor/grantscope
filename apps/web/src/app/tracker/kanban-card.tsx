'use client';

import { Draggable } from '@hello-pangea/dnd';
import type { SavedGrantRow } from './page';
import { ColorDot } from '@/app/components/color-label';

function formatAmount(min: number | null, max: number | null): string {
  if (max) return `$${max >= 1e6 ? (max / 1e6).toFixed(1) + 'M' : max >= 1e3 ? (max / 1e3).toFixed(0) + 'K' : max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return '';
}

function formatCloseDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Closed';
  if (days <= 7) return `${days}d left`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function KanbanCard({ grant, index, onRemove }: { grant: SavedGrantRow; index: number; onRemove?: (grantId: string) => void }) {
  const amount = formatAmount(grant.grant.amount_min, grant.grant.amount_max);
  const closeDate = formatCloseDate(grant.grant.closes_at);

  return (
    <Draggable draggableId={grant.grant_id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white border-4 border-bauhaus-black p-3 cursor-grab active:cursor-grabbing transition-shadow ${
            snapshot.isDragging ? 'bauhaus-shadow-sm' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <a
              href={`/grants/${grant.grant_id}`}
              className="text-sm font-bold text-bauhaus-black hover:text-bauhaus-blue leading-tight line-clamp-2 flex-1"
              onClick={(e) => e.stopPropagation()}
            >
              {grant.grant.name}
            </a>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ColorDot color={grant.color} />
              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(grant.grant_id); }}
                  className="p-0.5 text-bauhaus-muted/40 hover:text-bauhaus-red transition-colors"
                  title="Remove from tracker"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M6 6l8 8M14 6l-8 8" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-bauhaus-muted font-medium mt-1 truncate">
            {grant.grant.provider}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <svg
                  key={s}
                  className="w-3 h-3"
                  viewBox="0 0 20 20"
                  fill={s <= grant.stars ? '#F0C020' : 'none'}
                  stroke={s <= grant.stars ? '#F0C020' : '#ccc'}
                  strokeWidth={2}
                >
                  <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z" />
                </svg>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs tabular-nums">
              {amount && (
                <span className="font-black text-bauhaus-blue">{amount}</span>
              )}
              {closeDate && (
                <span className={`font-bold ${closeDate === 'Closed' ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>
                  {closeDate}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
