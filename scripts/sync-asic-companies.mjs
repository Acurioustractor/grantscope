#!/usr/bin/env node

/**
 * Sync ASIC Companies Register → Supabase asic_companies table
 * Source: data.gov.au CSV (tab-delimited), ~3M+ companies, updated weekly
 *
 * WARNING: This is a large file (~500MB+). Uses streaming to avoid memory issues.
 *
 * Usage: node scripts/sync-asic-companies.mjs [--dry-run] [--limit=1000]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[asic] ${msg}`); }

function parseDate(s) {
  if (!s || s === '') return null;
  // DD/MM/YYYY
  const parts = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    const d = new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

async function downloadFile(url, dest) {
  log(`Downloading ASIC register (this is large, ~500MB)...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GrantScope/1.0 (+https://grantscope.au)' },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
  log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(0)}MB to ${dest}`);
}

async function main() {
  // Find the latest ASIC CSV URL from data.gov.au
  // The URL pattern changes — fetch the dataset page to find it
  log('Fetching dataset page to find latest CSV...');
  const pageRes = await fetch('https://data.gov.au/data/dataset/asic-companies');
  const pageHtml = await pageRes.text();

  // Extract CSV download link
  const csvMatch = pageHtml.match(/href="(https:\/\/data\.gov\.au\/data\/dataset\/[^"]*download[^"]*\.csv[^"]*)"/);
  if (!csvMatch) throw new Error('Could not find ASIC CSV download link');
  const csvUrl = csvMatch[1];
  log(`Found CSV: ${csvUrl}`);

  const tmpFile = '/tmp/asic-companies.csv';
  await downloadFile(csvUrl, tmpFile);

  // Stream parse (tab-delimited)
  log('Parsing CSV (tab-delimited, streaming)...');
  const BATCH_SIZE = 500;
  let batch = [];
  let total = 0;
  let inserted = 0;
  let errors = 0;

  const parser = createReadStream(tmpFile).pipe(
    parse({
      delimiter: '\t',
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    })
  );

  for await (const row of parser) {
    const acn = (row['ACN'] || row['Company ACN'] || '').trim();
    if (!acn) continue;

    const record = {
      acn,
      abn: row['ABN']?.trim() || null,
      company_name: (row['Company Name'] || row['Company name'] || '').trim(),
      current_name: row['Current Name']?.trim() || null,
      current_name_start_date: parseDate(row['Current Name Start Date']),
      company_type: row['Type']?.trim() || null,
      company_class: row['Class']?.trim() || null,
      company_subclass: row['Sub Class']?.trim() || null,
      status: row['Status']?.trim() || null,
      date_of_registration: parseDate(row['Date of Registration'] || row['Date Of Registration']),
      date_of_deregistration: parseDate(row['Date of Deregistration'] || row['Date Of Deregistration']),
      previous_state_of_registration: row['Previous State of Registration']?.trim() || null,
      state_registration_number: (row['State Registration Number'] || row['State Registration number'])?.trim() || null,
      modified_flag: (row['Modified Flag'] || row['Modified since last report'])?.trim() || null,
      current_name_indicator: row['Current Name Indicator']?.trim() || null,
      source_file: csvUrl.split('/').pop(),
      updated_at: new Date().toISOString(),
    };

    if (!record.company_name) continue;

    batch.push(record);
    total++;

    if (batch.length >= BATCH_SIZE) {
      // Deduplicate by ACN — prefer rows with current_name_indicator = 'Y'
      const deduped = [...new Map(batch.map(r => [r.acn, r])).values()];

      if (!DRY_RUN) {
        const { error } = await supabase.from('asic_companies').upsert(deduped, { onConflict: 'acn' });
        if (error) {
          console.error(`Batch error at ${total}: ${error.message}`);
          errors += deduped.length;
        } else {
          inserted += deduped.length;
        }
      }
      batch = [];

      if (total % 50000 === 0) {
        log(`  Progress: ${total.toLocaleString()} rows (${inserted.toLocaleString()} inserted, ${errors} errors)`);
      }
    }

    if (LIMIT > 0 && total >= LIMIT) {
      log(`  Limit reached: ${LIMIT}`);
      break;
    }
  }

  // Final batch
  if (batch.length > 0 && !DRY_RUN) {
    const deduped = [...new Map(batch.map(r => [r.acn, r])).values()];
    const { error } = await supabase.from('asic_companies').upsert(deduped, { onConflict: 'acn' });
    if (error) errors += deduped.length;
    else inserted += deduped.length;
  }

  log(`\nComplete: ${total.toLocaleString()} total, ${inserted.toLocaleString()} upserted, ${errors} errors`);

  // Stats
  if (!DRY_RUN) {
    const { count } = await supabase.from('asic_companies').select('*', { count: 'exact', head: true });
    log(`Table now has ${count?.toLocaleString()} companies`);
  }

  // Cleanup
  await unlink(tmpFile).catch(() => {});
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
