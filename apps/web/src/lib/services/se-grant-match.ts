import type { SupabaseClient } from '@supabase/supabase-js';

// ── SE → grant matching ──────────────────────────────────────────────
// Matches social_enterprises rows against open grant_opportunities on
// sector→category overlap plus geography. target_recipients is too messy
// to filter on directly (dominated by a universities/researchers scrape),
// so research-targeted grants are excluded and categories carry the match.

const MATCH_COLS =
  'id, name, provider, url, amount_min, amount_max, closes_at, deadline, categories, geography' as const;

export interface MatchedGrant {
  id: string;
  name: string;
  provider: string | null;
  url: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null; // coalesced closes_at/deadline
  categories: string[];
  geography: string | null;
  matched_on: string[];
  score: number;
}

interface SocialEnterpriseLike {
  org_type?: string | null;
  legal_structure?: string | null;
  sector?: string[] | null;
  state?: string | null;
  icn?: string | null;
}

// SE sector tags are a mix of lowercase slugs ("indigenous", "community-development")
// and Supply Nation category names ("Civil construction", "Cultural awareness training").
// Map both onto the grant_opportunities.categories vocabulary. `weight` ranks
// specific mission matches above generic enterprise/business matches.
const SECTOR_RULES: Array<{ test: RegExp; cats: string[]; weight: number }> = [
  { test: /indigenous|aboriginal|torres strait|first nations|cultural/i, cats: ['indigenous', 'aboriginal'], weight: 2 },
  { test: /community|social services/i, cats: ['community'], weight: 2 },
  { test: /health|wellbeing|aged care|ndis/i, cats: ['health'], weight: 2 },
  { test: /disability/i, cats: ['disability', 'health'], weight: 2 },
  { test: /education|training|school/i, cats: ['education'], weight: 2 },
  { test: /environment|conservation|land management|regenerat|agricultur|horticultur/i, cats: ['environment', 'regenerative'], weight: 2 },
  { test: /arts|creative|media|design|music/i, cats: ['arts', 'arts culture'], weight: 2 },
  { test: /employment|labour|workforce|recruitment/i, cats: ['employment training'], weight: 2 },
  { test: /technolog|software|digital/i, cats: ['technology'], weight: 2 },
  { test: /youth/i, cats: ['youth'], weight: 2 },
  { test: /justice|legal/i, cats: ['justice'], weight: 2 },
  { test: /sport|recreation/i, cats: ['sport'], weight: 2 },
];

const ORG_TYPE_RULES: Record<string, { cats: string[]; weight: number }> = {
  indigenous_business: { cats: ['indigenous', 'aboriginal'], weight: 2 },
  disability_enterprise: { cats: ['disability', 'health'], weight: 2 },
};

// Every social enterprise is a trading business — generic enterprise and
// small-business grants are a baseline match for all profiles.
const BASE_CATS = ['enterprise', 'business'];

function categoryWeights(se: SocialEnterpriseLike): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (cats: string[], weight: number) => {
    for (const c of cats) weights.set(c, Math.max(weights.get(c) ?? 0, weight));
  };

  add(BASE_CATS, 1);
  for (const sector of se.sector ?? []) {
    for (const rule of SECTOR_RULES) {
      if (rule.test.test(sector)) add(rule.cats, rule.weight);
    }
  }
  const orgRule = se.org_type ? ORG_TYPE_RULES[se.org_type] : undefined;
  if (orgRule) add(orgRule.cats, orgRule.weight);
  // An ICN means an ORIC-registered Indigenous corporation regardless of tags
  if (se.icn) add(['indigenous', 'aboriginal'], 2);

  return weights;
}

function geographyTerms(state: string | null | undefined): string[] {
  const national = ['National', 'AU-National', 'AU', 'Australia'];
  if (!state) return national;
  const code = state.trim().toUpperCase();
  return [...national, code, `AU-${code}`];
}

/**
 * Open grants matched to a social enterprise on sector→category overlap,
 * geography-compatible, research-targeted grants excluded. Ranked by match
 * weight (state-specific + mission matches first), then by closing date.
 */
export async function matchGrantsForSocialEnterprise(
  db: SupabaseClient,
  se: SocialEnterpriseLike,
  limit: number = 6,
) {
  const weights = categoryWeights(se);
  const terms = [...weights.keys()];
  const geoTerms = geographyTerms(se.state);
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await db
    .from('grant_opportunities')
    .select(MATCH_COLS)
    .overlaps('categories', terms)
    // ARC research-project scrape is 90%+ of open rows and never SE-eligible
    .neq('source', 'arc-grants')
    .or(`closes_at.gte.${today},deadline.gte.${today}`)
    .or(`target_recipients.is.null,target_recipients.not.ov.{universities,researchers}`)
    .or(`geography.is.null,geography.in.(${geoTerms.join(',')})`)
    .limit(200);

  if (error) return { data: [] as MatchedGrant[], error };

  const stateTerms = se.state ? new Set([se.state.trim().toUpperCase(), `AU-${se.state.trim().toUpperCase()}`]) : new Set<string>();

  const seIsIndigenous = weights.has('indigenous');

  const matched: MatchedGrant[] = (data ?? []).map((g) => {
    const categories: string[] = g.categories ?? [];
    const matchedOn = categories.filter((c) => weights.has(c));
    const categoryScore = matchedOn.reduce((sum, c) => sum + (weights.get(c) ?? 0), 0);
    const geoScore = g.geography && stateTerms.has(g.geography) ? 2 : 0;
    return {
      id: g.id,
      name: g.name,
      provider: g.provider,
      url: g.url,
      amount_min: g.amount_min,
      amount_max: g.amount_max,
      closes_at: g.closes_at ?? g.deadline ?? null,
      categories,
      geography: g.geography,
      matched_on: matchedOn,
      score: categoryScore + geoScore,
    };
  }).filter((g) => {
    // Indigenous-targeted programs dominate the tracked pool. Only surface them
    // for SEs with an Indigenous signal, or where a mission sector also matched
    // (not just the generic enterprise/business baseline).
    if (seIsIndigenous) return true;
    const indigenousTagged = g.categories.some((c) => c === 'indigenous' || c === 'aboriginal');
    if (!indigenousTagged) return true;
    return g.matched_on.some((c) => !BASE_CATS.includes(c) && c !== 'indigenous' && c !== 'aboriginal');
  });

  matched.sort((a, b) =>
    b.score - a.score
    || (a.closes_at ?? '9999').localeCompare(b.closes_at ?? '9999')
    || a.name.localeCompare(b.name),
  );

  return { data: matched.slice(0, limit), error: null };
}
