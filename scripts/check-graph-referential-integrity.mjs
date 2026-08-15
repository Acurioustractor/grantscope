#!/usr/bin/env node
/**
 * Graph referential integrity — do edges point at source rows that still exist?
 *
 * Companion to check-graph-completeness.mjs, which compares edge COUNTS against a rebuilt
 * derivation. This checks something that gate structurally cannot: whether each edge's
 * `source_record_id` still resolves to a live row in the table it came from.
 *
 * Why it exists (2026-08-14). `justice_funding` was re-ingested with regenerated uuid primary
 * keys and the edge layer was never rebuilt. Exactly 144,971 of 857,798 edges (16.9%) still
 * resolve; 712,827 point at deleted grants. The completeness gate saw the count discrepancy and
 * classified it STALE (informational, exit 0). Nothing checked whether the ids meant anything.
 * A count check cannot catch a key-space swap: rebuild the source with the same row count and
 * new ids, and completeness looks perfect while every edge is orphaned.
 *
 * COVERAGE IS DELIBERATELY PARTIAL AND VISIBLE. gs_relationships carries 24+ datasets, and only
 * some are checkable:
 *   - some have no source_record_id at all (person_roles: 334,982 edges, zero ids)
 *   - some use synthetic composite keys that are not a source PK
 *     (austender 'prod-<hash>', nhmrc 'nhmrc-<id>', frrr 'frrr-<year>-<name>')
 * Those are reported UNCHECKABLE with the reason, never silently skipped — an unwatched layer is
 * exactly how the justice defect survived. Add to SOURCE_KEY_MAP as mappings are established.
 *
 * Usage:
 *   node --env-file=.env scripts/check-graph-referential-integrity.mjs
 *   node --env-file=.env scripts/check-graph-referential-integrity.mjs --dataset=justice_funding
 *   node --env-file=.env scripts/check-graph-referential-integrity.mjs --sample=50000   # indicative only
 *   node --env-file=.env scripts/check-graph-referential-integrity.mjs --json
 *
 * Exits 1 if any checkable dataset resolves below --min-resolve (default 0.90).
 */

import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { resolveBin } from './lib/agent-resilience.mjs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import 'dotenv/config';

const AGENT_ID = 'check-graph-referential-integrity';
const AGENT_NAME = 'Check Graph Referential Integrity';

/**
 * dataset -> how to resolve its source_record_id back to a live source row.
 * `cast` is applied to source_record_id before comparison. Only add an entry once the mapping
 * has actually been verified against real rows — a wrong mapping reports a false 0% and would
 * trigger a destructive rebuild of a healthy layer.
 */
const SOURCE_KEY_MAP = {
  justice_funding:     { table: 'justice_funding',     key: 'id', cast: '::uuid' },
  aec_donations:       { table: 'political_donations', key: 'id', cast: '::uuid' },
  grant_opportunities: { table: 'grant_opportunities', key: 'id', cast: '::uuid' },
  foundation_grantees: { table: 'foundation_grantees', key: 'id', cast: '::uuid' },
  // ga_id is a TEXT natural key, not a uuid — no cast. Added the same day the layer was built:
  // shipping an edge dataset without its integrity mapping is how a layer becomes unwatched, which
  // is the defect this whole gate exists to catch.
  grantconnect_awards: { table: 'grantconnect_awards', key: 'ga_id', cast: '' },
};

/** Datasets known to be unmappable, with the reason. Keeps the gap visible in the output. */
const UNCHECKABLE = {
  person_roles:            'no source_record_id on any edge (334,982 edges, 0 ids)',
  person_roles_crossmatch: 'no source_record_id on any edge',
  acnc_register:           'no source_record_id on any edge',
  foundation_board:        'no source_record_id on any edge',
  abr_corporate_groups:    'no source_record_id on any edge',
  foundation_charity_match:'no source_record_id on any edge',
  austender:               "synthetic key 'prod-<hash>', not a source PK",
  nhmrc_grants:            "synthetic key 'nhmrc-<id>', not a source PK",
  frrr_grants:             "synthetic key 'frrr-<year>-<name>', not a source PK",
};

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const datasetArg = args.find((a) => a.startsWith('--dataset='))?.split('=')[1];
// EXACT BY DEFAULT. Sampling here is a trap: `LIMIT n` without ORDER BY returns whatever the scan
// reaches first, and orphaned vs live edges are physically CLUSTERED (old build generations sit
// together on disk). Two 20,000-row LIMIT samples of justice_funding returned 0% and 34.2%; the
// exact answer is 16.9%. Full counts probe the source PK and took ~30s on 857,798 edges, so pay it.
// --sample=n falls back to the old behaviour and is flagged INDICATIVE in the output.
const SAMPLE = Number(args.find((a) => a.startsWith('--sample='))?.split('=')[1] ?? 0);
const MIN_RESOLVE = Number(args.find((a) => a.startsWith('--min-resolve='))?.split('=')[1] ?? 0.90);

