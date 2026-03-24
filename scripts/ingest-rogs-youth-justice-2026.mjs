#!/usr/bin/env node
/**
 * ingest-rogs-youth-justice-2026.mjs
 *
 * Ingests Productivity Commission ROGS 2026 Youth Justice dataset (Section 17).
 * Source: https://www.pc.gov.au/ongoing/report-on-government-services/community-services/youth-justice/
 *
 * 2,444 rows covering 2014-15 to 2024-25, 28 tables:
 *   Supervision (detention + community), costs, assaults, self-harm, deaths,
 *   escapes, education, case plans, group conferencing, recidivism, expenditure.
 *
 * Inserts into outcomes_metrics with domain='youth-justice', source='ROGS 2026'.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-rogs-youth-justice-2026.mjs --dry-run
 *   node --env-file=.env scripts/ingest-rogs-youth-justice-2026.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = 'data/aihw/rogs-2026-youth-justice.csv';
const SOURCE = 'Productivity Commission ROGS 2026';
const SOURCE_URL = 'https://www.pc.gov.au/ongoing/report-on-government-services/community-services/youth-justice/';

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

// Parse CSV (handles quoted fields)
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

// State columns in CSV (indices 17-25)
const STATE_COLS = [
  [17, 'NSW'], [18, 'VIC'], [19, 'QLD'], [20, 'WA'],
  [21, 'SA'], [22, 'TAS'], [23, 'ACT'], [24, 'NT'], [25, 'National'],
];

// Map Indigenous_Status to our cohort values
function mapCohort(indigStatus) {
  if (!indigStatus) return 'all';
  const s = indigStatus.toLowerCase();
  if (s.includes('torres strait') && !s.includes('non')) return 'indigenous';
  if (s.includes('non-indigenous')) return 'non-indigenous';
  if (s.includes('unknown')) return 'unknown';
  return 'all';
}

// Map ROGS table+measure+description to our metric_name
// Returns { metric_name, metric_unit } or null to skip
function mapMetric(row) {
  const [table, year, measure, age, sex, indigStatus, remoteness, serviceType, yearDollars,
    desc1, desc2, desc3, desc4, desc5, desc6, dataSource, unit] = row;

  const t = table;
  const m = measure;
  const d1 = desc1 || '';
  const d2 = desc2 || '';
  const u = unit;
  const svc = serviceType || '';

  // 17A.1: Under supervision — avg daily numbers + rates (all people)
  if (t === '17A.1' && d2.includes('Average daily')) {
    const type = svc.includes('Detention') ? 'detention' : 'community';
    return { metric_name: `rogs_avg_daily_${type}`, metric_unit: 'persons' };
  }
  if (t === '17A.1' && d2.includes('Rate')) {
    const type = svc.includes('Detention') ? 'detention' : 'community';
    return { metric_name: `rogs_rate_${type}_per_10k`, metric_unit: 'per_10k' };
  }

  // 17A.2: Centre utilisation
  if (t === '17A.2' && d2.includes('utilisation rate')) return { metric_name: 'rogs_centre_utilisation_pct', metric_unit: 'percent' };
  if (t === '17A.2' && d2.includes('funded beds')) return { metric_name: 'rogs_funded_beds', metric_unit: 'beds' };
  if (t === '17A.2' && d2.includes('nightly population')) return { metric_name: 'rogs_avg_nightly_population', metric_unit: 'persons' };

  // 17A.3-6: Under supervision by Indigenous status
  if (['17A.3', '17A.4', '17A.5', '17A.6'].includes(t)) {
    // 17A.3 = detention Indigenous, 17A.4 = detention non-Indigenous
    // 17A.5 = community Indigenous, 17A.6 = community non-Indigenous
    const type = ['17A.3', '17A.4'].includes(t) ? 'detention' : 'community';
    if (d2.includes('Average daily')) return { metric_name: `rogs_avg_daily_${type}`, metric_unit: 'persons' };
    if (d2.includes('Rate')) return { metric_name: `rogs_rate_${type}_per_10k`, metric_unit: 'per_10k' };
    return null;
  }

  // 17A.7-8: Indigenous rate ratios (detention + community)
  if (['17A.7', '17A.8'].includes(t)) {
    const type = t === '17A.7' ? 'detention' : 'community';
    if (d2.includes('Rate ratio')) return { metric_name: `rogs_indigenous_rate_ratio_${type}`, metric_unit: 'ratio' };
    if (u === 'rate') return null; // skip individual rates, already in 17A.3-6
    return null;
  }

  // 17A.10: Government expenditure time series
  if (t === '17A.10') {
    if (d2.includes('Per young person')) return { metric_name: 'rogs_expenditure_per_capita', metric_unit: 'dollars' };
    if (!d2.includes('Per')) return { metric_name: `rogs_total_expenditure_${svc.includes('Detention') ? 'detention' : svc.includes('Community') ? 'community' : 'total'}`, metric_unit: 'thousands' };
    return null;
  }

  // 17A.12: Group conferencing
  if (t === '17A.12') {
    if (d2.includes('Number')) return { metric_name: 'rogs_group_conferences', metric_unit: 'count' };
    if (d2.includes('Proportion')) return { metric_name: 'rogs_group_conferences_pct', metric_unit: 'percent' };
    return null;
  }

  // 17A.13: Case plans
  if (t === '17A.13') {
    const type = svc.includes('Detention') ? 'detention' : 'community';
    if (d2.includes('Proportion')) return { metric_name: `rogs_case_plans_pct_${type}`, metric_unit: 'percent' };
    return null; // skip raw numbers, proportions more useful
  }

  // 17A.14: Education attendance in detention
  if (t === '17A.14') {
    if (d2.includes('Proportion')) return { metric_name: 'rogs_education_attendance_pct', metric_unit: 'percent' };
    return null;
  }

  // 17A.15: Deaths in custody
  if (t === '17A.15') return { metric_name: 'rogs_deaths_in_custody', metric_unit: 'count' };

  // 17A.16: Serious assaults in custody (young person on young person + young person on staff)
  if (t === '17A.16') {
    if (u === 'rate') return { metric_name: 'rogs_serious_assault_rate', metric_unit: 'per_10k_nights' };
    return null;
  }

  // 17A.17: All assaults in custody
  if (t === '17A.17') {
    if (u === 'rate') return { metric_name: 'rogs_assault_rate', metric_unit: 'per_10k_nights' };
    return null;
  }

  // 17A.18: Centre utilisation detail (nights in custody)
  if (t === '17A.18') {
    if (d2.includes('Nights in custody')) return { metric_name: 'rogs_custody_nights', metric_unit: 'nights' };
    return null; // avg nightly already in 17A.2
  }

  // 17A.19: Self-harm
  if (t === '17A.19') {
    if (u === 'rate') return { metric_name: 'rogs_selfharm_rate', metric_unit: 'per_10k_nights' };
    return null;
  }

  // 17A.20: Cost per day detention
  if (t === '17A.20' && d1.includes('Cost per average day')) return { metric_name: 'rogs_cost_per_day_detention', metric_unit: 'dollars' };

  // 17A.21: Cost per day community
  if (t === '17A.21' && d1.includes('Cost per average day')) return { metric_name: 'rogs_cost_per_day_community', metric_unit: 'dollars' };

  // 17A.22: Cost per group conference
  if (t === '17A.22' && d1.includes('Cost per concluded')) return { metric_name: 'rogs_cost_per_conference', metric_unit: 'dollars' };

  // 17A.23: Escapes
  if (t === '17A.23' && u === 'rate' && d1.includes('detention centre')) return { metric_name: 'rogs_escape_rate', metric_unit: 'per_10k_nights' };

  // 17A.25: Community order completion
  if (t === '17A.25' && d2.includes('Proportion')) return { metric_name: 'rogs_community_order_completion_pct', metric_unit: 'percent' };

  // 17A.26: Recidivism (returns to sentenced supervision)
  if (t === '17A.26') return { metric_name: 'rogs_recidivism_pct', metric_unit: 'percent' };

  return null; // skip everything else
}

// ---- Main ----

log('Loading ROGS 2026 Youth Justice CSV...');
const lines = readFileSync(CSV_PATH, 'utf8').split('\n');
const rows = lines.slice(1).filter(l => l.trim()).map(parseCSV);
log(`  ${rows.length} CSV rows`);

const metrics = [];

for (const row of rows) {
  const mapped = mapMetric(row);
  if (!mapped) continue;

  const year = row[1];
  const cohort = mapCohort(row[5]);
  const sex = row[4] || '';

  // Skip sex-disaggregated rows for now (keep All people + Male/Female for assaults)
  if (sex && sex !== 'All people' && !['17A.16', '17A.17', '17A.19'].includes(row[0])) continue;

  // For assault/self-harm tables, build a richer metric name
  let metricName = mapped.metric_name;
  if (['17A.16', '17A.17', '17A.19'].includes(row[0])) {
    // desc3 has the assault type (young person on young person, young person on staff, etc.)
    const desc3 = (row[12] || '').toLowerCase();
    if (desc3.includes('young person on young person')) metricName += '_yp_on_yp';
    else if (desc3.includes('young person on staff')) metricName += '_yp_on_staff';
    else if (desc3.includes('self-harm incidents')) metricName += '_incidents';
    else if (desc3.includes('young people who')) metricName += '_people';
    // Skip sex-disaggregated for these too unless it adds value
    if (sex && sex !== 'All people') continue;
  }

  for (const [colIdx, jurisdiction] of STATE_COLS) {
    const value = row[colIdx];
    if (!value || value === 'na' || value === 'np' || value === 'n.a.' || value === 'n.p.' || value === '–' || value === '..') continue;
    const numValue = parseFloat(value.replace(/,/g, ''));
    if (isNaN(numValue)) continue;

    const notes = [row[9], row[10], row[11], row[12]].filter(Boolean).join(' — ');

    metrics.push({
      jurisdiction,
      domain: 'youth-justice',
      metric_name: metricName,
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

// Summary
const byMetric = {};
for (const m of metrics) byMetric[m.metric_name] = (byMetric[m.metric_name] || 0) + 1;
log('By metric:');
for (const [k, v] of Object.entries(byMetric).sort((a, b) => b[1] - a[1])) {
  log(`  ${k}: ${v}`);
}

const periods = [...new Set(metrics.map(m => m.period))].sort();
log(`\nPeriods: ${periods[0]} → ${periods[periods.length - 1]} (${periods.length} years)`);

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

    writeFileSync('/tmp/rogs-import-batch.sql', sql);
    const result = psql(`\\i /tmp/rogs-import-batch.sql`);
    if (result.includes('ERROR')) {
      log(`  Batch ${Math.floor(i / BATCH) + 1} error: ${result.slice(0, 200)}`);
    } else {
      const countMatch = result.match(/INSERT 0 (\d+)/);
      inserted += countMatch ? parseInt(countMatch[1]) : batch.length;
    }
  }

  log(`  Inserted ${inserted} metrics`);

  psql(`INSERT INTO agent_runs (agent_id, agent_name, status, items_found, items_new, started_at, completed_at) VALUES ('ingest-rogs-yj-2026', 'ROGS 2026 Youth Justice Ingest', 'success', ${metrics.length}, ${inserted}, NOW() - INTERVAL '1 minute', NOW())`);
}

log('\n======================================================');
log(`  ROGS 2026 Youth Justice — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
log(`  Metrics: ${metrics.length}`);
log(`  Periods: ${periods[0]} → ${periods[periods.length - 1]}`);
log(`  Source: ${CSV_PATH}`);
log('======================================================');
