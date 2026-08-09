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

import { money } from '@/lib/format';

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
  /** Why the unplaced cannot be placed: lga_source reason code -> count for
   * this council's postcodes. Optional because a cached payload from before
   * the field existed may still hydrate a newer client. */
  unplaced_reasons?: Record<string, number> | null;
  justice_funding_total: number | null;
  /** GrantConnect awards to organisations placed in this council. Optional
   * for the same cached-payload reason as unplaced_reasons. */
  grants_awarded_total?: number | null;
  /** Interventions in the Australian Living Map of Alternatives linked to an
   * organisation placed in this council. Zero is a real answer (the join ran
   * and found none); null/absent means the payload predates the field. */
  alma_linked_count?: number | null;
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

/** Picker groups. Substantive layers lead; the map's own error bars sit
 * last under "How sure are we" — uncertainty qualifies the other layers,
 * it does not compete with them (Ben, 2026-08-09). */
export type AtlasLayerGroup = 'money' | 'need' | 'delivery' | 'data-quality';

export const ATLAS_GROUP_ORDER: readonly AtlasLayerGroup[] = ['money', 'need', 'delivery', 'data-quality'];

export const ATLAS_GROUP_LABELS: Record<AtlasLayerGroup, string> = {
  money: 'Money',
  need: 'Need',
  delivery: 'Delivery',
  'data-quality': 'How sure are we',
};

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
  group: AtlasLayerGroup;
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
  /** How the colour bands were chosen, when that needs saying. */
  scaleNote?: string;
}

export interface AtlasLiveLayer extends AtlasLayerCommon {
  status: 'live';
  /** Paints the council choropleth by reading a value off each map feature. */
  kind: 'choropleth';
  scale: AtlasScaleStop[];
  /** Legend entry for places where this layer holds nothing. */
  noDataLabel: string;
  /** Reads this layer's value off a map feature. Null means "no data held",
   * which paints the no-data style — it is never coerced to zero. */
  value(feature: AtlasFeature): number | null;
  format(value: number): string;
}

/** A layer whose grain is points, not council areas — communities, mostly.
 * Its data never lives in the registry or the public map payload: a surface
 * that may render it receives the points server-side (the org RSC fetches
 * them behind auth), so a public bundle carries the contract and nothing
 * else. */
export interface AtlasPointLayer extends AtlasLayerCommon {
  status: 'live';
  kind: 'points';
  scale: AtlasScaleStop[];
  /** Legend entry meaning "a point with none of the unit yet". */
  noDataLabel: string;
  format(value: number): string;
}

/** One point of an AtlasPointLayer, produced server-side by the surface that
 * is allowed to see it. */
export interface AtlasPoint {
  name: string;
  lat: number;
  lng: number;
  value: number;
  /** Extra lines for the tooltip, already formatted. */
  detail?: Array<{ label: string; value: string }>;
}

export interface AtlasDeclaredLayer extends AtlasLayerCommon {
  status: 'declared';
  /** What has to exist before this layer can turn on. User-facing. */
  waitingOn: string;
}

export type AtlasLayer = AtlasLiveLayer | AtlasPointLayer | AtlasDeclaredLayer;

export function isLiveLayer(layer: AtlasLayer): layer is AtlasLiveLayer | AtlasPointLayer {
  return layer.status === 'live';
}

/** The layers that paint the council choropleth and read map features.
 * Point layers are live but carry their own data; feature-reading call
 * sites (the map style, CSV export, panel rows) must use this guard. */
export function isChoroplethLayer(layer: AtlasLayer): layer is AtlasLiveLayer {
  return layer.status === 'live' && layer.kind === 'choropleth';
}

export function isPointLayer(layer: AtlasLayer): layer is AtlasPointLayer {
  return layer.status === 'live' && layer.kind === 'points';
}

/** Style painted for places a live layer holds nothing about. */
export const ATLAS_NO_DATA_STYLE = { color: '#e5e7eb', fillOpacity: 0.15 } as const;

/** Resolve a scaled layer's paint for a value. Null → the no-data style; a
 * value below every stop clamps to the lowest stop. */
