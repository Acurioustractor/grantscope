#!/usr/bin/env node
/**
 * Stale-edge comparison: are the edges ALREADY in gs_relationships the ones the current recipe
 * would build? Read-only.
 *
 * check-graph-completeness counts; this one compares edge by edge. The build only ADDS edges, so a
 * recipe fix never removes what an older recipe built (donations carried $8.7bn of those until
 * 20260922230000). Every existing edge lands in exactly one class:
 *
 *   match     the recipe builds this exact edge (source, target, type, source_record_id)
 *   repoint   the recipe builds an edge for this record, but on a different source/target/type
 *   unbuilt   the source record still exists, the recipe builds nothing for it any more
 *   orphan    the source record is gone
 *   no_key    the edge carries no source_record_id, so it cannot be compared
 *
 * Usage:
 *   node --env-file=.env scripts/check-stale-edges.mjs                       # every dataset
 *   node --env-file=.env scripts/check-stale-edges.mjs --dataset=austender
 *   node --env-file=.env scripts/check-stale-edges.mjs --dataset=aec_donations --detail
 */

import { spawnSync } from 'node:child_process';
import { resolveBin } from './lib/agent-resilience.mjs';
import { GRAPH_EDGE_DATASETS } from './lib/graph-edge-datasets.mjs';

// How each dataset's source_record_id is derived from its source row (mirrors the selectSql).
const SOURCE_KEY = {
  aec_donations: 'id::text',
  austender: "coalesce(NULLIF(ocid, ''), id::text)",
  foundations: 'acnc_abn',
  grantconnect_awards: 'ga_id',
  justice_funding: 'id::text',
};

const args = process.argv.slice(2);
const datasetArg = args.find((a) => a.startsWith('--dataset='))?.split('=')[1];
const detail = args.includes('--detail');
const DATASETS = datasetArg
  ? GRAPH_EDGE_DATASETS.filter((d) => datasetArg.split(',').includes(d.dataset))
  : GRAPH_EDGE_DATASETS;

const PSQL_CONN = [
  '-h', process.env.PGHOST || 'aws-0-ap-southeast-2.pooler.supabase.com',
  '-p', process.env.PGPORT || '5432',
  '-U', process.env.PGUSER || 'postgres.tednluwflfhxyucgwigh',
  '-d', process.env.PGDATABASE || 'postgres',
  '-X', '-A', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-P', 'footer=off',
];

function psql(sql) {
  const res = spawnSync(resolveBin('psql'), [...PSQL_CONN, '-c', sql], {
    env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD },
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error((res.stderr || res.stdout).trim());
  return res.stdout;
}

function compare(def) {
  const types = (def.relationshipTypes ?? [def.relationshipType]).map((t) => `'${t}'`).join(', ');
  const key = SOURCE_KEY[def.dataset];
  if (!key) throw new Error(`No SOURCE_KEY for ${def.dataset}`);
  const detailSql = detail ? `
    SELECT 'detail' AS k, class, side_diff, count(*) AS edges, round(sum(amount)::numeric) AS amount
      FROM classified GROUP BY class, side_diff ORDER BY class, edges DESC;` : '';
  // Every statement below is a SELECT or a TEMP object; the session writes nothing durable.
  return psql(`SET statement_timeout = 0;
    ${def.prelude ? def.prelude.trim().replace(/;?$/, ';') : ''}
    CREATE TEMP TABLE exp AS
      SELECT DISTINCT source_entity_id, target_entity_id, relationship_type, COALESCE(source_record_id, '') AS rid
        FROM (${def.selectSql}
) _q;
    CREATE INDEX ON exp (rid);
    ANALYZE exp;
    CREATE TEMP TABLE src_keys AS SELECT DISTINCT ${key} AS rid FROM ${def.sourceTable} WHERE ${key} IS NOT NULL;
    CREATE INDEX ON src_keys (rid);
    ANALYZE src_keys;
    CREATE TEMP TABLE classified AS
      SELECT r.id, r.amount,
        CASE
          WHEN r.source_record_id IS NULL OR r.source_record_id = '' THEN 'no_key'
          WHEN EXISTS (SELECT 1 FROM exp e WHERE e.rid = r.source_record_id
                         AND e.source_entity_id = r.source_entity_id AND e.target_entity_id = r.target_entity_id
                         AND e.relationship_type = r.relationship_type) THEN 'match'
          WHEN EXISTS (SELECT 1 FROM exp e WHERE e.rid = r.source_record_id) THEN 'repoint'
          WHEN EXISTS (SELECT 1 FROM src_keys s WHERE s.rid = r.source_record_id) THEN 'unbuilt'
          ELSE 'orphan'
        END AS class,
        (SELECT concat_ws('+',
                  CASE WHEN bool_and(e.source_entity_id <> r.source_entity_id) THEN 'source' END,
                  CASE WHEN bool_and(e.target_entity_id <> r.target_entity_id) THEN 'target' END,
                  CASE WHEN bool_and(e.relationship_type <> r.relationship_type) THEN 'type' END)
           FROM exp e WHERE e.rid = r.source_record_id) AS side_diff
        FROM gs_relationships r
       WHERE r.dataset = '${def.dataset}' AND r.relationship_type IN (${types});
    SELECT 'class' AS k, class, count(*) AS edges, round(sum(amount)::numeric) AS amount
      FROM classified GROUP BY class ORDER BY edges DESC;
    ${detailSql}`);
}

for (const def of DATASETS) {
  const t0 = Date.now();
  process.stderr.write(`[stale-edges] ${def.dataset} …\n`);
  const out = compare(def)
    .split('\n')
    .filter((l) => (l.startsWith('class\t') && !l.startsWith('class\tclass')) || l.startsWith('detail\t'));
  console.log(`\n${def.dataset}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  for (const line of out) {
    const [k, cls, a, b, c] = line.split('\t');
    if (k === 'class') console.log(`  ${cls.padEnd(9)} ${Number(a).toLocaleString('en-AU').padStart(11)} edges  $${Number(b || 0).toLocaleString('en-AU')}`);
    else console.log(`    ${cls.padEnd(9)} ${(a || '-').padEnd(20)} ${Number(b).toLocaleString('en-AU').padStart(11)}  $${Number(c || 0).toLocaleString('en-AU')}`);
  }
}
