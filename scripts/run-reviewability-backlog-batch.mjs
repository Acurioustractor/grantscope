#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DOTENV_PATH = path.join(ROOT, '.env');

const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;
const SUPABASE_URL = readEnvFileValueEarly('SUPABASE_URL') || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function readEnvFileValue(key) {
  try {
    const text = fs.readFileSync(DOTENV_PATH, 'utf8');
    const line = text
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : null;
  } catch {
    return null;
  }
}

function readEnvFileValueEarly(key) {
  try {
    const text = fs.readFileSync(DOTENV_PATH, 'utf8');
    const line = text
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : null;
  } catch {
    return null;
  }
}

function resolveDatabaseUrl() {
  let databaseUrl = readEnvFileValue('DATABASE_URL') || process.env.DATABASE_URL || null;
  const supabaseUrl = readEnvFileValue('SUPABASE_URL') || process.env.SUPABASE_URL || null;

  if (databaseUrl && databaseUrl.includes('.pooler.supabase.com') && supabaseUrl) {
    try {
      const parsedSupabaseUrl = new URL(supabaseUrl);
      const projectRef = parsedSupabaseUrl.hostname.split('.')[0];
      const parsedDatabaseUrl = new URL(databaseUrl);
      parsedDatabaseUrl.hostname = `db.${projectRef}.supabase.co`;
      if (parsedDatabaseUrl.username.includes('.')) {
        parsedDatabaseUrl.username = parsedDatabaseUrl.username.split('.')[0];
      }
      databaseUrl = parsedDatabaseUrl.toString();
    } catch {
      return databaseUrl;
    }
  }

  return databaseUrl;
}

