#!/usr/bin/env node
/**
 * scrape-aihw-yj.mjs
 *
 * Scrapes AIHW Youth Justice in Australia data and upserts into outcomes_metrics.
 *
 * Data source: https://www.aihw.gov.au/reports/youth-justice/youth-justice-in-australia-2023-24
 * The report embeds HTML data tables in its content pages.
 * Fallback: reads pre-downloaded Excel/CSV from data/aihw/
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-aihw-yj.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-aihw-yj';
const AGENT_NAME = 'AIHW Youth Justice Scraper';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── Constants ────────────────────────────────────────────

const REPORT_YEAR = '2023-24';
const SOURCE = `AIHW Youth Justice ${REPORT_YEAR}`;
const BASE_URL = 'https://www.aihw.gov.au/reports/youth-justice/youth-justice-in-australia-2023-24';
const SOURCE_URL = BASE_URL;

const JURISDICTIONS = ['NSW', 'Vic', 'Qld', 'WA', 'SA', 'Tas', 'ACT', 'NT', 'Australia'];

// Map AIHW jurisdiction labels to our canonical codes
const JURISDICTION_MAP = {
  'NSW': 'NSW',
  'Vic': 'VIC',
  'Vic.': 'VIC',
  'VIC': 'VIC',
  'Qld': 'QLD',
  'QLD': 'QLD',
  'WA': 'WA',
  'SA': 'SA',
  'Tas': 'TAS',
  'Tas.': 'TAS',
  'TAS': 'TAS',
  'ACT': 'ACT',
  'NT': 'NT',
  'Australia': 'National',
  'Aust': 'National',
  'Total': 'National',
};

// Report content pages to scrape
const CONTENT_PAGES = [
  '/contents/numbers-rates-young-people/national',
  '/contents/numbers-rates-young-people/states-and-territories',
  '/contents/first-nations-young-people-under-supervision/youth-justice-supervision',
  '/contents/first-nations-young-people-under-supervision/first-nations-young-people-in-detention',
  '/contents/first-nations-young-people-under-supervision/community-based-supervision',
  '/contents/first-nations-young-people-under-supervision/trends-in-supervision',
  '/contents/detention',
  '/contents/community-based-supervision',
  '/contents/summary',
];

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── HTML Parsing Helpers ─────────────────────────────────

/**
 * Parse HTML tables from page content.
 * Returns array of { caption, headers, rows } objects.
 */
function parseHtmlTables(html) {
  const tables = [];
  // Match table elements (non-greedy)
  const tableRegex = /<table[^>]*class="e-table-responsive"[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[0];

    // Extract caption
    const captionMatch = tableHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const caption = captionMatch ? stripHtml(captionMatch[1]).trim() : '';

    // Extract headers
    const headerMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    const headers = [];
    if (headerMatch) {
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      let th;
      while ((th = thRegex.exec(headerMatch[1])) !== null) {
        headers.push(stripHtml(th[1]).trim());
      }
    }

    // Extract rows
    const bodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const rows = [];
    if (bodyMatch) {
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let tr;
      while ((tr = trRegex.exec(bodyMatch[1])) !== null) {
        const cells = [];
        const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
        let cell;
        while ((cell = cellRegex.exec(tr[1])) !== null) {
          cells.push(stripHtml(cell[1]).trim());
        }
        if (cells.length > 0) rows.push(cells);
      }
    }

    if (headers.length > 0 || rows.length > 0) {
      tables.push({ caption, headers, rows });
    }
  }

  return tables;
}

function stripHtml(html) {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x2013;/g, '-')
    .replace(/\s+/g, ' ');
}

/**
 * Parse a numeric value, handling AIHW formatting quirks.
 * Returns null for n.a., n.p., .., -, etc.
 */
