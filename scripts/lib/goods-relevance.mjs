/**
 * Goods relevance scorer
 *
 * Pure function: scores a grant row 0-100 based on six signals.
 * Score >= 50 → tag `ACT-GD` in aligned_projects (the canonical Goods marker).
 * Score >= 70 → "high-fit"; surfaces in goods workbench by default.
 *
 * Designed to be cheap: no embeddings, no LLM. Keyword + category + geography only.
 * Embedding-based re-ranking is a follow-up if needed.
 */

// Words and phrases that signal Goods-shaped funding/buying.
// Tier 1 = strongest signal — Indigenous identity / direct Goods product fit
const TIER_1 = [
  'indigenous', 'aboriginal', 'first nations', 'torres strait', 'first peoples',
  'community infrastructure', 'community housing',
  'aboriginal housing', 'indigenous housing', 'remote housing',
  'community store', 'essential goods', 'household goods',
  'whitegoods', 'white goods', 'furniture',
  'beds', 'bedding', 'mattress', 'washing machine',
  'aboriginal community controlled', 'acco',
  'closing the gap', 'self-determination',
];

// Tier 2 = strong signal — geographic / thematic context
const TIER_2 = [
  'remote', 'regional', 'rural',
  'housing', 'homelessness', 'shelter', 'accommodation',
  'community development', 'community-led',
  'social enterprise', 'cultural authority',
  'wellbeing', 'family violence', 'domestic violence',
  'aged care', 'disability', 'ndis',
];

// Tier 3 = supporting signal
const TIER_3 = [
  'community', 'youth', 'children', 'family', 'health',
  'equipment', 'infrastructure', 'capital', 'asset',
  'organisation', 'organization', 'capacity', 'wraparound',
];

// Geographies where Goods has active or lead communities.
// Score boost when grant.geography matches.
const GOODS_GEOGRAPHIES = new Set(['AU-NT', 'AU-WA', 'AU-QLD', 'AU-SA']);

// Disqualifiers — strong indicators this is NOT Goods-shaped
const DISQUALIFIERS = [
  'scholarship', 'phd', 'research grant', 'fellowship', 'sabbatical',
  'individual artist', 'individual researcher', 'student bursary',
  'travel grant', 'conference', 'symposium',
];

// Hard structural disqualifiers — Goods (a Pty Ltd / community-controlled social
// enterprise) cannot apply to these, regardless of how Goods-shaped the text reads.
// These produce ~71% of the score>=60 noise:
//   - arc-grants:    ARC university research (DP/LP/DE/LE/FT). The high-scoring
//                    rows are *real* First Nations research projects (score 100 on
//                    Indigenous keywords) — eligible-looking, structurally barred.
//   - qld-arts-data: arts-development grants; Goods is not an arts producer.
const SOURCE_DISQUALIFIERS = new Set(['arc-grants', 'qld-arts-data']);
// University / research-council providers are research bodies, not Goods funders
// or buyers. Matches "X University" and "University of X".
const UNIVERSITY_PROVIDER = /\buniversit(?:y|ies)\b/;

// discovery_method tags for the parallel money-types GrantScope's grant scorer
// under-weights (capital + procurement). Boost so they aren't squashed for not
// reading like a "grant". Forward-looking hook — no such rows exist yet.
const BOOSTED_DISCOVERY_METHODS = new Set(['indigenous-finance', 'procurement']);

/**
 * Score a single grant. Returns { score, signals } where signals explains the math.
 * @param {object} grant Row from grant_opportunities (any subset of columns is fine)
 */
