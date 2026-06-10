/**
 * Goods on Country — Fused relationship timeline (pure presenter).
 *
 * Slice 5 (timeline half) of the governance + relationship-intelligence layer.
 * For a supporter, fuse the dated record we already hold into one chronological
 * feed: the last GoHighLevel contact, Xero invoices issued, and the public-record
 * life-events (ACNC filings, government contracts, justice funding). The moat is
 * the fusion across systems we own. Email is deferred (privacy), so it is absent.
 *
 * Honesty is load-bearing (it drove the data probe):
 *   - goods_relationships.created_at is a bulk seed date (all rows share it), so
 *     it is NEVER shown as "first touch". Only last_touch_at, which is real GHL
 *     activity, becomes a dated GHL event.
 *   - Xero invoices carry an issue date but no paid date in the sync, so we say
 *     "issued", never "paid".
 *   - Justice funding is financial-year-grained; we date it to the FY end for
 *     ordering and flag it as FY-grained so the card never implies a precise day.
 *   - Xero is matched to a supporter by normalised exact name only. We accept
 *     thinner coverage over false-positive matches.
 *
 * asOf is injected (never read from the clock here) for deterministic tests.
 */

import { fmtAud, fmtDate, fyEndDate } from './goods-life-events-shared';

export type TimelineSource = 'ghl' | 'xero' | 'record';

export interface SupporterInput {
  relId: string;
  name: string;
  relationshipType: string;
  warmth: number;
  stage: string | null;
  lastTouchAt: string | null; // timestamptz or null
}

/** Subset of a v_goods_life_events row, scoped to one supporter. */
export interface TimelineLifeEvent {
  kind: 'acnc_filing' | 'gov_contract' | 'justice_funding';
  eventDate: string | null;
  eventFy: string | null;
  amount: number | null;
  label: string | null; // contract buyer / justice program
}

/** Subset of an ACT-GD ACCREC xero_invoices row, scoped to one supporter. */
export interface TimelineXeroInvoice {
  invoiceNumber: string | null;
  date: string | null; // issue date
  total: number | null;
  status: string | null;
}

export interface TimelineEvent {
  date: string; // YYYY-MM-DD
  source: TimelineSource;
  label: string;
  detail: string;
  amount: number | null;
  /** True when the date is an FY-end approximation, not a precise event day. */
  fyGrained: boolean;
}

export interface SupporterTimeline {
  relId: string;
  name: string;
  relationshipType: string;
  warmth: number;
  stage: string | null;
  stageLabel: string | null;
  events: TimelineEvent[];
  sources: TimelineSource[]; // distinct sources present, for the fusion badge
}

const SOURCE_LABEL: Record<TimelineSource, string> = {
  ghl: 'GoHighLevel',
  xero: 'Xero',
  record: 'Public record',
};

export function sourceLabel(s: TimelineSource): string {
  return SOURCE_LABEL[s];
}

