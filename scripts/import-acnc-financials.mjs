#!/usr/bin/env node

/**
 * Import ACNC Annual Information Statement (AIS) Financial Data
 *
 * Downloads AIS data from data.gov.au CKAN API and:
 * 1. Stores ALL raw AIS records in acnc_ais table (full financials)
 * 2. Updates existing foundations with key financial data
 *
 * Data source: https://data.gov.au/data/dataset/acnc-2023-annual-information-statement-ais-data
 * License: CC BY 4.0
 *
 * Usage:
 *   node scripts/import-acnc-financials.mjs                # Import all years (2017-2023)
 *   node scripts/import-acnc-financials.mjs --year 2022    # Import specific year
 *   node scripts/import-acnc-financials.mjs --dry-run      # Preview only
 *   node scripts/import-acnc-financials.mjs --store-only   # Only store in acnc_ais, don't update foundations
 *   node scripts/import-acnc-financials.mjs --match-only   # Only update foundations, don't store raw
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const STORE_ONLY = process.argv.includes('--store-only');
const MATCH_ONLY = process.argv.includes('--match-only');

// Parse --year flag (default: all years)
const yearIdx = process.argv.indexOf('--year');
const SINGLE_YEAR = yearIdx !== -1 ? parseInt(process.argv[yearIdx + 1]) : null;

// CKAN resource IDs for each AIS year on data.gov.au
const AIS_DATASETS = {
  2017: '8d020b50-700f-4bc4-8c78-79f83d99be7a',
  2018: '9312452f-fced-476e-a6ec-2b2327796a34',
  2019: '76006467-18f2-4094-a1cb-50544fd9b7b2',
  2020: '62c7b3d3-4358-4d57-b810-a36732d36e2d',
  2021: 'bbb19fa5-2f63-49cb-96b2-523e25828f27',
  2022: 'cfbcf6f1-7ce5-472f-bfd3-a478e67e0366',
  2023: '2b0fb746-57c5-4523-bb4c-74b7b78279d9',
};

const CKAN_API = 'https://data.gov.au/data/api/action/datastore_search';
const FETCH_BATCH_SIZE = 100;
const UPSERT_BATCH_SIZE = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseNum(val) {
  if (val === null || val === undefined || val === '' || val === 'n/a') return null;
  const n = parseFloat(String(val).replace(/[,$]/g, ''));
  return isNaN(n) ? null : n;
}

function parseBool(val) {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1';
}

function parseDate(val) {
  if (!val || val === '') return null;
  // ACNC uses dd/mm/yyyy format
  const parts = String(val).split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Map a raw CKAN record to our acnc_ais table schema
 */
