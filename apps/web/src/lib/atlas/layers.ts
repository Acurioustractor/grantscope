// The Atlas layer registry — the contract every Atlas surface builds on.
//
// A layer is not a dataset; it is a claim about places, and the registry
// forces every claim to carry its qualifications: what the number contains
// (the caveat), the geography it is honest at, and who is allowed to see it
// (the consent tier). A layer with no caveat cannot be registered — the type
// requires one, and the tests reject empty ones.
//
// Layers come in two states:
//   - 'live'     — the Atlas holds the data today and can paint it.
//   - 'declared' — the layer is part of the contract but the data is not held
//                  yet. Declared layers appear in the picker so the surface
//                  can say "we cannot show you this yet" out loud, which is
//                  the register of the whole place project.
//
// Consent tiers decide which surfaces may render a layer at all:
//   - 'public'   — anyone.
//   - 'org'      — only inside an organisation's logged-in workspace.
//   - 'withheld' — registered but shown nowhere, on any surface, until the
//                  consent conversation flips it. This is the resting state
//                  for the Goods delivery layer: per-place community consent
//                  comes first, and until it exists the layer stays dark.
// Enforcement note: the tier gates rendering, but any org/withheld layer's
// DATA must also be stripped server-side (RSC/API) — never sent and hidden
// client-side. The registry itself holds no figures, only the contract.

/** One row of the /api/data/map payload. */
export interface AtlasFeature {
  lga_name: string;
  state: string;
  remoteness: string | null;
  avg_irsd_decile: number | null;
  avg_irsd_score: number | null;
  indexed_entities: number | null;
  community_controlled_entities: number | null;
  total_funding_all_sources: number | null;
  desert_score: number | null;
  unplaced_count: number;
  placed_count: number;
  unplaced_share: number | null;
  /** Null when the council has no point coordinates; it still renders where a
   * boundary matches its name. Coordinates only drive bounds-fitting. */
  lat: number | null;
  lng: number | null;
  lga_code: string;
}

export type AtlasConsentTier = 'public' | 'org' | 'withheld';

/** The geography a layer's number is honest at — not the finest grain the
 * data could be sliced to, but the coarsest one at which the claim survives
 * its own caveat. */
export type AtlasGeography = 'national' | 'state' | 'council' | 'postcode' | 'community';

/** A step of a layer's color scale. Stops are ordered from highest `min` to
 * lowest; the first stop whose `min` is <= the value wins. */
export interface AtlasScaleStop {
  min: number;
  color: string;
  fillOpacity: number;
  /** Plain words for the legend. */
  label: string;
}

interface AtlasLayerCommon {
  key: string;
  /** Plain words. What a person in a room would call it. */
  name: string;
  /** What one unit of the number means, e.g. "% of organisations". */
  unit: string;
  /** What this number contains — the paragraph shown WITH the number,
   * never on a separate help page. */
  caveat: string;
  honestAt: AtlasGeography;
  /** One or two sentences on where the honesty ends. */
  honestAtNote: string;
  consent: AtlasConsentTier;
}

export interface AtlasLiveLayer extends AtlasLayerCommon {
  status: 'live';
  scale: AtlasScaleStop[];
  /** Legend entry for places where this layer holds nothing. */
  noDataLabel: string;
  /** Reads this layer's value off a map feature. Null means "no data held",
   * which paints the no-data style — it is never coerced to zero. */
  value(feature: AtlasFeature): number | null;
  format(value: number): string;
}

export interface AtlasDeclaredLayer extends AtlasLayerCommon {
  status: 'declared';
  /** What has to exist before this layer can turn on. User-facing. */
  waitingOn: string;
}

export type AtlasLayer = AtlasLiveLayer | AtlasDeclaredLayer;

export function isLiveLayer(layer: AtlasLayer): layer is AtlasLiveLayer {
  return layer.status === 'live';
}

/** Style painted for places a live layer holds nothing about. */
export const ATLAS_NO_DATA_STYLE = { color: '#e5e7eb', fillOpacity: 0.15 } as const;

/** Resolve a live layer's paint for a value. Null → the no-data style; a
 * value below every stop clamps to the lowest stop. */
export function atlasStyleFor(
  layer: AtlasLiveLayer,
  value: number | null
): { color: string; fillOpacity: number } {
  if (value === null) return ATLAS_NO_DATA_STYLE;
  for (const stop of layer.scale) {
    if (value >= stop.min) return { color: stop.color, fillOpacity: stop.fillOpacity };
  }
  const last = layer.scale[layer.scale.length - 1];
  return { color: last.color, fillOpacity: last.fillOpacity };
}

/** exec_sql returns numerics as numbers or strings depending on the column;
 * coerce defensively and treat anything non-finite as "no data". */
