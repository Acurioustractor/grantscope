/**
 * Fit scorers for the five ACT projects other than Goods (which has its own,
 * more heavily tuned scorer in goods-relevance.mjs).
 *
 * Same shape as scoreGrantForGoods: score 0-100, signals explain the math.
 *
 * These are a FIRST PASS, not yet measured against real grant data the way
 * goods-relevance.mjs was (that one went through a 2026-05-27 noise-fix after
 * a real rescore). Do not wire a rescore-and-write script from this file
 * without a --dry-run measurement first — see CLAUDE.md "Data quality before
 * scoring".
 *
 * The trap this file exists to avoid: apps/web/src/lib/opportunity-intelligence.ts
 * PROJECT_LENSES uses bare substrings ('data', 'land', 'tour', 'story') that
 * match unrelated grants (a data-analytics grant is not CivicGraph-shaped; a
 * bushfire-affected-land grant is not Farm-shaped; a study-tour grant is not
 * Contained-shaped). Every project here requires at least one TIER_1 hit
 * (a specific, multi-word phrase) before a lone thematic word can tag it —
 * the same "shaped" gate goods-relevance.mjs uses for identity words.
 */

export const PROJECT_TAG_THRESHOLD = 30;

// ACT Government rounds share ONE boilerplate description across every sibling grant in the
// round — a long comma-separated list of every category the round covers ("Child protection
// and youth justice ... Gambling harm ... Support for veterans and their families ..."). A hit
// there says nothing about the specific grant; only the name is a trustworthy signal for this
// source. Verified 2026-09-14: "Support for veterans and their families" hit tier1 "youth
// justice" purely from this shared list. Same pattern as Goods's SOURCE_DISQUALIFIERS.
const NAME_ONLY_SOURCES = new Set(['act government']);

/** @typedef {{ tier1: string[], tier2: string[], tier3?: string[], disqualifiers?: string[], states?: string[] }} ProjectConfig */

/** @type {Record<string, ProjectConfig>} */
export const PROJECT_CONFIGS = {
  justicehub: {
    tier1: [
      'youth justice', 'justice reinvestment', 'diversion program', 'diversionary program',
      'restorative justice', 'youth detention', 'juvenile justice', 'youth mentoring',
      'throughcare', 'bail support', 'recidivism', 'reoffending',
    ],
    tier2: ['justice', 'detention', 'incarceration', 'juvenile', 'at-risk youth', 'court support'],
    tier3: ['youth', 'mentor', 'community safety', 'first nations'],
    disqualifiers: ['environmental justice', 'climate justice', 'economic justice', 'social justice fund'],
  },
  'empathy-ledger': {
    tier1: [
      'empathy ledger', 'data sovereignty', 'indigenous data sovereignty',
      'lived experience storytelling', 'digital storytelling', 'story sharing platform',
      'consent-based data', 'narrative evidence', 'oral history project',
    ],
    tier2: ['storytelling', 'lived experience', 'oral history', 'community voice', 'digital archive'],
    tier3: ['story', 'narrative', 'consent', 'ethics'],
    disqualifiers: ['general ledger', 'accounting ledger', 'bookkeeping', 'trust ledger'],
  },
  harvest: {
    tier1: [
      'community food', 'food security', 'food relief', 'community garden',
      'urban agriculture', 'food rescue', 'food sovereignty',
    ],
    tier2: ['nutrition', 'food access', 'community kitchen', 'growing food'],
    tier3: ['garden', 'harvest', 'produce', 'local food'],
    disqualifiers: ['wine harvest', 'grape harvest', 'harvest festival'],
    states: ['QLD'],
  },
  farm: {
    tier1: [
      'regenerative agriculture', 'regenerative farming', 'agroforestry', 'landcare',
      'soil health', 'natural capital', 'sustainable farming', 'farm biodiversity',
    ],
    tier2: ['agriculture', 'land management', 'biodiversity', 'revegetation', 'catchment'],
    tier3: ['farm', 'trees', 'soil', 'land'],
    disqualifiers: ['wind farm', 'solar farm', 'server farm', 'fish farm', 'farmland acquisition tax'],
    states: ['QLD'],
  },
  contained: {
    tier1: [
      'shipping container', 'container exhibition', 'touring exhibition',
      'immersive installation', 'pop-up exhibition', 'mobile exhibition',
    ],
    tier2: ['immersive', 'installation art', 'exhibition tour'],
    tier3: ['exhibition', 'container', 'installation'],
    disqualifiers: ['study tour', 'sports tour', 'concert tour', 'tour operator', 'tourism'],
  },
};

