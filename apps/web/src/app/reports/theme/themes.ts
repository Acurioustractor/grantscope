import { reportSections, type NavItem, type ReportStatus } from '../_components/sidebar-nav-data';

/**
 * Theme pages — the 13 report sections, made into real pages.
 *
 * WHY THESE AND NOT SOMETHING NEW
 *
 * Three taxonomies exist in this system: 13 report sections, 11 ACT project categories, and 17
 * database domains. The sections win because they are the only one written in the language a human
 * uses about the world ("Youth Justice", "Child Protection") and they already file 74 nav items.
 * The ACT categories are what a theme ALIGNS to, not what it navigates by. The DB domains were
 * rejected in part 1 as a schema taxonomy in subject clothing.
 *
 * A fourth taxonomy to unify the three is how you end up with five.
 *
 * WHY /reports/theme/[slug] AND NOT /reports/[slug]
 *
 * The plan said `/reports/[section]`. It cannot be: every section slug is already a real report
 * page — `/reports/youth-justice`, `/reports/child-protection`, `/reports/disability`,
 * `/reports/education`, `/reports/social-enterprise`, `/reports/philanthropy` all exist and are
 * the section's own Overview. One extra path segment, same neighbourhood.
 *
 * See `thoughts/shared/plans/clarity-console-part-2.md`, slice B.
 */

export interface Theme {
  slug: string;
  title: string;
  description: string | null;
  /**
   * Question subjects from `v_clarity_board_cards`. Several themes map to none, and that is the
   * honest state, not a gap to be filled with a borrowed number — an empty key-numbers slot is an
   * advertisement for which question to register next.
   */
  questionSubjects: readonly string[];
  /**
   * Topic tags on `justice_funding.topics`. Present only for the sector themes; the power themes
   * genuinely have none, and their pages must say why rather than showing a figure. Unused until
   * slice C.
   */
  topicTags: readonly string[];
  /** ACT project codes that work in this area. A judgement about our work, hand-declared. */
  actProjectCodes: readonly string[];
  /**
   * Whether review-status reports may be LINKED here, or only counted.
   *
   * Accountability & Power holds 10 of the 20 review-status reports and its subjects are named
   * individuals and their board seats. A framing-unreviewed report about disability funding is a
   * quality problem; a framing-unreviewed report naming people is a defamation problem — the same
   * reasoning that refused the ministerial-diaries question outright.
   */
  reviewPolicy: 'link-with-warning' | 'count-only';
}

/**
 * Hand-written, deliberately. A theme's question subjects and project codes are judgements, and a
 * rule that derived them would be wrong quietly. Themes absent from this map render their reports
 * and nothing else.
 */
const THEME_META: Record<
  string,
  Pick<Theme, 'questionSubjects' | 'topicTags' | 'actProjectCodes' | 'reviewPolicy'>
> = {
  'youth-justice': {
    questionSubjects: ['JUSTICE'],
    topicTags: ['youth-justice', 'diversion'],
    actProjectCodes: ['ACT-JH'],
    reviewPolicy: 'link-with-warning',
  },
  'child-protection': {
    questionSubjects: [],
    topicTags: ['child-protection', 'family-services'],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
  disability: {
    questionSubjects: [],
    topicTags: ['ndis'],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
  education: {
    questionSubjects: [],
    topicTags: [],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
  'cross-system': {
    questionSubjects: ['EVIDENCE'],
    topicTags: ['prevention', 'community-led'],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
  'accountability-power': {
    questionSubjects: ['POWER'],
    topicTags: [],
    actProjectCodes: [],
    reviewPolicy: 'count-only',
  },
  'funding-equity': {
    questionSubjects: ['MONEY', 'PLACE'],
    topicTags: [],
    actProjectCodes: ['ACT-CORE'],
    reviewPolicy: 'link-with-warning',
  },
  'social-sector': {
    questionSubjects: ['CHARITY'],
    topicTags: ['legal-services'],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
  'philanthropy-corporate': {
    questionSubjects: ['MONEY'],
    topicTags: [],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
  'research-procurement': {
    questionSubjects: [],
    topicTags: [],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
  'data-system': {
    // HOUSE questions are about our own estate, not about the world. They are `operator` tier and
    // must not render publicly — see lib/visibility.ts.
    questionSubjects: ['HOUSE'],
    topicTags: [],
    actProjectCodes: [],
    reviewPolicy: 'link-with-warning',
  },
};

/** Sections that are curated shortcuts rather than subjects. They get no theme page. */
const NOT_A_THEME = new Set(['Current Map', 'State Dashboards']);

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ThemeReport {
  label: string;
  href: string;
  status: ReportStatus;
  /** Depth in the nav tree — top-level items lead, children indent. */
  depth: number;
}

/** Flattens the nav tree. A child with no status inherits its parent's. */
function flatten(items: readonly NavItem[], depth = 0, inherited: ReportStatus = 'reference'): ThemeReport[] {
  const out: ThemeReport[] = [];
  for (const item of items) {
    const status = item.status ?? inherited;
    out.push({ label: item.label, href: item.href, status, depth });
    if (item.children?.length) out.push(...flatten(item.children, depth + 1, status));
  }
  return out;
}

export function allThemes(): Theme[] {
  return reportSections
    .filter((s) => !NOT_A_THEME.has(s.title))
    .map((s) => {
      const slug = slugify(s.title);
      const meta = THEME_META[slug] ?? {
        questionSubjects: [],
        topicTags: [],
        actProjectCodes: [],
        reviewPolicy: 'link-with-warning' as const,
      };
      return { slug, title: s.title, description: s.description ?? null, ...meta };
    });
}

export function themeBySlug(slug: string): Theme | null {
  return allThemes().find((t) => t.slug === slug) ?? null;
}

export function reportsForTheme(slug: string): ThemeReport[] {
  const section = reportSections.find((s) => slugify(s.title) === slug);
  if (!section) return [];
  // De-duplicate by href: a section can list the same page twice (an Overview that is also the
  // parent of its own children). Keep the first, which carries the shallower depth.
  const seen = new Set<string>();
  return flatten(section.items).filter((r) => {
    if (seen.has(r.href)) return false;
    seen.add(r.href);
    return true;
  });
}

export const STATUS_BADGE: Record<ReportStatus, { label: string; tone: 'ok' | 'muted' | 'warn' }> = {
  current: { label: 'Current', tone: 'ok' },
  reference: { label: 'Reference', tone: 'muted' },
  review: { label: 'Needs review', tone: 'warn' },
  archive: { label: 'Archive', tone: 'muted' },
};
