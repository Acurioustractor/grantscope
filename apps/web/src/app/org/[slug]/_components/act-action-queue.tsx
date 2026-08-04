'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { OrgPipelineItemWithEntity } from '@/lib/services/org-dashboard-service';
import {
  pipelineNeedsAttention,
  pipelineNeedsPlan,
  pipelineSuggestedNextAction,
} from '@/lib/services/act-pipeline-learning';
import { ActPipelineStatusControl } from './act-pipeline-status-control';

type ActionQueueMode = 'now' | 'plan' | 'waiting' | 'all';

interface ActionProject {
  code: string;
  name: string;
  slug: string;
}

export interface ActActionConnectionContext {
  pipelineItemId: string;
  relationshipId: string | null;
  relationshipName: string | null;
  relationshipState: 'cold' | 'known' | 'warm' | 'active' | 'stale';
  recommendedMove: 'apply_now' | 'approach_now' | 'ask_for_intro' | 'build_proof_pack' | 'watch' | 'park';
  evidenceGaps: string[];
}

const MODES: Array<{ id: ActionQueueMode; label: string }> = [
  { id: 'now', label: 'Now' },
  { id: 'plan', label: 'Needs plan' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'all', label: 'All' },
];

function isWaiting(item: OrgPipelineItemWithEntity): boolean {
  return ['applied', 'submitted', 'waiting'].includes(item.status.toLowerCase());
}

function matchesMode(item: OrgPipelineItemWithEntity, mode: ActionQueueMode): boolean {
  if (mode === 'now') return pipelineNeedsAttention(item);
  if (mode === 'plan') return pipelineNeedsPlan(item);
  if (mode === 'waiting') return isWaiting(item);
  return true;
}