function getPsqlConnectionConfig() {
  const databaseUrl = resolveDatabaseUrl();
  const supabaseUrl = readEnvFileValue('SUPABASE_URL') || process.env.SUPABASE_URL || null;
  let fallbackHost = 'db.tednluwflfhxyucgwigh.supabase.co';
  if (supabaseUrl) {
    try {
      const parsedSupabaseUrl = new URL(supabaseUrl);
      const projectRef = parsedSupabaseUrl.hostname.split('.')[0];
      fallbackHost = `db.${projectRef}.supabase.co`;
    } catch {}
  }

  if (databaseUrl) {
    const url = new URL(databaseUrl);
    return {
      databaseUrl,
      host: process.env.PGHOST || url.hostname,
      port: process.env.PGPORT || url.port || '5432',
      user: process.env.PGUSER || decodeURIComponent(url.username),
      database: process.env.PGDATABASE || decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
  }

  return {
    databaseUrl: null,
    host: process.env.PGHOST || fallbackHost,
    port: process.env.PGPORT || '5432',
    user: process.env.PGUSER || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
  };
}

const PSQL_CONNECTION = getPsqlConnectionConfig();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const GRANTMAKER_TYPES = [
  'private_ancillary_fund',
  'public_ancillary_fund',
  'trust',
  'corporate_foundation',
  'grantmaker',
  'foundation',
];

const QUEUE_META = {
  'missing-verified-grants': {
    label: 'Missing verified grants',
    filter: `type IN (__COMPARABLE_TYPES__) AND board_roles > 0 AND verified_grants = 0`,
  },
  'missing-year-memory': {
    label: 'Missing year memory',
    filter: `type IN (__COMPARABLE_TYPES__) AND board_roles > 0 AND year_memory_count = 0`,
  },
  'missing-source-backed-memory': {
    label: 'Missing source-backed memory',
    filter: `type IN (__COMPARABLE_TYPES__) AND year_memory_count > 0 AND verified_source_backed_count = 0`,
  },
  'operator-exclusions': {
    label: 'Operator exclusions',
    filter: `(type IS NULL OR type NOT IN (__COMPARABLE_TYPES__)) AND board_roles > 0`,
  },
};

const QUEUE_ORDER = [
  'missing-verified-grants',
  'missing-year-memory',
  'missing-source-backed-memory',
  'operator-exclusions',
];

const BACKFILL_FOUNDATION_KEYS_BY_ID = {
  'b9e090e5-1672-48ff-815a-2a6314ebe033': 'ian-potter',
  '8f8704be-d6e8-40f3-b561-ac6630ce5b36': 'minderoo',
  '25b80b63-416e-4aaa-b470-2f8dc6fa835f': 'ecstra',
  '85f0de43-d004-4122-83a6-287eeecc4da9': 'rio-tinto',
  'f5c80d75-6a66-4a0c-aa41-d1f3aa791f21': 'macquarie',
};

const GRANT_BACKFILL_PIPELINES_BY_ID = {
  '3af6cf86-f10c-488f-941f-00ab7bbad7f8': {
    datasets: ['frrr_grants', 'frrr_grantees'],
    sourceUrl: 'https://frrr.org.au/',
    extractionMethod: 'official_grantee_surface_backfill',
    sourceMode: 'official_grantee_surface',
    confidence: 'verified',
  },
  '983f0037-da5f-43d4-b9ae-3ff8853d6727': {
    datasets: ['sunrise_project_grantees'],
    sourceUrl: 'https://sunriseproject.org/',
    extractionMethod: 'official_grantee_surface_backfill',
    sourceMode: 'official_grantee_surface',
    confidence: 'verified',
  },
  '77be5d6c-9e0b-4467-9300-e30e4ba480ee': {
    datasets: ['sidney_myer_fund_grantees'],
    sourceUrl: 'https://www.myerfoundation.org.au/',
    extractionMethod: 'official_grantee_surface_backfill',
    sourceMode: 'official_grantee_surface',
    confidence: 'verified',
  },
  '95e902b1-9883-40da-8806-e38d202d8cdf': {
    datasets: ['perpetual_foundation_grantees'],
    sourceUrl: 'https://www.perpetual.com.au/',
    extractionMethod: 'official_grantee_surface_backfill',
    sourceMode: 'official_grantee_surface',
    confidence: 'verified',
  },
  '3ef014f7-76ea-48e6-932a-7ec133cc5342': {
    datasets: ['vfff_grantees'],
    sourceUrl: 'https://reports.vfff.org.au/',
    extractionMethod: 'official_grantee_surface_backfill',
    sourceMode: 'official_grantee_surface',
    confidence: 'verified',
  },
  '4a6a3689-626b-4a26-b95c-ed67123cab36': {
    datasets: ['naccho_grantees'],
    sourceUrl: 'https://www.naccho.org.au/',
    extractionMethod: 'official_grantee_surface_backfill',
    sourceMode: 'official_grantee_surface',
    confidence: 'verified',
  },
  '686fc5c5-d211-441b-a424-020c7ee3fb1a': {
    datasets: ['lmcf_grantees'],
    sourceEntityId: 'e8ee3c7b-c9de-4db1-b575-214bf0df04c3',
    sourceUrl: 'https://www.lmcf.org.au/',
    extractionMethod: 'official_grantee_surface_backfill',
    sourceMode: 'official_grantee_surface',
    confidence: 'verified',
  },
};

const PROMOTION_SCRIPTS_BY_ID = {
  '4ee5baca-c898-4318-ae2b-d79b95379cc7': 'scripts/promote-prf-program-years-to-verified-sources.mjs',
  '8f8704be-d6e8-40f3-b561-ac6630ce5b36': 'scripts/promote-minderoo-program-years-to-verified-sources.mjs',
  'b9e090e5-1672-48ff-815a-2a6314ebe033': 'scripts/promote-ian-potter-program-years-to-verified-sources.mjs',
  '25b80b63-416e-4aaa-b470-2f8dc6fa835f': 'scripts/promote-ecstra-program-years-to-verified-sources.mjs',
  '85f0de43-d004-4122-83a6-287eeecc4da9': 'scripts/promote-rio-tinto-program-years-to-verified-sources.mjs',
};
const GENERIC_PROGRAM_URL_PROMOTION_SCRIPT = 'scripts/promote-foundation-program-years-from-program-urls.mjs';
const QUEUE_SCAN_MULTIPLIER = {
  'missing-verified-grants': 100,
  'missing-year-memory': 100,
  'missing-source-backed-memory': 5,
  'operator-exclusions': 1,
};

function getArgValue(prefix) {
  const arg = process.argv.find((entry) => entry.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const APPLY = process.argv.includes('--apply');
const QUEUE = getArgValue('--queue') || 'all';
const LIMIT = Number.parseInt(getArgValue('--limit') || '5', 10);
const FISCAL_YEAR = getArgValue('--fiscal-year');
const REPORT_YEAR = getArgValue('--report-year');
const VERBOSE = process.argv.includes('--verbose');

if (!Number.isFinite(LIMIT) || LIMIT <= 0) {
  console.error('Pass a positive integer to --limit=<n>');
  process.exit(1);
}

if (QUEUE !== 'all' && !QUEUE_META[QUEUE]) {
  console.error(`Unknown queue "${QUEUE}". Expected one of: all, ${QUEUE_ORDER.join(', ')}`);
  process.exit(1);
}

function formatType(type) {
  if (!type) return 'Unknown';
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getQueueOrderClause(queueKey) {
  if (queueKey === 'missing-verified-grants') {
    return `ORDER BY
              CASE
                WHEN raw_grant_edges > 0 AND raw_grant_datasets = 1 AND website IS NOT NULL THEN 1
                ELSE 0
              END DESC,
              current_program_count DESC,
              total_giving_annual DESC NULLS LAST`;
  }

  if (queueKey === 'missing-year-memory') {
    return `ORDER BY
              CASE
                WHEN current_program_count > 0 THEN 1
                ELSE 0
              END DESC,
              verified_grants DESC,
              total_giving_annual DESC NULLS LAST`;
  }

  if (queueKey === 'missing-source-backed-memory') {
    return `ORDER BY
              year_memory_count DESC,
              total_giving_annual DESC NULLS LAST`;
  }

  return 'ORDER BY total_giving_annual DESC NULLS LAST';
}

function buildBacklogQuery(queueKey, filter, limit) {
  const comparableTypes = GRANTMAKER_TYPES.map((type) => `'${type}'`).join(',');
  const orderClause = getQueueOrderClause(queueKey);
  return `WITH rel AS (
            SELECT r.source_entity_id, COUNT(*)::int AS relationship_grants
            FROM gs_relationships r
            WHERE r.relationship_type = 'grant'
              AND r.dataset = 'foundation_grantees'
            GROUP BY r.source_entity_id
          ),
          fg AS (
            SELECT foundation_id, COUNT(*)::int AS canonical_grants
            FROM foundation_grantees
            GROUP BY foundation_id
          ),
          board AS (
            SELECT
              COALESCE(NULLIF(company_abn, ''), company_name) AS foundation_key,
              COUNT(*)::int AS board_roles
            FROM person_roles
            WHERE cessation_date IS NULL
            GROUP BY COALESCE(NULLIF(company_abn, ''), company_name)
          ),
          programs AS (
            SELECT foundation_id, COUNT(*)::int AS current_program_count
            FROM foundation_programs
            WHERE status IN ('open', 'ongoing', 'closed')
            GROUP BY foundation_id
          ),
          raw_rel AS (
            SELECT
              source_entity_id,
              COUNT(*)::int AS raw_grant_edges,
              COUNT(DISTINCT dataset)::int AS raw_grant_datasets
            FROM gs_relationships
            WHERE relationship_type = 'grant'
              AND dataset <> 'foundation_grantees'
            GROUP BY source_entity_id
          ),
          yrs AS (
            SELECT
              foundation_id,
              COUNT(*)::int AS year_memory_count,
              COUNT(*) FILTER (
                WHERE COALESCE(metadata->>'source', '') NOT ILIKE '%inferred%'
              )::int AS verified_source_backed_count
            FROM foundation_program_years
            GROUP BY foundation_id
          ),
          candidate_rows AS (
            SELECT
              f.id,
              f.name,
              f.type,
              f.website,
              f.total_giving_annual,
              COALESCE(board.board_roles, 0) AS board_roles,
              GREATEST(
                COALESCE(fg.canonical_grants, 0),
                COALESCE(rel.relationship_grants, 0)
              ) AS verified_grants,
              COALESCE(raw_rel.raw_grant_edges, 0) AS raw_grant_edges,
              COALESCE(raw_rel.raw_grant_datasets, 0) AS raw_grant_datasets,
              COALESCE(programs.current_program_count, 0) AS current_program_count,
              COALESCE(yrs.year_memory_count, 0) AS year_memory_count,
              COALESCE(yrs.verified_source_backed_count, 0) AS verified_source_backed_count
            FROM foundations f
            LEFT JOIN rel ON rel.source_entity_id = f.gs_entity_id
            LEFT JOIN fg ON fg.foundation_id = f.id
            LEFT JOIN board ON board.foundation_key = COALESCE(NULLIF(f.acnc_abn, ''), f.name)
            LEFT JOIN programs ON programs.foundation_id = f.id
            LEFT JOIN raw_rel ON raw_rel.source_entity_id = f.gs_entity_id
            LEFT JOIN yrs ON yrs.foundation_id = f.id
            WHERE f.total_giving_annual IS NOT NULL
          )
          SELECT *
          FROM candidate_rows
          WHERE ${filter.replaceAll('__COMPARABLE_TYPES__', comparableTypes)}
          ${orderClause}
          LIMIT ${limit}`;
}

function getQueueScanLimit(queueKey) {
  const multiplier = QUEUE_SCAN_MULTIPLIER[queueKey] || 1;
  return Math.max(LIMIT, LIMIT * multiplier);
}

function execJsonQueryViaPsql(query) {
  if (!PSQL_CONNECTION.databaseUrl) {
    return { ok: false, error: 'DATABASE_URL unavailable for psql fallback.' };
  }

  const result = spawnSync(
    'psql',
    [PSQL_CONNECTION.databaseUrl, '-t', '-A', '-c', query],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: process.env,
      timeout: 120000,
    },
  );

  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || result.stdout || `psql exited with status ${result.status}`).trim(),
    };
  }

  return {
    ok: true,
    payload: String(result.stdout || '').trim(),
  };
}

