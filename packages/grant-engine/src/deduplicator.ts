/**
 * Grant Deduplicator
 *
 * Multi-source dedup using fuzzy provider:name keys.
 * Merges grants found by multiple sources into a single record,
 * preserving the most complete data from each.
 */

import type { CanonicalGrant, GrantSource, ExistingGrantRecord } from './types.js';

/**
 * Deduplicate an array of canonical grants.
 * When duplicates are found, merges sources and keeps the most complete record.
 */
export function deduplicateGrants(grants: CanonicalGrant[]): CanonicalGrant[] {
  const seen = new Map<string, CanonicalGrant>();

  for (const grant of grants) {
    const key = grant.dedupKey;
    const existing = seen.get(key);

    if (existing) {
      seen.set(key, mergeGrants(existing, grant));
    } else {
      seen.set(key, grant);
    }
  }

  return [...seen.values()];
}

/**
 * Merge two grants that represent the same opportunity.
 * Keeps the most complete data from each, combines source arrays.
 */
function mergeGrants(a: CanonicalGrant, b: CanonicalGrant): CanonicalGrant {
  // Combine sources (avoid duplication by pluginId)
  const sourceIds = new Set(a.sources.map(s => s.pluginId));
  const mergedSources: GrantSource[] = [...a.sources];
  for (const s of b.sources) {
    if (!sourceIds.has(s.pluginId)) {
      mergedSources.push(s);
    }
  }

  // Prefer verified URL over no URL
  const url = a.url || b.url;

  // Prefer longer description
  const description = (a.description && b.description)
    ? (a.description.length >= b.description.length ? a.description : b.description)
    : (a.description || b.description);

  // Merge categories
  const categories = [...new Set([...a.categories, ...b.categories])];

  // Merge geography
  const geography = [...new Set([...a.geography, ...b.geography])];

  // Prefer non-null amounts, taking the most complete picture
  const amountMin = a.amountMin ?? b.amountMin;
  const amountMax = a.amountMax ?? b.amountMax;

  // Prefer non-null deadline
  const closesAt = a.closesAt || b.closesAt;

  // Build discovery method showing all sources
  const methods = [...new Set([a.discoveryMethod, b.discoveryMethod])];
  const discoveryMethod = methods.join('+');

  return {
    ...a,
    url,
    description,
    categories,
    geography,
    amountMin,
    amountMax,
    closesAt,
    sources: mergedSources,
    discoveryMethod,
    program: a.program || b.program,
  };
}

/**
 * Filter out grants that already exist in the database.
 * Uses URL match and exact name match.
 */
export function filterExisting(
  grants: CanonicalGrant[],
  existing: ExistingGrantRecord[]
): { newGrants: CanonicalGrant[]; duplicates: number } {
  const existingUrls = new Set(
    existing.filter(e => e.url).map(e => e.url!)
  );
  const existingNames = new Set(
    existing.map(e => e.name.toLowerCase())
  );

  // Also build dedup keys from existing grants
  const existingKeys = new Set<string>();
  for (const e of existing) {
    // We don't know the provider, so just check name portion
    existingKeys.add(e.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim());
  }

  const newGrants: CanonicalGrant[] = [];
  let duplicates = 0;

  for (const grant of grants) {
    // Check URL match
    if (grant.url && existingUrls.has(grant.url)) {
      duplicates++;
      continue;
    }

    // Check exact name match
    if (existingNames.has(grant.name.toLowerCase())) {
      duplicates++;
      continue;
    }

    newGrants.push(grant);
  }

  return { newGrants, duplicates };
}
