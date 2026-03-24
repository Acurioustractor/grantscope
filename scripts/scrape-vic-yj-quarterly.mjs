#!/usr/bin/env node
/**
 * scrape-vic-yj-quarterly.mjs
 *
 * Scrapes VIC DJCS Youth Justice quarterly incident + isolation reports.
 * Source: https://www.justice.vic.gov.au/justice-system/youth-justice/youth-justice-reviews-and-reporting
 *
 * ~38 incident reports + ~18 isolation reports from 2019 to Q3 2024-25.
 * HTML tables with simple structure: incident type → count per quarter.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-vic-yj-quarterly.mjs --dry-run
 *   node --env-file=.env scripts/scrape-vic-yj-quarterly.mjs
 */

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const BASE = 'https://www.justice.vic.gov.au';
const SOURCE = 'VIC DJCS Youth Justice Quarterly Reports';
const SOURCE_URL = 'https://www.justice.vic.gov.au/justice-system/youth-justice/youth-justice-reviews-and-reporting';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

function fetchPage(url) {
  try {
    return execSync(
      `curl -sL -A "${UA}" -H "Accept: text/html" "${url}"`,
      { encoding: 'utf-8', timeout: 15000 }
    );
  } catch {
    return '';
  }
}

// Parse quarter period from page content (more reliable than URL)
// Returns FY period like "2024-25Q3"
function parseQuarter(url, html) {
  // Primary: extract from table title/header in page content
  // Matches "Quarter 3 – 2024-25" or "Quarter 3 - 2024-25"
  const fyQtrMatch = html.match(/Quarter\s+(\d)\s*[-–—]\s*(\d{4})-(\d{2})/i);
  if (fyQtrMatch) {
    return `${fyQtrMatch[2]}-${fyQtrMatch[3]}Q${fyQtrMatch[1]}`;
  }

  // Match "Quarter 3 – January 2025 to March 2025" style
  const monthQtrMatch = html.match(/Quarter\s+(\d)\s*[-–—]\s*\w+\s+(\d{4})\s+to\s+\w+\s+(\d{4})/i);
  if (monthQtrMatch) {
    const q = monthQtrMatch[1];
    const endYear = parseInt(monthQtrMatch[3]);
    let fyStart, fyEnd;
    if (['1', '2'].includes(q)) {
      fyStart = endYear;
      fyEnd = (endYear + 1).toString().slice(2);
    } else {
      fyStart = endYear - 1;
      fyEnd = endYear.toString().slice(2);
    }
    return `${fyStart}-${fyEnd}Q${q}`;
  }

  // Match month range + year from page: "1 January 2025 to 31 March 2025"
  const dateRangeMatch = html.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+to\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (dateRangeMatch) {
    const endMonth = dateRangeMatch[5].toLowerCase();
    const endYear = parseInt(dateRangeMatch[6]);
    let q;
    if (endMonth === 'september') q = '1';
    else if (endMonth === 'december') q = '2';
    else if (endMonth === 'march') q = '3';
    else if (endMonth === 'june') q = '4';
    if (q) {
      let fyStart, fyEnd;
      if (['1', '2'].includes(q)) {
        fyStart = endYear;
        fyEnd = (endYear + 1).toString().slice(2);
      } else {
        fyStart = endYear - 1;
        fyEnd = endYear.toString().slice(2);
      }
      return `${fyStart}-${fyEnd}Q${q}`;
    }
  }

  // Match table title: "quarter 4, 2016-17" or "quarter 4 2016-17"
  const tableTitleMatch = html.match(/quarter\s+(\d)[,\s]+(\d{4})-(\d{2})/i);
  if (tableTitleMatch) {
    return `${tableTitleMatch[2]}-${tableTitleMatch[3]}Q${tableTitleMatch[1]}`;
  }

  // Match "Quarter 3, 1 January to 31 March 2020" style
  const qDateMatch = html.match(/quarter\s+(\d)[,\s]+\d{1,2}\s+\w+\s+\d{4}\s+to\s+\d{1,2}\s+\w+\s+(\d{4})/i);
  if (qDateMatch) {
    const q = qDateMatch[1];
    const endYear = parseInt(qDateMatch[2]);
    let fyStart, fyEnd;
    if (['1', '2'].includes(q)) {
      fyStart = endYear;
      fyEnd = (endYear + 1).toString().slice(2);
    } else {
      fyStart = endYear - 1;
      fyEnd = endYear.toString().slice(2);
    }
    return `${fyStart}-${fyEnd}Q${q}`;
  }

  // Fallback: try URL month + year
  const months = url.toLowerCase();
  let q;
  if (months.includes('july') && months.includes('september')) q = '1';
  else if (months.includes('october') && months.includes('december')) q = '2';
  else if (months.includes('january') && months.includes('march')) q = '3';
  else if (months.includes('april') && months.includes('june')) q = '4';

  // Get year from end of URL
  const urlYear = url.match(/(\d{4})\s*$/)?.[1];
  if (q && urlYear) {
    const y = parseInt(urlYear);
    let fyStart, fyEnd;
    if (['1', '2'].includes(q)) {
      fyStart = y;
      fyEnd = (y + 1).toString().slice(2);
    } else {
      fyStart = y - 1;
      fyEnd = y.toString().slice(2);
    }
    return `${fyStart}-${fyEnd}Q${q}`;
  }

  return null;
}

