#!/usr/bin/env node
/**
 * ingest-ctg11-youth-justice.mjs
 *
 * Ingests Closing the Gap Target 11 (Youth Justice) dataset.
 * Source: https://www.pc.gov.au/closing-the-gap-data/annual-data-report
 *
 * Unique data not in ROGS:
 *   - CTG trajectory targets to 2030-31 (is each state on track?)
 *   - Unsentenced detention rates by Indigenous status
 *   - Alleged young offenders in police proceedings
 *   - Children 10-13 first entering detention (raising-the-age)
 *   - First contact with youth justice system
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-ctg11-youth-justice.mjs --dry-run
 *   node --env-file=.env scripts/ingest-ctg11-youth-justice.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = 'data/aihw/ctg11-youth-justice-2025.csv';
const SOURCE = 'Closing the Gap Annual Data Report 2025';
const SOURCE_URL = 'https://www.pc.gov.au/closing-the-gap-data/annual-data-report';

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function psql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const cmd = `source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -t -A -c '${escaped}'`;
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (err) {
    log(`  psql error: ${err.message?.slice(0, 120)}`);
    return '';
  }
}

function parseCSV(line) {
  const result = []; let field = ''; let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(field); field = ''; }
    else { field += ch; }
  }
  result.push(field);
  return result;
}

const STATE_COLS = [
  [16, 'NSW'], [17, 'VIC'], [18, 'QLD'], [19, 'WA'],
  [20, 'SA'], [21, 'TAS'], [22, 'ACT'], [23, 'NT'], [24, 'National'],
];

function mapCohort(indigStatus) {
  const s = (indigStatus || '').toLowerCase();
  if (s.includes('torres strait') || s.includes('aboriginal')) return 'indigenous';
  if (s.includes('non-indigenous')) return 'non-indigenous';
  if (s.includes('unknown')) return 'unknown';
  return 'all';
}

function mapMetric(row) {
  const [table, , measure, , , , desc1, desc2, desc3] = row;
  const unit = row[15];

  // CtG11A.1: Detention rate — actuals, trajectories, projections
  if (table === 'CtG11A.1') {
    const type = (desc3 || '').toLowerCase();
    if (type === 'actual') return { metric_name: 'ctg_detention_rate', metric_unit: 'per_10k' };
    if (type === 'trajectory') return { metric_name: 'ctg_detention_rate_target', metric_unit: 'per_10k' };
    if (type === 'linear regression estimates') return { metric_name: 'ctg_detention_rate_projected', metric_unit: 'per_10k' };
    if (type === 'assessment of progress') return { metric_name: 'ctg_detention_progress', metric_unit: 'text' };
    return null; // skip confidence intervals and annual change
  }

  // CtG11A.2: Detention rate by age group (10-13, 14-17)
  if (table === 'CtG11A.2') {
    const age = (row[3] || '').toLowerCase();
    if (age.includes('10-13')) return { metric_name: 'ctg_detention_rate_10_13', metric_unit: 'per_10k' };
    if (age.includes('14-17')) return { metric_name: 'ctg_detention_rate_14_17', metric_unit: 'per_10k' };
    return null;
  }

  // CtG11A.3: Detention rate ratio (Indigenous to non-Indigenous)
  if (table === 'CtG11A.3') {
    return { metric_name: 'ctg_detention_rate_ratio', metric_unit: 'ratio' };
  }

  // CtG11A.4: Detention rate by sex
  if (table === 'CtG11A.4') {
    const sex = (row[4] || '').toLowerCase();
    if (sex.includes('male') && !sex.includes('female')) return { metric_name: 'ctg_detention_rate_male', metric_unit: 'per_10k' };
    if (sex.includes('female')) return { metric_name: 'ctg_detention_rate_female', metric_unit: 'per_10k' };
    return null;
  }

  // SE11a.1: Unsentenced detention rates by Indigenous status
  if (table === 'SE11a.1') {
    return { metric_name: 'ctg_unsentenced_rate', metric_unit: unit === 'rate' ? 'per_10k' : unit === '%' ? 'percent' : unit };
  }

  // SE11c.1-4: Alleged young offenders in police proceedings
  if (table === 'SE11c.1') {
    return { metric_name: 'ctg_alleged_offenders_rate', metric_unit: unit === 'rate' ? 'per_1k' : 'count' };
  }
  if (table === 'SE11c.2') {
    const age = (row[3] || '').toLowerCase();
    if (age.includes('10-13')) return { metric_name: 'ctg_alleged_offenders_rate_10_13', metric_unit: 'per_1k' };
    if (age.includes('14-17')) return { metric_name: 'ctg_alleged_offenders_rate_14_17', metric_unit: 'per_1k' };
    return null;
  }
  if (table === 'SE11c.3') {
    return { metric_name: 'ctg_alleged_offenders_ratio', metric_unit: 'ratio' };
  }
  if (table === 'SE11c.4') {
    const sex = (row[4] || '').toLowerCase();
    if (sex.includes('male') && !sex.includes('female')) return { metric_name: 'ctg_alleged_offenders_rate_male', metric_unit: 'per_1k' };
    if (sex.includes('female')) return { metric_name: 'ctg_alleged_offenders_rate_female', metric_unit: 'per_1k' };
    return null;
  }

  // SE11h.1: Children 10-13 first entering detention
  if (table === 'SE11h.1') {
    return { metric_name: 'ctg_first_detention_10_13', metric_unit: unit === 'no.' ? 'persons' : 'per_10k' };
  }

  // SE11h.2: First contact with youth justice — under supervision
  if (table === 'SE11h.2') {
    return { metric_name: 'ctg_first_supervision_rate', metric_unit: unit === 'rate' ? 'per_10k' : 'persons' };
  }

  // SE11h.3: First contact — community-based
  if (table === 'SE11h.3') {
    return { metric_name: 'ctg_first_community_rate', metric_unit: unit === 'rate' ? 'per_10k' : 'persons' };
  }

  // SE11h.4: First contact — detention
  if (table === 'SE11h.4') {
    return { metric_name: 'ctg_first_detention_rate', metric_unit: unit === 'rate' ? 'per_10k' : 'persons' };
  }

  return null;
}

// ---- Main ----

log('Loading Closing the Gap Target 11 CSV...');
const lines = readFileSync(CSV_PATH, 'utf8').split('\n');
const rows = lines.slice(1).filter(l => l.trim()).map(parseCSV);
log(`  ${rows.length} CSV rows`);

const metrics = [];

for (const row of rows) {
  const mapped = mapMetric(row);
  if (!mapped) continue;

  const year = row[1];
  const cohort = mapCohort(row[5]);

  // Skip unknown Indigenous status — not useful for trends
  if (cohort === 'unknown') continue;

  // For text metrics (progress assessments), handle differently
  if (mapped.metric_unit === 'text') {
    // Store the assessment as a note — value is 1 for "on track", 0 for "not on track"
    // We'll parse the actual text into the notes field
    continue; // Skip text assessments for now — focus on numeric data
  }

  for (const [colIdx, jurisdiction] of STATE_COLS) {
    const value = row[colIdx];
    if (!value || value === '..' || value === 'na' || value === 'np' || value === 'n.a.' || value === 'n.p.' || value === '–') continue;
    const numValue = parseFloat(value.replace(/,/g, ''));
    if (isNaN(numValue)) continue;

    const notes = [row[6], row[7], row[8], row[9]].filter(Boolean).join(' — ');

    metrics.push({
      jurisdiction,
      domain: 'youth-justice',
      metric_name: mapped.metric_name,
      metric_value: Math.round(numValue * 100) / 100,
      metric_unit: mapped.metric_unit,
      period: year,
      cohort,
      source: SOURCE,
      source_url: SOURCE_URL,
      source_table: row[0],
      notes: notes.slice(0, 250),
    });
  }
}

log(`\nTotal metrics extracted: ${metrics.length}`);

const byMetric = {};
for (const m of metrics) byMetric[m.metric_name] = (byMetric[m.metric_name] || 0) + 1;
log('By metric:');
for (const [k, v] of Object.entries(byMetric).sort((a, b) => b[1] - a[1])) {
  log(`  ${k}: ${v}`);
}

const periods = [...new Set(metrics.map(m => m.period))].sort();
log(`\nPeriods: ${periods[0]} → ${periods[periods.length - 1]} (${periods.length})`);

if (DRY_RUN) {
  log(`\nDRY RUN — would insert ${metrics.length} metrics`);
  for (const m of metrics.slice(0, 5)) {
    log(`  ${m.jurisdiction} | ${m.metric_name} | ${m.period} | ${m.cohort} | ${m.metric_value} ${m.metric_unit}`);
  }
} else {
  log('\nInserting into outcomes_metrics...');

  const values = metrics.map(m => {
    const notes = (m.notes || '').replace(/'/g, "''");
    const source = m.source.replace(/'/g, "''");
    return `('${m.jurisdiction}', '${m.domain}', '${m.metric_name}', ${m.metric_value}, '${m.metric_unit}', '${m.period}', '${m.cohort}', '${source}', '${m.source_url}', '${m.source_table}', '${notes}')`;
  });

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < values.length; i += BATCH) {
    const batch = values.slice(i, i + BATCH);
    const sql = `INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, source_table, notes)
VALUES ${batch.join(',\n')}
ON CONFLICT DO NOTHING;`;

    writeFileSync('/tmp/ctg11-import-batch.sql', sql);
    const result = psql(`\\i /tmp/ctg11-import-batch.sql`);
    if (result.includes('ERROR')) {
      log(`  Batch ${Math.floor(i / BATCH) + 1} error: ${result.slice(0, 200)}`);
    } else {
      const countMatch = result.match(/INSERT 0 (\d+)/);
      inserted += countMatch ? parseInt(countMatch[1]) : batch.length;
    }
  }

  log(`  Inserted ${inserted} metrics`);

  psql(`INSERT INTO agent_runs (agent_id, agent_name, status, items_found, items_new, started_at, completed_at) VALUES ('ingest-ctg11-yj', 'CTG Target 11 Youth Justice Ingest', 'success', ${metrics.length}, ${inserted}, NOW() - INTERVAL '1 minute', NOW())`);
}

log('\n======================================================');
log(`  Closing the Gap Target 11 — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
log(`  Metrics: ${metrics.length}`);
log(`  Periods: ${periods[0]} → ${periods[periods.length - 1]}`);
log(`  Source: ${CSV_PATH}`);
log('======================================================');
