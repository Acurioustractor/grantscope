#!/usr/bin/env node
/**
 * Backfill SA2 codes for entities and postcodes using the spatial lookup CSV.
 *
 * 1. Reads /tmp/postcode_sa2_map.csv (from build-postcode-sa2-map.py)
 * 2. Updates postcode_geo rows that have NULL sa2_code
 * 3. Updates gs_entities.sa2_code based on postcode → SA2 mapping
 *
 * Usage: node scripts/backfill-sa2-codes.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Read CSV
const csv = readFileSync('/tmp/postcode_sa2_map.csv', 'utf8');
const lines = csv.trim().split('\n').slice(1); // skip header
const mapping = new Map();
for (const line of lines) {
  const [postcode, sa2_code, sa2_name] = line.split(',');
  if (postcode && sa2_code) {
    mapping.set(postcode, { sa2_code, sa2_name });
  }
}
console.log(`Loaded ${mapping.size} postcode → SA2 mappings`);

// Step 1: Update postcode_geo rows with NULL sa2_code
console.log('\n--- Updating postcode_geo NULL sa2_codes ---');
let pgUpdated = 0;
for (const [postcode, { sa2_code, sa2_name }] of mapping) {
  const { data, error } = await supabase
    .from('postcode_geo')
    .update({ sa2_code, sa2_name })
    .eq('postcode', postcode)
    .is('sa2_code', null);
  if (error) {
    console.error(`  Error updating postcode ${postcode}:`, error.message);
  }
  // We can't tell how many rows were affected without count, so just track calls
  pgUpdated++;
}
console.log(`  Processed ${pgUpdated} postcodes`);

// Step 2: Update gs_entities where sa2_code IS NULL but postcode has a mapping
console.log('\n--- Backfilling entity sa2_codes ---');
// Get entities with NULL sa2_code but valid postcode
const BATCH = 1000;
let totalUpdated = 0;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const { data: entities, error } = await supabase
    .from('gs_entities')
    .select('id, postcode')
    .is('sa2_code', null)
    .not('postcode', 'is', null)
    .range(offset, offset + BATCH - 1);

  if (error) {
    console.error('Error fetching entities:', error.message);
    break;
  }

  if (!entities || entities.length === 0) {
    hasMore = false;
    break;
  }

  // Group by sa2_code for batch updates
  const byPostcode = new Map();
  for (const e of entities) {
    const m = mapping.get(e.postcode);
    if (m) {
      if (!byPostcode.has(e.postcode)) byPostcode.set(e.postcode, []);
      byPostcode.get(e.postcode).push(e.id);
    }
  }

  for (const [postcode, ids] of byPostcode) {
    const m = mapping.get(postcode);
    // Update in sub-batches of 100 IDs
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error: updateError } = await supabase
        .from('gs_entities')
        .update({ sa2_code: m.sa2_code })
        .in('id', batch);
      if (updateError) {
        console.error(`  Error updating entities for postcode ${postcode}:`, updateError.message);
      } else {
        totalUpdated += batch.length;
      }
    }
  }

  offset += BATCH;
  process.stdout.write(`\r  Updated ${totalUpdated} entities so far (offset ${offset})`);

  if (entities.length < BATCH) hasMore = false;
}

console.log(`\n  Total entities backfilled: ${totalUpdated}`);

// Verify
const { count: nullCount } = await supabase
  .from('gs_entities')
  .select('*', { count: 'exact', head: true })
  .is('sa2_code', null);
console.log(`\nEntities still missing sa2_code: ${nullCount}`);

const { data: sa2Count } = await supabase.rpc('exec_sql', {
  query: "SELECT COUNT(DISTINCT sa2_code) as n FROM gs_entities WHERE sa2_code IS NOT NULL"
});
console.log(`Distinct SA2s covered by entities: ${JSON.stringify(sa2Count)}`);
