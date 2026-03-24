'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { reportSections, type NavItem } from './sidebar-nav-data';

type Crumb = { label: string; href: string };

function findBreadcrumbPath(pathname: string): Crumb[] {
  for (const section of reportSections) {
    const trail = findInItems(section.items, pathname, []);
    if (trail) {
      // Prefix with Reports root and section title
      return [
        { label: 'Reports', href: '/reports' },
        // Use the first item's href as the section link (usually the overview page)
        { label: section.title, href: section.items[0]?.href ?? '/reports' },
        ...trail,
      ];
    }
  }
  return [];
}

function findInItems(
  items: NavItem[],
  pathname: string,
  ancestors: Crumb[],
): Crumb[] | null {
  for (const item of items) {
    if (item.href === pathname) {
      return [...ancestors, { label: item.label, href: item.href }];
    }
    if (item.children) {
      // Skip grouping nodes (whose href duplicates a child's href)
      const isGrouping = item.children.some((c) => c.href === item.href);
      const nextAncestors = isGrouping
        ? ancestors
        : [...ancestors, { label: item.label, href: item.href }];
      const found = findInItems(item.children, pathname, nextAncestors);
      if (found) return found;
    }
  }
  return null;
}

export function ReportBreadcrumbs() {
  const pathname = usePathname();

  // Don't show breadcrumbs on the reports index
  if (pathname === '/reports') return null;

  const crumbs = findBreadcrumbPath(pathname);
  if (crumbs.length === 0) return null;

  // Deduplicate consecutive crumbs with the same href
  const deduped = crumbs.filter(
    (c, i) => i === 0 || c.href !== crumbs[i - 1].href,
  );

  return (
    <nav
      className="text-[11px] font-black uppercase tracking-widest mb-6 flex items-center flex-wrap gap-x-1"
      aria-label="Breadcrumb"
    >
      {deduped.map((crumb, i) => {
        const isLast = i === deduped.length - 1;
        return (
          <span key={crumb.href + i} className="flex items-center gap-x-1">
            {i > 0 && <span className="text-bauhaus-muted">/</span>}
            {isLast ? (
              <span className="text-bauhaus-black">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-400 hover:text-bauhaus-black transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
