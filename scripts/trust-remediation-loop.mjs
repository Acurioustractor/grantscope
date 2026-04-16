#!/usr/bin/env node

/**
 * trust-remediation-loop.mjs
 *
 * Runs a practical trust reset loop:
 * 1) Backfill gs_relationships.source_url provenance
 * 2) Optionally run grants/foundations remediation scripts in bounded limits
 *
 * Usage:
 *   node --env-file=.env scripts/trust-remediation-loop.mjs
 *   node --env-file=.env scripts/trust-remediation-loop.mjs --dry-run
 *   node --env-file=.env scripts/trust-remediation-loop.mjs --run-enrichment --provider=minimax --grants-limit=200 --foundations-limit=120
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.DATABASE_PASSWORD;

const DRY_RUN = process.argv.includes('--dry-run');
const RUN_ENRICHMENT = process.argv.includes('--run-enrichment');
const PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] || 'minimax';
const GRANTS_LIMIT = Number.parseInt(process.argv.find(a => a.startsWith('--grants-limit='))?.split('=')[1] || '200', 10);
const FOUNDATIONS_LIMIT = Number.parseInt(process.argv.find(a => a.startsWith('--foundations-limit='))?.split('=')[1] || '120', 10);
const BATCH_SIZE = Math.max(1000, Number.parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '20000', 10));
const MAX_BATCHES_PER_DATASET = Math.max(1, Number.parseInt(process.argv.find(a => a.startsWith('--max-batches='))?.split('=')[1] || '3', 10));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[trust-remediation-loop] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[trust-remediation-loop] ${msg}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(label, fn, attempts = 3, baseDelayMs = 1500) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        log(`${label} failed (attempt ${attempt}/${attempts}) — retrying...`);
        await delay(baseDelayMs * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function selectOne(query) {
  return withRetry('selectOne', async () => {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) throw new Error(error.message);
    return data?.[0] ?? {};
  });
}

async function datasetMissingCounts(limit = 20) {
  return withRetry('datasetMissingCounts', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT dataset, COUNT(*)::bigint AS missing
        FROM gs_relationships
        WHERE source_url IS NULL OR btrim(source_url) = ''
        GROUP BY dataset
        ORDER BY missing DESC
        LIMIT ${limit}
      `,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
}

function runPsql(query) {
  if (DRY_RUN) return '';
  if (!DB_PASSWORD) throw new Error('DATABASE_PASSWORD is required for update queries');

  const args = [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com',
    '-p', '5432',
    '-U', 'postgres.tednluwflfhxyucgwigh',
    '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-c', query,
  ];

  const result = spawnSync('psql', args, {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    encoding: 'utf8',
    timeout: 1_800_000,
  });

  if (result.status !== 0) {
    const errMessage = result.error?.message || result.stderr || result.stdout || `psql exit ${result.status}`;
    throw new Error(String(errMessage).trim());
  }

  return result.stdout || '';
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseUpdatedRows(psqlOutput) {
  const matches = String(psqlOutput || '').match(/UPDATE\s+(\d+)/i);
  return matches ? Number.parseInt(matches[1], 10) : 0;
}

function runBatchedUpdate(label, buildQuery) {
  let totalUpdated = 0;

  for (let batch = 1; batch <= MAX_BATCHES_PER_DATASET; batch += 1) {
    const out = runPsql(buildQuery(BATCH_SIZE));
    const updated = parseUpdatedRows(out);
    totalUpdated += updated;

    if (updated === 0) {
      log(`${label}: complete (${totalUpdated} rows updated)`);
      return { updated: totalUpdated, complete: true };
    }
  }

  log(`${label}: paused after ${MAX_BATCHES_PER_DATASET} batches (${totalUpdated} rows updated this run)`);
  return { updated: totalUpdated, complete: false };
}

function runNode(scriptPath, args = [], timeoutMs = 300000) {
  if (DRY_RUN) {
    log(`[dry-run] node --env-file=.env ${scriptPath} ${args.join(' ')}`);
    return { ok: true };
  }

  const result = spawnSync('node', ['--env-file=.env', scriptPath, ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: process.env,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || result.stdout || '').trim();
    return { ok: false, error: stderr || `exit ${result.status}` };
  }
  return { ok: true };
}

async function snapshotQuality() {
  const [rel, grants, foundations] = await Promise.all([
    selectOne(`
      SELECT
        COUNT(*)::bigint AS rel_total,
        COUNT(*) FILTER (WHERE source_url IS NULL OR btrim(source_url) = '')::bigint AS rel_missing_source_url
      FROM gs_relationships
    `),
    selectOne(`
      SELECT
        COUNT(*)::bigint AS grants_total,
        COUNT(*) FILTER (WHERE deadline IS NULL)::bigint AS grants_missing_deadline,
        COUNT(*) FILTER (WHERE amount_min IS NULL AND amount_max IS NULL)::bigint AS grants_missing_amount,
        COUNT(*) FILTER (WHERE last_verified_at IS NULL)::bigint AS grants_missing_verified
      FROM grant_opportunities
    `),
    selectOne(`
      SELECT
        COUNT(*)::bigint AS foundations_total,
        COUNT(*) FILTER (WHERE profile_confidence = 'low')::bigint AS foundations_low_confidence,
        COUNT(*) FILTER (
          WHERE open_programs IS NULL
            OR (jsonb_typeof(open_programs) = 'array' AND jsonb_array_length(open_programs) = 0)
            OR open_programs = '[]'::jsonb
        )::bigint AS foundations_no_open_programs,
        COUNT(*) FILTER (WHERE description IS NULL OR btrim(description) = '')::bigint AS foundations_missing_description
      FROM foundations
    `),
  ]);

  return { rel, grants, foundations };
}

async function runProvenanceBackfill() {
  if (DRY_RUN) {
    log('[dry-run] provenance backfill SQL updates skipped');
    return;
  }

  const defaultSourceMap = [
    ['austender', 'https://www.tenders.gov.au/'],
    ['aec_donations', 'https://transparency.aec.gov.au/'],
    ['acnc_register', 'https://www.acnc.gov.au/charity/charities'],
    ['acnc', 'https://www.acnc.gov.au/charity/charities'],
    ['nhmrc_grants', 'https://www.nhmrc.gov.au/funding/find-funding-data'],
    ['arc_grants', 'https://dataportal.arc.gov.au/NCGP/Web/Grant/Grants'],
    ['creative_australia', 'https://creative.gov.au/funding/'],
    ['qld_arts_grants', 'https://www.arts.qld.gov.au/funding'],
    ['lotterywest_grants', 'https://www.lotterywest.wa.gov.au/grants'],
    ['frrr_grants', 'https://frrr.org.au/funding/'],
    ['hms_trust_grants', 'https://hmstrust.org.au/'],
    ['foundation_board', 'https://www.acnc.gov.au/charity/charities'],
    ['person_roles', 'https://www.acnc.gov.au/charity/charities'],
    ['person_roles_crossmatch', 'https://www.acnc.gov.au/charity/charities'],
    ['foundation_charity_match', 'https://www.acnc.gov.au/charity/charities'],
    ['abr_corporate_groups', 'https://abr.business.gov.au/'],
  ];

  // Prefer exact per-record URLs where source_record_id can be resolved.
  runBatchedUpdate('join-backfill: justice_funding', (batchSize) => `
    WITH chunk AS (
      SELECT gr.ctid, jf.source_url
      FROM gs_relationships gr
      JOIN justice_funding jf ON gr.source_record_id = jf.id::text
      WHERE gr.dataset = 'justice_funding'
        AND (gr.source_url IS NULL OR btrim(gr.source_url) = '')
        AND jf.source_url IS NOT NULL
        AND btrim(jf.source_url) <> ''
      LIMIT ${batchSize}
    )
    UPDATE gs_relationships gr
    SET source_url = chunk.source_url
    FROM chunk
    WHERE gr.ctid = chunk.ctid;
  `);

  runBatchedUpdate('join-backfill: grant_opportunities', (batchSize) => `
    WITH chunk AS (
      SELECT gr.ctid, go.url AS source_url
      FROM gs_relationships gr
      JOIN grant_opportunities go ON gr.source_record_id = go.id::text
      WHERE gr.dataset = 'grant_opportunities'
        AND (gr.source_url IS NULL OR btrim(gr.source_url) = '')
        AND go.url IS NOT NULL
        AND btrim(go.url) <> ''
      LIMIT ${batchSize}
    )
    UPDATE gs_relationships gr
    SET source_url = chunk.source_url
    FROM chunk
    WHERE gr.ctid = chunk.ctid;
  `);

  runBatchedUpdate('join-backfill: austender', (batchSize) => `
    WITH chunk AS (
      SELECT gr.ctid, ac.source_url
      FROM gs_relationships gr
      JOIN austender_contracts ac ON gr.source_record_id = ac.id::text
      WHERE gr.dataset = 'austender'
        AND (gr.source_url IS NULL OR btrim(gr.source_url) = '')
        AND ac.source_url IS NOT NULL
        AND btrim(ac.source_url) <> ''
      LIMIT ${batchSize}
    )
    UPDATE gs_relationships gr
    SET source_url = chunk.source_url
    FROM chunk
    WHERE gr.ctid = chunk.ctid;
  `);

  for (const [dataset, sourceUrl] of defaultSourceMap) {
    const datasetSql = sqlString(dataset);
    const sourceUrlSql = sqlString(sourceUrl);
    const result = runBatchedUpdate(`dataset-backfill: ${dataset}`, (batchSize) => `
        WITH chunk AS (
          SELECT ctid
          FROM gs_relationships
          WHERE dataset = ${datasetSql}
            AND (source_url IS NULL OR btrim(source_url) = '')
          LIMIT ${batchSize}
        )
        UPDATE gs_relationships gr
        SET source_url = ${sourceUrlSql}
        FROM chunk
        WHERE gr.ctid = chunk.ctid;
      `);
    void result;
  }
}

async function runEnrichmentPhase() {
  const results = [];
  const steps = [
    {
      label: 'scrape-grant-deadlines',
      script: 'scripts/scrape-grant-deadlines.mjs',
      args: ['--apply', `--limit=${GRANTS_LIMIT}`, `--provider=${PROVIDER}`],
      timeout: 900000,
    },
    {
      label: 'sync-foundation-programs',
      script: 'scripts/sync-foundation-programs.mjs',
      args: ['--cleanup-invalid'],
      timeout: 600000,
    },
    {
      label: 'enrich-foundations',
      script: 'scripts/enrich-foundations.mjs',
      args: [`--limit=${FOUNDATIONS_LIMIT}`, `--provider=${PROVIDER}`],
      timeout: 2400000,
    },
    {
      label: 'reprofile-missing-descriptions',
      script: 'scripts/reprofile-missing-descriptions.mjs',
      args: [`--limit=${Math.max(10, Math.floor(FOUNDATIONS_LIMIT / 2))}`],
      timeout: 900000,
    },
    {
      label: 'reprofile-low-confidence',
      script: 'scripts/reprofile-low-confidence.mjs',
      args: [`--limit=${Math.max(10, Math.floor(FOUNDATIONS_LIMIT / 2))}`],
      timeout: 900000,
    },
  ];

  for (const step of steps) {
    log(`Running ${step.label}...`);
    const out = runNode(step.script, step.args, step.timeout);
    if (!out.ok) {
      log(`Step failed: ${step.label} :: ${out.error}`);
      results.push({ step: step.label, status: 'failed', error: out.error });
      continue;
    }
    results.push({ step: step.label, status: 'success' });
  }

  return results;
}

function formatPct(part, total) {
  if (!total) return '0.0%';
  return `${((Number(part) / Number(total)) * 100).toFixed(1)}%`;
}

async function main() {
  const run = await logStart(supabase, 'trust-remediation-loop', 'Trust Remediation Loop');
  const enrichmentResults = [];

  try {
    const before = await snapshotQuality();
    const beforeDatasets = await datasetMissingCounts(15);

    log(`Before: missing source_url = ${before.rel.rel_missing_source_url}/${before.rel.rel_total} (${formatPct(before.rel.rel_missing_source_url, before.rel.rel_total)})`);

    await runProvenanceBackfill();

    if (RUN_ENRICHMENT) {
      enrichmentResults.push(...await runEnrichmentPhase());
    } else {
      log('Skipping enrichment phase (use --run-enrichment to enable).');
    }

    const after = await snapshotQuality();
    const afterDatasets = await datasetMissingCounts(15);

    const provenanceDelta = Number(before.rel.rel_missing_source_url) - Number(after.rel.rel_missing_source_url);
    const itemsUpdated = Math.max(0, provenanceDelta);

    log(`After: missing source_url = ${after.rel.rel_missing_source_url}/${after.rel.rel_total} (${formatPct(after.rel.rel_missing_source_url, after.rel.rel_total)})`);
    log(`Provenance updates applied: ${itemsUpdated}`);

    const summary = {
      before,
      after,
      topMissingDatasetsBefore: beforeDatasets,
      topMissingDatasetsAfter: afterDatasets,
      enrichmentResults,
      dryRun: DRY_RUN,
      runEnrichment: RUN_ENRICHMENT,
      provider: PROVIDER,
    };

    console.log(JSON.stringify(summary, null, 2));

    await logComplete(supabase, run.id, {
      items_found: Number(before.rel.rel_missing_source_url),
      items_new: 0,
      items_updated: itemsUpdated,
      status: 'success',
      errors: enrichmentResults.filter(step => step.status === 'failed').map(step => step.error || 'unknown error'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Failed: ${message}`);
    await logFailed(supabase, run.id, message);
    process.exit(1);
  }
}

main();
