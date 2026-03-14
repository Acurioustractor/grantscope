#!/usr/bin/env node
/**
 * Import Closing the Gap Youth Justice Data (Outcome 11)
 *
 * Source: https://www.pc.gov.au/closing-the-gap-data/dashboard/outcome-area/youth-justice/
 * Pre-downloaded to: data/closing-the-gap/ctg-youth-justice.csv
 *
 * Contains Indigenous youth detention rates, trajectory targets, police proceedings,
 * and court data by state/territory — the accountability layer for youth justice spending.
 *
 * Imports to rogs_justice_spending table with rogs_section = 'closing-the-gap'.
 *
 * Usage:
 *   node --env-file=.env scripts/import-ctg-youth-justice.mjs [--apply]
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
const DATA_FILE = 'data/closing-the-gap/ctg-youth-justice.csv';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATE_COLS = { NSW: 16, Vic: 17, Qld: 18, WA: 19, SA: 20, Tas: 21, ACT: 22, NT: 23, Aust: 24 };

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
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

function parseNum(val) {
  if (!val || val === '..' || val === 'np' || val === 'na' || val === '–') return null;
  const num = parseFloat(val.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

async function main() {
  const run = await logStart(db, 'import-ctg-youth-justice', 'Import Closing the Gap Youth Justice');

  try {
    console.log('=== Closing the Gap Youth Justice Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    const raw = readFileSync(DATA_FILE, 'utf8');
    const lines = raw.trim().split('\n');
    const header = parseCSVLine(lines[0]);
    console.log(`  ${lines.length - 1} data rows`);
    console.log(`  Columns: ${header.length}`);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const table = cols[0];
      const year = cols[1];
      const measure = cols[2];
      const age = cols[3];
      const sex = cols[4];
      const indigenous = cols[5];
      const desc1 = cols[6];
      const desc2 = cols[7];
      const desc3 = cols[8];
      const desc4 = cols[9];
      const uncertainty = cols[13];
      const dataSource = cols[14];
      const unit = cols[15];

      // Build description combining desc1-4
      const description = [desc3, desc4].filter(Boolean).join(' — ') || desc2 || desc1;
      const serviceType = desc3 || '';

      // Parse state values
      const stateValues = {};
      for (const [stateKey, colIdx] of Object.entries(STATE_COLS)) {
        stateValues[stateKey.toLowerCase()] = parseNum(cols[colIdx]);
      }

      rows.push({
        rogs_table: table,
        rogs_section: 'closing-the-gap',
        financial_year: year,
        measure: measure,
        service_type: serviceType,
        indigenous_status: indigenous,
        age_group: age,
        description1: desc1,
        description2: desc2,
        description3: desc3 || null,
        description4: desc4 || null,
        unit: uncertainty ? `${unit} (${uncertainty})` : unit,
        data_source: dataSource,
        ...stateValues,
      });
    }

    console.log(`  ${rows.length} rows to import`);

    // Summary stats
    const tables = {};
    for (const r of rows) {
      tables[r.rogs_table] = (tables[r.rogs_table] || 0) + 1;
    }
    console.log('\n=== Tables ===');
    for (const [t, c] of Object.entries(tables).sort()) {
      console.log(`  ${t.padEnd(12)} | ${c} rows`);
    }

    // Key indicators
    const detentionRates = rows.filter(r =>
      r.rogs_table === 'CtG11A.1' &&
      !r.unit.includes('CI') &&
      r.description2?.includes('Rate') &&
      !r.description3?.includes('regression')
    );

    // Show actual vs trajectory for latest year
    const actuals = detentionRates.filter(r => !r.description3?.includes('Trajectory'));
    const trajectories = detentionRates.filter(r => r.description3?.includes('Trajectory'));

    if (actuals.length > 0) {
      console.log('\n=== Indigenous Youth Detention Rates (per 10,000) ===');
      const latest = actuals.sort((a, b) => b.financial_year.localeCompare(a.financial_year));
      const latestYear = latest[0]?.financial_year;
      const yearActuals = latest.filter(r => r.financial_year === latestYear);
      for (const r of yearActuals) {
        console.log(`  ${latestYear} | NSW:${r.nsw ?? '..'} VIC:${r.vic ?? '..'} QLD:${r.qld ?? '..'} WA:${r.wa ?? '..'} SA:${r.sa ?? '..'} TAS:${r.tas ?? '..'} ACT:${r.act ?? '..'} NT:${r.nt ?? '..'} | National:${r.aust ?? '..'}`);
      }
    }

    if (trajectories.length > 0) {
      const target2031 = trajectories.find(r => r.financial_year === '2030-31');
      if (target2031) {
        console.log(`  2030-31 target: ${target2031.aust} per 10,000 (national)`);
      }
    }

    if (APPLY && rows.length > 0) {
      // Clear existing CtG data
      console.log('\nClearing existing CtG youth justice data...');
      const { error: delError } = await db
        .from('rogs_justice_spending')
        .delete()
        .eq('rogs_section', 'closing-the-gap');
      if (delError) {
        console.error(`  Delete error: ${delError.message}`);
      } else {
        console.log('  ✅ Deleted existing records');
      }

      console.log('Inserting to rogs_justice_spending...');
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db
          .from('rogs_justice_spending')
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
      items_found: rows.length,
      items_new: rows.length,
      items_updated: APPLY ? rows.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
