#!/usr/bin/env node

/**
 * Check Grant Source Identity Health
 *
 * Verifies that grant-engine rows keep canonical source identity.
 *
 * Usage:
 *   node --env-file=.env scripts/check-grant-source-identity-health.mjs
 *   node --env-file=.env scripts/check-grant-source-identity-health.mjs --max-blank-source-id=0 --max-canonical-mismatch=0
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'check-grant-source-identity-health';
const AGENT_NAME = 'Check Grant Source Identity Health';

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

const MAX_BLANK_SOURCE_ID = parseIntFlag('max-blank-source-id', 0);
const MAX_CANONICAL_MISMATCH = parseIntFlag('max-canonical-mismatch', 0);

async function execSql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

async function loadHealth() {
  const [summaryRows, sourceRows] = await Promise.all([
    execSql(`
      SELECT
        COUNT(*) FILTER (
          WHERE discovered_by = 'grant_engine'
            AND COALESCE(discovery_method, '') <> ''
            AND COALESCE(source_id, '') = ''
        ) AS blank_source_id_total,
        COUNT(*) FILTER (
          WHERE discovered_by = 'grant_engine'
            AND COALESCE(discovery_method, '') <> ''
            AND COALESCE(source_id, '') <> ''
            AND source_id NOT LIKE '%::duplicate::%'
            AND source_id <> discovery_method
        ) AS canonical_mismatch_total,
        COUNT(*) FILTER (
          WHERE discovered_by = 'grant_engine'
            AND source_id LIKE '%::duplicate::%'
            AND status = 'duplicate'
        ) AS duplicate_shadow_total,
        COUNT(*) FILTER (WHERE discovered_by = 'grant_engine') AS total_grant_engine_rows
      FROM grant_opportunities
    `),
    execSql(`
      SELECT
        discovery_method AS source,
        COUNT(*) FILTER (WHERE COALESCE(source_id, '') = '') AS blank_source_id,
        COUNT(*) FILTER (
          WHERE COALESCE(source_id, '') <> ''
            AND source_id NOT LIKE '%::duplicate::%'
            AND source_id <> discovery_method
        ) AS canonical_mismatch,
        (
          COUNT(*) FILTER (WHERE COALESCE(source_id, '') = '')
          + COUNT(*) FILTER (
            WHERE COALESCE(source_id, '') <> ''
              AND source_id NOT LIKE '%::duplicate::%'
              AND source_id <> discovery_method
          )
        ) AS total_issues
      FROM grant_opportunities
      WHERE discovered_by = 'grant_engine'
        AND COALESCE(discovery_method, '') <> ''
      GROUP BY discovery_method
      HAVING (
        COUNT(*) FILTER (WHERE COALESCE(source_id, '') = '')
        + COUNT(*) FILTER (
          WHERE COALESCE(source_id, '') <> ''
            AND source_id NOT LIKE '%::duplicate::%'
            AND source_id <> discovery_method
        )
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
  console.log('[grant-source-identity-health] Summary');
  console.log(`  total_grant_engine_rows=${Number(summary.total_grant_engine_rows || 0)}`);
  console.log(`  blank_source_id_total=${Number(summary.blank_source_id_total || 0)} (max=${MAX_BLANK_SOURCE_ID})`);
  console.log(`  canonical_mismatch_total=${Number(summary.canonical_mismatch_total || 0)} (max=${MAX_CANONICAL_MISMATCH})`);
  console.log(`  duplicate_shadow_total=${Number(summary.duplicate_shadow_total || 0)} (informational)`);

  if (topSources.length === 0) {
    console.log('[grant-source-identity-health] Top issue sources: none');
    return;
  }

  console.log('[grant-source-identity-health] Top issue sources:');
  for (const row of topSources) {
    console.log(
      `  ${row.source}: total=${Number(row.total_issues || 0)}, blank_source_id=${Number(row.blank_source_id || 0)}, canonical_mismatch=${Number(row.canonical_mismatch || 0)}`
    );
  }
}

function findViolations(summary) {
  const violations = [];

  if (Number(summary.blank_source_id_total || 0) > MAX_BLANK_SOURCE_ID) {
    violations.push(`blank_source_id_total=${summary.blank_source_id_total} exceeds max ${MAX_BLANK_SOURCE_ID}`);
  }

  if (Number(summary.canonical_mismatch_total || 0) > MAX_CANONICAL_MISMATCH) {
    violations.push(`canonical_mismatch_total=${summary.canonical_mismatch_total} exceeds max ${MAX_CANONICAL_MISMATCH}`);
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
        Number(summary.blank_source_id_total || 0)
        + Number(summary.canonical_mismatch_total || 0),
      items_updated: 0,
      status: violations.length > 0 ? 'partial' : 'success',
      errors: violations,
    });

    if (violations.length > 0) {
      console.error('[grant-source-identity-health] FAILED');
      for (const violation of violations) {
        console.error(`  ${violation}`);
      }
      process.exit(1);
    }

    console.log('[grant-source-identity-health] OK');
  } catch (error) {
    await logFailed(supabase, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error('[grant-source-identity-health] Fatal:', error.message || error);
  process.exit(1);
});
