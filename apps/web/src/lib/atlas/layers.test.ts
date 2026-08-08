import { describe, expect, it } from 'vitest';
import {
  ATLAS_LAYERS,
  ATLAS_NO_DATA_STYLE,
  DEFAULT_ATLAS_LAYER_KEY,
  atlasStyleFor,
  getAtlasLayer,
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
    lat: -32.1,
    lng: 133.7,
    lga_code: 'LGA00000',
    ...overrides,
  };
}

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

  it('the goods layer is org-tier, point-grain, and carries no figures', () => {
    const goods = getAtlasLayer('goods-delivered');
    expect(goods).not.toBeNull();
    expect(goods!.consent).toBe('org');
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
    // goods-delivered is org-tier: its points arrive only via the org page's
    // server fetch, so the public surface never lists it and never holds its
    // data. If this list grows, check the new layer's data path first.
    expect(visibleAtlasLayers('public').map(l => l.key)).toEqual([
      'funding-deserts',
      'unplaced-orgs',
      'renewal-cliff',
    ]);
    expect(visibleAtlasLayers('org').map(l => l.key)).toContain('goods-delivered');
  });
});

describe('style resolution', () => {
  const deserts = getAtlasLayer('funding-deserts') as AtlasLiveLayer;
  const unplaced = getAtlasLayer('unplaced-orgs') as AtlasLiveLayer;

  it('picks the first stop the value clears, boundaries inclusive', () => {
    expect(atlasStyleFor(deserts, 250).color).toBe('#D02020');
    expect(atlasStyleFor(deserts, 200).color).toBe('#D02020');
    expect(atlasStyleFor(deserts, 150).color).toBe('#E06C18');
    expect(atlasStyleFor(deserts, 60).color).toBe('#F0C020');
    expect(atlasStyleFor(deserts, 30).color).toBe('#4CB876');
    expect(atlasStyleFor(deserts, 5).color).toBe('#1040C0');
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
