import { describe, expect, it } from 'vitest';
import { countActAtlasRecords, isAtlasFunderType, type ActAtlasRecord } from './act-atlas';

function record(id: string, type: ActAtlasRecord['type']): ActAtlasRecord {
  return {
    id,
    entityId: null,
    type,
    name: id,
    subtitle: '',
    description: null,
    href: '/',
    state: null,
    postcode: null,
    latitude: null,
    longitude: null,
    tags: [],
    facts: [],
    sourceLabel: 'test',
  };
}

describe('ACT Atlas result counts', () => {
  it('counts each record under its operating type', () => {
    expect(countActAtlasRecords([
      record('barkly', 'place'),
      record('wadeye', 'community'),
      record('snow', 'funder'),
      record('goods', 'project'),
      record('grant', 'opportunity'),
      record('person', 'person'),
      record('org', 'organisation'),
      record('another-org', 'organisation'),
    ])).toEqual({
      place: 1,
      community: 1,
      person: 1,
      organisation: 2,
      funder: 1,
      project: 1,
      opportunity: 1,
    });
  });

  it('does not classify service and arts organisations as funders', () => {
    expect(isAtlasFunderType('corporate_foundation')).toBe(true);
    expect(isAtlasFunderType('grantmaker')).toBe(true);
    expect(isAtlasFunderType('arts_culture')).toBe(false);
    expect(isAtlasFunderType('service_delivery')).toBe(false);
  });
});
