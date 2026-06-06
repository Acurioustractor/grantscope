#!/usr/bin/env node
/**
 * backfill-se-abns.mjs — Backfill missing ABNs in social_enterprises
 *
 * ABN is the join key to the evidence layer (austender_contracts, justice_funding,
 * gs_entities). ~2,380 SE records lack one.
 *
 * Match targets, in order:
 * 1. gs_entities (federated entity graph, 597K, names as published by ACNC/ORIC/etc.)
 * 2. abr_registry (20M legal names; partial index requires status = 'Active')
 *
 * Name probes per record: exact, parenthetical stripped, parenthetical contents
 * (often the legal name), appended legal suffixes, and LTD<->LIMITED /
 * INC<->INCORPORATED swaps.
 *
 * Guards: unambiguous matches only (exactly 1 distinct ABN per SE record), state
 * agreement when both sides carry a state, and junk crawl sources excluded
 * (sasec/wasec/qsec rows are nav-link artifacts, not enterprises).
 *
 * Dry-run by default. Use --live to apply updates.
 */

import { psql } from './lib/psql.mjs';

const LIVE = process.argv.includes('--live');
const JUNK_SOURCES = `('sasec', 'wasec', 'qsec')`;

// Probe-variant CTE shared by both phases. `exclude` is a SQL fragment for ids
// already matched in an earlier phase.
function probesSql(exclude = '') {
  return `
    base AS (
      SELECT id, name, state
      FROM social_enterprises
      WHERE abn IS NULL
        AND source_primary NOT IN ${JUNK_SOURCES}
        AND LENGTH(TRIM(name)) >= 4
        ${exclude}
    ),
    probes AS (
      SELECT id, name, state, UPPER(TRIM(name)) AS probe FROM base
      UNION
      SELECT id, name, state, UPPER(TRIM(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)\\s*$', ''))) FROM base WHERE name ~ '\\)\\s*$'
      UNION
      SELECT id, name, state, UPPER(TRIM(SUBSTRING(name FROM '\\(([^)]+)\\)\\s*$'))) FROM base WHERE name ~ '\\)\\s*$'
      UNION
      SELECT id, name, state, UPPER(TRIM(name)) || s.suffix
      FROM base CROSS JOIN (VALUES (' PTY LTD'), (' LTD'), (' LIMITED'), (' INC'), (' INCORPORATED')) AS s(suffix)
      UNION
      SELECT id, name, state, REGEXP_REPLACE(UPPER(TRIM(name)), ' LTD\\.?$', ' LIMITED') FROM base WHERE UPPER(name) ~ ' LTD\\.?$'
      UNION
      SELECT id, name, state, REGEXP_REPLACE(UPPER(TRIM(name)), ' LIMITED$', ' LTD') FROM base WHERE UPPER(name) ~ ' LIMITED$'
      UNION
      SELECT id, name, state, REGEXP_REPLACE(UPPER(TRIM(name)), ' INC\\.?$', ' INCORPORATED') FROM base WHERE UPPER(name) ~ ' INC\\.?$'
      UNION
      SELECT id, name, state, REGEXP_REPLACE(UPPER(TRIM(name)), ' INCORPORATED$', ' INC') FROM base WHERE UPPER(name) ~ ' INCORPORATED$'
    )`;
}

