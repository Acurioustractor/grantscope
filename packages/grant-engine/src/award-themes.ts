/**
 * Phase 6 — award-history themes (the interoperable join axis).
 *
 * TypeScript port of the SQL `award_theme_map()` in
 * supabase/migrations/20260705000000_grant_award_history.sql. Kept byte-for-byte
 * equivalent so a grant's themes derived in the app match the themes the MV aggregated.
 * Pure + I/O-free so it is unit-testable and usable in the scorer without a DB round-trip.
 *
 * If you change the mapping here, change it in the migration too (and vice versa).
 */

const THEME_BY_TOKEN: Record<string, string> = {
  // youth justice (incl. prevention/diversion program space)
  'youth-justice': 'youth-justice',
  'youth-services': 'youth-justice',
  diversion: 'youth-justice',
  prevention: 'youth-justice',
  // child protection / family
  'child-protection': 'child-protection',
  'family-services': 'family-services',
  // legal
  'legal-services': 'legal-services',
  // corrections / community safety
  corrections: 'corrections',
  'community-safety': 'corrections',
  // community (broadest social bucket)
  'community-services': 'community',
  community: 'community',
  'community-led': 'community',
  'community-economic-development': 'community',
  'human-services': 'community',
  // education / health / disability / housing / indigenous
  education: 'education',
  health: 'health',
  disability: 'disability',
  ndis: 'disability',
  housing: 'housing',
  indigenous: 'indigenous',
  aboriginal: 'indigenous',
};

/** Map a raw sector/topic/category/classie token to a canonical theme, or null. */
export function awardThemeMap(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[_\s]+/g, '-');
  return THEME_BY_TOKEN[key] ?? null;
}

/** Distinct, sorted canonical themes for a set of raw tokens. */
export function deriveThemes(tokens: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const tok of tokens) {
    const theme = awardThemeMap(tok);
    if (theme) set.add(theme);
  }
  return [...set].sort();
}

/** A grant's canonical themes, from its classie_subjects / categories / focus_areas. */
export function grantAwardThemes(
  categories?: string[] | null,
  focusAreas?: string[] | null,
  classieSubjects?: string[] | null,
): string[] {
  return deriveThemes([
    ...(classieSubjects ?? []),
    ...(categories ?? []),
    ...(focusAreas ?? []),
  ]);
}
