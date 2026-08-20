import { describe, expect, it } from 'vitest';
import {
  ATLAS_GROUP_ORDER,
  ATLAS_LAYERS,
  ATLAS_NO_DATA_STYLE,
  DEFAULT_ATLAS_LAYER_KEY,
  GOODS_PUBLIC_PLACES,
  atlasStyleFor,
  getAtlasLayer,
  isGoodsPlacePublic,
  isLiveLayer,
  isPointLayer,
  visibleAtlasLayers,
  type AtlasFeature,
  type AtlasLayer,
  type AtlasLiveLayer,
} from './layers';

function feature(overrides: Partial<AtlasFeature> = {}): AtlasFeature {
  return {
    lga_name: 'Testville',
    state: 'SA',
    remoteness: 'Very Remote Australia',
    avg_irsd_decile: 1,
    avg_irsd_score: 600,
    indexed_entities: 12,
    community_controlled_entities: 3,
    total_funding_all_sources: 1000000,
    desert_score: 150,
    unplaced_count: 40,
    placed_count: 60,
    unplaced_share: 40,
    justice_funding_total: 2000000,
    lat: -32.1,
    lng: 133.7,
    lga_code: 'LGA00000',
    ...overrides,
  };
}

describe('the place-capture layers', () => {
  it('both are registered, public, and painted from the dollar share', () => {
    const lga = getAtlasLayer('grant-capture-lga') as AtlasLiveLayer | null;
    const state = getAtlasLayer('grant-capture-state') as AtlasLiveLayer | null;
    expect(lga).not.toBeNull();
    expect(state).not.toBeNull();
    expect(lga!.consent).toBe('public');
    expect(state!.consent).toBe('public');
    expect(lga!.value(feature({ capture_pct_dollars: 8.3 }))).toBe(8.3);
    expect(state!.value(feature({ state_capture_pct_dollars: 97.3 }))).toBe(97.3);
  });

  // A council with no covered awards has not been shown to keep nothing: it has
  // not been measured. Coercing that to zero would paint it the worst red on the
  // map for having no data.
  it('an unmeasured council reads as no data, never as zero capture', () => {
    const lga = getAtlasLayer('grant-capture-lga') as AtlasLiveLayer;
    expect(lga.value(feature({ capture_pct_dollars: null }))).toBeNull();
    expect(atlasStyleFor(lga, lga.value(feature({ capture_pct_dollars: null })))).toEqual(
      ATLAS_NO_DATA_STYLE,
    );
    expect(lga.noDataLabel.toLowerCase()).not.toContain('0');
  });

  // Both layers describe the same measure at different coverage. The council
  // layer must state its minority coverage on the surface so nobody quotes
  // $33.75bn as if it were the whole $230bn register.
  it('the council layer states its coverage and the state layer states its grain', () => {
    const lga = getAtlasLayer('grant-capture-lga')!;
    const state = getAtlasLayer('grant-capture-state')!;
    expect(lga.caveat).toContain('$33.75bn');
    expect(lga.caveat).toContain('$230bn');
    expect(lga.honestAt).toBe('council');
    expect(state.honestAt).toBe('state');
  });

  // 85.1% of awards against 59.6% of dollars: a layer that painted dollars
  // without saying so would read as "remote Australia keeps more".
  it('the council caveat says the award share moves differently', () => {
    const lga = getAtlasLayer('grant-capture-lga')!;
    expect(lga.caveat).toContain('85.1%');
    expect(lga.caveat).toContain('59.6%');
  });
});

