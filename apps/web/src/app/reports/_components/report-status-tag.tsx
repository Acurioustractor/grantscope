import { reportSections, reportStatusMeta, type NavItem, type ReportStatus } from './sidebar-nav-data';

/**
 * Report status, visible at the link — slice F.
 *
 * The nav registry carries a status on 74 items; the sidebar and theme pages already show it.
 * This tag brings the same signal to every other place a report is linked (the /reports index
 * cards, search results), so nobody clicks into a review-status investigation thinking it is
 * current evidence. Reports not in the registry render nothing — an honest gap, not a default.
 */

const TAG_CLASS: Record<ReportStatus, string> = {
  current: 'border-bauhaus-blue text-bauhaus-blue bg-blue-50',
  reference: 'border-gray-300 text-gray-500 bg-white',
  review: 'border-bauhaus-red text-bauhaus-red bg-red-50',
  archive: 'border-gray-400 text-gray-500 bg-gray-100',
};

function collect(items: NavItem[], map: Map<string, ReportStatus>) {
  for (const item of items) {
    if (item.status && !map.has(item.href)) map.set(item.href, item.status);
    if (item.children) collect(item.children, map);
  }
}

const STATUS_BY_HREF = new Map<string, ReportStatus>();
for (const section of reportSections) collect(section.items, STATUS_BY_HREF);

export function reportStatusFor(href: string): ReportStatus | null {
  return STATUS_BY_HREF.get(href) ?? null;
}

export function ReportStatusTag({ href }: { href: string }) {
  const status = reportStatusFor(href);
  if (!status) return null;
  return (
    <span
      className={`ml-2 inline-block border px-1.5 py-0.5 align-middle text-[9px] font-black uppercase tracking-widest ${TAG_CLASS[status]}`}
      title={reportStatusMeta[status].description}
    >
      {reportStatusMeta[status].label}
    </span>
  );
}