function parseNum(val) {
  if (!val) return null;
  const cleaned = val.replace(/\*/g, '').replace(/,/g, '').trim();
  if (['n.a.', 'n.p.', 'np', 'na', '..', '-', '—', ''].includes(cleaned.toLowerCase())) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract key data from narrative text on the page.
 * Returns array of metric objects.
 */
function extractFromNarrative(html) {
  const metrics = [];
  const text = stripHtml(html);

  // National detention rate
  const detRateMatch = text.match(/rate.*?detention.*?(\d+\.?\d*)\s*per\s*10[,.]?000/i)
    || text.match(/detention.*?rate.*?(\d+\.?\d*)\s*per\s*10[,.]?000/i);
  // National avg daily detention
  const avgDailyMatch = text.match(/average day.*?(\d[,\d]*)\s*(?:young people|were).*?detention/i)
    || text.match(/detention.*?average day.*?(\d[,\d]*)/i);
  // Pct unsentenced
  const unsentencedMatch = text.match(/(\d+)\s*(?:in 5|%|per cent).*?unsentenced/i)
    || text.match(/unsentenced.*?(\d+)\s*%/i);
  // First Nations overrepresentation
  const overrepMatch = text.match(/First Nations.*?(\d+)\s*times.*?(?:likely|counterpart)/i)
    || text.match(/(\d+)\s*times.*?likely.*?detention/i);
  // First Nations detention rate
  const fnDetRateMatch = text.match(/First Nations.*?detention.*?(\d+)\s*per\s*10[,.]?000/i)
    || text.match(/rate.*?First Nations.*?detention.*?(\d+)\s*per\s*10[,.]?000/i);
  // Non-Indigenous detention rate
  const nonFnDetRateMatch = text.match(/non-Indigenous.*?(\d+\.?\d*)\s*per\s*10[,.]?000/i);

  if (fnDetRateMatch) {
    metrics.push({
      jurisdiction: 'National',
      metric_name: 'detention_rate_per_10k',
      metric_value: parseNum(fnDetRateMatch[1]),
      metric_unit: 'per_10k',
      cohort: 'indigenous',
      notes: 'First Nations young people aged 10-17, average day',
    });
  }

  if (nonFnDetRateMatch) {
    metrics.push({
      jurisdiction: 'National',
      metric_name: 'detention_rate_per_10k',
      metric_value: parseNum(nonFnDetRateMatch[1]),
      metric_unit: 'per_10k',
      cohort: 'non_indigenous',
      notes: 'Non-Indigenous young people aged 10-17, average day',
    });
  }

  if (overrepMatch) {
    metrics.push({
      jurisdiction: 'National',
      metric_name: 'indigenous_overrepresentation_ratio',
      metric_value: parseNum(overrepMatch[1]),
      metric_unit: 'ratio',
      cohort: 'all',
      notes: 'Ratio of First Nations to non-Indigenous detention rate, average day',
    });
  }

  if (unsentencedMatch) {
    const val = parseNum(unsentencedMatch[1]);
    if (val !== null && val <= 100) {
      metrics.push({
        jurisdiction: 'National',
        metric_name: 'pct_unsentenced',
        metric_value: val,
        metric_unit: 'percentage',
        cohort: 'all',
        notes: 'Percentage of young people in detention who were unsentenced, average day',
      });
    }
  }

  return metrics;
}

// ── Phase 1: Scrape AIHW Report Pages ────────────────────

async function scrapeReportPages() {
  log('Phase 1: Fetching AIHW Youth Justice report pages...');
  const allMetrics = [];
  const seenKeys = new Set();

  for (const page of CONTENT_PAGES) {
    const url = `${BASE_URL}${page}`;
    log(`  Fetching: ${page}`);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
      });

      if (!res.ok) {
        log(`    HTTP ${res.status}, skipping`);
        continue;
      }

      const html = await res.text();

      // Parse HTML tables
      const tables = parseHtmlTables(html);
      log(`    Found ${tables.length} data tables`);

      for (const table of tables) {
        const tableMetrics = extractMetricsFromTable(table);
        for (const m of tableMetrics) {
          const key = `${m.jurisdiction}|${m.metric_name}|${m.cohort}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allMetrics.push(m);
          }
        }
      }

      // Extract from narrative text
      const narrativeMetrics = extractFromNarrative(html);
      for (const m of narrativeMetrics) {
        const key = `${m.jurisdiction}|${m.metric_name}|${m.cohort}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allMetrics.push(m);
        }
      }

      // Be polite — 500ms between requests
      await delay(500);
    } catch (err) {
      log(`    Error: ${err.message}`);
    }
  }

  log(`  Extracted ${allMetrics.length} metrics from report pages`);
  return allMetrics;
}

/**
 * Extract metrics from a parsed HTML table.
 */
