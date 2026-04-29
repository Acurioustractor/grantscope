'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  findReportItem,
  reportSections,
  reportStatusMeta,
  type NavItem,
  type ReportStatus,
} from './sidebar-nav-data';

type Crumb = { label: string; href: string };

const STATUS_NOTICE_CLASS: Record<ReportStatus, string> = {
  current: 'border-bauhaus-blue bg-blue-50 text-bauhaus-blue',
  reference: 'border-gray-300 bg-white text-gray-600',
  review: 'border-bauhaus-red bg-red-50 text-bauhaus-black',
  archive: 'border-gray-400 bg-gray-100 text-gray-600',
};

const STATUS_NOTICE_TITLE: Record<ReportStatus, string> = {
  current: 'Current operating surface',
  reference: 'Reference material',
  review: 'Needs review before quoting',
  archive: 'Archive material',
};

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
  const item = findReportItem(pathname);
  const status = item?.status;
  if (crumbs.length === 0) return null;

  // Deduplicate consecutive crumbs with the same href
  const deduped = crumbs.filter(
    (c, i) => i === 0 || c.href !== crumbs[i - 1].href,
  );

  return (
    <>
      <nav
        className="mb-4 flex flex-wrap items-center gap-x-1 text-[11px] font-black uppercase tracking-widest"
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
                  className="text-gray-400 transition-colors hover:text-bauhaus-black"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {status && (
        <div className={`mb-6 border-2 px-4 py-3 ${STATUS_NOTICE_CLASS[status]}`}>
          <div className="text-[10px] font-black uppercase tracking-widest">
            {STATUS_NOTICE_TITLE[status]}
          </div>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
            {status === 'current'
              ? `${reportStatusMeta[status].description} Keep this as one of the main working surfaces and use it to direct people to the next action.`
              : `${reportStatusMeta[status].description} Align it by checking the source date, the main figures, whether it still supports the CivicGraph / ACT operating map, and what action it should send people to next.`}
          </p>
        </div>
      )}
    </>
  );
}
