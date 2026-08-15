#!/usr/bin/env node
/**
 * Graph attribution integrity — do edges point at the RIGHT entity?
 *
 * Third gate, and it exists because the first two both missed a real defect.
 *
 *   check-graph-completeness.mjs        — are there the right NUMBER of edges?
 *   check-graph-referential-integrity.mjs — do edges point at rows that still EXIST?
 *   this                                — do edges point at the right ENTITY?
 *
 * The worked example (2026-08-14): `aec_donations` passed both existing gates. Every
 * source_record_id resolved, counts matched. Yet 53,148 donation edges — 771 distinct donors —
 * were all attributed to one company, because `donor_entity_matches` held 771 rows whose
 * matched_abn was '0' and exactly one gs_entities row carries abn='0'. Count integrity and
 * referential integrity do not imply attribution integrity.
 *
 * CHECKS
 *   1. SINK — an entity carrying a structurally invalid identifier AND edges. An entity whose
 *      ABN is not 11 digits, or is all zeros, is a magnet: everything that normalises to the same
 *      junk value lands on it. This is the AU-ABN-0 class.
 *   2. SPLIT — one canonical_name, more than one entity, and edges on more than one of them.
 *      The organisation's relationships are divided across nodes, so every ranking understates it.
 *      Confirmed today on government bodies: 41 duplicate-name groups, including Department of
 *      Defence, whose real node is the third-largest in the graph.
 *
 * Both are reported, never auto-fixed — merging entities is destructive and needs a human.
 *
 * Usage:
 *   node --env-file=.env scripts/check-graph-attribution.mjs
 *   node --env-file=.env scripts/check-graph-attribution.mjs --top=40
 *   node --env-file=.env scripts/check-graph-attribution.mjs --json
 *
 * Exits 1 if any SINK entity carries edges (always actionable) — SPLIT is reported but does not
 * fail the build, because 4,864 groups cannot be cleared in one pass and a permanently-red gate
 * is a muted gate.
 */

import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { resolveBin } from './lib/agent-resilience.mjs';
import { logStart, logComplete } from './lib/log-agent-run.mjs';
import 'dotenv/config';

const AGENT_ID = 'check-graph-attribution';
const AGENT_NAME = 'Check Graph Attribution';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const TOP = Number(args.find((a) => a.startsWith('--top='))?.split('=')[1] ?? 20);
const log = (m) => { if (!jsonOut) console.log(`[graph-attrib] ${m}`); };

function psql(sql) {
  const res = spawnSync(resolveBin('psql'), [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
    '-U', `postgres.${process.env.SUPABASE_PROJECT_REF || 'tednluwflfhxyucgwigh'}`,
    '-d', 'postgres', '-q', '-t', '-A', '-F', '|', '-c', sql,
  ], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD } });
  if (res.status !== 0) throw new Error(res.stderr?.trim() || `psql exited ${res.status}`);
  return res.stdout.trim().split('\n').filter(Boolean).map((l) => l.split('|'));
}

const ABN_NORM = `regexp_replace(e.abn, '\\s', '', 'g')`;
const ABN_INVALID = `e.abn IS NOT NULL AND (${ABN_NORM} !~ '^[0-9]{11}$' OR ${ABN_NORM} ~ '^0+$')`;

async function main() {
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
                   process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;
  const runId = supabase ? await logStart(supabase, AGENT_ID, AGENT_NAME).then((r) => r?.id).catch(() => null) : null;

  // 1. SINK — invalid identifier AND edges. mv_gs_entity_stats already carries degree, so this
  //    costs one indexed join rather than a scan of 3.4M edges.
  const sinks = psql(`SET statement_timeout='160s';
    SELECT e.gs_id, left(e.canonical_name, 44), coalesce(e.abn,''), s.total_relationships
      FROM gs_entities e JOIN mv_gs_entity_stats s ON s.id = e.id
     WHERE ${ABN_INVALID} AND s.total_relationships > 0
     ORDER BY s.total_relationships DESC LIMIT ${TOP};`);

  const sinkTotals = psql(`SET statement_timeout='160s';
    SELECT count(*), coalesce(sum(s.total_relationships), 0)
      FROM gs_entities e JOIN mv_gs_entity_stats s ON s.id = e.id
     WHERE ${ABN_INVALID} AND s.total_relationships > 0;`)[0];

  // 2. SPLIT — same name, edges on more than one node.
  const splitTotals = psql(`SET statement_timeout='160s';
    SELECT count(*), coalesce(sum(members), 0), coalesce(sum(edges), 0) FROM (
      SELECT count(*) AS members, sum(s.total_relationships) AS edges
        FROM gs_entities e JOIN mv_gs_entity_stats s ON s.id = e.id AND s.total_relationships > 0
       GROUP BY upper(trim(e.canonical_name)) HAVING count(*) > 1) z;`)[0];

  const splits = psql(`SET statement_timeout='160s';
    SELECT upper(trim(e.canonical_name)), count(*), sum(s.total_relationships)
      FROM gs_entities e JOIN mv_gs_entity_stats s ON s.id = e.id AND s.total_relationships > 0
     GROUP BY 1 HAVING count(*) > 1
     ORDER BY sum(s.total_relationships) DESC LIMIT ${TOP};`);

  const result = {
    sinks: { entities: Number(sinkTotals[0]), edges: Number(sinkTotals[1]),
             worst: sinks.map(([gs_id, name, abn, deg]) => ({ gs_id, name, abn, edges: Number(deg) })) },
    splits: { groups: Number(splitTotals[0]), entities: Number(splitTotals[1]), edges: Number(splitTotals[2]),
              worst: splits.map(([name, members, edges]) => ({ name, members: Number(members), edges: Number(edges) })) },
  };

  if (supabase && runId) {
    await logComplete(supabase, runId, {
      items_found: result.sinks.entities + result.splits.groups,
      items_new: result.sinks.entities,
      status: result.sinks.entities ? 'partial' : 'success',
      errors: result.sinks.entities
        ? [`${result.sinks.entities} entities with an invalid identifier carry ${result.sinks.edges.toLocaleString()} edges`] : [],
    }).catch(() => {});
  }

  if (jsonOut) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); process.exit(result.sinks.entities ? 1 : 0); }

  log(`SINK  ${result.sinks.entities} entities with an invalid ABN carry ${result.sinks.edges.toLocaleString()} edges`);
  for (const s of result.sinks.worst) log(`   ${s.edges.toLocaleString().padStart(9)}  ${s.gs_id}  abn='${s.abn}'  ${s.name}`);
  log('');
  log(`SPLIT ${result.splits.groups.toLocaleString()} names are split across ${result.splits.entities.toLocaleString()} entities holding ${result.splits.edges.toLocaleString()} edges`);
  for (const s of result.splits.worst) log(`   ${s.edges.toLocaleString().padStart(9)}  ${String(s.members).padStart(2)} nodes  ${s.name}`);
  log('');
  if (result.sinks.entities) {
    log(`✗ ${result.sinks.entities} sink entities. Every source row whose identifier normalises to the same junk value lands on one node — those edges are attributed to the wrong organisation.`);
    process.exit(1);
  }
  log('✓ No sink entities.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(2); });
