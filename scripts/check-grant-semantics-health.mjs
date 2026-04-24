#!/usr/bin/env node

/**
 * Check Grant Semantics Health
 *
 * Verifies that grant lifecycle semantics are not drifting back into debt.
 *
 * Usage:
 *   node --env-file=.env scripts/check-grant-semantics-health.mjs
 *   node --env-file=.env scripts/check-grant-semantics-health.mjs --max-status-null=0 --max-application-status-null=0 --max-open-past-deadline=0
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'check-grant-semantics-health';
const AGENT_NAME = 'Check Grant Semantics Health';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseIntFlag(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = Number.parseInt(arg.split('=')[1], 10);
  return Number.isFinite(value) ? value : fallback;
}

const MAX_STATUS_NULL = parseIntFlag('max-status-null', 0);
const MAX_APPLICATION_STATUS_NULL = parseIntFlag('max-application-status-null', 0);
const MAX_OPEN_PAST_DEADLINE = parseIntFlag('max-open-past-deadline', 0);

async function execSql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

function canonicalSourceSql() {
  return `COALESCE(
    NULLIF(discovery_method, ''),
    CASE
      WHEN source = 'foundation_program' THEN NULL
      WHEN COALESCE(source_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN NULL
      ELSE NULLIF(source_id, '')
    END,
    source,
    'unknown'
  )`;
}

async function loadHealth() {
  const canonicalSource = canonicalSourceSql();
  const [summaryRows, sourceRows] = await Promise.all([
    execSql(`
      SELECT
        COUNT(*) FILTER (WHERE status IS NULL) AS status_null_total,
        COUNT(*) FILTER (WHERE application_status IS NULL) AS application_status_null_total,
        COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE) AS open_past_deadline_total,
        COUNT(*) FILTER (WHERE source = 'ghl_sync' AND status = 'unknown') AS ghl_sync_unknown_total,
        COUNT(*) AS total_grants
      FROM grant_opportunities
    `),
    execSql(`
      SELECT
        ${canonicalSource} AS source,
        COUNT(*) FILTER (WHERE status IS NULL) AS status_null,
        COUNT(*) FILTER (WHERE application_status IS NULL) AS application_status_null,
        COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE) AS open_past_deadline,
        (
          COUNT(*) FILTER (WHERE status IS NULL)
          + COUNT(*) FILTER (WHERE application_status IS NULL)
          + COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE)
        ) AS total_issues
      FROM grant_opportunities
      GROUP BY ${canonicalSource}
      HAVING (
        COUNT(*) FILTER (WHERE status IS NULL)
        + COUNT(*) FILTER (WHERE application_status IS NULL)
        + COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE)
      ) > 0
      ORDER BY total_issues DESC, source ASC
      LIMIT 10
    `),
  ]);

  return {
    summary: summaryRows[0] || {},
    topSources: sourceRows,
  };
}

function printHealth(summary, topSources) {
  console.log('[grant-semantics-health] Summary');
  console.log(`  total_grants=${Number(summary.total_grants || 0)}`);
  console.log(`  status_null_total=${Number(summary.status_null_total || 0)} (max=${MAX_STATUS_NULL})`);
  console.log(`  application_status_null_total=${Number(summary.application_status_null_total || 0)} (max=${MAX_APPLICATION_STATUS_NULL})`);
  console.log(`  open_past_deadline_total=${Number(summary.open_past_deadline_total || 0)} (max=${MAX_OPEN_PAST_DEADLINE})`);
  console.log(`  ghl_sync_unknown_total=${Number(summary.ghl_sync_unknown_total || 0)} (informational)`);

  if (topSources.length === 0) {
    console.log('[grant-semantics-health] Top issue sources: none');
    return;
  }

  console.log('[grant-semantics-health] Top issue sources:');
  for (const row of topSources) {
    console.log(
      `  ${row.source}: total=${Number(row.total_issues || 0)}, status_null=${Number(row.status_null || 0)}, application_status_null=${Number(row.application_status_null || 0)}, open_past_deadline=${Number(row.open_past_deadline || 0)}`
    );
  }
}

function findViolations(summary) {
  const violations = [];

  if (Number(summary.status_null_total || 0) > MAX_STATUS_NULL) {
    violations.push(`status_null_total=${summary.status_null_total} exceeds max ${MAX_STATUS_NULL}`);
  }

  if (Number(summary.application_status_null_total || 0) > MAX_APPLICATION_STATUS_NULL) {
    violations.push(`application_status_null_total=${summary.application_status_null_total} exceeds max ${MAX_APPLICATION_STATUS_NULL}`);
  }

  if (Number(summary.open_past_deadline_total || 0) > MAX_OPEN_PAST_DEADLINE) {
    violations.push(`open_past_deadline_total=${summary.open_past_deadline_total} exceeds max ${MAX_OPEN_PAST_DEADLINE}`);
  }

  return violations;
}

async function main() {
  const run = await logStart(supabase, AGENT_ID, AGENT_NAME);

  try {
    const { summary, topSources } = await loadHealth();
    const violations = findViolations(summary);

    printHealth(summary, topSources);

    await logComplete(supabase, run.id, {
      items_found:
        Number(summary.status_null_total || 0)
        + Number(summary.application_status_null_total || 0)
        + Number(summary.open_past_deadline_total || 0),
      items_updated: 0,
      status: violations.length > 0 ? 'partial' : 'success',
      errors: violations,
    });

    if (violations.length > 0) {
      console.error('[grant-semantics-health] FAILED');
      for (const violation of violations) {
        console.error(`  ${violation}`);
      }
      process.exit(1);
    }

    console.log('[grant-semantics-health] OK');
  } catch (error) {
    await logFailed(supabase, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error('[grant-semantics-health] Fatal:', error.message || error);
  process.exit(1);
});
