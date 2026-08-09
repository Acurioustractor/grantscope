// Why an organisation sits on no council's count — the reason codes.
//
// Every gs_entities row without a council carries exactly one lga_source
// reason code (stamped by the 2026-08 placement migrations; zero unstamped
// rows, verified live). The Atlas reads them live so "cannot place" is never
// one opaque percentage: the caveat card and the place panel both say WHY,
// with counts.
//
// Two kinds of reason:
//  - councilPossible: the organisation's postcode ties it to candidate
//    councils, so it appears in per-council breakdowns — counting toward
//    every council that shares the postcode, which is why these can never
//    be summed across councils.
//  - not councilPossible: nothing ties it to any council. These exist only
//    in state and national tallies, and by construction can never appear
//    under any council on the map.

export interface UnplacedReason {
  /** The lga_source code exactly as stamped in the database. */
  code: string;
  /** Plain words for a row label — what a person in a room would say. */
  label: string;
  /** Whether entities with this code can appear in a council's breakdown. */
  councilPossible: boolean;
}

/** Canonical order: national magnitude, largest first (checked 2026-08-09). */
export const UNPLACED_REASONS: readonly UnplacedReason[] = [
  { code: 'no_postcode', label: 'no postcode on the record', councilPossible: false },
  { code: 'unresolved_multi_lga_postcode', label: 'postcode spans several councils', councilPossible: true },
  { code: 'postcode_unmapped_in_abs', label: 'postcode unmappable to one council', councilPossible: true },
  { code: 'unknown_postcode', label: 'postcode we do not recognise', councilPossible: false },
  { code: 'state_conflict', label: 'recorded state disagrees with the postcode', councilPossible: true },
  { code: 'no_state', label: 'no state on the record', councilPossible: true },
];

/** Label for a code, including codes this registry has not met — a new stamp
 * in the database still renders honestly instead of vanishing. */
export function reasonLabel(code: string): string {
  const known = UNPLACED_REASONS.find(r => r.code === code);
  return known ? known.label : code.replace(/_/g, ' ');
}

export interface ReasonRow {
  code: string;
  label: string;
  n: number;
}

/** Rows for a per-council breakdown, biggest first. Zero, negative and
 * non-numeric counts are dropped; null/missing payloads yield no rows. */
export function reasonRows(counts: Record<string, number> | null | undefined): ReasonRow[] {
  if (!counts) return [];
  return Object.entries(counts)
    .map(([code, raw]) => ({ code, label: reasonLabel(code), n: Number(raw) }))
    .filter(r => Number.isFinite(r.n) && r.n > 0)
    .sort((a, b) => b.n - a.n);
}

/** One (state, reason, n) row of the live tally in the map summary. State is
 * null for records that hold no state at all. */
export interface StateReasonCount {
  state: string | null;
  reason: string;
  n: number;
}

/** Scope the live tally to the current state filter. 'ALL' sums every state
 * INCLUDING records with no state — the national number must not quietly
 * drop the stateless. A state filter shows that state's records only. */
export function scopeReasonRows(
  rows: readonly StateReasonCount[] | null | undefined,
  stateFilter: string
): ReasonRow[] {
  if (!rows) return [];
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (stateFilter !== 'ALL' && (row.state ?? '') !== stateFilter) continue;
    const n = Number(row.n);
    if (!Number.isFinite(n) || n <= 0) continue;
    totals.set(row.reason, (totals.get(row.reason) ?? 0) + n);
  }
  return [...totals.entries()]
    .map(([code, n]) => ({ code, label: reasonLabel(code), n }))
    .sort((a, b) => b.n - a.n);
}

/** The reasons that can never appear under any council, scoped to a state.
 * The place panel names these so a council's "cannot place" count is never
 * mistaken for the whole uncertainty. */
export function beyondCouncilRows(
  rows: readonly StateReasonCount[] | null | undefined,
  state: string
): ReasonRow[] {
  const impossible = new Set(
    UNPLACED_REASONS.filter(r => !r.councilPossible).map(r => r.code)
  );
  return scopeReasonRows(rows, state).filter(r => impossible.has(r.code));
}

export function totalOf(rows: readonly ReasonRow[]): number {
  return rows.reduce((sum, r) => sum + r.n, 0);
}

/** Export columns for the council-possible reasons: the raw code is the
 * header suffix on purpose — a data user can grep the database for it. */
export const COUNCIL_REASON_COLUMNS: ReadonlyArray<{ code: string; header: string }> =
  UNPLACED_REASONS.filter(r => r.councilPossible).map(r => ({
    code: r.code,
    header: `unplaced_${r.code}`,
  }));