/**
 * Score a grant for a given project. Mirrors scoreGrantForGoods's shape and
 * additive-tier approach, minus Goods's funder/discovery-method boosts, which
 * don't have an equivalent for these projects yet.
 * @param {string} project one of PROJECT_CONFIGS' keys
 * @param {object} grant Row from grant_opportunities (any subset of columns is fine)
 */
export function scoreGrantForProject(project, grant) {
  const config = PROJECT_CONFIGS[project];
  if (!config) throw new Error(`unknown project: ${project}`);

  const name = String(grant.name || '').toLowerCase();
  const provider = String(grant.provider || '').toLowerCase();
  const source = String(grant.source || '').toLowerCase();
  const description = NAME_ONLY_SOURCES.has(source) ? '' : String(grant.description || '').toLowerCase();
  const haystack = [name, provider, description].join(' ');

  const signals = {
    tier1_hits: [], tier2_hits: [], tier3_hits: [],
    disqualifier_hits: [], geography: null,
  };
  let score = 0;

  for (const kw of config.tier1) {
    if (haystack.includes(kw)) {
      signals.tier1_hits.push(kw);
      score += 20;
      if (name.includes(kw)) score += 8;
    }
  }
  for (const kw of config.tier2) {
    if (haystack.includes(kw)) {
      signals.tier2_hits.push(kw);
      score += 8;
    }
  }
  for (const kw of config.tier3 || []) {
    if (haystack.includes(kw)) {
      signals.tier3_hits.push(kw);
      score += 2;
    }
  }
  for (const dq of config.disqualifiers || []) {
    if (haystack.includes(dq)) {
      signals.disqualifier_hits.push(dq);
      score -= 25;
    }
  }

  // Geography: projects scoped to specific states get a small boost when the
  // grant matches and no penalty when it doesn't — location eligibility is
  // handled separately by act-grant-eligibility.ts; this is fit, not a gate.
  if (config.states && grant.geography) {
    const tokens = String(grant.geography).split(',').map((t) => t.trim().replace(/^AU-/i, '').toUpperCase());
    if (tokens.includes('NATIONAL') || config.states.some((s) => tokens.includes(s))) {
      signals.geography = grant.geography;
      score += 6;
    }
  }

  const closesAt = grant.closes_at || grant.deadline;
  if (closesAt) {
    const closesDate = new Date(closesAt);
    if (!isNaN(closesDate.getTime()) && closesDate < new Date()) {
      score -= 30;
      signals.closed = true;
    }
  }

  // The "shaped" gate: a lone thematic (tier2/tier3) hit cannot reach the tag
  // threshold on its own. Without this, "land" tags every rural-roads grant
  // as Farm-shaped and "tour" tags every arts-touring grant as Contained.
  const shaped = signals.tier1_hits.length > 0;
  if (!shaped && score >= PROJECT_TAG_THRESHOLD) {
    signals.thematic_only_cap = score;
    score = PROJECT_TAG_THRESHOLD - 1;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, signals };
}

/** Score a grant against every configured project. Returns only projects at/above the threshold, highest first. */
export function scoreGrantForAllProjects(grant) {
  return Object.keys(PROJECT_CONFIGS)
    .map((project) => ({ project, ...scoreGrantForProject(project, grant) }))
    .filter((r) => r.score >= PROJECT_TAG_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}