function mapToAisRow(raw, aisYear, resourceId) {
  const abn = String(raw.abn || '').replace(/\s/g, '');
  if (!abn) return null;

  // Build association numbers JSONB
  const associationNumbers = {};
  const states = ['act', 'nsw', 'nt', 'qld', 'sa', 'tas', 'vic', 'wa'];
  for (const st of states) {
    const val = raw[`association number - ${st}`];
    if (val) associationNumbers[st] = val;
  }

  // Build fundraising states & numbers JSONB
  const fundraisingStates = {};
  const fundraisingNumbers = {};
  for (const st of states) {
    fundraisingStates[st] = parseBool(raw[`fundraising - ${st}`]);
    const num = raw[`fundraising number - ${st}`];
    if (num) fundraisingNumbers[st] = num;
  }
  // Online fundraising
  fundraisingStates.online = parseBool(raw['fundraising - online']);

  return {
    abn,
    charity_name: raw['charity name'] || '',
    ais_year: aisYear,

    // Registration & Status
    registration_status: raw['registration status'] || null,
    charity_website: raw['charity website'] || null,
    charity_size: raw['charity size']?.toLowerCase() || null,
    basic_religious_charity: parseBool(raw['basic religious charity']),
    ais_due_date: parseDate(raw['ais due date']),
    date_ais_received: parseDate(raw['date ais received']),
    financial_report_date_received: parseDate(raw['financial report date received']),

    // Activities
    conducted_activities: parseBool(raw['conducted activities']),
    why_not_conducted: raw['why charity did not conduct activities'] || null,
    how_purposes_pursued: raw['how purposes were pursued'] || null,
    international_activities_details: raw['international activities details'] || null,

    // Staff
    staff_full_time: parseNum(raw['staff - full time']),
    staff_part_time: parseNum(raw['staff - part time']),
    staff_casual: parseNum(raw['staff - casual']),
    staff_fte: parseNum(raw['total full time equivalent staff']),
    staff_volunteers: parseNum(raw['staff - volunteers']),

    // Financial Reporting
    cash_or_accrual: raw['cash or accrual'] || null,
    financial_statement_type: raw['type of financial statement'] || null,
    report_consolidated: parseBool(raw['report consolidated with more than one entity']),
    report_has_modification: parseBool(raw['charity report has a modification']),
    modification_type: raw['type of report modification'] || null,
    has_related_party_transactions: parseBool(raw['charity has reportable related party transactions']),
    fin_report_from: parseDate(raw['fin report from']),
    fin_report_to: parseDate(raw['fin report to']),

    // Revenue
    revenue_from_government: parseNum(raw['revenue from government']),
    donations_and_bequests: parseNum(raw['donations and bequests']),
    revenue_from_goods_services: parseNum(raw['revenue from goods and services']),
    revenue_from_investments: parseNum(raw['revenue from investments']),
    all_other_revenue: parseNum(raw['all other revenue']),
    total_revenue: parseNum(raw['total revenue']),
    other_income: parseNum(raw['other income']),
    total_gross_income: parseNum(raw['total gross income']),

    // Expenses
    employee_expenses: parseNum(raw['employee expenses']),
    interest_expenses: parseNum(raw['interest expenses']),
    grants_donations_au: parseNum(raw['grants and donations made for use in Australia']),
    grants_donations_intl: parseNum(raw['grants and donations made for use outside Australia']),
    all_other_expenses: parseNum(raw['all other expenses']),
    total_expenses: parseNum(raw['total expenses']),

    // Surplus/Deficit
    net_surplus_deficit: parseNum(raw['net surplus/deficit']),
    other_comprehensive_income: parseNum(raw['other comprehensive income']),
    total_comprehensive_income: parseNum(raw['total comprehensive income']),

    // Assets & Liabilities
    total_current_assets: parseNum(raw['total current assets']),
    non_current_loans_receivable: parseNum(raw['non-current loans receivable']),
    other_non_current_assets: parseNum(raw['other non-current assets']),
    total_non_current_assets: parseNum(raw['total non-current assets']),
    total_assets: parseNum(raw['total assets']),
    total_current_liabilities: parseNum(raw['total current liabilities']),
    non_current_loans_payable: parseNum(raw['non-current loans payable']),
    other_non_current_liabilities: parseNum(raw['other non-current liabilities']),
    total_non_current_liabilities: parseNum(raw['total non-current liabilities']),
    total_liabilities: parseNum(raw['total liabilities']),
    net_assets_liabilities: parseNum(raw['net assets/liabilities']),

    // Key Management Personnel
    has_key_management_personnel: raw['Key Management Personnel']?.toLowerCase() === 'yes',
    num_key_management_personnel: parseNum(raw['Number of Key Management Personnel']),
    total_paid_key_management: parseNum(raw['Total paid to Key Management Personnel']),

    // Association & Fundraising
    incorporated_association: parseBool(raw['incorporated association']),
    association_numbers: Object.keys(associationNumbers).length > 0 ? associationNumbers : null,
    fundraising_states: fundraisingStates,
    fundraising_numbers: Object.keys(fundraisingNumbers).length > 0 ? fundraisingNumbers : null,

    // Metadata
    data_source: 'data.gov.au',
    resource_id: resourceId,
  };
}

/**
 * Fetch all AIS records from CKAN API with pagination
 */
