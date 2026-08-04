'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ActDailyActionStates, ActDailyActionStatus } from '@/lib/services/act-daily-actions';

export interface ActTodayFocusItem {
  id: string;
  label: string;
  title: string;
  detail: string;
  meta: string;
  href: string;
  actionLabel: string;
  tone: 'red' | 'green' | 'blue' | 'purple' | 'amber' | 'stone';
  carryDays?: number;
  decisionId?: string;
}

const STATUS_LABELS: Record<ActDailyActionStatus, string> = {
  done: 'Done today',
  waiting: 'Waiting on someone',
  tomorrow: 'Move to tomorrow',
};

export function ActTodayFocus({
  items,
  orgProfileId,
  initialStates,
  curiosityHref,
}: {
  items: ActTodayFocusItem[];
  orgProfileId: string;
  initialStates: ActDailyActionStates;
  curiosityHref: string;
}) {
  const [states, setStates] = useState<ActDailyActionStates>(initialStates);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const activeItems = useMemo(() => items.filter((item) => !states[item.id]), [items, states]);
  const handledItems = useMemo(() => items.filter((item) => states[item.id]), [items, states]);
  const lastHandled = handledItems[handledItems.length - 1] ?? null;

  async function record(item: ActTodayFocusItem, status: ActDailyActionStatus) {
    setPendingId(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${orgProfileId}/daily-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: item.id,
          title: item.title,
          detail: item.detail,
          href: item.href,
          status,
          decision_id: item.decisionId,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || `Update failed with ${response.status}`);
      setStates((current) => ({ ...current, [item.id]: status }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update today');
    } finally {
      setPendingId(null);
    }
  }

  async function undo(item: ActTodayFocusItem) {
    setPendingId(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${orgProfileId}/daily-actions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: item.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || `Undo failed with ${response.status}`);
      setStates((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not undo today');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div data-testid="act-today-focus">
      {activeItems[0] ? (
        <TodayPrimary
          item={activeItems[0]}
          pending={pendingId === activeItems[0].id}
          onStatus={(status) => void record(activeItems[0], status)}
        />
      ) : (
        <div className="bg-[#edf3ee] px-5 py-10 sm:px-7">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#2f6b4a]">Today cleared</div>
          <h3 className="mt-3 text-xl font-semibold">The committed work has been handled.</h3>
          <Link href={curiosityHref} className="mt-5 inline-flex min-h-10 items-center rounded-md bg-[#183426] px-4 text-xs font-semibold text-white">
            Open Curiosity
          </Link>
        </div>
      )}

      {activeItems.length > 1 ? (
        <div className="border-t border-[var(--ws-border)]">
          <div className="px-5 pt-4 font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">After that</div>
          <div className="divide-y divide-[var(--ws-border)]">
            {activeItems.slice(1).map((item, index) => (
              <TodaySecondary
                key={item.id}
                item={item}
                index={index + 2}
                pending={pendingId === item.id}
                onStatus={(status) => void record(item, status)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {handledItems.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-5 py-3 text-xs text-[var(--ws-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
          <span>{handledItems.length} handled today</span>
          {lastHandled && (!lastHandled.decisionId || states[lastHandled.id] !== 'done') ? (
            <button
              type="button"
              disabled={pendingId !== null}
              onClick={() => void undo(lastHandled)}
              className="min-h-9 self-start rounded-md border border-[var(--ws-border)] bg-white px-3 font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-1)] disabled:opacity-50 sm:self-auto"
            >
              Undo last
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? <div role="alert" className="border-t border-red-200 bg-red-50 px-5 py-3 text-xs font-semibold text-red-700">{message}</div> : null}
    </div>
  );
}

function TodayStatusSelect({
  label,
  pending,
  onStatus,
}: {
  label: string;
  pending: boolean;
  onStatus: (status: ActDailyActionStatus) => void;
}) {
  return (
    <select
      aria-label={`Update today: ${label}`}
      value=""
      disabled={pending}
      onChange={(event) => {
        if (event.target.value) onStatus(event.target.value as ActDailyActionStatus);
      }}
      className="h-10 rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs font-semibold text-[var(--ws-text)] disabled:cursor-wait disabled:opacity-60"
    >
      <option value="">{pending ? 'Saving...' : 'Mark...'}</option>
      {Object.entries(STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  );
}

function TodayPrimary({
  item,
  pending,
  onStatus,
}: {
  item: ActTodayFocusItem;
  pending: boolean;
  onStatus: (status: ActDailyActionStatus) => void;
}) {
  return (
    <div data-testid="today-primary" className="bg-[#edf3ee] px-5 py-6 sm:px-7 sm:py-8">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase text-[#2f6b4a]">
        <span>Do first</span><span aria-hidden="true">·</span><span>{item.label}</span>
        <span className="font-normal text-[var(--ws-text-secondary)]">{item.meta}</span>
        {item.carryDays ? <span className="rounded bg-white px-2 py-1 text-[#8a5a16]">Carried {item.carryDays}d</span> : null}
      </div>
      <h3 className="mt-4 max-w-3xl text-xl font-semibold leading-snug tracking-normal sm:text-2xl">{item.title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--ws-text-secondary)]">{item.detail}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={item.href} className="inline-flex min-h-10 items-center rounded-md bg-[#183426] px-4 text-xs font-semibold text-white">
          {item.actionLabel}
        </Link>
        <TodayStatusSelect label={item.title} pending={pending} onStatus={onStatus} />
      </div>
    </div>
  );
}

function TodaySecondary({
  item,
  index,
  pending,
  onStatus,
}: {
  item: ActTodayFocusItem;
  index: number;
  pending: boolean;
  onStatus: (status: ActDailyActionStatus) => void;
}) {
  return (
    <div className="grid min-h-[112px] gap-3 px-5 py-4 sm:grid-cols-[30px_minmax(0,1fr)_auto] sm:items-center">
      <div className="self-start pt-0.5 font-mono text-[11px] font-semibold text-[var(--ws-text-tertiary)]">{String(index).padStart(2, '0')}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-[var(--ws-border)] bg-[var(--ws-surface-2)] px-2 py-1 font-mono text-[9px] font-semibold uppercase">{item.label}</span>
          <span className="font-mono text-[10px] uppercase text-[var(--ws-text-secondary)]">{item.meta}</span>
          {item.carryDays ? <span className="font-mono text-[9px] font-semibold uppercase text-[#8a5a16]">Carried {item.carryDays}d</span> : null}
        </div>
        <Link href={item.href} className="mt-2 block text-sm font-semibold tracking-normal hover:text-[#2f6b4a]">{item.title}</Link>
        <div className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--ws-text-secondary)]">{item.detail}</div>
      </div>
      <TodayStatusSelect label={item.title} pending={pending} onStatus={onStatus} />
    </div>
  );
}
