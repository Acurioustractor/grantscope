#!/usr/bin/env node
/**
 * scrape-aihw-disability.mjs
 *
 * Scrapes AIHW People with Disability in Australia report and upserts into outcomes_metrics.
 *
 * Data source: https://www.aihw.gov.au/reports/disability/people-with-disability-in-australia
 * The report embeds HTML data tables in its content pages.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-aihw-disability.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-aihw-disability';
const AGENT_NAME = 'AIHW Disability Scraper';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── Constants ────────────────────────────────────────────

const SOURCE = 'AIHW People with Disability 2024';
const BASE_URL = 'https://www.aihw.gov.au/reports/disability/people-with-disability-in-australia';

const CONTENT_PAGES = [
  '/contents/summary',
  '/contents/people-with-disability/prevalence-of-disability',
  '/contents/people-with-disability/activities-people-need-help-with',
  '/contents/health/health-status',
  '/contents/health/risk-factors',
  '/contents/social-support/specialist-disability-support-services',
  '/contents/justice-and-safety/discrimination',
  '/contents/justice-and-safety/violence',
  '/contents/housing/housing-type-and-living-arrangements',
  '/contents/housing/housing-needs-and-assistance',
  '/contents/housing/homelessness',
  '/contents/education-and-skills/engagement-in-education',
  '/contents/education-and-skills/educational-attainment',
  '/contents/employment/labour-force-participation',
  '/contents/employment/unemployment',
  '/contents/income-and-finance/earnings-and-income',
];

const JURISDICTION_MAP = {
  'NSW': 'NSW', 'New South Wales': 'NSW',
  'Vic': 'VIC', 'Vic.': 'VIC', 'VIC': 'VIC', 'Victoria': 'VIC',
  'Qld': 'QLD', 'QLD': 'QLD', 'Queensland': 'QLD',
  'WA': 'WA', 'Western Australia': 'WA',
  'SA': 'SA', 'South Australia': 'SA',
  'Tas': 'TAS', 'Tas.': 'TAS', 'TAS': 'TAS', 'Tasmania': 'TAS',
  'ACT': 'ACT', 'Australian Capital Territory': 'ACT',
  'NT': 'NT', 'Northern Territory': 'NT',
  'Australia': 'National', 'Aust': 'National', 'Total': 'National',
};

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── HTML Parsing Helpers ─────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x2013;/g, '-')
    .replace(/\s+/g, ' ');
}

function parseNum(val) {
  if (!val) return null;
  const cleaned = val.replace(/\*/g, '').replace(/,/g, '').trim();
  if (['n.a.', 'n.p.', 'np', 'na', '..', '-', '—', ''].includes(cleaned.toLowerCase())) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseHtmlTables(html) {
  const tables = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[0];
    const captionMatch = tableHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const caption = captionMatch ? stripHtml(captionMatch[1]).trim() : '';

    const headerMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    const headers = [];
    if (headerMatch) {
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      let th;
      while ((th = thRegex.exec(headerMatch[1])) !== null) {
        headers.push(stripHtml(th[1]).trim());
      }
    }

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

// ── Metric Extraction ────────────────────────────────────

function extractMetricsFromTable(table, pageContext) {
  const { caption, headers, rows } = table;
  const metrics = [];
  const captionLower = (caption || '').toLowerCase();
  const contextLower = (pageContext || '').toLowerCase();

  // Find jurisdiction columns
  const jurisdictionColumns = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].replace(/\*/g, '').replace(/\([a-z]\)/gi, '').trim();
    if (JURISDICTION_MAP[h]) {
      jurisdictionColumns.push({ index: i, jurisdiction: JURISDICTION_MAP[h] });
    }
  }

  // Determine metric domain from page context
  let metricPrefix = 'dis';
  if (contextLower.includes('prevalence')) metricPrefix = 'dis_prevalence';
  else if (contextLower.includes('health')) metricPrefix = 'dis_health';
  else if (contextLower.includes('employment') || contextLower.includes('labour')) metricPrefix = 'dis_employment';
  else if (contextLower.includes('education')) metricPrefix = 'dis_education';
  else if (contextLower.includes('housing') || contextLower.includes('homelessness')) metricPrefix = 'dis_housing';
  else if (contextLower.includes('justice') || contextLower.includes('violence') || contextLower.includes('discrimination')) metricPrefix = 'dis_justice';
  else if (contextLower.includes('income') || contextLower.includes('earning')) metricPrefix = 'dis_income';
  else if (contextLower.includes('support') || contextLower.includes('specialist')) metricPrefix = 'dis_services';

  const isPercentTable = captionLower.includes('per cent') || captionLower.includes('proportion') || captionLower.includes('percentage');
  const isRateTable = captionLower.includes('rate') || captionLower.includes('per 1,000');

  // Strategy 1: jurisdiction columns present
  if (jurisdictionColumns.length > 0) {
    for (const row of rows) {
      if (row.length < 2) continue;
      const rowLabel = row[0].replace(/\*/g, '').trim();
      if (!rowLabel || rowLabel.toLowerCase() === 'number' || rowLabel.toLowerCase() === 'per cent') continue;

      const metricName = `${metricPrefix}_${rowLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`;
      const metricUnit = isRateTable ? 'rate_per_1000' : isPercentTable ? 'percent' : 'count';

      for (const { index, jurisdiction } of jurisdictionColumns) {
        const val = parseNum(row[index]);
        if (val == null) continue;
        metrics.push({
          jurisdiction,
          metric_name: metricName,
          metric_value: val,
          metric_unit: metricUnit,
          cohort: 'all',
          notes: `${caption} — ${rowLabel}`,
        });
      }
    }
    return metrics;
  }

  // Strategy 2: year columns — extract national-level time series
  let yearCols = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim();
    if (/^\d{4}(-\d{2})?$/.test(h) || /^\d{4}[–-]\d{2}$/.test(h)) {
      yearCols.push({ index: i, year: h.replace('–', '-') });
    }
  }

  if (yearCols.length > 0) {
    // Use only the most recent year
    const latestYear = yearCols[yearCols.length - 1];
    for (const row of rows) {
      if (row.length < 2) continue;
      const rowLabel = row[0].replace(/\*/g, '').trim();
      if (!rowLabel) continue;

      const val = parseNum(row[latestYear.index]);
      if (val == null) continue;

      const metricName = `${metricPrefix}_${rowLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`;
      const metricUnit = isPercentTable ? 'percent' : 'count';

      metrics.push({
        jurisdiction: 'National',
        metric_name: metricName,
        metric_value: val,
        metric_unit: metricUnit,
        cohort: 'all',
        notes: `${caption} — ${rowLabel} (${latestYear.year})`,
      });
    }
  }

  // Strategy 3: simple 2-column or category tables
  if (jurisdictionColumns.length === 0 && yearCols.length === 0 && rows.length > 0) {
    for (const row of rows) {
      if (row.length < 2) continue;
      const label = row[0].replace(/\*/g, '').trim();
      const val = parseNum(row[row.length - 1]); // take last column
      if (!label || val == null) continue;

      const metricName = `${metricPrefix}_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`;
      metrics.push({
        jurisdiction: 'National',
        metric_name: metricName,
        metric_value: val,
        metric_unit: isPercentTable ? 'percent' : 'count',
        cohort: 'all',
        notes: `${caption} — ${label}`,
      });
    }
  }

  return metrics;
}

