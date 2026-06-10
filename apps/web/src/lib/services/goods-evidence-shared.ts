/**
 * Pure helpers for the Goods Evidence Readiness board.
 *
 * This module mirrors the QBE Diagnostic Artifact Database (12 areas) held in
 * Notion. It holds no I/O: types, ranking, an injectable overdue check, the
 * surface-mapping table that points areas at our live evidence artifacts, and a
 * summariser. The thin service (goods-evidence.ts) supplies the JSON.
 */

export type DiagnosticStatus = 'Strength' | 'Partial' | 'Priority gap' | null;
export type Priority = 'P0' | 'P1' | 'P2' | null;

/** One row of the QBE Diagnostic Artifact Database, as snapshotted from Notion. */
export interface QbeArea {
  number: number;
  area: string;
  diagnosticStatus: DiagnosticStatus;
  buildStatus: string | null;
  priority: Priority;
  timing: string | null;
  due: string | null;
  owner: string | null;
  primaryGap: string | null;
  nextBuild: string | null;
  publicCopyRisk: string | null;
  verifiedNumbers?: string | null;
  notionUrl: string | null;
}

/** A pointer from a diagnostic area to one of our live evidence surfaces. */
export interface SurfaceLink {
  href: string;
  label: string;
}

/**
 * Sort weight for diagnostic status. Higher floats to the top so the most
 * urgent gaps lead the board. Order: Priority gap > Partial > unset > Strength.
 */
export function statusRank(status: DiagnosticStatus): number {
  switch (status) {
    case 'Priority gap':
      return 3;
    case 'Partial':
      return 2;
    case null:
      return 1;
    case 'Strength':
      return 0;
    default:
      return 1;
  }
}

/**
 * True when a due date is strictly before `now` (date-only comparison).
 * `now` is injectable so callers and tests stay deterministic. Empty or
 * malformed dates are never overdue.
 */
export function isOverdue(due: string | null | undefined, now: Date): boolean {
  if (!due) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due);
  if (!m) return false;
  const dueDay = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dueDay < today;
}

/**
 * Area number -> live evidence artifact on CivicGraph. These are the surfaces
 * that make a diagnostic area real rather than asserted. Areas not listed have
 * no live surface yet and return null.
 */
export const SURFACE_MAP: Record<number, SurfaceLink | null> = {
  2: { href: '/proof', label: 'Proof Pack' },
  4: { href: '/money', label: 'Money (Xero reconciliation)' },
  7: { href: '/governance', label: 'Governance panel' },
  9: { href: '/governance', label: 'Governance panel' },
  10: { href: '/campaign', label: 'Match Campaign' },
  11: { href: '/proof', label: 'Cost band on Proof Pack' },
  12: { href: '/campaign', label: 'Match Campaign' },
};

/** Resolve an area's live evidence surface, or null when none is mapped. */
export function surfaceFor(areaNumber: number): SurfaceLink | null {
  return SURFACE_MAP[areaNumber] ?? null;
}

/**
 * Compare two areas for board ordering: most urgent diagnostic status first,
 * then by area number ascending for a stable, readable run.
 */
export function compareAreas(a: QbeArea, b: QbeArea): number {
  const r = statusRank(b.diagnosticStatus) - statusRank(a.diagnosticStatus);
  if (r !== 0) return r;
  return a.number - b.number;
}

export interface EvidenceSummary {
  total: number;
  p0Count: number;
  priorityGaps: number;
  overdueCount: number;
  /** Earliest upcoming or past due date across all areas, or null. */
  nextDue: string | null;
}

/** Roll the 12 areas up into the headline figures the board strip shows. */
export function summarize(areas: QbeArea[], now: Date): EvidenceSummary {
  let p0Count = 0;
  let priorityGaps = 0;
  let overdueCount = 0;
  let nextDue: string | null = null;

  for (const a of areas) {
    if (a.priority === 'P0') p0Count += 1;
    if (a.diagnosticStatus === 'Priority gap') priorityGaps += 1;
    if (isOverdue(a.due, now)) overdueCount += 1;
    if (a.due && (nextDue === null || a.due < nextDue)) nextDue = a.due;
  }

  return { total: areas.length, p0Count, priorityGaps, overdueCount, nextDue };
}
