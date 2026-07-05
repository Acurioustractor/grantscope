import assert from 'node:assert/strict';
import { test } from 'node:test';

import { awardThemeMap, deriveThemes, grantAwardThemes } from '../src/award-themes';
import { applyLearningBoosts, type RawGrantMatch } from '../src/grant-matching';

// ── award_theme_map parity ────────────────────────────────────────────────
// These MUST stay identical to the SQL award_theme_map() in
// supabase/migrations/20260705000000_grant_award_history.sql.

test('awardThemeMap maps justice_funding sectors to canonical themes', () => {
  assert.equal(awardThemeMap('youth_justice'), 'youth-justice');
  assert.equal(awardThemeMap('community_services'), 'community');
  assert.equal(awardThemeMap('legal_services'), 'legal-services');
  assert.equal(awardThemeMap('child_protection'), 'child-protection');
  assert.equal(awardThemeMap('community_safety'), 'corrections');
});

test('awardThemeMap maps topic-style tokens too', () => {
  assert.equal(awardThemeMap('youth-justice'), 'youth-justice');
  assert.equal(awardThemeMap('ndis'), 'disability');
  assert.equal(awardThemeMap('prevention'), 'youth-justice'); // program-space fold-in
  assert.equal(awardThemeMap('community-led'), 'community');
  assert.equal(awardThemeMap('aboriginal'), 'indigenous');
});

test('awardThemeMap normalises case + separators (underscore/space)', () => {
  assert.equal(awardThemeMap('Youth Justice'), 'youth-justice');
  assert.equal(awardThemeMap('COMMUNITY_SERVICES'), 'community');
  assert.equal(awardThemeMap('community   services'), 'community');
});

test('awardThemeMap returns null for unmapped / empty tokens', () => {
  assert.equal(awardThemeMap('arts'), null);
  assert.equal(awardThemeMap('agriculture-food'), null);
  assert.equal(awardThemeMap(''), null);
  assert.equal(awardThemeMap(null), null);
  assert.equal(awardThemeMap(undefined), null);
});

test('deriveThemes dedupes and sorts', () => {
  assert.deepEqual(
    deriveThemes(['youth_justice', 'youth-justice', 'diversion', 'community']),
    ['community', 'youth-justice'],
  );
  assert.deepEqual(deriveThemes(['arts', 'unknown']), []);
});

test('grantAwardThemes derives from classie + categories + focus_areas', () => {
  const themes = grantAwardThemes(['justice', 'community'], ['diversion'], ['human-services']);
  // 'justice' is unmapped; 'community' + 'human-services' → community; 'diversion' → youth-justice
  assert.deepEqual(themes, ['community', 'youth-justice']);
  assert.deepEqual(grantAwardThemes(null, null, null), []);
});

// ── proven-track-record boost in the scorer ───────────────────────────────

function grant(overrides: Partial<RawGrantMatch> = {}): RawGrantMatch {
  return {
    id: overrides.id ?? 'g1',
    name: overrides.name ?? 'Test Grant',
    provider: overrides.provider ?? 'Test Funder',
    description: overrides.description ?? 'A sufficiently long description to avoid the low-quality penalty path.',
    amount_max: overrides.amount_max ?? 50000,
    closes_at: overrides.closes_at ?? null,
    categories: overrides.categories ?? null,
    url: overrides.url ?? 'https://example.org',
    grant_type: overrides.grant_type ?? 'grant',
    status: overrides.status ?? 'open',
    focus_areas: overrides.focus_areas ?? null,
    geography: overrides.geography ?? null,
    similarity: overrides.similarity ?? 0.6,
  };
}

test('proven-theme boost lifts fit_score + adds a signal for a matching grant', () => {
  const g = grant({ categories: ['community'], focus_areas: ['youth-justice'] });

  const base = applyLearningBoosts([g], {}).scored[0];
  const boosted = applyLearningBoosts([g], { provenThemes: ['youth-justice'] }).scored[0];

  assert.ok(boosted.fit_score > base.fit_score, 'boosted score should exceed base');
  assert.ok(
    boosted.match_signals.some((s) => /proven track record in youth justice/i.test(s)),
    'should surface a proven-track-record signal',
  );
});

test('proven-theme boost does NOT fire when the grant is in no proven theme', () => {
  const g = grant({ categories: ['arts'], focus_areas: ['music'] });
  const base = applyLearningBoosts([g], {}).scored[0];
  const withProven = applyLearningBoosts([g], { provenThemes: ['youth-justice'] }).scored[0];

  assert.equal(withProven.fit_score, base.fit_score);
  assert.ok(!withProven.match_signals.some((s) => /proven track record/i.test(s)));
});

test('proven-theme boost is capped (multiple matched themes do not stack unbounded)', () => {
  const g = grant({ categories: ['community', 'health'], focus_areas: ['youth-justice', 'disability'] });
  const boosted = applyLearningBoosts([g], {
    provenThemes: ['community', 'health', 'youth-justice', 'disability'],
  }).scored[0];
  const base = applyLearningBoosts([g], {}).scored[0];
  // cap is +0.06 → at most +6 on the 0..100 fit_score
  assert.ok(boosted.fit_score - base.fit_score <= 6);
  assert.ok(boosted.fit_score > base.fit_score);
});
