#!/usr/bin/env node

/**
 * Import SEIFA 2021 disadvantage data + Australian postcode centroids
 *
 * Sources:
 * - ABS SEIFA 2021 by Postal Area (POA) via SDMX API
 * - Matthew Proctor's Australian Postcodes (GitHub, public domain)
 *
 * Usage: node scripts/import-seifa-postcodes.mjs [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (msg) => console.log(`[seifa-import] ${msg}`);

// SEIFA measure code mapping
const MEASURE_MAP = {
  'SCORE': 'score',
  'RWAD': 'decile_national',    // Rank Within Australia - Decile
  'RWAP': 'percentile_national', // Rank Within Australia - Percentile
  'RWAR': 'rank_national',       // Rank Within Australia - Rank
  'RWSD': 'decile_state',        // Rank Within State - Decile
  'RWSR': 'rank_state',          // Rank Within State - Rank
};

async function importSeifa() {
  log('Downloading SEIFA 2021 POA data from ABS API...');
  const res = await fetch('https://data.api.abs.gov.au/rest/data/ABS_SEIFA2021_POA/all', {
    headers: { 'Accept': 'text/csv' },
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`ABS API returned ${res.status}`);
  const csvText = await res.text();

  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  log(`Parsed ${records.length} SEIFA rows`);

  // Group by postcode + index type, collect measures
  const grouped = new Map();
  for (const row of records) {
    const postcode = row.POA;
    const indexType = row.SEIFAINDEXTYPE; // IRSD, IRSAD, IER, IEO
    const measure = row.SEIFA_MEASURE;
    const value = parseFloat(row.OBS_VALUE);

    if (!postcode || !indexType || isNaN(value)) continue;

    const key = `${postcode}:${indexType}`;
    if (!grouped.has(key)) {
      grouped.set(key, { postcode, index_type: indexType });
    }

    const field = MEASURE_MAP[measure];
    if (field) {
      grouped.get(key)[field] = Math.round(value * 10) / 10; // 1 decimal
    }
  }

  const rows = Array.from(grouped.values());
  log(`${rows.length} unique postcode × index combinations`);

  if (DRY_RUN) {
    log('DRY RUN — sample:');
    console.log(rows.slice(0, 5));
    return rows.length;
  }

  // Batch upsert
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('seifa_2021').upsert(batch, {
      onConflict: 'postcode,index_type',
    });
    if (error) {
      log(`Error at batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  log(`Inserted ${inserted} SEIFA records`);
  return inserted;
}

async function importPostcodes() {
  log('Downloading Australian postcode centroids from Matthew Proctor...');
  const res = await fetch('https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.csv', {
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  const csvText = await res.text();

  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  log(`Parsed ${records.length} postcode rows`);

  const rows = records
    .filter(r => r.postcode && r.lat && r.long)
    .map(r => ({
      postcode: r.postcode,
      locality: r.locality || null,
      state: r.state || null,
      latitude: parseFloat(r.lat) || null,
      longitude: parseFloat(r.long) || null,
      sa2_code: r.SA2_CODE_2021 || null,
      sa2_name: r.SA2_NAME_2021 || null,
      sa3_code: r.SA3_CODE_2021 || null,
      sa3_name: r.SA3_NAME_2021 || null,
      sa4_code: r.SA4_CODE_2021 || null,
      sa4_name: r.SA4_NAME_2021 || null,
      remoteness_2021: r.RA_2021_NAME || null,
    }));

  log(`${rows.length} valid postcode records`);

  if (DRY_RUN) {
    log('DRY RUN — sample:');
    console.log(rows.slice(0, 3));
    return rows.length;
  }

  // Batch upsert
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('postcode_geo').upsert(batch, {
      onConflict: 'postcode,locality',
    });
    if (error) {
      log(`Error at batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  log(`Inserted ${inserted} postcode records`);
  return inserted;
}

async function main() {
  log(`Starting import (dry-run=${DRY_RUN})`);

  const seifaCount = await importSeifa();
  const postcodeCount = await importPostcodes();

  log(`\nComplete: ${seifaCount} SEIFA records, ${postcodeCount} postcode records`);

  if (!DRY_RUN) {
    // Verify by checking IRSD decile distribution
    const { data } = await supabase
      .from('seifa_2021')
      .select('decile_national')
      .eq('index_type', 'IRSD')
      .not('decile_national', 'is', null);

    if (data) {
      const dist = {};
      for (const r of data) {
        dist[r.decile_national] = (dist[r.decile_national] || 0) + 1;
      }
      log('IRSD decile distribution:');
      for (let d = 1; d <= 10; d++) {
        log(`  Decile ${d}: ${dist[d] || 0} postcodes`);
      }
    }
  }
}

main().catch(err => {
  console.error('[seifa-import] Fatal:', err.message);
  process.exit(1);
});