export function atlasStyleFor(
  layer: { scale: AtlasScaleStop[] },
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
  kind: 'choropleth',
  group: 'money',
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
  // Quantile breaks of the actual score distribution (checked 2026-08-09:
  // min 20, median 110, p75 135, p90 152, max 205). The old 20/50/100/200
  // stops painted three-quarters of the country one orange and made Severe
  // nearly unreachable.
  scale: [
    { min: 150, color: '#D02020', fillOpacity: 0.7, label: 'Severe' },
    { min: 135, color: '#E06C18', fillOpacity: 0.6, label: 'High' },
    { min: 110, color: '#F0C020', fillOpacity: 0.5, label: 'Elevated' },
    { min: 80, color: '#4CB876', fillOpacity: 0.4, label: 'Mild' },
    { min: 0, color: '#1040C0', fillOpacity: 0.3, label: 'Low' },
  ],
  scaleNote:
    'Bands are quantile breaks of the current scores: the top tenth of councils reads Severe.',
  noDataLabel: 'No score held',
  value: f => num(f.desert_score),
  format: v => v.toFixed(0),
};

// Order-of-magnitude bands, not quantiles: the distribution is extreme-tail
// (checked 2026-08-09: median council $0, p90 $30M, max $281B).
const moneyRecorded: AtlasLiveLayer = {
  key: 'money-recorded',
  status: 'live',
  kind: 'choropleth',
  group: 'money',
  name: 'Recorded money',
  unit: '$ recorded reaching the council',
  caveat:
    'Dollars the entity-graph pipeline can see reaching organisations based in this ' +
    'council — justice funding, contracts and grants together. It does not include ' +
    'the GrantConnect feed, which is newer and often far larger: read the Federal ' +
    'grants layer beside this one. Counted where it was recorded, not where it ' +
    "landed, so a regional hub administering its neighbours' programs reads rich " +
    'while the places the work reaches read poor.',
  honestAt: 'council',
  honestAtNote:
    "Council of the recipient's registered address. Where the work is delivered is " +
    'mostly unrecorded.',
  consent: 'public',
  scale: [
    { min: 1_000_000_000, color: '#D02020', fillOpacity: 0.7, label: '$1B or more' },
    { min: 100_000_000, color: '#E06C18', fillOpacity: 0.6, label: '$100M–1B' },
    { min: 10_000_000, color: '#F0C020', fillOpacity: 0.5, label: '$10M–100M' },
    { min: 1_000_000, color: '#4CB876', fillOpacity: 0.4, label: '$1M–10M' },
    { min: 0, color: '#1040C0', fillOpacity: 0.3, label: 'Under $1M' },
  ],
  scaleNote: 'Order-of-magnitude bands: half of all councils hold under $1M recorded.',
  noDataLabel: 'No funding records held',
  value: f => num(f.total_funding_all_sources),
  format: v => money(v),
};

// Same recording caveat as all money here; blank means no records tied to a
// placed organisation, never "no justice spending".
const justiceFunding: AtlasLiveLayer = {
  key: 'justice-funding',
  status: 'live',
  kind: 'choropleth',
  group: 'money',
  name: 'Justice money',
  unit: '$ of justice program funding recorded',
  caveat:
    'State and federal justice program funding recorded to organisations based in ' +
    'this council — youth justice, legal services, diversion and adjacent programs. ' +
    "Recorded at the recipient's registered address like everything else here, so " +
    'hub crediting applies. Blank does not mean no justice spending: it means no ' +
    'records our pipeline could tie to a placed organisation.',
  honestAt: 'council',
  honestAtNote:
    "Council of the recipient's registered address; the program itself may run " +
    'somewhere else entirely.',
  consent: 'public',
  // Checked 2026-08-09: 540 councils hold justice records; median $1.2M,
  // p75 $11M, p90 $55M, max $29B (a capital-city hub).
  scale: [
    { min: 50_000_000, color: '#D02020', fillOpacity: 0.7, label: '$50M or more' },
    { min: 10_000_000, color: '#E06C18', fillOpacity: 0.6, label: '$10M–50M' },
    { min: 1_000_000, color: '#F0C020', fillOpacity: 0.5, label: '$1M–10M' },
    { min: 50_000, color: '#4CB876', fillOpacity: 0.4, label: '$50K–1M' },
    { min: 0, color: '#1040C0', fillOpacity: 0.3, label: 'Under $50K' },
  ],
  noDataLabel: 'No justice records held',
  value: f => num(f.justice_funding_total),
  format: v => money(v),
};

