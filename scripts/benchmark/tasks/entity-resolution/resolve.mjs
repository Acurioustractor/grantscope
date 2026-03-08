/**
 * resolve.mjs — Entity Resolution Resolver (MUTABLE)
 *
 * This is the file that the autoresearch loop improves.
 * It exports a single function: resolve(donorName, entityIndex)
 *
 * The entityIndex is pre-loaded by the evaluator and passed in:
 *   { byExact: Map<string, Entity>, byNormalized: Map<string, Entity>, aliases: Map<string, Entity> }
 *
 * Returns: { matched_abn, matched_name, confidence, method } or null
 *
 * VERSION: 6 — Better punctuation handling and length-based filtering to reduce false positives
 */

/**
 * Normalize a name for fuzzy matching.
 * Strips legal suffixes, trust structures, punctuation.
 */
export function normalizeName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\bPTY\b\.?\s*/g, '')
    .replace(/\bLTD\b\.?\s*/g, '')
    .replace(/\bLIMITED\b/g, '')
    .replace(/\bINC\b\.?\s*/g, '')
    .replace(/\bCO\b\.?\s*/g, '')
    .replace(/\bTHE\b\s+/g, '')
    .replace(/\bATF\b\s+.*/g, '')
    .replace(/\bAS TRUSTEE FOR\b.*/gi, '')
    .replace(/\bTRUSTEE\b.*/gi, '')
    .replace(/\bCORPORATION\b/g, '')
    .replace(/\bGROUP\b/g, '')
    .replace(/\bHOLDINGS\b/g, '')
    .replace(/\bAUSTRALIA\b/g, '')
    .replace(/\bAUSTRALIAN\b/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize for suffix variations only.
 * Handles: "PTY LTD" vs "PTY. LTD.", "LTD" vs "LIMITED", parentheses, etc.
 */
function suffixNormalize(name) {
  return name
    .toUpperCase()
    .trim()
    // Remove all periods
    .replace(/\./g, '')
    // Remove parentheses but keep content
    .replace(/[()]/g, '')
    // Normalize PTY LIMITED variations
    .replace(/\bPTY\s+LIMITED\b/g, 'PTY LTD')
    .replace(/\bPTY\s+LTD\b/g, 'PTY LTD')
    // Normalize standalone LIMITED/LTD
    .replace(/\bLIMITED\b/g, 'LTD')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create a core name by stripping common corporate suffixes.
 * This helps match "Suncorp Group" → "SUNCORP GROUP LIMITED"
 */
function getCoreName(name) {
  return name
    .toUpperCase()
    .trim()
    .replace(/\./g, '')
    .replace(/[()]/g, '')
    // Remove trailing corporate suffixes
    .replace(/\s+(PTY\s+)?(LIMITED|LTD)$/g, '')
    .replace(/\s+PTY$/g, '')
    .replace(/\s+GROUP$/g, '')
    .replace(/\s+AUSTRALIA$/g, '')
    // Remove parenthetical state divisions
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s*-\s*\([^)]*\)\s*$/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a match is likely a false positive based on name length difference.
 * Prevents matching "ASG Group" to "ASG Limited" when "ASG GROUP LIMITED" exists.
 */
function isLikelyFalsePositive(donorName, canonicalName) {
  const donorUpper = donorName.toUpperCase().trim();
  const canonicalUpper = canonicalName.toUpperCase().trim();
  
  // If donor name is much shorter and doesn't contain key suffixes, be cautious
  const donorCore = getCoreName(donorName);
  const canonicalCore = getCoreName(canonicalName);
  
  // If core names are different, it's suspicious
  if (donorCore !== canonicalCore) {
    return true;
  }
  
  // If donor has "Group" but canonical has "Limited" instead, suspicious
  const donorHasGroup = /\bGROUP\b/i.test(donorUpper);
  const canonicalHasGroup = /\bGROUP\b/i.test(canonicalUpper);
  const canonicalHasLimited = /\bLIMITED\b/i.test(canonicalUpper);
  
  if (donorHasGroup && !canonicalHasGroup && canonicalHasLimited) {
    return true;
  }
  
  return false;
}

/**
 * Resolve a donor name against the entity index.
 *
 * @param {string} donorName - The donor name to resolve
 * @param {object} entityIndex - Pre-loaded entity index
 * @param {Map<string, object>} entityIndex.byExact - Exact uppercase name → entity
 * @param {Map<string, object>} entityIndex.byNormalized - Normalized name → entity
 * @param {Map<string, object>} entityIndex.byAlias - Alias uppercase → entity
 * @returns {{ matched_abn: string, matched_name: string, confidence: number, method: string } | null}
 */
export function resolve(donorName, entityIndex) {
  if (!donorName || donorName.length < 2) return null;

  const upperName = donorName.toUpperCase().trim();
  const normalizedName = normalizeName(donorName);
  const suffixNormName = suffixNormalize(donorName);
  const coreName = getCoreName(donorName);

  // Tier 1: Exact match (case-insensitive)
  const exactMatch = entityIndex.byExact.get(upperName);
  if (exactMatch) {
    return {
      matched_abn: exactMatch.abn,
      matched_name: exactMatch.canonical_name,
      confidence: 1.0,
      method: 'exact',
    };
  }

  // Tier 1b: Alias exact match
  if (entityIndex.byAlias) {
    const aliasMatch = entityIndex.byAlias.get(upperName);
    if (aliasMatch) {
      return {
        matched_abn: aliasMatch.abn,
        matched_name: aliasMatch.canonical_name,
        confidence: 0.95,
        method: 'alias_exact',
      };
    }
  }

  // Tier 1c: Suffix-normalized match (catch "PTY LTD" vs "PTY. LIMITED")
  if (suffixNormName !== upperName) {
    for (const [canonicalName, entity] of entityIndex.byExact) {
      if (suffixNormalize(canonicalName) === suffixNormName) {
        // Check for false positive risk
        if (!isLikelyFalsePositive(donorName, canonicalName)) {
          return {
            matched_abn: entity.abn,
            matched_name: entity.canonical_name,
            confidence: 0.92,
            method: 'suffix_normalized',
          };
        }
      }
    }
  }

  // Tier 1d: Core name match (catch "Suncorp Group" → "SUNCORP GROUP LIMITED")
  if (coreName.length >= 5) {
    const coreMatches = [];
    for (const [canonicalName, entity] of entityIndex.byExact) {
      const entityCoreName = getCoreName(canonicalName);
      if (entityCoreName === coreName) {
        coreMatches.push({ entity, canonicalName });
      }
    }
    
    // Only return if we have exactly one match (avoid ambiguity)
    if (coreMatches.length === 1) {
      const match = coreMatches[0];
      if (!isLikelyFalsePositive(donorName, match.canonicalName)) {
        return {
          matched_abn: match.entity.abn,
          matched_name: match.entity.canonical_name,
          confidence: 0.88,
          method: 'core_name',
        };
      }
    }
  }

  // Tier 2: Normalized match
  if (normalizedName.length >= 3) {
    const normalizedMatch = entityIndex.byNormalized.get(normalizedName);
    if (normalizedMatch) {
      return {
        matched_abn: normalizedMatch.abn,
        matched_name: normalizedMatch.canonical_name,
        confidence: 0.85,
        method: 'normalized',
      };
    }

    // Tier 2b: Normalized alias match
    if (entityIndex.byAlias) {
      for (const [alias, entity] of entityIndex.byAlias) {
        if (normalizeName(alias) === normalizedName) {
          return {
            matched_abn: entity.abn,
            matched_name: entity.canonical_name,
            confidence: 0.80,
            method: 'alias_normalized',
          };
        }
      }
    }
  }

  // No match found
  return null;
}
