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

  it('labels every council it declares', () => {
    // Councils with no records now render as an explicit "nothing in our
    // records" card. Without a label that card is a bare council name and a
    // disclaimer, which tells a reader from Hope Vale nothing about why their
    // shire is empty.
    for (const [key, region] of regions) {
      for (const lgaName of region.lgaNames) {
        expect(region.labels[lgaName], `${key} declares ${lgaName} with no label`).toBeDefined();
      }
    }
  });

  it('labels only council areas the region actually reads', () => {
    for (const [key, region] of regions) {
      for (const labelled of Object.keys(region.labels)) {
        expect(region.lgaNames, `${key} labels an area it does not query: ${labelled}`).toContain(labelled);
      }
    }
  });

  it('names a hub council the region reads, unless the hub is declared outside it', () => {
    // Cape York's hub is Cairns, which is not on Cape York. That is the
    // finding, not a mistake — but it has to be declared, so an in-region hub
    // that quietly falls out of lgaNames still fails here.
    for (const [key, region] of regions) {
      const hub = region.hubAdministration;
      if (!hub) continue;
      if (hub.hubIsOutsideRegion) {
        expect(
          region.lgaNames,
          `${key} declares ${hub.hubLga} as outside the region but also queries it`,
        ).not.toContain(hub.hubLga);
      } else {
        expect(
          region.lgaNames,
          `${key} names a hub council it does not query: ${hub.hubLga}`,
        ).toContain(hub.hubLga);
      }
    }
  });

  it('describes every community it lists', () => {
    for (const [key, region] of regions) {
      for (const community of region.communities) {
        expect(community.name.trim().length, key).toBeGreaterThan(0);
        expect(community.note.trim().length, `${key}: ${community.name} has no note`).toBeGreaterThan(0);
      }
      const names = region.communities.map(community => community.name);
      expect(new Set(names).size, `${key} lists a community twice`).toBe(names.length);
    }
  });

  it('only counts a community against a council the region reads', () => {
    // A community attributed to a council this region never queries would show
    // a figure the reader cannot find anywhere else on the page.
    for (const [key, region] of regions) {
      for (const community of region.communities) {
        if (!community.council) continue;
        expect(
          region.lgaNames,
          `${key}: ${community.name} is counted under ${community.council}, which this region does not query`,
        ).toContain(community.council);
      }
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

  it('holds the four regions that have been checked against the register', () => {
    // Deliberately specific. A region added without verifying it against the
    // database should fail here and be checked before it reaches a page.
    expect(Object.keys(PLACE_REGIONS).sort()).toEqual([
      'cape-york',
      'central-australia',
      'far-west-coast',
      'kimberley',
    ]);
  });

  it('records the hub council for every region that has one', () => {
    expect(PLACE_REGIONS['central-australia'].hubAdministration?.hubLga).toBe('Alice Springs');
    expect(PLACE_REGIONS['far-west-coast'].hubAdministration?.hubLga).toBe('Ceduna');
    expect(PLACE_REGIONS.kimberley.hubAdministration?.hubLga).toBe('Broome');
    expect(PLACE_REGIONS['cape-york'].hubAdministration?.hubLga).toBe('Cairns');
  });

  it('keeps Cairns out of Cape York while still naming it as the hub', () => {
    // Folding Cairns into lgaNames would add thousands of unrelated
    // organisations and bury the peninsula in its own page.
    const capeYork = PLACE_REGIONS['cape-york'];
    expect(capeYork.hubAdministration?.hubIsOutsideRegion).toBe(true);
    expect(capeYork.lgaNames).not.toContain('Cairns');
  });

  it('describes any cross-border misattribution it declares', () => {
    for (const [key, region] of regions) {
      const crossBorder = region.crossBorder;
      if (!crossBorder) continue;
      // A state boundary in the wrong place is only worth stating if we can
      // say which way round it is wrong.
      expect(crossBorder.recordedState, key).not.toBe(crossBorder.actualState);
      expect(crossBorder.orgNames.length, `${key} declares cross-border with no organisations`).toBeGreaterThan(0);
      expect(new Set(crossBorder.orgNames).size, `${key} lists an organisation twice`).toBe(
        crossBorder.orgNames.length,
      );
      expect(crossBorder.communities.length, key).toBeGreaterThan(0);
      expect(crossBorder.note.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('records that the APY Lands are recorded in the Northern Territory', () => {
    // The APY Lands are South Australian. If this ever flips to SA the data has
    // been fixed upstream and the section should come down, deliberately.
    const crossBorder = PLACE_REGIONS['central-australia'].crossBorder;
    expect(crossBorder?.actualState).toBe('SA');
    expect(crossBorder?.recordedState).toBe('NT');
    expect(crossBorder?.recordedLga).toBe('Alice Springs');
    expect(crossBorder?.orgNames.length).toBe(13);
  });

  it('records that Cape York has no gazetteer gaps', () => {
    // The distinguishing fact about this region: the reference data is fine and
    // the addresses are not. If a gap is added later, it should be deliberate.
    expect(PLACE_REGIONS['cape-york'].gazetteerGaps).toEqual([]);
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
