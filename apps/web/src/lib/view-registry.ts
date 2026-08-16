/**
 * The saved-views registry: the typed list of named views pinned to the shell rail.
 *
 * A view = a named, scoped query the dashboard can render and the rail can pin.
 * Registry-in-code first (like the Atlas layer registry); user-created persistence can
 * come later without changing consumers.
 *
 * Grounding: thoughts/shared/data-map/DASHBOARD-VIEW-MAP.md — only views verified
 * runnable in the 2026-08-14 opportunity map belong here. Every money view MUST go
 * through justice-money.ts helpers; person views are count-only (no dollar rollups).
 */

export type ViewColour = 'red' | 'blue' | 'yellow' | 'green' | 'ink';

export interface RegisteredView {
  id: string;
  /** Short rail/card label, plain words. */
  name: string;
  /** One-sentence answer this view gives. */
  question: string;
  /** Where clicking through lands: the view's own page in the shell. */
  href: string;
  /** The deeper report/page this view summarises, linked from the view page. */
  deepHref?: string;
  colour: ViewColour;
  /** Caveat that must ship with the number, verbatim from the data map. Never render the view without it. */
  caveat?: string;
  /** Pinned to the rail by default. */
  pinned?: boolean;
}

export const VIEW_REGISTRY: RegisteredView[] = [
  {
    id: 'youth-justice-money',
    name: 'Youth justice money',
    question: 'Where youth justice grant money went, filtered clean. The headline figure and span come from the live query, never this blurb.',
    href: '/dashboard/views/youth-justice-money',
    deepHref: '/reports/theme/youth-justice',
    colour: 'yellow',
    caveat: 'Grants only: excludes state budget aggregates and source-spreadsheet total rows.',
    pinned: true,
  },
  {
    id: 'acco-share',
    name: 'ACCO share',
    question: 'How much of youth justice money reaches community-controlled organisations.',
    href: '/dashboard/views/acco-share',
    deepHref: '/reports/youth-justice',
    colour: 'blue',
    pinned: true,
  },
  {
    id: 'money-without-evidence',
    name: 'Money vs evidence',
    question: 'Funding to organisations with no recorded evidence of what works, by topic.',
    href: '/dashboard/views/money-without-evidence',
    deepHref: '/clarity?q=evidence-gap',
    colour: 'green',
    caveat: 'Evidence link = ALMA register presence; absence of evidence is not evidence of absence.',
    pinned: true,
  },
  {
    id: 'power-concentration',
    name: 'Power: top 1%',
    question: 'Cross-system power concentration — how much the top 1% of entities hold.',
    href: '/dashboard/views/power-concentration',
    deepHref: '/power',
    colour: 'red',
    caveat: 'Entity-level only. Person-level influence is shown as counts, never dollars.',
    pinned: true,
  },
  {
    id: 'funding-deserts',
    name: 'Funding deserts',
    question: 'High-disadvantage LGAs receiving the least funding.',
    href: '/dashboard/views/funding-deserts',
    deepHref: '/reports/funding-deserts',
    colour: 'ink',
    caveat: 'Desert grain is not unique per LGA — deduplicated by name and state.',
  },
  {
    id: 'board-interlocks',
    name: 'Interlocked boards',
    question: 'Organisations governed by people who sit on multiple boards.',
    href: '/dashboard/views/board-interlocks',
    deepHref: '/reports/board-interlocks',
    colour: 'ink',
    caveat: 'Banded by board count, capped at 10 — above that is the nominee-block artefact.',
  },
];

export const pinnedViews = () => VIEW_REGISTRY.filter((v) => v.pinned);
