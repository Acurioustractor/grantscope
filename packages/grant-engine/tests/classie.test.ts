import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mapCategoriesToClassie,
  isValidClassieCode,
  sanitizeClassie,
  hasAnyClassie,
  SDGS,
} from '../src/classie';

test('there are exactly the 17 official UN SDGs', () => {
  assert.equal(SDGS.length, 17);
  assert.ok(SDGS.every((s) => /^sdg-\d{1,2}$/.test(s.code)));
});

test('maps internal categories to CLASSIE facets', () => {
  const c = mapCategoriesToClassie(['indigenous', 'regenerative']);
  assert.ok(c.populations.includes('first-nations'));
  assert.ok(c.subjects.includes('environment'));
  assert.ok(c.subjects.includes('agriculture-food'));
  assert.ok(c.sdgs.includes('sdg-13')); // climate action
  assert.ok(c.sdgs.includes('sdg-10')); // reduced inequalities (indigenous)
});

test('deduplicates overlapping mappings', () => {
  const c = mapCategoriesToClassie(['community', 'enterprise']); // both → community-economic-development
  assert.equal(c.subjects.filter((s) => s === 'community-economic-development').length, 1);
});

test('ignores unknown categories', () => {
  const c = mapCategoriesToClassie(['unknown-thing', 'health']);
  assert.deepEqual(c.subjects, ['health']);
  assert.ok(c.sdgs.includes('sdg-3'));
});

test('empty / no-signal categories produce an empty classification', () => {
  const c = mapCategoriesToClassie([]);
  assert.equal(hasAnyClassie(c), false);
});

test('validates codes per facet', () => {
  assert.equal(isValidClassieCode('subject', 'health'), true);
  assert.equal(isValidClassieCode('subject', 'sdg-3'), false);
  assert.equal(isValidClassieCode('sdg', 'sdg-16'), true);
  assert.equal(isValidClassieCode('population', 'first-nations'), true);
  assert.equal(isValidClassieCode('population', 'made-up'), false);
});

test('sanitizeClassie strips invalid LLM-provided codes', () => {
  const c = sanitizeClassie({
    subjects: ['health', 'not-a-subject'],
    populations: ['first-nations'],
    sdgs: ['sdg-3', 'sdg-99'],
  });
  assert.deepEqual(c.subjects, ['health']);
  assert.deepEqual(c.populations, ['first-nations']);
  assert.deepEqual(c.sdgs, ['sdg-3']);
});
