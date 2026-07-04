/**
 * Grant Matching — single source of truth for org→grant scoring.
 *
 * Everything that ranks grants for an org must go through here so the API
 * routes (`/api/profile/matches`, `/api/grants/match`) and the nightly scout
 * (`scripts/scout-grants-for-profiles.mjs`) agree by construction.
 *
 * Primary path: pgvector similarity via the `match_grants_for_org` RPC, then
 * learning-signal boosts/penalties from `get_user_feedback_signals`. This is
 * the semantic matching the platform already runs on `/api/profile/matches`.
 *
 * Fallback path: keyword/category heuristics, used only when an org has no
 * embedding yet (e.g. a profile saved before embeddings were generated). The
 * fallback is flagged on the result so callers can log how often it fires.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────

/** Row shape returned by the `match_grants_for_org` RPC. */
export interface RawGrantMatch {
  id: string;
  name: string;
  provider: string;
  description: string | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[] | null;
  url: string | null;
  grant_type: string | null;
  status: string | null;
  focus_areas: string[] | null;
  geography: string | null;
  similarity: number; // 0..1 cosine similarity
}

/** A scored grant, ready for ranking/display. Superset of RawGrantMatch. */
export interface ScoredGrant extends RawGrantMatch {
  /** 0-100 integer fit score (similarity + boosts/penalties). */
  fit_score: number;
  /** Human-readable reasons, for UI + notification bodies. */
  match_signals: string[];
}

export interface FeedbackSignals {
  excluded_grant_ids: string[];
  not_a_grant_ids: string[];
  penalized_providers: string[];
  penalized_categories: string[];
  penalized_geos: string[];
  boosted_providers: string[];
  boosted_categories: string[];
  boosted_geos: string[];
  total_votes: number;
  up_votes: number;
  down_votes: number;
}

export interface OrgMatchInput {
  /** pgvector embedding as stored on the profile (JSON-stringified array), or null. */
  embedding: string | null;
  domains?: string[];
  geo?: string[];
  threshold?: number; // similarity floor for the RPC (default 0.5)
  limit?: number; // max rows from the RPC (default 50)
  /** For learning signals + exclusions. Omit to skip the feedback pass. */
  userId?: string;
  projectProfileId?: string | null;
  /** Fallback-only inputs, used when `embedding` is null. */
  orgType?: string | null;
  annualRevenue?: number | null;
  mission?: string | null;
}

export interface OrgMatchResult {
  matches: ScoredGrant[];
  grantsFiltered: number;
  feedbackSignals: FeedbackSignals | null;
  /** True when the keyword fallback ran because no embedding was available. */
  usedFallback: boolean;
}

const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_LIMIT = 50;

// ── RPC wrappers ───────────────────────────────────────────────────────────

/** Vector similarity search over grant embeddings. */
export async function fetchOrgGrantMatches(
  db: SupabaseClient,
  embedding: string,
  threshold = DEFAULT_THRESHOLD,
  limit = DEFAULT_LIMIT,
): Promise<RawGrantMatch[]> {
  const { data, error } = await db.rpc('match_grants_for_org', {
    org_embedding: embedding,
    threshold,
    match_limit: limit,
  });
  if (error) throw new Error(`match_grants_for_org failed: ${error.message}`);
  return (data as RawGrantMatch[]) || [];
}

/** Per-user learning signals (exclusions, provider/category/geo boosts+penalties). */
export async function fetchFeedbackSignals(
  db: SupabaseClient,
  userId: string,
  projectProfileId?: string | null,
): Promise<FeedbackSignals | null> {
  const params: { p_user_id: string; p_project_profile_id?: string } = {
    p_user_id: userId,
  };
  if (projectProfileId) params.p_project_profile_id = projectProfileId;
  const { data } = await db.rpc('get_user_feedback_signals', params);
  return (data as FeedbackSignals) || null;
}

// ── Boosts + signals (pure) ──────────────────────────────────────────────────

function toLowerSet(values?: string[]): Set<string> {
  return new Set((values || []).map((v) => v.toLowerCase()));
}

function buildSignals(grant: RawGrantMatch, orgDomains: Set<string>, orgGeo: Set<string>): string[] {
  const signals: string[] = [`${Math.round(grant.similarity * 100)}% semantic match`];

  const grantTerms = [...(grant.categories || []), ...(grant.focus_areas || [])].map((t) => t.toLowerCase());
  const catOverlap = [...orgDomains].filter((d) => grantTerms.some((t) => t.includes(d) || d.includes(t))).length;
  if (catOverlap > 0) signals.push(`${catOverlap} category match${catOverlap > 1 ? 'es' : ''}`);

  if (grant.geography && orgGeo.size > 0) {
    const geoLower = grant.geography.toLowerCase();
    if ([...orgGeo].some((g) => geoLower.includes(g) || g.includes(geoLower))) signals.push('Geographic match');
  }

  if (grant.closes_at) {
    const days = Math.ceil((new Date(grant.closes_at).getTime() - Date.now()) / 86_400_000);
    if (days > 0 && days <= 30) signals.push('Closing soon');
  }

  return signals;
}

