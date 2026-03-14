#!/usr/bin/env node
/**
 * Import ACT Government Contracts from taxpayer-money GitHub CSV
 *
 * Source: https://github.com/taxpayer-money/australian-government-contracts
 * Pre-downloaded to: data/act-contracts/act_contracts_2025.csv
 *
 * Usage:
 *   node --env-file=.env scripts/import-act-contracts.mjs [--apply]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const DATA_FILE = 'data/act-contracts/act_contracts_2025.csv';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseValue(val) {
  if (!val) return null;
  const num = parseFloat(val.replace(/[$,\s]/g, ''));
  return isNaN(num) ? null : num;
}

async function main() {
  const run = await logStart(db, 'import-act-contracts', 'Import ACT Government Contracts');

  try {
    console.log('=== ACT Government Contracts Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    const raw = readFileSync(DATA_FILE, 'utf8');
    const lines = raw.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    console.log(`  Headers: ${headers.slice(0, 7).join(', ')}`);
    console.log(`  ${lines.length - 1} data rows`);

    // Headers: contract_number, procurement_unique_id, title, directorate,
    //          contract_type, slj_initiative, status, execution_date, expiry_date,
    //          amount, suppliers, details_url, has_attachments
    const contracts = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const contractNumber = cols[0];
      const title = cols[2];
      const directorate = cols[3];
      const executionDate = cols[7];
      const expiryDate = cols[8];
      const amount = cols[9];
      const suppliers = cols[10];

      if (!contractNumber && !suppliers) {
        skipped++;
        continue;
      }

      const contractValue = parseValue(amount);
      const startDate = executionDate || null;
      const endDate = expiryDate || null;

      contracts.push({
        ocid: `act-${contractNumber}`,
        title: title?.slice(0, 2000) || null,
        contract_value: contractValue,
        currency: 'AUD',
        buyer_name: directorate || null,
        supplier_name: suppliers || null,
        contract_start: startDate,
        contract_end: endDate,
        date_published: startDate ? new Date(startDate).toISOString() : null,
        source_url: 'https://www.tenders.act.gov.au',
      });
    }

    console.log(`  ${contracts.length} contracts mapped`);
    console.log(`  ${skipped} skipped`);

    // Dedupe
    const seen = new Set();
    const unique = contracts.filter(c => {
      if (seen.has(c.ocid)) return false;
      seen.add(c.ocid);
      return true;
    });
    console.log(`  ${unique.length} unique after dedup`);

    const totalValue = unique.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    console.log(`\n  Total value: $${(totalValue / 1e6).toFixed(1)}M`);

    // Top buyers
    const buyers = {};
    for (const c of unique) {
      const b = c.buyer_name || 'Unknown';
      buyers[b] = (buyers[b] || 0) + 1;
    }
    console.log('\n=== Top Buyers ===');
    const sortedBuyers = Object.entries(buyers).sort((a, b) => b[1] - a[1]);
    for (const [buyer, count] of sortedBuyers.slice(0, 10)) {
      console.log(`  ${count.toString().padStart(5)} | ${buyer}`);
    }

    if (APPLY && unique.length > 0) {
      console.log('\nUpserting to austender_contracts...');
      let upserted = 0;
      let errors = 0;

      for (let i = 0; i < unique.length; i += 500) {
        const chunk = unique.slice(i, i + 500);
        const { error } = await db
          .from('austender_contracts')
          .upsert(chunk, { onConflict: 'ocid' });

        if (error) {
          console.error(`  Error at batch ${Math.floor(i / 500) + 1}: ${error.message}`);
          errors++;
        } else {
          upserted += chunk.length;
        }
      }

      console.log(`  ${upserted} upserted, ${errors} batch errors`);
    }

    if (!APPLY) console.log('\n  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: lines.length - 1,
      items_new: unique.length,
      items_updated: APPLY ? unique.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
