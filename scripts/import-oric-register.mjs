#!/usr/bin/env node

/**
 * Import ORIC Register — Indigenous Corporations
 *
 * Downloads the ORIC (Office of the Registrar of Indigenous Corporations) register
 * from data.gov.au CKAN API and imports into social_enterprises table.
 *
 * Source: https://data.gov.au/data/dataset/oric-register-of-aboriginal-and-torres-strait-islander-corporations
 *
 * Usage:
 *   node scripts/import-oric-register.mjs
 *   node scripts/import-oric-register.mjs --dry-run
 *   node scripts/import-oric-register.mjs --limit=100
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, upserted: 0, skipped: 0, errors: 0 };

function log(msg) {
  console.log(`[import-oric] ${msg}`);
}

// CKAN dataset ID for ORIC register (data.gov.au migrated API path)
const CKAN_DATASET_URL = 'https://data.gov.au/data/api/3/action/package_show?id=2c072eed-d6d3-4f3a-a6d2-8929b0c78682';

async function fetchCsvUrl() {
  log('Fetching CKAN dataset metadata...');
  const res = await fetch(CKAN_DATASET_URL, {
    headers: { 'User-Agent': 'GrantScope/1.0 (research; contact@act.place)' },
  });
  if (!res.ok) throw new Error(`CKAN API returned ${res.status}`);
  const json = await res.json();
  const resources = json.result?.resources || [];

  // Find CSV resource
  const csv = resources.find(r =>
    r.format?.toLowerCase() === 'csv' ||
    r.url?.endsWith('.csv')
  );
  if (!csv) throw new Error('No CSV resource found in ORIC dataset');
  log(`Found CSV: ${csv.url}`);
  return csv.url;
}

function normaliseState(state) {
  if (!state) return null;
  const s = state.trim().toUpperCase();
  const map = {
    'QUEENSLAND': 'QLD', 'QLD': 'QLD',
    'NEW SOUTH WALES': 'NSW', 'NSW': 'NSW',
    'VICTORIA': 'VIC', 'VIC': 'VIC',
    'WESTERN AUSTRALIA': 'WA', 'WA': 'WA',
    'SOUTH AUSTRALIA': 'SA', 'SA': 'SA',
    'TASMANIA': 'TAS', 'TAS': 'TAS',
    'NORTHERN TERRITORY': 'NT', 'NT': 'NT',
    'AUSTRALIAN CAPITAL TERRITORY': 'ACT', 'ACT': 'ACT',
  };
  return map[s] || s;
}

function inferSectors(name, type) {
  const text = `${name} ${type || ''}`.toLowerCase();
  const sectors = [];
  if (/health|medical|wellbeing/.test(text)) sectors.push('health');
  if (/housing|accommodation/.test(text)) sectors.push('housing');
  if (/art|culture|heritage|media/.test(text)) sectors.push('arts');
  if (/education|training|school/.test(text)) sectors.push('education');
  if (/land|country|ranger|environment/.test(text)) sectors.push('environment');
  if (/sport|recreation/.test(text)) sectors.push('sport');
  if (/employment|enterprise|business/.test(text)) sectors.push('employment');
  if (/community|council|association/.test(text)) sectors.push('community');
  if (/justice|legal/.test(text)) sectors.push('justice');
  if (sectors.length === 0) sectors.push('community');
  return sectors;
}

async function run() {
  log('Starting ORIC register import...');

  // Step 1: Get CSV URL from CKAN
  const csvUrl = await fetchCsvUrl();

  // Step 2: Download CSV
  log('Downloading CSV...');
  const res = await fetch(csvUrl, {
    headers: { 'User-Agent': 'GrantScope/1.0 (research; contact@act.place)' },
  });
  if (!res.ok) throw new Error(`CSV download failed: ${res.status}`);
  const csvText = await res.text();
  log(`Downloaded ${(csvText.length / 1024).toFixed(0)}KB`);

  // Step 3: Parse CSV
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  log(`Parsed ${records.length} records`);

  // Step 4: Process records
  const rows = LIMIT ? records.slice(0, LIMIT) : records;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const upsertRows = [];

    for (const row of batch) {
      stats.total++;

      // Actual ORIC CSV columns (Jan 2026 format)
      const name = row['Corporation Name'];
      const icn = row['ICN'];
      const state = row['State/Territory (Main place of business) (Address)'];
      const postcode = row['Postcode (Main place of business) (Address)'];
      const status = row['Status Reason'];
      const industrySectors = row['Industry Sector(s)'];
      const abn = row['ABN'];
      const corpUrl = row['URL'];

      if (!name) {
        stats.skipped++;
        continue;
      }

      // Skip deregistered corporations
      if (status && /deregistered|struck off/i.test(status)) {
        stats.skipped++;
        continue;
      }

      upsertRows.push({
        name: name.trim(),
        icn: icn?.trim() || null,
        abn: abn?.trim()?.replace(/\s/g, '') || null,
        state: normaliseState(state),
        postcode: postcode?.trim() || null,
        website: corpUrl?.trim() || null,
        org_type: 'indigenous_business',
        legal_structure: 'indigenous_corp',
        sector: inferSectors(name, industrySectors),
        source_primary: 'oric',
        sources: [{ source: 'oric', url: csvUrl, scraped_at: new Date().toISOString() }],
      });
    }

    if (DRY_RUN) {
      log(`[DRY RUN] Would upsert ${upsertRows.length} records (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
      stats.upserted += upsertRows.length;
      continue;
    }

    if (upsertRows.length === 0) continue;

    const { error } = await supabase
      .from('social_enterprises')
      .upsert(upsertRows, { onConflict: 'name,state', ignoreDuplicates: false });

    if (error) {
      log(`Error batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      stats.errors += upsertRows.length;
    } else {
      stats.upserted += upsertRows.length;
    }
  }

  log(`\nDone! Total: ${stats.total}, Upserted: ${stats.upserted}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
}

run().catch(err => {
  console.error('[import-oric] Fatal:', err);
  process.exit(1);
});
