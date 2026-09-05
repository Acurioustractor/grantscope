import { describe, expect, it } from 'vitest';
import { parseSearchQuery, SEARCH_KINDS } from './search-index';

describe('parseSearchQuery — untrusted input into what the RPC accepts', () => {
  it('needs at least two characters', () => {
    expect(parseSearchQuery({ q: ' a ' })).toBeNull();
    expect(parseSearchQuery({ q: '' })).toBeNull();
    expect(parseSearchQuery({ q: 'ab' })?.q).toBe('ab');
  });
  it('keeps only known kinds and drops the list when none survive', () => {
    expect(parseSearchQuery({ q: 'smith', kinds: 'person,charity,bogus' })?.kinds).toEqual(['person', 'charity']);
    expect(parseSearchQuery({ q: 'smith', kinds: 'bogus' })?.kinds).toBeUndefined();
  });
  it('accepts only real states, upper-cased', () => {
    expect(parseSearchQuery({ q: 'smith', state: 'nt' })?.state).toBe('NT');
    expect(parseSearchQuery({ q: 'smith', state: 'Mars' })?.state).toBeUndefined();
  });
  it('clamps the limit to 1..100 and defaults to 20', () => {
    expect(parseSearchQuery({ q: 'smith' })?.limit).toBe(20);
    expect(parseSearchQuery({ q: 'smith', limit: '500' })?.limit).toBe(100);
    expect(parseSearchQuery({ q: 'smith', limit: '-3' })?.limit).toBe(1);
    expect(parseSearchQuery({ q: 'smith', limit: 'x' })?.limit).toBe(20);
  });
  it('lists every kind the index carries', () => {
    expect(SEARCH_KINDS).toContain('grant_round');
    expect(SEARCH_KINDS).toContain('place');
    expect(SEARCH_KINDS).toContain('postcode');
    expect(SEARCH_KINDS.length).toBe(12);
  });
});
