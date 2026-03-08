#!/usr/bin/env node

/**
 * Sync ATO Corporate Tax Transparency → Supabase ato_tax_transparency table
 * Source: data.gov.au XLSX, annual, entities with $100M+ total income
 *
 * Usage: node scripts/sync-ato-tax-transparency.mjs [--dry-run] [--year=2022-23]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { read, utils } from 'xlsx';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const YEAR_FILTER = process.argv.find(a => a.startsWith('--year='))?.split('=')[1];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[ato] ${msg}`); }

function cleanAbn(abn) {
  if (!abn) return null;
  return String(abn).replace(/\s/g, '').replace(/[^0-9]/g, '') || null;
}

function cleanNumber(val) {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[,$]/g, ''));
  return isNaN(n) ? null : n;
}

async function findDatasetUrl() {
  log('Fetching ATO dataset page...');
  const pageRes = await fetch('https://data.gov.au/data/dataset/corporate-transparency', {
    headers: { 'User-Agent': 'GrantScope/1.0 (+https://grantscope.au)' },
  });
  if (!pageRes.ok) throw new Error(`Dataset page fetch failed: ${pageRes.status}`);
  const html = await pageRes.text();

  // Find all XLSX download links
  const xlsxLinks = [...html.matchAll(/href="(https:\/\/data\.gov\.au\/data\/dataset\/[^"]*\.(xlsx|xls)[^"]*)"/gi)];
  if (xlsxLinks.length === 0) throw new Error('Could not find XLSX download links on dataset page');

  log(`Found ${xlsxLinks.length} XLSX links`);
  return xlsxLinks.map(m => m[1]);
}

function guessReportYear(url, sheetName, sampleRow) {
  // First try the "Income year" column in the data itself
  if (sampleRow) {
    const incomeYear = findColumn(sampleRow, 'Income year');
    if (incomeYear) {
      const iy = String(incomeYear).trim();
      // Could be "2022-23" directly or a number
      if (/^\d{4}-\d{2}$/.test(iy)) return iy;
    }
  }

  // Then try URL filename (most reliable)
  const filename = url.split('/').pop() || '';
  const urlMatch = filename.match(/(\d{4}-\d{2})/);
  if (urlMatch) return urlMatch[1];

  // Then try sheet name
  const sheetMatch = sheetName.match(/(\d{4}-\d{2})/);
  if (sheetMatch) return sheetMatch[1];

  return 'unknown';
}

function findColumn(row, ...patterns) {
  // Fuzzy column match — handles "Total income $", " Total income $ ", etc.
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
    for (const pattern of patterns) {
      if (normalized.includes(pattern.toLowerCase().replace(/[^a-z]/g, ''))) {
        return row[key];
      }
    }
  }
  return undefined;
}

function mapRow(row, reportYear, sourceFile) {
  const abn = cleanAbn(findColumn(row, 'ABN'));
  const entityName = (findColumn(row, 'Name', 'Entity name') || '').toString().trim();

  if (!abn || !entityName) return null;

  return {
    abn,
    entity_name: entityName,
    total_income: cleanNumber(findColumn(row, 'Total income')),
    taxable_income: cleanNumber(findColumn(row, 'Taxable income')),
    tax_payable: cleanNumber(findColumn(row, 'Tax payable')),
    industry: (findColumn(row, 'Industry') || '').toString().trim() || null,
    entity_type: (findColumn(row, 'Entity type', 'Type') || '').toString().trim() || null,
    report_year: reportYear,
    source_file: sourceFile,
    updated_at: new Date().toISOString(),
  };
}

async function processFile(url) {
  const filename = url.split('/').pop();
  log(`Downloading ${filename}...`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GrantScope/1.0 (+https://grantscope.au)' },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    log(`  Download failed: ${res.status} — skipping`);
    return { fetched: 0, inserted: 0, errors: 0 };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  const workbook = read(buffer, { type: 'buffer' });
  let totalFetched = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = utils.sheet_to_json(sheet);

    if (rows.length === 0) continue;

    // Check if this sheet has the expected columns
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);
    const hasAbn = keys.some(k => k.toLowerCase().includes('abn'));
    const hasIncome = keys.some(k => k.toLowerCase().includes('income'));
    if (!hasAbn || !hasIncome) {
      log(`  Skipping sheet "${sheetName}" (no ABN/income columns). Keys: ${keys.slice(0, 5).join(', ')}`);
      continue;
    }

    const reportYear = guessReportYear(url, sheetName, rows[0]);
    if (YEAR_FILTER && reportYear !== YEAR_FILTER) {
      log(`  Skipping sheet "${sheetName}" (year=${reportYear}, filter=${YEAR_FILTER})`);
      continue;
    }

    log(`  Sheet "${sheetName}": ${rows.length} rows, year=${reportYear}`);
    log(`  Columns: ${keys.join(', ')}`);

    const rawMapped = rows.map(r => mapRow(r, reportYear, filename)).filter(Boolean);

    // Deduplicate by abn+report_year (same entity can appear multiple times)
    const mapped = [...new Map(rawMapped.map(r => [`${r.abn}:${r.report_year}`, r])).values()];
    if (mapped.length < rawMapped.length) {
      log(`  Deduped: ${rawMapped.length} → ${mapped.length} (${rawMapped.length - mapped.length} duplicates)`);
    }
    totalFetched += mapped.length;

    if (DRY_RUN) {
      log(`  DRY RUN — first 3:`);
      for (const r of mapped.slice(0, 3)) {
        log(`    ${r.abn} | ${r.entity_name} | income=$${r.total_income?.toLocaleString()} | tax=$${r.tax_payable?.toLocaleString()}`);
      }
      continue;
    }

    // Batch upsert
    const BATCH_SIZE = 200;
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('ato_tax_transparency').upsert(batch, { onConflict: 'abn,report_year' });
      if (error) {
        console.error(`  Batch error: ${error.message}`);
        totalErrors += batch.length;
      } else {
        totalInserted += batch.length;
      }
    }

    log(`  Sheet done: ${mapped.length} mapped, ${totalInserted} upserted so far`);
  }

  return { fetched: totalFetched, inserted: totalInserted, errors: totalErrors };
}

async function main() {
  const urls = await findDatasetUrl();
  log(`Found ${urls.length} XLSX files to process`);

  let grandFetched = 0;
  let grandInserted = 0;
  let grandErrors = 0;

  for (const url of urls) {
    try {
      const { fetched, inserted, errors } = await processFile(url);
      grandFetched += fetched;
      grandInserted += inserted;
      grandErrors += errors;
    } catch (err) {
      log(`Error processing ${url}: ${err.message}`);
      grandErrors++;
    }

    // Rate limit between files
    await new Promise(r => setTimeout(r, 2000));
  }

  log(`\nComplete: ${grandFetched.toLocaleString()} fetched, ${grandInserted.toLocaleString()} upserted, ${grandErrors} errors`);

  if (!DRY_RUN) {
    const { count } = await supabase.from('ato_tax_transparency').select('*', { count: 'exact', head: true });
    log(`Table now has ${count?.toLocaleString()} records`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