describe('the registry contract', () => {
  it('every layer carries a real caveat, not a placeholder', () => {
    for (const layer of ATLAS_LAYERS) {
      expect(layer.caveat.length, `${layer.key} caveat`).toBeGreaterThan(80);
      expect(layer.honestAtNote.length, `${layer.key} honestAtNote`).toBeGreaterThan(20);
      expect(layer.name.length, `${layer.key} name`).toBeGreaterThan(0);
      expect(layer.unit.length, `${layer.key} unit`).toBeGreaterThan(0);
    }
  });

  it('keys are unique', () => {
    const keys = ATLAS_LAYERS.map(l => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('live layers carry a descending scale; declared layers say what they wait on', () => {
    for (const layer of ATLAS_LAYERS) {
      if (isLiveLayer(layer)) {
        const mins = layer.scale.map(s => s.min);
        expect(mins, `${layer.key} scale ordered high→low`).toEqual([...mins].sort((a, b) => b - a));
        expect(layer.scale.length).toBeGreaterThan(1);
        expect(layer.noDataLabel.length).toBeGreaterThan(0);
      } else {
        expect(layer.waitingOn.length, `${layer.key} waitingOn`).toBeGreaterThan(20);
      }
    }
  });

  it('the goods layer is point-grain, carries no figures, and its tier follows per-place consent', () => {
    const goods = getAtlasLayer('goods-delivered');
    expect(goods).not.toBeNull();
    // The whole public flip is the consent list: empty means org-only, and
    // the first consented place turns the layer public (with the server feed
    // shipping only consented places — goods-atlas-points enforces that).
    expect(goods!.consent).toBe(GOODS_PUBLIC_PLACES.length > 0 ? 'public' : 'org');
    if (GOODS_PUBLIC_PLACES.length === 0) {
      expect(isGoodsPlacePublic('Anywhere At All')).toBe(false);
    } else {
      // Consent matching must survive the register's casing.
      expect(GOODS_PUBLIC_PLACES.every(p => isGoodsPlacePublic(p.toUpperCase()))).toBe(true);
    }
    expect(goods!.honestAt).toBe('community');
    expect(isPointLayer(goods!)).toBe(true);
    // The registry entry may ship in a public bundle; the numbers may not.
    // Any digit in the caveat or notes is a Goods figure leaking public.
    const text = `${goods!.name} ${goods!.unit} ${goods!.caveat} ${goods!.honestAtNote}`;
    expect(text).not.toMatch(/\d/);
  });

  it('the default layer is live and public', () => {
    const layer = getAtlasLayer(DEFAULT_ATLAS_LAYER_KEY);
    expect(layer).not.toBeNull();
    expect(layer!.status).toBe('live');
    expect(layer!.consent).toBe('public');
  });
});

describe('consent tiers gate surfaces', () => {
  const orgLayer: AtlasLayer = {
    key: 'test-org-layer',
    status: 'declared',
    group: 'delivery',
    name: 'Org-only test layer',
    unit: 'things',
    caveat: 'A layer that must never appear on the public surface, used to prove the filter holds.',
    honestAt: 'community',
    honestAtNote: 'Only honest inside the organisation that owns the data.',
    consent: 'org',
    waitingOn: 'Nothing — this fixture exists to prove the consent filter.',
  };
  const withheldLayer: AtlasLayer = { ...orgLayer, key: 'test-withheld-layer', consent: 'withheld' };

  it('the public surface sees only public layers', () => {
    const visible = visibleAtlasLayers('public', [...ATLAS_LAYERS, orgLayer, withheldLayer]);
    expect(visible.every(l => l.consent === 'public')).toBe(true);
    expect(visible.map(l => l.key)).not.toContain('test-org-layer');
    expect(visible.map(l => l.key)).not.toContain('test-withheld-layer');
  });

  it('the org surface sees public and org layers, never withheld', () => {
    const visible = visibleAtlasLayers('org', [...ATLAS_LAYERS, orgLayer, withheldLayer]);
    expect(visible.map(l => l.key)).toContain('test-org-layer');
    expect(visible.map(l => l.key)).not.toContain('test-withheld-layer');
  });

  it('a withheld layer appears on no surface at all', () => {
    for (const surface of ['public', 'org'] as const) {
      expect(visibleAtlasLayers(surface, [withheldLayer])).toEqual([]);
    }
  });

  it('the public surface sees exactly the public seed layers', () => {
    // goods-delivered joins this list only when a place has consented: its
    // points arrive via a server fetch that ships consented places only.
    // If this list grows, check the new layer's data path first.
    // Federal grants leads Recorded money: the richer, truer window first.
    expect(visibleAtlasLayers('public').map(l => l.key)).toEqual([
      'funding-deserts',
      'grants-awarded',
      'grant-capture-lga',
      'grant-capture-state',
      'money-recorded',
      'justice-funding',
      'renewal-cliff',
      'seifa-disadvantage',
      'whats-working',
      ...(GOODS_PUBLIC_PLACES.length > 0 ? ['goods-delivered'] : []),
      'unplaced-orgs',
    ]);
    expect(visibleAtlasLayers('org').map(l => l.key)).toContain('goods-delivered');
  });

  it('substantive groups lead; uncertainty qualifies from the back', () => {
    for (const layer of ATLAS_LAYERS) {
      expect(ATLAS_GROUP_ORDER).toContain(layer.group);
    }
    expect(getAtlasLayer('unplaced-orgs')!.group).toBe('data-quality');
    // data-quality is the LAST group the picker renders.
    expect(ATLAS_GROUP_ORDER[ATLAS_GROUP_ORDER.length - 1]).toBe('data-quality');
  });
});

describe('style resolution', () => {
  const deserts = getAtlasLayer('funding-deserts') as AtlasLiveLayer;
  const unplaced = getAtlasLayer('unplaced-orgs') as AtlasLiveLayer;

  it('picks the first stop the value clears, boundaries inclusive', () => {
    // Desert stops are quantile breaks (2026-08-09 distribution: median 110,
    // p90 152, max 205) — re-derive before moving them.
    expect(atlasStyleFor(deserts, 205).color).toBe('#D02020');
    expect(atlasStyleFor(deserts, 150).color).toBe('#D02020');
    expect(atlasStyleFor(deserts, 140).color).toBe('#E06C18');
    expect(atlasStyleFor(deserts, 120).color).toBe('#F0C020');
    expect(atlasStyleFor(deserts, 90).color).toBe('#4CB876');
    expect(atlasStyleFor(deserts, 20).color).toBe('#1040C0');
    expect(atlasStyleFor(unplaced, 80).color).toBe('#D02020');
    expect(atlasStyleFor(unplaced, 12).color).toBe('#4CB876');
    expect(atlasStyleFor(unplaced, 0).color).toBe('#1040C0');
  });

  it('null paints the no-data style, never zero', () => {
    expect(atlasStyleFor(deserts, null)).toEqual(ATLAS_NO_DATA_STYLE);
    expect(atlasStyleFor(unplaced, null)).toEqual(ATLAS_NO_DATA_STYLE);
  });

  it('a value below every stop clamps to the lowest stop', () => {
    expect(atlasStyleFor(deserts, -1).color).toBe('#1040C0');
  });
});

describe('the substantive layers', () => {
  const seifa = getAtlasLayer('seifa-disadvantage') as AtlasLiveLayer;
  const recorded = getAtlasLayer('money-recorded') as AtlasLiveLayer;
  const justice = getAtlasLayer('justice-funding') as AtlasLiveLayer;

  it('SEIFA runs backwards on purpose: decile 1 is red, decile 10 is blue', () => {
    expect(atlasStyleFor(seifa, 1).color).toBe('#D02020');
    expect(atlasStyleFor(seifa, 2).color).toBe('#D02020');
    expect(atlasStyleFor(seifa, 5).color).toBe('#F0C020');
    expect(atlasStyleFor(seifa, 10).color).toBe('#1040C0');
    expect(seifa.value(feature({ avg_irsd_decile: 1 }))).toBe(1);
    // One decimal so 2.52 never rounds up to a softer-looking "decile 3";
    // whole numbers drop the trailing zero.
    expect(seifa.format(2.5238)).toBe('decile 2.5');
    expect(seifa.format(7)).toBe('decile 7');
  });

  it('federal grants reads its own field; absent means no-data, never zero', () => {
    const grants = getAtlasLayer('grants-awarded') as AtlasLiveLayer;
    expect(grants.value(feature({ grants_awarded_total: 205853273 }))).toBe(205853273);
    expect(atlasStyleFor(grants, 205_853_273).color).toBe('#E06C18');
    // The fixture carries no grants field — an old cached payload — so the
    // layer must paint no-data, not $0.
    expect(grants.value(feature())).toBeNull();
    expect(grants.format(205853273)).toMatch(/\$/);
  });

  it('what-works treats zero as a real answer and absent as no-data', () => {
    const works = getAtlasLayer('whats-working') as AtlasLiveLayer;
    // Ceduna today: the join ran, nothing is linked. Zero paints the "none
    // linked yet" stop; it is never coerced to the no-data grey.
    expect(works.value(feature({ alma_linked_count: 0 }))).toBe(0);
    expect(atlasStyleFor(works, 0).color).toBe('#1040C0');
    // Zero paints near-invisibly (a 0.2 wash made the layer read broken) and
    // formats as words — never a giant "0" beside a place name.
    expect(atlasStyleFor(works, 0).fillOpacity).toBeLessThan(0.1);
    expect(works.value(feature())).toBeNull();
    expect(atlasStyleFor(works, null)).toEqual(ATLAS_NO_DATA_STYLE);
    expect(works.format(0)).toBe('None yet');
    expect(works.format(3)).toBe('3 linked');
  });

  it('money layers use order-of-magnitude bands and read their own fields', () => {
    expect(atlasStyleFor(recorded, 2_000_000_000).color).toBe('#D02020');
    expect(atlasStyleFor(recorded, 500_000).color).toBe('#1040C0');
    expect(recorded.value(feature({ total_funding_all_sources: 4200000 }))).toBe(4200000);
    expect(atlasStyleFor(justice, 60_000_000).color).toBe('#D02020');
    expect(justice.value(feature({ justice_funding_total: null }))).toBeNull();
    expect(justice.value(feature())).toBe(2000000);
    // Dollar formatting comes from the shared money() helper.
    expect(recorded.format(4200000)).toMatch(/\$/);
  });
});

describe('reading values off features', () => {
  const deserts = getAtlasLayer('funding-deserts') as AtlasLiveLayer;
  const unplaced = getAtlasLayer('unplaced-orgs') as AtlasLiveLayer;

  it('reads its own field and coerces the numeric strings exec_sql returns', () => {
    expect(deserts.value(feature({ desert_score: '123.4' as unknown as number }))).toBeCloseTo(123.4);
    expect(unplaced.value(feature({ unplaced_share: 62 }))).toBe(62);
  });

  it('missing data stays null', () => {
    expect(deserts.value(feature({ desert_score: null }))).toBeNull();
    expect(unplaced.value(feature({ unplaced_share: null }))).toBeNull();
  });

  it('formats in its own unit', () => {
    expect(deserts.format(123.4)).toBe('123');
    expect(unplaced.format(62)).toBe('62%');
  });
});
