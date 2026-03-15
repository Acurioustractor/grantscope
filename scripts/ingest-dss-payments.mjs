#!/usr/bin/env node
/**
 * ingest-dss-payments — Import DSS Payment Demographics data
 *
 * Downloads and imports Department of Social Services payment data by geography.
 * Covers Family Tax Benefit, Parenting Payment, Carer Payment — by postcode/LGA/SA2.
 * Updated quarterly. Key poverty/disadvantage overlay for cross-system analysis.
 *
 * Data source: https://data.gov.au/dataset/dss-payment-demographic-data
 * Format: CSV/XLSX, quarterly updates
 *
 * Usage:
 *   node scripts/ingest-dss-payments.mjs --file path/to/dss-payment-demographics.xlsx
 *   node scripts/ingest-dss-payments.mjs --file path/to/dss-payment-demographics.csv
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

let XLSX;
try {
  XLSX = await import('xlsx');
} catch {
  console.log('Installing xlsx package...');
  execSync('npm install xlsx', { stdio: 'inherit' });
  XLSX = await import('xlsx');
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const filePath = fileIdx >= 0 ? args[fileIdx + 1] : null;

if (!filePath) {
  console.error('Usage: node scripts/ingest-dss-payments.mjs --file <dss-payment-data.xlsx|csv>');
  console.error('\nDownload from: https://data.gov.au/dataset/dss-payment-demographic-data');
  process.exit(1);
}

async function ensureTable() {
  const dbPassword = process.env.DATABASE_PASSWORD;
  const ddl = `
    CREATE TABLE IF NOT EXISTS dss_payment_demographics (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      payment_type text NOT NULL,
      quarter text NOT NULL,
      geography_type text NOT NULL,
      geography_code text NOT NULL,
      geography_name text,
      state text,
      recipient_count int,
      male_count int,
      female_count int,
      indigenous_count int,
      age_under_25 int,
      age_25_44 int,
      age_45_64 int,
      age_65_plus int,
      created_at timestamptz DEFAULT now(),
      UNIQUE(payment_type, quarter, geography_type, geography_code)
    );

    CREATE INDEX IF NOT EXISTS idx_dss_payments_postcode ON dss_payment_demographics(geography_code) WHERE geography_type = 'postcode';
    CREATE INDEX IF NOT EXISTS idx_dss_payments_lga ON dss_payment_demographics(geography_code) WHERE geography_type = 'lga';
    CREATE INDEX IF NOT EXISTS idx_dss_payments_type ON dss_payment_demographics(payment_type);
    CREATE INDEX IF NOT EXISTS idx_dss_payments_quarter ON dss_payment_demographics(quarter);
  `;

  try {
    execSync(
      `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${ddl.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: 30000 }
    );
    console.log('Table dss_payment_demographics ready');
  } catch (e) {
    console.error('DDL error:', e.stderr || e.message);
    process.exit(1);
  }
}

function cleanNum(v) {
  if (v == null || v === '' || v === '-' || v === 'np' || v === 'n.p.' || v === '*') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function cleanStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '-' ? null : s;
}

function detectGeoType(code) {
  if (!code) return 'unknown';
  const s = String(code);
  if (/^\d{4}$/.test(s)) return 'postcode';
  if (/^\d{5}$/.test(s)) return 'lga';
  if (/^\d{9}$/.test(s) || /^\d{11}$/.test(s)) return 'sa2';
  return 'other';
}

// Family-relevant payment types to prioritise
const FAMILY_PAYMENTS = [
  'Family Tax Benefit',
  'Parenting Payment',
  'Carer Payment',
  'Carer Allowance',
  'Double Orphan Pension',
  'Child Care Subsidy',
];

async function ingestFile(filePath) {
  const buf = readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);

  // Extract quarter from title (e.g. "December 2025")
  const contentsSheet = workbook.Sheets[workbook.SheetNames[0]];
  const contentsRows = XLSX.utils.sheet_to_json(contentsSheet, { header: 1 });
  const titleRow = String(contentsRows[0]?.[0] || '');
  const quarterMatch = titleRow.match(/((?:March|June|September|December)\s+\d{4})/i);
  const quarter = quarterMatch ? quarterMatch[1] : 'December 2025';
  console.log(`Quarter: ${quarter}`);

  // Process geographic sheets: Postcode, LGA, SA2
  const GEO_SHEETS = {
    'Postcode': 'postcode',
    'LGA': 'lga',
    'SA2': 'sa2',
    'State': 'state',
  };

  let totalUpserted = 0;

  for (const [sheetName, geoType] of Object.entries(GEO_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.log(`Sheet "${sheetName}" not found, skipping`); continue; }

    // Read raw to get proper headers
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (raw.length < 2) continue;

    // Find the header row (contains payment type names like "Age Pension", "Carer Payment", etc.)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(10, raw.length); r++) {
      const row = raw[r] || [];
      // Header row has multiple non-empty cells with text payment names
      const nonEmpty = row.filter((v, i) => i > 0 && v && String(v).trim().length > 2);
      if (nonEmpty.length >= 5) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx < 0) {
      console.log(`\nSheet "${sheetName}": no header row found, skipping`);
      continue;
    }

    const headerRow = raw[headerRowIdx];
    const paymentTypes = [];
    for (let c = 1; c < headerRow.length; c++) {
      const name = String(headerRow[c] || '').trim();
      if (name) paymentTypes.push({ col: c, name });
    }

    console.log(`\nSheet "${sheetName}": ${raw.length - headerRowIdx - 1} geo rows, ${paymentTypes.length} payment types`);

    // Parse data rows — each row is a geography, columns are payment types
    const records = [];
    for (let r = headerRowIdx + 1; r < raw.length; r++) {
      const row = raw[r];
      if (!row || !row[0]) continue;
      const geoCode = String(row[0]).trim();
      if (!geoCode || geoCode === 'Total' || geoCode === 'Not stated') continue;

      for (const { col, name } of paymentTypes) {
        const count = cleanNum(row[col]);
        if (count == null || count === 0) continue;

        records.push({
          payment_type: name,
          quarter,
          geography_type: geoType,
          geography_code: geoCode,
          geography_name: null,
          state: geoType === 'state' ? geoCode : null,
          recipient_count: count,
        });
      }
    }

    console.log(`  ${records.length} records to upsert`);

    // Upsert in batches
    const BATCH = 500;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { error } = await supabase
        .from('dss_payment_demographics')
        .upsert(batch, { onConflict: 'payment_type,quarter,geography_type,geography_code' });

      if (error) {
        console.error(`  Batch ${i} error:`, error.message);
      } else {
        totalUpserted += batch.length;
      }
    }
    console.log(`  Done: ${records.length} upserted`);
  }

  return totalUpserted;
}

async function run() {
  await ensureTable();
  console.log(`\nReading ${filePath}...`);
  const count = await ingestFile(filePath);

  // Summary
  const { data: summary } = await supabase.rpc('exec_sql', {
    query: `
      SELECT payment_type,
             geography_type,
             COUNT(*)::int as records,
             SUM(recipient_count)::int as total_recipients
      FROM dss_payment_demographics
      GROUP BY payment_type, geography_type
      ORDER BY total_recipients DESC NULLS LAST
    `,
  });

  console.log('\n=== DSS Payment Demographics Summary ===');
  if (summary) {
    for (const row of summary) {
      console.log(`  ${row.payment_type} (${row.geography_type}): ${row.records} areas, ${row.total_recipients?.toLocaleString() || '?'} recipients`);
    }
  }
  console.log(`\nTotal: ${count} records ingested`);
  console.log('\nData can now be cross-referenced with child protection and education data by postcode/LGA.');
}

run().catch(e => {
  console.error(e.message);
  process.exit(1);
});
