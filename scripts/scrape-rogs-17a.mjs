#!/usr/bin/env node
/**
 * scrape-rogs-17a.mjs
 *
 * Scrapes/parses Productivity Commission ROGS 2026 — Chapter 17: Youth Justice
 * Table 17A data and upserts into the outcomes_metrics table.
 *
 * Metrics extracted per state + national:
 *   - cost_per_day_detention     (derived: expenditure / avg_daily_number / 365)
 *   - cost_per_day_community     (derived: expenditure / avg_daily_number / 365)
 *   - total_expenditure          (from Table 17A.10, in dollars)
 *   - expenditure_detention      (from Table 17A.10, in dollars)
 *   - expenditure_community      (from Table 17A.10, in dollars)
 *   - expenditure_conferencing   (from Table 17A.10, in dollars)
 *   - avg_daily_detention        (from Table 17A.1)
 *   - avg_daily_community        (from Table 17A.1)
 *
 * Data source: https://www.pc.gov.au/ongoing/report-on-government-services/2026/community-services/youth-justice
 * Local fallback: data/rogs-youth-justice/youth-justice-2026.csv
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-rogs-17a.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-rogs-17a';
const AGENT_NAME = 'ROGS Table 17A Scraper';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

const SOURCE = 'ROGS 2026 Table 17A';
const SOURCE_URL = 'https://www.pc.gov.au/ongoing/report-on-government-services/2026/community-services/youth-justice';
const LOCAL_CSV = 'data/rogs-youth-justice/youth-justice-2026.csv';
const DOMAIN = 'youth-justice';

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── CSV columns ──────────────────────────────────────────
// 0: Table_Number, 1: Year, 2: Measure, 3: Age, 4: Sex,
// 5: Indigenous_Status, 6: Remoteness, 7: Service_Type,
// 8: Year_Dollars, 9: Description1, 10: Description2,
// 11: Description3, 12-15: Description4-6 + Data_Source,
// 16: Unit, 17-25: NSW, Vic, Qld, WA, SA, Tas, ACT, NT, Aust

const STATE_COLS = {
  NSW: 17, VIC: 18, QLD: 19, WA: 20, SA: 21, TAS: 22, ACT: 23, NT: 24, National: 25,
};

// ── CSV parsing ──────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumeric(val) {
  if (!val || val === 'na' || val === 'np' || val === '..' || val === '–' || val === '-') return null;
  const num = parseFloat(val.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

// ── Data loading ─────────────────────────────────────────

async function loadCSVData() {
  // Try local file first (most reliable for reproducibility)
  if (existsSync(LOCAL_CSV)) {
    log(`Loading local CSV: ${LOCAL_CSV}`);
    return readFileSync(LOCAL_CSV, 'utf8');
  }

  // Try downloading from the PC website
  log('Local CSV not found, attempting download...');
  const pageUrl = SOURCE_URL;

  try {
    const pageRes = await fetch(pageUrl, {
      headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
    });

    if (!pageRes.ok) throw new Error(`Page fetch failed: ${pageRes.status}`);

    const html = await pageRes.text();

    // Look for CSV/Excel download links containing "17A" or "table-17a"
    const linkPatterns = [
      /href="([^"]*17[Aa][^"]*\.csv)"/g,
      /href="([^"]*17[Aa][^"]*\.xlsx?)"/g,
      /href="([^"]*youth-justice[^"]*\.csv)"/g,
    ];

    for (const pattern of linkPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        let url = match[1];
        if (!url.startsWith('http')) {
          url = new URL(url, pageUrl).href;
        }
        log(`  Found download link: ${url}`);

        if (url.endsWith('.csv')) {
          const csvRes = await fetch(url, {
            headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
          });
          if (csvRes.ok) {
            const csvText = await csvRes.text();
            // Save locally for future runs
            mkdirSync('data/rogs-youth-justice', { recursive: true });
            writeFileSync(LOCAL_CSV, csvText);
            log(`  Downloaded and saved to ${LOCAL_CSV}`);
            return csvText;
          }
        }
      }
    }
  } catch (err) {
    log(`  Download failed: ${err.message}`);
  }

  throw new Error(`No ROGS data available. Place CSV at ${LOCAL_CSV} or check ${SOURCE_URL}`);
}

// ── Extract metrics from CSV ─────────────────────────────

function extractMetrics(csvText) {
  const lines = csvText.trim().split('\n');
  log(`  Total CSV rows: ${lines.length - 1}`);

  const metrics = [];

  // Collect raw data by table/year/state for derived calculations
  // { [year]: { [state]: { expenditure_detention, expenditure_community, avg_daily_detention, avg_daily_community } } }
  const rawData = {};

  function ensureYearState(year, state) {
    if (!rawData[year]) rawData[year] = {};
    if (!rawData[year][state]) rawData[year][state] = {};
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 26) continue;

    const table = cols[0];
    const year = cols[1];
    const serviceType = cols[7];
    const desc1 = cols[9];
    const desc2 = cols[10];
    const desc3 = cols[11];
    const unit = cols[16];

    // ── Table 17A.10: Government expenditure ──
    // We want rows where desc1 = "Government real recurrent expenditure"
    // and desc2 is empty (NOT "Per young person...") and unit = "$'000"
    if (table === '17A.10' && desc1?.includes('Government real recurrent expenditure') && !desc2?.includes('Per young person') && unit === "$'000") {

      const descLabel = desc3 || desc2;

      for (const [state, colIdx] of Object.entries(STATE_COLS)) {
        const val = parseNumeric(cols[colIdx]);
        if (val === null) continue;

        // Convert from $'000 to dollars
        const amountDollars = val * 1000;

        ensureYearState(year, state);

        if (descLabel === 'Detention-based services') {
          rawData[year][state].expenditure_detention = amountDollars;
          metrics.push({
            jurisdiction: state,
            domain: DOMAIN,
            metric_name: 'expenditure_detention',
            metric_value: amountDollars,
            metric_unit: 'dollars',
            period: year,
            cohort: 'all',
            source: SOURCE,
            source_url: SOURCE_URL,
            notes: 'Government real recurrent expenditure on detention-based youth justice services (ROGS Table 17A.10)',
          });
        } else if (descLabel === 'Community-based services') {
          rawData[year][state].expenditure_community = amountDollars;
          metrics.push({
            jurisdiction: state,
            domain: DOMAIN,
            metric_name: 'expenditure_community',
            metric_value: amountDollars,
            metric_unit: 'dollars',
            period: year,
            cohort: 'all',
            source: SOURCE,
            source_url: SOURCE_URL,
            notes: 'Government real recurrent expenditure on community-based youth justice services (ROGS Table 17A.10)',
          });
        } else if (descLabel === 'Group conferencing') {
          metrics.push({
            jurisdiction: state,
            domain: DOMAIN,
            metric_name: 'expenditure_conferencing',
            metric_value: amountDollars,
            metric_unit: 'dollars',
            period: year,
            cohort: 'all',
            source: SOURCE,
            source_url: SOURCE_URL,
            notes: 'Government real recurrent expenditure on group conferencing (ROGS Table 17A.10)',
          });
        } else if (descLabel === 'Total expenditure') {
          metrics.push({
            jurisdiction: state,
            domain: DOMAIN,
            metric_name: 'total_expenditure',
            metric_value: amountDollars,
            metric_unit: 'dollars',
            period: year,
            cohort: 'all',
            source: SOURCE,
            source_url: SOURCE_URL,
            notes: 'Total government real recurrent expenditure on youth justice services (ROGS Table 17A.10)',
          });
        }
      }
    }

    // ── Table 17A.1: Average daily numbers ──
    // desc2 = "Average daily number of young people", unit = "no."
    // Indigenous_Status (col 5) = "All people" to get totals
    if (table === '17A.1' && unit === 'no.' && desc2?.includes('Average daily number') && cols[5] === 'All people') {

      for (const [state, colIdx] of Object.entries(STATE_COLS)) {
        const val = parseNumeric(cols[colIdx]);
        if (val === null) continue;

        ensureYearState(year, state);

        if (serviceType === 'Detention-based supervision' || desc3 === 'Detention') {
          rawData[year][state].avg_daily_detention = val;
          metrics.push({
            jurisdiction: state,
            domain: DOMAIN,
            metric_name: 'avg_daily_detention',
            metric_value: val,
            metric_unit: 'count',
            period: year,
            cohort: 'all',
            source: SOURCE,
            source_url: SOURCE_URL,
            notes: 'Average daily number of young people in detention-based supervision (ROGS Table 17A.1)',
          });
        } else if (serviceType === 'Community-based supervision' || desc3 === 'Community-based supervision') {
          rawData[year][state].avg_daily_community = val;
          metrics.push({
            jurisdiction: state,
            domain: DOMAIN,
            metric_name: 'avg_daily_community',
            metric_value: val,
            metric_unit: 'count',
            period: year,
            cohort: 'all',
            source: SOURCE,
            source_url: SOURCE_URL,
            notes: 'Average daily number of young people in community-based supervision (ROGS Table 17A.1)',
          });
        }
      }
    }
  }

  // ── Derive cost per day ──
  // cost_per_day = expenditure / (avg_daily_number * 365)
  for (const [year, states] of Object.entries(rawData)) {
    for (const [state, data] of Object.entries(states)) {
      if (data.expenditure_detention && data.avg_daily_detention && data.avg_daily_detention > 0) {
        const costPerDay = Math.round(data.expenditure_detention / (data.avg_daily_detention * 365));
        metrics.push({
          jurisdiction: state,
          domain: DOMAIN,
          metric_name: 'cost_per_day_detention',
          metric_value: costPerDay,
          metric_unit: 'dollars',
          period: year,
          cohort: 'all',
          source: SOURCE,
          source_url: SOURCE_URL,
          notes: 'Derived: detention expenditure / (avg daily number in detention * 365). ROGS Tables 17A.10 + 17A.1',
        });
      }

      if (data.expenditure_community && data.avg_daily_community && data.avg_daily_community > 0) {
        const costPerDay = Math.round(data.expenditure_community / (data.avg_daily_community * 365));
        metrics.push({
          jurisdiction: state,
          domain: DOMAIN,
          metric_name: 'cost_per_day_community',
          metric_value: costPerDay,
          metric_unit: 'dollars',
          period: year,
          cohort: 'all',
          source: SOURCE,
          source_url: SOURCE_URL,
          notes: 'Derived: community supervision expenditure / (avg daily number in community supervision * 365). ROGS Tables 17A.10 + 17A.1',
        });
      }
    }
  }

  return metrics;
}

// ── UPSERT via exec_sql RPC ──────────────────────────────

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function upsertMetrics(metrics) {
  log(`Upserting ${metrics.length} metrics...`);

  let inserted = 0;
  let errors = 0;
  const BATCH = 50;

  for (let i = 0; i < metrics.length; i += BATCH) {
    const batch = metrics.slice(i, i + BATCH);

    const values = batch.map(m =>
      `(${escapeSQL(m.jurisdiction)}, ${escapeSQL(m.domain)}, ${escapeSQL(m.metric_name)}, ${escapeSQL(m.metric_value)}, ${escapeSQL(m.metric_unit)}, ${escapeSQL(m.period)}, ${escapeSQL(m.cohort)}, ${escapeSQL(m.source)}, ${escapeSQL(m.source_url)}, ${escapeSQL(m.notes)})`
    ).join(',\n    ');

    const query = `
      INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, notes)
      VALUES
        ${values}
      ON CONFLICT (jurisdiction, domain, metric_name, period, cohort, source)
      DO UPDATE SET
        metric_value = EXCLUDED.metric_value,
        metric_unit = EXCLUDED.metric_unit,
        source_url = EXCLUDED.source_url,
        notes = EXCLUDED.notes;
    `;

    const { error } = await db.rpc('exec_sql', { query });

    if (error) {
      log(`  Batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`);
      errors++;
      // Try individual inserts as fallback
      for (const m of batch) {
        const singleQuery = `
          INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, notes)
          VALUES (${escapeSQL(m.jurisdiction)}, ${escapeSQL(m.domain)}, ${escapeSQL(m.metric_name)}, ${escapeSQL(m.metric_value)}, ${escapeSQL(m.metric_unit)}, ${escapeSQL(m.period)}, ${escapeSQL(m.cohort)}, ${escapeSQL(m.source)}, ${escapeSQL(m.source_url)}, ${escapeSQL(m.notes)})
          ON CONFLICT (jurisdiction, domain, metric_name, period, cohort, source)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            metric_unit = EXCLUDED.metric_unit,
            source_url = EXCLUDED.source_url,
            notes = EXCLUDED.notes;
        `;
        const { error: e2 } = await db.rpc('exec_sql', { query: singleQuery });
        if (!e2) inserted++;
        else log(`    Individual insert error: ${e2.message}`);
      }
    } else {
      inserted += batch.length;
    }
  }

  log(`  Upserted: ${inserted}, Errors: ${errors}`);
  return { inserted, errors };
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  log('================================================================');
  log('  ROGS Table 17A Scraper — Youth Justice');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('================================================================');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    // Phase 1: Load data
    const csvText = await loadCSVData();

    // Phase 2: Extract metrics
    const metrics = extractMetrics(csvText);
    log(`\n  Extracted ${metrics.length} metric records`);

    // Summary
    const byMetric = {};
    const byPeriod = {};
    for (const m of metrics) {
      byMetric[m.metric_name] = (byMetric[m.metric_name] || 0) + 1;
      byPeriod[m.period] = (byPeriod[m.period] || 0) + 1;
    }

    log('\n=== Metrics by type ===');
    for (const [name, count] of Object.entries(byMetric).sort()) {
      log(`  ${name.padEnd(30)} ${count} records`);
    }

    log('\n=== Records by period ===');
    for (const [period, count] of Object.entries(byPeriod).sort()) {
      log(`  ${period.padEnd(10)} ${count} records`);
    }

    // Show cost-per-day summary for latest year
    const latestYear = Object.keys(byPeriod).sort().pop();
    log(`\n=== Cost per day (${latestYear}) ===`);
    const latestCPD = metrics.filter(m => m.period === latestYear && m.metric_name.startsWith('cost_per_day'));
    for (const m of latestCPD.sort((a, b) => a.metric_name.localeCompare(b.metric_name) || a.jurisdiction.localeCompare(b.jurisdiction))) {
      log(`  ${m.jurisdiction.padEnd(10)} ${m.metric_name.padEnd(25)} $${m.metric_value.toLocaleString()}/day`);
    }

    // Phase 3: Upsert to database
    if (!DRY_RUN) {
      const result = await upsertMetrics(metrics);
      await logComplete(db, runId, {
        items_found: metrics.length,
        items_new: result.inserted,
      });
    } else {
      log('\n  (DRY RUN -- use without --dry-run to write to database)');
      await logComplete(db, runId, {
        items_found: metrics.length,
        items_new: 0,
      });
    }

    log('\nDone.');
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
