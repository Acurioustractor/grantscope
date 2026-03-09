/**
 * resolve.mjs — Recipient-Entity Matcher (MUTABLE)
 *
 * Matches justice funding recipient names to gs_entities.
 * Uses the same normalization pipeline as entity-resolution but tuned for
 * justice/community sector naming conventions.
 *
 * VERSION: 1 — Baseline using entity-resolution normalizer
 */

/**
 * Normalize a recipient name for matching.
 * Extends the entity-resolution normalizer with justice-sector patterns.
 */
export function normalizeName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    // Legal suffixes
    .replace(/\bPTY\b\.?\s*/g, '')
    .replace(/\bLTD\b\.?\s*/g, '')
    .replace(/\bLIMITED\b/g, '')
    .replace(/\bINC\b\.?\s*O?R?P?O?R?A?T?E?D?\s*/g, '')
    .replace(/\bCO\b\.?\s*/g, '')
    .replace(/\bCORPORATION\b/g, '')
    // Trust structures
    .replace(/\bTHE\b\s+/g, '')
    .replace(/\bATF\b\s+.*/g, '')
    .replace(/\bAS TRUSTEE FOR\b.*/gi, '')
    .replace(/\bTRUSTEE\b.*/gi, '')
    // Common justice sector suffixes
    .replace(/\bASSOCIATION\b/g, '')
    .replace(/\bORGANISATION\b/g, '')
    .replace(/\bORGANIZATION\b/g, '')
    .replace(/\bSOCIETY\b/g, '')
    .replace(/\bSERVICES?\b/g, '')
    .replace(/\bCOUNCIL\b/g, '')
    .replace(/\bCENTRE\b/g, 'CENTER')
    .replace(/\bPROGRAMME\b/g, 'PROGRAM')
    // State qualifiers often added to distinguish branches
    .replace(/\b(QLD|NSW|VIC|SA|WA|TAS|ACT|NT)\b/g, '')
    .replace(/\bQUEENSLAND\b/g, '')
    .replace(/\bAUSTRALIA\b/g, '')
    .replace(/\bAUSTRALIAN\b/g, '')
    // Clean up
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a justice funding recipient to an entity.
 *
 * @param {string} recipientName - The recipient name from justice_funding
 * @param {Object} entityIndex - Pre-loaded entity index
 * @param {Map} entityIndex.byExact - Map of UPPER name -> entity
 * @param {Map} entityIndex.byNormalized - Map of normalized name -> entity
 * @param {Map} entityIndex.byAlias - Map of alias -> entity
 * @returns {{ matched_abn: string, matched_name: string, confidence: string, method: string } | null}
 */
export function resolve(recipientName, entityIndex) {
  if (!recipientName || recipientName.length < 3) return null;

  const upper = recipientName.toUpperCase().trim();

  // 1. Exact match
  const exact = entityIndex.byExact.get(upper);
  if (exact?.abn) {
    return {
      matched_abn: exact.abn,
      matched_name: exact.canonical_name,
      confidence: 'high',
      method: 'exact',
    };
  }

  // 2. Normalized match
  const normalized = normalizeName(recipientName);
  if (normalized.length >= 3) {
    const norm = entityIndex.byNormalized.get(normalized);
    if (norm?.abn) {
      return {
        matched_abn: norm.abn,
        matched_name: norm.canonical_name,
        confidence: 'high',
        method: 'normalized',
      };
    }
  }

  // 3. Alias match
  const alias = entityIndex.byAlias?.get(upper) || entityIndex.byAlias?.get(normalized);
  if (alias?.abn) {
    return {
      matched_abn: alias.abn,
      matched_name: alias.canonical_name,
      confidence: 'medium',
      method: 'alias',
    };
  }

  // 4. Substring match — try finding entities whose normalized name contains or is contained by recipient
  if (normalized.length >= 8) {
    for (const [key, entity] of entityIndex.byNormalized) {
      if (key.length >= 8 && entity.abn) {
        if (key.includes(normalized) || normalized.includes(key)) {
          return {
            matched_abn: entity.abn,
            matched_name: entity.canonical_name,
            confidence: 'low',
            method: 'substring',
          };
        }
      }
    }
  }

  return null;
}