async function fetchAllAIS(aisYear, resourceId) {
  let offset = 0;
  let allRecords = [];
  let total = 0;

  console.log(`[acnc] Fetching AIS ${aisYear} data from data.gov.au...`);

  while (true) {
    const url = `${CKAN_API}?resource_id=${resourceId}&limit=${FETCH_BATCH_SIZE}&offset=${offset}`;
    let response;
    for (let attempt = 0; attempt < 5; attempt++) {
      response = await fetch(url);
      if (response.ok) break;
      if (response.status === 403 || response.status === 429) {
        const wait = (attempt + 1) * 10;
        console.log(`[acnc]   Rate limited (${response.status}), waiting ${wait}s...`);
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error(`CKAN API error: ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(`CKAN API error after retries: ${response.status}`);
    }

    const data = await response.json();
    const records = data.result?.records || [];
    total = data.result?.total || 0;

    if (records.length === 0) break;

    allRecords = allRecords.concat(records);
    offset += FETCH_BATCH_SIZE;

    if (offset % 5000 === 0) {
      console.log(`[acnc]   Fetched ${allRecords.length}/${total} records...`);
    }

    // Small delay to be polite
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[acnc] Downloaded ${allRecords.length} AIS records`);
  return allRecords;
}

/**
 * Store all AIS records in acnc_ais table
 */
async function storeAllRecords(aisRecords, aisYear, resourceId) {
  console.log(`[acnc] Storing ${aisRecords.length} records for ${aisYear} in acnc_ais table...`);

  const rows = aisRecords.map(r => mapToAisRow(r, aisYear, resourceId)).filter(Boolean);
  console.log(`[acnc]   ${rows.length} valid records to upsert`);

  let stored = 0;
  let errors = 0;

  // Upsert in batches
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);

    if (DRY_RUN) {
      stored += batch.length;
      continue;
    }

    const { error } = await supabase
      .from('acnc_ais')
      .upsert(batch, { onConflict: 'abn,ais_year', ignoreDuplicates: false });

    if (error) {
      console.error(`[acnc]   Batch ${i}-${i + batch.length} error: ${error.message}`);
      errors++;
      // Try individual inserts for the failed batch
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from('acnc_ais')
          .upsert(row, { onConflict: 'abn,ais_year', ignoreDuplicates: false });
        if (singleErr) {
          if (errors <= 5) console.error(`[acnc]     ${row.charity_name}: ${singleErr.message}`);
          errors++;
        } else {
          stored++;
        }
      }
    } else {
      stored += batch.length;
    }

    if ((i + UPSERT_BATCH_SIZE) % 5000 === 0) {
      console.log(`[acnc]   Stored ${stored} records...`);
    }
  }

  console.log(`[acnc]   Stored: ${stored}`);
  if (errors > 0) console.log(`[acnc]   Errors: ${errors}`);
}

/**
 * Update existing foundations with key financial data from AIS
 */