function extractFromNarrative(html) {
  const metrics = [];
  const text = stripHtml(html);

  // Prevalence
  const prevMatch = text.match(/(\d+\.?\d*)\s*(?:per cent|%)\s*.*?(?:had a disability|people with disability)/i);
  if (prevMatch) {
    metrics.push({
      jurisdiction: 'National',
      metric_name: 'dis_prevalence_pct',
      metric_value: parseNum(prevMatch[1]),
      metric_unit: 'percent',
      cohort: 'all',
      notes: 'Disability prevalence from narrative',
    });
  }

  // Number of people
  const countMatch = text.match(/(\d[\d.]*)\s*million\s*(?:people|Australians).*?disabilit/i);
  if (countMatch) {
    metrics.push({
      jurisdiction: 'National',
      metric_name: 'dis_total_people_millions',
      metric_value: parseNum(countMatch[1]),
      metric_unit: 'millions',
      cohort: 'all',
      notes: 'Total people with disability from narrative',
    });
  }

  // Employment rate
  const empMatch = text.match(/employment.*?rate.*?(\d+\.?\d*)\s*(?:per cent|%)/i)
    || text.match(/(\d+\.?\d*)\s*(?:per cent|%).*?employment.*?rate/i);
  if (empMatch) {
    metrics.push({
      jurisdiction: 'National',
      metric_name: 'dis_employment_rate',
      metric_value: parseNum(empMatch[1]),
      metric_unit: 'percent',
      cohort: 'disability',
      notes: 'Employment rate for people with disability from narrative',
    });
  }

  return metrics;
}

