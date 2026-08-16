'use client';

import { useEffect, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { GlobalSearch } from '@/app/components/global-search';

/**
 * Shell header: page title, always-present search affordance, data-freshness pill.
 * The shell drops the global NavBar (chromeless layout), so the ⌘K listener that
 * normally lives in NavBar is re-registered here.
 */
export function ShellHeader() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className="flex items-center gap-4 px-7 py-3.5"
      style={{ background: 'var(--shell-surface)', borderBottom: '1px solid var(--shell-line)' }}
    >
      <h1 className="font-display text-[19px] font-bold">Dashboard</h1>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="shell-control flex w-[380px] items-center gap-2 px-3 py-2 text-left"
        style={{ background: 'var(--shell-canvas)' }}
      >
        <MagnifyingGlass size={15} weight="bold" style={{ color: 'var(--shell-muted)' }} />
        <span className="flex-1 truncate text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
          Search entities, people, places, themes…
        </span>
        <kbd
          className="shell-control px-1.5 py-0.5 font-mono text-[11px]"
          style={{ background: 'var(--shell-surface)', color: 'var(--shell-muted)' }}
        >
          ⌘K
        </kbd>
      </button>
      <div
        className="shell-control flex items-center gap-1.5 px-3 py-1.5"
        style={{ background: 'var(--shell-surface)' }}
      >
        <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: '#059669' }} />
        <span className="text-[12.5px] font-medium">Data: nightly refresh</span>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
