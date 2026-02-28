#!/usr/bin/env tsx
/**
 * Ingest QLD Youth Justice Data
 *
 * Seeds government_programs and money_flows tables with
 * QLD youth justice budget data and spending flows.
 *
 * Usage: tsx scripts/ingest-youth-justice-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { ingestYouthJusticeData, searchQLDYouthJusticeDatasets } from '@grantscope/engine/src/sources/qld-youth-justice.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  console.log('=== QLD Youth Justice Data Ingestion ===\n');

  // 1. Seed programs and flows
  console.log('Seeding government programs and money flows...');
  const result = await ingestYouthJusticeData(supabase);

  console.log(`\n✓ Programs inserted: ${result.programsInserted}`);
  console.log(`✓ Money flows inserted: ${result.flowsInserted}`);
  console.log(`✓ CKAN datasets found: ${result.datasetsFound}`);

  // 2. List discovered CKAN datasets
  console.log('\n--- CKAN Dataset Discovery ---');
  const datasets = await searchQLDYouthJusticeDatasets();
  for (const ds of datasets) {
    console.log(`  ${ds.title}`);
    if (ds.resources?.length) {
      for (const r of ds.resources.slice(0, 3)) {
        console.log(`    → ${r.name || r.id} (${r.format})`);
      }
    }
  }

  // 3. Verify data
  console.log('\n--- Verification ---');
  const { count: programCount } = await supabase
    .from('government_programs')
    .select('*', { count: 'exact', head: true })
    .eq('domain', 'youth_justice');

  const { count: flowCount } = await supabase
    .from('money_flows')
    .select('*', { count: 'exact', head: true })
    .eq('domain', 'youth_justice');

  console.log(`Programs in DB: ${programCount}`);
  console.log(`Money flows in DB: ${flowCount}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
