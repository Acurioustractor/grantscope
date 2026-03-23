#!/usr/bin/env node
/**
 * watch-outcomes-changes.mjs — Autoresearch Agent
 *
 * Detects changes in outcomes_metrics since last run:
 *   1. New metrics added (any jurisdiction)
 *   2. Metric values that changed (updated via UPSERT)
 *   3. Worsening trends (detention rates going up, costs increasing)
 *   4. Improving trends (rates dropping, diversion increasing)
 *
 * Writes findings to the `discoveries` table for Mission Control.
 *
 * Usage:
 *   node --env-file=.env scripts/watch-outcomes-changes.mjs
 *   node --env-file=.env scripts/watch-outcomes-changes.mjs --lookback=48
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const AGENT_ID = 'watch-outcomes-changes';
const AGENT_NAME = 'Outcomes Change Watcher';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOOKBACK_HOURS = parseInt(
  process.argv.find(a => a.startsWith('--lookback='))?.split('=')[1] || '0'
);

function psql(query) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/watch-outcomes-${Date.now()}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(
      `psql "${connStr}" --csv -f ${tmpFile} 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    );
    unlinkSync(tmpFile);
    const lines = result.trim().split('\n').filter(l => l.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { vals.push(cur); cur = ''; continue; }
        cur += ch;
      }
      vals.push(cur);
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    console.error('psql error:', err.message?.slice(0, 200));
    return [];
  }
}

async function getLastRunTime() {
  if (LOOKBACK_HOURS > 0) {
    return new Date(Date.now() - LOOKBACK_HOURS * 3600000).toISOString();
  }
  const { data } = await supabase
    .from('agent_runs')
    .select('completed_at')
    .eq('agent_id', AGENT_ID)
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) return data[0].completed_at;
  return new Date(Date.now() - 24 * 3600000).toISOString();
}

// Metrics where HIGHER = WORSE
const WORSE_WHEN_HIGHER = [
  'detention_rate_per_10k', 'avg_daily_detention', 'avg_days_in_detention',
  'indigenous_overrepresentation_ratio', 'pct_unsentenced', 'pct_first_nations_in_detention',
  'recidivism_6_months', 'recidivism_1_month', 'cost_per_day_detention',
  'watchhouse_stays', 'use_of_force_incidents', 'self_harm_incidents',
  'ctg_target11_indigenous_detention_rate', 'court_breach_bail_convictions',
];

// Metrics where HIGHER = BETTER
const BETTER_WHEN_HIGHER = [
  'court_rj_referrals', 'court_rj_conferences', 'on_country_program_spend',
];

function assessDirection(metricName, oldVal, newVal) {
  const delta = newVal - oldVal;
  const pctChange = oldVal !== 0 ? ((delta / oldVal) * 100).toFixed(1) : 'N/A';

  if (WORSE_WHEN_HIGHER.includes(metricName)) {
    if (delta > 0) return { direction: 'worsening', severity: Math.abs(delta / oldVal) > 0.1 ? 'significant' : 'notable', pctChange };
    if (delta < 0) return { direction: 'improving', severity: 'info', pctChange };
  }
  if (BETTER_WHEN_HIGHER.includes(metricName)) {
    if (delta > 0) return { direction: 'improving', severity: 'info', pctChange };
    if (delta < 0) return { direction: 'worsening', severity: Math.abs(delta / oldVal) > 0.1 ? 'significant' : 'notable', pctChange };
  }
  return { direction: 'changed', severity: 'info', pctChange };
}

async function main() {
  const t0 = Date.now();
  console.log(`${AGENT_NAME} — Autoresearch Agent`);
  console.log('═'.repeat(50));

  const runId = (await logStart(supabase, AGENT_ID, AGENT_NAME))?.id;

  try {
    const since = await getLastRunTime();
    console.log(`  Looking for changes since: ${since}`);

    const discoveries = [];

    // ── 1. New metrics added ──
    console.log('\n  Scanning for new metrics...');
    const newMetrics = psql(`
      SELECT jurisdiction, metric_name, metric_value, metric_unit, period, source
      FROM outcomes_metrics
      WHERE created_at > '${since}'
      ORDER BY jurisdiction, metric_name
    `);
    console.log(`  ${newMetrics.length} new metric rows since last run`);

    if (newMetrics.length > 0) {
      // Group by jurisdiction
      const byJur = {};
      for (const m of newMetrics) {
        if (!byJur[m.jurisdiction]) byJur[m.jurisdiction] = [];
        byJur[m.jurisdiction].push(m);
      }

      for (const [jur, metrics] of Object.entries(byJur)) {
        const metricNames = [...new Set(metrics.map(m => m.metric_name))];
        discoveries.push({
          agent_id: AGENT_ID,
          discovery_type: 'pattern',
          severity: metrics.length > 10 ? 'significant' : 'notable',
          title: `${metrics.length} new outcome metrics for ${jur}`,
          description: `New metrics added: ${metricNames.slice(0, 5).join(', ')}${metricNames.length > 5 ? ` (+${metricNames.length - 5} more)` : ''}. Source: ${metrics[0].source}`,
          metadata: { jurisdiction: jur, metric_count: metrics.length, metric_names: metricNames },
        });
      }
    }

    // ── 2. Year-over-year trends (compare latest two periods) ──
    console.log('  Checking year-over-year trends...');
    const trends = psql(`
      WITH ranked AS (
        SELECT jurisdiction, metric_name, metric_value, period, cohort,
               ROW_NUMBER() OVER (PARTITION BY jurisdiction, metric_name, COALESCE(cohort, '__null__') ORDER BY period DESC) as rn
        FROM outcomes_metrics
        WHERE domain = 'youth-justice'
          AND cohort IS NULL OR cohort = 'all'
      )
      SELECT
        a.jurisdiction, a.metric_name,
        a.metric_value AS current_val, a.period AS current_period,
        b.metric_value AS prev_val, b.period AS prev_period
      FROM ranked a
      JOIN ranked b ON a.jurisdiction = b.jurisdiction
        AND a.metric_name = b.metric_name
        AND a.rn = 1 AND b.rn = 2
      WHERE a.metric_value != b.metric_value
      ORDER BY a.jurisdiction, a.metric_name
    `);

    console.log(`  ${trends.length} metrics with year-over-year changes`);

    for (const t of trends) {
      const oldVal = parseFloat(t.prev_val);
      const newVal = parseFloat(t.current_val);
      if (isNaN(oldVal) || isNaN(newVal)) continue;

      const { direction, severity, pctChange } = assessDirection(t.metric_name, oldVal, newVal);

      if (direction === 'worsening') {
        discoveries.push({
          agent_id: AGENT_ID,
          discovery_type: 'pattern',
          severity,
          title: `${t.jurisdiction} ${t.metric_name}: ${direction} (${pctChange}%)`,
          description: `${t.metric_name} changed from ${oldVal} (${t.prev_period}) to ${newVal} (${t.current_period}) — ${direction} by ${pctChange}%`,
          metadata: { jurisdiction: t.jurisdiction, metric: t.metric_name, old: oldVal, new: newVal, direction },
        });
      }
    }

    // ── 3. Cross-jurisdiction outliers ──
    console.log('  Checking cross-jurisdiction outliers...');
    const outliers = psql(`
      WITH stats AS (
        SELECT metric_name,
               AVG(metric_value) AS avg_val,
               STDDEV(metric_value) AS stddev_val
        FROM outcomes_metrics
        WHERE domain = 'youth-justice'
          AND jurisdiction NOT IN ('National')
          AND (cohort IS NULL OR cohort = 'all')
          AND metric_name IN ('detention_rate_per_10k', 'cost_per_day_detention', 'pct_unsentenced', 'indigenous_overrepresentation_ratio')
        GROUP BY metric_name
        HAVING STDDEV(metric_value) > 0
      )
      SELECT m.jurisdiction, m.metric_name, m.metric_value,
             s.avg_val, s.stddev_val,
             (m.metric_value - s.avg_val) / s.stddev_val AS z_score
      FROM outcomes_metrics m
      JOIN stats s ON s.metric_name = m.metric_name
      WHERE m.domain = 'youth-justice'
        AND m.jurisdiction NOT IN ('National')
        AND (m.cohort IS NULL OR m.cohort = 'all')
        AND ABS((m.metric_value - s.avg_val) / s.stddev_val) > 1.5
      ORDER BY ABS((m.metric_value - s.avg_val) / s.stddev_val) DESC
    `);

    console.log(`  ${outliers.length} outlier metrics (>1.5 std dev)`);

    // ── 4. Insert discoveries ──
    console.log(`\n  Total discoveries: ${discoveries.length}`);

    if (discoveries.length > 0) {
      const { error } = await supabase.from('discoveries').insert(discoveries);
      if (error) console.error('  Insert error:', error.message);
      else console.log(`  Inserted ${discoveries.length} discoveries`);
    }

    const duration = Date.now() - t0;
    console.log(`\n  Done in ${(duration / 1000).toFixed(1)}s`);

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: newMetrics.length + trends.length,
        items_new: discoveries.length,
        duration_ms: duration,
      });
    }
  } catch (err) {
    console.error('Fatal:', err);
    if (runId) await logFailed(supabase, runId, err.message);
    process.exit(1);
  }
}

main();