// The richest vein in the place data: the Commonwealth's own grants register,
// joined to placed organisations by entity id. Same order-of-magnitude bands
// as Recorded money (checked 2026-08-10: 801 councils hold linked awards;
// median $13M, p90 $366M, max $19B).
const grantsAwarded: AtlasLiveLayer = {
  key: 'grants-awarded',
  status: 'live',
  kind: 'choropleth',
  group: 'money',
  name: 'Federal grants',
  unit: '$ of GrantConnect awards to organisations here',
  caveat:
    "Grant awards on the Commonwealth's GrantConnect register, counted where the " +
    'receiving organisation is placed. About seven in ten awards can be tied to an ' +
    'organisation our records can place; the rest are counted nowhere on this map. ' +
    "Awarded at the recipient's registered address like everything else here, so a " +
    'regional hub reads richer than the communities its programs reach. This feed ' +
    'is newer and broader than the pipeline behind the Recorded money layer — the ' +
    'two are different windows, never a sum.',
  honestAt: 'council',
  honestAtNote:
    "Council of the recipient's registered address. A multi-year award is counted " +
    'once, in full, where it was recorded — not spread over the places or years ' +
    'the money actually reaches.',
  consent: 'public',
  scale: [
    { min: 1_000_000_000, color: '#D02020', fillOpacity: 0.7, label: '$1B or more' },
    { min: 100_000_000, color: '#E06C18', fillOpacity: 0.6, label: '$100M–1B' },
    { min: 10_000_000, color: '#F0C020', fillOpacity: 0.5, label: '$10M–100M' },
    { min: 1_000_000, color: '#4CB876', fillOpacity: 0.4, label: '$1M–10M' },
    { min: 0, color: '#1040C0', fillOpacity: 0.3, label: 'Under $1M' },
  ],
  scaleNote: 'Order-of-magnitude bands, matching the Recorded money layer.',
  noDataLabel: 'No linked awards held',
  value: f => num(f.grants_awarded_total),
  format: v => money(v),
};

// The scale runs backwards on purpose: decile 1 is the most disadvantaged
// tenth of Australia, so red sits at the LOW end.
const seifaDisadvantage: AtlasLiveLayer = {
  key: 'seifa-disadvantage',
  status: 'live',
  kind: 'choropleth',
  group: 'need',
  name: 'SEIFA disadvantage',
  unit: 'IRSD decile · 1 is the most disadvantaged tenth',
  caveat:
    'The ABS index of relative socio-economic disadvantage, averaged across the ' +
    "council's postcodes. Decile 1 means the most disadvantaged tenth of Australia; " +
    'decile 10 the least. Averaging flattens pockets: a comfortable council can ' +
    'contain a street in decile 1, and this layer will not show it.',
  honestAt: 'council',
  honestAtNote: 'Postcode SEIFA averaged to council. Suburb-sized pockets vanish in the average.',
  consent: 'public',
  scale: [
    { min: 9, color: '#1040C0', fillOpacity: 0.3, label: 'Deciles 9–10 · least disadvantaged' },
    { min: 7, color: '#4CB876', fillOpacity: 0.4, label: 'Deciles 7–8' },
    { min: 5, color: '#F0C020', fillOpacity: 0.5, label: 'Deciles 5–6' },
    { min: 3, color: '#E06C18', fillOpacity: 0.6, label: 'Deciles 3–4' },
    { min: 0, color: '#D02020', fillOpacity: 0.7, label: 'Deciles 1–2 · most disadvantaged' },
  ],
  noDataLabel: 'No SEIFA held',
  value: f => num(f.avg_irsd_decile),
  // One decimal, trailing zero trimmed: Ceduna's 2.52 must read "decile 2.5",
  // not round up to a softer "decile 3" (Ben, 2026-08-10).
  format: v => `decile ${v.toFixed(1).replace(/\.0$/, '')}`,
};

