import { describe, expect, it } from 'vitest';
import { actPlaceFieldHref, getActPlaceFieldDefinition, searchActPlaceFields } from './act-place-fields';

describe('ACT place-field registry', () => {
  it('finds a regional field by its own name or a member community', () => {
    expect(searchActPlaceFields('Barkly').map((field) => field.slug)).toContain('barkly');
    expect(searchActPlaceFields('Tennant Creek').map((field) => field.slug)).toContain('barkly');
  });

  it('finds Palm Island by place name and PICC relationship language', () => {
    expect(searchActPlaceFields('Palm Island').map((field) => field.slug)).toContain('palm-island');
    expect(searchActPlaceFields('PICC').map((field) => field.slug)).toContain('palm-island');
  });

  it('respects state filters', () => {
    expect(searchActPlaceFields('', 'NT')).toHaveLength(1);
    expect(searchActPlaceFields('', 'QLD').map((field) => field.slug)).toEqual(['palm-island']);
  });

  it('builds a canonical Atlas route', () => {
    expect(getActPlaceFieldDefinition('BARKLY')?.kind).toBe('region');
    expect(getActPlaceFieldDefinition('palm-island')?.primaryCommunityName).toBe('Palm Island');
    expect(actPlaceFieldHref('act', 'barkly')).toBe('/org/act/explore/place/barkly');
    expect(actPlaceFieldHref('act', 'palm-island')).toBe('/org/act/explore/place/palm-island');
  });
});
