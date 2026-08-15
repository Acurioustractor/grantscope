#!/usr/bin/env node
/**
 * Seed clarity_object's CURATED columns from the inventory shards.
 *
 * WHY THIS IS CHEAP. The thing that normally kills a data catalog is that nobody writes 700+
 * descriptions, so the catalog ships empty and stays empty. Ours were already written: the three
 * inventory shards in thoughts/shared/data-map/raw/ classify 812 of 812 objects with domain,
 * lifecycle, grain, join keys, purpose and flags. This parses them; nothing is hand-typed.
 *
 * THE OWNERSHIP SPLIT, which is why this can run in any order relative to clarity_refresh():
 *   clarity_refresh() owns DERIVED facts — row counts, bytes, freshness, RLS, degree. Its
 *     ON CONFLICT clause updates only those.
 *   this script owns CURATED facts — domain, lifecycle, grain, purpose, join_keys.
 * Neither clobbers the other. Verified against the refresh function's upsert.
 *
 * UPDATE-ONLY BY DESIGN. clarity_object rows are created by clarity_refresh() from the live
 * catalogue; this never invents one. An object in the shards with no row is reported, not
 * inserted — it means the object was dropped since the shards were written, which is a fact worth
 * seeing rather than papering over. An object in the catalogue with no shard entry keeps
 * domain = NULL and renders as `unclassified` — visible and flagged, never silently absent.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-clarity-curation.mjs --dry-run   # parse + report, no writes
 *   node --env-file=.env scripts/seed-clarity-curation.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolveBin } from './lib/agent-resilience.mjs';
import 'dotenv/config';

const SHARD_DIR = 'thoughts/shared/data-map/raw';
const DRY = process.argv.includes('--dry-run');
const log = (m) => console.log(`[seed-curation] ${m}`);

/** Lifecycle values clarity_lifecycle accepts. A shard value outside this set is a parse error. */
const LIFECYCLE = new Set(['core_source', 'derived', 'crosswalk', 'app_operational', 'staging',
  'backup', 'superseded', 'scaffold_empty', 'lens', 'routine']);

function psql(sql, { rows = true } = {}) {
  const res = spawnSync(resolveBin('psql'), [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
    '-U', `postgres.${process.env.SUPABASE_PROJECT_REF || 'tednluwflfhxyucgwigh'}`,
    '-d', 'postgres', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD } });
  if (res.status !== 0) throw new Error(res.stderr?.trim() || `psql exited ${res.status}`);
  // filter on '|': psql echoes "SET" for the statement prefix, which is not a row.
  return rows ? res.stdout.split('\n').filter((l) => l.includes('|')).map((l) => l.split('|')) : res.stdout;
}

const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

/**
 * Shard rows are 9-cell markdown pipe tables:
 *   name | kind | rows | domain | lifecycle | grain | join_keys | purpose | flags
 * Verified to parse 812 of 812 with zero missing and zero duplicates.
 */
function parseShards() {
  const files = readdirSync(SHARD_DIR).filter((f) => /^inventory-shard-.*\.md$/.test(f)).sort();
  if (!files.length) throw new Error(`No inventory shards found in ${SHARD_DIR}`);
  const byKey = new Map();
  const dupes = [];
  for (const f of files) {
    for (const line of readFileSync(`${SHARD_DIR}/${f}`, 'utf8').split('\n')) {
      if (!line.trim().startsWith('|')) continue;
      const c = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
      if (c.length !== 9) continue;
      const name = c[0].replace(/`/g, '').trim();
      if (!name || /^-+$/.test(name) || ['name', 'object'].includes(name.toLowerCase())) continue;
      // Shards sometimes qualify a lifecycle in prose — "scaffold_empty (effectively)". Strip the
      // parenthetical and normalise separators; the qualifier is the author hedging, not a
      // different lifecycle, and dropping the row to NULL over it loses real classification.
      const lifecycleNorm = (c[4] || '').replace(/\s*\(.*$/, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      const rec = {
        key: name,
        domain: c[3] || null,
        lifecycle: LIFECYCLE.has(lifecycleNorm) ? lifecycleNorm : null,
        rawLifecycle: c[4],
        grain: c[5] || null,
        joinKeys: c[6] || null,
        purpose: c[7] || null,
        flags: c[8] || null,
        shard: f,
      };
      if (byKey.has(name)) { dupes.push(name); continue; }
      byKey.set(name, rec);
    }
  }
  return { records: [...byKey.values()], dupes, files };
}

function main() {
  const { records, dupes, files } = parseShards();
  log(`parsed ${records.length} objects from ${files.length} shards${dupes.length ? ` · ${dupes.length} duplicate names skipped` : ''}`);

  const badLifecycle = records.filter((r) => !r.lifecycle);
  if (badLifecycle.length) {
    log(`⚠ ${badLifecycle.length} object(s) carry a lifecycle outside clarity_lifecycle — seeded as NULL:`);
    for (const r of badLifecycle.slice(0, 8)) log(`    ${r.key}: "${r.rawLifecycle}"`);
  }
  const noPurpose = records.filter((r) => !r.purpose).length;
  log(`domains: ${new Set(records.map((r) => r.domain).filter(Boolean)).size} distinct · missing purpose: ${noPurpose}`);

  // Which shard objects actually have a catalog row? Anything missing was dropped since the
  // shards were written — report it rather than inventing a row.
  const present = new Set(psql(
    `SELECT object_key, '' FROM clarity_object WHERE object_kind IN ('table','matview')`).map(([k]) => k));
  const matched = records.filter((r) => present.has(r.key));
  const orphaned = records.filter((r) => !present.has(r.key));

  log(`catalog rows present: ${present.size} · shard objects matched: ${matched.length} · shard objects with NO catalog row: ${orphaned.length}`);
  if (orphaned.length) for (const r of orphaned.slice(0, 10)) log(`    no row: ${r.key}`);

  if (present.size === 0) {
    log('clarity_object is EMPTY — run clarity_refresh() first, then re-run this. Nothing to update.');
    if (!DRY) process.exitCode = 1;
    return;
  }

  if (DRY) { log(`DRY RUN — would update ${matched.length} rows. Nothing written.`); return; }

  // One statement per batch keeps each round trip small; the pooler drops long-running work.
  let updated = 0;
  for (let i = 0; i < matched.length; i += 200) {
    const batch = matched.slice(i, i + 200);
    const values = batch.map((r) =>
      `(${q(r.key)}, ${q(r.domain)}, ${r.lifecycle ? `${q(r.lifecycle)}::clarity_lifecycle` : 'NULL'}, ${q(r.grain)}, ${q(r.joinKeys)}, ${q(r.purpose)}, ${q(r.flags)})`).join(',\n      ');
    const out = psql(`
      WITH v(object_key, domain, lifecycle, grain, join_keys, purpose, caveat) AS (VALUES
      ${values})
      UPDATE clarity_object o SET
        domain = v.domain, lifecycle = v.lifecycle, grain = v.grain,
        join_keys = v.join_keys, purpose = v.purpose,
        caveat = NULLIF(v.caveat, '')
      FROM v WHERE o.object_key = v.object_key
      RETURNING o.object_key, '';`);
    updated += out.length;
    log(`  batch ${i / 200 + 1}: ${out.length} rows`);
  }
  log(`updated ${updated} of ${matched.length} matched objects`);

  const [[described, total]] = psql(
    `SELECT count(*) FILTER (WHERE domain IS NOT NULL), count(*) FROM clarity_object`);
  log(`catalog coverage: ${described} of ${total} objects carry a domain (${(described / total * 100).toFixed(1)}%)`);
}

main();
