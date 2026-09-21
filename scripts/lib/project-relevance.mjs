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
      // Added 2026-09-21 after a JEV sweep of the rejected pool found three real misses.
      // 'youth crime' — "Strengthening Efforts to Reduce Youth Crime" (Kempsey + Tamworth,
      //   $5M each) scored 2/30, because the round's description is procurement boilerplate
      //   and 'youth' alone is tier3.
      // 'bail and remand' / 'remand support' — "Aboriginal Justice Agreement Bail and Remand
      //   Support Program" ($20M to 2028) scored 8/30. 'bail support' was already tier1, but
      //   these are substring matches: "Bail and Remand Support" does not contain "bail support".
      'youth crime', 'bail and remand', 'remand support', 'young offender', 'youth offending',
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
      // Added 2026-09-21. "2026 Regional Arts Touring Round 2" scored 0/30 — its name
      // says "Regional Arts Touring", which none of the singular phrases above match.
      // Only phrases that carry BOTH travel and visual-arts sense. Two looser
      // attempts were measured against all 26,840 rows and rejected:
      //   bare 'exhibitions' -> tagged four Lord Mayor's craft-fair grants
      //     ("Sewing of canvas screens for regular exhibitions", "Art and Craft
      //     Exhibitions at Hypermarket Shopping Centre").
      //   bare 'touring'     -> tagged 160+ Playing Queensland Fund grants for
      //     orchestras, theatre and circus. Contained is a container exhibition,
      //     not a touring show.
      // KNOWN BLIND SPOT, accepted: "Visions of Australia" (the national touring
      // exhibition fund, ~$120k rounds) says "development and touring of quality
      // exhibitions". No substring spans that without one of the above collateral
      // classes, so this list cannot reach it. The JEV rubric sweep rates it 2.88/3
      // — see scripts/jev-pilot/4-missed-money.mjs. It is a standing argument for
      // rubric scoring over keyword lists, not a gap to widen the list for.
      'arts touring', 'touring arts', 'touring exhibitions',
    ],
    tier2: ['immersive', 'installation art', 'exhibition tour', 'exhibitions'],
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

/** The aligned_projects tag code for each project this file scores (ACT-GD/goods excluded — it has its own scorer). */
export const PROJECT_CODES = {
  justicehub: 'ACT-JH',
  'empathy-ledger': 'ACT-EL',
  harvest: 'ACT-HV',
  farm: 'ACT-FM',
  contained: 'ACT-CN',
};

/**
 * Apply every project's score to a row's tags in one pass and say what moved, per project.
 * Same tag_change ledger goods-relevance.mjs keeps in goods_relevance_signals, kept here in
 * project_relevance.tag_changes so a rescore's effect stays auditable.
 * @param {object} row must carry aligned_projects and project_relevance (previous scores)
 * @param {Record<string, {score: number, signals: object}>} results keyed by project id
 */
/**
 * Rubric signal thresholds. The keyword tiers above find grants whose WORDING
 * matches ours; the rubric finds grants that describe the same work in different
 * words. Both are needed — measured 2026-09-21, the keyword lists alone showed
 * ACT 19 of 383 open grants and missed two $5M youth-crime rounds outright.
 *
 * Written by scripts/score-project-rubric.mjs into
 * project_relevance.<project>.rubric = { score, confidence, geography_excluded? }
 * and project_relevance.rubric_meta  = { organisation_fundable, model, scored_at }.
 */