// ── Main Scrape Logic ────────────────────────────────────

async function scrapeReportPages() {
  log('Fetching AIHW People with Disability report pages...');
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

      const tables = parseHtmlTables(html);
      log(`    Found ${tables.length} data tables`);

      for (const table of tables) {
        const tableMetrics = extractMetricsFromTable(table, page);
        for (const m of tableMetrics) {
          const key = `${m.jurisdiction}|${m.metric_name}|${m.cohort}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allMetrics.push(m);
          }
        }
      }

      const narrativeMetrics = extractFromNarrative(html);
      for (const m of narrativeMetrics) {
        const key = `${m.jurisdiction}|${m.metric_name}|${m.cohort}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allMetrics.push(m);
        }
      }

      await delay(500);
    } catch (err) {
      log(`    Error: ${err.message}`);
    }
  }

  log(`Extracted ${allMetrics.length} metrics from report pages`);
  return allMetrics;
}

// ── Upsert to outcomes_metrics ───────────────────────────

async function upsertMetrics(metrics) {
  const records = metrics.map(m => ({
    jurisdiction: m.jurisdiction,
    domain: 'disability',
    metric_name: m.metric_name,
    metric_value: m.metric_value,
    metric_unit: m.metric_unit,
    period: '2022',
    cohort: m.cohort || 'all',
    source: SOURCE,
    notes: m.notes || null,
  }));

  if (DRY_RUN) {
    log(`DRY RUN — would upsert ${records.length} records`);
    const byJurisdiction = {};
    for (const r of records) {
      byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + 1;
    }
    for (const [j, c] of Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])) {
      log(`  ${j}: ${c} metrics`);
    }
    for (const r of records.slice(0, 10)) {
      log(`  ${r.jurisdiction} | ${r.metric_name} | ${r.metric_value} ${r.metric_unit}`);
    }
    return records.length;
  }

  let upserted = 0;
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await db.from('outcomes_metrics').upsert(batch, {
      onConflict: 'jurisdiction,domain,metric_name,period,cohort,source',
    });
    if (error) {
      log(`  Batch error: ${error.message}`);
      for (const rec of batch) {
        const { error: e2 } = await db.from('outcomes_metrics').upsert(rec, {
          onConflict: 'jurisdiction,domain,metric_name,period,cohort,source',
        });
        if (!e2) upserted++;
        else log(`    Failed: ${rec.metric_name}: ${e2.message}`);
      }
    } else {
      upserted += batch.length;
    }
  }

  log(`Upserted ${upserted}/${records.length} metrics`);
  return upserted;
}

// ── Run ──────────────────────────────────────────────────

async function run() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    const metrics = await scrapeReportPages();
    const count = await upsertMetrics(metrics);

    log(`\n=== AIHW Disability Summary ===`);
    log(`Total metrics: ${metrics.length}`);
    log(`Upserted: ${count}`);

    if (runId) await logComplete(db, runId, { items_found: metrics.length, items_new: count });
  } catch (err) {
    log(`FATAL: ${err.message}`);
    if (runId) await logFailed(db, runId, err.message);
    process.exit(1);
  }
}

run();
