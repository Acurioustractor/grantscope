#!/usr/bin/env node

/**
 * Import QLD Political Donations
 *
 * Downloads political donation disclosures from the Queensland Electoral Commission
 * Electronic Disclosure System (EDS) and imports into political_donations table.
 *
 * Source: https://disclosures.ecq.qld.gov.au/
 * License: CC-BY-4.0
 *
 * Usage:
 *   node --env-file=.env scripts/import-qld-donations.mjs [--apply] [--limit=100] [--file=path/to/csv]
 *
 * If --file is not provided, downloads from the EDS portal.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { createReadStream } from 'fs';
import { writeFile } from 'fs/promises';
import { parse } from 'csv-parse';

const AGENT_ID = 'import-qld-donations';
const AGENT_NAME = 'QLD Donations Importer';

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

async function downloadQldData() {
  // QLD EDS exports tabulated gift data as CSV
  // The portal at disclosures.ecq.qld.gov.au allows CSV download of all gift data
  // We'll need to download it manually or use the data.qld.gov.au CKAN API
  const urls = [
    'https://data.qld.gov.au/dataset/electronic-disclosure-system-state-and-local-election-funding-and-donations',
  ];
  console.log('QLD donation data must be downloaded manually from:');
  console.log('  https://disclosures.ecq.qld.gov.au/');
  console.log('  Navigate to Reports > Tabulated Gift Data > Download as CSV');
  console.log('');
  console.log('Then run: node --env-file=.env scripts/import-qld-donations.mjs --file=path/to/gifts.csv --apply');
  process.exit(1);
}

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
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;
  const stats = { processed: 0, created: 0, skipped: 0, errors: 0 };

  try {
    if (!FILE_PATH) {
      await downloadQldData();
      return;
    }

    console.log(`Loading CSV from ${FILE_PATH}...`);
    const records = await loadCSV(FILE_PATH);
    console.log(`Loaded ${records.length} records`);

    // Log sample record to understand column names
    if (records.length > 0) {
      console.log('Sample columns:', Object.keys(records[0]).join(', '));
      console.log('Sample record:', JSON.stringify(records[0], null, 2));
    }

    const BATCH_SIZE = 200;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const rows = batch.map(r => {
        stats.processed++;

        // QLD EDS CSV columns (may vary — these are the known ones):
        // Donor/Third Party Name, Recipient Name, Date Gift Made, Gift Value, Gift Type,
        // Entity Type, Electorate, Election Event
        const donorName = r['Donor/Third Party Name'] || r['Donor Name'] || r['DonorName'] || '';
        const recipientName = r['Recipient Name'] || r['RecipientName'] || r['Donation To'] || '';
        const amount = parseFloat((r['Gift Value'] || r['GiftValue'] || r['Amount'] || '0').replace(/[,$]/g, ''));
        const dateStr = r['Date Gift Made'] || r['DateGiftMade'] || r['Date'] || '';
        const giftType = r['Gift Type'] || r['GiftType'] || '';
        const electorate = r['Electorate'] || '';
        const electionEvent = r['Election Event'] || r['ElectionEvent'] || '';

        // Parse date — QLD uses DD/MM/YYYY
        let financialYear = '';
        if (dateStr) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const year = parseInt(parts[2]);
            const month = parseInt(parts[1]);
            financialYear = month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
          }
        }

        if (!donorName || !recipientName) return null;

        return {
          donor_name: donorName.trim(),
          donor_type: giftType || null,
          donation_to: recipientName.trim(),
          amount: isNaN(amount) ? 0 : amount,
          financial_year: financialYear || null,
          source_state: 'QLD',
          properties: {
            electorate: electorate || undefined,
            election_event: electionEvent || undefined,
            gift_type: giftType || undefined,
            date_gift_made: dateStr || undefined,
          },
        };
      }).filter(Boolean);

      if (APPLY && rows.length) {
        const { error } = await db
          .from('political_donations')
          .upsert(rows, {
            onConflict: 'donor_name,donation_to,amount,financial_year',
            ignoreDuplicates: true,
          });

        if (error) {
          // If upsert fails (no unique constraint), fall back to insert
          const { error: insertError } = await db
            .from('political_donations')
            .insert(rows);

          if (insertError) {
            console.error(`  Batch error at ${i}: ${insertError.message}`);
            stats.errors++;
          } else {
            stats.created += rows.length;
          }
        } else {
          stats.created += rows.length;
        }
      } else {
        stats.created += rows.length;
      }

      if (i % 1000 === 0 && i > 0) {
        console.log(`  Processed ${stats.processed}/${records.length}...`);
      }
    }

    console.log(`\nDone. ${stats.processed} processed, ${stats.created} ${APPLY ? 'imported' : '(dry run)'}, ${stats.errors} errors`);
    await logComplete(db, runId, { items_found: stats.processed, items_new: stats.created });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
