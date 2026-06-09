/**
 * Goods on Country — Life-event cards ("reasons to reach out"), pure presenter.
 *
 * Slice 5 (life-event half) of the governance + relationship-intelligence layer.
 * Turns the v_goods_life_events rows (most-recent public-record event per
 * entity-linked supporter) into ranked, honest "reason to reach out" cards. The
 * moat: we own these feeds (ACNC filings, AusTender contracts, justice funding),
 * so no new ingestion, no email, no privacy weight.
 *
 * Honesty is load-bearing here (every figure traces to a dated source row):
 *   - A 2026 government contract is genuinely fresh -> "New government contract".
 *   - ACNC filings lag (the newest on record can be a year+ old) so we say
 *     "Latest ACNC return", never "just filed". The freshness tier is computed
 *     from the real event date, not assumed.
 *   - Justice funding is financial-year-grained, so we date it to the FY end and
 *     label it as the coarse signal it is.
 *
 * asOf is always passed in (never read from the clock here) so ranking and
 * freshness are deterministic and unit-testable.
 */

export type LifeEventKind = 'acnc_filing' | 'gov_contract' | 'justice_funding';
export type Freshness = 'new' | 'recent' | 'on-record';

/** A row of v_goods_life_events, camel-cased. */
export interface RawLifeEvent {
  relId: string;
  supporterName: string;
  relationshipType: string;
  warmth: number;
  kind: LifeEventKind;
  eventDate: string | null; // ISO date (date_ais_received / contract_start) or null
  eventFy: string | null; // ACNC ais_year, or justice financial_year
  amount: number | null;
  amount2: number | null; // ACNC revenue_from_government
  periodTo: string | null; // fin_report_to / contract_end (ISO date) or null
  label: string | null; // contract buyer_name / justice program_name
}

export interface LifeEventCard {
  relId: string;
  supporterName: string;
  relationshipType: string;
  warmth: number;
  kind: LifeEventKind;
  kindLabel: string;
  freshness: Freshness;
  when: string; // human date or FY, for the card chip
  headline: string;
  detail: string;
  amount: number | null;
  source: string; // provenance line
  /** Higher = fresher; used for ranking. Days since 1970 of the effective date. */
  sortKey: number;
  /** Other public-record signals this supporter also has, beyond this card. */
  otherSignals: number;
}

const KIND_LABEL: Record<LifeEventKind, string> = {
  acnc_filing: 'ACNC filing',
  gov_contract: 'Government contract',
  justice_funding: 'Justice funding',
};

const SOURCE: Record<LifeEventKind, string> = {
  acnc_filing: 'ACNC Annual Information Statement',
  gov_contract: 'AusTender',
  justice_funding: 'Justice funding ledger',
};

const MS_PER_DAY = 86_400_000;

/** Compact AUD, honest about scale. 407097 -> "$407K", 22219467 -> "$22.2M". */
export function fmtAud(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'undisclosed';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-11-25" -> "25 Nov 2024". Returns null for empty/malformed input. */
export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const mi = Number(mo) - 1;
  if (mi < 0 || mi > 11) return null;
  return `${Number(d)} ${MONTHS[mi]} ${y}`;
}

/** Days since epoch for an ISO date, or null. Used for recency ordering. */
function dayOf(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor(t / MS_PER_DAY);
}

/**
 * Map a financial-year string to its end date (ISO). Tolerant of the shapes the
 * data actually carries: "2024-25" -> 2025-06-30, "2023" -> 2023-06-30,
 * "2022-ongoing" -> 2022-06-30. Returns null when unparseable.
 */
export function fyEndDate(fy: string | null | undefined): string | null {
  if (!fy) return null;
  const lead = /^(\d{4})/.exec(fy);
  if (!lead) return null;
  const startYear = Number(lead[1]);
  const range = /^(\d{4})-(\d{2,4})\b/.exec(fy);
  if (range) {
    const tail = range[2];
    const endYear = tail.length === 2 ? Number(`${lead[1].slice(0, 2)}${tail}`) : Number(tail);
    const year = Number.isFinite(endYear) && endYear >= startYear ? endYear : startYear + 1;
    return `${year}-06-30`;
  }
  // Single year ("2023") or a non-numeric tail ("2022-ongoing"): use the lead year's FY end.
  return `${startYear}-06-30`;
}

/** The date that drives recency for a card: precise where we have it, FY-end otherwise. */
export function effectiveDate(raw: RawLifeEvent): string | null {
  if (raw.eventDate) return raw.eventDate;
  if (raw.kind === 'justice_funding') return fyEndDate(raw.eventFy);
  return null;
}

/** Whole months from `from` to `asOf` (negative when `from` is in the future). */
export function monthsAgo(fromIso: string | null, asOf: Date): number {
  const t = fromIso ? Date.parse(fromIso) : NaN;
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (asOf.getTime() - t) / (MS_PER_DAY * 30.437);
}