function extractMetricsFromTable(table) {
  const { caption, headers, rows } = table;
  const metrics = [];
  const captionLower = (caption || '').toLowerCase();

  // Identify jurisdiction columns from headers
  const jurisdictionColumns = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].replace(/\*/g, '').trim();
    if (JURISDICTION_MAP[h]) {
      jurisdictionColumns.push({ index: i, jurisdiction: JURISDICTION_MAP[h] });
    }
  }

  if (jurisdictionColumns.length === 0) return metrics;

  // Determine if this is a rate table or number table
  const isRateTable = captionLower.includes('rate') || captionLower.includes('per 10,000');
  const isNumberTable = captionLower.includes('number') || (!isRateTable && captionLower.includes('young people'));

  for (const row of rows) {
    if (row.length < 2) continue;
    const rowLabel = row[0].toLowerCase().replace(/\*/g, '').trim();

    // Map row labels to metric names
    let metricName = null;
    let metricUnit = null;
    let cohort = 'all';

    if (rowLabel.includes('detention') && rowLabel.includes('average day')) {
      if (isRateTable) {
        metricName = 'detention_rate_per_10k';
        metricUnit = 'per_10k';
      } else {
        metricName = 'avg_daily_detention';
        metricUnit = 'count';
      }
    } else if (rowLabel.includes('community') && rowLabel.includes('average day')) {
      if (isRateTable) {
        metricName = 'community_supervision_rate_per_10k';
        metricUnit = 'per_10k';
      } else {
        metricName = 'avg_daily_community_supervision';
        metricUnit = 'count';
      }
    } else if (rowLabel.includes('all supervision') && rowLabel.includes('average day')) {
      if (isRateTable) {
        metricName = 'supervision_rate_per_10k';
        metricUnit = 'per_10k';
      } else {
        metricName = 'avg_daily_supervision';
        metricUnit = 'count';
      }
    } else if (rowLabel.includes('detention') && rowLabel.includes('during the year')) {
      if (isRateTable) {
        metricName = 'detention_rate_during_year_per_10k';
        metricUnit = 'per_10k';
      } else {
        metricName = 'detention_during_year';
        metricUnit = 'count';
      }
    } else if (rowLabel.includes('community') && rowLabel.includes('during the year')) {
      if (isRateTable) {
        metricName = 'community_rate_during_year_per_10k';
        metricUnit = 'per_10k';
      } else {
        metricName = 'community_during_year';
        metricUnit = 'count';
      }
    } else if (rowLabel.includes('all supervision') && rowLabel.includes('during the year')) {
      if (isRateTable) {
        metricName = 'supervision_rate_during_year_per_10k';
        metricUnit = 'per_10k';
      } else {
        metricName = 'supervision_during_year';
        metricUnit = 'count';
      }
    }

    // Check if this is a First Nations table
    if (captionLower.includes('first nations') || captionLower.includes('indigenous')) {
      // Look for rate ratio rows
      if (rowLabel.includes('rate ratio') || rowLabel.includes('overrepresentation')) {
        metricName = 'indigenous_overrepresentation_ratio';
        metricUnit = 'ratio';
        cohort = 'all';
      } else if (rowLabel.includes('first nations') || rowLabel.includes('indigenous')) {
        cohort = 'indigenous';
      } else if (rowLabel.includes('non-indigenous') || rowLabel.includes('non indigenous')) {
        cohort = 'non_indigenous';
      }
    }

    if (!metricName) continue;

    for (const { index, jurisdiction } of jurisdictionColumns) {
      if (index >= row.length) continue;
      const value = parseNum(row[index]);
      if (value === null) continue;

      metrics.push({
        jurisdiction,
        metric_name: metricName,
        metric_value: value,
        metric_unit: metricUnit,
        cohort,
        notes: caption || null,
      });
    }
  }

  return metrics;
}

// ── Phase 2: Local File Fallback ─────────────────────────

async function loadLocalData() {
  log('Phase 2: Checking for local AIHW data files...');
  const dataDir = join(process.cwd(), 'data', 'aihw');

  let files;
  try {
    files = await readdir(dataDir);
  } catch {
    log('  No data/aihw/ directory found');
    return [];
  }

  const metrics = [];
  const xlsxFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  const csvFiles = files.filter(f => f.endsWith('.csv'));

  if (xlsxFiles.length > 0) {
    log(`  Found ${xlsxFiles.length} Excel files`);
    try {
      const XLSX = await import('xlsx');

      for (const file of xlsxFiles) {
        log(`  Processing: ${file}`);
        const filePath = join(dataDir, file);
        const buf = await readFile(filePath);
        const workbook = XLSX.read(buf, { type: 'buffer' });

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const sheetMetrics = extractMetricsFromSpreadsheet(data, sheetName, file);
          metrics.push(...sheetMetrics);
        }
      }
    } catch (err) {
      log(`  Error reading Excel files: ${err.message}`);
    }
  }

  if (csvFiles.length > 0) {
    log(`  Found ${csvFiles.length} CSV files`);
    for (const file of csvFiles) {
      log(`  Processing: ${file}`);
      const filePath = join(dataDir, file);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = [headers, ...lines.slice(1).map(line => {
        const cells = [];
        let current = '';
        let inQuote = false;
        for (const char of line) {
          if (char === '"') { inQuote = !inQuote; continue; }
          if (char === ',' && !inQuote) { cells.push(current.trim()); current = ''; continue; }
          current += char;
        }
        cells.push(current.trim());
        return cells;
      })];
      const sheetMetrics = extractMetricsFromSpreadsheet(data, file, file);
      metrics.push(...sheetMetrics);
    }
  }

  log(`  Extracted ${metrics.length} metrics from local files`);
  return metrics;
}

