#!/usr/bin/env node
/**
 * Import NDIS Participant Data
 *
 * Downloads and imports NDIS quarterly participant numbers + utilisation data.
 * Joins to existing geography via service district → LGA mapping.
 *
 * Data source: https://dataresearch.ndis.gov.au/datasets/participant-datasets
 *
 * Usage:
 *   node --env-file=.env scripts/import-ndis-participants.mjs [--apply]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Simple CSV parser that handles quoted fields
function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
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

function parseNumber(val) {
  if (!val || val === 'np' || val === 'nk') return null;
  // Handle "<5" style values — use the number
  const cleaned = val.replace(/[<>,\s$]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parsePercent(val) {
  if (!val || val === 'np' || val === 'nk') return null;
  const cleaned = val.replace(/[<%\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function main() {
  console.log('=== NDIS Participant Data Import ===');
  console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log();

  const run = await logStart(db, 'import-ndis-participants', 'Import NDIS Participant Data');

  try {
    // --- Parse participant numbers ---
    console.log('--- Phase 1: Parse participant numbers ---');
    const partText = readFileSync('data/ndis/participant-numbers-dec2025.csv', 'utf8');
    const partRows = parseCSV(partText);
    console.log(`  ${partRows.length} rows parsed`);

    // Filter to service district level (not ALL/state aggregates)
    // Keep rows where SrvcDstrctNm != 'ALL' and StateCd != 'ALL'
    const districtRows = partRows.filter(r =>
      r.SrvcDstrctNm !== 'ALL' &&
      r.StateCd !== 'ALL' &&
      r.StateCd !== 'State_Missing' &&
      r.SuppClass === 'ALL' // Only total budgets, not per-class
    );
    console.log(`  ${districtRows.length} district-level rows (SuppClass=ALL)`);

    // Build import records
    const participantRecords = districtRows.map(r => ({
      report_date: '2025-12-31',
      state: r.StateCd,
      service_district: r.SrvcDstrctNm,
      disability_group: r.DsbltyGrpNm,
      age_band: r.AgeBnd,
      support_class: r.SuppClass,
      avg_annual_budget: parseNumber(r.AvgAnlsdCmtdSuppBdgt),
      active_participants: parseNumber(r.ActvPrtcpnt),
      source: 'ndis_quarterly_dec2025',
    }));

    console.log(`  ${participantRecords.length} records to import`);

    // Sample
    const sample = participantRecords.find(r => r.active_participants > 100);
    if (sample) {
      console.log(`  Sample: ${sample.service_district} | ${sample.disability_group} | ${sample.age_band} | ${sample.active_participants} participants | $${sample.avg_annual_budget?.toLocaleString()} avg budget`);
    }

    // --- Parse utilisation ---
    console.log('\n--- Phase 2: Parse utilisation ---');
    const utilText = readFileSync('data/ndis/utilisation-dec2025.csv', 'utf8');
    const utilRows = parseCSV(utilText);
    console.log(`  ${utilRows.length} rows parsed`);

    const utilDistrictRows = utilRows.filter(r =>
      r.SrvcDstrctNm !== 'ALL' &&
      r.StateCd !== 'ALL' &&
      r.StateCd !== 'State_Missing' &&
      r.suppclass === 'ALL' &&
      r.SILorSDA === 'ALL' &&
      r.DsbltyGrpNm === 'ALL' &&
      r.AgeBnd === 'ALL'
    );
    console.log(`  ${utilDistrictRows.length} district-level utilisation rows`);

    // Build utilisation map: district → utilisation %
    const utilMap = new Map();
    for (const r of utilDistrictRows) {
      utilMap.set(r.SrvcDstrctNm, parsePercent(r.Utlstn));
    }

    // --- Aggregate stats ---
    console.log('\n--- Stats ---');

    // Total participants by disability
    const byDisability = new Map();
    for (const r of participantRecords) {
      if (r.disability_group === 'ALL' || r.age_band !== 'ALL') continue;
      const key = r.disability_group;
      byDisability.set(key, (byDisability.get(key) || 0) + (r.active_participants || 0));
    }
    const sorted = [...byDisability.entries()].sort((a, b) => b[1] - a[1]);
    console.log('  Top disability groups:');
    for (const [grp, count] of sorted.slice(0, 10)) {
      console.log(`    ${grp.padEnd(30)} ${count.toLocaleString()}`);
    }

    // Total by state
    const byState = new Map();
    for (const r of participantRecords) {
      if (r.disability_group !== 'ALL' || r.age_band !== 'ALL') continue;
      const key = r.state;
      byState.set(key, (byState.get(key) || 0) + (r.active_participants || 0));
    }
    console.log('\n  Participants by state:');
    for (const [state, count] of [...byState.entries()].sort((a, b) => b[1] - a[1])) {
      const util = utilMap.get(state) || '-';
      console.log(`    ${state.padEnd(5)} ${count.toLocaleString().padStart(10)}`);
    }

    // --- Import ---
    if (APPLY) {
      console.log('\n--- Phase 3: Import to database ---');

      // Clear existing data for this report period
      console.log('  Clearing existing data...');
      const { error: delError } = await db
        .from('ndis_participants')
        .delete()
        .eq('source', 'ndis_quarterly_dec2025');

      if (delError && !delError.message.includes('does not exist')) {
        console.error('  Delete error:', delError.message);
      } else if (!delError) {
        console.log('  ✅ Deleted existing records');
      }

      // Insert in batches
      let inserted = 0;
      let errors = 0;
      const batchSize = 500;

      for (let i = 0; i < participantRecords.length; i += batchSize) {
        const batch = participantRecords.slice(i, i + batchSize);
        const { error: insertError } = await db
          .from('ndis_participants')
          .insert(batch);

        if (insertError) {
          errors++;
          if (errors <= 3) console.error(`  Batch error: ${insertError.message}`);
        } else {
          inserted += batch.length;
        }
      }

      console.log(`  ${inserted} participant records inserted, ${errors} batch errors`);
    }

    const totalParticipants = [...byState.values()].reduce((a, b) => a + b, 0);

    console.log(`\n=== Summary ===`);
    console.log(`  Total participant records: ${participantRecords.length}`);
    console.log(`  Total active participants: ${totalParticipants.toLocaleString()}`);
    console.log(`  Districts: ${new Set(participantRecords.map(r => r.service_district)).size}`);
    console.log(`  Disability groups: ${new Set(participantRecords.map(r => r.disability_group)).size}`);
    if (!APPLY) console.log('  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: participantRecords.length,
      items_new: APPLY ? participantRecords.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
