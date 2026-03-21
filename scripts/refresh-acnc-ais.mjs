#!/usr/bin/env node

/**
 * refresh-acnc-ais.mjs — ACNC AIS Annual Refresh Agent
 *
 * Checks data.gov.au for new ACNC AIS (Annual Information Statement) datasets,
 * downloads CSVs, and upserts into the acnc_ais table. Also refreshes
 * foundations.total_giving_annual with actual AIS data and identifies new
 * grant-making charities to add to the foundations table.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-acnc-ais.mjs [--dry-run] [--year=2024]
 *
 * Data source: https://data.gov.au/data/dataset/acnc-register
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream, unlinkSync, existsSync } from 'fs';
import { parse } from 'csv-parse';
import { tmpdir } from 'os';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const yearArg = process.argv.find(a => a.startsWith('--year='));
const FORCE_YEAR = yearArg ? parseInt(yearArg.split('=')[1], 10) : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AGENT_ID = 'refresh-acnc-ais';
const AGENT_NAME = 'ACNC AIS Annual Refresh';

// ACNC AIS datasets on data.gov.au — each year is a separate CKAN package
// Search API to find all AIS packages
const CKAN_SEARCH_URL = 'https://data.gov.au/data/api/3/action/package_search?q=acnc+annual+information+statement&rows=20';

// Column mapping from CSV headers to DB columns
const CSV_TO_DB = {
  'ABN': 'abn',
  'Charity_Legal_Name': 'charity_name',
  'AIS_Year': 'ais_year',
  'Registration_Status': 'registration_status',
  'Charity_Website': 'charity_website',
  'Charity_Size': 'charity_size',
  'BRC': 'basic_religious_charity',
  'AIS_Due_Date': 'ais_due_date',
  'Date_AIS_Received': 'date_ais_received',
  'Financial_Report_Date_Received': 'financial_report_date_received',
  'Conducted_Activities': 'conducted_activities',
  'Why_Not_Conducted': 'why_not_conducted',
  'How_Purposes_Pursued': 'how_purposes_pursued',
  'International_Activities_Details': 'international_activities_details',
  'Staff_Full_Time': 'staff_full_time',
  'Staff_Part_Time': 'staff_part_time',
  'Staff_Casual': 'staff_casual',
  'Staff_FTE': 'staff_fte',
  'Staff_Volunteers': 'staff_volunteers',
  'Cash_or_Accrual': 'cash_or_accrual',
  'Financial_Statement_Type': 'financial_statement_type',
  'Report_Consolidated': 'report_consolidated',
  'Report_Has_Modification': 'report_has_modification',
  'Modification_Type': 'modification_type',
  'Has_Related_Party_Transactions': 'has_related_party_transactions',
  'Fin_Report_From': 'fin_report_from',
  'Fin_Report_To': 'fin_report_to',
  'Revenue_From_Government': 'revenue_from_government',
  'Donations_And_Bequests': 'donations_and_bequests',
  'Revenue_From_Goods_Services': 'revenue_from_goods_services',
  'Revenue_From_Investments': 'revenue_from_investments',
  'All_Other_Revenue': 'all_other_revenue',
  'Total_Revenue': 'total_revenue',
  'Other_Income': 'other_income',
  'Total_Gross_Income': 'total_gross_income',
  'Employee_Expenses': 'employee_expenses',
  'Interest_Expenses': 'interest_expenses',
  'Grants_Donations_AU': 'grants_donations_au',
  'Grants_Donations_Intl': 'grants_donations_intl',
  'All_Other_Expenses': 'all_other_expenses',
  'Total_Expenses': 'total_expenses',
  'Net_Surplus_Deficit': 'net_surplus_deficit',
  'Other_Comprehensive_Income': 'other_comprehensive_income',
  'Total_Comprehensive_Income': 'total_comprehensive_income',
  'Total_Current_Assets': 'total_current_assets',
  'Non_Current_Loans_Receivable': 'non_current_loans_receivable',
  'Other_Non_Current_Assets': 'other_non_current_assets',
  'Total_Non_Current_Assets': 'total_non_current_assets',
  'Total_Assets': 'total_assets',
  'Total_Current_Liabilities': 'total_current_liabilities',
  'Non_Current_Loans_Payable': 'non_current_loans_payable',
  'Other_Non_Current_Liabilities': 'other_non_current_liabilities',
  'Total_Non_Current_Liabilities': 'total_non_current_liabilities',
  'Total_Liabilities': 'total_liabilities',
  'Net_Assets_Liabilities': 'net_assets_liabilities',
  'Has_Key_Management_Personnel': 'has_key_management_personnel',
  'Num_Key_Management_Personnel': 'num_key_management_personnel',
  'Total_Paid_Key_Management': 'total_paid_key_management',
  'Incorporated_Association': 'incorporated_association',
};

const BOOLEAN_COLS = new Set([
  'basic_religious_charity', 'conducted_activities', 'report_consolidated',
  'report_has_modification', 'has_related_party_transactions',
  'has_key_management_personnel', 'incorporated_association',
]);
const DATE_COLS = new Set([
  'ais_due_date', 'date_ais_received', 'financial_report_date_received',
  'fin_report_from', 'fin_report_to',
]);
const INT_COLS = new Set([
  'ais_year', 'staff_full_time', 'staff_part_time', 'staff_casual',
  'staff_volunteers', 'num_key_management_personnel',
]);
const NUMERIC_COLS = new Set([
  'staff_fte', 'revenue_from_government', 'donations_and_bequests',
  'revenue_from_goods_services', 'revenue_from_investments', 'all_other_revenue',
  'total_revenue', 'other_income', 'total_gross_income', 'employee_expenses',
  'interest_expenses', 'grants_donations_au', 'grants_donations_intl',
  'all_other_expenses', 'total_expenses', 'net_surplus_deficit',
  'other_comprehensive_income', 'total_comprehensive_income',
  'total_current_assets', 'non_current_loans_receivable', 'other_non_current_assets',
  'total_non_current_assets', 'total_assets', 'total_current_liabilities',
  'non_current_loans_payable', 'other_non_current_liabilities',
  'total_non_current_liabilities', 'total_liabilities', 'net_assets_liabilities',
  'total_paid_key_management',
]);

function parseValue(col, val) {
  if (val === '' || val === null || val === undefined) return null;
  if (BOOLEAN_COLS.has(col)) return val === 'Y' || val === 'Yes' || val === 'true' || val === '1';
  if (DATE_COLS.has(col)) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  if (INT_COLS.has(col)) {
    const n = parseInt(val.replace(/,/g, ''), 10);
    return isNaN(n) ? null : n;
  }
  if (NUMERIC_COLS.has(col)) {
    const n = parseFloat(val.replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }
  return val;
}

async function discoverAisResources() {
  console.log('  Searching data.gov.au for AIS datasets...');
  const resp = await fetch(CKAN_SEARCH_URL);
  const data = await resp.json();

  if (!data.success || !data.result?.results) {
    throw new Error('Failed to search CKAN for AIS datasets');
  }

  // Each AIS year is a separate CKAN package (e.g., "acnc-2023-annual-information-statement-ais-data")
  // Extract the year from the package name, find the CSV resource
  const aisResources = [];
  for (const pkg of data.result.results) {
    // Only match ACNC AIS packages
    if (!pkg.name?.startsWith('acnc-') && !pkg.name?.startsWith('acnc2')) continue;
    if (!pkg.name?.includes('ais') && !pkg.name?.includes('annual-information')) continue;

    const yearMatch = pkg.name.match(/(\d{4})/);
    if (!yearMatch) continue;
    const year = parseInt(yearMatch[1], 10);
    if (year < 2017) continue; // Only import 2017+

    // Find the main CSV resource (prefer the one with "AIS" data, not charity register)
    const csv = pkg.resources?.find(r =>
      r.format === 'CSV' && !r.name?.includes('register')
    );
    if (!csv) continue;

    aisResources.push({ ...csv, year, packageName: pkg.name });
  }

  // Sort by year
  aisResources.sort((a, b) => a.year - b.year);
  console.log(`  Found ${aisResources.length} AIS datasets: ${aisResources.map(r => r.year).join(', ')}`);
  return aisResources;
}

async function getExistingYears() {
  const { data } = await supabase.rpc('exec_sql', {
    query: 'SELECT DISTINCT ais_year FROM acnc_ais ORDER BY ais_year',
  });
  return new Set((data || []).map(r => Number(r.ais_year)));
}

async function downloadCsv(url, destPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${url}`);
  const ws = createWriteStream(destPath);
  await pipeline(resp.body, ws);
}

async function importCsv(csvPath, resourceId) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const parser = createReadStream(csvPath).pipe(parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }));

    parser.on('data', (csvRow) => {
      const row = {};
      for (const [csvCol, dbCol] of Object.entries(CSV_TO_DB)) {
        if (csvRow[csvCol] !== undefined) {
          row[dbCol] = parseValue(dbCol, csvRow[csvCol]);
        }
      }
      if (!row.abn || !row.ais_year) return; // skip invalid
      row.data_source = 'data.gov.au';
      row.resource_id = resourceId;
      row.imported_at = new Date().toISOString();
      rows.push(row);
    });

    parser.on('end', () => resolve(rows));
    parser.on('error', reject);
  });
}

async function upsertBatch(rows) {
  const BATCH_SIZE = 500;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('acnc_ais')
      .upsert(batch, { onConflict: 'abn,ais_year', ignoreDuplicates: false });

    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE)} error:`, error.message);
    } else {
      inserted += batch.length;
    }

    if (i % 5000 === 0 && i > 0) {
      console.log(`  Upserted ${i.toLocaleString()} of ${rows.length.toLocaleString()}...`);
    }
  }

  return { inserted, updated };
}

async function enrichFoundations(aisYear) {
  // Update foundations.total_giving_annual with actual AIS data
  const { data: enrichResult } = await supabase.rpc('exec_sql', {
    query: `UPDATE foundations f
            SET total_giving_annual = a.grants_donations_au, updated_at = NOW()
            FROM acnc_ais a
            WHERE a.abn = f.acnc_abn AND a.ais_year = ${aisYear}
              AND a.grants_donations_au > 0
              AND (f.total_giving_annual IS NULL OR f.total_giving_annual < a.grants_donations_au * 0.5)
            RETURNING f.id`,
  });
  const enriched = Array.isArray(enrichResult) ? enrichResult.length : 0;
  console.log(`  Enriched ${enriched} foundations with AIS ${aisYear} giving data`);

  // Find new grant-making charities not yet in foundations
  const { data: newFoundations } = await supabase.rpc('exec_sql', {
    query: `INSERT INTO foundations (name, acnc_abn, total_giving_annual, type, enrichment_source, enriched_at)
            SELECT c.name, c.abn, a.grants_donations_au,
              CASE WHEN c.is_foundation THEN 'private_ancillary_fund' ELSE 'grant_maker' END,
              'acnc_ais_${aisYear}', NOW()
            FROM acnc_ais a
            JOIN acnc_charities c ON c.abn = a.abn
            WHERE a.ais_year = ${aisYear}
              AND a.grants_donations_au > 500000
              AND (c.is_foundation = true OR a.grants_donations_au / NULLIF(a.total_expenses, 0) > 0.5)
              AND NOT EXISTS (SELECT 1 FROM foundations f WHERE f.acnc_abn = a.abn)
            ON CONFLICT (acnc_abn) DO NOTHING
            RETURNING id`,
  });
  const newCount = Array.isArray(newFoundations) ? newFoundations.length : 0;
  console.log(`  Added ${newCount} new foundations from AIS ${aisYear}`);

  return { enriched, newFoundations: newCount };
}

async function main() {
  console.log('\n  ACNC AIS Annual Refresh\n');

  const run = await logStart(supabase, AGENT_ID, AGENT_NAME);

  try {
    const existingYears = await getExistingYears();
    console.log(`  Existing years in DB: ${[...existingYears].join(', ')}`);

    // Discover available AIS resources
    const resources = await discoverAisResources();

    // Determine which years to import
    let targetResources = [];
    if (FORCE_YEAR) {
      const r = resources.find(r => r.year === FORCE_YEAR);
      if (r) targetResources.push(r);
      else console.log(`  No AIS resource found for year ${FORCE_YEAR}`);
    } else {
      // Find resources for years we don't have
      targetResources = resources.filter(r => !existingYears.has(r.year));
    }

    if (targetResources.length === 0) {
      console.log('  No new AIS years to import — database is up to date.');
      await logComplete(supabase, run.id, {
        items_found: 0,
        items_new: 0,
        items_updated: 0,
      });
      return;
    }

    console.log(`  Importing ${targetResources.length} new year(s): ${targetResources.map(r => r.year).join(', ')}`);

    let totalImported = 0;
    let totalEnriched = 0;
    let totalNewFoundations = 0;

    for (const resource of targetResources) {
      console.log(`\n  Processing AIS ${resource.year}...`);
      console.log(`  URL: ${resource.url}`);

      if (DRY_RUN) {
        console.log('  [DRY RUN] Would download and import');
        continue;
      }

      // Download CSV
      const csvPath = join(tmpdir(), `acnc_ais_${resource.year}.csv`);
      console.log(`  Downloading to ${csvPath}...`);
      await downloadCsv(resource.url, csvPath);

      // Parse CSV
      console.log('  Parsing CSV...');
      const rows = await importCsv(csvPath, resource.id);
      console.log(`  Parsed ${rows.length.toLocaleString()} rows`);

      // Upsert
      console.log('  Upserting...');
      const { inserted } = await upsertBatch(rows);
      totalImported += inserted;
      console.log(`  Upserted ${inserted.toLocaleString()} rows`);

      // Enrich foundations
      const enrichResult = await enrichFoundations(resource.year);
      totalEnriched += enrichResult.enriched;
      totalNewFoundations += enrichResult.newFoundations;

      // Cleanup
      if (existsSync(csvPath)) unlinkSync(csvPath);
    }

    console.log(`\n  Summary:`);
    console.log(`  - AIS rows imported: ${totalImported.toLocaleString()}`);
    console.log(`  - Foundations enriched: ${totalEnriched}`);
    console.log(`  - New foundations added: ${totalNewFoundations}`);

    await logComplete(supabase, run.id, {
      items_found: totalImported,
      items_new: totalNewFoundations,
      items_updated: totalEnriched,
    });
  } catch (err) {
    console.error('  FATAL:', err.message);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();