async function fetchQueueRows(queueKey, limit) {
  const meta = QUEUE_META[queueKey];
  let currentLimit = limit;
  let lastError = null;

  while (currentLimit >= LIMIT) {
    const query = `
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)::text
      FROM (
        ${buildBacklogQuery(queueKey, meta.filter, currentLimit)}
      ) t
    `;
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (!error) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return { rows: [], scannedLimit: currentLimit };
      }

      const payload = String(data[0]?.coalesce ?? data[0]?.json_agg ?? '').trim();
      return {
        rows: payload ? JSON.parse(payload) : [],
        scannedLimit: currentLimit,
      };
    }

    lastError = error;
    const fallback = execJsonQueryViaPsql(query);
    if (fallback.ok) {
      return {
        rows: fallback.payload ? JSON.parse(fallback.payload) : [],
        scannedLimit: currentLimit,
      };
    }

    if (!isStatementTimeoutError(error) || currentLimit === LIMIT) {
      const err = new Error(
        `${error.message || `exec_sql failed for ${queueKey}`}${fallback.error ? ` | psql fallback failed: ${fallback.error}` : ''}`,
      );
      err.name = 'ExecSqlError';
      throw err;
    }

    currentLimit = Math.max(LIMIT, Math.floor(currentLimit / 2));
  }

  const err = new Error(lastError?.message || `exec_sql failed for ${queueKey}`);
  err.name = 'ExecSqlError';
  throw err;
}

