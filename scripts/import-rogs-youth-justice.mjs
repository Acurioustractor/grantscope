#!/usr/bin/env node
/**
 * Import ROGS Youth Justice Data (Productivity Commission)
 *
 * Source: https://www.pc.gov.au/ongoing/report-on-government-services/community-services/youth-justice/
 * Pre-downloaded to: data/rogs-youth-justice/youth-justice-2026.csv
 *
 * Imports expenditure, supervision rates, and cost-per-day data by state/territory
 * into justice_funding table for cross-analysis with existing grant and procurement data.
 *
 * Usage:
 *   node --env-file=.env scripts/import-rogs-youth-justice.mjs [--apply]
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
const DATA_FILE = 'data/rogs-youth-justice/youth-justice-2026.csv';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATE_COLS = {
  NSW: 17, Vic: 18, Qld: 19, WA: 20, SA: 21, Tas: 22, ACT: 23, NT: 24, Aust: 25,
};

const STATE_MAP = {
  NSW: 'NSW', Vic: 'VIC', Qld: 'QLD', WA: 'WA', SA: 'SA', Tas: 'TAS', ACT: 'ACT', NT: 'NT',
};

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

function parseAmount(val, unit) {
  if (!val || val === 'na' || val === 'np' || val === '..') return null;
  const num = parseFloat(val.replace(/,/g, ''));
  if (isNaN(num)) return null;
  // $'000 means thousands
  if (unit === "$'000") return num * 1000;
  return num;
}

async function main() {
  const run = await logStart(db, 'import-rogs-youth-justice', 'Import ROGS Youth Justice Data');

  try {
    console.log('=== ROGS Youth Justice Data Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    const raw = readFileSync(DATA_FILE, 'utf8');
    const lines = raw.trim().split('\n');
    console.log(`  ${lines.length - 1} data rows`);

    // Filter for expenditure rows (Table 17A.10)
    const expenditureRows = [];
    const supervisionRows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const table = cols[0];
      const year = cols[1];
      const measure = cols[2];
      const serviceType = cols[7];
      const description1 = cols[9];
      const description2 = cols[10];
      const description3 = cols[11];
      const unit = cols[16];

      // Expenditure data (Table 17A.10)
      // description1 = cols[9] "Government real recurrent expenditure"
      // description2 = cols[10] (often empty, or "Per young person...")
      // description3 = cols[11] "Detention-based services" / "Community-based services" / "Total expenditure"
      const descLabel = description3 || description2;
      if (table === '17A.10' && descLabel && description1?.includes('Government real recurrent expenditure') && !description2.includes('Per young person')) {
        for (const [stateKey, colIdx] of Object.entries(STATE_COLS)) {
          if (stateKey === 'Aust') continue;
          const val = cols[colIdx];
          const amount = parseAmount(val, unit);
          if (amount !== null) {
            expenditureRows.push({
              year,
              state: STATE_MAP[stateKey],
              service_type: serviceType || 'Total',
              description: descLabel,
              amount,
              unit,
            });
          }
        }
      }

      // Supervision rates (Table 17A.1) — numbers under supervision
      if (table === '17A.1' && unit === 'no.' && description2?.includes('Average daily number')) {
        for (const [stateKey, colIdx] of Object.entries(STATE_COLS)) {
          if (stateKey === 'Aust') continue;
          const val = cols[colIdx];
          const num = parseAmount(val, 'no.');
          if (num !== null) {
            supervisionRows.push({
              year,
              state: STATE_MAP[stateKey],
              service_type: serviceType || 'Total',
              description: description3 || description2,
              count: num,
            });
          }
        }
      }
    }

    console.log(`  ${expenditureRows.length} expenditure data points`);
    console.log(`  ${supervisionRows.length} supervision count data points`);

    // Map to justice_funding rows
    const fundingRows = [];

    for (const row of expenditureRows) {
      const fy = row.year; // e.g. "2024-25"
      fundingRows.push({
        recipient_name: `Youth Justice - ${row.description}`,
        program_name: `ROGS Youth Justice ${row.service_type || 'Total'}`,
        amount_dollars: row.amount,
        state: row.state,
        financial_year: fy,
        sector: 'youth-justice',
        source: 'rogs-2026',
        source_url: 'https://www.pc.gov.au/ongoing/report-on-government-services/community-services/youth-justice/',
      });
    }

    console.log(`  ${fundingRows.length} justice_funding rows to insert`);

    // Summary by state for latest year
    const latest = {};
    for (const row of expenditureRows.filter(r => r.year === '2024-25' && r.description === 'Total expenditure')) {
      latest[row.state] = (latest[row.state] || 0) + row.amount;
    }
    console.log('\n=== 2024-25 Total Youth Justice Expenditure by State ===');
    const sorted = Object.entries(latest).sort((a, b) => b[1] - a[1]);
    for (const [state, amount] of sorted) {
      console.log(`  ${state.padEnd(4)} | $${(amount / 1e6).toFixed(1)}M`);
    }

    // Time series for national total
    const national = {};
    for (const row of expenditureRows.filter(r => r.description === 'Total expenditure')) {
      national[row.year] = (national[row.year] || 0) + row.amount;
    }
    console.log('\n=== National Youth Justice Expenditure Over Time ===');
    const sortedYears = Object.entries(national).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [year, amount] of sortedYears) {
      console.log(`  ${year} | $${(amount / 1e6).toFixed(0)}M`);
    }

    if (APPLY && fundingRows.length > 0) {
      // First delete existing ROGS youth justice data to avoid dupes
      console.log('\nClearing existing ROGS youth justice data...');
      const { error: delError } = await db
        .from('justice_funding')
        .delete()
        .eq('source', 'rogs-2026');
      if (delError) {
        console.error(`  Delete error: ${delError.message}`);
      } else {
        console.log('  ✅ Deleted existing records');
      }

      console.log('Inserting to justice_funding...');
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < fundingRows.length; i += 500) {
        const chunk = fundingRows.slice(i, i + 500);
        const { error } = await db
          .from('justice_funding')
          .insert(chunk);

        if (error) {
          console.error(`  Error at batch ${Math.floor(i / 500) + 1}: ${error.message}`);
          errors++;
        } else {
          inserted += chunk.length;
        }
      }

      console.log(`  ${inserted} inserted, ${errors} batch errors`);
    }

    if (!APPLY) console.log('\n  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: lines.length - 1,
      items_new: fundingRows.length,
      items_updated: APPLY ? fundingRows.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