/**
 * Extract metrics from spreadsheet data (array of arrays).
 * AIHW data tables typically have jurisdictions as columns.
 */
function extractMetricsFromSpreadsheet(data, sheetName, fileName) {
  const metrics = [];
  if (data.length < 2) return metrics;

  const sheetLower = (sheetName || '').toLowerCase();
  const fileLower = (fileName || '').toLowerCase();

  // Find header row (the one with jurisdiction names)
  let headerRowIdx = -1;
  let jurisdictionCols = [];

  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    if (!row) continue;
    const matches = [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim();
      if (JURISDICTION_MAP[cell]) {
        matches.push({ index: j, jurisdiction: JURISDICTION_MAP[cell] });
      }
    }
    if (matches.length >= 3) {
      headerRowIdx = i;
      jurisdictionCols = matches;
      break;
    }
  }

  if (headerRowIdx < 0) return metrics;

  // Determine table type from sheet/file name
  const isDetention = sheetLower.includes('detention') || sheetLower.includes('s72') || sheetLower.includes('s75');
  const isCommunity = sheetLower.includes('community') || sheetLower.includes('s34') || sheetLower.includes('s37');
  const isFirstNations = sheetLower.includes('indigenous') || sheetLower.includes('first nations')
    || fileLower.includes('indigenous') || fileLower.includes('first nations');

  // Process data rows
  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const rowLabel = String(row[0]).toLowerCase().trim();

    // Map row labels to metrics (spreadsheet labels vary)
    let metricName = null;
    let metricUnit = null;
    let cohort = isFirstNations ? 'indigenous' : 'all';

    if (rowLabel.includes('rate') && rowLabel.includes('10,000')) {
      if (isDetention) {
        metricName = 'detention_rate_per_10k';
      } else if (isCommunity) {
        metricName = 'community_supervision_rate_per_10k';
      } else {
        metricName = 'supervision_rate_per_10k';
      }
      metricUnit = 'per_10k';
    } else if (rowLabel.includes('average') && rowLabel.includes('day') && rowLabel.includes('number')) {
      if (isDetention) {
        metricName = 'avg_daily_detention';
      } else if (isCommunity) {
        metricName = 'avg_daily_community_supervision';
      } else {
        metricName = 'avg_daily_supervision';
      }
      metricUnit = 'count';
    } else if (rowLabel.includes('rate ratio')) {
      metricName = 'indigenous_overrepresentation_ratio';
      metricUnit = 'ratio';
      cohort = 'all';
    } else if (rowLabel.includes('average') && rowLabel.includes('length') && rowLabel.includes('detention')) {
      metricName = 'avg_days_in_detention';
      metricUnit = 'days';
    } else if (rowLabel.includes('unsentenced') && rowLabel.includes('%')) {
      metricName = 'pct_unsentenced';
      metricUnit = 'percentage';
    }

    if (!metricName) continue;

    for (const { index, jurisdiction } of jurisdictionCols) {
      if (index >= row.length) continue;
      const value = parseNum(String(row[index] || ''));
      if (value === null) continue;

      metrics.push({
        jurisdiction,
        metric_name: metricName,
        metric_value: value,
        metric_unit: metricUnit,
        cohort,
        notes: `Sheet: ${sheetName}`,
      });
    }
  }

  return metrics;
}

// ── Phase 3: Upsert into outcomes_metrics ────────────────