/**
 * Apply domain/geo boosts, quality/staleness penalties, and learning-signal
 * adjustments to raw vector matches. Filters out excluded/not-a-grant IDs.
 * Pure — no I/O. Mirrors the scoring that shipped on `/api/profile/matches`.
 */
export function applyLearningBoosts(
  matches: RawGrantMatch[],
  opts: { domains?: string[]; geo?: string[]; feedbackSignals?: FeedbackSignals | null },
): { scored: ScoredGrant[]; grantsFiltered: number } {
  const orgDomains = toLowerSet(opts.domains);
  const orgGeo = toLowerSet(opts.geo);
  const fb = opts.feedbackSignals;

  const excludedIds = new Set([...(fb?.excluded_grant_ids || []), ...(fb?.not_a_grant_ids || [])]);
  const penalizedProviders = toLowerSet(fb?.penalized_providers);
  const penalizedCategories = toLowerSet(fb?.penalized_categories);
  const penalizedGeos = toLowerSet(fb?.penalized_geos);
  const boostedProviders = toLowerSet(fb?.boosted_providers);
  const boostedCategories = toLowerSet(fb?.boosted_categories);
  const boostedGeos = toLowerSet(fb?.boosted_geos);

  let grantsFiltered = 0;

  const scored = matches
    .filter((grant) => {
      if (excludedIds.has(grant.id)) {
        grantsFiltered++;
        return false;
      }
      return true;
    })
    .map((grant) => {
      let score = grant.similarity;

      // Domain overlap boost (up to +0.05)
      if (grant.categories?.length && orgDomains.size > 0) {
        const overlap = grant.categories.filter((c) => orgDomains.has(c.toLowerCase())).length;
        score += Math.min(overlap * 0.025, 0.05);
      }
      // Focus-area overlap boost (up to +0.05)
      if (grant.focus_areas?.length && orgDomains.size > 0) {
        const overlap = grant.focus_areas.filter((f) => orgDomains.has(f.toLowerCase())).length;
        score += Math.min(overlap * 0.025, 0.05);
      }
      // Geographic relevance boost (+0.03)
      if (grant.geography && orgGeo.size > 0) {
        const geoLower = grant.geography.toLowerCase();
        for (const g of orgGeo) {
          if (geoLower.includes(g) || g.includes(geoLower)) {
            score += 0.03;
            break;
          }
        }
      }
      // Low-quality penalty
      if (!grant.amount_max && (!grant.description || grant.description.length < 50)) score -= 0.03;

      // Staleness penalties
      if (grant.closes_at) {
        const yearsAgo = (Date.now() - new Date(grant.closes_at).getTime()) / (365.25 * 86_400_000);
        if (yearsAgo >= 5) score -= 0.2;
        else if (yearsAgo >= 2) score -= 0.1;
      }
      const yearMatch = grant.name?.match(/20[12]\d/);
      if (yearMatch) {
        const grantYear = parseInt(yearMatch[0], 10);
        if (new Date().getFullYear() - grantYear >= 3) score -= 0.15;
      }

      // Feedback-based provider/category/geo adjustments
      const providerLower = grant.provider?.toLowerCase();
      if (providerLower && penalizedProviders.has(providerLower)) score -= 0.15;
      if (providerLower && boostedProviders.has(providerLower)) score += 0.05;
      if (grant.categories?.length && penalizedCategories.size > 0) {
        const n = grant.categories.filter((c) => penalizedCategories.has(c.toLowerCase())).length;
        if (n > 0) score -= Math.min(n * 0.05, 0.1);
      }
      if (grant.categories?.length && boostedCategories.size > 0) {
        const n = grant.categories.filter((c) => boostedCategories.has(c.toLowerCase())).length;
        if (n > 0) score += Math.min(n * 0.03, 0.06);
      }
      if (grant.geography && penalizedGeos.size > 0) {
        const geoLower = grant.geography.toLowerCase();
        for (const g of penalizedGeos) {
          if (geoLower.includes(g) || g.includes(geoLower)) {
            score -= 0.08;
            break;
          }
        }
      }
      if (grant.geography && boostedGeos.size > 0) {
        const geoLower = grant.geography.toLowerCase();
        for (const g of boostedGeos) {
          if (geoLower.includes(g) || g.includes(geoLower)) {
            score += 0.04;
            break;
          }
        }
      }

      return {
        ...grant,
        fit_score: Math.max(0, Math.min(Math.round(score * 100), 100)),
        match_signals: buildSignals(grant, orgDomains, orgGeo),
      };
    });

  scored.sort((a, b) => b.fit_score - a.fit_score);
  return { scored, grantsFiltered };
}

