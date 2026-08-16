import type { Visibility } from '@/lib/visibility';

/**
 * The visibility floor for a catalogued object.
 *
 * SAFE BY DEFAULT
 *
 * Every catalogued object defaults to `operator`. Nothing in the catalogue is `public` unless a
 * surface deliberately promotes it. That inversion is the point: a rule that misses something
 * yields a thing that is merely unpublished, never a thing that is exposed. Getting the floor
 * wrong should cost visibility, not consent.
 *
 * `withheld` therefore carries the only precision burden — it means "not even an operator sees the
 * rows" — and it is an explicit list rather than a pattern.
 *
 * WHY NOT A NAME PATTERN
 *
 * Two failures, found while building this:
 *
 *   Over-capture. `history` contains `story`. A pattern matching /story/ silently withholds
 *   `subscription_history`, `communications_history`, `clarity_object_history`,
 *   `receipt_match_history` and `project_health_history` — none of which are anybody's story.
 *
 *   Under-capture. `quotes` contains none of the obvious words and is consent-governed.
 *
 * WHY NOT DOMAIN ALONE
 *
 * `storytelling_consent` covers 22 of the consent-governed objects and misses four that sit in
 * other domains or none: `story_analysis` and `transcript_analysis` (`ai_agents_pipeline`),
 * `tour_stories` (`media_narrative`), and `partner_storytellers_v` (undomained). Derived analysis
 * of a transcript is still the storyteller's, and a view over storytellers is still storytellers.
 *
 * So: domain OR explicit list, and the list is short enough to review by eye.
 */

/** The domain whose every object is consent-governed. */
const WITHHELD_DOMAIN = 'storytelling_consent';

/**
 * Consent-governed objects living outside that domain. Verified individually 2026-08-16 — each
 * carries story content or identifies storytellers, regardless of which domain it was filed under.
 *
 * Add to this list when a new one appears; the cost of a wrong addition is that operators cannot
 * browse a table, which is cheap. The cost of a wrong omission is a person's story rendered to
 * someone they never agreed to.
 */
const WITHHELD_OBJECTS: ReadonlySet<string> = new Set([
  'story_analysis',
  'transcript_analysis',
  'tour_stories',
  'partner_storytellers_v',
]);

export interface FloorInput {
  object_name: string;
  domain: string | null;
}

/**
 * KNOWN LIMIT — this floor is binary and consent is not.
 *
 * `transcripts` carries its own caveat in the catalogue: "Highest-sensitivity content in the
 * shard: raw first-person transcripts. Five distinct consent flags (consent_for_ai_analysis,
 * _quote_extraction, _theme_analysis, _story_creation) must each be honoured independently."
 *
 * So a storyteller may have consented to theme analysis and not to quote extraction, and this
 * function cannot express that. Withheld-for-everything is the SAFE direction to be wrong in, so
 * the binary stands for now — but any surface that wants to use consent-governed data for a
 * specific purpose must read those flags per row, not ask this function. The row viewer is where
 * that becomes real; see clarity-console.md slice 5.
 */
export function floorFor(o: FloorInput): Visibility {
  if (o.domain === WITHHELD_DOMAIN) return 'withheld';
  if (WITHHELD_OBJECTS.has(o.object_name)) return 'withheld';
  return 'operator';
}

/**
 * Why an object is withheld, rendered on the card. Absence is always stated, never silent — and a
 * reason that names the mechanism is the difference between a refusal and a bug.
 */
export function floorReason(o: FloorInput): string | null {
  if (o.domain === WITHHELD_DOMAIN) {
    return 'consent-governed: filed under storytelling_consent';
  }
  if (WITHHELD_OBJECTS.has(o.object_name)) {
    return `consent-governed: holds story content or identifies storytellers, despite being filed under ${
      o.domain ? o.domain.replace(/_/g, ' ') : 'no domain'
    }`;
  }
  return null;
}