// Extract table data from HTML
function extractTables(html) {
  const tables = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[1];
    const rows = [];

    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const cells = [];
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        // Strip HTML tags and clean
        const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        cells.push(text);
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 1) tables.push(rows);
  }
  return tables;
}

// Map incident type text to metric name
function mapIncidentType(text) {
  const t = text.toLowerCase().trim();
  if (t.includes('client death') || t === 'death') return 'vic_yj_deaths';
  if (t === 'assault' || t === 'assaults') return 'vic_yj_assaults';
  if (t === 'behaviour' || t.includes('behaviour')) return 'vic_yj_behaviour_incidents';
  if (t.includes('other incident') || t === 'other') return 'vic_yj_other_incidents';
  if (t === 'total' || t.includes('total')) return 'vic_yj_total_incidents';
  // Isolation types
  if (t.includes('behavioural') && (t.includes('isolation') || t.includes('488(2)'))) return 'vic_yj_isolation_behavioural';
  if (t.includes('security') || t.includes('488(7)')) return 'vic_yj_isolation_security';
  if (t.includes('covid') || t.includes('infectious') || t.includes('600m')) return 'vic_yj_isolation_covid';
  if (t.includes('total isolation') || t.includes('total')) return 'vic_yj_isolation_total';
  return null;
}

// ---- Main ----

log('Fetching VIC DJCS quarterly report index...');
const indexHtml = fetchPage(SOURCE_URL);
if (!indexHtml || indexHtml.length < 1000) {
  log('ERROR: Could not fetch index page');
  process.exit(1);
}

// Extract all report URLs
const incidentUrls = [];
const isolationUrls = [];

