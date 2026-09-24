import { describe, expect, it } from 'vitest';
import { GOODS_SERVED_PLACES } from './goods-served-places';
import { GOODS_PLACE_CROSSWALK } from './goods-living-data-adapter';

describe('GOODS_SERVED_PLACES', () => {
  it('covers the eleven communities in the Goods bed canon, once each', () => {
    const slugs = GOODS_SERVED_PLACES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(11);
  });

  it('never contradicts the curated crosswalk', () => {
    for (const [slug, entry] of Object.entries(GOODS_PLACE_CROSSWALK)) {
      const p = GOODS_SERVED_PLACES.find((s) => s.slug === slug);
      if (p) expect(p.communityId).toBe(entry.communityId);
    }
  });

  it('holds an id exactly when the link is confirmed or proposed', () => {
    for (const p of GOODS_SERVED_PLACES) {
      expect(p.communityId === null).toBe(p.status === 'unlinked');
    }
  });
});
