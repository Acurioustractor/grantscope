/**
 * Goods on Country — tranche traceability, pure rollup logic.
 *
 * A "tranche" is one paid Xero ACT-GD invoice: a dated slug of money from a
 * named funder on a known funding track. This module holds only the pure
 * functions that turn raw tranche rows into the rollups the Proof Pack and the
 * Money page render. No database, no React — so it can be unit tested directly.
 *
 * Allocation note: every seeded tranche has a NULL `allocation`. Until curation
 * fills that in, dollars trace to funders, not yet to specific deployments on
 * Country. allocationStats makes that honesty computable, never hardcoded.
 */

/** The four ways money reaches Goods. Kept distinct, never lumped together. */
export type FundingTrack = 'grant' | 'investment' | 'procurement' | 'support';

/** One raw tranche row, as fetched from goods_tranches. */
export interface TrancheRow {
  id: string;
  relationship_id: string | null;
  funder_name: string;
  xero_invoice_number: string | null;
  amount_aud: number | string | null;
  invoice_date: string | null;
  funding_track: FundingTrack | string | null;
  purpose: string | null;
  allocation: unknown | null;
  source: string | null;
  notes: string | null;
}

/** One funder's worth of tranches, rolled up. */
export interface FunderRollup {
  funderName: string;
  count: number;
  total: number;
  /** The dominant track for this funder (first track seen, all rows usually agree). */
  track: FundingTrack | string;
  /** ISO date of the earliest tranche, or null if none of the rows are dated. */
  earliestDate: string | null;
  /** ISO date of the latest tranche, or null if none of the rows are dated. */
  latestDate: string | null;
  /** The linked goods_relationships id, if this funder's tranches carry one. */
  relationshipId: string | null;
}

/** One track's total across all funders. */
export interface TrackRollup {
  track: FundingTrack | string;
  count: number;
  total: number;
}

/** How many tranche dollars are curated to a deployment versus still only funder-traced. */
export interface AllocationStats {
  /** Count of tranches with a non-null, non-empty allocation. */
  allocated: number;
  /** Count of tranches with a null / empty allocation. */
  unallocated: number;
  /** Total tranche count. */
  total: number;
}

/** Coerce a numeric|string|null amount to a finite number, defaulting to 0. */
export function trancheAmount(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? (n as number) : 0;
}

/**
 * Is this allocation curated? True only when allocation is a non-empty object or
 * array. NULL, an empty object, and an empty array all count as unallocated, so
 * the honesty strip cannot be gamed by a placeholder `{}`.
 */
export function isAllocated(allocation: unknown): boolean {
  if (allocation == null) return false;
  if (Array.isArray(allocation)) return allocation.length > 0;
  if (typeof allocation === 'object') return Object.keys(allocation as object).length > 0;
  return false;
}

/** Pick the earlier of two ISO dates, treating null as "no opinion". */
function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

/** Pick the later of two ISO dates, treating null as "no opinion". */
function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Roll tranche rows up by funder. Funders are returned sorted by total received
 * descending, so the biggest backers lead the Proof Pack. The relationshipId is
 * the first non-null relationship_id seen for that funder.
 */
export function rollupByFunder(rows: TrancheRow[]): FunderRollup[] {
  const map = new Map<string, FunderRollup>();
  for (const row of rows) {
    const key = row.funder_name;
    const amount = trancheAmount(row.amount_aud);
    const track = (row.funding_track ?? 'support') as FundingTrack | string;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += amount;
      existing.earliestDate = earlier(existing.earliestDate, row.invoice_date);
      existing.latestDate = later(existing.latestDate, row.invoice_date);
      if (!existing.relationshipId && row.relationship_id) existing.relationshipId = row.relationship_id;
    } else {
      map.set(key, {
        funderName: key,
        count: 1,
        total: amount,
        track,
        earliestDate: row.invoice_date ?? null,
        latestDate: row.invoice_date ?? null,
        relationshipId: row.relationship_id ?? null,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.total - a.total || a.funderName.localeCompare(b.funderName),
  );
}

/**
 * Roll tranche rows up by funding track. Tracks are returned sorted by total
 * descending. This keeps philanthropy, investment, procurement and support
 * money in separate columns, never summed into one misleading figure.
 */
export function rollupByTrack(rows: TrancheRow[]): TrackRollup[] {
  const map = new Map<string, TrackRollup>();
  for (const row of rows) {
    const track = (row.funding_track ?? 'support') as FundingTrack | string;
    const amount = trancheAmount(row.amount_aud);
    const existing = map.get(track);
    if (existing) {
      existing.count += 1;
      existing.total += amount;
    } else {
      map.set(track, { track, count: 1, total: amount });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.total - a.total || String(a.track).localeCompare(String(b.track)),
  );
}

/** Count allocated versus unallocated tranches across the whole register. */
export function allocationStats(rows: TrancheRow[]): AllocationStats {
  let allocated = 0;
  for (const row of rows) if (isAllocated(row.allocation)) allocated += 1;
  return { allocated, unallocated: rows.length - allocated, total: rows.length };
}

/** Grand total of every tranche amount. */
export function tranchesTotal(rows: TrancheRow[]): number {
  return rows.reduce((sum, row) => sum + trancheAmount(row.amount_aud), 0);
}

/** Human label for a funding track. */
export const TRACK_LABEL: Record<string, string> = {
  grant: 'Grant',
  investment: 'Investment',
  procurement: 'Procurement',
  support: 'Support',
};

export function trackLabel(track: FundingTrack | string): string {
  return TRACK_LABEL[track] ?? track.charAt(0).toUpperCase() + track.slice(1);
}
