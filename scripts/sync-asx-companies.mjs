#!/usr/bin/env node

/**
 * Sync ASX Listed Companies → Supabase asx_companies table
 * Source: asx.com.au CSV (~2,200 companies, updated daily)
 * Usage: node scripts/sync-asx-companies.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const ASX_CSV_URL = 'https://www.asx.com.au/asx/research/ASXListedCompanies.csv';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[asx] ${msg}`); }

async function main() {
  log('Downloading ASX listed companies...');
  const res = await fetch(ASX_CSV_URL, {
    headers: { 'User-Agent': 'GrantScope/1.0 (+https://grantscope.au)' },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const csvText = await res.text();

  // ASX CSV has a title row before headers — skip lines until we find headers
  const lines = csvText.split('\n');
  const headerIdx = lines.findIndex(l => l.includes('Company name') || l.includes('ASX code'));
  if (headerIdx < 0) throw new Error('Could not find CSV headers');
  const cleanCsv = lines.slice(headerIdx).join('\n');

  const records = parse(cleanCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  log(`Parsed ${records.length} companies`);

  const mapped = records
    .filter(r => r['ASX code'] && r['Company name'])
    .map(r => ({
      asx_code: r['ASX code'].trim(),
      company_name: r['Company name'].trim(),
      gics_industry_group: r['GICS industry group']?.trim() || null,
      source_file: 'ASXListedCompanies.csv',
      updated_at: new Date().toISOString(),
    }));

  log(`${mapped.length} valid companies`);

  // Industry breakdown
  const industries = {};
  for (const r of mapped) {
    const ind = r.gics_industry_group || 'Unknown';
    industries[ind] = (industries[ind] || 0) + 1;
  }
  log(`Top industries: ${Object.entries(industries).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  if (DRY_RUN) {
    log('DRY RUN — first 5:');
    for (const r of mapped.slice(0, 5)) {
      log(`  ${r.asx_code} | ${r.company_name} | ${r.gics_industry_group}`);
    }
    return;
  }

  // Batch upsert
  const BATCH_SIZE = 200;
  let inserted = 0, errors = 0;
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('asx_companies').upsert(batch, { onConflict: 'asx_code' });
    if (error) { console.error(`Batch error at ${i}: ${error.message}`); errors += batch.length; }
    else inserted += batch.length;
  }

  log(`Complete: ${inserted} upserted, ${errors} errors`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