/** Normalised key for matching a Xero contact to a supporter display name. */
export function nameKey(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "in_conversation" -> "In conversation". Honest, just tidied. */
export function prettyStage(stage: string | null | undefined): string | null {
  if (!stage) return null;
  const s = stage.replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

/** First 10 chars of an ISO timestamp/date, or null. */
function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : null;
}

function lifeEventLine(le: TimelineLifeEvent): TimelineEvent | null {
  if (le.kind === 'acnc_filing') {
    const date = dateOnly(le.eventDate);
    if (!date) return null;
    return {
      date,
      source: 'record',
      label: 'ACNC return filed',
      detail: `${le.eventFy ? `FY${le.eventFy}, ` : ''}${fmtAud(le.amount)} revenue`,
      amount: le.amount,
      fyGrained: false,
    };
  }
  if (le.kind === 'gov_contract') {
    const date = dateOnly(le.eventDate);
    if (!date) return null;
    return {
      date,
      source: 'record',
      label: 'Government contract',
      detail: `${fmtAud(le.amount)}${le.label ? ` from ${le.label}` : ''}`,
      amount: le.amount,
      fyGrained: false,
    };
  }
  // justice_funding — FY-grained, date it to the FY end for ordering only.
  const date = dateOnly(le.eventDate) ?? fyEndDate(le.eventFy);
  if (!date) return null;
  return {
    date,
    source: 'record',
    label: 'Justice funding',
    detail: `${le.eventFy ? `FY${le.eventFy}, ` : ''}${fmtAud(le.amount)}${le.label ? `, ${le.label}` : ''}`,
    amount: le.amount,
    fyGrained: !le.eventDate,
  };
}

/**
 * Build one supporter's fused timeline from the three feeds, scoped to them.
 * Events are sorted newest first; undated events are dropped (a timeline needs
 * a date). Pure + deterministic.
 */
export function buildTimeline(
  s: SupporterInput,
  life: TimelineLifeEvent[],
  xero: TimelineXeroInvoice[],
  _asOf: Date,
): SupporterTimeline {
  const events: TimelineEvent[] = [];

  const touch = dateOnly(s.lastTouchAt);
  if (touch) {
    const stageLabel = prettyStage(s.stage);
    events.push({
      date: touch,
      source: 'ghl',
      label: 'Last contact',
      detail: stageLabel ? `Logged in GoHighLevel, now ${stageLabel}` : 'Logged in GoHighLevel',
      amount: null,
      fyGrained: false,
    });
  }

  for (const inv of xero ?? []) {
    const date = dateOnly(inv.date);
    if (!date) continue;
    const status = inv.status ? inv.status.toLowerCase() : null;
    events.push({
      date,
      source: 'xero',
      label: inv.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : 'Invoice issued',
      detail: `${fmtAud(inv.total)} issued${status ? `, ${status}` : ''}`,
      amount: inv.total,
      fyGrained: false,
    });
  }

  for (const le of life ?? []) {
    const ev = lifeEventLine(le);
    if (ev) events.push(ev);
  }

  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const sources = [...new Set(events.map((e) => e.source))];

  return {
    relId: s.relId,
    name: s.name,
    relationshipType: s.relationshipType,
    warmth: Number(s.warmth) || 0,
    stage: s.stage,
    stageLabel: prettyStage(s.stage),
    events,
    sources,
  };
}

/**
 * Rank timelines so the richest fused ones lead: more distinct sources first
 * (that is the showcase), then more events, then warmth, then name. Deterministic.
 */
export function rankTimelines(list: SupporterTimeline[]): SupporterTimeline[] {
  return [...list].sort(
    (a, b) =>
      b.sources.length - a.sources.length ||
      b.events.length - a.events.length ||
      b.warmth - a.warmth ||
      a.name.localeCompare(b.name),
  );
}

export interface TimelineFeed {
  timelines: SupporterTimeline[];
  summary: { shown: number; withFusion: number; total: number };
}

/**
 * Assemble every supporter's timeline, keep those with at least one dated event,
 * rank, and cap. `eventCap` bounds events shown per supporter. The summary always
 * reflects the full set so the page never silently implies it covered everything.
 */
export function assembleTimelines(
  supporters: SupporterInput[],
  lifeByRel: Map<string, TimelineLifeEvent[]>,
  xeroByRel: Map<string, TimelineXeroInvoice[]>,
  asOf: Date,
  cap = 15,
  eventCap = 8,
  minEvents = 1,
): TimelineFeed {
  const built = (supporters ?? [])
    .map((s) => buildTimeline(s, lifeByRel.get(s.relId) ?? [], xeroByRel.get(s.relId) ?? [], asOf))
    .filter((t) => t.events.length >= Math.max(1, minEvents));

  const ranked = rankTimelines(built).map((t) => ({ ...t, events: t.events.slice(0, eventCap) }));
  const withFusion = built.filter((t) => t.sources.length >= 2).length;

  return {
    timelines: ranked.slice(0, cap),
    summary: { shown: Math.min(cap, ranked.length), withFusion, total: built.length },
  };
}
