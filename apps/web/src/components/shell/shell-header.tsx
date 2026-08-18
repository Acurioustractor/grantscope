'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { GlobalSearch } from '@/app/components/global-search';
import { ShellMenus, type DataEvent } from './shell-menus';

/**
 * Shell header: page title, always-present search affordance, data-freshness pill.
 * The shell drops the global NavBar (chromeless layout), so the ⌘K listener that
 * normally lives in NavBar is re-registered here.
 */
interface ShellHeaderProps {
  title: string;
  events: DataEvent[];
  userEmail: string | null;
  isAdmin: boolean;
}

/** Longest-prefix page titles; the layout prop is the fallback. The layout can't know the
 *  page (SH-4: every dashboard page said "Dashboard"), the pathname can. */
const TITLES: [string, string][] = [
  ['/dashboard/browse/foundations', 'Foundations'],
  ['/dashboard/browse/social-enterprises', 'Social enterprises'],
  ['/dashboard/browse/charities', 'Charities'],
  ['/dashboard/browse/grants', 'Grant recipients'],
  ['/dashboard/browse/contracts', 'Contract suppliers'],
  ['/dashboard/browse/buyers', 'Government buyers'],
  ['/dashboard/browse/donations', 'Political donors'],
  ['/dashboard/people', 'People'],
  ['/dashboard/places', 'Places'],
  ['/dashboard/entities', 'Entities'],
  ['/dashboard/themes', 'Themes'],
  ['/dashboard/reports', 'Reports'],
  ['/dashboard/views', 'Views'],
  ['/dashboard/docs', 'The data'],
  ['/dashboard/guide', 'What this is'],
  ['/dashboard/help', 'Help'],
  ['/ops/health', 'Data health'],
  ['/ops/claims', 'Claims'],
  ['/ops/grant-recommendations', 'Grant recommendations'],
  ['/ops', 'Ops'],
];

export function ShellHeader({ title, events, userEmail, isAdmin }: ShellHeaderProps) {
  const pathname = usePathname() ?? '';
  const derived = TITLES
    .filter(([p]) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
  title = derived ?? title;
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
      <h1 className="font-display text-[19px] font-bold">{title}</h1>
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
      <ShellMenus events={events} userEmail={userEmail} isAdmin={isAdmin} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
