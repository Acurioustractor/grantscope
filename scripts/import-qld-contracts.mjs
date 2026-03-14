#!/usr/bin/env node
/**
 * Import QLD Awarded Contracts from Queensland Open Data Portal CSV
 *
 * Source: https://www.data.qld.gov.au/dataset/queensland-government-contracts-directory-awarded-contracts
 * Pre-downloaded to: data/qld-contracts/awarded.csv
 *
 * Maps to austender_contracts schema for unified procurement analysis.
 *
 * Usage:
 *   node --env-file=.env scripts/import-qld-contracts.mjs [--apply] [--limit=1000]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const DATA_FILE = 'data/qld-contracts/awarded.csv';
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

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Format: DD/MM/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function parseValue(val) {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function main() {
  const run = await logStart(db, 'import-qld-contracts', 'Import QLD Awarded Contracts');

  try {
    console.log('=== QLD Awarded Contracts Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    const raw = readFileSync(DATA_FILE, 'utf8');
    const lines = raw.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    console.log(`  Headers: ${headers.slice(0, 7).join(', ')}`);
    console.log(`  ${lines.length - 1} data rows`);

    const contracts = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const agency = cols[0];
      const description = cols[2];
      const date = cols[3];
      const value = cols[4];
      const supplier = cols[5];
      const supplierAddr = cols[6];

      if (!agency && !supplier) {
        skipped++;
        continue;
      }

      const contractValue = parseValue(value);
      const publishDate = parseDate(date);

      // Generate a stable OCID from agency + supplier + date + value
      const ocid = `qld-${(agency || '').slice(0, 30)}-${(supplier || '').slice(0, 30)}-${date || ''}-${contractValue || ''}`.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 200);

      contracts.push({
        ocid,
        title: description?.slice(0, 2000) || null,
        contract_value: contractValue,
        currency: 'AUD',
        buyer_name: agency || null,
        supplier_name: supplier || null,
        date_published: publishDate ? new Date(publishDate).toISOString() : null,
        contract_start: publishDate,
        source_url: 'https://www.data.qld.gov.au',
        procurement_method: 'open',
      });

      if (LIMIT && contracts.length >= LIMIT) break;
    }

    console.log(`  ${contracts.length} contracts mapped`);
    console.log(`  ${skipped} skipped`);

    // Dedupe by ocid
    const seen = new Set();
    const unique = contracts.filter(c => {
      if (seen.has(c.ocid)) return false;
      seen.add(c.ocid);
      return true;
    });
    console.log(`  ${unique.length} unique after dedup (${contracts.length - unique.length} dupes)`);

    const totalValue = unique.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    console.log(`\n  Total value: $${(totalValue / 1e9).toFixed(2)}B`);

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
