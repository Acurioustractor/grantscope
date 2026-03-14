#!/usr/bin/env node

/**
 * Ingest NIAA Senate Order 16 grant data into justice_funding table
 *
 * Source: NIAA Senate Order 16 - Grants approved for period 4 Feb 2025 - 6 Mar 2025
 * PDF: https://www.niaa.gov.au/sites/default/files/documents/2025-04/Senate-Order-16-Agency-Grants-April-2025.pdf
 * Target: justice_funding table with source = 'niaa-senate-order-16'
 *
 * Usage: node --env-file=.env scripts/ingest-niaa-grants.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run') || !APPLY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SOURCE = 'niaa-senate-order-16';
const SOURCE_URL = 'https://www.niaa.gov.au/sites/default/files/documents/2025-04/Senate-Order-16-Agency-Grants-April-2025.pdf';
const FINANCIAL_YEAR = '2024-25';
const BATCH_SIZE = 50;

function log(msg) {
  console.log(`[niaa-senate-order-16] ${msg}`);
}

/**
 * Map NIAA programme codes to a sector
 */
function programmeToSector(programme) {
  if (programme.startsWith('1.1')) return 'employment';
  if (programme.startsWith('1.2')) return 'education';
  if (programme.startsWith('1.3')) return 'health';
  if (programme.startsWith('1.4')) return 'culture';
  if (programme.startsWith('1.5')) return 'remote-services';
  if (programme.startsWith('1.6')) return 'research';
  if (programme.includes('Community Quick Response')) return 'community';
  if (programme.includes('ILSC')) return 'land-management';
  if (programme.includes('Ranger')) return 'land-management';
  if (programme.includes('Healthy Communities')) return 'health';
  if (programme.includes('Aboriginals Benefit Account')) return 'community';
  if (programme.includes('Business start-up')) return 'employment';
  if (programme.includes('Housing')) return 'housing';
  if (programme.includes('Flood Relief')) return 'emergency';
  if (programme.includes('Fisheries')) return 'employment';
  return 'indigenous-affairs';
}

/**
 * Map NIAA programme to a funding type
 */
function programmeToFundingType(table) {
  return table === 'new_grants' ? 'grant' : 'grant-variation';
}

async function main() {
  const run = await logStart(supabase, 'ingest-niaa-senate-order-16', 'Ingest NIAA Senate Order 16');

  try {
    log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    if (!APPLY) log('🔒 DRY RUN — pass --apply to execute changes');

    // 1. Read CSV
    const csvPath = new URL('../data/niaa/senate-order-16-apr-2025.csv', import.meta.url).pathname;
    const csvData = readFileSync(csvPath, 'utf-8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true, trim: true });

    log(`Loaded ${records.length} rows from CSV`);

    // 2. Build unique recipient name list for entity matching
    const uniqueNames = [...new Set(records.map(r => r.recipient_name))];
    log(`${uniqueNames.length} unique recipient names`);

    // 3. Try to match recipients to gs_entities by canonical_name (fuzzy)
    // We'll do batch lookups
    const entityMap = new Map(); // recipient_name -> { gs_entity_id, abn }

    for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
      const batch = uniqueNames.slice(i, i + BATCH_SIZE);
      // Try exact match first (case-insensitive)
      for (const name of batch) {
        const { data } = await supabase
          .from('gs_entities')
          .select('id, abn, canonical_name')
          .ilike('canonical_name', name)
          .limit(1);

        if (data && data.length > 0) {
          entityMap.set(name, { gs_entity_id: data[0].id, abn: data[0].abn });
        }
      }
    }

    log(`Matched ${entityMap.size}/${uniqueNames.length} recipients to gs_entities`);

    // 4. Check what already exists for this source to avoid duplicates
    const { count: existingCount } = await supabase
      .from('justice_funding')
      .select('id', { count: 'exact', head: true })
      .eq('source', SOURCE);

    log(`Existing rows with source='${SOURCE}': ${existingCount || 0}`);

    if (existingCount > 0) {
      if (APPLY) {
        log(`Deleting ${existingCount} existing rows to re-ingest cleanly`);
        const { error: delError } = await supabase
          .from('justice_funding')
          .delete()
          .eq('source', SOURCE);
        if (delError) throw new Error(`Delete failed: ${delError.message}`);
        log('✅ Deleted existing records');
      } else {
        log(`⏭️  Would delete ${existingCount} existing records from justice_funding (dry run)`);
      }
    }

    // 5. Prepare rows for insert
    const rows = records.map((r, idx) => {
      const match = entityMap.get(r.recipient_name);
      return {
        source: SOURCE,
        source_url: SOURCE_URL,
        source_statement_id: `so16-apr2025-${idx + 1}`,
        recipient_name: r.recipient_name,
        recipient_abn: match?.abn || null,
        program_name: `NIAA ${r.programme}`,
        program_round: `SO16-Apr2025-${r.table}-${idx + 1}`,
        amount_dollars: parseFloat(r.amount),
        sector: programmeToSector(r.programme),
        funding_type: programmeToFundingType(r.table),
        financial_year: FINANCIAL_YEAR,
        gs_entity_id: match?.gs_entity_id || null,
      };
    });

    // Stats
    const totalAmount = rows.reduce((sum, r) => sum + r.amount_dollars, 0);
    const matchedRows = rows.filter(r => r.gs_entity_id).length;
    log(`Total amount: $${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    log(`Rows with entity match: ${matchedRows}/${rows.length}`);

    if (DRY_RUN) {
      log('[DRY RUN] Would insert these rows:');
      log(`  Total rows: ${rows.length}`);
      log(`  Total amount: $${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
      log(`  Entity matches: ${matchedRows}`);

      // Show a sample
      log('\nSample rows:');
      for (const row of rows.slice(0, 5)) {
        log(`  ${row.recipient_name} | ${row.program_name} | $${row.amount_dollars} | entity: ${row.gs_entity_id ? 'YES' : 'NO'}`);
      }

      await logComplete(supabase, run.id, {
        items_found: rows.length,
        items_new: 0,
        items_updated: 0,
      });
      return;
    }

    // 6. Insert in batches
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('justice_funding')
        .insert(batch);

      if (error) {
        throw new Error(`Insert batch ${i}-${i + batch.length} failed: ${error.message}`);
      }
      inserted += batch.length;
      log(`Inserted ${inserted}/${rows.length}`);
    }

    log(`\n=== COMPLETE ===`);
    log(`Rows inserted: ${inserted}`);
    log(`Total amount: $${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`);
    log(`Entity matches: ${matchedRows}/${rows.length}`);
    log(`Unique recipients: ${uniqueNames.length}`);

    await logComplete(supabase, run.id, {
      items_found: rows.length,
      items_new: inserted,
      items_updated: 0,
    });

  } catch (err) {
    log(`ERROR: ${err.message}`);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();
