#!/usr/bin/env node
/**
 * Import SA2 reference data from ABS GeoJSON into sa2_reference table.
 * Source: apps/web/public/geo/sa2-2021.json (2,473 SA2 regions)
 *
 * Usage: node scripts/import-sa2-reference.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const geojson = JSON.parse(readFileSync('apps/web/public/geo/sa2-2021.json', 'utf8'));
const features = geojson.features;

console.log(`Extracted ${features.length} SA2 regions from GeoJSON`);

const rows = features.map((f) => {
  const p = f.properties;
  return {
    sa2_code: p.SA2_CODE21,
    sa2_name: p.SA2_NAME21,
    sa3_code: p.SA3_CODE21,
    sa3_name: p.SA3_NAME21,
    sa4_code: p.SA4_CODE21,
    sa4_name: p.SA4_NAME21,
    state_code: p.STE_CODE21,
    state_name: p.STE_NAME21,
    area_sqkm: p.AREASQKM21,
  };
});

// Upsert in batches of 500
const BATCH = 500;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase
    .from('sa2_reference')
    .upsert(batch, { onConflict: 'sa2_code' });
  if (error) {
    console.error(`Error at batch ${i}:`, error.message);
    process.exit(1);
  }
  inserted += batch.length;
  process.stdout.write(`\r  Upserted ${inserted}/${rows.length}`);
}

console.log(`\nDone: ${inserted} SA2 regions loaded into sa2_reference`);

// Verify
const { count } = await supabase
  .from('sa2_reference')
  .select('*', { count: 'exact', head: true });
console.log(`Table now has ${count} rows`);
