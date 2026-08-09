// Taking the Atlas with you: shareable URLs and per-council data exports.
//
// A link IS the presentation — /atlas?layer=unplaced-orgs&place=ceduna&pst=SA
// restores the layer, the state filter and the open place panel. And when a
// council's numbers leave as CSV or JSON, every layer's caveat travels in the
// same file: the number never ships without what it contains.

import {
  isChoroplethLayer,
  visibleAtlasLayers,
  type AtlasFeature,
  type AtlasLiveLayer,
  type AtlasSurface,
} from './layers';
import { COUNCIL_REASON_COLUMNS } from './reasons';

/** URL-safe slug for a place name. Also the slug of /place/council/[slug] —
 * council-place-report.ts imports this one so the two can never drift. */
export function placeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface AtlasUrlState {
  layerKey?: string;
  /** State filter chip; 'ALL' and undefined both mean no filter. */
  state?: string;
  /** Selected place slug. */
  place?: string;
  /** The selected place's state. Council names repeat across states
   * (Bayside exists in NSW and VIC), so the slug alone is ambiguous. */
  pst?: string;
  /** Story-mode step id. When present it defines the whole view, so the
   * other params are neither written nor read. */
  story?: string;
}

/** Read Atlas state out of a query string. Unknown params are ignored;
 * values are not validated here — resolve against real data before use. */
export function parseAtlasUrl(search: string): AtlasUrlState {
  const params = new URLSearchParams(search);
  const read = (key: string): string | undefined => {
    const value = params.get(key)?.trim();
    return value ? value : undefined;
  };
  return {
    layerKey: read('layer'),
    state: read('state')?.toUpperCase(),
    place: read('place')?.toLowerCase(),
    pst: read('pst')?.toUpperCase(),
    story: read('story')?.toLowerCase(),
  };
}

/** Build the shareable path. Defaults are omitted so a fresh Atlas is just
 * /atlas; pst always accompanies place because slugs collide across states.
 * A story step id defines the whole view, so it travels alone. */
export function buildAtlasUrl(input: {
  layerKey: string;
  defaultLayerKey: string;
  stateFilter: string;
  selected: AtlasFeature | null;
  story?: string | null;
}): string {
  if (input.story) return `/atlas?story=${encodeURIComponent(input.story)}`;
  const params = new URLSearchParams();
  if (input.layerKey !== input.defaultLayerKey) params.set('layer', input.layerKey);
  if (input.stateFilter && input.stateFilter !== 'ALL') params.set('state', input.stateFilter);
  if (input.selected) {
    params.set('place', placeSlug(input.selected.lga_name));
    params.set('pst', input.selected.state);
  }
  const qs = params.toString();
  return qs ? `/atlas?${qs}` : '/atlas';
}

/** Find the feature a place slug points at. When the slug is ambiguous the
 * place-state wins, then the state filter, then the first match — a
 * hand-typed /atlas?place=bayside still lands somewhere rather than nowhere. */
export function resolvePlace(
  features: readonly AtlasFeature[],
  place: string,
  pst?: string,
  stateFilter?: string
): AtlasFeature | null {
  const matches = features.filter(f => placeSlug(f.lga_name) === place);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return (
    (pst && matches.find(f => f.state === pst)) ||
    (stateFilter && stateFilter !== 'ALL' && matches.find(f => f.state === stateFilter)) ||
    matches[0]
  );
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The payload fields that describe the place itself, before any layer. */
const PLACE_COLUMNS: Array<{ header: string; read(f: AtlasFeature): unknown }> = [
  { header: 'council', read: f => f.lga_name },
  { header: 'state', read: f => f.state },
  { header: 'remoteness', read: f => f.remoteness },
  { header: 'lga_code', read: f => f.lga_code },
  { header: 'seifa_irsd_decile', read: f => f.avg_irsd_decile },
  { header: 'entities', read: f => f.indexed_entities },
  { header: 'community_controlled', read: f => f.community_controlled_entities },
  { header: 'recorded_funding', read: f => f.total_funding_all_sources },
  { header: 'unplaced_count', read: f => f.unplaced_count },
  { header: 'placed_count', read: f => f.placed_count },
  // Why the unplaced cannot be placed, one column per reason that can touch
  // a council. Null (not zero) when the payload predates the reason codes.
  ...COUNCIL_REASON_COLUMNS.map(({ code, header }) => ({
    header,
    read: (f: AtlasFeature) => (f.unplaced_reasons ? (f.unplaced_reasons[code] ?? 0) : null),
  })),
];

// Only choropleth layers read council features; a point layer's data never
// rides a council export.
function liveLayers(surface: AtlasSurface): AtlasLiveLayer[] {
  return visibleAtlasLayers(surface).filter(isChoroplethLayer);
}

/** One council as CSV: a header row and a data row. Each live layer
 * contributes its value and a `<key>_contains` column carrying the caveat,
 * so the file stays honest after it leaves. */
export function councilCsv(feature: AtlasFeature, surface: AtlasSurface = 'public'): string {
  const layers = liveLayers(surface);
  const headers = [
    ...PLACE_COLUMNS.map(c => c.header),
    ...layers.flatMap(l => [l.key.replace(/-/g, '_'), `${l.key.replace(/-/g, '_')}_contains`]),
  ];
  const row = [
    ...PLACE_COLUMNS.map(c => csvCell(c.read(feature))),
    ...layers.flatMap(l => {
      const v = l.value(feature);
      return [csvCell(v), csvCell(`${l.caveat} Honest at ${l.honestAt} level: ${l.honestAtNote}`)];
    }),
  ];
  return `${headers.join(',')}\n${row.join(',')}\n`;
}

/** One council as JSON: the place fields plus every live layer's value with
 * its caveat and the geography it is honest at. */
export function councilJson(feature: AtlasFeature, surface: AtlasSurface = 'public'): {
  source: string;
  note: string;
  place: Record<string, unknown>;
  layers: Array<Record<string, unknown>>;
} {
  return {
    source: '/api/data/map',
    note: 'The full payload (every council, every live layer) is one GET of the source endpoint.',
    place: Object.fromEntries(PLACE_COLUMNS.map(c => [c.header, c.read(feature) ?? null])),
    layers: liveLayers(surface).map(layer => {
      const value = layer.value(feature);
      return {
        key: layer.key,
        name: layer.name,
        unit: layer.unit,
        value,
        formatted: value === null ? null : layer.format(value),
        contains: layer.caveat,
        honest_at: layer.honestAt,
        honest_at_note: layer.honestAtNote,
      };
    }),
  };
}

/** Filename stem for a council's export files. */
export function exportFilename(feature: AtlasFeature): string {
  return `${placeSlug(feature.lga_name)}-${feature.state.toLowerCase()}-atlas`;
}