const linkRegex = /href="(\/[^"]*(?:incident|isolat)[^"]*)"/gi;
let linkMatch;
while ((linkMatch = linkRegex.exec(indexHtml)) !== null) {
  const path = linkMatch[1];
  if (path.includes('isolat')) isolationUrls.push(path);
  else incidentUrls.push(path);
}

// Deduplicate
const uniqueIncident = [...new Set(incidentUrls)].sort();
const uniqueIsolation = [...new Set(isolationUrls)].sort();

log(`  Found ${uniqueIncident.length} incident report URLs`);
log(`  Found ${uniqueIsolation.length} isolation report URLs`);

const metrics = [];
let scraped = 0;
let failed = 0;

// Scrape all reports
for (const [label, urls, reportType] of [
  ['incident', uniqueIncident, 'incident'],
  ['isolation', uniqueIsolation, 'isolation'],
]) {
  log(`\nScraping ${label} reports...`);

  for (const path of urls) {
    const url = `${BASE}${path}`;
    const html = fetchPage(url);

    if (!html || html.length < 500) {
      log(`  SKIP (403/empty): ${path.slice(-60)}`);
      failed++;
      continue;
    }

    const period = parseQuarter(path, html);
    if (!period) {
      log(`  SKIP (no period): ${path.slice(-60)}`);
      failed++;
      continue;
    }

    const tables = extractTables(html);
    if (tables.length === 0) {
      log(`  SKIP (no tables): ${path.slice(-60)}`);
      failed++;
      continue;
    }

    let count = 0;
    for (const table of tables) {
      for (const row of table.slice(1)) { // skip header
        if (row.length < 2) continue;
        const metricName = mapIncidentType(row[0]);
        if (!metricName) continue;

        const value = parseFloat(row[row.length - 1].replace(/,/g, ''));
        if (isNaN(value)) continue;

        metrics.push({
          jurisdiction: 'VIC',
          domain: 'youth-justice',
          metric_name: metricName,
          metric_value: value,
          metric_unit: 'count',
          period,
          cohort: 'all',
          source: SOURCE,
          source_url: url,
          source_table: reportType === 'incident' ? 'Cat 1 Incidents' : 'Isolation Episodes',
          notes: `${row[0]}, ${period}`,
        });
        count++;
      }
    }

    log(`  ${period}: ${count} metrics (${path.slice(-50)})`);
    scraped++;

    // Be polite — small delay between requests
    execSync('sleep 0.5');
  }
}

log(`\nScraped: ${scraped} reports, Failed: ${failed}`);
log(`Total metrics extracted: ${metrics.length}`);

const byMetric = {};
for (const m of metrics) byMetric[m.metric_name] = (byMetric[m.metric_name] || 0) + 1;
log('By metric:');
for (const [k, v] of Object.entries(byMetric).sort((a, b) => b[1] - a[1])) {
  log(`  ${k}: ${v}`);
}

// Save raw data
writeFileSync('data/aihw/vic-yj-quarterly.json', JSON.stringify(metrics, null, 2));
log(`\nSaved to data/aihw/vic-yj-quarterly.json`);

if (DRY_RUN) {
  log(`\nDRY RUN — would insert ${metrics.length} metrics`);
  for (const m of metrics.slice(0, 5)) {
    log(`  ${m.metric_name} | ${m.period} | ${m.metric_value}`);
  }
} else {
  log('\nInserting into outcomes_metrics...');

  const values = metrics.map(m => {
    const notes = (m.notes || '').replace(/'/g, "''");
    const source = m.source.replace(/'/g, "''");
    const sourceUrl = m.source_url.replace(/'/g, "''");
    return `('${m.jurisdiction}', '${m.domain}', '${m.metric_name}', ${m.metric_value}, '${m.metric_unit}', '${m.period}', '${m.cohort}', '${source}', '${sourceUrl}', '${m.source_table}', '${notes}')`;
  });

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < values.length; i += BATCH) {
    const batch = values.slice(i, i + BATCH);
    const sql = `INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, source_table, notes)
VALUES ${batch.join(',\n')}
ON CONFLICT DO NOTHING;`;

    writeFileSync('/tmp/vic-yj-import-batch.sql', sql);
    const result = psql(`\\i /tmp/vic-yj-import-batch.sql`);
    if (result.includes('ERROR')) {
      log(`  Batch error: ${result.slice(0, 200)}`);
    } else {
      const countMatch = result.match(/INSERT 0 (\d+)/);
      inserted += countMatch ? parseInt(countMatch[1]) : batch.length;
    }
  }

  log(`  Inserted ${inserted} metrics`);
  psql(`INSERT INTO agent_runs (agent_id, agent_name, status, items_found, items_new, started_at, completed_at) VALUES ('scrape-vic-yj-quarterly', 'VIC YJ Quarterly Scraper', 'success', ${metrics.length}, ${inserted}, NOW() - INTERVAL '2 minutes', NOW())`);
}

log('\n======================================================');
log(`  VIC Youth Justice Quarterly Reports — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
log(`  Reports scraped: ${scraped}`);
log(`  Metrics: ${metrics.length}`);
log(`  Source: ${SOURCE_URL}`);
log('======================================================');
