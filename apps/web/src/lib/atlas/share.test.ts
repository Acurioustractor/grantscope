import { describe, expect, it } from 'vitest';
import type { AtlasFeature } from './layers';
import {
  buildAtlasUrl,
  councilCsv,
  councilJson,
  exportFilename,
  parseAtlasUrl,
  placeSlug,
  resolvePlace,
} from './share';

function feature(overrides: Partial<AtlasFeature> = {}): AtlasFeature {
  return {
    lga_name: 'Ceduna',
    state: 'SA',
    remoteness: 'Very Remote Australia',
    avg_irsd_decile: 2,
    avg_irsd_score: 800,
    indexed_entities: 23,
    community_controlled_entities: 6,
    total_funding_all_sources: 4200000,
    desert_score: 180,
    unplaced_count: 30,
    placed_count: 70,
    unplaced_share: 30,
    lat: -32.1,
    lng: 133.7,
    lga_code: 'LGA40700',
    ...overrides,
  };
}

describe('placeSlug', () => {
  it('matches the council page slugs', () => {
    expect(placeSlug('Ceduna')).toBe('ceduna');
    expect(placeSlug('Maralinga Tjarutja')).toBe('maralinga-tjarutja');
    expect(placeSlug("Augusta-Margaret River")).toBe('augusta-margaret-river');
    expect(placeSlug('  Derwent Valley  ')).toBe('derwent-valley');
  });
});

describe('atlas URLs', () => {
  it('a fresh Atlas is just /atlas', () => {
    expect(
      buildAtlasUrl({ layerKey: 'funding-deserts', defaultLayerKey: 'funding-deserts', stateFilter: 'ALL', selected: null })
    ).toBe('/atlas');
  });

  it('carries layer, state filter and place, and pst always rides with place', () => {
    const url = buildAtlasUrl({
      layerKey: 'unplaced-orgs',
      defaultLayerKey: 'funding-deserts',
      stateFilter: 'SA',
      selected: feature(),
    });
    expect(url).toBe('/atlas?layer=unplaced-orgs&state=SA&place=ceduna&pst=SA');
  });

  it('round-trips through parse', () => {
    const url = buildAtlasUrl({
      layerKey: 'unplaced-orgs',
      defaultLayerKey: 'funding-deserts',
      stateFilter: 'ALL',
      selected: feature(),
    });
    const parsed = parseAtlasUrl(url.split('?')[1] ?? '');
    expect(parsed.layerKey).toBe('unplaced-orgs');
    expect(parsed.place).toBe('ceduna');
    expect(parsed.pst).toBe('SA');
    expect(parsed.state).toBeUndefined();
  });

  it('parse ignores junk and normalises case', () => {
    const parsed = parseAtlasUrl('?layer=unplaced-orgs&state=sa&place=CEDUNA&pst=sa&utm_source=x');
    expect(parsed.state).toBe('SA');
    expect(parsed.place).toBe('ceduna');
    expect(parsed.pst).toBe('SA');
  });
});

describe('resolvePlace', () => {
  const baysideNsw = feature({ lga_name: 'Bayside', state: 'NSW' });
  const baysideVic = feature({ lga_name: 'Bayside', state: 'VIC' });
  const all = [feature(), baysideNsw, baysideVic];

  it('finds a unique slug', () => {
    expect(resolvePlace(all, 'ceduna')?.state).toBe('SA');
  });

  it('disambiguates duplicate names by pst, then state filter, then first', () => {
    expect(resolvePlace(all, 'bayside', 'VIC')).toBe(baysideVic);
    expect(resolvePlace(all, 'bayside', undefined, 'VIC')).toBe(baysideVic);
    expect(resolvePlace(all, 'bayside')).toBe(baysideNsw);
  });

  it('returns null for a place we do not hold', () => {
    expect(resolvePlace(all, 'atlantis')).toBeNull();
  });
});

describe('taking the data with its caveats', () => {
  it('CSV carries a _contains column per live layer', () => {
    const csv = councilCsv(feature());
    const [headers, row] = csv.trimEnd().split('\n');
    expect(headers).toContain('funding_deserts');
    expect(headers).toContain('funding_deserts_contains');
    expect(headers).toContain('unplaced_orgs_contains');
    expect(row).toContain('Ceduna');
    expect(row).toContain('where it was recorded');
    expect(headers.split(',').length).toBeGreaterThanOrEqual(14);
  });

  it('CSV escapes commas and quotes properly', () => {
    const csv = councilCsv(feature({ lga_name: 'Fake, "Weird" Council' }));
    expect(csv).toContain('"Fake, ""Weird"" Council"');
    // Caveats contain commas, so every _contains cell must be quoted
    const row = csv.trimEnd().split('\n')[1];
    expect(row.match(/"/g)?.length ?? 0).toBeGreaterThan(2);
  });

  it('null values export as empty cells, never zero', () => {
    const csv = councilCsv(feature({ desert_score: null, total_funding_all_sources: null }));
    const [headerLine, rowLine] = csv.trimEnd().split('\n');
    const headers = headerLine.split(',');
    // The fixture holds no commas before the first quoted caveat cell, so a
    // naive split is exact for the leading value columns.
    const cells = rowLine.split(',');
    expect(cells[headers.indexOf('recorded_funding')]).toBe('');
    expect(cells[headers.indexOf('funding_deserts')]).toBe('');
  });

  it('JSON attaches caveat and honesty to every layer value', () => {
    const json = councilJson(feature());
    expect(json.source).toBe('/api/data/map');
    expect(json.place.council).toBe('Ceduna');
    for (const layer of json.layers) {
      expect(String(layer.contains).length).toBeGreaterThan(80);
      expect(layer.honest_at).toBe('council');
    }
    const deserts = json.layers.find(l => l.key === 'funding-deserts');
    expect(deserts?.formatted).toBe('180');
  });

  it('JSON keeps null values null', () => {
    const json = councilJson(feature({ unplaced_share: null }));
    const unplaced = json.layers.find(l => l.key === 'unplaced-orgs');
    expect(unplaced?.value).toBeNull();
    expect(unplaced?.formatted).toBeNull();
  });

  it('filenames are slugged and state-qualified', () => {
    expect(exportFilename(feature())).toBe('ceduna-sa-atlas');
  });
});
