#!/usr/bin/env node

/**
 * Import AEC political donation data from transparency.aec.gov.au
 *
 * Downloads the "All Annual Data" ZIP, extracts CSVs, and imports:
 * - Donations Made (donor → party, with amounts and dates)
 * - Detailed Receipts (party → donors, cross-check)
 *
 * Usage: node scripts/import-aec-donations.mjs [--dry-run] [--skip-download]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_DOWNLOAD = process.argv.includes('--skip-download');
const BATCH_SIZE = 500;
const DATA_DIR = '/tmp/aec_data';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (msg) => console.log(`[aec-import] ${msg}`);

function parseDate(dateStr) {
  if (!dateStr) return null;
  // AEC uses DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
}

function cleanAmount(val) {
  if (!val) return null;
  const num = parseFloat(val.replace(/[,$]/g, ''));
  return isNaN(num) ? null : num;
}

function cleanName(name) {
  return (name || '').trim().replace(/^\s+/, '');
}

async function downloadData() {
  if (SKIP_DOWNLOAD && existsSync(`${DATA_DIR}/Donations Made.csv`)) {
    log('Skipping download (--skip-download)');
    return;
  }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  log('Downloading AEC Annual Data ZIP...');
  const zipPath = `${DATA_DIR}/aec_annual.zip`;

  execSync(`curl -sL -o "${zipPath}" "https://transparency.aec.gov.au/Download/AllAnnualData"`, {
    timeout: 60000,
  });

  log('Extracting CSVs...');
  execSync(`cd "${DATA_DIR}" && unzip -o "${zipPath}"`, { timeout: 30000 });
  log('Download complete');
}

async function importDonationsMade() {
  const csvPath = `${DATA_DIR}/Donations Made.csv`;
  if (!existsSync(csvPath)) {
    // Try /tmp fallback from earlier download
    if (existsSync('/tmp/Donations Made.csv')) {
      log('Using existing /tmp download');
      return importCsv('/tmp/Donations Made.csv', 'donations_made');
    }
    log('Donations Made.csv not found — skipping');
    return 0;
  }
  return importCsv(csvPath, 'donations_made');
}

async function importCsv(csvPath, type) {
  const csvText = readFileSync(csvPath, 'utf-8');
  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  log(`Parsed ${records.length} ${type} records`);

  const rows = [];

  if (type === 'donations_made') {
    // Fields: Financial Year, Donor Name, Donation Made To, Date, Value
    for (const r of records) {
      const amount = cleanAmount(r['Value']);
      if (!amount || amount <= 0) continue;

      rows.push({
        financial_year: r['Financial Year'],
        donor_name: cleanName(r['Donor Name']),
        donation_to: cleanName(r['Donation Made To']),
        donation_date: parseDate(r['Date']),
        amount,
        return_type: 'donor',
      });
    }
  } else if (type === 'detailed_receipts') {
    // Fields: Financial Year, Return Type, Recipient Name, Received From, Receipt Type, Value
    for (const r of records) {
      const amount = cleanAmount(r['Value']);
      if (!amount || amount <= 0) continue;

      rows.push({
        financial_year: r['Financial Year'],
        donor_name: cleanName(r['Received From']),
        donation_to: cleanName(r['Recipient Name']),
        amount,
        return_type: r['Return Type']?.toLowerCase().includes('third') ? 'third_party' : 'party',
        receipt_type: r['Receipt Type']?.toLowerCase() || null,
      });
    }
  }

  log(`${rows.length} valid donation records`);

  if (DRY_RUN) {
    log('DRY RUN — sample:');
    console.log(rows.slice(0, 5));
    return rows.length;
  }

  // Batch upsert with dedup
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('political_donations').upsert(batch, {
      onConflict: 'financial_year,donor_name,donation_to,amount,donation_date',
      ignoreDuplicates: true,
    });
    if (error) {
      errors++;
      if (errors <= 3) log(`Error at batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  log(`Inserted ${inserted} ${type} records (${errors} batch errors)`);
  return inserted;
}

async function crossReferenceABNs() {
  log('Cross-referencing donor names with ASIC/ACNC ABNs...');

  // Find donors that match ASIC company names
  const { data: topDonors } = await supabase
    .from('political_donations')
    .select('donor_name')
    .is('donor_abn', null)
    .order('amount', { ascending: false })
    .limit(1000);

  if (!topDonors?.length) {
    log('No donors to cross-reference');
    return;
  }

  // Try matching against ASIC
  let matched = 0;
  for (const donor of topDonors) {
    const { data: asic } = await supabase
      .from('asic_companies')
      .select('abn')
      .ilike('company_name', donor.donor_name)
      .limit(1);

    if (asic?.length && asic[0].abn) {
      const { error } = await supabase
        .from('political_donations')
        .update({ donor_abn: asic[0].abn })
        .eq('donor_name', donor.donor_name)
        .is('donor_abn', null);

      if (!error) matched++;
    }
  }

  log(`Matched ${matched} donors to ABNs via ASIC`);
}

async function printStats() {
  const { data: yearStats } = await supabase
    .from('political_donations')
    .select('financial_year')
    .order('financial_year', { ascending: false });

  if (yearStats) {
    const years = {};
    for (const r of yearStats) {
      years[r.financial_year] = (years[r.financial_year] || 0) + 1;
    }
    log('Donations by year:');
    for (const [year, count] of Object.entries(years).sort()) {
      log(`  ${year}: ${count}`);
    }
  }

  // Top donors
  const { data: topDonors } = await supabase.rpc('exec_sql_readonly', {
    sql: `SELECT donor_name, SUM(amount) as total, COUNT(*) as donations
          FROM political_donations
          GROUP BY donor_name
          ORDER BY total DESC LIMIT 20`
  });

  if (topDonors) {
    log('\nTop 20 political donors (all time):');
    for (const d of topDonors) {
      log(`  $${Number(d.total).toLocaleString()} — ${d.donor_name} (${d.donations} donations)`);
    }
  }
}

async function main() {
  log(`Starting AEC import (dry-run=${DRY_RUN})`);

  await downloadData();

  // Import donations made (donor-reported)
  const donationsPath = existsSync(`${DATA_DIR}/Donations Made.csv`)
    ? `${DATA_DIR}/Donations Made.csv`
    : '/tmp/Donations Made.csv';

  const donationCount = await importCsv(donationsPath, 'donations_made');

  // Import detailed receipts (party-reported)
  const receiptsPath = existsSync(`${DATA_DIR}/Detailed Receipts.csv`)
    ? `${DATA_DIR}/Detailed Receipts.csv`
    : '/tmp/Detailed Receipts.csv';

  if (existsSync(receiptsPath)) {
    const receiptCount = await importCsv(receiptsPath, 'detailed_receipts');
    log(`Total: ${donationCount} donor-reported + ${receiptCount} party-reported`);
  }

  if (!DRY_RUN) {
    await crossReferenceABNs();
    await printStats();
  }

  log('\nDone!');
}

main().catch(err => {
  console.error('[aec-import] Fatal:', err.message);
  process.exit(1);
});