function isStatementTimeoutError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('statement timeout') || message.includes('canceling statement due to statement timeout');
}

function extractJsonFromOutput(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // Fall through to line-based extraction for mixed log output.
  }

  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of [...lines].reverse()) {
    const match = line.match(/(\{.*\})$/);
    if (!match) continue;
    try {
      return JSON.parse(match[1]);
    } catch {
      continue;
    }
  }

  return null;
}

function runNodeScript(scriptPath, args) {
  const result = spawnSync(
    'node',
    ['--env-file=.env', scriptPath, ...args],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: process.env,
    },
  );

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    parsed: extractJsonFromOutput(result.stdout || ''),
  };
}

function buildSeedArgs(foundationId) {
  const args = [
    'scripts/seed-foundation-program-years-from-current-programs.mjs',
    `--foundation-id=${foundationId}`,
  ];
  if (!APPLY) args.push('--dry-run');
  if (FISCAL_YEAR) args.push(`--fiscal-year=${FISCAL_YEAR}`);
  if (REPORT_YEAR) args.push(`--report-year=${REPORT_YEAR}`);
  return args;
}

function buildBackfillArgs(foundationKey) {
  const args = [
    'scripts/backfill-foundation-grantees-from-relationships.mjs',
    `--foundation=${foundationKey}`,
  ];
  if (APPLY) args.push('--apply');
  if (VERBOSE) args.push('--verbose');
  return args;
}

