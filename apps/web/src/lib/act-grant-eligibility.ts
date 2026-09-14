/** Eligibility before fit: can an ACT entity apply for this grant, and does the project operate where the grant
 *  is limited to? Every verdict is yes / no / unknown, and unknown is the honest default: on 2026-09-14 only 7 of
 *  3,088 live public grants recorded dgr_required and 302 recorded accepts_pty_ltd.
 *  Entities and places are Ben's answers of 2026-09-14. Legal facts: act-core-facts.md (DGR only via Butterfly). */

export type Verdict = 'yes' | 'no' | 'unknown';

export type ActEntity = 'pty' | 'butterfly' | 'akt';

export const ENTITY_LABEL: Record<ActEntity, string> = {
  pty: 'A Curious Tractor Pty Ltd',
  butterfly: 'The Butterfly Movement (DGR)',
  akt: 'A Kind Tractor Ltd',
};

const ENTITY_FACTS: Record<ActEntity, { isCompany: boolean; isCharity: boolean; hasDgr: boolean }> = {
  pty: { isCompany: true, isCharity: false, hasDgr: false },
  butterfly: { isCompany: false, isCharity: true, hasDgr: true },
  akt: { isCompany: false, isCharity: true, hasDgr: false },
};

export type ActProject = 'goods' | 'justicehub' | 'empathy-ledger' | 'harvest' | 'farm' | 'contained';

export interface OperatingArea {
  national: boolean;
  states: string[];
  lgas: { state: string; lga: string }[];
}

export const ACT_PROJECTS: Record<ActProject, { label: string; entities: ActEntity[]; area: OperatingArea }> = {
  goods: { label: 'Goods', entities: ['pty', 'butterfly'], area: { national: false, states: ['NT', 'QLD', 'WA'], lgas: [] } },
  justicehub: { label: 'JusticeHub', entities: ['pty', 'akt'], area: { national: true, states: [], lgas: [] } },
  'empathy-ledger': { label: 'Empathy Ledger', entities: ['pty', 'butterfly'], area: { national: true, states: [], lgas: [] } },
  harvest: { label: 'Harvest', entities: ['pty', 'butterfly'], area: { national: false, states: [], lgas: [{ state: 'QLD', lga: 'Sunshine Coast' }] } },
  farm: { label: 'Farm', entities: ['pty', 'butterfly'], area: { national: false, states: [], lgas: [{ state: 'QLD', lga: 'Sunshine Coast' }] } },
  contained: { label: 'Contained', entities: ['pty', 'butterfly'], area: { national: true, states: [], lgas: [] } },
};

export interface GrantPlace {
  known: boolean;
  national: boolean;
  states: string[];
  lgas: { state: string | null; lga: string }[];
}

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

/** Place from metadata.place when the engine saved one, otherwise from the geography code list. */
export function grantPlace(geography: string | null, place: unknown): GrantPlace {
  const p = (place && typeof place === 'object' ? place : null) as { national?: boolean; state?: string; lga_name?: string } | null;
  if (p?.national) return { known: true, national: true, states: [], lgas: [] };
  if (p?.lga_name) return { known: true, national: false, states: p.state ? [p.state.toUpperCase()] : [], lgas: [{ state: p.state?.toUpperCase() ?? null, lga: p.lga_name }] };
  if (p?.state) return { known: true, national: false, states: [p.state.toUpperCase()], lgas: [] };

  const tokens = (geography ?? '').split(',').map((t) => t.trim().replace(/^AU-/i, '').toUpperCase()).filter(Boolean);
  if (tokens.includes('NATIONAL')) return { known: true, national: true, states: [], lgas: [] };
  const states = tokens.filter((t) => STATES.includes(t));
  if (states.length) return { known: true, national: false, states, lgas: [] };
  return { known: false, national: false, states: [], lgas: [] };
}

const norm = (s: string) => s.toLowerCase().replace(/\b(city|shire|regional|council|of)\b/g, '').replace(/\s+/g, ' ').trim();

/** Does the project operate inside the grant's area? */
export function locationVerdict(area: OperatingArea, place: GrantPlace): Verdict {
  if (!place.known) return 'unknown';
  if (place.national) return 'yes';
  if (place.lgas.length) {
    const hit = place.lgas.some((g) => area.lgas.some((a) => norm(a.lga) === norm(g.lga) && (!g.state || g.state === a.state)));
    if (hit) return 'yes';
    // A national project may still run work in that council; that is a question, not a no.
    return area.national ? 'unknown' : 'no';
  }
  const areaStates = new Set([...area.states, ...area.lgas.map((l) => l.state)]);
  if (place.states.some((s) => areaStates.has(s))) return 'yes';
  // National projects usually need a presence in a state to take its money: ask, don't assume.
  return area.national ? 'unknown' : 'no';
}

/** Can this entity apply, from the two recorded flags? */
export function entityVerdict(entity: ActEntity, grant: { dgr_required: boolean | null; accepts_pty_ltd: boolean | null }): Verdict {
  const f = ENTITY_FACTS[entity];
  if (grant.dgr_required === true) return f.hasDgr ? 'yes' : 'no';
  if (f.isCompany && grant.accepts_pty_ltd != null) return grant.accepts_pty_ltd ? 'yes' : 'no';
  return 'unknown';
}

export interface ProjectEligibility {
  project: ActProject;
  location: Verdict;
  entities: { entity: ActEntity; verdict: Verdict }[];
  /** yes = some entity yes and location yes; no = every entity no or location no; otherwise unknown. */
  overall: Verdict;
}

export function projectEligibility(
  project: ActProject,
  grant: { dgr_required: boolean | null; accepts_pty_ltd: boolean | null; geography: string | null; place: unknown },
): ProjectEligibility {
  const def = ACT_PROJECTS[project];
  const location = locationVerdict(def.area, grantPlace(grant.geography, grant.place));
  const entities = def.entities.map((entity) => ({ entity, verdict: entityVerdict(entity, grant) }));
  let overall: Verdict = 'unknown';
  if (location === 'no' || entities.every((e) => e.verdict === 'no')) overall = 'no';
  else if (location === 'yes' && entities.some((e) => e.verdict === 'yes')) overall = 'yes';
  return { project, location, entities, overall };
}
