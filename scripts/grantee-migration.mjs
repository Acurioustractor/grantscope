#!/usr/bin/env node
/**
 * Emit the ingest migration for a resolved grantee file. The last hand-written step of a wave.
 *
 * The migration shape is settled (see migrations/2026-08-17-hmst-grantees-ingest.sql) and its two
 * non-obvious details are the ones worth never retyping:
 *
 *   1. `source_record_id` = name|year|rownum. Without the rownum a funder that gave the same org
 *      two grants in one year collides on the unique index — the first HMST apply rolled back on
 *      exactly this.
 *   2. A `dataset` key that makes the whole ingest reversible with one DELETE.
 *
 * Usage:
 *   node scripts/grantee-migration.mjs \
 *     --linked data/ingest/ian-potter-linked.tsv \
 *     --funder AU-ABN-12345678901 \
 *     --dataset ian_potter_grants_2026 \
 *     --source-url https://www.ianpotter.org.au/our-grants/ \
 *     --note "Ian Potter Foundation grants database, downloaded 2026-08-18"
 *
 * Writes migrations/<date>-<dataset>-ingest.sql and prints the apply command. Applies nothing.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const LINKED = arg('linked');
const FUNDER = arg('funder');
const DATASET = arg('dataset');
const SOURCE_URL = arg('source-url', '');
const NOTE = arg('note', '');
const DATE = arg('date'); // Date.now() is avoided in generated artefacts; pass it or it is derived below.

for (const [flag, val] of [['--linked', LINKED], ['--funder', FUNDER], ['--dataset', DATASET]]) {
  if (!val) {
    console.error(`grantee-migration: ${flag} is required`);
    process.exit(2);
  }
}
if (!existsSync(LINKED)) {
  console.error(`grantee-migration: no such file ${LINKED}`);
  process.exit(2);
}
if (!/^[a-z0-9_]+$/.test(DATASET)) {
  console.error('grantee-migration: --dataset must be lower_snake_case (it is the reversal key)');
  process.exit(2);
}

const rows = readFileSync(LINKED, 'utf8').split('\n').filter((l) => l.trim());
let dollars = 0;
const orgs = new Set();
const byConfidence = { reported: 0, inferred: 0 };
for (const line of rows) {
  const [, amount, , gs_id, confidence] = line.split('\t');
  dollars += Number(amount) || 0;
  if (gs_id) orgs.add(gs_id);
  if (confidence in byConfidence) byConfidence[confidence] += 1;
}

const stamp = DATE ?? new Date().toISOString().slice(0, 10);
const outPath = `migrations/${stamp}-${DATASET.replace(/_/g, '-')}-ingest.sql`;
const tmp = DATASET.slice(0, 40);

const sql = `-- ${NOTE || DATASET} — grantee ingest.
-- ${rows.length} grant rows · $${dollars.toLocaleString('en-AU')} · ${orgs.size} distinct organisations.
-- Confidence: ${byConfidence.reported} 'reported' (exact name match), ${byConfidence.inferred} 'inferred'
-- (trigram >=0.80 auto-accept, or 0.60-0.80 band accepted by adjudication under the false-friend
-- rules: locality, state of a federated charity, org vs its own fundraising foundation).
-- Names with no candidate are HELD OUT and named in the -heldout.tsv beside the row data, never
-- silently dropped.
-- Row data: ${LINKED} (committed alongside this migration).
--
-- REVERSIBLE: DELETE FROM gs_relationships WHERE dataset='${DATASET}';
-- Apply (from repo root): source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f ${outPath}

BEGIN;

CREATE TEMP TABLE ${tmp}_raw (name text, amount bigint, year int, gs_id text, confidence text);
\\copy ${tmp}_raw FROM '${LINKED}' WITH (FORMAT text)

-- rownum is what stops a funder's second grant to the same org in the same year colliding on the
-- unique index. Do not remove it.
CREATE TEMP TABLE ${tmp}_stg AS
  SELECT *, row_number() OVER (PARTITION BY name, year ORDER BY amount) AS rn FROM ${tmp}_raw;

INSERT INTO gs_relationships
  (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_url,
   confidence, source_record_id)
SELECT s.id, t.id, 'grant', r.amount, r.year, '${DATASET}',
       ${SOURCE_URL ? `'${SOURCE_URL.replace(/'/g, "''")}'` : 'NULL'},
       r.confidence,
       r.name || '|' || r.year || '|' || r.rn
FROM ${tmp}_stg r
JOIN gs_entities s ON s.gs_id = '${FUNDER}'
JOIN gs_entities t ON t.gs_id = r.gs_id;

COMMIT;
`;

writeFileSync(outPath, sql);
console.log(`wrote ${outPath}`);
console.log(`  ${rows.length} rows · $${dollars.toLocaleString('en-AU')} · ${orgs.size} orgs · ${byConfidence.reported} reported / ${byConfidence.inferred} inferred`);
console.log('');
console.log('Check the funder gs_id resolves before applying:');
console.log(`  node --env-file=.env scripts/gsql.mjs "SELECT gs_id, canonical_name FROM gs_entities WHERE gs_id = '${FUNDER}'"`);
console.log('');
console.log('Apply:');
console.log(`  source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f ${outPath}`);