/** Freshness tier from the effective date. Future or <=8mo is new; <=24mo recent. */
export function freshnessFor(raw: RawLifeEvent, asOf: Date): Freshness {
  const m = monthsAgo(effectiveDate(raw), asOf);
  if (m <= 8) return 'new'; // includes future-dated contract starts (negative months)
  if (m <= 24) return 'recent';
  return 'on-record';
}

function govSharePct(amount: number | null, govAmount: number | null): number | null {
  if (!amount || amount <= 0 || govAmount == null || govAmount <= 0) return null;
  return Math.round((govAmount / amount) * 100);
}

function contractHeadline(freshness: Freshness): string {
  if (freshness === 'new') return 'New government contract';
  if (freshness === 'recent') return 'Recent government contract';
  return 'Government contract on record';
}

/** Build a single, honest card from a raw event. */
export function buildCard(raw: RawLifeEvent, asOf: Date): LifeEventCard {
  const freshness = freshnessFor(raw, asOf);
  const eff = effectiveDate(raw);
  const sortKey = dayOf(eff) ?? Number.NEGATIVE_INFINITY;

  let headline: string;
  let detail: string;
  let when: string;

  if (raw.kind === 'acnc_filing') {
    const filed = fmtDate(raw.eventDate);
    const pct = govSharePct(raw.amount, raw.amount2);
    headline = 'Latest ACNC return';
    when = raw.eventFy ? `FY${raw.eventFy}` : 'latest';
    detail =
      `${fmtAud(raw.amount)} revenue` +
      (pct != null ? `, ${pct}% from government` : '') +
      (filed ? `, filed ${filed}` : '');
  } else if (raw.kind === 'gov_contract') {
    const started = fmtDate(raw.eventDate);
    headline = contractHeadline(freshness);
    when = started ?? '';
    detail =
      `${fmtAud(raw.amount)} from ${raw.label ?? 'a government buyer'}` +
      (started ? `, beginning ${started}` : '');
  } else {
    headline = 'Justice funding';
    when = raw.eventFy ? `FY${raw.eventFy}` : 'latest';
    detail = `${fmtAud(raw.amount)}` + (raw.label ? `, ${raw.label}` : '');
  }

  return {
    relId: raw.relId,
    supporterName: raw.supporterName,
    relationshipType: raw.relationshipType,
    warmth: Number(raw.warmth) || 0,
    kind: raw.kind,
    kindLabel: KIND_LABEL[raw.kind],
    freshness,
    when,
    headline,
    detail,
    amount: raw.amount,
    source: SOURCE[raw.kind],
    sortKey,
    otherSignals: 0,
  };
}

/**
 * One card per supporter: the freshest event wins, and we note how many other
 * public-record signals that supporter also has. Keeps the feed about people,
 * not rows. Pure + deterministic (stable tiebreak on kind then name).
 */
export function bestCardPerSupporter(raws: RawLifeEvent[], asOf: Date): LifeEventCard[] {
  const byRel = new Map<string, RawLifeEvent[]>();
  for (const r of raws ?? []) {
    const list = byRel.get(r.relId);
    if (list) list.push(r);
    else byRel.set(r.relId, [r]);
  }
  const cards: LifeEventCard[] = [];
  for (const list of byRel.values()) {
    const built = list.map((r) => buildCard(r, asOf));
    built.sort((a, b) => b.sortKey - a.sortKey || a.kind.localeCompare(b.kind));
    const best = built[0];
    best.otherSignals = built.length - 1;
    cards.push(best);
  }
  return cards;
}

export interface ReasonsToReachOut {
  cards: LifeEventCard[];
  summary: { supporters: number; fresh: number; feeds: Record<LifeEventKind, number> };
}

/**
 * The ranked "reasons to reach out" feed: freshest reason per supporter first.
 * `cap` bounds the visible cards; the summary always reflects the full set so
 * the page never silently implies it covered everything.
 */
export function pickReasonsToReachOut(raws: RawLifeEvent[], asOf: Date, cap = 12): ReasonsToReachOut {
  const all = bestCardPerSupporter(raws ?? [], asOf);
  all.sort(
    (a, b) =>
      b.sortKey - a.sortKey ||
      b.warmth - a.warmth ||
      a.supporterName.localeCompare(b.supporterName),
  );
  const feeds: Record<LifeEventKind, number> = { acnc_filing: 0, gov_contract: 0, justice_funding: 0 };
  for (const r of raws ?? []) feeds[r.kind] = (feeds[r.kind] ?? 0) + 1;
  return {
    cards: all.slice(0, cap),
    summary: { supporters: all.length, fresh: all.filter((c) => c.freshness === 'new').length, feeds },
  };
}
