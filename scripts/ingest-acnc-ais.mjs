#!/usr/bin/env node
/**
 * Ingest ACNC AIS 2023 data (financials + programs)
 * Source: data.gov.au
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-acnc-ais.mjs [--programs-only] [--ais-only]
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BATCH_SIZE = 500;
const AIS_FILE = 'data/acnc/datadotgov_ais23.csv';
const PROGRAMS_FILE = 'data/acnc/datadotgov_ais23_programs.csv';

function num(v) {
  if (!v || v === '' || v === 'N/A') return null;
  const n = Number(v.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function bool(v) {
  if (!v) return false;
  return v.toLowerCase() === 'y' || v.toLowerCase() === 'yes' || v.toLowerCase() === 'true' || v === '1';
}

function date(v) {
  if (!v || v === '') return null;
  // Try various formats
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function ingestAIS() {
  console.log('Ingesting AIS financials...');

  const parser = createReadStream(AIS_FILE).pipe(parse({
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  }));

  let batch = [];
  let total = 0;

  for await (const row of parser) {
    const record = {
      abn: row['abn']?.trim(),
      charity_name: row['charity name']?.trim(),
      registration_status: row['registration status']?.trim(),
      charity_website: row['charity website']?.trim(),
      charity_size: row['charity size']?.trim(),
      basic_religious_charity: bool(row['basic religious charity']),
      ais_due_date: date(row['ais due date']),
      date_ais_received: date(row['date ais received']),
      conducted_activities: bool(row['conducted activities']),
      how_purposes_pursued: row['how purposes were pursued']?.trim() || null,
      staff_full_time: num(row['staff - full time']),
      staff_part_time: num(row['staff - part time']),
      staff_casual: num(row['staff - casual']),
      total_fte_staff: num(row['total full time equivalent staff']),
      staff_volunteers: num(row['staff - volunteers']),
      revenue_from_government: num(row['revenue from government']),
      donations_and_bequests: num(row['donations and bequests']),
      revenue_goods_services: num(row['revenue from goods and services']),
      revenue_investments: num(row['revenue from investments']),
      all_other_revenue: num(row['all other revenue']),
      total_revenue: num(row['total revenue']),
      other_income: num(row['other income']),
      total_gross_income: num(row['total gross income']),
      employee_expenses: num(row['employee expenses']),
      grants_donations_australia: num(row['grants and donations made for use in Australia']),
      grants_donations_overseas: num(row['grants and donations made for use outside Australia']),
      all_other_expenses: num(row['all other expenses']),
      total_expenses: num(row['total expenses']),
      net_surplus_deficit: num(row['net surplus/deficit']),
      total_assets: num(row['total assets']),
      total_liabilities: num(row['total liabilities']),
      net_assets: num(row['net assets/liabilities']),
      kmp_count: num(row['Number of Key Management Personnel']),
      kmp_total_paid: num(row['Total paid to Key Management Personnel']),
      report_year: 2023,
    };

    if (!record.abn) continue;
    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from('acnc_ais').insert(batch);
      if (error) {
        console.error(`  Error at row ${total}:`, error.message);
        // Try one at a time for this batch
        for (const r of batch) {
          const { error: e2 } = await supabase.from('acnc_ais').insert(r);
          if (e2) console.error(`  Skip: ${r.abn} - ${e2.message}`);
        }
      }
      total += batch.length;
      if (total % 5000 === 0) console.log(`  ${total} AIS records...`);
      batch = [];
    }
  }

  if (batch.length) {
    const { error } = await supabase.from('acnc_ais').insert(batch);
    if (error) console.error('  Final batch error:', error.message);
    total += batch.length;
  }

  console.log(`  Done: ${total} AIS records ingested`);
  return total;
}

async function ingestPrograms() {
  console.log('Ingesting Programs...');

  const parser = createReadStream(PROGRAMS_FILE).pipe(parse({
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  }));

  let batch = [];
  let total = 0;

  for await (const row of parser) {
    // Collect operating locations
    const locations = [];
    const coords = [];
    for (let i = 1; i <= 10; i++) {
      const loc = row[`Operating Location ${i}`]?.trim();
      const coord = row[`Operating Location ${i} lat/long`]?.trim();
      if (loc) {
        locations.push(loc);
        if (coord) coords.push(coord);
      }
    }

    const record = {
      abn: row['ABN']?.trim(),
      charity_name: row['Charity Name']?.trim(),
      program_name: row['Program name']?.trim(),
      classification: row['Classification']?.trim(),
      targets_children: bool(row['Children - aged 6 to under 15']),
      targets_environment: bool(row['Environment']),
      targets_families: bool(row['Families']),
      targets_general_community: bool(row['General community in Australia']),
      targets_migrants_refugees: bool(row['Migrants\n refugees or asylum seekers'] || row['Migrants, refugees or asylum seekers']),
      targets_overseas: bool(row['Overseas communities or charities']),
      targets_atsi: bool(row['Aboriginal and Torres Strait Islander people']),
      targets_elderly: bool(row['Adults - aged 65 and over']),
      targets_early_childhood: bool(row['Early childhood - aged under 6']),
      targets_females: bool(row['Females']),
      targets_lgbtiq: bool(row['Gay\n lesbian\n bisexual\n transgender or intersex persons'] || row['Gay, lesbian, bisexual, transgender or intersex persons']),
      targets_males: bool(row['Males']),
      targets_homeless: bool(row['People at risk of homelessness/ people experiencing homelessness']),
      targets_disability: bool(row['People with disabilities']),
      targets_crime_victims: bool(row['Victims of crime (including family violence)']),
      targets_animals: bool(row['Animals']),
      targets_financially_disadvantaged: bool(row['Financially disadvantaged people']),
      targets_rural_remote: bool(row['People in rural/regional/remote communities']),
      targets_chronic_illness: bool(row['People with chronic illness (including terminal illness)']),
      targets_offenders: bool(row['Pre/post release offenders and/or their families']),
      targets_veterans: bool(row['Veterans and/or their families']),
      targets_youth: bool(row['Youth - 15 to under 25']),
      targets_adults: bool(row['Adults - aged 25 to under 65']),
      targets_other_charities: bool(row['Other charities']),
      targets_cald: bool(row['People from a culturally and linguistically diverse background']),
      targets_unemployed: bool(row['Unemployed persons']),
      targets_disaster_victims: bool(row['Victims of disaster']),
      other_description: row['other description']?.trim() || null,
      operating_locations: locations.length ? locations : null,
      operating_locations_coords: coords.length ? coords : null,
      charity_weblink: row['Charity weblink']?.trim() || null,
      report_year: 2023,
    };

    if (!record.abn) continue;
    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from('acnc_programs').insert(batch);
      if (error) {
        console.error(`  Error at row ${total}:`, error.message);
        for (const r of batch) {
          const { error: e2 } = await supabase.from('acnc_programs').insert(r);
          if (e2) console.error(`  Skip: ${r.abn} ${r.program_name} - ${e2.message}`);
        }
      }
      total += batch.length;
      if (total % 10000 === 0) console.log(`  ${total} programs...`);
      batch = [];
    }
  }

  if (batch.length) {
    const { error } = await supabase.from('acnc_programs').insert(batch);
    if (error) console.error('  Final batch error:', error.message);
    total += batch.length;
  }

  console.log(`  Done: ${total} programs ingested`);
  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const aisOnly = args.includes('--ais-only');
  const programsOnly = args.includes('--programs-only');

  console.log('ACNC AIS 2023 Ingest');
  console.log('====================');

  if (!programsOnly) await ingestAIS();
  if (!aisOnly) await ingestPrograms();

  // Quick stats
  const { count: aisCount } = await supabase.from('acnc_ais').select('*', { count: 'exact', head: true });
  const { count: progCount } = await supabase.from('acnc_programs').select('*', { count: 'exact', head: true });

  console.log('\n=== Final Counts ===');
  console.log(`  acnc_ais: ${aisCount}`);
  console.log(`  acnc_programs: ${progCount}`);

  // Justice-relevant stats
  const { count: youthProgs } = await supabase.from('acnc_programs')
    .select('*', { count: 'exact', head: true })
    .eq('targets_youth', true);
  const { count: atsiProgs } = await supabase.from('acnc_programs')
    .select('*', { count: 'exact', head: true })
    .eq('targets_atsi', true);
  const { count: offenderProgs } = await supabase.from('acnc_programs')
    .select('*', { count: 'exact', head: true })
    .eq('targets_offenders', true);
  const { count: crimeProgs } = await supabase.from('acnc_programs')
    .select('*', { count: 'exact', head: true })
    .eq('targets_crime_victims', true);

  console.log('\n=== Justice-Relevant Programs ===');
  console.log(`  Youth (15-25): ${youthProgs}`);
  console.log(`  Aboriginal/TSI: ${atsiProgs}`);
  console.log(`  Offenders/families: ${offenderProgs}`);
  console.log(`  Crime victims: ${crimeProgs}`);
}

main().catch(console.error);
