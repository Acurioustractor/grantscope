/**
 * Goods funder-framing — PURE helpers shared by sync-goods-framing.mjs and its
 * unit test. No I/O, no env, no network: name-matching + SQL escaping + the
 * framing-object builder only, so they can be exercised deterministically.
 *
 * Source of truth for the data these helpers shape is the ACT funder ledger:
 * act-global-infrastructure/wiki/narrative/funders.json (read-only, other repo).
 */

const GOODS_PROJECT_CODE = 'ACT-GD';

/**
 * Normalise a display/funder name for case-insensitive, leading-"The "-stripped
 * comparison. Collapses internal whitespace so "Snow  Foundation" === "Snow Foundation".
 */
export function normaliseName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * True when two names match by contains-either-direction after normalisation.
 * "Snow Foundation" matches "The Snow Foundation"; "Centrecorp" matches
 * "Centrecorp Foundation". Empty strings never match.
 */
export function namesMatch(a, b) {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Does this funder entry fund Goods by project code 'ACT-GD'? */
export function fundsGoodsByCode(entry) {
  const codes = entry && Array.isArray(entry.projects_funded) ? entry.projects_funded : [];
  return codes.includes(GOODS_PROJECT_CODE);
}

/**
 * Match funder entries to goods_relationships rows.
 * Selects an entry when EITHER it funds Goods by code OR its name matches a row's
 * display_name. Returns one match per relationship row (first qualifying entry
 * wins, code-funded preferred), so we never emit two UPDATEs for the same id.
 *
 * @param {Record<string, object>} funders  slug -> entry (the funders.json `funders` map)
 * @param {{id: string, display_name: string}[]} rows  goods_relationships rows
 * @returns {{ id: string, display_name: string, slug: string, entry: object, matchedBy: 'code'|'name' }[]}
 */
export function matchFunders(funders, rows) {
  const entries = Object.entries(funders || {});
  const matches = [];

  for (const row of rows || []) {
    let chosen = null;
    let matchedBy = null;

    // Prefer an explicit ACT-GD code match whose name also matches this row.
    for (const [slug, entry] of entries) {
      if (fundsGoodsByCode(entry) && namesMatch(entry.name, row.display_name)) {
        chosen = [slug, entry];
        matchedBy = 'code';
        break;
      }
    }
    // Fall back to a pure name match (entry need not carry the code).
    if (!chosen) {
      for (const [slug, entry] of entries) {
        if (namesMatch(entry.name, row.display_name)) {
          chosen = [slug, entry];
          matchedBy = 'name';
          break;
        }
      }
    }

    if (chosen) {
      matches.push({
        id: row.id,
        display_name: row.display_name,
        slug: chosen[0],
        entry: chosen[1],
        matchedBy,
      });
    }
  }

  return matches;
}

/**
 * Build the compact framing object stored in goods_relationships.framing.
 * Only the fields the UI renders, plus provenance (slug + synced_at).
 */
export function buildFraming(slug, entry, syncedAt) {
  return {
    slug,
    tone: entry.tone ?? null,
    framing_notes: entry.framing_notes ?? null,
    claims_to_lead_with: Array.isArray(entry.claims_to_lead_with) ? entry.claims_to_lead_with : [],
    claims_to_avoid: Array.isArray(entry.claims_to_avoid) ? entry.claims_to_avoid : [],
    primary_contact: entry.primary_contact ?? null,
    last_communicated_at: entry.last_communicated_at ?? null,
    synced_at: syncedAt,
  };
}

/** Escape a string for safe single-quoted SQL literal interpolation. */
export function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

/**
 * Emit one idempotent UPDATE per match. The framing JSON is escaped for a
 * single-quoted ::jsonb literal. Returns the SQL text (no trailing run).
 */
export function buildUpdateSql(matches, syncedAt) {
  const lines = [
    '-- Goods funder framing — synced from the ACT funder ledger',
    '-- (act-global-infrastructure/wiki/narrative/funders.json). Generated, not hand-written.',
    `-- synced_at: ${syncedAt}`,
    `-- matches: ${matches.length}`,
    '',
  ];
  for (const m of matches) {
    const framing = buildFraming(m.slug, m.entry, syncedAt);
    const json = sqlEscape(JSON.stringify(framing));
    lines.push(
      `UPDATE goods_relationships SET framing = '${json}'::jsonb, updated_at = now() WHERE id = '${sqlEscape(m.id)}';`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
