/**
 * Turning an eligibility verdict into a grant_opportunities update.
 *
 * Why the floor (2026-09-21 abstention audit): the enricher's prompt is already
 * correct — "Answer ONLY from the text, if something is not stated use null (do
 * not guess)" — and it asks the model for a confidence from 0 to 1 and for a
 * one-sentence quote from the page. Both were printed to the console and then
 * thrown away. Only the five booleans were written, so a 0.2 verdict landed
 * exactly like a 0.95 one.
 *
 * That matters because these five flags decide whether ACT can apply to a grant
 * at all. A low-confidence `dgr_required: true` silently removes a grant from
 * the desk and nothing downstream can tell it from a certain one.
 *
 * FLOOR is measured over the 337 cached verdicts in data/grant-eligibility-cache.jsonl:
 *
 *   floor   rows below   flags suppressed   of them exclusionary
 *   0.5     124          8                  1
 *   0.7     145          21                 4
 *   0.8     178          50                 7
 *
 * 0.7 removes the four exclusionary answers the model was least sure of while
 * keeping 94% of what it wrote, and it matches the floor the SE classifiers
 * already use. Re-measure before nudging it.
 *
 * Note the model largely self-regulates: below 0.5 it sets 0.1 flags per row,
 * above 0.9 it sets 2.1. The floor is a backstop on the cases where it does not.
 */

export const ELIGIBILITY_CONFIDENCE_FLOOR = 0.7;

const FLAGS = [
  'dgr_required',
  'accepts_charity',
  'accepts_pty_ltd',
  'accepts_sole_trader',
  'accepts_unincorporated',
];

const tri = (v) => (v === true || v === false ? v : null);

/**
 * @param {object} verdict  the model's parsed JSON
 * @param {string|null} provider  which provider answered
 * @param {string} now  ISO timestamp
 * @returns {{ update: object, accepted: boolean, suppressed: number }}
 */
export function buildEligibilityUpdate(verdict, provider, now) {
  const confidence = typeof verdict?.confidence === 'number' && Number.isFinite(verdict.confidence)
    ? Math.min(1, Math.max(0, verdict.confidence))
    : null;
  const accepted = confidence !== null && confidence >= ELIGIBILITY_CONFIDENCE_FLOOR;

  const update = {
    // Always stamped, even when the verdict is refused: we looked, and the page
    // did not say clearly. Without this the row is re-fetched forever.
    eligibility_signals_at: now,
    eligibility_confidence: confidence,
    eligibility_provider: provider || null,
    // The model quotes the page for this on every one of the 337 cached
    // verdicts, and it was being discarded. It is the only thing that lets a
    // human check a flag without re-reading the grant.
    eligibility_summary: typeof verdict?.eligible_summary === 'string' && verdict.eligible_summary.trim()
      ? verdict.eligible_summary.trim().slice(0, 500)
      : null,
  };

  let suppressed = 0;
  for (const flag of FLAGS) {
    const value = tri(verdict?.[flag]);
    if (accepted) {
      update[flag] = value;
    } else {
      // Below the floor every flag stays null. Null already means "the page did
      // not say", which is the honest reading of a verdict we do not trust.
      update[flag] = null;
      if (value !== null) suppressed++;
    }
  }

  return { update, accepted, suppressed };
}
