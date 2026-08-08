import { describe, expect, it } from 'vitest';
import { PLACE_REGIONS } from './place-intelligence';

/**
 * Guards on the region registry.
 *
 * The registry describes where public money is recorded as going, and people
 * who live in these places read the result. The failure mode is not a crash: it
 * is a page that states, confidently and in plain English, something that is no
 * longer true — which is exactly what happened to the Far West Coast entry when
 * a migration reversed the direction of the distortion it described.
 *
 * These check internal consistency only. Whether a claim matches the register
 * is verified against the database, not here.
 */
describe('PLACE_REGIONS', () => {
  const regions = Object.entries(PLACE_REGIONS);

  it('keys each region under its own key', () => {
    for (const [key, region] of regions) {
      expect(region.key).toBe(key);
    }
  });

  it('labels only council areas the region actually reads', () => {
    for (const [key, region] of regions) {
      for (const labelled of Object.keys(region.labels)) {
        expect(region.lgaNames, `${key} labels an area it does not query: ${labelled}`).toContain(labelled);
      }
    }
  });

  it('names a hub council the region actually reads', () => {
    for (const [key, region] of regions) {
      if (!region.hubAdministration) continue;
      expect(
        region.lgaNames,
        `${key} names a hub council it does not query: ${region.hubAdministration.hubLga}`,
      ).toContain(region.hubAdministration.hubLga);
    }
  });

  it('gives every hub at least one community and one named organisation', () => {
    // A hub with an empty list would render as a claim about misattributed
    // money with nothing behind it.
    for (const [key, region] of regions) {
      if (!region.hubAdministration) continue;
      expect(region.hubAdministration.administeredCommunities.length, key).toBeGreaterThan(0);
      expect(region.hubAdministration.creditedOrgs.length, key).toBeGreaterThan(0);
      expect(region.hubAdministration.note.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('does not name the same organisation twice in a hub', () => {
    // Duplicates would double-count against the hub's credited total.
    for (const [key, region] of regions) {
      if (!region.hubAdministration) continue;
      const names = region.hubAdministration.creditedOrgs;
      expect(new Set(names).size, `${key} lists a credited organisation twice`).toBe(names.length);
    }
  });

  it('explains every gazetteer gap it declares', () => {
    for (const [key, region] of regions) {
      for (const gap of region.gazetteerGaps) {
        expect(gap.place.trim().length, key).toBeGreaterThan(0);
        expect(gap.note.trim().length, `${key}: ${gap.place} has no explanation`).toBeGreaterThan(0);
        // A locality that spans councils is the reason we cannot pick one, so
        // naming the councils without naming the locality explains nothing.
        if (gap.straddles.length > 1) {
          expect(gap.containingLocality, `${key}: ${gap.place} straddles councils but names no locality`).toBeTruthy();
        }
      }
    }
  });

  it('holds the three regions that have been checked against the register', () => {
    // Deliberately specific. A region added without verifying it against the
    // database should fail here and be checked before it reaches a page.
    expect(Object.keys(PLACE_REGIONS).sort()).toEqual([
      'central-australia',
      'far-west-coast',
      'kimberley',
    ]);
  });

  it('records the hub council for every region that has one', () => {
    expect(PLACE_REGIONS['central-australia'].hubAdministration?.hubLga).toBe('Alice Springs');
    expect(PLACE_REGIONS['far-west-coast'].hubAdministration?.hubLga).toBe('Ceduna');
    expect(PLACE_REGIONS.kimberley.hubAdministration?.hubLga).toBe('Broome');
  });

  it('names at least one unplaced postcode wherever it declares any', () => {
    // An empty list would render as "these organisations share postcodes ,"
    // and silently widen every unplaced query to nothing.
    for (const [key, region] of regions) {
      if (!region.unplaced) continue;
      expect(region.unplaced.postcodes.length, `${key} declares unplaced with no postcodes`).toBeGreaterThan(0);
      expect(new Set(region.unplaced.postcodes).size, `${key} repeats an unplaced postcode`).toBe(
        region.unplaced.postcodes.length,
      );
    }
  });

  it('keeps the Dampier Peninsula recorded as unplaceable rather than placed', () => {
    // Same shape as Sandover: the communities are absent from the gazetteer and
    // the locality above them spans two councils.
    const gap = PLACE_REGIONS.kimberley.gazetteerGaps.find(entry => entry.place.includes('Ardyaloon'));
    expect(gap?.containingLocality).toBe('DAMPIER PENINSULA');
    expect(gap?.straddles).toEqual(['Broome', 'Derby-West Kimberley']);
  });

  it('keeps the Utopia homelands recorded as unplaceable rather than placed', () => {
    // Sandover spans Barkly and Central Desert, so resolving Urapuntja to it
    // still would not name a council. If someone later adds a single council
    // here, this fails and they have to justify the choice.
    const gap = PLACE_REGIONS['central-australia'].gazetteerGaps.find(entry =>
      entry.place.includes('Urapuntja'),
    );
    expect(gap).toBeDefined();
    expect(gap?.containingLocality).toBe('SANDOVER');
    expect(gap?.straddles).toEqual(['Barkly', 'Central Desert']);
  });
});
