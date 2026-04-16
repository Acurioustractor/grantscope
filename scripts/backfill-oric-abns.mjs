#!/usr/bin/env node
/**
 * backfill-oric-abns.mjs — Backfill missing ABNs in oric_corporations from abr_registry
 *
 * Two phases:
 * 1. Exact name match (UPPER) against abr_registry — uses btree index, fast
 * 2. Normalized fuzzy match — strips common suffixes (Aboriginal Corporation, etc.)
 *
 * Dry-run by default. Use --live to apply updates.
 */

import { psql } from './lib/psql.mjs';

const AGENT_ID = 'backfill-oric-abns';
const LIVE = process.argv.includes('--live');

// Normalize name for matching — same as enrich-from-oric.mjs
function normName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(aboriginal|torres strait islander|corporation|incorporated|inc|ltd|limited|pty|co-operative|association|assoc)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  let totalMatched = 0;
  let exactMatched = 0;
  let fuzzyMatched = 0;

  try {
    // Phase 1: Exact name match
    console.log('Phase 1: Exact name match against abr_registry...');
    const exactMatches = await psql(`
      SELECT oc.icn, oc.name, ar.abn, ar.entity_name
      FROM oric_corporations oc
      JOIN abr_registry ar ON UPPER(oc.name) = UPPER(ar.entity_name)
      WHERE oc.abn IS NULL
        AND ar.status = 'Active'
        AND ar.abn IS NOT NULL
    `);

    console.log(`  Found ${exactMatches.length} exact matches`);
    exactMatched = exactMatches.length;

    if (LIVE && exactMatches.length > 0) {
      // Batch update in groups of 50
      for (let i = 0; i < exactMatches.length; i += 50) {
        const batch = exactMatches.slice(i, i + 50);
        const cases = batch.map(m => `WHEN '${m.icn}' THEN '${m.abn}'`).join('\n          ');
        const icns = batch.map(m => `'${m.icn}'`).join(',');
        await psql(`
          UPDATE oric_corporations
          SET abn = CASE icn
            ${cases}
          END
          WHERE icn IN (${icns}) AND abn IS NULL
        `);
        console.log(`  Updated batch ${Math.floor(i / 50) + 1}/${Math.ceil(exactMatches.length / 50)}`);
      }
    } else if (!LIVE && exactMatches.length > 0) {
      console.log('  [DRY RUN] Sample matches:');
      exactMatches.slice(0, 5).forEach(m =>
        console.log(`    ${m.name} -> ABN ${m.abn}`)
      );
    }

    // Phase 2: Normalized name match — single bulk SQL query
    console.log('\nPhase 2: Normalized name match for remaining...');
    const fuzzyMatches = await psql(`
      WITH normed_oric AS (
        SELECT icn, name,
          LOWER(REGEXP_REPLACE(
            REGEXP_REPLACE(name, '\\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc)\\M', '', 'gi'),
            '[^a-zA-Z0-9 ]', '', 'g'
          )) AS norm_name
        FROM oric_corporations
        WHERE abn IS NULL
      ),
      normed_abr AS (
        SELECT abn, entity_name,
          LOWER(REGEXP_REPLACE(
            REGEXP_REPLACE(entity_name, '\\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc)\\M', '', 'gi'),
            '[^a-zA-Z0-9 ]', '', 'g'
          )) AS norm_name
        FROM abr_registry
        WHERE status = 'Active' AND abn IS NOT NULL
      ),
      matches AS (
        SELECT o.icn, o.name AS oric_name, a.abn, a.entity_name AS abr_name,
          ROW_NUMBER() OVER (PARTITION BY o.icn ORDER BY a.entity_name) AS rn,
          COUNT(*) OVER (PARTITION BY o.icn) AS match_count
        FROM normed_oric o
        JOIN normed_abr a ON TRIM(BOTH FROM o.norm_name) = TRIM(BOTH FROM a.norm_name)
        WHERE LENGTH(TRIM(BOTH FROM o.norm_name)) >= 3
      )
      SELECT icn, oric_name, abn, abr_name
      FROM matches
      WHERE match_count = 1 AND rn = 1
    `, { timeout: 120000 });

    fuzzyMatched = fuzzyMatches.length;
    console.log(`  Found ${fuzzyMatched} unique normalized matches`);

    if (LIVE && fuzzyMatches.length > 0) {
      for (let i = 0; i < fuzzyMatches.length; i += 50) {
        const batch = fuzzyMatches.slice(i, i + 50);
        const cases = batch.map(m => `WHEN '${m.icn}' THEN '${m.abn}'`).join('\n          ');
        const icns = batch.map(m => `'${m.icn}'`).join(',');
        await psql(`
          UPDATE oric_corporations
          SET abn = CASE icn
            ${cases}
          END
          WHERE icn IN (${icns}) AND abn IS NULL
        `);
        console.log(`  Updated fuzzy batch ${Math.floor(i / 50) + 1}/${Math.ceil(fuzzyMatches.length / 50)}`);
      }
    } else if (!LIVE && fuzzyMatches.length > 0) {
      console.log('  [DRY RUN] Sample fuzzy matches:');
      fuzzyMatches.slice(0, 5).forEach(m =>
        console.log(`    ${m.oric_name} -> ${m.abr_name} (ABN ${m.abn})`)
      );
    }

    totalMatched = exactMatched + fuzzyMatched;
    console.log(`\nDone. Total matched: ${totalMatched} (${exactMatched} exact + ${fuzzyMatched} fuzzy)`);
    if (!LIVE) console.log('Run with --live to apply updates.');

    console.log('Complete.');
  } catch (err) {
    console.error('Fatal error:', err.message);
    console.error('Details:', err);
    process.exit(1);
  }
}

main();
