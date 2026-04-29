'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  reportSections,
  bottomLinks,
  reportStatusMeta,
  type NavItem,
  type NavSection,
  type ReportStatus,
} from './sidebar-nav-data';

const STORAGE_KEY = 'cg-report-sidebar-collapsed';
const RECENT_KEY = 'cg-report-recent';
const RECENT_MAX = 5;

const SECTION_ABBR: Record<string, string> = {
  'Current Map': 'CM',
  'Youth Justice': 'YJ',
  'Child Protection': 'CP',
  'Disability': 'DIS',
  'Education': 'ED',
  'Cross-System': 'CS',
  'Accountability & Power': 'AP',
  'Funding & Equity': 'FE',
  'Social Sector': 'SS',
  'Philanthropy & Corporate': 'PC',
  'Research & Procurement': 'RP',
  'Data & System': 'DS',
};

type RecentEntry = { href: string; label: string; section: string };

const STATUS_BADGE_CLASS: Record<ReportStatus, string> = {
  current: 'border-bauhaus-blue text-bauhaus-blue bg-blue-50',
  reference: 'border-gray-300 text-gray-500 bg-white',
  review: 'border-bauhaus-red text-bauhaus-red bg-red-50',
  archive: 'border-gray-400 text-gray-500 bg-gray-100',
};

function StatusBadge({ status }: { status?: ReportStatus }) {
  if (!status) return null;
  return (
    <span
      className={`ml-auto shrink-0 border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${STATUS_BADGE_CLASS[status]}`}
      title={reportStatusMeta[status].description}
    >
      {reportStatusMeta[status].label}
    </span>
  );
}

