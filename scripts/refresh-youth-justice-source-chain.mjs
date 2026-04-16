#!/usr/bin/env node
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'refresh-youth-justice-trackers';
const AGENT_NAME = 'Refresh Youth Justice Source Chain';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[refresh-youth-justice-source-chain] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const STEPS = [
  {
    key: 'qld-hansard',
    label: 'Scrape QLD Hansard',
    command: ['node', '--env-file=.env', 'scripts/scrape-qld-hansard.mjs', '--days=7'],
  },
  {
    key: 'qld-contracts',
    label: 'Scrape QLD YJ contract disclosures',
    command: ['node', '--env-file=.env', 'scripts/scrape-qld-yj-contracts.mjs', '--live'],
  },
  {
    key: 'qgip',
    label: 'Scrape QGIP expenditure',
    command: ['node', '--env-file=.env', 'scripts/scrape-qgip-grants.mjs', '--live'],
  },
  {
    key: 'tracker-refresh',
    label: 'Refresh youth justice tracker portfolio',
    command: ['node', '--env-file=.env', 'scripts/run-tracker-refresh.mjs', '--domain=youth-justice', '--all-jurisdictions'],
  },
];

function runStep(step) {
  console.log(`\n[refresh-youth-justice-source-chain] ${step.label}`);
  console.log(`[refresh-youth-justice-source-chain] ${step.command.join(' ')}`);

  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${step.label} exited with status ${result.status}`);
  }
}

async function fetchSummary() {
  const query = `
    SELECT
      COUNT(DISTINCT tracker_key)::int AS tracker_count,
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_rows,
      COUNT(*) FILTER (
        WHERE mirror_status IN ('missing_from_mirror', 'external_only')
      )::int AS gap_rows
    FROM tracker_evidence_events
    WHERE domain = 'youth-justice'
  `;

  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) {
    throw new Error(`Summary query failed: ${error.message}`);
  }
  return data?.[0] || {
    tracker_count: 0,
    total_rows: 0,
    mirrored_rows: 0,
    gap_rows: 0,
  };
}

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  try {
    for (const step of STEPS) {
      if (step.key === 'tracker-refresh' && run.id) {
        runStep({
          ...step,
          command: [...step.command, `--run-id=${run.id}`],
        });
        continue;
      }
      runStep(step);
    }

    const summary = await fetchSummary();
    console.log(
      `\n[refresh-youth-justice-source-chain] complete: trackers=${summary.tracker_count} rows=${summary.total_rows} mirrored=${summary.mirrored_rows} gaps=${summary.gap_rows}`,
    );

    await logComplete(db, run.id, {
      items_found: Number(summary.total_rows || 0),
      items_new: Number(summary.mirrored_rows || 0),
      items_updated: Number(summary.gap_rows || 0),
    });
  } catch (error) {
    await logFailed(db, run.id, error instanceof Error ? error.message : String(error));
    console.error('[refresh-youth-justice-source-chain] failed:', error);
    process.exit(1);
  }
}

main();
