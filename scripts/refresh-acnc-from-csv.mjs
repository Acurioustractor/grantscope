#!/usr/bin/env node

/**
 * Refresh ACNC charities from a pre-downloaded CSV file.
 *
 * Downloads (or uses cached) ACNC register CSV from data.gov.au,
 * parses it, and upserts all charities to acnc_charities table.
 *
 * Usage:
 *   node scripts/refresh-acnc-from-csv.mjs [--dry-run] [--csv=/tmp/acnc_register.csv]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const csvArg = process.argv.find(a => a.startsWith('--csv='))?.split('=')[1];
const CSV_PATH = csvArg || '/tmp/acnc_register.csv';
const BATCH_SIZE = 200;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (msg) => console.log(`[acnc-refresh] ${msg}`);

// Foundation detection
const FOUNDATION_PATTERNS = [
  /\bfoundation\b/i, /\bancillary fund\b/i, /\bpaf\b/i, /\bpuaf\b/i,
  /\btrust\b/i, /\bendowment\b/i, /\bphilanthrop/i, /\bgiving\b/i,
  /\bcommunity fund\b/i, /\bcharitable fund\b/i, /\bgrant.?making\b/i,
];
const EXCLUDE_PATTERNS = [
  /\bunit trust\b/i, /\bliving trust\b/i, /\bfamily trust\b/i,
  /\bsuperannuation\b/i, /\bsuper fund\b/i, /\bstrata\b/i,
  /\bproperty trust\b/i, /\binvestment trust\b/i, /\btrustee (company|services)\b/i,
];

function isFoundationName(name, otherNames) {
  const combined = `${name} ${otherNames || ''}`;
  const matches = FOUNDATION_PATTERNS.some(p => p.test(combined));
  if (!matches) return false;
  const excluded = EXCLUDE_PATTERNS.some(p => p.test(combined));
  if (excluded) {
    return /\bcharitable\b/i.test(combined) || /\bfoundation\b/i.test(combined);
  }
  return true;
}

const yn = (v) => v === 'Y';

const PURPOSE_MAP = [
  { csv: 'Preventing_or_relieving_suffering_of_animals', col: 'purpose_animal_welfare', label: 'Animal Welfare' },
  { csv: 'Advancing_Culture', col: 'purpose_culture', label: 'Culture' },
  { csv: 'Advancing_Education', col: 'purpose_education', label: 'Education' },
  { csv: 'Advancing_Health', col: 'purpose_health', label: 'Health' },
  { csv: 'Promote_or_oppose_a_change_to_law__government_poll_or_prac', col: 'purpose_law_policy', label: 'Law & Policy' },
  { csv: 'Advancing_natual_environment', col: 'purpose_natural_environment', label: 'Environment' },
  { csv: 'Promoting_or_protecting_human_rights', col: 'purpose_human_rights', label: 'Human Rights' },
  { csv: 'Purposes_beneficial_to_ther_general_public_and_other_analogous', col: 'purpose_general_public', label: 'General Public' },
  { csv: 'Promoting_reconciliation__mutual_respect_and_tolerance', col: 'purpose_reconciliation', label: 'Reconciliation' },
  { csv: 'Advancing_Religion', col: 'purpose_religion', label: 'Religion' },
  { csv: 'Advancing_social_or_public_welfare', col: 'purpose_social_welfare', label: 'Social Welfare' },
  { csv: 'Advancing_security_or_safety_of_Australia_or_Australian_public', col: 'purpose_security', label: 'Security' },
];

const BENEFICIARY_MAP = [
  { csv: 'Aboriginal_or_TSI', col: 'ben_aboriginal_tsi', label: 'First Nations' },
  { csv: 'Adults', col: 'ben_adults', label: 'Adults' },
  { csv: 'Aged_Persons', col: 'ben_aged', label: 'Aged' },
  { csv: 'Children', col: 'ben_children', label: 'Children' },
  { csv: 'Communities_Overseas', col: 'ben_communities_overseas', label: 'Overseas' },
  { csv: 'Early_Childhood', col: 'ben_early_childhood', label: 'Early Childhood' },
  { csv: 'Ethnic_Groups', col: 'ben_ethnic_groups', label: 'Ethnic Groups' },
  { csv: 'Families', col: 'ben_families', label: 'Families' },
  { csv: 'Females', col: 'ben_females', label: 'Females' },
  { csv: 'Financially_Disadvantaged', col: 'ben_financially_disadvantaged', label: 'Financially Disadvantaged' },
  { csv: 'LGBTIQA+', col: 'ben_lgbtiqa', label: 'LGBTIQA+' },
  { csv: 'General_Community_in_Australia', col: 'ben_general_community', label: 'General Community' },
  { csv: 'Males', col: 'ben_males', label: 'Males' },
  { csv: 'Migrants_Refugees_or_Asylum_Seekers', col: 'ben_migrants_refugees', label: 'Migrants & Refugees' },
  { csv: 'Other_Beneficiaries', col: 'ben_other', label: 'Other' },
  { csv: 'Other_Charities', col: 'ben_other_charities', label: 'Other Charities' },
  { csv: 'People_at_risk_of_homelessness', col: 'ben_people_at_risk_of_homelessness', label: 'Homelessness Risk' },
  { csv: 'People_with_Chronic_Illness', col: 'ben_people_with_chronic_illness', label: 'Chronic Illness' },
  { csv: 'People_with_Disabilities', col: 'ben_people_with_disabilities', label: 'Disability' },
  { csv: 'Pre_Post_Release_Offenders', col: 'ben_pre_post_release', label: 'Pre/Post Release' },
  { csv: 'Rural_Regional_Remote_Communities', col: 'ben_rural_regional_remote', label: 'Rural & Remote' },
  { csv: 'Unemployed_Person', col: 'ben_unemployed', label: 'Unemployed' },
  { csv: 'Veterans_or_their_families', col: 'ben_veterans', label: 'Veterans' },
  { csv: 'Victims_of_crime', col: 'ben_victims_of_crime', label: 'Victims of Crime' },
  { csv: 'Victims_of_Disasters', col: 'ben_victims_of_disaster', label: 'Disaster Victims' },
  { csv: 'Youth', col: 'ben_youth', label: 'Youth' },
  { csv: 'animals', col: 'ben_animals', label: 'Animals' },
  { csv: 'environment', col: 'ben_environment', label: 'Environment' },
  { csv: 'other_gender_identities', col: 'ben_other_gender_identities', label: 'Other Gender Identities' },
];

const STATE_COLS = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

function parseDate(s) {
  if (!s || s === '') return null;
  const parts = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    const d = new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function mapRow(row) {
  const record = {
    abn: row.ABN,
    name: row.Charity_Legal_Name,
    other_names: row.Other_Organisation_Names || null,
    charity_size: row.Charity_Size || null,
    pbi: yn(row.PBI),
    hpc: yn(row.HPC),
    registration_date: parseDate(row.Registration_Date),
    date_established: parseDate(row.Date_Organisation_Established),
    number_of_responsible_persons: row.Number_of_Responsible_Persons ? parseInt(row.Number_of_Responsible_Persons, 10) || null : null,
    financial_year_end: row.Financial_Year_End || null,
    address_line_1: row.Address_Line_1 || null,
    address_line_2: row.Address_Line_2 || null,
    address_line_3: row.Address_Line_3 || null,
    town_city: row.Town_City || null,
    state: row.State || null,
    postcode: row.Postcode || null,
    country: row.Country || null,
    website: row.Charity_Website || null,
    operating_countries: row.Operating_Countries || null,
  };

  // Operating states
  const states = [];
  for (const st of STATE_COLS) {
    const key = `operates_in_${st.toLowerCase()}`;
    record[key] = yn(row[`Operates_in_${st}`]);
    if (record[key]) states.push(st);
  }
  record.operating_states = states;

  // Purposes
  const purposes = [];
  for (const p of PURPOSE_MAP) {
    record[p.col] = yn(row[p.csv]);
    if (record[p.col]) purposes.push(p.label);
  }
  record.purposes = purposes;

  // Beneficiaries
  const beneficiaries = [];
  for (const b of BENEFICIARY_MAP) {
    record[b.col] = yn(row[b.csv]);
    if (record[b.col]) beneficiaries.push(b.label);
  }
  record.beneficiaries = beneficiaries;

  // Foundation flag
  record.is_foundation = isFoundationName(row.Charity_Legal_Name, row.Other_Organisation_Names);

  return record;
}

async function downloadCsv() {
  if (existsSync(CSV_PATH)) {
    log(`Using existing CSV at ${CSV_PATH}`);
    return;
  }

  log('Downloading ACNC register from data.gov.au...');
  const metaRes = await fetch('https://data.gov.au/data/api/3/action/package_show?id=b050b242-4487-4306-abf5-07ca073e5594');
  const meta = await metaRes.json();
  const csvResource = meta.result.resources.find(r => r.format === 'CSV');
  if (!csvResource) throw new Error('CSV resource not found on data.gov.au');

  log(`Downloading from ${csvResource.url}...`);
  execSync(`curl -sL -o "${CSV_PATH}" "${csvResource.url}"`, { timeout: 120000 });
  log('Download complete');
}

async function main() {
  log(`Starting ACNC register refresh (dry-run=${DRY_RUN})`);

  await downloadCsv();

  const csvText = readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
  log(`Parsed ${records.length} raw rows from CSV`);

  // Dedup by ABN (CSV has multiple rows per org for different address types)
  const byAbn = new Map();
  for (const row of records) {
    if (!row.ABN) continue;
    if (!byAbn.has(row.ABN)) {
      byAbn.set(row.ABN, mapRow(row));
    }
  }
  const unique = [...byAbn.values()];
  log(`${unique.length} unique charities (deduped by ABN)`);

  // Stats
  const foundations = unique.filter(r => r.is_foundation).length;
  const withPBI = unique.filter(r => r.pbi).length;
  const bySize = {};
  for (const r of unique) {
    const s = r.charity_size || 'Unknown';
    bySize[s] = (bySize[s] || 0) + 1;
  }
  log(`Foundations: ${foundations}, PBI: ${withPBI}`);
  log(`By size: ${Object.entries(bySize).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  if (DRY_RUN) {
    log('DRY RUN -- sample:');
    for (const r of unique.slice(0, 5)) {
      log(`  ${r.abn} | ${r.name} | ${r.charity_size} | ${r.registration_date}`);
    }
    return;
  }

  // Batch upsert
  log('Upserting to acnc_charities...');
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('acnc_charities')
      .upsert(batch, { onConflict: 'abn' });

    if (error) {
      console.error(`Batch error at ${i}: ${error.message}`);
      errors += batch.length;
      if (errors <= BATCH_SIZE) {
        console.error('Sample record:', JSON.stringify(batch[0], null, 2));
      }
    } else {
      inserted += batch.length;
    }

    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= unique.length) {
      log(`  Progress: ${Math.min(i + BATCH_SIZE, unique.length)}/${unique.length} (${errors} errors)`);
    }
  }

  log(`Complete: ${inserted} upserted, ${errors} errors`);
}

main().catch(err => {
  console.error('[acnc-refresh] Fatal:', err.message);
  process.exit(1);
});
