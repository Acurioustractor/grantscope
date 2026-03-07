#!/usr/bin/env node

/**
 * Sync ORIC Register → Supabase oric_corporations table
 *
 * Downloads the ORIC (Office of the Registrar of Indigenous Corporations)
 * CSV from data.gov.au and upserts all corporations.
 * Also cross-references with acnc_charities by ABN.
 *
 * Usage: node scripts/sync-oric-corporations.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const ORIC_CSV_URL =
  'https://data.gov.au/data/dataset/2c072eed-d6d3-4f3a-a6d2-8929b0c78682/resource/6db8cf15-71b4-4f3a-aec2-923210dd0f8b/download/29-january-2026-dataset-csv.csv';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[oric] ${msg}`);
}

function parseDate(s) {
  if (!s || s === '') return null;
  // DD/MM/YYYY format
  const parts = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    const d = new Date(`${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseIndustrySectors(raw) {
  if (!raw) return [];
  // Sectors are comma-separated with " > " sub-categories
  // e.g. "Health care and health promotion > Medical clinic or services, Health care and health promotion"
  const sectors = raw.split(',').map(s => s.trim()).filter(Boolean);
  // Extract top-level sectors (before " > ")
  const topLevel = new Set();
  for (const s of sectors) {
    const top = s.split(' > ')[0].trim();
    if (top) topLevel.add(top);
  }
  return [...topLevel];
}

function cleanAbn(abn) {
  if (!abn) return null;
  // Remove spaces, ensure 11 digits
  const cleaned = abn.replace(/\s/g, '');
  return /^\d{11}$/.test(cleaned) ? cleaned : null;
}

function mapRow(row) {
  const abn = cleanAbn(row['ABN']);
  const isAcnc = row['Corporation registered with ACNC?']?.trim().toLowerCase() === 'yes';
  const statusReason = row['Status Reason']?.trim() || 'Registered';
  const isRegistered = statusReason === 'Registered';

  return {
    icn: String(row['ICN']).trim(),
    name: row['Corporation Name']?.trim(),
    abn,
    status: isRegistered ? 'Registered' : 'Deregistered',
    status_reason: statusReason,
    registered_on: parseDate(row['Registered On']),
    deregistered_on: parseDate(row['Deregistered On']),
    corporation_size: row['Corporation Size']?.trim() || null,
    industry_sectors: parseIndustrySectors(row['Industry Sector(s)']),
    industry_sectors_raw: row['Industry Sector(s)']?.trim() || null,
    registered_with_acnc: isAcnc,
    state: row['State/Territory (Main place of business) (Address)']?.trim() || null,
    postcode: row['Postcode (Main place of business) (Address)']?.trim() || null,
    income_year1: row['2023 Total Income']?.trim() || null,
    assets_year1: row['2023 Total Assets']?.trim() || null,
    employees_year1: row['2023 Number of Employees']?.trim() || null,
    income_year2: row['2024 Total Income']?.trim() || null,
    assets_year2: row['2024 Total Assets']?.trim() || null,
    employees_year2: row['2024 Number of Employees']?.trim() || null,
    financial_year1: 2023,
    financial_year2: 2024,
    oric_url: row['URL']?.trim() || null,
    source_file: '29-january-2026-dataset-csv.csv',
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  log('Starting ORIC register sync...');

  // Step 1: Download CSV
  log(`Downloading from data.gov.au...`);
  const response = await fetch(ORIC_CSV_URL);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const csvText = await response.text();
  log(`Downloaded ${(csvText.length / 1024).toFixed(0)}KB`);

  // Step 2: Parse
  log('Parsing CSV...');
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
  log(`Parsed ${records.length} raw rows`);

  // Step 3: Map rows (dedup by ICN)
  const byIcn = new Map();
  for (const row of records) {
    const icn = String(row['ICN']).trim();
    if (!icn) continue;
    if (!byIcn.has(icn)) {
      byIcn.set(icn, mapRow(row));
    }
  }
  const unique = [...byIcn.values()];
  log(`${unique.length} unique corporations (deduped by ICN)`);

  // Stats
  const registered = unique.filter(r => r.status === 'Registered').length;
  const withAbn = unique.filter(r => r.abn).length;
  const withAcnc = unique.filter(r => r.registered_with_acnc).length;
  const byState = {};
  for (const r of unique) {
    const s = r.state || 'Unknown';
    byState[s] = (byState[s] || 0) + 1;
  }
  const bySize = {};
  for (const r of unique) {
    const s = r.corporation_size || 'Unknown';
    bySize[s] = (bySize[s] || 0) + 1;
  }

  log(`Registered: ${registered}, Deregistered: ${unique.length - registered}`);
  log(`With ABN: ${withAbn}, ACNC-registered: ${withAcnc}`);
  log(`By state: ${Object.entries(byState).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  log(`By size: ${Object.entries(bySize).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // Top industry sectors
  const sectorCounts = {};
  for (const r of unique) {
    for (const s of r.industry_sectors) {
      sectorCounts[s] = (sectorCounts[s] || 0) + 1;
    }
  }
  log(`Top sectors: ${Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  if (DRY_RUN) {
    log('DRY RUN — showing first 5:');
    for (const r of unique.slice(0, 5)) {
      log(`  ICN ${r.icn} | ${r.name} | ${r.state} | ${r.status} | ABN: ${r.abn || 'none'} | ACNC: ${r.registered_with_acnc}`);
    }
    return;
  }

  // Step 4: Batch upsert to oric_corporations
  log('Upserting to oric_corporations...');
  const BATCH_SIZE = 200;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('oric_corporations')
      .upsert(batch, { onConflict: 'icn' });

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

  log(`Upsert complete: ${inserted} upserted, ${errors} errors`);

  // Step 5: Cross-reference with acnc_charities by ABN
  log('Cross-referencing with ACNC charities...');
  const oricAbns = unique.filter(r => r.abn).map(r => r.abn);

  let crossRefCount = 0;
  const ABN_BATCH = 500;
  for (let i = 0; i < oricAbns.length; i += ABN_BATCH) {
    const batch = oricAbns.slice(i, i + ABN_BATCH);

    // Find matching ACNC charities
    const { data: matches } = await supabase
      .from('acnc_charities')
      .select('abn')
      .in('abn', batch);

    if (matches && matches.length > 0) {
      const matchAbns = matches.map(m => m.abn);

      // Also get the ICN for each matching ABN
      const abnToIcn = new Map();
      for (const r of unique) {
        if (r.abn && matchAbns.includes(r.abn)) {
          abnToIcn.set(r.abn, r.icn);
        }
      }

      // Update acnc_charities
      for (const abn of matchAbns) {
        await supabase
          .from('acnc_charities')
          .update({ is_oric_corporation: true, oric_icn: abnToIcn.get(abn) || null })
          .eq('abn', abn);
      }

      // Update oric_corporations
      await supabase
        .from('oric_corporations')
        .update({ acnc_abn_match: true })
        .in('abn', matchAbns);

      crossRefCount += matchAbns.length;
    }
  }

  log(`Cross-referenced ${crossRefCount} corporations with ACNC charities`);
  log('ORIC sync complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
