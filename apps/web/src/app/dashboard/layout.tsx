import type { ReactNode } from 'react';
import Link from 'next/link';
import { pinnedViews } from '@/lib/view-registry';
import { ShellHeader } from './shell-header';
import {
  SquaresFour,
  MagnifyingGlass,
  Eye,
  Tag,
  Buildings,
  Users,
  MapPin,
  FileText,
  Database,
} from '@phosphor-icons/react/dist/ssr';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: SquaresFour, active: true },
  { href: '/search', label: 'Search', icon: MagnifyingGlass },
  { href: '/clarity', label: 'Clarity', icon: Eye },
  { href: '/themes', label: 'Themes', icon: Tag },
  { href: '/entities', label: 'Entities', icon: Buildings },
  { href: '/people', label: 'People', icon: Users },
  { href: '/atlas', label: 'Places', icon: MapPin },
  { href: '/reports', label: 'Reports', icon: FileText },
];

const VIEW_DOT: Record<string, string> = {
  red: '#D02020',
  blue: '#1040C0',
  yellow: '#F0C020',
  green: '#059669',
  ink: '#6E6E6E',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell flex min-h-screen font-sans">
      <aside
        className="flex w-[236px] shrink-0 flex-col gap-1 px-4 py-5"
        style={{ background: 'var(--shell-rail)' }}
      >
        <Link href="/" className="flex items-center gap-2.5 px-1">
          <span
            className="inline-block h-[22px] w-[22px]"
            style={{ background: '#D02020', borderRadius: 'var(--shell-r-sm)' }}
          />
          <span className="font-display text-[15px] font-extrabold tracking-[0.15em] text-white">
            CIVICGRAPH
          </span>
        </Link>
        <div className="h-5" />
        {NAV.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-2.5 py-2 text-sm"
            style={{
              borderRadius: 'var(--shell-r-sm)',
              background: active ? 'var(--shell-rail-hover)' : undefined,
              color: active ? '#FFFFFF' : 'var(--shell-rail-text)',
              fontWeight: active ? 600 : 500,
            }}
          >
            <Icon size={16} weight="bold" />
            {label}
            {active && (
              <span
                className="ml-auto inline-block h-1.5 w-1.5"
                style={{ background: '#D02020', borderRadius: 3 }}
              />
            )}
          </Link>
        ))}
        <div className="h-6" />
        <div className="px-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7A7A7A]">
          Saved views
        </div>
        {pinnedViews().map((v) => (
          <Link
            key={v.id}
            href={v.href}
            title={v.question}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px]"
            style={{ borderRadius: 'var(--shell-r-sm)', color: 'var(--shell-rail-text)' }}
          >
            <span
              className="inline-block h-2 w-2 shrink-0"
              style={{ background: VIEW_DOT[v.colour], borderRadius: 2 }}
            />
            {v.name}
          </Link>
        ))}
        <div className="flex-1" />
        <Link
          href="/clarity"
          className="flex items-center gap-2.5 px-2.5 py-2"
          style={{
            borderRadius: 'var(--shell-r-sm)',
            background: '#1D1D1D',
            color: 'var(--shell-rail-text)',
          }}
        >
          <Database size={15} weight="bold" />
          <span className="font-mono text-[11.5px]">52.3M rows on the graph</span>
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellHeader />
        <main className="flex-1 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
