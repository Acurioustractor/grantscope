'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SquaresFour,
  MagnifyingGlass,
  Eye,
  Tag,
  Buildings,
  Users,
  MapPin,
  FileText,
} from '@phosphor-icons/react';

/**
 * The rail's nav entries live HERE, in the client component — component references cannot cross
 * the server->client boundary as props (the first cut tried and 500'd every shell page).
 *
 * Phase-2 ruling (2026-08-17): the rail never exits the shell. The five nouns point at
 * shell-native index pages; DETAIL pages still open on the public atlas, stated on each page.
 */
const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: SquaresFour },
  { href: '/search', label: 'Search', Icon: MagnifyingGlass },
  { href: '/clarity', label: 'Clarity', Icon: Eye },
  { href: '/dashboard/themes', label: 'Themes', Icon: Tag },
  { href: '/dashboard/entities', label: 'Entities', Icon: Buildings },
  { href: '/dashboard/people', label: 'People', Icon: Users },
  { href: '/dashboard/places', label: 'Places', Icon: MapPin },
  { href: '/dashboard/reports', label: 'Reports', Icon: FileText },
];

/**
 * Pathname-aware active state: the LONGEST matching prefix wins, so /dashboard/people lights
 * People (not Dashboard) and /clarity/o/x lights Clarity. Replaced the static activeHref prop,
 * which could not know where the reader actually was.
 */
export function RailNav() {
  const pathname = usePathname() ?? '';
  const active = NAV
    .filter((e) => pathname === e.href || pathname.startsWith(`${e.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      {NAV.map(({ href, label, Icon }) => {
        const isActive = href === active;
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-2.5 py-2 text-sm"
            style={{
              borderRadius: 'var(--shell-r-sm)',
              background: isActive ? 'var(--shell-rail-hover)' : undefined,
              color: isActive ? '#FFFFFF' : 'var(--shell-rail-text)',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            <Icon size={16} weight="bold" />
            {label}
            {isActive && (
              <span
                className="ml-auto inline-block h-1.5 w-1.5"
                style={{ background: '#D02020', borderRadius: 3 }}
              />
            )}
          </Link>
        );
      })}
    </>
  );
}
