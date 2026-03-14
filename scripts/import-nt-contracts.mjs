#!/usr/bin/env node
/**
 * Import NT Government Awarded Contracts from XLSX
 *
 * Source: https://data.nt.gov.au/dataset/awarded-government-contracts
 * Pre-downloaded to: data/nt-contracts/awarded.xlsx
 *
 * Usage:
 *   node --env-file=.env scripts/import-nt-contracts.mjs [--apply]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const DATA_FILE = 'data/nt-contracts/awarded.xlsx';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const run = await logStart(db, 'import-nt-contracts', 'Import NT Awarded Contracts');

  try {
    console.log('=== NT Awarded Contracts Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    const wb = XLSX.readFile(DATA_FILE);
    const ws = wb.Sheets['Government awarded contracts'];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const headers = raw[0];
    console.log(`  ${raw.length - 1} data rows`);

    const contracts = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      const ref = row[0];
      const description = row[1];
      const category = row[4];
      const process = row[5];
      const type = row[6];
      const agency = row[7];
      const value = row[8];
      const contractor = row[9];
      const state = row[11];
      const city = row[12];
      const territoryEnterprise = row[13];
      const awardedSerial = row[14];

      if (!ref) continue;

      // Convert Excel serial date
      let awardedDate = null;
      if (typeof awardedSerial === 'number' && awardedSerial > 30000) {
        const d = XLSX.SSF.parse_date_code(awardedSerial);
        if (d) awardedDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }

      contracts.push({
        ocid: `nt-${ref}`,
        title: description?.toString().slice(0, 2000) || null,
        contract_value: typeof value === 'number' ? value : null,
        currency: 'AUD',
        buyer_name: agency || null,
        supplier_name: contractor || null,
        contract_start: awardedDate,
        date_published: awardedDate ? new Date(awardedDate).toISOString() : null,
        category: category || null,
        procurement_method: process || type || null,
        source_url: 'https://data.nt.gov.au',
      });
    }

    console.log(`  ${contracts.length} contracts mapped`);

    // Dedupe
    const seen = new Set();
    const unique = contracts.filter(c => {
      if (seen.has(c.ocid)) return false;
      seen.add(c.ocid);
      return true;
    });
    console.log(`  ${unique.length} unique after dedup`);

    const totalValue = unique.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    console.log(`\n  Total value: $${(totalValue / 1e9).toFixed(2)}B`);

    // Top buyers
    const buyers = {};
    for (const c of unique) {
      const b = c.buyer_name || 'Unknown';
      buyers[b] = (buyers[b] || 0) + 1;
    }
    console.log('\n=== Top Buyers ===');
    const sorted = Object.entries(buyers).sort((a, b) => b[1] - a[1]);
    for (const [buyer, count] of sorted.slice(0, 10)) {
      console.log(`  ${count.toString().padStart(5)} | ${buyer}`);
    }

    // Territory Enterprise stats
    const teCount = contracts.filter(c => {
      const row = raw[contracts.indexOf(c) + 1];
      return row?.[13] === 'Yes';
    }).length;

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
      items_found: raw.length - 1,
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
