/**
 * Regenerate src/lib/column-manifest.json — the real column list for every relation the code names.
 *
 *   node --env-file=../../.env apps/web/scripts/build-column-manifest.mjs   (from repo root)
 *
 * Exists because three separate defects on 2026-08-20 were the same mistake: a query written
 * against a schema that is not there.
 *
 *   mv_revolving_door.in_procurement            → lives on mv_entity_power_index
 *   austender_contracts.supplier_state          → that table has NO geographic column at all
 *   alma_interventions.gs_entity_id = e.gs_id   → uuid vs text; it pairs with e.id
 *
 * Each failed on every request, silently, and rendered a public page as though it had measured
 * nothing. None was caught by tsc, tests, or review.
 *
 * Only relations the source actually names are included — manifesting all 1,083 public relations
 * would be mostly noise and would churn on every unrelated migration.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../src');

// Names the code uses in SQL or PostgREST. Over-collects (CTEs, keywords); the DB filters it.
const candidates = new Set();
const grep = (re) => {
  try {
    return execSync(`grep -rhoE "${re}" ${SRC}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
};
for (const m of grep('(FROM|JOIN)[[:space:]]+[a-z_][a-z0-9_]{2,}').split('\n')) {
  const t = m.trim().split(/\s+/)[1];
  if (t) candidates.add(t.toLowerCase());
}
for (const m of grep("\\\\.from\\\\('[a-z_][a-z0-9_]+'\\\\)").split('\n')) {
  const t = m.match(/'([a-z0-9_]+)'/)?.[1];
  if (t) candidates.add(t);
}

const list = [...candidates].map((t) => `'${t.replace(/'/g, "''")}'`).join(',');
const sql = `SELECT c.relname||'|'||string_agg(a.attname, ',' ORDER BY a.attname)
  FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
 WHERE c.relkind IN ('r','v','m') AND c.relnamespace = 'public'::regnamespace
   AND a.attnum > 0 AND NOT a.attisdropped AND c.relname IN (${list})
 GROUP BY c.relname ORDER BY c.relname`;

const out = execSync(
  `node --env-file=${join(here, '../../../.env')} ${join(here, '../../../scripts/gsql.mjs')} ${JSON.stringify(sql)}`,
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

const manifest = {};
for (const line of out.split('\n').slice(2)) {
  const [rel, cols] = line.trim().split('|');
  if (rel && cols) manifest[rel] = cols.trim().split(',');
}
if (Object.keys(manifest).length < 50) throw new Error(`only ${Object.keys(manifest).length} relations — refusing to write a truncated manifest`);

writeFileSync(join(SRC, 'lib/column-manifest.json'), JSON.stringify(manifest, null, 0) + '\n');
console.log(`wrote ${Object.keys(manifest).length} relations`);
