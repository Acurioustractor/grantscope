/**
 * THE WRITING RULE (Ben, 2026-08-17): purposes are written in real-work language, for someone
 * outside the building. Say what a row is or what question it answers in the world (money,
 * boards, places, evidence, consent), never in database terms. The technical name is already
 * on screen as small print; the purpose is the human half. A purpose that needs a glossary
 * has failed.
 *
 * The curated fields inline edit can write, and nothing else. Everything measured (row counts,
 * refs, freshness, access) is written by probes and scanners; letting the edit path near those
 * would let documentation overwrite measurement. The four prose fields are the 667-stub gap the
 * plan calls the write path's reason to exist.
 */
export const CURATED_FIELDS = ['purpose', 'caveat', 'grain', 'join_keys'] as const;
export type CuratedField = (typeof CURATED_FIELDS)[number];

export const CURATED_MAX_LEN = 8000;

export function isCuratedField(v: unknown): v is CuratedField {
  return typeof v === 'string' && (CURATED_FIELDS as readonly string[]).includes(v);
}

/**
 * Normalise an incoming value: trim, empty becomes null (an empty purpose is the ABSENCE of a
 * purpose, and the stub logic depends on null meaning that), reject over-length rather than
 * silently truncating someone's writing.
 */
export function normaliseCuratedValue(
  v: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false, error: 'value must be a string or null' };
  const trimmed = v.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.length > CURATED_MAX_LEN) {
    return { ok: false, error: `value exceeds ${CURATED_MAX_LEN} characters — not truncating your writing` };
  }
  return { ok: true, value: trimmed };
}