function StatusLegend() {
  return (
    <div className="mx-3 my-2 border border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-2">
      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-bauhaus-black">
        Review status
      </div>
      <div className="space-y-1 text-[10px] leading-snug text-gray-500">
        <div><span className="font-black text-bauhaus-blue">Current</span> means use now.</div>
        <div><span className="font-black text-bauhaus-red">Review</span> means check dates and figures first.</div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function isActive(href: string, pathname: string): boolean {
  return pathname === href;
}

function sectionContainsPath(section: NavSection, pathname: string): boolean {
  return section.items.some((item) => itemContainsPath(item, pathname));
}

function itemContainsPath(item: NavItem, pathname: string): boolean {
  if (isActive(item.href, pathname)) return true;
  return item.children?.some((child) => itemContainsPath(child, pathname)) ?? false;
}

function countItems(items: NavItem[]): number {
  return items.reduce((count, item) => {
    return count + 1 + (item.children ? countItems(item.children) : 0);
  }, 0);
}

function findNavEntry(pathname: string): { label: string; section: string } | null {
  for (const section of reportSections) {
    const item = findItemInTree(section.items, pathname);
    if (item) return { label: item.label, section: section.title };
  }
  return null;
}

function findItemInTree(items: NavItem[], pathname: string): NavItem | null {
  for (const item of items) {
    if (item.href === pathname) return item;
    if (item.children) {
      const found = findItemInTree(item.children, pathname);
      if (found) return found;
    }
  }
  return null;
}

function getRecentItems(): RecentEntry[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function pushRecentItem(entry: RecentEntry): RecentEntry[] {
  const items = getRecentItems().filter((r) => r.href !== entry.href);
  items.unshift(entry);
  const trimmed = items.slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — ignore
  }
  return trimmed;
}

/* ── Recently Viewed ── */
function RecentlyViewed({ pathname }: { pathname: string }) {
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    // Update recent on navigation
    const entry = findNavEntry(pathname);
    if (entry) {
      const updated = pushRecentItem({ href: pathname, ...entry });
      setRecent(updated);
    } else {
      setRecent(getRecentItems());
    }
  }, [pathname]);

  // Exclude current page
  const visible = recent.filter((r) => r.href !== pathname);
  if (visible.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-bauhaus-black/5">
      <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
        Recent
      </div>
      {visible.map((r) => (
        <div key={r.href} className="flex items-center gap-1.5">
          <Link
            href={r.href}
            className="flex-1 text-[11px] text-gray-600 hover:text-bauhaus-black truncate py-0.5 transition-colors"
          >
            {r.label}
          </Link>
          <span className="text-[9px] uppercase tracking-wider text-gray-300 font-bold flex-shrink-0">
            {SECTION_ABBR[r.section] ?? r.section.slice(0, 2).toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Leaf nav link ── */
function NavLink({
  item,
  pathname,
  depth = 0,
}: {
  item: NavItem;
  pathname: string;
  depth?: number;
}) {
  const active = isActive(item.href, pathname);
  const hasChildren = item.children && item.children.length > 0;
  const childActive = hasChildren && item.children!.some((c) => itemContainsPath(c, pathname));
  const [expanded, setExpanded] = useState(childActive);

  useEffect(() => {
    if (childActive) setExpanded(true);
  }, [childActive]);

  const pl = depth === 0 ? 'pl-4' : depth === 1 ? 'pl-7' : 'pl-10';

  return (
    <>
      <div className="flex items-center">
        <Link
          href={item.href}
          className={`
            flex-1 block min-w-0 py-1.5 pr-3 text-[13px] leading-tight transition-colors
            ${pl}
            ${active
              ? 'border-l-4 border-bauhaus-red bg-red-50/40 font-black text-bauhaus-black'
              : 'border-l-4 border-transparent hover:bg-gray-100 text-gray-700 hover:text-bauhaus-black'
            }
          `}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{item.label}</span>
            <StatusBadge status={item.status} />
          </span>
          {item.note && (
            <span className="mt-0.5 block truncate text-[10px] font-medium text-gray-400">
              {item.note}
            </span>
          )}
        </Link>
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 mr-1 text-gray-400 hover:text-bauhaus-black"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <NavLink key={child.href} item={child} pathname={pathname} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

/* ── Section with collapsible header ── */
function SectionGroup({
  section,
  pathname,
  initiallyOpen,
}: {
  section: NavSection;
  pathname: string;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const itemCount = countItems(section.items);

  useEffect(() => {
    if (sectionContainsPath(section, pathname)) setOpen(true);
  }, [pathname, section]);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {section.title}
          <span className="text-gray-400 text-[9px] font-normal">({itemCount})</span>
        </span>
        <svg
          className={`w-3 h-3 transition-transform text-gray-400 ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="pb-1">
          {section.description && (
            <div className="text-[10px] text-gray-400 italic px-3 pb-1">
              {section.description}
            </div>
          )}
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main sidebar ── */
export function ReportSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
    // Measure nav height for sticky offset
    const nav = document.querySelector('nav');
    if (nav) setNavHeight(nav.getBoundingClientRect().height);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEY, String(!prev));
      return !prev;
    });
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b-2 border-bauhaus-black/10">
        <Link
          href="/reports"
          className="text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-red transition-colors"
        >
          Reports
        </Link>
        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center w-6 h-6 text-gray-400 hover:text-bauhaus-black transition-colors"
          aria-label="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden flex items-center justify-center w-6 h-6 text-gray-400 hover:text-bauhaus-black"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Recently Viewed */}
      <RecentlyViewed pathname={pathname} />

      <StatusLegend />

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {reportSections.map((section) => (
          <SectionGroup
            key={section.title}
            section={section}
            pathname={pathname}
            initiallyOpen={sectionContainsPath(section, pathname)}
          />
        ))}
      </div>

      {/* Bottom links */}
      <div className="border-t-2 border-bauhaus-black/10 px-3 py-3 flex gap-3">
        {bottomLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-bauhaus-black transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );

  // Prevent hydration mismatch — render collapsed placeholder on first render
  if (!mounted) {
    return <div className="hidden lg:block w-[260px] flex-shrink-0" />;
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`
          hidden lg:flex flex-col flex-shrink-0 bg-white border-r-4 border-bauhaus-black transition-all duration-200
          sticky overflow-y-auto
          ${collapsed ? 'w-12' : 'w-[260px]'}
        `}
        style={{ top: navHeight, height: `calc(100vh - ${navHeight}px)` }}
      >
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-full h-12 text-gray-400 hover:text-bauhaus-black transition-colors"
            aria-label="Expand sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          sidebarContent
        )}
      </aside>

      {/* ── Mobile toggle button ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className={`
          lg:hidden fixed bottom-4 left-4 z-40 w-10 h-10 flex items-center justify-center
          bg-bauhaus-black text-white border-2 border-bauhaus-black
          bauhaus-shadow-sm hover:bg-bauhaus-red transition-colors
          ${mobileOpen ? 'hidden' : ''}
        `}
        aria-label="Open report navigation"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative w-[280px] max-w-[80vw] bg-white border-r-4 border-bauhaus-black animate-slide-in-left flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
