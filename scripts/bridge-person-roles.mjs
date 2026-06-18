#!/usr/bin/env node
/**
 * Bridge person_roles → gs_relationships (directorship / member_of edges: person → company).
 *
 * Set-based via direct psql, all three steps additive + idempotent:
 *   1. Ensure a `person` entity exists for each distinct person (gs_id = GS-PERSON-<slug>, capped 80).
 *   2. Insert person→company edges, one per (person, company, relationship_type). role_type maps
 *      director/chair → directorship, everything else → member_of (mirrors the old ROLE_TO_REL
 *      with its `|| 'member_of'` default).
 *   3. Backfill person_roles.person_entity_id + entity_id with the resolved entity ids.
 *
 * History: the old path used REST `.insert()` with NO onConflict, so whole 1-person batches died on
 * the dedup unique index (idx_gs_rel_dedup) whenever any edge already existed — the agent could not
 * cleanly re-run. Set-based psql with `ON CONFLICT (<the dedup expression>) DO NOTHING` is the fix.
 * Unlike the justice bridge, person entities use a single gs_id format, so the gs_id join lands on
 * exactly the nodes existing edges use and a plain ON CONFLICT dedups them — no build-side guard needed.
 *
 * Usage:
 *   node --env-file=.env scripts/bridge-person-roles.mjs [--apply]   (default: DRY RUN)
 */

import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { resolveBin, withRetry } from './lib/agent-resilience.mjs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PG_PASSWORD = process.env.DATABASE_PASSWORD;
const PSQL_BIN = resolveBin('psql');
const PSQL_CONN = [
  '-h', process.env.PGHOST || 'aws-0-ap-southeast-2.pooler.supabase.com',
  '-p', process.env.PGPORT || '5432',
  '-U', process.env.PGUSER || 'postgres.tednluwflfhxyucgwigh',
  '-d', process.env.PGDATABASE || 'postgres',
  '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
];

const DEDUP_TARGET =
  "(source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id, ''::text))";

// Person identity, shared by every step so entities, edges and backfill agree:
//   normname = person_name_normalised, else upper(trim(person_name))  (mirrors JS `a || b`)
//   gs_id    = left('GS-PERSON-' || slug(normname), 80)               (mirrors personGsId())
const NORMNAME = `coalesce(NULLIF(pr.person_name_normalised,''), upper(trim(pr.person_name)))`;
const PERSON_GSID = (norm) =>
  `left('GS-PERSON-' || regexp_replace(regexp_replace(lower(${norm}),'[^a-z0-9]+','-','g'),'(^-|-$)','','g'), 80)`;

// Step 1 — person entities (additive). DISTINCT ON (gs_id) collapses slug collisions to one node.
const PERSON_ENTITY_SQL = `
  INSERT INTO gs_entities (gs_id, canonical_name, entity_type, source_count, confidence)
  SELECT DISTINCT ON (gs_id) gs_id, initcap(lower(normname)), 'person', cnt, 'registry'
  FROM (
    SELECT coalesce(NULLIF(pr.person_name_normalised,''), upper(trim(pr.person_name))) AS normname,
           count(*) AS cnt
      FROM person_roles pr
     WHERE pr.company_abn IS NOT NULL
       AND coalesce(NULLIF(pr.person_name_normalised,''), upper(trim(pr.person_name))) IS NOT NULL
     GROUP BY 1
  ) p,
  LATERAL (SELECT left('GS-PERSON-' || regexp_replace(regexp_replace(lower(p.normname),'[^a-z0-9]+','-','g'),'(^-|-$)','','g'), 80) AS gs_id) g
  WHERE g.gs_id <> 'GS-PERSON-'
  ORDER BY gs_id, cnt DESC
  ON CONFLICT (gs_id) DO NOTHING;`;