const log = (m) => { if (!jsonOut) console.log(`[graph-refint] ${m}`); };

function psql(sql) {
  const bin = resolveBin('psql');
  const res = spawnSync(bin, [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
    '-U', `postgres.${process.env.SUPABASE_PROJECT_REF || 'tednluwflfhxyucgwigh'}`,
    '-d', 'postgres', '-q', '-t', '-A', '-F', '|', '-c', sql,
  ], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD } });
  if (res.status !== 0) throw new Error(res.stderr?.trim() || `psql exited ${res.status}`);
  return res.stdout.trim();
}

async function main() {
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
                   process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;
  const runId = supabase ? await logStart(supabase, AGENT_ID, AGENT_NAME).then((r) => r?.id).catch(() => null) : null;

  const targets = datasetArg
    ? datasetArg.split(',').map((s) => s.trim())
    : Object.keys(SOURCE_KEY_MAP);

  const results = [];
  for (const dataset of targets) {
    const map = SOURCE_KEY_MAP[dataset];
    if (!map) {
      results.push({ dataset, status: 'UNCHECKABLE', reason: UNCHECKABLE[dataset] ?? 'no mapping in SOURCE_KEY_MAP' });
      continue;
    }
    // Probe each edge against the source PK — the indexed direction. The reverse
    // (source -> edges) has no index on source_record_id and times out on the shared pooler.
    const scope = SAMPLE > 0
      ? `WITH e AS (SELECT source_record_id FROM gs_relationships
           WHERE dataset='${dataset}' AND source_record_id IS NOT NULL LIMIT ${SAMPLE})`
      : `WITH e AS (SELECT source_record_id FROM gs_relationships
           WHERE dataset='${dataset}' AND source_record_id IS NOT NULL)`;
    const sql = `SET statement_timeout='260s';
      ${scope}
      SELECT count(*),
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM ${map.table} s WHERE s.${map.key} = e.source_record_id${map.cast}))
      FROM e;`;
    let sampled = 0, resolved = 0, error = null;
    try {
      const [a, b] = psql(sql).split('\n').pop().split('|');
      sampled = Number(a); resolved = Number(b);
    } catch (err) { error = err.message.split('\n')[0]; }

    if (error) { results.push({ dataset, status: 'ERROR', reason: error }); continue; }
    const rate = sampled > 0 ? resolved / sampled : null;
    const status = sampled === 0 ? 'NO_EDGES' : rate >= MIN_RESOLVE ? 'OK' : 'ORPHANED';
    results.push({ dataset, sampled, resolved, resolve_rate: rate, status,
                   exact: SAMPLE === 0, source: `${map.table}.${map.key}` });
    log(`  ${dataset}: ${resolved.toLocaleString()}/${sampled.toLocaleString()} resolve to ${map.table}.${map.key} · ${status}${SAMPLE ? ' (INDICATIVE — sampled)' : ''}`);
  }

  if (!datasetArg) {
    for (const [d, reason] of Object.entries(UNCHECKABLE)) {
      if (!results.some((r) => r.dataset === d)) results.push({ dataset: d, status: 'UNCHECKABLE', reason });
    }
  }

  const orphaned = results.filter((r) => r.status === 'ORPHANED');
  const unchecked = results.filter((r) => r.status === 'UNCHECKABLE');

  if (supabase && runId) {
    await logComplete(supabase, runId, {
      items_found: results.length,
      items_new: results.filter((r) => r.status === 'OK').length,
      status: orphaned.length ? 'partial' : 'success',
      errors: orphaned.map((r) => `${r.dataset}: only ${(r.resolve_rate * 100).toFixed(1)}% of sampled edges resolve to ${r.source}`),
    }).catch(() => {});
  }

  if (jsonOut) {
    process.stdout.write(JSON.stringify({ sample: SAMPLE, minResolve: MIN_RESOLVE, results }, null, 2) + '\n');
  } else {
    log('');
    for (const r of orphaned) {
      log(`✗ ORPHANED ${r.dataset}: only ${(r.resolve_rate * 100).toFixed(1)}% of ${r.sampled.toLocaleString()} edges${r.exact ? '' : ' sampled'} resolve to ${r.source} (${(r.sampled - r.resolved).toLocaleString()} orphaned). The source table was almost certainly re-ingested with new keys. Delete WHERE dataset='${r.dataset}' and re-run that build phase.`);
    }
    if (unchecked.length) {
      log('');
      log(`• ${unchecked.length} dataset(s) NOT CHECKED — this is a coverage gap, not a pass:`);
      for (const r of unchecked) log(`    ${r.dataset}: ${r.reason}`);
    }
    if (!orphaned.length) log('✓ Every checkable dataset resolves.');
  }

  process.exit(orphaned.length ? 1 : 0);
}

main().catch(async (err) => { console.error(err); process.exit(2); });
