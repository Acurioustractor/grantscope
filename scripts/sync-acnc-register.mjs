#!/usr/bin/env node

/**
 * Sync ACNC Register → Supabase foundations table
 *
 * Downloads the full ACNC charity register CSV (~53K records),
 * filters to foundations/trusts (~3K), and upserts to the foundations table.
 *
 * Usage: node scripts/sync-acnc-register.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { downloadACNCRegister, parseACNCRegister } from '../packages/grant-engine/src/foundations/acnc-importer.ts';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[acnc-sync] ${msg}`);
}

async function main() {
  log('Starting ACNC register sync...');

  // Step 1: Download CSV
  const csv = await downloadACNCRegister(log);

  // Step 2: Parse and filter to foundations
  const foundations = [];
  for await (const foundation of parseACNCRegister(csv, log)) {
    foundations.push(foundation);
  }

  log(`Found ${foundations.length} foundations/trusts`);

  if (DRY_RUN) {
    log('DRY RUN — showing first 20:');
    for (const f of foundations.slice(0, 20)) {
      log(`  ${f.acnc_abn} | ${f.name} | ${f.type} | ${f.website || 'no website'}`);
    }

    // Summary by type
    const byType = {};
    for (const f of foundations) {
      const t = f.type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }
    log('By type:');
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      log(`  ${type}: ${count}`);
    }

    // Count with websites
    const withWebsite = foundations.filter(f => f.website).length;
    log(`With websites: ${withWebsite} (${((withWebsite / foundations.length) * 100).toFixed(1)}%)`);

    return;
  }

  // Step 3: Bulk upsert to Supabase
  log('Upserting to Supabase...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < foundations.length; i += BATCH_SIZE) {
    const batch = foundations.slice(i, i + BATCH_SIZE).map(f => ({
      acnc_abn: f.acnc_abn,
      name: f.name,
      type: f.type,
      website: f.website,
      description: f.description,
      total_giving_annual: f.total_giving_annual,
      giving_history: f.giving_history,
      avg_grant_size: f.avg_grant_size,
      grant_range_min: f.grant_range_min,
      grant_range_max: f.grant_range_max,
      thematic_focus: f.thematic_focus,
      geographic_focus: f.geographic_focus,
      target_recipients: f.target_recipients,
      endowment_size: f.endowment_size,
      investment_returns: f.investment_returns,
      giving_ratio: f.giving_ratio,
      revenue_sources: f.revenue_sources,
      parent_company: f.parent_company,
      asx_code: f.asx_code,
      open_programs: f.open_programs,
      acnc_data: f.acnc_data,
      last_scraped_at: f.last_scraped_at,
      profile_confidence: f.profile_confidence,
    }));

    const { error } = await supabase
      .from('foundations')
      .upsert(batch, { onConflict: 'acnc_abn' });

    if (error) {
      console.error(`Batch error at ${i}: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }

    if ((i + BATCH_SIZE) % 500 === 0) {
      log(`  Progress: ${Math.min(i + BATCH_SIZE, foundations.length)}/${foundations.length}`);
    }
  }

  log(`Complete: ${inserted} upserted, ${errors} errors`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