function fmtMoney(value: number | null, display: string | null): string {
  if (display) return display;
  if (!value) return 'Value not set';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function fmtDate(value: string | null): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function relationshipLabel(value: ActActionConnectionContext['relationshipState']): string {
  if (value === 'active') return 'Active';
  if (value === 'warm') return 'Warm';
  if (value === 'known') return 'Known';
  if (value === 'stale') return 'Stale';
  return 'No warm path';
}

export function ActActionQueue({
  items,
  orgProfileId,
  orgSlug,
  projects,
  contexts = [],
  selectedItemId,
}: {
  items: OrgPipelineItemWithEntity[];
  orgProfileId: string;
  orgSlug: string;
  projects: ActionProject[];
  contexts?: ActActionConnectionContext[];
  selectedItemId?: string;
}) {
  const initialItem = items.find((item) => item.id === selectedItemId) ?? null;
  const initialMode: ActionQueueMode = initialItem
    ? pipelineNeedsAttention(initialItem)
      ? 'now'
      : pipelineNeedsPlan(initialItem)
        ? 'plan'
        : isWaiting(initialItem)
          ? 'waiting'
          : 'all'
    : items.some((item) => pipelineNeedsAttention(item))
      ? 'now'
      : items.some((item) => pipelineNeedsPlan(item))
        ? 'plan'
        : 'all';
  const [mode, setMode] = useState<ActionQueueMode>(initialMode);
  const filteredItems = useMemo(() => items.filter((item) => matchesMode(item, mode)), [items, mode]);
  const [selectedId, setSelectedId] = useState(
    initialItem?.id ?? items.find((item) => matchesMode(item, initialMode))?.id ?? items[0]?.id ?? null,
  );
  const selected = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const counts = useMemo(() => ({
    now: items.filter((item) => matchesMode(item, 'now')).length,
    plan: items.filter((item) => matchesMode(item, 'plan')).length,
    waiting: items.filter((item) => matchesMode(item, 'waiting')).length,
    all: items.length,
  }), [items]);

  useEffect(() => {
    if (filteredItems.length > 0 && !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const selectedProject = selected?.project_code
    ? projects.find((project) => project.code === selected.project_code) ?? null
    : null;
  const selectedContext = selected
    ? contexts.find((context) => context.pipelineItemId === selected.id) ?? null
    : null;
  const suggestedNextAction = selected
    ? pipelineSuggestedNextAction(selected, selectedContext)
    : null;
  const relationshipHref = selectedContext?.relationshipId
    ? `/org/${orgSlug}?view=relationships&relationship=${encodeURIComponent(selectedContext.relationshipId)}#relationships`
    : `/org/${orgSlug}?view=relationships#relationships`;

  return (
    <div className="grid min-w-0 xl:grid-cols-[minmax(420px,1.05fr)_minmax(400px,0.95fr)]">
      <div className="min-w-0 border-b border-[var(--ws-border)] xl:border-b-0 xl:border-r">
        <div className="border-b border-[var(--ws-border)] bg-white px-3 py-3">
          <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-2)] p-1" role="tablist" aria-label="Action queue views">
            {MODES.map((item) => {
              const active = item.id === mode;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded px-3 text-xs font-semibold ${active ? 'bg-white text-[var(--ws-text)] shadow-sm' : 'text-[var(--ws-text-secondary)] hover:text-[var(--ws-text)]'}`}
                  aria-pressed={active}
                >
                  <span>{item.label}</span>
                  <span className={active ? 'text-[#2f6b4a]' : ''}>{counts[item.id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-[var(--ws-border)]">
          {filteredItems.map((item) => {
            const active = item.id === selected?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 border-l-4 px-4 py-4 text-left ${active ? 'border-l-[#2f6b4a] bg-[#f1f5f2]' : 'border-l-transparent bg-white hover:bg-[var(--ws-surface-2)]'}`}
                aria-current={active ? 'true' : undefined}
              >
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">{item.name}</span>
                  <span className="mt-1 block text-xs text-[var(--ws-text-secondary)]">{item.next_action || 'Plan the next concrete move'}</span>
                  <span className="mt-2 flex flex-wrap gap-x-2 text-[10px] font-medium text-[var(--ws-text-secondary)]">
                    <span>{item.project_code || 'Project needed'}</span><span>·</span>
                    <span>{item.funder || item.grant_provider || 'Organisation not set'}</span><span>·</span>
                    <span>{statusLabel(item.status)}</span>
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="block font-semibold text-[var(--ws-text)]">{fmtDate(item.next_action_at || item.deadline)}</span>
                  <span className="mt-1 block text-[var(--ws-text-secondary)]">{fmtMoney(item.amount_numeric, item.amount_display)}</span>
                </span>
              </button>
            );
          })}
          {filteredItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--ws-text-secondary)]">Nothing in this queue.</div>
          ) : null}
        </div>
      </div>

      <aside className="bg-[var(--ws-surface-1)]" data-testid="action-selected">
        {selected ? (
          <div className="sticky top-24 2xl:grid 2xl:grid-cols-2">
            <div className="border-b border-[var(--ws-border)] px-4 py-4 2xl:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">Selected commitment</div>
              <h3 className="mt-1 text-lg font-semibold leading-snug">{selected.name}</h3>
              <div className="mt-2 text-xs text-[var(--ws-text-secondary)]">
                {selected.funder || selected.grant_provider || 'Organisation not set'} · {fmtMoney(selected.amount_numeric, selected.amount_display)}
              </div>
            </div>

            <div className="border-b border-[var(--ws-border)] px-4 py-4 2xl:border-r">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ws-text-secondary)]">Connection path</div>
                <span className="rounded border border-[var(--ws-border)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--ws-text-secondary)]">
                  {selectedContext ? relationshipLabel(selectedContext.relationshipState) : 'Not assessed'}
                </span>
              </div>
              <div className="mt-3 font-semibold">
                {selectedContext?.relationshipName || 'No matched person yet'}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">
                {suggestedNextAction}
              </div>
              {selectedContext?.evidenceGaps.length ? (
                <div className="mt-2 text-[11px] text-[var(--ws-text-secondary)]">
                  Missing: {selectedContext.evidenceGaps.slice(0, 2).join(' · ')}
                </div>
              ) : null}
              <Link href={relationshipHref} className="mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-[#2f6b4a] hover:underline">
                {selectedContext?.relationshipId ? 'Open this relationship' : 'Find a relationship path'}
              </Link>
            </div>

            <div className="border-b border-[var(--ws-border)] px-4 py-4">
              <ActPipelineStatusControl
                key={selected.id}
                itemId={selected.id}
                itemName={selected.name}
                orgProfileId={orgProfileId}
                initialStatus={selected.status}
                initialOwnerName={selected.owner_name}
                initialNextAction={selected.next_action}
                initialNextActionAt={selected.next_action_at}
                suggestedNextAction={suggestedNextAction}
              />
            </div>

            <div className="flex flex-wrap gap-2 px-4 py-4 2xl:col-span-2">
              {selectedProject ? (
                <Link href={`/org/${orgSlug}/${selectedProject.slug}`} className="inline-flex min-h-10 items-center rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs font-semibold hover:bg-[var(--ws-surface-2)]">
                  {selectedProject.name}
                </Link>
              ) : null}
              {selected.grant_url ? (
                <Link href={selected.grant_url} className="inline-flex min-h-10 items-center rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs font-semibold hover:bg-[var(--ws-surface-2)]">
                  Source
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-[var(--ws-text-secondary)]">Choose a commitment.</div>
        )}
      </aside>
    </div>
  );
}