async function updateFoundations(aisRecords) {
  // Get all existing foundations with ABNs
  const { data: foundations, error } = await supabase
    .from('foundations')
    .select('id, name, acnc_abn, total_giving_annual, profile_confidence');

  if (error) {
    console.error('[acnc] Error fetching foundations:', error);
    return;
  }

  // Build ABN lookup
  const abnMap = new Map();
  foundations.forEach(f => {
    if (f.acnc_abn) abnMap.set(f.acnc_abn.replace(/\s/g, ''), f);
  });

  console.log(`[acnc] Matching ${aisRecords.length} AIS records against ${abnMap.size} foundations by ABN`);

  let matched = 0;
  let updated = 0;
  let enriched = 0;
  const grantGivers = [];

  for (const ais of aisRecords) {
    const abn = String(ais.abn || '').replace(/\s/g, '');
    const foundation = abnMap.get(abn);
    if (!foundation) continue;

    matched++;

    const totalRevenue = parseNum(ais['total revenue']);
    const grantsAU = parseNum(ais['grants and donations made for use in Australia']);
    const grantsIntl = parseNum(ais['grants and donations made for use outside Australia']);
    const totalGrants = (grantsAU || 0) + (grantsIntl || 0);
    const investmentRevenue = parseNum(ais['revenue from investments']);
    const totalAssets = parseNum(ais['total assets']);
    const netAssets = parseNum(ais['net assets/liabilities']);

    const givingRatio = totalRevenue && totalGrants ? Math.round((totalGrants / totalRevenue) * 100) : null;

    if (totalGrants > 0) {
      grantGivers.push({
        name: foundation.name,
        abn,
        grants: totalGrants,
        revenue: totalRevenue,
        ratio: givingRatio,
      });
    }

    if (DRY_RUN) {
      if (totalGrants > 100000) {
        console.log(`  ${foundation.name.slice(0, 50).padEnd(50)} grants: $${Math.round(totalGrants / 1000)}K  revenue: $${Math.round((totalRevenue || 0) / 1000)}K`);
      }
      continue;
    }

    const updateData = {};
    if (totalGrants > 0) {
      updateData.total_giving_annual = totalGrants;
      updateData.giving_ratio = givingRatio;
      enriched++;
    }
    if (totalAssets) updateData.endowment_size = netAssets || totalAssets;
    if (investmentRevenue) updateData.investment_returns = investmentRevenue;

    if (Object.keys(updateData).length === 0) continue;

    const { error: updateErr } = await supabase
      .from('foundations')
      .update(updateData)
      .eq('id', foundation.id);

    if (updateErr) {
      console.log(`  Error updating ${foundation.name}: ${updateErr.message}`);
    } else {
      updated++;
    }
  }

  console.log(`\n[acnc] Foundation update results:`);
  console.log(`  Matched by ABN: ${matched}/${aisRecords.length}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  With grant data: ${enriched}`);

  if (DRY_RUN && grantGivers.length > 0) {
    console.log(`\n[acnc] Top grant-making foundations (from AIS ${AIS_YEAR}):`);
    grantGivers
      .sort((a, b) => b.grants - a.grants)
      .slice(0, 30)
      .forEach((g, i) => {
        console.log(`  ${(i + 1 + '.').padEnd(4)} ${g.name.slice(0, 45).padEnd(45)} $${Math.round(g.grants / 1e6)}M grants  (${g.ratio || '?'}% ratio)`);
      });
  }
}

async function main() {
  const years = SINGLE_YEAR ? [SINGLE_YEAR] : Object.keys(AIS_DATASETS).map(Number).sort();

  console.log(`[acnc] ACNC AIS Financial Data Import`);
  console.log(`[acnc] Years: ${years.join(', ')}`);
  console.log(`[acnc] Dry run: ${DRY_RUN}`);
  console.log(`[acnc] Mode: ${STORE_ONLY ? 'store-only' : MATCH_ONLY ? 'match-only' : 'full (store + update foundations)'}`);

  let totalStored = 0;

  for (const year of years) {
    const resourceId = AIS_DATASETS[year];
    if (!resourceId) {
      console.error(`[acnc] No resource ID for year ${year}`);
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[acnc] === AIS ${year} ===`);
    console.log(`${'='.repeat(60)}`);

    const aisRecords = await fetchAllAIS(year, resourceId);
    totalStored += aisRecords.length;

    if (!MATCH_ONLY) {
      await storeAllRecords(aisRecords, year, resourceId);
    }
  }

  // Update foundations from most recent year only (2023 has the latest data)
  if (!STORE_ONLY) {
    const latestYear = Math.max(...years);
    const latestResourceId = AIS_DATASETS[latestYear];
    console.log(`\n[acnc] Updating foundations from latest year (${latestYear})...`);
    const latestRecords = await fetchAllAIS(latestYear, latestResourceId);
    await updateFoundations(latestRecords);
  }

  console.log(`\n[acnc] Done — ${totalStored} total records across ${years.length} years`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
