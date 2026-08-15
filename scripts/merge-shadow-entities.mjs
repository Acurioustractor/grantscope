#!/usr/bin/env node
/**
 * Merge ABN-less shadow entities into their ABN-bearing twin (split-identity bucket C).
 *
 * THE DEFECT. 4,864 canonical names are split across 10,442 gs_entities rows holding 974,463
 * edges — 28% of the graph. Triaged in thoughts/shared/data-map/SPLIT-IDENTITY-TRIAGE.md:
 *
 *   C. one ABN + ABN-less shadows   1,455 groups   684,161 edges   <- this script
 *   D. multiple distinct ABNs       1,184 groups   235,529 edges   leave (different legal entities)
 *   A. no member has an ABN         2,225 groups    54,773 edges   needs a second signal
 *
 * Bucket C is the Department of Defence pattern: a real ABN-bearing entity plus shadows created by
 * a name-only ingest path that never resolved to an identifier.
 *
 * SCOPE CORRECTED 2026-08-15. The original claim — "recovers ~684,161 edges, about 20% of the
 * graph" — was wrong, and a staged dry-run caught it before anything was written. "One ABN plus
 * ABN-less shadows" says nothing about WHAT the shadow is, and by type the candidates were:
 *   person          1,209 groups   merging a PERSON into an organisation on a name match
 *   program           103 groups   deleting them breaks the justice derivation (jf_prog_map
 *                                  resolves program nodes BY NAME)
 *   political_party    92 groups   deleting them breaks aec_donations, which matches recipients
 *                                  on entity_type='political_party'
 *   org-like          158 groups   genuinely safe
 * With the type guard the real scope is 148 groups / 54,753 shadow edges. Smaller, and correct.
 *
 * WHY FKs ARE DISCOVERED AT RUNTIME. 34 foreign-key columns across 32 tables reference
 * gs_entities.id. A hand-written list would miss one the day someone adds a table, and the failure
 * mode is either a FK violation mid-merge or an orphaned reference. This reads pg_constraint every
 * run, so it cannot drift.
 *
 * SAFETY
 *   - DRY RUN BY DEFAULT. --apply is required to write anything.
 *   - Skips any group where a shadow's `state` conflicts with the keeper's — same name in two
 *     states is usually two organisations, not a shadow.
 *   - Skips groups with more than one ABN-bearing member (that is bucket D).
 *   - Repointing gs_relationships can collide with an edge the keeper already has. Handled by
 *     deleting the shadow's duplicate edges first, on the live dedup key
 *     (source, target, relationship_type, dataset, coalesce(source_record_id,'')).
 *   - Each group is one transaction. A failure rolls that group back, not the run.
 *   - --limit=N to rehearse on a subset. Do the top 50 by edge count by hand first — seven names
 *     carry over half the bucket's edges.
 *
 * SEQUENCE. Run this AFTER the justice rebuild and the GrantConnect build (see
 * GRAPH-REPAIR-RUNBOOK.md): those delete 712,827 and add 189,590 edges, so merging first means
 * merging rows that are about to change.
 *
 * Usage:
 *   node --env-file=.env scripts/merge-shadow-entities.mjs                 # dry run, all groups
 *   node --env-file=.env scripts/merge-shadow-entities.mjs --limit=50      # dry run, 50 biggest
 *   node --env-file=.env scripts/merge-shadow-entities.mjs --apply --limit=50
 */

import { spawnSync } from 'node:child_process';
import { resolveBin } from './lib/agent-resilience.mjs';
import 'dotenv/config';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0);
const log = (m) => console.log(`[merge-shadow] ${m}`);

function psql(sql, { rows = true } = {}) {
  const res = spawnSync(resolveBin('psql'), [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
    '-U', `postgres.${process.env.SUPABASE_PROJECT_REF || 'tednluwflfhxyucgwigh'}`,
    '-d', 'postgres', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD } });
  if (res.status !== 0) throw new Error(res.stderr?.trim() || `psql exited ${res.status}`);
  return rows ? res.stdout.trim().split('\n').filter(Boolean).map((l) => l.split('|')) : res.stdout;
}

/** Every column that FKs to gs_entities.id, read fresh so the list cannot go stale. */
function foreignKeys() {
  return psql(`SELECT src.relname, a.attname
     FROM pg_constraint con
     JOIN pg_class src ON src.oid = con.conrelid
     JOIN pg_class tgt ON tgt.oid = con.confrelid
     JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND tgt.relname = 'gs_entities'
    ORDER BY 1, 2;`).map(([table, column]) => ({ table, column }));
}

/**
 * Bucket C groups: exactly one member with an ABN, at least one without, and no shadow whose
 * state contradicts the keeper's.
 */
