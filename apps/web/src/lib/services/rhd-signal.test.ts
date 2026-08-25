import { describe, expect, it } from 'vitest';
import { PLACE_REGIONS } from './place-intelligence';
import { RHD_BY_PLACE_REGION, RHD_REGIONS, getRhdSignalForRegion, ratePerHundred } from './rhd-signal';

/**
 * These figures are transcribed by hand from a published workbook and shown to
 * people whose communities they describe. The guards check internal consistency
 * so a typo in a rate cannot pass silently.
 */
describe('RHD_REGIONS', () => {
  const regions = Object.entries(RHD_REGIONS);

  it('derives a rate ratio that matches its own rates', () => {
    // The strongest available check on a transcription error: the published
    // ratio and the two published rates have to agree.
    for (const [key, signal] of regions) {
      const derived = signal.firstNationsRatePer100k / signal.nonIndigenousRatePer100k;
      expect(Math.abs(derived - signal.rateRatio), `${key}: rate ratio disagrees with its rates`).toBeLessThan(0.6);
    }
  });

  it('records more First Nations cases than non-Indigenous, at a higher rate', () => {
    // True of every region on this register. If it ever inverts, the columns
    // were read in the wrong order.
    for (const [key, signal] of regions) {
      expect(signal.firstNationsRatePer100k, key).toBeGreaterThan(signal.nonIndigenousRatePer100k);
      expect(signal.rateRatio, key).toBeGreaterThan(1);
    }
  });

  it('carries provenance on every figure', () => {
    for (const [key, signal] of regions) {
      expect(signal.asAt.trim().length, key).toBeGreaterThan(0);
      expect(signal.sourceTable.trim().length, key).toBeGreaterThan(0);
      expect(signal.boundaryNote.trim().length, `${key} has no boundary note`).toBeGreaterThan(0);
    }
  });

  it('carries non-overlapping council proxies and label positions for the Atlas', () => {
    const seen = new Set<string>();
    for (const [key, signal] of regions) {
      expect(signal.proxyLgas.length, key).toBeGreaterThan(0);
      expect(signal.labelAt, key).toHaveLength(2);
      for (const lga of signal.proxyLgas) {
        expect(seen.has(lga), `${lga} belongs to more than one region proxy`).toBe(false);
        seen.add(lga);
      }
    }
  });

  it('only maps place regions that actually exist', () => {
    for (const [placeKey, rhdKey] of Object.entries(RHD_BY_PLACE_REGION)) {
      expect(PLACE_REGIONS[placeKey], `${placeKey} is not a place region`).toBeDefined();
      expect(RHD_REGIONS[rhdKey], `${rhdKey} is not an RHD region`).toBeDefined();
    }
  });

  it('shows RHD only where a register reports that geography', () => {
    // Three of the four place regions have no register region overlapping them.
    // Showing them a jurisdiction figure would read as a local one, so they
    // show nothing.
    expect(getRhdSignalForRegion('central-australia')?.region).toBe('Central Australia');
    expect(getRhdSignalForRegion('kimberley')).toBeNull();
    expect(getRhdSignalForRegion('cape-york')).toBeNull();
    expect(getRhdSignalForRegion('far-west-coast')).toBeNull();
  });

  it('states Central Australia as the register draws it, not as we do', () => {
    // Our central-australia region includes the APY Lands. The NT register's
    // Central Australia does not, because they are in South Australia. If that
    // caveat is ever dropped the page overstates its own coverage.
    const note = RHD_REGIONS['nt-central-australia'].boundaryNote;
    expect(note).toContain('APY');
  });

  it('converts a rate per 100,000 into people per 100', () => {
    expect(ratePerHundred(2902.7)).toBe('2.9');
    expect(ratePerHundred(93.8)).toBe('0.1');
  });
});
