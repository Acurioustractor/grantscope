import { describe, expect, it } from 'vitest';
import { NOUN_ORDER, SECTOR_DOMAINS, nounFor, parseSort, unfiledReason } from './nouns';

/**
 * The mapping is the honest core of the index. These tests exist to stop the two failure modes
 * that would quietly ruin it: a domain being guessed into a subject bucket, and the two causes of
 * "unfiled" collapsing into one.
 */
describe('nounFor', () => {
  it('files the unambiguous domains', () => {
    expect(nounFor('grants_funding')).toBe('money');
    expect(nounFor('government_spend_procurement')).toBe('money');
    expect(nounFor('political_influence')).toBe('money');
    expect(nounFor('corporate_registry')).toBe('organisations');
    expect(nounFor('people_directors_governance')).toBe('people');
    expect(nounFor('geography_place')).toBe('places');
    expect(nounFor('storytelling_consent')).toBe('evidence');
    expect(nounFor('platform_ops_auth')).toBe('machine');
  });

  it('never guesses a sector into a subject noun', () => {
    // A sector spans several nouns at once — justice_funding is money, youth-justice entity views
    // are organisations, detention statistics are evidence. Filing the sector under any one of
    // them would be a guess, and this project renders unfiled rather than guessing.
    for (const sector of SECTOR_DOMAINS) {
      expect(nounFor(sector)).toBe('unfiled');
    }
  });

  it('files an object with no domain as unfiled', () => {
    expect(nounFor(null)).toBe('unfiled');
    expect(nounFor(undefined)).toBe('unfiled');
    expect(nounFor('')).toBe('unfiled');
  });

  it('files an unrecognised domain as unfiled rather than into The Machine', () => {
    // The Machine is a noun with a meaning (auth, agents, pipeline). Using it as a catch-all
    // would hide new domains and let the unfiled count — the progress bar — read low.
    expect(nounFor('some_new_domain_shipped_next_week')).toBe('unfiled');
  });
});

describe('unfiledReason', () => {
  it('keeps the two causes of unfiled distinct', () => {
    expect(unfiledReason(null)).toBe('no domain');
    expect(unfiledReason('justice_youth_detention')).toMatch(/^sector: /);
    expect(unfiledReason('child_protection')).toMatch(/^sector: /);
    // Distinct strings, not merely both truthy — collapsing them is the failure being guarded.
    expect(unfiledReason(null)).not.toBe(unfiledReason('justice_youth_detention'));
  });

  it('gives no reason for an object that is filed', () => {
    expect(unfiledReason('grants_funding')).toBeNull();
  });

  it('names an unmapped domain rather than calling it undomained', () => {
    expect(unfiledReason('brand_new_domain')).toBe('domain not mapped: brand new domain');
  });
});

describe('parseSort', () => {
  it('defaults to alphabetical', () => {
    // Stable position beats optimal ranking on a page visited daily; `importance` is tied at
    // 0.0225 for 424 objects and cannot rank anything.
    expect(parseSort(undefined)).toBe('name');
    expect(parseSort('nonsense')).toBe('name');
    expect(parseSort(['rows', 'degree'])).toBe('rows');
    expect(parseSort('degree')).toBe('degree');
  });
});

describe('NOUN_ORDER', () => {
  it('puts The Machine and Unfiled last, so plumbing never leads', () => {
    expect(NOUN_ORDER.slice(-2)).toEqual(['machine', 'unfiled']);
    expect(NOUN_ORDER[0]).toBe('money');
  });
});