export function scoreGrantForGoods(grant) {
  const name = String(grant.name || '').toLowerCase();
  const provider = String(grant.provider || '').toLowerCase();
  const description = String(grant.description || '').toLowerCase();
  const haystack = [name, provider, description].join(' ');
  const source = String(grant.source || '').toLowerCase();
  const discoveryMethod = String(grant.discovery_method || '').toLowerCase();

  // Hard structural disqualifier — short-circuit to 0 before any scoring. A
  // First-Nations-themed ARC research grant still scores 0 here: Goods cannot
  // apply to it. This is the single highest-leverage de-noiser.
  if (SOURCE_DISQUALIFIERS.has(source) || UNIVERSITY_PROVIDER.test(provider)) {
    return {
      score: 0,
      signals: {
        hard_disqualified: SOURCE_DISQUALIFIERS.has(source) ? `source:${source}` : 'provider:university',
        tier1_hits: [], tier2_hits: [], tier3_hits: [],
        category_hits: [], geography: null, amount_band: null, disqualifier_hits: [],
      },
    };
  }

  const categories = Array.isArray(grant.categories) ? grant.categories.map(c => String(c).toLowerCase()) : [];
  const focusAreas = Array.isArray(grant.focus_areas) ? grant.focus_areas.map(c => String(c).toLowerCase()) : [];
  const allCategories = [...categories, ...focusAreas];

  const signals = {
    tier1_hits: [],
    tier2_hits: [],
    tier3_hits: [],
    category_hits: [],
    geography: null,
    amount_band: null,
    disqualifier_hits: [],
  };

  let score = 0;

  // Per-hit weights are deliberately additive: a grant that mentions
  // multiple Goods signals should compound. Caps come from the 0-100 clamp.
  for (const kw of TIER_1) {
    if (haystack.includes(kw)) {
      signals.tier1_hits.push(kw);
      score += 15;
      // Name-level Tier-1 hit = exceptionally strong signal (provider isn't
      // just thematically aligned, the grant is named for it).
      if (name.includes(kw)) score += 8;
    }
  }
  for (const kw of TIER_2) {
    if (haystack.includes(kw)) {
      signals.tier2_hits.push(kw);
      score += 6;
      if (name.includes(kw)) score += 3;
    }
  }
  for (const kw of TIER_3) {
    if (haystack.includes(kw)) {
      signals.tier3_hits.push(kw);
      score += 1;
    }
  }

  // Provider-level Indigenous/Aboriginal Affairs signal: the funder itself
  // exists for Goods-shaped work, every grant they issue is in-scope.
  const goodsProviderHints = ['aboriginal', 'indigenous', 'first nations', 'first peoples', 'niaa', 'ilsc', 'iba'];
  for (const hint of goodsProviderHints) {
    if (provider.includes(hint)) {
      signals.provider_hit = hint;
      score += 12;
      break;
    }
  }

  // SEDI (Social Enterprise Development Initiative) — DSS/IIA capability program,
  // the strongest open capability fit for Goods. The acronym match is
  // word-boundary, so it scores "SEDI Capability Building Grant" high while NEVER
  // matching "sediment". (No DSS/IIA hint exists in goodsProviderHints, so without
  // this the program scores ~6 despite being a top fit.)
  if (/\bsedi\b/.test(haystack) || haystack.includes('social enterprise development initiative')) {
    signals.sedi_hit = true;
    score += 30;
  }

  // Capital + procurement opportunities (IBA loans, Supply Nation, remote-housing
  // supply) don't read like grants and would otherwise score low. Tag-based boost
  // keyed on discovery_method so they surface alongside grants.
  if (BOOSTED_DISCOVERY_METHODS.has(discoveryMethod)) {
    signals.discovery_boost = discoveryMethod;
    score += 25;
  }

  const goodsCategorySet = new Set([
    'indigenous', 'aboriginal', 'first nations',
    'housing', 'homelessness', 'community',
    'remote', 'regional', 'community development',
    'social enterprise', 'community infrastructure',
  ]);
  let catHits = 0;
  for (const cat of allCategories) {
    if (goodsCategorySet.has(cat)) {
      signals.category_hits.push(cat);
      score += 7;
      catHits++;
    }
  }
  // Compounding bonus: 3+ Goods categories on the same grant = strong fit
  if (catHits >= 3) score += 8;

  if (grant.geography) {
    if (GOODS_GEOGRAPHIES.has(grant.geography)) {
      signals.geography = grant.geography;
      score += 10;
    } else if (grant.geography === 'AU' || grant.geography === '') {
      signals.geography = 'national';
      score += 4;
    } else {
      signals.geography = `non-goods:${grant.geography}`;
    }
  } else {
    signals.geography = 'unknown';
    score += 2;
  }

  const amountMax = Number(grant.amount_max) || 0;
  if (amountMax >= 1_000_000) {
    signals.amount_band = '1M+';
    score += 6;
  } else if (amountMax >= 100_000) {
    signals.amount_band = '100K-1M';
    score += 4;
  } else if (amountMax >= 10_000) {
    signals.amount_band = '10K-100K';
    score += 2;
  } else if (amountMax > 0 && amountMax < 5_000) {
    signals.amount_band = '<5K';
    score -= 8;
  }

  for (const dq of DISQUALIFIERS) {
    if (name.includes(dq) || description.includes(dq)) {
      signals.disqualifier_hits.push(dq);
      score -= 15;
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

  score = Math.max(0, Math.min(100, score));

  return { score, signals };
}

export const GOODS_TAG_THRESHOLD = 50;
export const GOODS_HIGH_FIT_THRESHOLD = 70;