function buildGenericBackfillArgs(pipeline, foundationId) {
  const args = [
    'scripts/backfill-foundation-grantees-from-relationships.mjs',
    `--foundation-id=${foundationId}`,
    `--dataset=${pipeline.datasets.join(',')}`,
    `--extraction-method=${pipeline.extractionMethod}`,
    `--confidence=${pipeline.confidence}`,
    `--source-mode=${pipeline.sourceMode}`,
  ];
  if (pipeline.sourceEntityId) args.push(`--source-entity-id=${pipeline.sourceEntityId}`);
  if (pipeline.sourceUrl) args.push(`--source-url=${pipeline.sourceUrl}`);
  if (APPLY) args.push('--apply');
  if (VERBOSE) args.push('--verbose');
  return args;
}

function buildScrapeArgs(scrapeKey) {
  const args = [
    'scripts/scrape-foundation-grantees-all.mjs',
    `--foundation=${scrapeKey}`,
  ];
  if (APPLY) args.push('--apply');
  if (VERBOSE) args.push('--verbose');
  return args;
}

function buildPromoteArgs(scriptPath) {
  const args = [scriptPath];
  if (!APPLY) args.push('--dry-run');
  return args;
}

function buildGenericPromoteArgs(foundationId) {
  const args = [GENERIC_PROGRAM_URL_PROMOTION_SCRIPT, `--foundation-id=${foundationId}`];
  if (!APPLY) args.push('--dry-run');
  return args;
}

function getSeedRowCount(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed.rows)) return parsed.rows.length;
  if (typeof parsed.upserted === 'number') return parsed.upserted;
  if (typeof parsed.inserted === 'number') return parsed.inserted;
  return null;
}

function getPromotionRowCount(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (typeof parsed.promoted_rows === 'number') return parsed.promoted_rows;
  return null;
}

function classifyGrantBackfillBlocker(row) {
  if (Number(row.raw_grant_edges || 0) > 0) {
    const datasetCount = Number(row.raw_grant_datasets || 0);
    return `Raw grant dataset exists (${row.raw_grant_edges} edges across ${datasetCount} dataset${datasetCount === 1 ? '' : 's'}), but no canonical backfill pipeline is configured yet.`;
  }

  return 'No raw grant dataset exists yet for canonical verified-grant backfill.';
}

function classifyYearMemoryBlocker(row) {
  if (Number(row.current_program_count || 0) > 0) {
    return `Current program rows exist (${row.current_program_count}), but none are seedable through the current public program surface path.`;
  }

  return 'No current public program surface was found to seed program-year memory.';
}

