import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import MANIFEST from './column-manifest.json';

/**
 * No query may reference a column its table does not have.
 *
 * WHAT IT CATCHES, AND WHAT IT DOES NOT. Tested, not assumed — the first draft of this comment
 * claimed all three of 2026-08-20's defects and only one is in range:
 *
 *   CAUGHT    mv_revolving_door.in_procurement    an ALIASED column that does not exist
 *                                                 (#353, #355, #356 — six surfaces, one cause)
 *   NOT       austender_contracts.supplier_state  UNQUALIFIED. The check only reads
 *                                                 `alias.column`, so a bare column in a
 *                                                 single-table query is invisible to it (#360).
 *   NOT       alma_interventions.gs_entity_id     a TYPE mismatch, uuid vs text. Both columns
 *                                                 = gs_entities.gs_id                 exist; only the comparison is wrong (#361).
 *
 * So this closes one of three doors. Worth having — that door accounted for six broken surfaces
 * in a day, including two public APIs — but do not read a green run as "no schema bugs".
 *
 * Extending to unqualified columns is possible where a query names exactly one relation and has
 * no CTEs. Type mismatches need the column TYPES in the manifest and real expression parsing.
 * Neither is done here.
 *
 * These fail at RUNTIME, where `safe()` returns null and the caller coerces with `|| []`, so the
 * page renders as though it measured nothing. #357 guarded one view; this covers every relation
 * the source names.
 *
 * Refresh the manifest after a migration:
 *   node apps/web/scripts/build-column-manifest.mjs
 *
 * A RATCHET, not a ban. Existing offenders are grandfathered in ALLOWED below so the test can
 * land green; anything new fails. Each entry is a real bug or a parser limitation, and shrinking
 * the list is always welcome.
 */
const columns = MANIFEST as Record<string, string[]>;

// GRANDFATHERED, each one read and characterised. Add nothing here without doing the same:
// a new entry almost always means a query that cannot succeed.
const ALLOWED = new Set<string>([
  // REAL BUGS, found by this guard on the day it was written. Left failing rather than fixed in
  // the same PR so the guard could land immediately and stop new instances; each is its own fix.
  //
  // /api/data/graph — a PUBLIC endpoint. Six columns that do not exist on mv_disability_landscape.
  // The view has disability_entities (not ndis_entities), state_avg_utilisation (not
  // ndis_avg_utilisation), avg_irsd_decile (not seifa_decile), cross_system_procurement and
  // cross_system_justice (not *_entities), and no total_entities at all.
  'mv_disability_landscape.ndis_entities',
  'mv_disability_landscape.ndis_avg_utilisation',
  'mv_disability_landscape.seifa_decile',
  'mv_disability_landscape.procurement_entities',
  'mv_disability_landscape.justice_entities',
  'mv_disability_landscape.total_entities',
  //
  // /reports/community-efficiency — mv_entity_power_index has total_dollar_flow, not
  // total_dollars, and id, not entity_id. That page has a THIRD defect this guard cannot see:
  // both its exec_sql calls pass `{ sql: ... }` where the parameter is `query`, so
  // isReadOnlyExecSql receives undefined and rejects them. Neither query has ever run.
  'mv_entity_power_index.total_dollars',
  'mv_entity_power_index.entity_id',
  //
  // PARSER LIMITATION, not a bug. In act-funder-intelligence the alias `pr` is bound to a CTE
  // named `programs`, and a real relation called `programs` also exists, so the CTE exclusion
  // does not fire. Narrowing this needs real SQL parsing; the cost is four false entries.
  'person_roles.program_count',
  'person_roles.open_program_count',
  'person_roles.application_path_count',
  'person_roles.foundation_id',
]);

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules') continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(e) && !e.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Strip JS and SQL comments so prose describing a bug never trips the guard (learned in #357). */
function decomment(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/--[^\n]*/g, ' ');
}

describe('every referenced column exists on its table', () => {
  it('no phantom columns', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const src = decomment(readFileSync(file, 'utf8'));
      const bad = new Set<string>();

      // SCOPE PER QUERY, not per file. A file commonly holds several queries that reuse `r`, `e`
      // or `p` for different tables; a file-wide alias map cross-contaminates them and produced
      // 141 false positives on the first run. Each backtick template literal is one query here.
      const queries = src.match(/`[^`]*`/g) ?? [];

      for (const raw of queries) {
        if (!/\b(from|join)\b/i.test(raw)) continue;

        // CTE names are not tables.
        const ctes = new Set<string>();
        for (const m of raw.matchAll(/(?:with|,)\s+([a-z_][a-z0-9_]*)\s+as\s*\(/gi)) ctes.add(m[1].toLowerCase());

        const aliases = new Map<string, string>();
        for (const m of raw.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)\s+(?:as\s+)?([a-z][a-z0-9_]*)\b/gi)) {
          const t = m[1].toLowerCase(), a = m[2].toLowerCase();
          if (ctes.has(t) || !columns[t]) continue;
          if (['on','where','group','order','limit','left','inner','cross','lateral','using','set','join','full','right'].includes(a)) continue;
          // An alias reused for two tables in ONE query is beyond this parser — skip it rather
          // than guess, because a wrong accusation is worse than a miss.
          if (aliases.has(a) && aliases.get(a) !== t) { aliases.delete(a); ctes.add(a); continue; }
          aliases.set(a, t);
        }

        for (const [alias, table] of aliases) {
          if (ctes.has(alias)) continue;
          const real = new Set(columns[table]);
          for (const m of raw.matchAll(new RegExp(`\\b${alias}\\.([a-z_][a-z0-9_]*)`, 'g'))) {
            if (!real.has(m[1]) && !ALLOWED.has(`${table}.${m[1]}`)) bad.add(`${table}.${m[1]} (as ${alias})`);
          }
        }
      }

      if (bad.size) offenders.push(`${relative(SRC, file)}\n    ${[...bad].join('\n    ')}`);
    }

    expect(
      offenders,
      'These reference columns their table does not have. They fail at runtime, silently:\n\n' +
        offenders.join('\n') +
        '\n\nIf a column was added by a migration, refresh the manifest:\n' +
        '  node apps/web/scripts/build-column-manifest.mjs\n',
    ).toEqual([]);
  });
});
