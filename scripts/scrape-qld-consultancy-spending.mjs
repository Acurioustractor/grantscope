#!/usr/bin/env node
/**
 * scrape-qld-consultancy-spending.mjs
 *
 * Fetches Queensland Government consultancy spending data from the
 * QLD Open Data Portal (data.qld.gov.au) via the CKAN API.
 *
 * Targets justice, corrective services, child safety, and related departments.
 *
 * Data source: https://data.qld.gov.au (CKAN API)
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qld-consultancy-spending.mjs [--dry-run] [--all-depts]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-qld-consultancy-spending';
const AGENT_NAME = 'QLD Consultancy Spending Scraper';
const CKAN_BASE = 'https://data.qld.gov.au/api/3/action';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const ALL_DEPTS = process.argv.includes('--all-depts');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

// Target departments (justice-adjacent)
const TARGET_QUERIES = [
  'consultancy spending justice',
  'consultancy spending corrective services',
  'consultancy spending child safety',
  'consultancy spending youth',
  'consultancy spending police',
  'consultancy spending attorney-general',
  'consultancy spending aboriginal',
  'consultancy spending communities',
  'consultancy spending housing',
  ...(ALL_DEPTS ? [
    'consultancy spending education',
    'consultancy spending health',
    'consultancy spending treasury',
    'consultancy spending transport',
    'consultancy spending environment',
    'consultancy spending premier',
  ] : []),
];

// ── Phase 1: Discover datasets via CKAN API ──────────────────────

async function discoverDatasets() {
  log('Phase 1: Discovering consultancy spending datasets...');
  const datasets = new Map(); // id -> dataset

  for (const query of TARGET_QUERIES) {
    try {
      const url = `${CKAN_BASE}/package_search?q=${encodeURIComponent(query)}&rows=20`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
      });

      if (!res.ok) {
        log(`  CKAN returned ${res.status} for query: ${query}`);
        continue;
      }

      const data = await res.json();
      if (!data.success) continue;

      for (const pkg of data.result.results) {
        if (!datasets.has(pkg.id)) {
          datasets.set(pkg.id, {
            id: pkg.id,
            title: pkg.title,
            organization: pkg.organization?.title || 'Unknown',
            resources: (pkg.resources || [])
              .filter(r => ['csv', 'xlsx', 'xls'].includes((r.format || '').toLowerCase()))
              .map(r => ({
                id: r.id,
                name: r.name,
                url: r.url,
                format: (r.format || '').toLowerCase(),
                size: r.size,
                last_modified: r.last_modified,
              })),
          });
        }
      }

      await delay(300);
    } catch (err) {
      log(`  Error querying CKAN: ${err.message}`);
    }
  }

  // Filter to datasets that have downloadable resources
  const withResources = [...datasets.values()].filter(d => d.resources.length > 0);
  log(`  Found ${datasets.size} datasets, ${withResources.length} with downloadable resources`);
  return withResources;
}

// ── Phase 2: Download and parse CSV/XLSX resources ───────────────

async function fetchAndParseResource(resource, dataset) {
  log(`  Fetching: ${resource.name || resource.url}`);

  try {
    // Retry with backoff on 429
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(resource.url, {
        headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
      });
      if (res.status === 429) {
        const waitMs = (attempt + 1) * 3000;
        log(`    Rate limited (429), waiting ${waitMs}ms...`);
        await delay(waitMs);
        continue;
      }
      break;
    }

    if (!res.ok) {
      log(`    HTTP ${res.status}`);
      return [];
    }

    const contentType = res.headers.get('content-type') || '';

    if (resource.format === 'csv' || contentType.includes('csv')) {
      return await parseCsv(await res.text(), resource, dataset);
    }

    // For XLSX, we'd need to buffer and parse — simplified here
    if (resource.format === 'xlsx' || resource.format === 'xls') {
      // Download as buffer
      const buffer = Buffer.from(await res.arrayBuffer());

      // Dynamic import xlsx
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        return parseRows(rows, resource, dataset);
      } catch (err) {
        log(`    XLSX parse error: ${err.message}`);
        return [];
      }
    }

    return [];
  } catch (err) {
    log(`    Fetch error: ${err.message}`);
    return [];
  }
}

async function parseCsv(text, resource, dataset) {
  // Simple CSV parser (rows may be quoted)
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = values[idx]?.trim() || ''; });
    rows.push(row);
  }

  return parseRows(rows, resource, dataset);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseRows(rows, resource, dataset) {
  const records = [];

  // Detect column names (various government CSV formats)
  const sampleRow = rows[0] || {};
  const keys = Object.keys(sampleRow).map(k => k.toLowerCase());

  const consultantCol = findCol(keys, ['consultant', 'supplier', 'vendor', 'provider', 'company', 'firm']);
  const amountCol = findCol(keys, ['amount', 'value', 'cost', 'total', 'expenditure', 'spend']);
  const descCol = findCol(keys, ['description', 'purpose', 'project', 'service', 'category', 'engagement']);
  const abnCol = findCol(keys, ['abn']);

  if (!consultantCol && !amountCol) {
    log(`    Could not identify columns in ${resource.name}. Headers: ${keys.join(', ')}`);
    return [];
  }

  // Extract financial year from resource name or dataset title
  const fyMatch = (resource.name + ' ' + dataset.title).match(/(\d{4})[–-](\d{2,4})/);
  const financialYear = fyMatch ? `${fyMatch[1]}-${fyMatch[2].length === 2 ? fyMatch[2] : fyMatch[2].slice(2)}` : null;

  for (const row of rows) {
    const origKeys = Object.keys(row);
    const consultant = consultantCol ? row[origKeys.find(k => k.toLowerCase() === consultantCol)] : null;
    const amount = amountCol ? parseAmount(row[origKeys.find(k => k.toLowerCase() === amountCol)]) : null;
    const description = descCol ? row[origKeys.find(k => k.toLowerCase() === descCol)] : null;
    const abn = abnCol ? row[origKeys.find(k => k.toLowerCase() === abnCol)]?.replace(/\s/g, '') : null;

    if (!consultant && !amount) continue;

    records.push({
      department: dataset.organization,
      consultant_name: (consultant || 'Unknown').slice(0, 300),
      consultant_abn: abn && abn.length === 11 ? abn : null,
      description: description?.slice(0, 500) || null,
      amount_dollars: amount,
      financial_year: financialYear,
      source_dataset_id: dataset.id,
      source_resource_id: resource.id,
      source_url: resource.url,
      jurisdiction: 'QLD',
    });
  }

  return records;
}

function findCol(keys, candidates) {
  for (const c of candidates) {
    const found = keys.find(k => k.includes(c));
    if (found) return found;
  }
  return null;
}

function parseAmount(val) {
  if (!val) return null;
  const str = String(val).replace(/[$,\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ── Phase 3: Insert records ──────────────────────────────────────

async function insertRecords(records) {
  let inserted = 0;
  const errors = [];

  // Batch insert in chunks of 50
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);

    if (DRY_RUN) {
      for (const r of batch) {
        log(`    [DRY RUN] ${r.department}: ${r.consultant_name} — $${r.amount_dollars || '?'} (${r.financial_year || '?'})`);
      }
      inserted += batch.length;
      continue;
    }

    const { error, count } = await db
      .from('civic_consultancy_spending')
      .upsert(batch, { onConflict: 'department,consultant_name,financial_year', ignoreDuplicates: true });

    if (error) {
      log(`    Batch insert error: ${error.message}`);
      errors.push(error.message);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, errors };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  log(`Starting ${AGENT_NAME} (dry_run=${DRY_RUN}, all_depts=${ALL_DEPTS})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    // Phase 1: Discover datasets
    const datasets = await discoverDatasets();

    if (datasets.length === 0) {
      log('No datasets found.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    // Phase 2 & 3: Fetch, parse, insert
    let totalRecords = 0;
    let totalInserted = 0;
    const allErrors = [];

    for (const dataset of datasets) {
      log(`\nDataset: ${dataset.title} (${dataset.resources.length} resources)`);

      for (const resource of dataset.resources) {
        const records = await fetchAndParseResource(resource, dataset);
        log(`    Parsed ${records.length} records`);
        totalRecords += records.length;

        if (records.length > 0) {
          const { inserted, errors } = await insertRecords(records);
          totalInserted += inserted;
          allErrors.push(...errors);
        }

        await delay(2000); // respect CKAN rate limits
      }
    }

    log(`\nDone. ${datasets.length} datasets, ${totalRecords} records, ${totalInserted} inserted.`);
    await logComplete(db, run.id, {
      items_found: totalRecords,
      items_new: totalInserted,
      errors: allErrors.length > 0 ? allErrors.slice(0, 10) : undefined,
      status: allErrors.length > 0 ? 'partial' : 'success',
    });

  } catch (err) {
    log(`Fatal error: ${err.message}`);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