function candidates() {
  return psql(`
    WITH grp AS (
      SELECT upper(trim(e.canonical_name)) AS nm,
             count(*) AS members,
             count(*) FILTER (WHERE e.abn IS NOT NULL) AS with_abn,
             sum(s.total_relationships) AS edges
        FROM gs_entities e
        JOIN mv_gs_entity_stats s ON s.id = e.id AND s.total_relationships > 0
       GROUP BY 1
      HAVING count(*) > 1
         AND count(*) FILTER (WHERE e.abn IS NOT NULL) = 1
    ),
    keeper AS (
      SELECT g.nm, e.id AS keep_id, e.state AS keep_state, g.edges
        FROM grp g JOIN gs_entities e
          ON upper(trim(e.canonical_name)) = g.nm AND e.abn IS NOT NULL
    )
    SELECT k.nm, k.keep_id, k.edges,
           string_agg(sh.id::text, ',') AS shadow_ids,
           bool_or(sh.state IS NOT NULL AND k.keep_state IS NOT NULL
                   AND upper(trim(sh.state)) <> upper(trim(k.keep_state))) AS state_conflict
      FROM keeper k
      JOIN gs_entities sh
        ON upper(trim(sh.canonical_name)) = k.nm AND sh.abn IS NULL
     -- ENTITY-TYPE GUARD, added 2026-08-15 after a staged dry-run caught the original rule being
     -- far too broad. "One ABN plus ABN-less shadows" says nothing about WHAT the shadow is:
     --   person          1,209 groups — merging a person into an organisation on a name match
     --   program           103 groups — deleting these breaks the justice derivation, which
     --                                  resolves program nodes by name via jf_prog_map
     --   political_party    92 groups — deleting these breaks the aec_donations derivation, which
     --                                  matches recipients on entity_type='political_party'
     -- Excluding any group containing one of those cuts the candidate set from 1,429 groups /
     -- 604,976 edges to 148 / 54,753. Smaller, and actually safe.
       AND NOT EXISTS (
             SELECT 1 FROM gs_entities x
              WHERE upper(trim(x.canonical_name)) = k.nm AND x.abn IS NULL
                AND x.entity_type IN ('person', 'program', 'political_party'))
     GROUP BY 1, 2, 3
     ORDER BY k.edges DESC
     ${LIMIT ? `LIMIT ${LIMIT}` : ''};`);
}

function mergeSql(keepId, shadowIds, fks) {
  const list = shadowIds.map((id) => `'${id}'::uuid`).join(',');
  const stmts = [`BEGIN;`];
  // Drop shadow edges that would collide with one the keeper already holds, on the live dedup key.
  for (const col of ['source_entity_id', 'target_entity_id']) {
    const other = col === 'source_entity_id' ? 'target_entity_id' : 'source_entity_id';
    stmts.push(`DELETE FROM gs_relationships r
       WHERE r.${col} IN (${list})
         AND EXISTS (SELECT 1 FROM gs_relationships k
                      WHERE k.${col} = '${keepId}'::uuid
                        AND k.${other} = r.${other}
                        AND k.relationship_type = r.relationship_type
                        AND k.dataset IS NOT DISTINCT FROM r.dataset
                        AND coalesce(k.source_record_id,'') = coalesce(r.source_record_id,''));`);
  }
  for (const { table, column } of fks) {
    stmts.push(`UPDATE ${table} SET ${column} = '${keepId}'::uuid WHERE ${column} IN (${list});`);
  }
  stmts.push(`DELETE FROM gs_entities WHERE id IN (${list});`);
  stmts.push(`COMMIT;`);
  return stmts.join('\n');
}

function main() {
  const fks = foreignKeys();
  log(`${fks.length} FK columns reference gs_entities.id (discovered at runtime)`);

  const rows = candidates();
  const eligible = rows.filter(([, , , , conflict]) => conflict !== 't');
  const skipped = rows.filter(([, , , , conflict]) => conflict === 't');

  const totalEdges = eligible.reduce((s, r) => s + Number(r[2] || 0), 0);
  log(`${rows.length} bucket-C groups · ${eligible.length} eligible · ${skipped.length} skipped on state conflict`);
  log(`edges on eligible groups: ${totalEdges.toLocaleString()}`);
  log('');

  for (const [nm, keepId, edges, shadowIds] of eligible.slice(0, 15)) {
    log(`  ${String(Number(edges).toLocaleString()).padStart(9)}  ${shadowIds.split(',').length} shadow(s)  ${nm}`);
  }
  if (eligible.length > 15) log(`  … and ${eligible.length - 15} more`);
  log('');

  if (!APPLY) {
    log('DRY RUN — nothing written. Re-run with --apply to merge.');
    log('Review the top 50 by hand first; seven names carry over half the bucket.');
    return;
  }

  let merged = 0, failed = 0, edgesMoved = 0;
  for (const [nm, keepId, edges, shadowIds] of eligible) {
    try {
      psql(mergeSql(keepId, shadowIds.split(','), fks), { rows: false });
      merged++; edgesMoved += Number(edges || 0);
    } catch (err) {
      failed++;
      log(`  ✗ ${nm}: ${err.message.split('\n')[0]}`);
    }
  }
  log('');
  log(`merged ${merged} groups (${edgesMoved.toLocaleString()} edges consolidated) · ${failed} failed`);
  log('Now re-run check-graph-attribution.mjs, then refresh mv_gs_entity_stats ->');
  log('mv_entity_power_index -> mv_revolving_door in that order.');
}

main();
