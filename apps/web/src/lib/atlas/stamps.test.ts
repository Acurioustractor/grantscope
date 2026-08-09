import { describe, expect, it } from 'vitest';
import {
  PLACEMENT_STAMPS,
  STAMP_FAMILIES,
  stampFamilyRows,
  stampLabel,
  totalPlacedOf,
} from './stamps';

describe('the stamp registry contract', () => {
  it('codes are unique and every stamp carries plain words and a family', () => {
    const codes = PLACEMENT_STAMPS.map(s => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    const familyKeys = new Set(STAMP_FAMILIES.map(f => f.key));
    for (const stamp of PLACEMENT_STAMPS) {
      expect(stamp.label.length, stamp.code).toBeGreaterThan(10);
      expect(stamp.label).not.toMatch(/_/);
      expect(familyKeys.has(stamp.family), stamp.code).toBe(true);
    }
  });

  it('every family carries a note on what its evidence cannot promise', () => {
    for (const family of STAMP_FAMILIES) {
      expect(family.note.length, family.key).toBeGreaterThan(40);
    }
  });

  it('carries the 2026-08-09 stamps: nolocality POA, SAL-dominant forms, gazetteer family, ACNC street lines', () => {
    for (const code of [
      'poa_ratio_nolocality',
      'own_name_town+sal_ratio_dominant',
      'oric_register_address+sal_ratio_dominant',
      'acnc_town_city+gazetteer',
      'own_name_town+gazetteer',
      'oric_register_address+gazetteer',
      'acnc_street_line+sal_ratio_dominant',
      'acnc_street_line+abs_asgs',
    ]) {
      expect(PLACEMENT_STAMPS.some(s => s.code === code), code).toBe(true);
    }
  });

  it('a gazetteer stamp never claims ABS authority in its words', () => {
    for (const stamp of PLACEMENT_STAMPS.filter(s => s.code.endsWith('+gazetteer'))) {
      expect(stamp.label).toMatch(/gazetteer/);
      expect(stamp.label).not.toMatch(/ABS/);
    }
  });
});

describe('stampLabel', () => {
  it('labels known codes in plain words', () => {
    expect(stampLabel('single_lga_postcode')).toBe('postcode sits wholly in this council');
    expect(stampLabel('poa_ratio_nolocality')).toMatch(/no locality record/);
  });

  it('humanises unknown codes instead of vanishing them', () => {
    expect(stampLabel('abr_geocode+vote')).toBe('abr geocode · vote');
    expect(stampLabel('brand_new_stamp')).toBe('brand new stamp');
  });
});

describe('stampFamilyRows', () => {
  const counts = {
    registry_address: 10,
    'acnc_street_line+sal_ratio_dominant': 2,
    single_lga_postcode: 5,
    'own_name_town+abs_asgs': 1,
    future_code: 3,
  };

  it('rolls counts up per family, surest evidence first, unknowns last', () => {
    const rows = stampFamilyRows(counts);
    expect(rows.map(r => r.key)).toEqual(['register-address', 'own-name', 'postcode', 'unrecognised']);
    expect(rows[0].n).toBe(12);
    expect(rows[0].codes.map(c => c.code)).toEqual(['registry_address', 'acnc_street_line+sal_ratio_dominant']);
    expect(rows[3].codes[0].label).toBe('future code');
    expect(totalPlacedOf(rows)).toBe(21);
  });

  it('drops zero and junk counts; null yields no rows', () => {
    expect(stampFamilyRows({ registry_address: 0, single_lga_postcode: -2 })).toEqual([]);
    expect(stampFamilyRows(null)).toEqual([]);
    expect(stampFamilyRows(undefined)).toEqual([]);
  });
});