function buildDryRunAction(queueKey, row) {
  if (queueKey === 'missing-year-memory') {
    const args = buildSeedArgs(row.id);
    const supported = Number(row.current_program_count || 0) > 0;
    return {
      foundationId: row.id,
      foundationName: row.name,
      action: 'seed-program-years',
      queue: queueKey,
      supported,
      ok: supported,
      reason: supported
        ? 'Seedable current program rows are present.'
        : classifyYearMemoryBlocker(row),
      command: `node ${args.join(' ')}`,
    };
  }

  if (queueKey === 'missing-verified-grants') {
    const foundationKey = BACKFILL_FOUNDATION_KEYS_BY_ID[row.id];
    if (foundationKey) {
      const args = buildBackfillArgs(foundationKey);
      return {
        foundationId: row.id,
        foundationName: row.name,
        action: 'backfill-verified-grants',
        queue: queueKey,
        supported: true,
        ok: true,
        reason: 'Foundation-specific verified-grant backfill config exists.',
        command: `node ${args.join(' ')}`,
      };
    }

    const pipeline = GRANT_BACKFILL_PIPELINES_BY_ID[row.id];
    if (pipeline) {
      const backfillArgs = buildGenericBackfillArgs(pipeline, row.id);
      return {
        foundationId: row.id,
        foundationName: row.name,
        action: pipeline.scrapeKey ? 'scrape-and-backfill-verified-grants' : 'backfill-verified-grants',
        queue: queueKey,
        supported: true,
        ok: true,
        reason: pipeline.scrapeKey
          ? 'Scrape-backed verified-grant pipeline exists.'
          : 'Generic verified-grant backfill pipeline exists.',
        command: pipeline.scrapeKey
          ? `node ${buildScrapeArgs(pipeline.scrapeKey).join(' ')} && node ${backfillArgs.join(' ')}`
          : `node ${backfillArgs.join(' ')}`,
      };
    }

    const genericGrantOpportunityPipeline = getGenericGrantOpportunityPipeline(row);
    if (genericGrantOpportunityPipeline) {
      const backfillArgs = buildGenericBackfillArgs(genericGrantOpportunityPipeline, row.id);
      return {
        foundationId: row.id,
        foundationName: row.name,
        action: 'backfill-verified-grants',
        queue: queueKey,
        supported: true,
        ok: true,
        reason: 'Generic verified-grant backfill is possible from grant opportunity relationships.',
        command: `node ${backfillArgs.join(' ')}`,
      };
    }

    return {
      foundationId: row.id,
      foundationName: row.name,
      action: 'backfill-verified-grants',
      queue: queueKey,
      supported: false,
      ok: false,
      reason: classifyGrantBackfillBlocker(row),
      command: null,
    };
  }

  if (queueKey === 'missing-source-backed-memory') {
    const scriptPath = PROMOTION_SCRIPTS_BY_ID[row.id];
    const args = scriptPath ? buildPromoteArgs(scriptPath) : buildGenericPromoteArgs(row.id);
    return {
      foundationId: row.id,
      foundationName: row.name,
      action: 'promote-source-backed-memory',
      queue: queueKey,
      supported: true,
      ok: true,
      reason: scriptPath
        ? 'Foundation-specific source-promotion script exists.'
        : 'Generic program URL source-promotion path exists.',
      command: `node ${args.join(' ')}`,
    };
  }

  return {
    foundationId: row.id,
    foundationName: row.name,
    action: 'exclude-from-benchmark-lane',
    queue: queueKey,
    supported: true,
    ok: true,
    recommendation: 'Treat as operator/institutional context until a real grantmaker layer is verified.',
    command: null,
  };
}

