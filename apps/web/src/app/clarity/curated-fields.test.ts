import { describe, expect, it } from 'vitest';
import { CURATED_MAX_LEN, isCuratedField, normaliseCuratedValue } from './curated-fields';

describe('isCuratedField', () => {
  it('accepts exactly the four prose fields', () => {
    for (const f of ['purpose', 'caveat', 'grain', 'join_keys']) expect(isCuratedField(f)).toBe(true);
  });
  it('rejects measured columns — documentation must never overwrite measurement', () => {
    for (const f of ['row_count', 'refs_app', 'noun', 'verdict', '', null, 7]) {
      expect(isCuratedField(f)).toBe(false);
    }
  });
});

describe('normaliseCuratedValue', () => {
  it('empty and whitespace become null — absence, not empty string', () => {
    expect(normaliseCuratedValue('')).toEqual({ ok: true, value: null });
    expect(normaliseCuratedValue('  \n ')).toEqual({ ok: true, value: null });
    expect(normaliseCuratedValue(null)).toEqual({ ok: true, value: null });
  });
  it('trims, keeps content, rejects non-strings and over-length rather than truncating', () => {
    expect(normaliseCuratedValue('  x  ')).toEqual({ ok: true, value: 'x' });
    expect(normaliseCuratedValue(42).ok).toBe(false);
    expect(normaliseCuratedValue('a'.repeat(CURATED_MAX_LEN + 1)).ok).toBe(false);
    expect(normaliseCuratedValue('a'.repeat(CURATED_MAX_LEN)).ok).toBe(true);
  });
});
