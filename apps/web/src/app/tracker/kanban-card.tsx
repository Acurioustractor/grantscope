'use client';

import { Draggable } from '@hello-pangea/dnd';
import type { SavedGrantRow } from './page';
import { ProjectTag } from '@/app/components/color-label';
import { ThumbsVote } from '@/app/components/thumbs-vote';

function formatAmount(min: number | null, max: number | null): string {
  if (max) return `$${max >= 1e6 ? (max / 1e6).toFixed(1) + 'M' : max >= 1e3 ? (max / 1e3).toFixed(0) + 'K' : max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return '';
}

type DeadlineInfo = { label: string; urgency: 'expired' | 'critical' | 'urgent' | 'soon' | 'normal' } | null;

function getDeadlineInfo(date: string | null): DeadlineInfo {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Closed', urgency: 'expired' };
  if (days === 0) return { label: 'TODAY', urgency: 'critical' };
  if (days <= 3) return { label: `${days}d left`, urgency: 'critical' };
  if (days <= 7) return { label: `${days}d left`, urgency: 'urgent' };
  if (days <= 14) return { label: `${days}d left`, urgency: 'soon' };
  return { label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), urgency: 'normal' };
}

const URGENCY_STYLES: Record<string, string> = {
  expired: 'text-white bg-bauhaus-red/80 line-through',
  critical: 'text-white bg-bauhaus-red animate-pulse',
  urgent: 'text-white bg-orange-500',
  soon: 'text-bauhaus-black bg-bauhaus-yellow',
  normal: 'text-bauhaus-muted',
};

export function KanbanCard({ grant, index, onRemove }: { grant: SavedGrantRow; index: number; onRemove?: (grantId: string) => void }) {
  const amount = formatAmount(grant.grant.amount_min, grant.grant.amount_max);
  const deadline = getDeadlineInfo(grant.grant.closes_at);

  return (
    <Draggable draggableId={grant.grant_id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white border-2 p-3 cursor-grab active:cursor-grabbing transition-shadow ${
            snapshot.isDragging ? 'bauhaus-shadow-sm' : ''
          } ${
            deadline?.urgency === 'critical' ? 'border-bauhaus-red' :
            deadline?.urgency === 'urgent' ? 'border-orange-500' :
            'border-bauhaus-black'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <a
              href={`/grants/${grant.grant_id}`}
              className="text-sm font-bold text-bauhaus-black hover:text-bauhaus-blue leading-tight line-clamp-2 flex-1"
            >
              {grant.grant.name}
            </a>
            {onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(grant.grant_id); }}
                className="p-0.5 text-bauhaus-muted/40 hover:text-bauhaus-red transition-colors flex-shrink-0"
                title="Remove from tracker"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M6 6l8 8M14 6l-8 8" />
                </svg>
              </button>
            )}
          </div>

          <div className="text-xs text-bauhaus-muted font-medium mt-1 truncate">
            {grant.grant.provider}
          </div>

          {grant.color && grant.color !== 'none' && (
            <div className="mt-1.5">
              <ProjectTag color={grant.color} />
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
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
              <div onClick={(e) => e.stopPropagation()}>
                <ThumbsVote grantId={grant.grant_id} sourceContext="tracker" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs tabular-nums">
              {amount && (
                <span className="font-black text-bauhaus-blue">{amount}</span>
              )}
              {deadline && (
                <span className={`font-bold px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${URGENCY_STYLES[deadline.urgency]}`}>
                  {deadline.label}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
