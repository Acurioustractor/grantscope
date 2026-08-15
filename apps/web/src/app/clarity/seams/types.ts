/**
 * THE SEAMS — slice 5.
 *
 * Every connection in the database, ranked by how much data it is losing right
 * now. A map answers "is it connected?", which with 638 declared foreign keys is
 * almost always yes and almost never interesting.
 */
export interface SeamRow {
  id: number;
  mechanism: string;
  src_object: string;
  src_column: string;
  tgt_object: string;
  tgt_column: string;
  declared: boolean;
  match_rate: number | null;
  match_numerator: number | null;
  match_denominator: number | null;
  match_method: string | null;
  match_measured_at: string | null;
  rows_at_stake: number | null;
  grain: string | null;
  note: string | null;
  rows_losing: number | null;
  match_delta: number | null;
  src_domain: string | null;
  tgt_domain: string | null;
}

export type SeamState =
  | 'dead'
  | 'poor'
  | 'fair'
  | 'good'
  | 'never_populated'
  | 'unmeasured'
  | 'refused';

/**
 * Six states, and three of them are different kinds of "no number". Collapsing
 * any pair would tell a lie the first sweep caught immediately:
 *
 *   unmeasured      — we have never looked
 *   never_populated — we looked; the key column holds no values at all. A
 *                     declared bridge nobody ever filled in, like
 *                     nz_charities.gs_entity_id: 0 of 45,192 rows.
 *   dead            — we looked; keys exist and NONE of them resolve
 *
 * The first draft of this function mapped all three to `unmeasured` because all
 * three have a null match_rate, which would have hidden every never-populated
 * bridge in the database behind "not measured yet".
 */
export function seamState(r: SeamRow): SeamState {
  if (r.match_method && /^(timeout|error)/.test(r.match_method)) return 'refused';
  if (!r.match_measured_at) return 'unmeasured';
  if (r.match_rate === null) return 'never_populated';
  const rate = Number(r.match_rate);
  if (rate === 0) return 'dead';
  if (rate < 0.5) return 'poor';
  if (rate < 0.9) return 'fair';
  return 'good';
}

export const STATE_GLYPH: Record<SeamState, { glyph: string; cls: string; label: string }> = {
  dead: { glyph: '×', cls: 'text-bauhaus-red', label: 'Dead — 0% of keys resolve' },
  poor: { glyph: '⚠', cls: 'text-bauhaus-red', label: 'Under half the keys resolve' },
  fair: { glyph: '⚠', cls: 'text-bauhaus-yellow', label: 'Between 50% and 90%' },
  good: { glyph: '█', cls: 'text-bauhaus-black', label: '90% or better' },
  never_populated: {
    glyph: '×',
    cls: 'text-bauhaus-red',
    label: 'Declared but never populated — the key column is entirely empty',
  },
  unmeasured: { glyph: '+', cls: 'text-bauhaus-blue', label: 'Never measured — our omission' },
  refused: { glyph: '?', cls: 'text-bauhaus-yellow', label: 'Probe timed out or errored' },
};

/**
 * A frayed key is a defect no match rate reveals: every key resolves, and each
 * one resolves to several rows, so anything aggregating across the join
 * multiplies its own numbers. mv_funding_by_lga carries 3.16 rows per key.
 */
export function isFrayed(grain: string | null): boolean {
  return Boolean(grain && grain.startsWith('frayed'));
}