// Step 2 — edges (additive). One row per (person, company, relationship_type); on collapse keep the
// earliest-appointed role's metadata (deterministic by appointment_date then id).
const EDGE_SELECT = `
  WITH role_edges AS (
    SELECT pe.id AS source_entity_id, ce.id AS target_entity_id,
           CASE WHEN pr.role_type IN ('director','chair') THEN 'directorship' ELSE 'member_of' END AS relationship_type,
           pr.appointment_date AS start_date, pr.cessation_date AS end_date,
           coalesce(pr.source,'acnc') AS src, pr.role_type AS original_role, pr.id AS rid
      FROM person_roles pr
      JOIN gs_entities ce ON ce.abn = pr.company_abn
      JOIN gs_entities pe ON pe.gs_id = ${PERSON_GSID(NORMNAME)}
     WHERE pr.company_abn IS NOT NULL
  )
  SELECT DISTINCT ON (source_entity_id, target_entity_id, relationship_type)
         source_entity_id, target_entity_id, relationship_type, 'person_roles', 'registry',
         start_date, end_date,
         jsonb_build_object('source', src, 'original_role', original_role)
    FROM role_edges
   ORDER BY source_entity_id, target_entity_id, relationship_type, start_date NULLS LAST, rid`;
const EDGE_COLS =
  '(source_entity_id, target_entity_id, relationship_type, dataset, confidence, start_date, end_date, properties)';

// Step 3 — backfill person_roles with the resolved entity ids (per-row company; idempotent guard).
const BACKFILL_SQL = `
  UPDATE person_roles pr
     SET person_entity_id = pe.id, entity_id = ce.id
    FROM gs_entities pe, gs_entities ce
   WHERE pr.company_abn IS NOT NULL
     AND ce.abn = pr.company_abn
     AND pe.gs_id = ${PERSON_GSID(NORMNAME)}
     AND (pr.person_entity_id IS DISTINCT FROM pe.id OR pr.entity_id IS DISTINCT FROM ce.id);`;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function runDml(label, sql) {
  if (!PG_PASSWORD) throw new Error('DATABASE_PASSWORD not set — the person bridge requires direct psql');
  const stdout = await withRetry(() => {
    const res = spawnSync(PSQL_BIN, [...PSQL_CONN, '-c', `SET statement_timeout=0;\n${sql}`], {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error((res.stderr || res.stdout || `psql exit ${res.status}`).trim());
    return res.stdout || '';
  }, label);
  return String(stdout);
}

const tag = (out, re) => (String(out).match(re) || [])[1] ?? '0';

async function main() {
  const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const run = supabase ? await logStart(supabase, 'bridge-person-roles', 'Bridge Person Roles') : { id: null };
  const runId = run?.id ?? null;

  try {
    log(`=== Bridge Person Roles → Graph (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`);

    if (!APPLY) {
      const out = await runDml('person edges dry-run', `SELECT count(*) FROM (${EDGE_SELECT}) _q;`);
      const n = out.trim().split('\n').pop() || '?';
      log(`Would insert ~${n} person→company edges (existing skipped via ON CONFLICT). Use --apply to write.`);
      if (supabase && runId) await logComplete(supabase, runId, { items_found: Number(n) || 0, items_new: 0 });
      return;
    }

    log('Step 1/3: ensuring person entities (additive)...');
    const pe = await runDml('person entities', PERSON_ENTITY_SQL);
    log(`  Person entities created: ${tag(pe, /INSERT\s+\d+\s+(\d+)/)} (existing reused)`);

    log('Step 2/3: inserting person→company edges (additive)...');
    const ins = await runDml('person edges',
      `INSERT INTO gs_relationships ${EDGE_COLS}\n${EDGE_SELECT}\nON CONFLICT ${DEDUP_TARGET} DO NOTHING;`);
    const relsCreated = Number(tag(ins, /INSERT\s+\d+\s+(\d+)/));
    log(`  Edges inserted: ${relsCreated} (existing skipped via ON CONFLICT)`);

    log('Step 3/3: backfilling person_roles entity references...');
    const bf = await runDml('person_roles backfill', BACKFILL_SQL);
    log(`  person_roles rows linked: ${tag(bf, /UPDATE\s+(\d+)/)}`);

    log('=== COMPLETE ===');
    if (supabase && runId) await logComplete(supabase, runId, { items_found: relsCreated, items_new: relsCreated });
  } catch (err) {
    console.error('Fatal:', err);
    if (supabase && runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

main();