function num(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const fundingDeserts: AtlasLiveLayer = {
  key: 'funding-deserts',
  status: 'live',
  name: 'Funding deserts',
  unit: 'desert score',
  caveat:
    "Each council's SEIFA disadvantage set against the public money our records can see " +
    'reaching it — justice funding, contracts and grants together. Money is counted where ' +
    'it was recorded, not where it landed: a program run from a regional office credits ' +
    "the office's council, not the communities it serves. A high score can mean a real " +
    'desert, or money arriving through channels our records cannot see.',
  honestAt: 'council',
  honestAtNote:
    'Council level only. Within a council it cannot say which town the money reached, and ' +
    'in remote areas regional-office recording can move money to the wrong council entirely.',
  consent: 'public',
  scale: [
    { min: 200, color: '#D02020', fillOpacity: 0.7, label: 'Severe' },
    { min: 100, color: '#E06C18', fillOpacity: 0.6, label: 'High' },
    { min: 50, color: '#F0C020', fillOpacity: 0.5, label: 'Elevated' },
    { min: 20, color: '#4CB876', fillOpacity: 0.4, label: 'Mild' },
    { min: 0, color: '#1040C0', fillOpacity: 0.3, label: 'Low' },
  ],
  noDataLabel: 'No score held',
  value: f => num(f.desert_score),
  format: v => v.toFixed(0),
};

const unplacedOrgs: AtlasLiveLayer = {
  key: 'unplaced-orgs',
  status: 'live',
  name: 'Unplaced organisations',
  unit: '% of organisations we cannot place',
  caveat:
    "Organisations registered in a council's postcodes that our records cannot tie to any " +
    'single council. A postcode can span several councils, so an unplaced organisation ' +
    'counts toward every council it might belong to — these shares can never be summed ' +
    'into a total. The higher the share, the less certain every other number on this map ' +
    'is for that place.',
  honestAt: 'council',
  honestAtNote:
    'Honest per council, wrong when summed: the same organisation appears under every ' +
    'council that shares its postcode.',
  consent: 'public',
  scale: [
    { min: 75, color: '#D02020', fillOpacity: 0.7, label: '75% or more' },
    { min: 50, color: '#E06C18', fillOpacity: 0.6, label: '50–75%' },
    { min: 25, color: '#F0C020', fillOpacity: 0.5, label: '25–50%' },
    { min: 10, color: '#4CB876', fillOpacity: 0.4, label: '10–25%' },
    { min: 0, color: '#1040C0', fillOpacity: 0.3, label: 'Under 10%' },
  ],
  noDataLabel: 'No organisations recorded',
  value: f => num(f.unplaced_share),
  format: v => `${v.toFixed(0)}%`,
};

// Declared, not held: the registry's proof that a layer can exist before its
// data does. The four region pages measure this today; the Atlas cannot yet.
const renewalCliff: AtlasDeclaredLayer = {
  key: 'renewal-cliff',
  status: 'declared',
  name: 'Funding renewal cliff',
  unit: '% of visible funding ending within 24 months',
  caveat:
    "The share of a place's visible grants and contracts that end within the next 24 " +
    'months. In every region measured so far, most visible funding ends within that ' +
    'window. End dates come from the records: a program renewed without a new record ' +
    'will look like a cliff that never falls.',
  honestAt: 'council',
  honestAtNote:
    'End dates are only as honest as the records that carry them; quiet renewals and ' +
    'extensions are invisible.',
  consent: 'public',
  waitingOn:
    'Per-council end-date aggregation. The four region pages measure this today; the ' +
    'Atlas needs it for every council before the layer can turn on.',
};

export const ATLAS_LAYERS: readonly AtlasLayer[] = [fundingDeserts, unplacedOrgs, renewalCliff];

export const DEFAULT_ATLAS_LAYER_KEY = fundingDeserts.key;

/** A surface that renders Atlas layers. 'public' is anyone; 'org' is a
 * logged-in organisation workspace. There is deliberately no surface that
 * renders 'withheld' layers. */
export type AtlasSurface = 'public' | 'org';

const VISIBLE_TIERS: Record<AtlasSurface, readonly AtlasConsentTier[]> = {
  public: ['public'],
  org: ['public', 'org'],
};

/** The only sanctioned way for a surface to pick layers. Filtering anywhere
 * else is how a withheld layer ends up on a public screen. */
export function visibleAtlasLayers(
  surface: AtlasSurface,
  layers: readonly AtlasLayer[] = ATLAS_LAYERS
): AtlasLayer[] {
  return layers.filter(layer => VISIBLE_TIERS[surface].includes(layer.consent));
}

export function getAtlasLayer(key: string): AtlasLayer | null {
  return ATLAS_LAYERS.find(layer => layer.key === key) ?? null;
}
