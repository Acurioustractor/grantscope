'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Shared scaffolding for every kind browser: the money formatter, the drawer label, the
 * drawer shell, and the drawer-fetch state machine. Extracted after the code-review pass
 * found all four browsers redefining these verbatim — columns stay per-kind, chrome is shared.
 */

export function money(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  // UX audit pass 2, F8: rounding to thousands rendered anything under $500 as "$0k", which reads
  // as "no money" when it is in fact a small amount. Below $1k, show the actual dollars.
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

export function L({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
      {children}
    </div>
  );
}

/** Shareable-URL builder: current filter state, overridden per chip. */
export function makeQs(basePath: string, params: Record<string, string>) {
  return (over: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `${basePath}${s ? `?${s}` : ''}`;
  };
}

/**
 * Sortable column header: every column on every browse table sorts by clicking its header
 * (Ben's ruling 2026-08-18 — sorting lives on the columns, not in chip rows that cover some
 * of them). Each column sorts its natural direction (money/counts high-first, names A–Z);
 * the active column shows a ▾.
 */
export function SortHeader({
  label,
  sortKey,
  current,
  qs,
  width,
  align,
  title,
}: {
  label: string;
  sortKey: string;
  current: string;
  qs: (over: Record<string, string>) => string;
  /** Tailwind width class, e.g. 'w-[92px]'; omit for flex-1. */
  width?: string;
  align?: 'right';
  title?: string;
}) {
  const active = current === sortKey;
  return (
    <Link
      href={qs({ sort: sortKey })}
      title={title ? `${title}. Click to sort by this column.` : `Sort by ${label.toLowerCase()}`}
      className={`${width ?? 'min-w-0 flex-1'} ${align === 'right' ? 'text-right' : ''} shrink-0 truncate whitespace-nowrap hover:underline`}
      style={{ color: active ? '#121212' : undefined }}
    >
      {label}
      <span className="ml-[2px]" style={{ color: active ? '#D02020' : '#C0C0C0' }}>{active ? '▾' : '⇅'}</span>
    </Link>
  );
}

/** Drawer state: open(key, url) fetches url and lands it in detail; errors land in err. */
export function useDrawer<T>() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open(key: string, url: string) {
    setOpenKey(key);
    setDetail(null);
    setErr(null);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  return { openKey, detail, err, open, close: () => setOpenKey(null) };
}

export function Drawer({
  title,
  err,
  onClose,
  children,
}: {
  title: string;
  err: string | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(18,18,18,0.18)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] overflow-y-auto border-l bg-white p-5" style={{ borderColor: 'var(--shell-line)', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] font-extrabold">{title}</h2>
        <button onClick={onClose} aria-label="close" className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-black shell-control">✕</button>
      </div>
        {err ? <p className="mt-3 text-[13px]" style={{ color: '#D02020' }}>Could not load: {err}</p> : null}
        {children}
      </aside>
    </>
  );
}
