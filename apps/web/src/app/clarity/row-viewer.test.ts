import { describe, expect, it } from 'vitest';
import { CELL_MAX, cellText, columnsOf, flagLabel, parseEnvelope } from './row-viewer';

describe('parseEnvelope', () => {
  it('rejects non-objects and missing allowed', () => {
    expect(parseEnvelope(null)).toBeNull();
    expect(parseEnvelope('nope')).toBeNull();
    expect(parseEnvelope({})).toBeNull();
  });

  it('an allowed envelope without rows is malformed, never empty-but-allowed', () => {
    expect(parseEnvelope({ allowed: true })).toBeNull();
    expect(parseEnvelope({ allowed: true, rows: [] })).not.toBeNull();
  });

  it('a refusal needs no rows', () => {
    const e = parseEnvelope({ allowed: false, reason: 'consent-governed', consent_census: [] });
    expect(e).not.toBeNull();
    expect(e?.allowed).toBe(false);
  });
});

describe('columnsOf', () => {
  it('keeps first-row order and unions later keys', () => {
    expect(
      columnsOf([
        { b: 1, a: 2 },
        { a: 1, c: 3 },
      ]),
    ).toEqual(['b', 'a', 'c']);
  });
  it('empty rows → no columns', () => {
    expect(columnsOf([])).toEqual([]);
  });
});

describe('cellText', () => {
  it('null is a marker, not an empty string', () => {
    expect(cellText(null)).toEqual({ text: 'null', truncated: false, isNull: true });
    expect(cellText('')).toEqual({ text: '', truncated: false, isNull: false });
  });
  it('objects stringify, long values truncate with a visible ellipsis', () => {
    expect(cellText({ a: 1 }).text).toBe('{"a":1}');
    const long = cellText('x'.repeat(CELL_MAX + 10));
    expect(long.truncated).toBe(true);
    expect(long.text.endsWith('…')).toBe(true);
    expect(long.text.length).toBe(CELL_MAX + 1);
  });
});

describe('flagLabel', () => {
  it('strips the prefix and underscores', () => {
    expect(flagLabel('consent_for_quote_extraction')).toBe('quote extraction');
    expect(flagLabel('consent_public')).toBe('consent public');
  });
});
