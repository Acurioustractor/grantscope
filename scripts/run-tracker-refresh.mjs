#!/usr/bin/env node
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const argMap = new Map(
  args
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split('=');
      return [key, rest.join('=')];
    }),
);

const domain = argMap.get('domain')?.trim() || 'youth-justice';
const jurisdiction = argMap.get('jurisdiction')?.trim() || 'QLD';
const allJurisdictions = args.includes('--all-jurisdictions');
const runId = argMap.get('run-id')?.trim() || null;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[run-tracker-refresh] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function runSync() {
  const result = spawnSync('node', ['--env-file=.env', 'scripts/sync-tracker-evidence.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  runSync();

  const escapedDomain = domain.replaceAll("'", "''");
  const query = `
    SELECT
      jurisdiction,
      tracker_key,
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE evidence_strength = 'official')::int AS official_rows,
      COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_rows,
      COUNT(*) FILTER (
        WHERE mirror_status IN ('missing_from_mirror', 'external_only')
      )::int AS gap_rows,
      COUNT(*) FILTER (WHERE metadata->'source_fetch'->>'fetch_error' IS NOT NULL)::int AS fetch_error_rows,
      COUNT(*) FILTER (WHERE metadata->'source_fetch'->>'cf_mitigated' IS NOT NULL)::int AS access_gate_rows,
      MAX(event_date)::text AS latest_event_date
    FROM tracker_evidence_events
    WHERE domain = '${escapedDomain}'
      ${allJurisdictions ? '' : `AND jurisdiction = '${jurisdiction.replaceAll("'", "''")}'`}
    GROUP BY jurisdiction, tracker_key
    ORDER BY jurisdiction, latest_event_date DESC NULLS LAST, tracker_key
  `;

  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) {
    console.error('[run-tracker-refresh] Summary query failed:', error.message);
    process.exit(1);
  }

  const siteQuery = `
    WITH scoped AS (
      SELECT jurisdiction, tracker_key, site_names, mirror_status, event_date
      FROM tracker_evidence_events
      WHERE domain = '${escapedDomain}'
        ${allJurisdictions ? '' : `AND jurisdiction = '${jurisdiction.replaceAll("'", "''")}'`}
    ),
    expanded AS (
      SELECT
        jurisdiction,
        tracker_key,
        TRIM(site_name) AS site_name,
        mirror_status,
        event_date
      FROM scoped,
      LATERAL unnest(COALESCE(site_names, ARRAY[]::text[])) AS site_name
      WHERE TRIM(site_name) <> ''
        AND LOWER(TRIM(site_name)) NOT IN (
          'statewide',
          'queensland',
          'new south wales',
          'northern territory',
          'queensland youth justice',
          'new south wales youth justice',
          'northern territory youth justice'
        )
    )
    SELECT
      jurisdiction,
      site_name,
      COUNT(DISTINCT tracker_key)::int AS tracker_count,
      COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_count,
      COUNT(*) FILTER (
        WHERE mirror_status IN ('missing_from_mirror', 'external_only')
      )::int AS gap_count,
      MAX(event_date)::text AS latest_event_date
    FROM expanded
    GROUP BY jurisdiction, site_name
    ORDER BY jurisdiction, site_name
  `;
  const previousSnapshotQuery = `
    SELECT DISTINCT ON (jurisdiction, site_name)
      jurisdiction,
      site_name,
      tracker_count,
      mirrored_count,
      gap_count,
      hot_score
    FROM tracker_site_snapshots
    WHERE domain = '${escapedDomain}'
      ${allJurisdictions ? '' : `AND jurisdiction = '${jurisdiction.replaceAll("'", "''")}'`}
    ORDER BY jurisdiction, site_name, created_at DESC
  `;

  const [{ data: siteRows, error: siteError }, { data: previousSnapshots, error: previousError }] = await Promise.all([
    db.rpc('exec_sql', { query: siteQuery }),
    db.rpc('exec_sql', { query: previousSnapshotQuery }),
  ]);
  if (siteError) {
    console.error('[run-tracker-refresh] Site summary query failed:', siteError.message);
    process.exit(1);
  }
  if (previousError) {
    console.error('[run-tracker-refresh] Previous snapshot query failed:', previousError.message);
    process.exit(1);
  }

  const scoreSite = (site) => {
    const ageDays = site.latest_event_date
      ? Math.floor((Date.now() - new Date(site.latest_event_date).getTime()) / 86_400_000)
      : null;
    const freshnessBonus = ageDays === null ? 0 : ageDays <= 45 ? 18 : ageDays <= 120 ? 10 : ageDays <= 240 ? 4 : 0;
    return Number(site.tracker_count || 0) * 40 + Number(site.gap_count || 0) * 9 + Number(site.mirrored_count || 0) * 5 + freshnessBonus;
  };

  const previousBySite = new Map(
    (previousSnapshots || []).map((row) => [`${row.jurisdiction}::${row.site_name}`, row]),
  );
  const snapshotRows = (siteRows || []).map((row) => {
    const previous = previousBySite.get(`${row.jurisdiction}::${row.site_name}`);
    const hotScore = scoreSite(row);
    return {
      run_id: runId,
      domain,
      jurisdiction: row.jurisdiction,
      site_name: row.site_name,
      tracker_count: Number(row.tracker_count || 0),
      mirrored_count: Number(row.mirrored_count || 0),
      gap_count: Number(row.gap_count || 0),
      hot_score: hotScore,
      latest_event_date: row.latest_event_date || null,
      has_previous_snapshot: Boolean(previous),
      hot_delta: hotScore - Number(previous?.hot_score || 0),
      tracker_delta: Number(row.tracker_count || 0) - Number(previous?.tracker_count || 0),
      mirrored_delta: Number(row.mirrored_count || 0) - Number(previous?.mirrored_count || 0),
      gap_delta: Number(row.gap_count || 0) - Number(previous?.gap_count || 0),
    };
  });

  if (snapshotRows.length > 0) {
    const { error: insertError } = await db.from('tracker_site_snapshots').insert(snapshotRows);
    if (insertError) {
      console.error('[run-tracker-refresh] Snapshot insert failed:', insertError.message);
      process.exit(1);
    }
  }

  const changedSites = snapshotRows
    .filter((row) => row.has_previous_snapshot && (row.hot_delta !== 0 || row.mirrored_delta !== 0 || row.gap_delta !== 0 || row.tracker_delta !== 0))
    .sort((a, b) => Math.abs(b.hot_delta) - Math.abs(a.hot_delta) || b.gap_delta - a.gap_delta || b.mirrored_delta - a.mirrored_delta)
    .slice(0, 8);
  const baselineSites = snapshotRows
    .filter((row) => !row.has_previous_snapshot)
    .sort((a, b) => b.hot_score - a.hot_score)
    .slice(0, 5);

  console.log(`\n[run-tracker-refresh] ${allJurisdictions ? `ALL ${domain}` : `${jurisdiction} ${domain}`} tracker summary`);
  for (const row of data || []) {
    console.log(
      `- ${row.jurisdiction}/${row.tracker_key}: total=${row.total_rows} official=${row.official_rows} mirrored=${row.mirrored_rows} gaps=${row.gap_rows} fetch_errors=${row.fetch_error_rows} access_gates=${row.access_gate_rows} latest=${row.latest_event_date}`,
    );
  }

  if (changedSites.length > 0) {
    console.log('\n[run-tracker-refresh] site movement');
    for (const row of changedSites) {
      const parts = [];
      if (row.hot_delta !== 0) parts.push(`hot ${row.hot_delta > 0 ? '+' : ''}${row.hot_delta}`);
      if (row.mirrored_delta !== 0) parts.push(`mirrored ${row.mirrored_delta > 0 ? '+' : ''}${row.mirrored_delta}`);
      if (row.gap_delta !== 0) parts.push(`gaps ${row.gap_delta > 0 ? '+' : ''}${row.gap_delta}`);
      if (row.tracker_delta !== 0) parts.push(`trackers ${row.tracker_delta > 0 ? '+' : ''}${row.tracker_delta}`);
      console.log(`- ${row.jurisdiction}/${row.site_name}: ${parts.join(' • ')} (score ${row.hot_score})`);
    }
  } else if (baselineSites.length > 0) {
    console.log('\n[run-tracker-refresh] first tracked site baseline');
    for (const row of baselineSites) {
      console.log(
        `- ${row.jurisdiction}/${row.site_name}: score=${row.hot_score} mirrored=${row.mirrored_count} gaps=${row.gap_count} trackers=${row.tracker_count}`,
      );
    }
  }
}

main().catch((error) => {
  console.error('[run-tracker-refresh] Unhandled error:', error);
  process.exit(1);
});