// ── Keyword fallback (no embedding) ──────────────────────────────────────────

/**
 * Heuristic scorer used only when an org has no embedding. Fetches open grants
 * directly and scores by category/geo/amount/mission overlap. Kept intentionally
 * close to the pre-vector behaviour so fallback results are never worse than
 * what shipped before.
 */
export async function scoreGrantsByKeyword(
  db: SupabaseClient,
  input: OrgMatchInput,
  fetchLimit = 500,
): Promise<ScoredGrant[]> {
  const now = new Date().toISOString().split('T')[0];
  const { data: grants, error } = await db
    .from('grant_opportunities')
    .select(
      'id, name, description, amount_max, deadline, provider, url, categories, focus_areas, target_recipients, geography, grant_type, status',
    )
    .or(`deadline.is.null,deadline.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);
  if (error) throw new Error(`keyword fallback fetch failed: ${error.message}`);

  const orgDomains = (input.domains || []).map((d) => d.toLowerCase());
  const orgGeo = (input.geo || []).map((g) => g.toLowerCase());
  const orgType = (input.orgType || '').toLowerCase();

  const scored: ScoredGrant[] = (grants || []).map((g) => {
    let score = 50;
    const signals: string[] = [];

    const grantTerms = [...(g.categories || []), ...(g.focus_areas || [])].map((t: string) => t.toLowerCase());
    const catOverlap = orgDomains.filter((d) => grantTerms.some((t) => t.includes(d) || d.includes(t))).length;
    if (catOverlap > 0) {
      score += Math.min(catOverlap * 10, 25);
      signals.push(`${catOverlap} category match${catOverlap > 1 ? 'es' : ''}`);
    }

    const grantGeo = (g.geography || '').toLowerCase();
    if (orgGeo.length > 0 && grantGeo && orgGeo.some((gg) => grantGeo.includes(gg) || gg.includes(grantGeo))) {
      score += 15;
      signals.push('Geographic match');
    }

    if (input.annualRevenue && g.amount_max) {
      const ratio = g.amount_max / input.annualRevenue;
      if (ratio >= 0.01 && ratio <= 0.5) {
        score += 10;
        signals.push('Amount fits org size');
      }
    }

    const grantTargets: string[] = (g.target_recipients || []).map((t: string) => t.toLowerCase());
    if (grantTargets.length > 0 && orgType) {
      const recipientMatch = grantTargets.some(
        (t: string) =>
          t.includes(orgType) ||
          orgType.includes(t) ||
          (orgType.includes('charity') && t.includes('not-for-profit')) ||
          (orgType.includes('social_enterprise') && t.includes('not-for-profit')),
      );
      if (recipientMatch) {
        score += 10;
        signals.push('Target recipient match');
      }
    }

    if (input.mission && g.description) {
      const missionWords = input.mission.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      const hits = missionWords.filter((w) => g.description.toLowerCase().includes(w)).length;
      if (hits >= 3) {
        score += Math.min(hits * 3, 15);
        signals.push(`${hits} mission keywords`);
      }
    }

    if (g.deadline) {
      const days = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86_400_000);
      if (days > 0 && days <= 30) {
        score += 5;
        signals.push('Closing soon');
      }
    }

    return {
      id: g.id,
      name: g.name,
      provider: g.provider,
      description: g.description,
      amount_max: g.amount_max,
      closes_at: g.deadline,
      categories: g.categories,
      url: g.url,
      grant_type: g.grant_type,
      status: g.status,
      focus_areas: g.focus_areas,
      geography: g.geography,
      similarity: 0,
      fit_score: Math.min(score, 100),
      match_signals: signals,
    };
  });

  scored.sort((a, b) => b.fit_score - a.fit_score);
  return scored;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * The one function callers should use. Runs vector similarity + learning
 * boosts when an embedding is present; otherwise falls back to keyword scoring
 * and flags `usedFallback` so the caller can log the fallback rate.
 */
export async function scoreGrantsForOrg(db: SupabaseClient, input: OrgMatchInput): Promise<OrgMatchResult> {
  if (!input.embedding) {
    const matches = await scoreGrantsByKeyword(db, input);
    return { matches, grantsFiltered: 0, feedbackSignals: null, usedFallback: true };
  }

  const raw = await fetchOrgGrantMatches(
    db,
    input.embedding,
    input.threshold ?? DEFAULT_THRESHOLD,
    input.limit ?? DEFAULT_LIMIT,
  );

  const feedbackSignals = input.userId ? await fetchFeedbackSignals(db, input.userId, input.projectProfileId) : null;

  const { scored, grantsFiltered } = applyLearningBoosts(raw, {
    domains: input.domains,
    geo: input.geo,
    feedbackSignals,
  });

  return { matches: scored, grantsFiltered, feedbackSignals, usedFallback: false };
}