// Measured 2026-09-21 over the 380 open grants, against the 7 candidates verified
// by hand. The rubric's own wording puts 2.0 at "plausible", but auto-tagging there
// is too loose — it admitted "Mazda Foundation (NZ) Grants" and an already-closed
// visual-arts program.
//   2.00 -> 46 tags, 7/7 verified wins kept
//   2.25 -> 36 tags, 6/7
//   2.50 -> 21 tags, 6/7   <- chosen: half the volume, and the only win lost is
//                             "SCC Major Grants", which is a GEOGRAPHY signal
//                             (our home council) and never was a theme match.
//   2.75 ->  9 tags, 4/7
// Raise or lower this only with the same measurement re-run; do not nudge it.
export const RUBRIC_FIT_AT = 2.5;
export const RUBRIC_CONFIDENCE_AT = 0.5; // below this the model is not committing
export const RUBRIC_ORG_FUNDABLE_AT = 0.5;
// A grant "plausible" for this many unrelated projects is a generic community-grants
// programme, not a theme match. Measured: 9 such grants produced 48 of 76 candidate
// rows and drowned the list. They are still scored, just never tagged on the rubric.
export const RUBRIC_GENERIC_PROJECT_COUNT = 3;

/**
 * Does the stored rubric result for one project justify a tag on its own?
 * Pure, so it can be tested without a database or an API call.
 */
export function rubricQualifies(rubric, rubricMeta) {
  if (!rubric) return false;
  if (rubric.geography_excluded) return false;
  if (typeof rubric.score !== 'number' || rubric.score < RUBRIC_FIT_AT) return false;
  if ((rubric.confidence ?? 0) < RUBRIC_CONFIDENCE_AT) return false;
  if ((rubricMeta?.organisation_fundable ?? 1) < RUBRIC_ORG_FUNDABLE_AT) return false;
  return true;
}

/** How many projects the rubric rates as a fit. >= RUBRIC_GENERIC_PROJECT_COUNT means "generic programme". */
export function countRubricFits(relevance) {
  const meta = relevance?.rubric_meta;
  return Object.keys(PROJECT_CODES)
    .filter((p) => rubricQualifies(relevance?.[p]?.rubric, meta)).length;
}

export function applyProjectTags(row, results, at = new Date().toISOString()) {
  const before = new Set(row.aligned_projects || []);
  const tagged = new Set(before);
  const changes = {};
  const relevance = { ...(row.project_relevance || {}) };

  // The rubric verdict is computed from what is ALREADY stored on the row, so a
  // keyword rescore never silently drops a rubric-tagged grant. Generic-programme
  // suppression needs the cross-project count, so it is computed once up front.
  const isGenericProgramme = countRubricFits(relevance) >= RUBRIC_GENERIC_PROJECT_COUNT;

  for (const [project, code] of Object.entries(PROJECT_CODES)) {
    const result = results[project];
    if (!result) continue;
    const wasTagged = before.has(code);

    const existingRubric = relevance[project]?.rubric ?? null;
    const byKeyword = result.score >= PROJECT_TAG_THRESHOLD;
    const byRubric = !isGenericProgramme && rubricQualifies(existingRubric, relevance.rubric_meta);

    if (byKeyword || byRubric) tagged.add(code);
    else tagged.delete(code);

    const isTagged = tagged.has(code);
    const change = wasTagged === isTagged ? null : (isTagged ? 'added' : 'removed');
    const previousScore = relevance[project]?.score ?? null;
    if (change) {
      changes[project] = {
        change, at, previous_score: previousScore, score: result.score,
        // Which signal moved it. Without this, a rubric-only tag looks like a
        // keyword scorer that has started hallucinating.
        by: byKeyword && byRubric ? 'both' : byKeyword ? 'keyword' : 'rubric',
      };
    }
    // Preserve `rubric`: this assignment replaces the whole per-project object, so
    // anything not carried across here is destroyed on the next keyword rescore.
    relevance[project] = {
      score: result.score,
      signals: result.signals,
      scored_at: at,
      ...(existingRubric ? { rubric: existingRubric } : {}),
      tagged_by: isTagged ? (byKeyword && byRubric ? 'both' : byKeyword ? 'keyword' : 'rubric') : null,
    };
  }

  const anyChange = Object.keys(changes).length > 0;
  if (anyChange) relevance.tag_changes = { ...(relevance.tag_changes || {}), ...changes };

  return { tagged: Array.from(tagged), changes, relevance };
}
