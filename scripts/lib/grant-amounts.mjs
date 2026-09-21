/**
 * Deciding whether a number on a funder's page is a grant amount.
 *
 * Why (2026-09-21): grant_opportunities.amount_min/max are INTEGER while
 * foundation_programs.amount_* are NUMERIC, so a fractional value failed the
 * whole row — "invalid input syntax for type integer: 0.5". Rounding would have
 * stopped the crash and kept a wrong number, which is worse, because the values
 * that crashed are not grant amounts at all:
 *
 *   Swinburne International Excellence    10-75   percent of tuition fees
 *   Underworld Laser tag Menai (1 hour)      20   a ticket price
 *   Kawangware School Sponsorship            30   a monthly donation
 *   Back to School Program                   50   a voucher value
 *   Computational & Algorithmic Thinking    9.3   an entry fee
 *
 * That matters beyond tidiness: an amount is one of the three things that make
 * a programme "grant-like", so a $20 laser tag ticket was helping promote a
 * fundraising event onto the desk — the Lions Biggest BBQ bug arriving through
 * the amount field instead of the deadline field.
 *
 * MIN_PLAUSIBLE_GRANT is measured, not guessed. Every foundation_programs value
 * below 100 is in the junk class above; from 100 up they read as real
 * micro-grants ($100, $150, $250, and $500 on 18 rows). Scholarship rows above
 * the floor that are really percentages are caught by applicant_type
 * ('individual'), not by this.
 */

// Re-measure before nudging this:
//   SELECT coalesce(amount_max, amount_min) amt, count(*) FROM foundation_programs
//   WHERE coalesce(amount_max, amount_min) < 1000 GROUP BY 1 ORDER BY 1;
export const MIN_PLAUSIBLE_GRANT = 100;

/**
 * @returns {number|null} a whole-dollar amount, or null when the number cannot
 *          be a grant amount. Null is a correct answer.
 */
export function normalizeGrantAmount(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < MIN_PLAUSIBLE_GRANT) return null;
  return Math.round(n);
}

/** Does this programme carry an amount that could actually be a grant? */
export function hasPlausibleAmount(program) {
  return normalizeGrantAmount(program?.amount_min) !== null
    || normalizeGrantAmount(program?.amount_max) !== null;
}