function esc(value) {
  return String(value).replace(/'/g, "''");
}

async function applyMatches(matches, label) {
  for (let i = 0; i < matches.length; i += 50) {
    const batch = matches.slice(i, i + 50);
    const values = batch.map((m) => `('${m.id}'::uuid, '${esc(m.abn)}')`).join(',\n        ');
    await psql(`
      UPDATE social_enterprises se
      SET abn = v.abn, updated_at = now()
      FROM (VALUES
        ${values}
      ) AS v(id, abn)
      WHERE se.id = v.id AND se.abn IS NULL
    `);
    console.log(`  [${label}] applied batch ${Math.floor(i / 50) + 1}/${Math.ceil(matches.length / 50)}`);
  }
}

function report(matches, label) {
  console.log(`  ${matches.length} unambiguous matches via ${label}`);
  if (!LIVE) matches.slice(0, 5).forEach((m) => console.log(`    ${m.name} -> ABN ${m.abn}`));
}

async function main() {
  console.log(`Mode: ${LIVE ? 'LIVE' : 'DRY RUN'}\n`);

  const before = await psql(`
    SELECT source_primary, COUNT(*) AS missing
    FROM social_enterprises WHERE abn IS NULL
    GROUP BY source_primary ORDER BY missing DESC
  `);
  console.log('Missing ABNs by source (junk sources excluded from matching):');
  before.forEach((r) => console.log(`  ${r.source_primary}: ${r.missing}`));

  // Phase 1: entity graph — names as published by source registries, ABN-resolved
  console.log('\nPhase 1: Match against gs_entities...');
  const graph = await psql(`
    WITH ${probesSql()},
    candidates AS (
      SELECT p.id, p.name, e.abn
      FROM probes p
      JOIN gs_entities e ON UPPER(e.canonical_name) = p.probe AND e.abn IS NOT NULL
      WHERE (p.state IS NULL OR e.state IS NULL OR UPPER(e.state) = UPPER(p.state))
      GROUP BY p.id, p.name, e.abn
    )
    SELECT id, name, MIN(abn) AS abn
    FROM candidates
    GROUP BY id, name
    HAVING COUNT(*) = 1
  `, { timeout: 300000 });
  report(graph, 'gs_entities');
  if (LIVE) await applyMatches(graph, 'graph');

  // Phase 2: ABR legal names for the remainder. status = 'Active' is required
  // for the partial index idx_abr_entity_name_upper — without it this seq-scans 20M rows.
  console.log('\nPhase 2: Match remaining against abr_registry (Active)...');
  const matchedIds = graph.map((m) => `'${m.id}'::uuid`);
  const exclude = matchedIds.length ? `AND id NOT IN (${matchedIds.join(',')})` : '';
  const abr = await psql(`
    WITH ${probesSql(exclude)},
    candidates AS (
      SELECT p.id, p.name, ar.abn
      FROM probes p
      JOIN abr_registry ar ON UPPER(ar.entity_name) = p.probe AND ar.status = 'Active'
      WHERE (p.state IS NULL OR ar.state IS NULL OR UPPER(ar.state) = UPPER(p.state))
      GROUP BY p.id, p.name, ar.abn
    )
    SELECT id, name, MIN(abn) AS abn
    FROM candidates
    GROUP BY id, name
    HAVING COUNT(*) = 1
  `, { timeout: 300000 });
  report(abr, 'abr_registry');
  if (LIVE) await applyMatches(abr, 'abr');

  // Summary
  const after = await psql(`
    SELECT COUNT(*) FILTER (WHERE abn IS NULL AND source_primary NOT IN ${JUNK_SOURCES}) AS still_missing,
           COUNT(*) FILTER (WHERE abn IS NOT NULL) AS with_abn,
           COUNT(*) FILTER (WHERE source_primary IN ${JUNK_SOURCES}) AS junk_rows,
           COUNT(*) AS total
    FROM social_enterprises
  `);
  const a = after[0];
  console.log(`\n${LIVE ? 'After' : 'Current (no changes applied)'}: ${a.with_abn}/${a.total} with ABN; ${a.still_missing} real records still missing; ${a.junk_rows} junk rows pending cleanup`);
  console.log(`Matched this run: ${graph.length + abr.length}${LIVE ? '' : ' (dry run — re-run with --live to apply)'}`);
  if (!LIVE) console.log('\nRemaining unmatched need fuzzy/API lookup (ABN_LOOKUP_GUID) — separate pass.');
}

main().catch((err) => {
  console.error('backfill-se-abns failed:', err.message);
  process.exit(1);
});
