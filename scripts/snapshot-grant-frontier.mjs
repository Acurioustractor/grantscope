#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'snapshot-grant-frontier';
const AGENT_NAME = 'Snapshot Grant Frontier';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[snapshot-grant-frontier] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function scoreGroup(row) {
  return (
    Number(row.due_now || 0) * 3 +
    Number(row.failing || 0) * 10 +
    Number(row.changed_recent || 0) * 6 +
    Math.ceil(Number(row.never_succeeded || 0) / 50) +
    Math.ceil(Number(row.frontier_rows || 0) / 250) +
    Math.ceil(Number(row.future_deadline_rows || 0) / 100)
  );
}

async function fetchCurrentGroups() {
  const query = `
    WITH frontier AS (
      SELECT
        COALESCE(NULLIF(discovery_source, ''), source_kind) AS source_group,
        COUNT(*)::int AS frontier_rows,
        COUNT(*) FILTER (WHERE enabled = true AND next_check_at <= NOW())::int AS due_now,
        COUNT(*) FILTER (WHERE last_success_at IS NOT NULL)::int AS ever_succeeded,
        COUNT(*) FILTER (WHERE last_success_at IS NULL)::int AS never_succeeded,
        COUNT(*) FILTER (WHERE failure_count > 0)::int AS failing,
        COUNT(*) FILTER (
          WHERE last_changed_at >= NOW() - INTERVAL '7 days'
        )::int AS changed_recent,
        MAX(last_success_at)::text AS latest_success_at,
        MAX(last_changed_at)::text AS latest_change_at
      FROM source_frontier
      GROUP BY 1
    ),
    grants AS (
      SELECT
        COALESCE(NULLIF(source, ''), 'unknown') AS source_group,
        COUNT(*)::int AS grant_rows,
        COUNT(*) FILTER (WHERE COALESCE(deadline, closes_at) >= CURRENT_DATE)::int AS future_deadline_rows
      FROM grant_opportunities
      GROUP BY 1
    )
    SELECT
      frontier.source_group,
      frontier.frontier_rows,
      frontier.due_now,
      frontier.ever_succeeded,
      frontier.never_succeeded,
      frontier.failing,
      frontier.changed_recent,
      COALESCE(grants.grant_rows, 0)::int AS grant_rows,
      COALESCE(grants.future_deadline_rows, 0)::int AS future_deadline_rows,
      frontier.latest_success_at,
      frontier.latest_change_at
    FROM frontier
    LEFT JOIN grants
      ON grants.source_group = frontier.source_group
    ORDER BY frontier.source_group
  `;

  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) {
    throw new Error(`Current grant frontier query failed: ${error.message}`);
  }
  return data || [];
}

async function fetchPreviousSnapshots() {
  const query = `
    SELECT DISTINCT ON (source_group)
      source_group,
      frontier_rows,
      due_now,
      failing,
      changed_recent,
      grant_rows,
      hot_score
    FROM grant_frontier_source_snapshots
    ORDER BY source_group, created_at DESC
  `;

  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) {
    throw new Error(`Previous grant frontier snapshot query failed: ${error.message}`);
  }
  return data || [];
}

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    const [groups, previousSnapshots] = await Promise.all([
      fetchCurrentGroups(),
      fetchPreviousSnapshots(),
    ]);

    const previousByGroup = new Map(
      previousSnapshots.map((row) => [row.source_group, row]),
    );

    const snapshotRows = groups.map((row) => {
      const previous = previousByGroup.get(row.source_group);
      const hotScore = scoreGroup(row);
      return {
        run_id: run.id,
        source_group: row.source_group,
        frontier_rows: Number(row.frontier_rows || 0),
        due_now: Number(row.due_now || 0),
        ever_succeeded: Number(row.ever_succeeded || 0),
        never_succeeded: Number(row.never_succeeded || 0),
        failing: Number(row.failing || 0),
        changed_recent: Number(row.changed_recent || 0),
        grant_rows: Number(row.grant_rows || 0),
        future_deadline_rows: Number(row.future_deadline_rows || 0),
        hot_score: hotScore,
        hot_delta: hotScore - Number(previous?.hot_score || 0),
        due_delta: Number(row.due_now || 0) - Number(previous?.due_now || 0),
        failure_delta: Number(row.failing || 0) - Number(previous?.failing || 0),
        changed_delta: Number(row.changed_recent || 0) - Number(previous?.changed_recent || 0),
        grant_delta: Number(row.grant_rows || 0) - Number(previous?.grant_rows || 0),
        has_previous_snapshot: Boolean(previous),
        latest_success_at: row.latest_success_at || null,
        latest_change_at: row.latest_change_at || null,
      };
    });

    if (snapshotRows.length > 0) {
      const { error: insertError } = await db.from('grant_frontier_source_snapshots').insert(snapshotRows);
      if (insertError) {
        throw new Error(`Grant frontier snapshot insert failed: ${insertError.message}`);
      }
    }

    const changedGroups = snapshotRows
      .filter((row) => row.has_previous_snapshot && (row.hot_delta !== 0 || row.due_delta !== 0 || row.failure_delta !== 0 || row.changed_delta !== 0 || row.grant_delta !== 0))
      .sort((a, b) => Math.abs(b.hot_delta) - Math.abs(a.hot_delta) || b.failure_delta - a.failure_delta || b.changed_delta - a.changed_delta)
      .slice(0, 10);
    const baselineGroups = snapshotRows
      .filter((row) => !row.has_previous_snapshot)
      .sort((a, b) => b.hot_score - a.hot_score)
      .slice(0, 8);

    console.log(`\n[snapshot-grant-frontier] tracked source groups: ${snapshotRows.length}`);
    if (changedGroups.length > 0) {
      console.log('[snapshot-grant-frontier] changed groups');
      for (const row of changedGroups) {
        const parts = [];
        if (row.hot_delta !== 0) parts.push(`hot ${row.hot_delta > 0 ? '+' : ''}${row.hot_delta}`);
        if (row.due_delta !== 0) parts.push(`due ${row.due_delta > 0 ? '+' : ''}${row.due_delta}`);
        if (row.failure_delta !== 0) parts.push(`failures ${row.failure_delta > 0 ? '+' : ''}${row.failure_delta}`);
        if (row.changed_delta !== 0) parts.push(`changed ${row.changed_delta > 0 ? '+' : ''}${row.changed_delta}`);
        if (row.grant_delta !== 0) parts.push(`grant rows ${row.grant_delta > 0 ? '+' : ''}${row.grant_delta}`);
        console.log(`- ${row.source_group}: ${parts.join(' • ')} (score ${row.hot_score})`);
      }
    } else if (baselineGroups.length > 0) {
      console.log('[snapshot-grant-frontier] first source baseline');
      for (const row of baselineGroups) {
        console.log(
          `- ${row.source_group}: score=${row.hot_score} due=${row.due_now} failing=${row.failing} changed_recent=${row.changed_recent} grant_rows=${row.grant_rows}`,
        );
      }
    }

    await logComplete(db, run.id, {
      items_found: snapshotRows.length,
      items_updated: changedGroups.length,
    });
  } catch (error) {
    await logFailed(db, run.id, error);
    console.error('[snapshot-grant-frontier] Failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
