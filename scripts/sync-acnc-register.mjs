#!/usr/bin/env node

/**
 * Sync ACNC Register → Supabase foundations table
 *
 * Downloads the full ACNC charity register CSV (~53K records),
 * filters to foundations/trusts (~3K), and upserts to the foundations table.
 *
 * Usage: node scripts/sync-acnc-register.mjs [--dry-run]
 */

import 'dotenv/config';
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

  // Dedup by ABN (CSV has multiple rows per org for different address types)
  const byAbn = new Map();
  for (const f of foundations) {
    if (!byAbn.has(f.acnc_abn)) {
      byAbn.set(f.acnc_abn, f);
    }
  }
  const unique = [...byAbn.values()];
  log(`Found ${foundations.length} rows → ${unique.length} unique foundations (deduped by ABN)`);

  if (DRY_RUN) {
    log('DRY RUN — showing first 20:');
    for (const f of unique.slice(0, 20)) {
      log(`  ${f.acnc_abn} | ${f.name} | ${f.type} | ${f.website || 'no website'}`);
    }

    // Summary by type
    const byType = {};
    for (const f of unique) {
      const t = f.type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }
    log('By type:');
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      log(`  ${type}: ${count}`);
    }

    // Count with websites
    const withWebsite = unique.filter(f => f.website).length;
    log(`With websites: ${withWebsite} (${((withWebsite / unique.length) * 100).toFixed(1)}%)`);

    return;
  }

  // Step 3: Bulk upsert to Supabase
  log('Upserting to Supabase...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  // Existing rows get ONLY what the register owns. The importer returns null/'low' for every
  // enrichment column (description, parent_company, open_programs, profile_confidence, …), and
  // writing those over existing rows wiped the profiling agents' work on every sync since at least
  // July: 10,166 profiles on 2026-09-22 alone, visible as a sawtooth in the foundations edge count.
  const existing = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('foundations').select('acnc_abn').range(from, from + 999);
    if (error) throw new Error(`Could not read existing foundations: ${error.message}`);
    for (const r of data) existing.add(r.acnc_abn);
    if (data.length < 1000) break;
  }
  const refresh = unique.filter(f => existing.has(f.acnc_abn))
    .map(f => ({ acnc_abn: f.acnc_abn, name: f.name, acnc_data: f.acnc_data }));
  const fresh = unique.filter(f => !existing.has(f.acnc_abn));
  log(`${refresh.length} existing (register fields only), ${fresh.length} new`);

  for (let i = 0; i < refresh.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from('foundations')
      .upsert(refresh.slice(i, i + BATCH_SIZE), { onConflict: 'acnc_abn' });
    if (error) {
      console.error(`Refresh batch error at ${i}: ${error.message}`);
      errors += Math.min(BATCH_SIZE, refresh.length - i);
    } else {
      inserted += Math.min(BATCH_SIZE, refresh.length - i);
    }
  }

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE).map(f => ({
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
      log(`  Progress: ${Math.min(i + BATCH_SIZE, fresh.length)}/${fresh.length} new`);
    }
  }

  log(`Complete: ${inserted} upserted, ${errors} errors`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