function runQueueAction(queueKey, row) {
  if (!APPLY) {
    return buildDryRunAction(queueKey, row);
  }

  if (queueKey === 'missing-year-memory') {
    const args = buildSeedArgs(row.id);
    const result = runNodeScript(args[0], args.slice(1));
    const seedCount = getSeedRowCount(result.parsed);

    if (result.ok && seedCount === 0) {
      return {
        foundationId: row.id,
        foundationName: row.name,
        action: 'seed-program-years',
        queue: queueKey,
        supported: false,
        reason: 'No current public program surface was found to seed program-year memory.',
        command: `node ${args.join(' ')}`,
        output: result.parsed || { stdout: result.stdout.trim(), stderr: result.stderr.trim() },
      };
    }

    return {
      foundationId: row.id,
      foundationName: row.name,
      action: 'seed-program-years',
      queue: queueKey,
      supported: true,
      ok: result.ok,
      command: `node ${args.join(' ')}`,
      output: result.parsed || { stdout: result.stdout.trim(), stderr: result.stderr.trim() },
    };
  }

  if (queueKey === 'missing-verified-grants') {
    const foundationKey = BACKFILL_FOUNDATION_KEYS_BY_ID[row.id];
    if (!foundationKey) {
      const pipeline = GRANT_BACKFILL_PIPELINES_BY_ID[row.id];
      const resolvedPipeline = pipeline || getGenericGrantOpportunityPipeline(row);
      if (!resolvedPipeline) {
        return {
          foundationId: row.id,
          foundationName: row.name,
          action: 'backfill-verified-grants',
          queue: queueKey,
          supported: false,
          reason: 'No foundation-specific verified-grant backfill config exists yet.',
        };
      }

      let scrapeResult = null;
      if (resolvedPipeline.scrapeKey) {
        const scrapeArgs = buildScrapeArgs(resolvedPipeline.scrapeKey);
        scrapeResult = runNodeScript(scrapeArgs[0], scrapeArgs.slice(1));
        if (!scrapeResult.ok) {
          return {
            foundationId: row.id,
            foundationName: row.name,
            action: 'scrape-and-backfill-verified-grants',
            queue: queueKey,
            supported: true,
            ok: false,
            command: `node ${scrapeArgs.join(' ')}`,
            output: scrapeResult.parsed || { stdout: scrapeResult.stdout.trim(), stderr: scrapeResult.stderr.trim() },
          };
        }
      }

      const backfillArgs = buildGenericBackfillArgs(resolvedPipeline, row.id);
      const backfillResult = runNodeScript(backfillArgs[0], backfillArgs.slice(1));
      return {
        foundationId: row.id,
        foundationName: row.name,
        action: resolvedPipeline.scrapeKey ? 'scrape-and-backfill-verified-grants' : 'backfill-verified-grants',
        queue: queueKey,
        supported: true,
        ok: (scrapeResult?.ok ?? true) && backfillResult.ok,
        command: resolvedPipeline.scrapeKey
          ? `node ${buildScrapeArgs(resolvedPipeline.scrapeKey).join(' ')} && node ${backfillArgs.join(' ')}`
          : `node ${backfillArgs.join(' ')}`,
        output: resolvedPipeline.scrapeKey
          ? {
              scrape: scrapeResult?.parsed || { stdout: scrapeResult?.stdout?.trim() || '', stderr: scrapeResult?.stderr?.trim() || '' },
              backfill: backfillResult.parsed || { stdout: backfillResult.stdout.trim(), stderr: backfillResult.stderr.trim() },
            }
          : (backfillResult.parsed || { stdout: backfillResult.stdout.trim(), stderr: backfillResult.stderr.trim() }),
      };
    }

    const args = buildBackfillArgs(foundationKey);
    const result = runNodeScript(args[0], args.slice(1));
    return {
      foundationId: row.id,
      foundationName: row.name,
      action: 'backfill-verified-grants',
      queue: queueKey,
      supported: true,
      ok: result.ok,
      command: `node ${args.join(' ')}`,
      output: result.parsed || { stdout: result.stdout.trim(), stderr: result.stderr.trim() },
    };
  }

  if (queueKey === 'missing-source-backed-memory') {
    const scriptPath = PROMOTION_SCRIPTS_BY_ID[row.id];
    const args = scriptPath ? buildPromoteArgs(scriptPath) : buildGenericPromoteArgs(row.id);
    const result = runNodeScript(args[0], args.slice(1));
    const promotedCount = getPromotionRowCount(result.parsed);

    if (result.ok && promotedCount === 0) {
      return {
        foundationId: row.id,
        foundationName: row.name,
        action: 'promote-source-backed-memory',
        queue: queueKey,
        supported: false,
        reason: scriptPath
          ? 'The source-promotion script found no promotable program URLs.'
          : 'No promotable program URLs were found for the generic source-promotion path.',
        command: `node ${args.join(' ')}`,
        output: result.parsed || { stdout: result.stdout.trim(), stderr: result.stderr.trim() },
      };
    }

    return {
      foundationId: row.id,
      foundationName: row.name,
      action: 'promote-source-backed-memory',
      queue: queueKey,
      supported: true,
      ok: result.ok,
      command: `node ${args.join(' ')}`,
      output: result.parsed || { stdout: result.stdout.trim(), stderr: result.stderr.trim() },
    };
  }

  return {
    foundationId: row.id,
    foundationName: row.name,
    action: 'exclude-from-benchmark-lane',
    queue: queueKey,
    supported: true,
    ok: true,
    command: null,
    output: {
      recommendation: 'Treat as operator/institutional context until a real grantmaker layer is verified.',
      type: row.type,
    },
  };
}