async function upsertMetrics(metrics) {
  if (metrics.length === 0) {
    log('No metrics to upsert');
    return { inserted: 0, errors: 0 };
  }

  log(`\nPhase 3: Upserting ${metrics.length} metrics into outcomes_metrics...`);

  if (DRY_RUN) {
    log('  DRY RUN — showing first 10 metrics:');
    for (const m of metrics.slice(0, 10)) {
      log(`    ${m.jurisdiction} | ${m.metric_name} | ${m.metric_value} ${m.metric_unit} | ${m.cohort}`);
    }
    log(`  ... and ${Math.max(0, metrics.length - 10)} more`);
    return { inserted: metrics.length, errors: 0 };
  }

  let inserted = 0;
  let errors = 0;
  const BATCH = 20;

  for (let i = 0; i < metrics.length; i += BATCH) {
    const batch = metrics.slice(i, i + BATCH);

    // Build SQL VALUES for upsert
    const values = batch.map(m => {
      const jurisdiction = escapeSql(m.jurisdiction);
      const domain = 'youth-justice';
      const metricName = escapeSql(m.metric_name);
      const metricValue = m.metric_value;
      const metricUnit = escapeSql(m.metric_unit || '');
      const period = escapeSql(REPORT_YEAR);
      const cohort = m.cohort ? escapeSql(m.cohort) : 'NULL';
      const source = escapeSql(SOURCE);
      const sourceUrl = escapeSql(SOURCE_URL);
      const notes = m.notes ? escapeSql(m.notes) : 'NULL';

      return `('${jurisdiction}', '${domain}', '${metricName}', ${metricValue}, '${metricUnit}', '${period}', ${cohort === 'NULL' ? 'NULL' : `'${cohort}'`}, '${source}', '${sourceUrl}', ${notes === 'NULL' ? 'NULL' : `'${notes}'`})`;
    }).join(',\n');

    const sql = `
      INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, notes)
      VALUES ${values}
      ON CONFLICT (jurisdiction, domain, metric_name, period, cohort, source)
      DO UPDATE SET
        metric_value = EXCLUDED.metric_value,
        metric_unit = EXCLUDED.metric_unit,
        source_url = EXCLUDED.source_url,
        notes = EXCLUDED.notes
    `;

    const { error } = await db.rpc('exec_sql', { query: sql });

    if (error) {
      log(`  Batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`);
      // Fall back to individual inserts
      for (const m of batch) {
        const singleSql = `
          INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, notes)
          VALUES ('${escapeSql(m.jurisdiction)}', 'youth-justice', '${escapeSql(m.metric_name)}', ${m.metric_value}, '${escapeSql(m.metric_unit || '')}', '${escapeSql(REPORT_YEAR)}', ${m.cohort ? `'${escapeSql(m.cohort)}'` : 'NULL'}, '${escapeSql(SOURCE)}', '${escapeSql(SOURCE_URL)}', ${m.notes ? `'${escapeSql(m.notes)}'` : 'NULL'})
          ON CONFLICT (jurisdiction, domain, metric_name, period, cohort, source)
          DO UPDATE SET metric_value = EXCLUDED.metric_value, metric_unit = EXCLUDED.metric_unit, source_url = EXCLUDED.source_url, notes = EXCLUDED.notes
        `;
        const { error: e2 } = await db.rpc('exec_sql', { query: singleSql });
        if (e2) {
          errors++;
          log(`    Error: ${m.jurisdiction}/${m.metric_name}: ${e2.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  log(`  Upserted ${inserted} metrics (${errors} errors)`);
  return { inserted, errors };
}

function escapeSql(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/'/g, "''");
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  log('==================================================');
  log('  AIHW Youth Justice Scraper');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('==================================================');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    // Phase 1: Try scraping the AIHW website
    let metrics = await scrapeReportPages();

    // Phase 2: If scraping got few results, supplement with local data
    if (metrics.length < 10) {
      log('\n  Few metrics from web scrape, checking local files...');
      const localMetrics = await loadLocalData();
      if (localMetrics.length > 0) {
        // Merge: local data fills gaps, web data takes precedence
        const seenKeys = new Set(metrics.map(m =>
          `${m.jurisdiction}|${m.metric_name}|${m.cohort}`
        ));
        for (const m of localMetrics) {
          const key = `${m.jurisdiction}|${m.metric_name}|${m.cohort}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            metrics.push(m);
          }
        }
        log(`  Combined: ${metrics.length} metrics total`);
      }
    }

    // Phase 3: Upsert
    const { inserted, errors } = await upsertMetrics(metrics);

    // Summary
    log('\n--- Summary ---');
    log(`  Metrics found: ${metrics.length}`);
    log(`  Metrics upserted: ${inserted}`);
    log(`  Errors: ${errors}`);

    // Group by metric
    const byMetric = {};
    for (const m of metrics) {
      byMetric[m.metric_name] = (byMetric[m.metric_name] || 0) + 1;
    }
    log('\n  By metric:');
    for (const [name, count] of Object.entries(byMetric).sort((a, b) => b[1] - a[1])) {
      log(`    ${name}: ${count} values`);
    }

    await logComplete(db, runId, {
      items_found: metrics.length,
      items_new: inserted,
    });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