const unplacedOrgs: AtlasLiveLayer = {
  key: 'unplaced-orgs',
  status: 'live',
  kind: 'choropleth',
  group: 'data-quality',
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
  group: 'money',
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

// What works here, from the Australian Living Map of Alternatives. Zero is a
// real answer on this layer: the join ran and found no intervention linked to
// an organisation placed there — which is a fact about our linking, never
// proof that nothing works in that place. The caveat carries that weight.
// (Checked 2026-08-10: 1,332 linked interventions across 163 councils;
// median council holds 3, p90 13, max 216.)
const whatsWorking: AtlasLiveLayer = {
  key: 'whats-working',
  status: 'live',
  kind: 'choropleth',
  group: 'delivery',
  name: 'What works here',
  unit: 'interventions linked to organisations here',
  caveat:
    'Interventions in the Australian Living Map of Alternatives that are linked to ' +
    'an organisation placed in this council. The linking is young: most documented ' +
    'interventions are not yet tied to an organisation, so a place showing none ' +
    'means our linking has not reached it — not that nothing works there. What is ' +
    'missing is our record, not their work.',
  honestAt: 'council',
  honestAtNote:
    "Council of the linked organisation's registered address; the intervention " +
    'itself may run across many places or somewhere else entirely.',
  consent: 'public',
  scale: [
    { min: 50, color: '#D02020', fillOpacity: 0.7, label: '50 or more' },
    { min: 20, color: '#E06C18', fillOpacity: 0.6, label: '20–50' },
    { min: 10, color: '#F0C020', fillOpacity: 0.5, label: '10–20' },
    { min: 1, color: '#4CB876', fillOpacity: 0.4, label: '1–10' },
    // Zero stays a real, clickable answer but paints almost invisibly: at
    // 0.2 it washed the whole country blue and the layer read as broken
    // (Ben, 2026-08-10 morning). Colour belongs to places linking reached.
    { min: 0, color: '#1040C0', fillOpacity: 0.06, label: 'None linked yet' },
  ],
  scaleNote:
    'Counts of linked interventions, not effectiveness. Most of the country reads ' +
    '"none linked yet" because the linking is young — that near-blank paint is the ' +
    'honest picture, not a fault.',
  noDataLabel: 'No linkage data in this payload',
  value: f => num(f.alma_linked_count),
  // Zero formats as words, not "0 linked": beside a place name and the layer
  // title "What works here", a giant zero reads as a verdict on the place.
  format: v => (v === 0 ? 'None yet' : `${v.toFixed(0)} linked`),
};

/** Communities whose in-person consent to appear on the PUBLIC Goods layer
 * has been gathered and recorded. Adding a community name here is the whole
 * flip: the layer's consent tier derives from this list, and the server feed
 * ships only consented places to public surfaces. Empty until the consent
 * conversation lands (Atlas step 5) — names are matched case-insensitively
 * against the Goods register's community_name. */
export const GOODS_PUBLIC_PLACES: readonly string[] = [];

export function isGoodsPlacePublic(communityName: string): boolean {
  const wanted = communityName.trim().toLowerCase();
  return GOODS_PUBLIC_PLACES.some(place => place.trim().toLowerCase() === wanted);
}

// The inverse layer: CivicGraph shows money recorded, Goods shows things in
// community. Consent tier derives from the per-place consent list above:
// with no consented places it is 'org' — it renders only inside the
// logged-in workspace, its points arrive only from the org page's server
// fetch, and this registry entry deliberately carries NO figures: the
// contract may ship in a public bundle, the numbers may not. Once a place
// consents, the layer turns public and the server feed (goods-atlas-points)
// ships ONLY consented places to public surfaces.
const goodsDelivered: AtlasPointLayer = {
  key: 'goods-delivered',
  status: 'live',
  kind: 'points',
  group: 'delivery',
  name: 'Goods in community',
  unit: 'units the asset register places here',
  caveat:
    'Beds and washing machines with an active row in the Goods asset register, ' +
    'counted at the community the register names. The register itemises fewer ' +
    'units by place than the canonical deployed total, so places that received ' +
    'Stretch Beds read low here — the Utopia homelands most of all. And a unit ' +
    'recorded at a town may have been staged through it: the register does not ' +
    'distinguish delivered-to from staged-at.',
  honestAt: 'community',
  honestAtNote:
    'Community points, not council areas. A place with no point holds no register ' +
    'rows, which is not the same as nothing delivered.',
  consent: GOODS_PUBLIC_PLACES.length > 0 ? 'public' : 'org',
  scale: [
    { min: 100, color: '#D02020', fillOpacity: 0.85, label: '100+ units' },
    { min: 50, color: '#E06C18', fillOpacity: 0.85, label: '50–100' },
    { min: 20, color: '#F0C020', fillOpacity: 0.85, label: '20–50' },
    { min: 1, color: '#4CB876', fillOpacity: 0.85, label: '1–20' },
    { min: 0, color: '#1040C0', fillOpacity: 0.85, label: 'Demand recorded, none yet' },
  ],
  noDataLabel: 'No register rows',
  format: v => `${v.toFixed(0)} units`,
};

// Federal grants sits above Recorded money on purpose (Ben, 2026-08-10):
// the GrantConnect feed is the richer, truer window, and the older pipeline
// number must not lead when the two sit side by side.
export const ATLAS_LAYERS: readonly AtlasLayer[] = [
  fundingDeserts,
  grantsAwarded,
  moneyRecorded,
  justiceFunding,
  renewalCliff,
  seifaDisadvantage,
  whatsWorking,
  goodsDelivered,
  unplacedOrgs,
];

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
