/**
 * GHL tag registry — the single allowed vocabulary for contact tags.
 *
 * The rule: tags answer only "who is this to us" and "how warm". Everything
 * else lives in a better-suited GHL feature:
 *   - relationship stage  → pipeline/opportunity stage
 *   - comms membership    → smart lists queried from role + warmth
 *   - provenance          → the contact `source` field
 *   - instrument/ask size → opportunity custom fields
 *
 * Import/sync scripts must validate tags with validateTags() before writing.
 * Adding a tag family means editing this file — that friction is the point.
 * Deprecated families listed below are flagged by the audit script
 * (scripts/audit-ghl-tags.mjs) and are queued for collapse/removal.
 */

/** Exactly one warmth tag per contact. Sync scripts REPLACE, never append. */
export const WARMTH_TAGS = [
  'goods-hot',
  'goods-warm',
  'goods-steady',
  'goods-cooling',
  'goods-cold',
];

/** What this contact is to us. Multiple allowed (a funder can also advocate). */
export const ROLE_TAGS = [
  'role:funder',
  'role:buyer',
  'role:supplier',
  'role:partner',
  'role:supporter',
  'role:advocate',
  'role:media',
  'role:political',
  'role:funder-network',
];

/** Which ACT project(s) this contact belongs to. */
export const PROJECT_TAG_PREFIX = 'project:';
export const PROJECT_TAGS = [
  'project:act-gd',
  'project:goods-on-country',
  'project:act-jh',
  'project:act-ce',
  'project:act-cn',
  'project:contained',
  'project:contained-adelaide-2026',
];

/**
 * Comms-list membership (newsletter segments). Decision 2026-08-06 (Ben):
 * comms:* is UN-deprecated — it is the newsletter membership family from
 * act-global-infrastructure wiki/decisions/act-site-form-alignment.md §4a.
 * A comms tag is a SEGMENT, not consent: sends require the GHL custom field
 * newsletter_consent=Yes AND no unsubscribe (see newsletter-consent-policy.md).
 * Only these exact tags are allowed; other comms:* are unregistered.
 */
export const COMMS_TAGS = [
  'comms:act-newsletter',
  'comms:goods-newsletter',
  'comms:justicehub-newsletter',
  'comms:harvest-newsletter',
  'comms:do-not-contact',
];

/** Record shape. */
export const RECORD_TAGS = ['record:person', 'record:org'];

/** Working markers — actionable, short-lived, cleared when actioned. */
export const MARKER_TAGS = [
  'needs-followup',
  'needs-enrichment',
  'do-not-contact',
];

/** Campaign tags must be dated (…-YYYY) and deleted after the campaign ends. */
export const CAMPAIGN_TAG_PATTERN = /^campaign:[a-z0-9-]+-20\d{2}$/;

/**
 * Deprecated families. Still on many contacts; do not write them in new code.
 * Collapse plan (in order):
 *   engagement:* + ring:*        → the single goods-* warmth tag
 *   newsletter-stream:*           → the allowed comms:* newsletter tags
 *   source:*                      → the contact `source` field
 *   scope:*                       → project:* tags
 *   campaign-stage:*              → pipeline stage or a dated campaign tag
 *   instrument:* + qbe-*          → opportunity custom fields
 */
export const DEPRECATED_PREFIXES = [
  'engagement:',
  'ring:',
  'newsletter-stream:',
  'source:',
  'scope:',
  'campaign-stage:',
  'instrument:',
  'org-link:',
];

const EXACT_ALLOWED = new Set([
  ...WARMTH_TAGS,
  ...ROLE_TAGS,
  ...PROJECT_TAGS,
  ...COMMS_TAGS,
  ...RECORD_TAGS,
  ...MARKER_TAGS,
]);

export function classifyTag(tag) {
  const t = tag.toLowerCase().trim();
  if (EXACT_ALLOWED.has(t)) return 'allowed';
  if (t.startsWith(PROJECT_TAG_PREFIX)) return 'allowed'; // new project codes are fine
  if (CAMPAIGN_TAG_PATTERN.test(t)) return 'allowed';
  if (DEPRECATED_PREFIXES.some((p) => t.startsWith(p))) return 'deprecated';
  return 'unregistered';
}

/**
 * Validate a tag list before writing to GHL.
 * Returns { ok, errors } — errors on any deprecated/unregistered tag or
 * zero/multiple warmth tags. Sync scripts should refuse to write on !ok.
 */
export function validateTags(tags) {
  const errors = [];
  for (const tag of tags) {
    const cls = classifyTag(tag);
    if (cls !== 'allowed') errors.push(`${cls} tag: "${tag}"`);
  }
  const warmthCount = tags.filter((t) => WARMTH_TAGS.includes(t.toLowerCase().trim())).length;
  if (warmthCount > 1) errors.push(`multiple warmth tags (${warmthCount}) — exactly one allowed`);
  return { ok: errors.length === 0, errors };
}
