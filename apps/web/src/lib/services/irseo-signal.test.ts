import { describe, expect, it } from 'vitest';
import { PLACE_REGIONS } from './place-intelligence';
import {
  IRSEO_AREA_COUNT,
  IRSEO_BY_PLACE_REGION,
  getIndigenousArea,
  getIrseoForRegion,
} from './irseo-signal';

describe('IRSEO', () => {
  it('holds all 401 published Indigenous Areas', () => {
    expect(IRSEO_AREA_COUNT).toBe(401);
  });

  it('names only area codes that exist in the published dataset', () => {
    // A typo in a code would silently drop a community from its own region.
    for (const regionKey of Object.keys(IRSEO_BY_PLACE_REGION)) {
      const signal = getIrseoForRegion(regionKey);
      expect(signal?.missing, `${regionKey} names unknown area codes`).toEqual([]);
    }
  });

  it('maps only regions that exist, without repeating an area', () => {
    for (const [regionKey, codes] of Object.entries(IRSEO_BY_PLACE_REGION)) {
      expect(PLACE_REGIONS[regionKey], `${regionKey} is not a place region`).toBeDefined();
      expect(new Set(codes).size, `${regionKey} repeats an area code`).toBe(codes.length);
    }
  });

  it('runs percentiles the opposite way to SEIFA', () => {
    // 100 is the most disadvantaged. If this ever inverts, every page reads
    // backwards and the most disadvantaged communities look the best off.
    const darwinInner = getIndigenousArea('703005');
    const walungurru = getIndigenousArea('709013');
    expect(darwinInner?.percentile2021).toBeLessThan(20);
    expect(walungurru?.percentile2021).toBe(100);
  });

  it('gives Utopia a place of its own', () => {
    // The whole reason this dataset is here. Urapuntja has no council, no entry
    // in the national gazetteer, and every organisation counted under Alice
    // Springs. ABS Indigenous Area 709012 is the only geography that names it.
    const urapuntja = getIndigenousArea('709012');
    expect(urapuntja?.name).toBe('Urapuntja');
    expect(urapuntja?.percentile2021).toBe(99);
    expect(IRSEO_BY_PLACE_REGION['central-australia']).toContain('709012');
  });

  it('keeps the APY Lands in Central Australia, where its council sits', () => {
    // Our central-australia region includes the APY council, which is in South
    // Australia. Its Indigenous Area has to come with it or the region reports
    // on a council it does not cover.
    const apy = getIndigenousArea('402001');
    expect(apy?.state).toBe('SA');
    expect(IRSEO_BY_PLACE_REGION['central-australia']).toContain('402001');
  });

  it('sorts a region worst-first and counts the most disadvantaged', () => {
    const signal = getIrseoForRegion('central-australia');
    expect(signal).not.toBeNull();
    const percentiles = signal!.areas.map(a => a.percentile2021);
    expect([...percentiles].sort((a, b) => b - a)).toEqual(percentiles);
    expect(signal!.mostDisadvantaged.every(a => a.percentile2021 >= 90)).toBe(true);
  });

  it('returns nothing for a region with no areas mapped', () => {
    expect(getIrseoForRegion('not-a-region')).toBeNull();
  });
});
