#!/usr/bin/env node
/**
 * ingest-aihw-child-protection — Import AIHW Child Protection Australia data
 *
 * Downloads and imports state-level child protection statistics from AIHW.
 * Data includes notifications, investigations, substantiations, out-of-home care.
 *
 * Data source: https://www.aihw.gov.au/reports/child-protection/child-protection-australia
 * Format: XLSX data tables published annually (usually June)
 *
 * Usage:
 *   node scripts/ingest-aihw-child-protection.mjs --file path/to/aihw-child-protection-data-tables.xlsx
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
  console.error('Usage: node scripts/ingest-aihw-child-protection.mjs --file <aihw-data.xlsx>');
  console.error('\nDownload from: https://www.aihw.gov.au/reports/child-protection/child-protection-australia');
  process.exit(1);
}

async function ensureTable() {
  const dbPassword = process.env.DATABASE_PASSWORD;
  const ddl = `
    CREATE TABLE IF NOT EXISTS aihw_child_protection (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      state text NOT NULL,
      financial_year text NOT NULL,
      metric_name text NOT NULL,
      metric_category text,
      value numeric,
      rate_per_1000 numeric,
      indigenous_value numeric,
      indigenous_rate_per_1000 numeric,
      non_indigenous_value numeric,
      non_indigenous_rate_per_1000 numeric,
      age_group text,
      gender text,
      source_table text,
      notes text,
      created_at timestamptz DEFAULT now(),
      UNIQUE(state, financial_year, metric_name, source_table)
    );

    CREATE INDEX IF NOT EXISTS idx_aihw_cp_state ON aihw_child_protection(state);
    CREATE INDEX IF NOT EXISTS idx_aihw_cp_year ON aihw_child_protection(financial_year);
    CREATE INDEX IF NOT EXISTS idx_aihw_cp_metric ON aihw_child_protection(metric_name);
  `;

  try {
    execSync(
      `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${ddl.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: 30000 }
    );
    console.log('Table aihw_child_protection ready');
  } catch (e) {
    console.error('DDL error:', e.stderr || e.message);
    process.exit(1);
  }
}

function cleanNum(v) {
  if (v == null || v === '' || v === '-' || v === '..' || v === 'np' || v === 'n.p.' || v === 'na' || v === 'n.a.') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

async function ingestFile(filePath) {
  const buf = readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });

  console.log(`Workbook sheets: ${workbook.SheetNames.join(', ')}`);

  // AIHW XLSX files have multiple tables across sheets
  // Common sheets: Notifications, Investigations, Substantiations, OOHC, Expenditure
  const METRIC_SHEETS = {
    'notification': 'Notifications',
    'investigation': 'Investigations Finalised',
    'substantiation': 'Substantiations',
    'oohc': 'Children in Out-of-Home Care',
    'expenditure': 'Child Protection Expenditure',
    'care_order': 'Children on Care and Protection Orders',
  };

  let totalRecords = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 3) continue;

    // Try to detect state-by-year data tables
    // AIHW format: headers in row 0-2, states as rows, years as columns
    console.log(`\nSheet: "${sheetName}" (${rows.length} rows)`);

    // Log first 3 rows for debugging
    for (let r = 0; r < Math.min(3, rows.length); r++) {
      console.log(`  Row ${r}: ${JSON.stringify(rows[r]?.slice(0, 6))}`);
    }

    const STATE_MAP = {
      'NSW': 'NSW', 'NSW(a)': 'NSW', 'NSW(a)(b)': 'NSW', 'NSW(b)': 'NSW',
      'New South Wales': 'NSW',
      'Vic': 'VIC', 'Vic(a)': 'VIC', 'Vic(b)': 'VIC', 'Vic(a)(c)': 'VIC',
      'Vic(b)(c)': 'VIC', 'Victoria': 'VIC',
      'Qld': 'QLD', 'Qld(a)': 'QLD', 'Qld(b)': 'QLD', 'Qld(a)(b)': 'QLD',
      'Queensland': 'QLD',
      'WA': 'WA', 'WA(a)': 'WA', 'WA(c)': 'WA', 'Western Australia': 'WA',
      'SA': 'SA', 'SA(c)': 'SA', 'SA(a)': 'SA', 'SA(c)(d)': 'SA',
      'South Australia': 'SA',
      'Tas': 'TAS', 'Tas(a)': 'TAS', 'Tasmania': 'TAS',
      'ACT': 'ACT', 'ACT(a)': 'ACT',
      'Australian Capital Territory': 'ACT',
      'NT': 'NT', 'NT(a)': 'NT', 'Northern Territory': 'NT',
      'Australia': 'AUS', 'Total': 'AUS', 'Aust': 'AUS',
    };

    // Strategy 1: Year columns (e.g. "2016-17", "2017-18", ...)
    let headerRow = -1;
    let yearCols = [];
    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r] || [];
      const years = [];
      for (let c = 1; c < row.length; c++) {
        const v = String(row[c] || '');
        if (/^\d{4}[-–]\d{2}$/.test(v)) {
          years.push({ col: c, year: v });
        }
      }
      if (years.length >= 3) {
        headerRow = r;
        yearCols = years;
        break;
      }
    }

    const records = [];

    if (yearCols.length > 0) {
      console.log(`  Format: year-columns, header row ${headerRow}, years: ${yearCols.map(y => y.year).join(', ')}`);
      for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const label = String(row[0] || '').trim();
        if (!label) continue;
        for (const { col, year } of yearCols) {
          const value = cleanNum(row[col]);
          if (value == null) continue;
          records.push({
            state: 'AUS',
            financial_year: year.replace('–', '-'),
            metric_name: `${sheetName.trim()} - ${label}`,
            metric_category: label,
            value,
            source_table: sheetName,
          });
        }
      }
    } else {
      // Strategy 2: State columns (e.g. "NSW", "Vic", "Qld", ...) — most common AIHW format
      // Find the header row with state names
      let stateHeaderRow = -1;
      let stateCols = [];
      for (let r = 0; r < Math.min(5, rows.length); r++) {
        const row = rows[r] || [];
        const states = [];
        for (let c = 1; c < row.length; c++) {
          const v = String(row[c] || '').trim();
          const mapped = STATE_MAP[v];
          if (mapped) states.push({ col: c, state: mapped });
        }
        if (states.length >= 4) {
          stateHeaderRow = r;
          stateCols = states;
          break;
        }
      }

      if (stateHeaderRow < 0) {
        console.log(`  Skipping — no state or year columns detected`);
        continue;
      }

      // Extract the year from the sheet title (e.g. "2020-21" from table name)
      const titleRow = String(rows[0]?.[0] || '');
      const yearMatch = titleRow.match(/(\d{4})[–-](\d{2})/);
      const financialYear = yearMatch ? `${yearMatch[1]}-${yearMatch[2]}` : '2020-21';
      const yearFromTitle = titleRow.match(/30 June (\d{4})/)?.[1];

      console.log(`  Format: state-columns, ${stateCols.length} states, year: ${financialYear}`);

      for (let r = stateHeaderRow + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const label = String(row[0] || '').trim();
        if (!label || label === 'Number' || label === 'Per cent' || label === 'Rate') continue;

        for (const { col, state } of stateCols) {
          const value = cleanNum(row[col]);
          if (value == null) continue;
          records.push({
            state,
            financial_year: yearFromTitle ? `${yearFromTitle}` : financialYear,
            metric_name: `${sheetName.trim()} - ${label}`,
            metric_category: label,
            value,
            source_table: sheetName,
          });
        }
      }
    }

    if (records.length > 0) {
      // Upsert
      const { error } = await supabase
        .from('aihw_child_protection')
        .upsert(records, {
          onConflict: 'state,financial_year,metric_name,source_table',
          ignoreDuplicates: true,
        });

      if (error) {
        console.error(`  Error upserting: ${error.message}`);
        // Fallback: insert one by one
        let inserted = 0;
        for (const rec of records) {
          const { error: e2 } = await supabase
            .from('aihw_child_protection')
            .upsert(rec, { ignoreDuplicates: true });
          if (!e2) inserted++;
        }
        console.log(`  Fallback inserted: ${inserted}/${records.length}`);
        totalRecords += inserted;
      } else {
        console.log(`  Upserted ${records.length} records`);
        totalRecords += records.length;
      }
    }
  }

  return totalRecords;
}

async function run() {
  await ensureTable();
  console.log(`\nReading ${filePath}...`);
  const count = await ingestFile(filePath);

  // Summary
  const { data: summary } = await supabase.rpc('exec_sql', {
    query: `
      SELECT metric_name, COUNT(DISTINCT state) as states,
             COUNT(DISTINCT financial_year) as years,
             COUNT(*)::int as records
      FROM aihw_child_protection
      GROUP BY metric_name
      ORDER BY records DESC
    `,
  });

  console.log('\n=== AIHW Child Protection Summary ===');
  if (summary) {
    for (const row of summary) {
      console.log(`  ${row.metric_name}: ${row.records} records (${row.states} states, ${row.years} years)`);
    }
  }
  console.log(`\nTotal: ${count} records ingested`);
}

run().catch(e => {
  console.error(e.message);
  process.exit(1);
});
