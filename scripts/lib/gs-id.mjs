/**
 * The one definition of a CivicGraph entity id.
 *
 * Written for #324. Before this, `makeGsId` existed SEVEN times across scripts/ with seven
 * different signatures (build-entity-graph, resolve-donor-entities, import-lobbying-register,
 * import-modern-slavery, ingest-ndis-providers, backfill-qgip-abns, link-entities-mega). Entity
 * identity being defined seven ways is the root of the drift measured in #324: 771 government
 * bodies carrying two identities across 45,220 edges.
 *
 * Two rules this enforces that the old copies did not:
 *
 * 1. AN INVALID ABN IS NOT AN IDENTIFIER. The old code did `if (abn) return 'AU-ABN-' + abn`,
 *    so `abn = '0'` minted an entity, and `Saxonvale` ended up merged with
 *    `112 Trenerry Crescent Pty Ltd` across 2,959 edges. 92 entities currently hold an ABN that is
 *    not 11 digits, including the literal strings `#N/A`, `#VALUE!` and `(blank)` — Excel errors
 *    that travelled all the way into entity identity. An invalid ABN now falls through to the next
 *    identifier instead of becoming one.
 *
 *    Checked with the real ATO checksum, not just a length test. The 51 ten-digit values were
 *    tested against the hypothesis that a leading zero had been stripped: ZERO validate when
 *    zero-padded, so they are corrupt rather than recoverable.
 *
 * 2. THE FALLBACK MUST BE DETERMINISTIC. The old final branch was
 *    `return 'AU-UNK-' + Date.now().toString(36)`, which mints a different id on every call for
 *    the same input — a guaranteed duplicate generator. No `AU-UNK-` rows exist today, so it never
 *    fired, but it was one empty name field away from doing so. It now throws instead: a record
 *    with no identifier at all is a caller bug, not something to paper over with a clock reading.
 */

/** ATO's ABN check: subtract 1 from the first digit, weight, sum, mod 89. */
export function isValidAbn(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const digits = String(value).replace(/[^0-9]/g, '');
  if (!/^[0-9]{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits
    .split('')
    .reduce((acc, d, i) => acc + (i === 0 ? Number(d) - 1 : Number(d)) * weights[i], 0);
  return sum % 89 === 0;
}

/** ACNs are 9 digits. Length only — the ACN checksum is a separate algorithm and not needed here. */
export function isValidAcn(value) {
  if (value == null) return false;
  return /^[0-9]{9}$/.test(String(value).replace(/[^0-9]/g, ''));
}

export function normaliseAbn(value) {
  return String(value ?? '').replace(/[^0-9]/g, '');
}

/** Stable 36-base hash of a name. Deterministic for a given string, unlike the old clock fallback. */
export function nameHash(name) {
  const upper = String(name).toUpperCase().trim();
  let hash = 0;
  for (let i = 0; i < upper.length; i++) {
    hash = ((hash << 5) - hash) + upper.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Preference order: ABN, ACN, ORIC, ASX, government buyer id, name.
 * Throws when a record carries no identifier of any kind.
 */
export function makeGsId({ abn, acn, icn, asx_code, buyer_id, name } = {}) {
  if (isValidAbn(abn)) return 'AU-ABN-' + normaliseAbn(abn);
  if (isValidAcn(acn)) return 'AU-ACN-' + String(acn).replace(/[^0-9]/g, '');
  if (icn) return 'AU-ORIC-' + icn;
  if (asx_code) return 'AU-ASX-' + String(asx_code).toUpperCase();
  if (buyer_id) return 'AU-GOV-' + buyer_id;
  if (name && String(name).trim()) return 'AU-NAME-' + nameHash(name);
  throw new Error('makeGsId: record carries no usable identifier (abn/acn/icn/asx/buyer_id/name)');
}
