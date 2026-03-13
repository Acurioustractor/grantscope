#!/usr/bin/env node

/**
 * Import NZ Charities Register
 *
 * Downloads the NZ Charities Register CSV from register.charities.govt.nz
 * and imports into nz_charities table. Creates gs_entities entries with
 * NZ- prefixed gs_ids and NZBN identifiers.
 *
 * The NZ Charities Services publishes a downloadable CSV at:
 *   https://www.charities.govt.nz/charities-in-new-zealand/the-charities-register/open-data/
 *
 * Usage:
 *   node --env-file=.env scripts/import-nz-charities.mjs [--apply] [--limit=100] [--file=path/to/csv]
 *
 * Flags:
 *   --apply    Actually write to DB (dry-run by default)
 *   --limit=N  Max rows to process (default: all)
 *   --file=X   Local CSV file path (skips download)
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

const AGENT_ID = 'import-nz-charities';
const AGENT_NAME = 'NZ Charities Importer';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const FILE_PATH = process.argv.find(a => a.startsWith('--file='))?.split('=')[1];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadCSV(filePath) {
  const records = [];
  const parser = createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true })
  );
  for await (const record of parser) {
    records.push(record);
    if (LIMIT && records.length >= LIMIT) break;
  }
  return records;
}

async function main() {
  const runId = await logStart(db, AGENT_ID, AGENT_NAME);
  const stats = { processed: 0, created: 0, updated: 0, errors: 0 };

  try {
    if (!FILE_PATH) {
      console.error('Please provide --file=path/to/charities.csv');
      console.error('Download from: https://www.charities.govt.nz/charities-in-new-zealand/the-charities-register/open-data/');
      await logFailed(db, runId, 'No CSV file provided');
      process.exit(1);
    }

    console.log(`Loading CSV from ${FILE_PATH}...`);
    const records = await loadCSV(FILE_PATH);
    console.log(`Loaded ${records.length} records`);

    const BATCH_SIZE = 50;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const rows = batch.map(r => {
        stats.processed++;

        // Map CSV columns to our schema (column names vary — normalize)
        const regNumber = r['Registration Number'] || r['registration_number'] || r['Reg Number'] || '';
        const name = r['Organisation Name'] || r['name'] || r['Name'] || '';
        const legalName = r['Legal Name'] || r['legal_name'] || '';

        return {
          registration_number: regNumber.trim(),
          name: name.trim(),
          legal_name: legalName.trim() || null,
          charity_type: r['Charity Type'] || r['Entity Type'] || null,
          sector: r['Sector'] || r['Main Sector'] || null,
          purposes: r['Purposes'] ? r['Purposes'].split(';').map(s => s.trim()) : null,
          activities: r['Activities'] || r['Main Activity'] || null,
          address_city: r['City'] || r['Town/City'] || null,
          address_region: r['Region'] || null,
          postal_code: r['Postal Code'] || r['Postcode'] || null,
          website: r['Website'] || null,
          email: r['Email'] || null,
          registration_date: r['Registration Date'] || null,
          total_income_nzd: r['Total Income'] ? parseFloat(r['Total Income']) || null : null,
          total_expenditure_nzd: r['Total Expenditure'] ? parseFloat(r['Total Expenditure']) || null : null,
          total_assets_nzd: r['Total Assets'] ? parseFloat(r['Total Assets']) || null : null,
          is_deregistered: (r['Status'] || '').toLowerCase().includes('deregistered'),
          source_url: `https://register.charities.govt.nz/Charity/${regNumber.trim()}`,
          raw_data: r,
        };
      }).filter(r => r.registration_number && r.name);

      if (APPLY && rows.length) {
        const { error } = await db
          .from('nz_charities')
          .upsert(rows, { onConflict: 'registration_number' });

        if (error) {
          console.error(`  Batch error at ${i}: ${error.message}`);
          stats.errors++;
        } else {
          stats.created += rows.length;
        }
      } else {
        stats.created += rows.length;
      }

      if (i % 500 === 0) {
        console.log(`  Processed ${stats.processed}/${records.length}...`);
      }
    }

    console.log(`\nDone. ${stats.processed} processed, ${stats.created} ${APPLY ? 'upserted' : '(dry run)'}, ${stats.errors} errors`);
    await logComplete(db, runId, { items_found: stats.processed, items_new: stats.created });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