function isSupportedQueueAction(queueKey, row) {
  if (queueKey === 'missing-verified-grants') {
    return Boolean(
      BACKFILL_FOUNDATION_KEYS_BY_ID[row.id]
      || GRANT_BACKFILL_PIPELINES_BY_ID[row.id]
      || getGenericGrantOpportunityPipeline(row)
    );
  }

  if (queueKey === 'missing-year-memory') {
    return Number(row.current_program_count || 0) > 0;
  }

  if (queueKey === 'missing-source-backed-memory') {
    return Boolean(PROMOTION_SCRIPTS_BY_ID[row.id]) || Number(row.year_memory_count || 0) > 0;
  }

  return true;
}

function getGenericGrantOpportunityPipeline(row) {
  if (Number(row.raw_grant_edges || 0) <= 0) return null;
  if (Number(row.raw_grant_datasets || 0) !== 1) return null;
  if (!row.website) return null;

  return {
    datasets: ['grant_opportunities'],
    sourceUrl: ensureUrl(row.website),
    extractionMethod: 'grant_opportunity_surface_backfill',
    sourceMode: 'official_grant_program_surface',
    confidence: 'verified',
  };
}

function ensureUrl(value) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

function prioritiseQueueRows(rows, results) {
  return rows
    .map((row, index) => ({ row, result: results[index] }))
    .sort((left, right) => {
      const leftSupported = left.result.supported ? 1 : 0;
      const rightSupported = right.result.supported ? 1 : 0;
      if (leftSupported !== rightSupported) return rightSupported - leftSupported;

      const leftOk = left.result.ok ? 1 : 0;
      const rightOk = right.result.ok ? 1 : 0;
      if (leftOk !== rightOk) return rightOk - leftOk;

      return (right.row.total_giving_annual || 0) - (left.row.total_giving_annual || 0);
    })
    .slice(0, LIMIT);
}

async function main() {
  const queueKeys = QUEUE === 'all' ? QUEUE_ORDER : [QUEUE];
  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    limit: LIMIT,
    queueCount: queueKeys.length,
    queues: [],
  };

  for (const queueKey of queueKeys) {
    const { rows: scannedRows, scannedLimit } = await fetchQueueRows(queueKey, getQueueScanLimit(queueKey));
    const scaffolds = scannedRows.map((row) => ({
      foundationId: row.id,
      foundationName: row.name,
      action: queueKey,
      queue: queueKey,
      supported: isSupportedQueueAction(queueKey, row),
      ok: null,
    }));
    const prioritised = prioritiseQueueRows(scannedRows, scaffolds);
    const rows = prioritised.map((entry) => entry.row);
    const results = rows.map((row) => runQueueAction(queueKey, row));

    summary.queues.push({
      queue: queueKey,
      label: QUEUE_META[queueKey].label,
      candidateCount: rows.length,
      scannedCount: scannedRows.length,
      scannedLimit,
      supportedCount: results.filter((result) => result.supported).length,
      okCount: results.filter((result) => result.supported && result.ok).length,
      unsupportedCount: results.filter((result) => !result.supported).length,
      candidates: rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        typeLabel: formatType(row.type),
        totalGivingAnnual: row.total_giving_annual,
        boardRoles: row.board_roles,
        verifiedGrants: row.verified_grants,
        rawGrantEdges: row.raw_grant_edges,
        rawGrantDatasets: row.raw_grant_datasets,
        currentProgramCount: row.current_program_count,
        yearMemoryCount: row.year_memory_count,
        verifiedSourceBackedCount: row.verified_source_backed_count,
      })),
      actions: results,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  if (error?.name === 'PsqlConnectionError' || error?.name === 'ExecSqlError') {
    console.error(
      JSON.stringify(
        {
          mode: APPLY ? 'apply' : 'dry-run',
          queue: QUEUE,
          blocked: true,
          reason: 'Database connection unavailable for reviewability backlog run.',
          connection: {
            host: PSQL_CONNECTION.host,
            port: PSQL_CONNECTION.port,
            database: PSQL_CONNECTION.database,
            user: PSQL_CONNECTION.user,
            rpcUrl: SUPABASE_URL,
          },
          error: String(error.message || error),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
