/**
 * The row viewer's client-side half: the envelope `clarity_rows` returns, and how a cell of
 * arbitrary jsonb becomes something readable. The GUARD is not here — it is in the RPC
 * (migrations/2026-08-16-clarity-rows-rpc.sql), because the UI is one query parameter away from
 * being bypassed. This module only renders what the database already decided to say.
 */

export interface ConsentFlagCensus {
  flag: string;
  yes: number;
  no: number;
  unrecorded: number;
}

export interface RowsEnvelope {
  allowed: boolean;
  reason?: string;
  rows?: Record<string, unknown>[];
  limit?: number;
  row_count?: number | null;
  consent_census?: ConsentFlagCensus[];
}

/** Runtime shape check — the RPC returns jsonb, and a malformed envelope must read as a failure,
 *  never as an empty-but-allowed result. */
export function parseEnvelope(value: unknown): RowsEnvelope | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.allowed !== 'boolean') return null;
  if (v.allowed && !Array.isArray(v.rows)) return null;
  return v as unknown as RowsEnvelope;
}

/** Column order: first row's key order (jsonb object keys arrive in insertion order from
 *  `to_jsonb`, which follows the column list), unioned with any keys later rows add. */
export function columnsOf(rows: Record<string, unknown>[]): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
    }
  }
  return cols;
}

export const CELL_MAX = 160;

/**
 * A cell is text, truncated honestly. `null` renders as a marker distinct from the empty string —
 * on this project the difference between "unrecorded" and "recorded as nothing" is load-bearing.
 */
export function cellText(value: unknown): { text: string; truncated: boolean; isNull: boolean } {
  if (value === null || value === undefined) return { text: 'null', truncated: false, isNull: true };
  let text: string;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'object') text = JSON.stringify(value);
  else text = String(value);
  if (text.length > CELL_MAX) {
    return { text: `${text.slice(0, CELL_MAX)}…`, truncated: true, isNull: false };
  }
  return { text, truncated: false, isNull: false };
}

/** consent_for_quote_extraction → "quote extraction" */
export function flagLabel(flag: string): string {
  return flag.replace(/^consent_for_/, '').replace(/_/g, ' ');
}
