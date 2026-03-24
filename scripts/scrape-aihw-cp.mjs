#!/usr/bin/env node
/**
 * scrape-aihw-cp.mjs
 *
 * Scrapes AIHW Child Protection Australia 2022-23 report and upserts into outcomes_metrics.
 *
 * Data source: https://www.aihw.gov.au/reports/child-protection/child-protection-australia-2022-23
 * The report embeds HTML data tables in its content pages.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-aihw-cp.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-aihw-cp';
const AGENT_NAME = 'AIHW Child Protection Scraper';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── Constants ────────────────────────────────────────────

const REPORT_YEAR = '2022-23';
const SOURCE = `AIHW Child Protection ${REPORT_YEAR}`;
const BASE_URL = 'https://www.aihw.gov.au/reports/child-protection/child-protection-australia-2022-23';

const CONTENT_PAGES = [
  '/contents/insights',
  '/contents/insights/the-process-of-determining-child-maltreatment',
  '/contents/insights/supporting-children',
  '/contents/safety-of-children-in-care',
  '/contents/aboriginal-and-torres-strait-islander-children',
  '/contents/pathways-from-out-of-home-care',
  '/contents/indicators',
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

function extractMetricsFromTable(table) {
  const { caption, headers, rows } = table;
  const metrics = [];
  const captionLower = (caption || '').toLowerCase();

  // Find jurisdiction columns
  const jurisdictionColumns = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].replace(/\*/g, '').replace(/\([a-z]\)/gi, '').trim();
    if (JURISDICTION_MAP[h]) {
      jurisdictionColumns.push({ index: i, jurisdiction: JURISDICTION_MAP[h] });
    }
  }

  if (jurisdictionColumns.length === 0) return metrics;

  const isRateTable = captionLower.includes('rate') || captionLower.includes('per 1,000');
  const isPercentTable = captionLower.includes('per cent') || captionLower.includes('proportion');

  for (const row of rows) {
    if (row.length < 2) continue;
    const rowLabel = row[0].replace(/\*/g, '').trim();
    const rowLower = rowLabel.toLowerCase();
    if (!rowLabel || rowLower === 'number' || rowLower === 'rate' || rowLower === 'per cent') continue;

    let metricName = null;
    let metricUnit = isRateTable ? 'rate_per_1000' : isPercentTable ? 'percent' : 'count';
    let cohort = 'all';

    // Notifications
    if (rowLower.includes('notification') && !rowLower.includes('rate')) {
      metricName = 'cp_notifications';
    } else if (rowLower.includes('notification') && rowLower.includes('rate')) {
      metricName = 'cp_notification_rate'; metricUnit = 'rate_per_1000';
    }
    // Investigations
    else if (rowLower.includes('investigation') && rowLower.includes('finalised')) {
      metricName = 'cp_investigations_finalised';
    } else if (rowLower.includes('investigation')) {
      metricName = 'cp_investigations';
    }
    // Substantiations
    else if (rowLower.includes('substantiation') && !rowLower.includes('rate')) {
      metricName = 'cp_substantiations';
    } else if (rowLower.includes('substantiation') && rowLower.includes('rate')) {
      metricName = 'cp_substantiation_rate'; metricUnit = 'rate_per_1000';
    }
    // Out-of-home care
    else if (rowLower.includes('out-of-home care') || rowLower.includes('oohc')) {
      metricName = 'cp_oohc_children';
    }
    // Care and protection orders
    else if (rowLower.includes('care and protection order') || rowLower.includes('care order')) {
      metricName = 'cp_care_orders';
    }
    // Kinship/relative care
    else if (rowLower.includes('kinship') || rowLower.includes('relative') || rowLower.includes('family')) {
      metricName = 'cp_kinship_care';
    }
    // Foster care
    else if (rowLower.includes('foster')) {
      metricName = 'cp_foster_care';
    }
    // Residential care
    else if (rowLower.includes('residential')) {
      metricName = 'cp_residential_care';
    }
    // Aboriginal/Torres Strait Islander
    else if (rowLower.includes('aboriginal') || rowLower.includes('torres strait') || rowLower.includes('indigenous')) {
      cohort = 'indigenous';
      if (captionLower.includes('notification')) metricName = 'cp_notifications';
      else if (captionLower.includes('substantiation')) metricName = 'cp_substantiations';
      else if (captionLower.includes('out-of-home') || captionLower.includes('oohc')) metricName = 'cp_oohc_children';
      else metricName = `cp_${rowLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
    }

    // Generic fallback for unmatched rows with a number
    if (!metricName) {
      metricName = `cp_${rowLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`;
    }

    for (const { index, jurisdiction } of jurisdictionColumns) {
      const val = parseNum(row[index]);
      if (val == null) continue;
      metrics.push({
        jurisdiction,
        metric_name: metricName,
        metric_value: val,
        metric_unit: metricUnit,
        cohort,
        notes: `${caption} — ${rowLabel}`,
      });
    }
  }

  return metrics;
}

function extractFromNarrative(html) {
  const metrics = [];
  const text = stripHtml(html);

  // Helper: add metric if not null
  const add = (name, value, unit, cohort, notes) => {
    const v = parseNum(value);
    if (v != null) metrics.push({ jurisdiction: 'National', metric_name: name, metric_value: v, metric_unit: unit, cohort: cohort || 'all', notes });
  };

  // ── Notifications & Investigations ──
  const notifMatch = text.match(/(\d[\d,]*)\s*children\s*were\s*subjects?\s*of\s*notification/i);
  if (notifMatch) add('cp_notifications', notifMatch[1], 'count', 'all', 'Children subject of notifications');

  const investMatch = text.match(/(\d[\d,]*)\s*children\s*(?:became\s*)?subjects?\s*of\s*investigation/i);
  if (investMatch) add('cp_investigations', investMatch[1], 'count', 'all', 'Children subject of investigations');

  // ── Substantiations ──
  const substMatch = text.match(/(\d[\d,]*)\s*children\s*(?:in\s*finalised\s*investigations\s*)?were\s*subjects?\s*of\s*substantiation/i);
  if (substMatch) add('cp_substantiations', substMatch[1], 'count', 'all', 'Children with substantiated maltreatment');

  const substRateMatch = text.match(/substantiation.*?(\d+\.?\d*)\s*per\s*1[,.]?000/i)
    || text.match(/(\d+\.?\d*)\s*per\s*1[,.]?000.*?substantia/i);
  if (substRateMatch) add('cp_substantiation_rate', substRateMatch[1], 'rate_per_1000', 'all', 'Substantiation rate per 1,000');

  // Indigenous substantiations
  const indigSubstMatch = text.match(/(?:Aboriginal|Torres Strait|Indigenous).*?(\d[\d,]*)\s*substantiation/i);
  if (indigSubstMatch) add('cp_substantiations', indigSubstMatch[1], 'count', 'indigenous', 'Indigenous children substantiated');

  const indigRateMatch = text.match(/(?:Aboriginal|Indigenous).*?(\d+\.?\d*)\s*per\s*1[,.]?000/i);
  if (indigRateMatch) add('cp_substantiation_rate', indigRateMatch[1], 'rate_per_1000', 'indigenous', 'Indigenous substantiation rate per 1,000');

  const nonIndigRateMatch = text.match(/[Nn]on-Indigenous.*?(\d+\.?\d*)\s*per\s*1[,.]?000/i);
  if (nonIndigRateMatch) add('cp_substantiation_rate', nonIndigRateMatch[1], 'rate_per_1000', 'non_indigenous', 'Non-Indigenous substantiation rate per 1,000');

  // ── Care & Protection Orders ──
  const ordersMatch = text.match(/(\d[\d,]*)\s*children\s*on\s*(?:care\s*and\s*protection\s*)?orders?\s*at/i);
  if (ordersMatch) add('cp_care_orders', ordersMatch[1], 'count', 'all', 'Children on care and protection orders at 30 June');

  const ordersRateMatch = text.match(/on\s*orders?\s*.*?\((\d+\.?\d*)\s*per\s*1[,.]?000\)/i);
  if (ordersRateMatch) add('cp_care_orders_rate', ordersRateMatch[1], 'rate_per_1000', 'all', 'Rate of children on orders per 1,000');

  const ordersAdmitMatch = text.match(/(\d[\d,]*)\s*children\s*(?:were\s*)?admitted.*?(?:orders|care)/i);
  if (ordersAdmitMatch) add('cp_orders_admissions', ordersAdmitMatch[1], 'count', 'all', 'Children admitted to orders');

  // Indigenous orders
  const indigOrdersMatch = text.match(/(?:Aboriginal|Indigenous).*?(\d[\d,]*)\s*(?:children)?.*?(?:\()?(\d+\.?\d*)\s*per\s*1[,.]?000.*?Indigenous/i);
  if (indigOrdersMatch) {
    add('cp_care_orders', indigOrdersMatch[1], 'count', 'indigenous', 'Indigenous children on orders');
    add('cp_care_orders_rate', indigOrdersMatch[2], 'rate_per_1000', 'indigenous', 'Indigenous rate on orders per 1,000');
  }

  // ── Out-of-Home Care ──
  const oohcMatch = text.match(/(\d[\d,]*)\s*children\s*in\s*(?:out-of-home\s*)?care\s*at/i);
  if (oohcMatch) add('cp_oohc_children', oohcMatch[1], 'count', 'all', 'Children in OOHC at 30 June');

  const oohcRateMatch = text.match(/(?:out-of-home|oohc).*?\((\d+\.?\d*)\s*per\s*1[,.]?000\)/i)
    || text.match(/(\d+\.?\d*)\s*per\s*1[,.]?000.*?(?:out-of-home|oohc)/i);
  if (oohcRateMatch) add('cp_oohc_rate', oohcRateMatch[1], 'rate_per_1000', 'all', 'OOHC rate per 1,000');

  const oohcAdmitMatch = text.match(/(\d[\d,]*)\s*children\s*admitted.*?(?:out-of-home|oohc|care)/i);
  if (oohcAdmitMatch) add('cp_oohc_admissions', oohcAdmitMatch[1], 'count', 'all', 'Children admitted to OOHC');

  const oohcDischargeMatch = text.match(/(\d[\d,]*)\s*children\s*discharged/i);
  if (oohcDischargeMatch) add('cp_oohc_discharges', oohcDischargeMatch[1], 'count', 'all', 'Children discharged from OOHC');

  // Home-based care
  const homeBasedMatch = text.match(/(\d+)\s*%?\s*\([\d,]*\)\s*in\s*home-based\s*care/i)
    || text.match(/(\d+)%\s*.*?home-based/i);
  if (homeBasedMatch) add('cp_oohc_homebased_pct', homeBasedMatch[1], 'percent', 'all', 'Percentage in home-based care');

  // Long-term care
  const longtermMatch = text.match(/(\d+)\s*%?\s*.*?(?:long-term|2\+\s*years)/i);
  if (longtermMatch && parseNum(longtermMatch[1]) <= 100) add('cp_oohc_longterm_pct', longtermMatch[1], 'percent', 'all', 'Percentage in long-term care (2+ years)');

  // Indigenous OOHC
  const indigOohcMatch = text.match(/(?:Aboriginal|Indigenous).*?(\d[\d,]*)\s*(?:children)?.*?(\d+\.?\d*)\s*per\s*1[,.]?000.*?Indigenous.*?oohc/i);
  if (indigOohcMatch) {
    add('cp_oohc_children', indigOohcMatch[1], 'count', 'indigenous', 'Indigenous children in OOHC');
    add('cp_oohc_rate', indigOohcMatch[2], 'rate_per_1000', 'indigenous', 'Indigenous OOHC rate per 1,000');
  }

  // ── Maltreatment types ──
  const emotionalMatch = text.match(/[Ee]motional\s*abuse.*?(\d+)\s*%/i) || text.match(/(\d+)\s*%.*?emotional\s*abuse/i);
  if (emotionalMatch) add('cp_maltreatment_emotional_pct', emotionalMatch[1], 'percent', 'all', 'Emotional abuse as % of substantiations');

  const neglectMatch = text.match(/[Nn]eglect.*?(\d+)\s*%/i) || text.match(/(\d+)\s*%.*?neglect/i);
  if (neglectMatch) add('cp_maltreatment_neglect_pct', neglectMatch[1], 'percent', 'all', 'Neglect as % of substantiations');

  // ── Remoteness ──
  const remoteMatch = text.match(/[Vv]ery\s*remote.*?(\d+\.?\d*)\s*per\s*1[,.]?000/i);
  if (remoteMatch) add('cp_rate_very_remote', remoteMatch[1], 'rate_per_1000', 'all', 'Substantiation rate in very remote areas');

  const cityMatch = text.match(/[Mm]ajor\s*cit.*?(\d+\.?\d*)\s*per\s*1[,.]?000/i);
  if (cityMatch) add('cp_rate_major_cities', cityMatch[1], 'rate_per_1000', 'all', 'Substantiation rate in major cities');

  // ── Repeat clients ──
  const repeatMatch = text.match(/(\d[\d,]*)\s*children\s*(?:who\s*)?contact.*?system/i);
  if (repeatMatch) add('cp_system_contacts', repeatMatch[1], 'count', 'all', 'Children who contacted the system');

  const repeatPctMatch = text.match(/(\d+)\s*%\s*.*?repeat\s*client/i);
  if (repeatPctMatch) add('cp_repeat_client_pct', repeatPctMatch[1], 'percent', 'all', 'Percentage who were repeat clients');

  // ── Family support ──
  const famSupportMatch = text.match(/(\d[\d,]*)\s*children\s*commenced.*?(?:family\s*support|intensive)/i);
  if (famSupportMatch) add('cp_family_support_commenced', famSupportMatch[1], 'count', 'all', 'Children commenced intensive family support');

  // ── Carer households ──
  const fosterMatch = text.match(/(\d[\d,]*)\s*foster\s*carer\s*households/i);
  if (fosterMatch) add('cp_foster_carer_households', fosterMatch[1], 'count', 'all', 'Foster carer households');

  const kinshipHhMatch = text.match(/(\d[\d,]*)\s*relative.*?kinship.*?carer\s*households/i);
  if (kinshipHhMatch) add('cp_kinship_carer_households', kinshipHhMatch[1], 'count', 'all', 'Relative/kinship carer households');

  // Overrepresentation ratio
  const overrepMatch = text.match(/(?:Aboriginal|Indigenous|First Nations).*?(\d+\.?\d*)\s*times/i);
  if (overrepMatch) add('cp_indigenous_overrepresentation', overrepMatch[1], 'ratio', 'indigenous', 'Indigenous overrepresentation ratio');

  return metrics;
}

// ── Main Scrape Logic ────────────────────────────────────

async function scrapeReportPages() {
  log('Fetching AIHW Child Protection report pages...');
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
        const tableMetrics = extractMetricsFromTable(table);
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
    domain: 'child-protection',
    metric_name: m.metric_name,
    metric_value: m.metric_value,
    metric_unit: m.metric_unit,
    period: REPORT_YEAR,
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
    // Show sample
    for (const r of records.slice(0, 10)) {
      log(`  ${r.jurisdiction} | ${r.metric_name} | ${r.metric_value} ${r.metric_unit}`);
    }
    return records.length;
  }

  let upserted = 0;
  // Batch upsert in chunks of 50
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await db.from('outcomes_metrics').upsert(batch, {
      onConflict: 'jurisdiction,domain,metric_name,period,cohort,source',
    });
    if (error) {
      log(`  Batch error: ${error.message}`);
      // Fallback: one at a time
      for (const rec of batch) {
        const { error: e2 } = await db.from('outcomes_metrics').upsert(rec, {
          onConflict: 'jurisdiction,domain,metric_name,period,cohort,source',
        });
        if (!e2) upserted++;
        else log(`    Failed: ${rec.metric_name} (${rec.jurisdiction}): ${e2.message}`);
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

    log(`\n=== AIHW Child Protection Summary ===`);
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
