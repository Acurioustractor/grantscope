/**
 * Grant Verification — the single trust classifier for a grant_opportunities row.
 *
 * Grants arrive from three kinds of source (see `GrantSource.confidence` in
 * types.ts): `verified` (official feed / live URL), `scraped` (HTML scrape),
 * and `llm_knowledge` (surfaced from an LLM's training data — NO verified URL,
 * may be stale or hallucinated). We must never email a user an `llm_knowledge`
 * grant as if it were real; it can still appear in the UI, clearly badged.
 *
 * Both the web app (grant detail badge) and the nightly scout (alert gating)
 * classify through this one function so "confirmed" means the same thing
 * everywhere.
 */

export type GrantConfidence = 'verified' | 'scraped' | 'llm_knowledge';
export type VerificationLevel = 'verified' | 'scraped' | 'unconfirmed';

interface GrantSourceLike {
  pluginId?: string;
  confidence?: string;
  foundAt?: string;
  rawUrl?: string;
}

export interface GrantLike {
  /** jsonb array of GrantSource (may arrive as a parsed array, a JSON string, or null). */
  sources?: GrantSourceLike[] | string | null;
  last_verified_at?: string | null;
  url?: string | null;
  source?: string | null;
}

export interface GrantVerification {
  level: VerificationLevel;
  /** True when it is safe to alert/email a user about this grant. */
  isConfirmed: boolean;
  verifiedAt: string | null;
  bestConfidence: GrantConfidence | null;
  sourceLabel: string | null;
  /** Human-readable trust line for the UI, e.g. "Verified 3 days ago · GrantConnect". */
  label: string;
}

const CONFIDENCE_RANK: Record<GrantConfidence, number> = { verified: 3, scraped: 2, llm_knowledge: 1 };

function parseSources(sources: GrantLike['sources']): GrantSourceLike[] {
  if (!sources) return [];
  if (typeof sources === 'string') {
    try {
      const parsed = JSON.parse(sources);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(sources) ? sources : [];
}

function bestConfidenceOf(sources: GrantSourceLike[]): GrantConfidence | null {
  let best: GrantConfidence | null = null;
  for (const s of sources) {
    const c = s.confidence as GrantConfidence | undefined;
    if (c && CONFIDENCE_RANK[c] && (!best || CONFIDENCE_RANK[c] > CONFIDENCE_RANK[best])) best = c;
  }
  return best;
}

/** Prettify a raw source id (e.g. "grantconnect" → "GrantConnect", "vic-grants" → "VIC Grants"). */
function prettySource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const known: Record<string, string> = {
    grantconnect: 'GrantConnect',
    'business-gov-au': 'business.gov.au',
    'data-gov-au': 'data.gov.au',
    manual: 'Manual entry',
    manual_entry: 'Manual entry',
    ghl_sync: 'CRM',
  };
  if (known[raw]) return known[raw];
  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\bgrants?\b/i, 'Grants')
    .replace(/\b(nsw|vic|qld|sa|wa|tas|nt|act)\b/i, (m) => m.toUpperCase())
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function relativeDays(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Classify a grant's trust level. `isConfirmed` is the gate for alerts/emails:
 * a grant is confirmed only when it has a URL AND its best source is not
 * `llm_knowledge`. Legacy rows without a `sources` array but with a URL are
 * treated as scraped (confirmed) — the quarantine targets AI-surfaced grants,
 * not the existing scraped corpus.
 */
export function assessGrantVerification(grant: GrantLike): GrantVerification {
  const sources = parseSources(grant.sources);
  const bestConfidence = bestConfidenceOf(sources);
  const hasUrl = !!grant.url;
  const verifiedAt = grant.last_verified_at ?? null;
  const sourceLabel = prettySource(grant.source) ?? prettySource(sources[0]?.pluginId) ?? null;

  const isConfirmed = hasUrl && bestConfidence !== 'llm_knowledge';

  let level: VerificationLevel;
  if (isConfirmed && bestConfidence === 'verified' && verifiedAt) level = 'verified';
  else if (isConfirmed) level = 'scraped';
  else level = 'unconfirmed';

  let label: string;
  if (level === 'verified') {
    label = `Verified ${relativeDays(verifiedAt)}${sourceLabel ? ` · ${sourceLabel}` : ''}`;
  } else if (level === 'scraped') {
    label = sourceLabel ? `Sourced from ${sourceLabel}` : 'Sourced from a public listing';
  } else if (!hasUrl) {
    label = 'Unconfirmed — no source URL';
  } else {
    label = 'Unconfirmed — AI-surfaced, URL not verified';
  }

  return { level, isConfirmed, verifiedAt, bestConfidence, sourceLabel, label };
}
