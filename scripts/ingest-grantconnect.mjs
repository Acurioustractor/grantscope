#!/usr/bin/env node
/**
 * Ingest GrantConnect Awarded Grants
 *
 * Source: grants.gov.au weekly export CSV (manual download required)
 * Download from: https://www.grants.gov.au/reports/gaweeklyexport
 * Save to: data/grantconnect/ga-weekly-export.csv
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-grantconnect.mjs
 *   node --env-file=.env scripts/ingest-grantconnect.mjs --dry-run
 *   node --env-file=.env scripts/ingest-grantconnect.mjs --file data/grantconnect/custom.csv
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const fileArg = process.argv.find(a => a.startsWith('--file='));
const CSV_PATH = fileArg ? fileArg.split('=')[1] : 'data/grantconnect/ga-weekly-export.csv';

// Column name mapping — GrantConnect export uses verbose headers
// These map common GrantConnect header variations to our DB columns
const COLUMN_MAP = {
  'ga id': 'ga_id',
  'ga_id': 'ga_id',
  'parent ga id': 'parent_ga_id',
  'parent_ga_id': 'parent_ga_id',
  'agency': 'agency',
  'agency name': 'agency',
  'category': 'category',
  'go id': 'go_id',
  'go_id': 'go_id',
  'grant opportunity id': 'go_id',
  'go title': 'go_title',
  'go name': 'go_title',
  'grant opportunity title': 'go_title',
  'grant opportunity name': 'go_title',
  'recipient': 'recipient_name',
  'recipient name': 'recipient_name',
  'recipient_name': 'recipient_name',
  'grantee': 'recipient_name',
  'grantee name': 'recipient_name',
  'abn': 'recipient_abn',
  'recipient abn': 'recipient_abn',
  'recipient id': 'recipient_id',
  'pbs program': 'pbs_program',
  'pbs program name': 'pbs_program',
  'pbs_program': 'pbs_program',
  'status': 'status',
  'value': 'value_aud',
  'value (aud)': 'value_aud',
  'value_aud': 'value_aud',
  'amount': 'value_aud',
  'grant value': 'value_aud',
  'variation value': 'variation_value_aud',
  'variation value (aud)': 'variation_value_aud',
  'variation reason': 'variation_reason',
  'approval date': 'approval_date',
  'start date': 'start_date',
  'end date': 'end_date',
  'publish date': 'publish_date',
  'publish date/time': 'publish_date',
  'variation date': 'variation_date',
  'selection process': 'selection_process',
  'description': 'description',
  'state': 'state',
  'location': 'state',
};

function parseDate(val) {
  if (!val || val === '') return null;
  // Try common AU date formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return val.slice(0, 10);
  const auMatch = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (auMatch) return `${auMatch[3]}-${auMatch[2].padStart(2, '0')}-${auMatch[1].padStart(2, '0')}`;
  return null;
}

function parseMoney(val) {
  if (!val || val === '' || val === '-') return null;
  const cleaned = val.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normaliseAbn(val) {
  if (!val) return null;
  const cleaned = val.replace(/\s/g, '');
  return /^\d{11}$/.test(cleaned) ? cleaned : null;
}

async function main() {
  console.log('GrantConnect Award Ingest');
  console.log('========================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`File: ${CSV_PATH}`);
  console.log();

  // Read and parse CSV
  let raw;
  try {
    raw = readFileSync(CSV_PATH, 'utf-8');
  } catch (e) {
    console.error(`Cannot read ${CSV_PATH}`);
    console.error('Download from: https://www.grants.gov.au/reports/gaweeklyexport');
    console.error('Save to: data/grantconnect/ga-weekly-export.csv');
    process.exit(1);
  }

  const records = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
  console.log(`  Parsed: ${records.length} rows`);

  if (!records.length) {
    console.error('No records found in CSV');
    process.exit(1);
  }

  // Auto-detect column mapping from headers
  const csvHeaders = Object.keys(records[0]);
  console.log(`  Headers: ${csvHeaders.join(', ')}`);

  const headerMap = {};
  for (const h of csvHeaders) {
    const normalised = h.toLowerCase().trim();
    if (COLUMN_MAP[normalised]) {
      headerMap[h] = COLUMN_MAP[normalised];
    }
  }

  console.log(`  Mapped columns: ${Object.entries(headerMap).map(([k, v]) => `${k} → ${v}`).join(', ')}`);

  const unmapped = csvHeaders.filter(h => !headerMap[h]);
  if (unmapped.length) {
    console.log(`  Unmapped: ${unmapped.join(', ')}`);
  }

  // Transform records
  const rows = [];
  let skipped = 0;

  for (const rec of records) {
    const row = {};
    for (const [csvCol, dbCol] of Object.entries(headerMap)) {
      const val = rec[csvCol]?.trim();
      if (!val || val === '') continue;

      if (['value_aud', 'variation_value_aud'].includes(dbCol)) {
        row[dbCol] = parseMoney(val);
      } else if (['approval_date', 'start_date', 'end_date'].includes(dbCol)) {
        row[dbCol] = parseDate(val);
      } else if (['publish_date', 'variation_date'].includes(dbCol)) {
        row[dbCol] = parseDate(val);
      } else if (dbCol === 'recipient_abn') {
        row[dbCol] = normaliseAbn(val);
      } else {
        row[dbCol] = val;
      }
    }

    // Must have at least ga_id or recipient_name
    if (!row.ga_id && !row.recipient_name) {
      skipped++;
      continue;
    }

    rows.push(row);
  }

  console.log(`  Valid rows: ${rows.length} (skipped: ${skipped})`);

  // Stats
  const withAbn = rows.filter(r => r.recipient_abn).length;
  const totalValue = rows.reduce((sum, r) => sum + (r.value_aud || 0), 0);
  const agencies = new Set(rows.map(r => r.agency).filter(Boolean));

  console.log(`  With ABN: ${withAbn} (${(100 * withAbn / rows.length).toFixed(1)}%)`);
  console.log(`  Total value: $${(totalValue / 1e6).toFixed(1)}M`);
  console.log(`  Agencies: ${agencies.size}`);
  console.log();

  if (DRY_RUN) {
    console.log('[DRY RUN] Would insert rows. Sample:');
    for (const r of rows.slice(0, 5)) {
      console.log(`  ${r.recipient_name || 'unnamed'} | ${r.agency || '?'} | $${r.value_aud || 0} | ABN: ${r.recipient_abn || 'none'}`);
    }
    return;
  }

  // Insert in batches
  const BATCH = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('grantconnect_awards').upsert(batch, { onConflict: 'ga_id', ignoreDuplicates: true });
    if (error) {
      console.log(`  Batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  Inserted: ${inserted}`);
  if (errors) console.log(`  Batch errors: ${errors}`);

  // Link to gs_entities by ABN
  console.log('\nLinking to gs_entities by ABN...');
  const { data: linked, error: linkErr } = await supabase.rpc('exec_sql', {
    query: `UPDATE grantconnect_awards ga
            SET gs_entity_id = ge.id
            FROM gs_entities ge
            WHERE ge.abn = ga.recipient_abn
              AND ga.gs_entity_id IS NULL
              AND ga.recipient_abn IS NOT NULL`
  });
  if (linkErr) {
    console.log(`  Link error: ${linkErr.message}`);
  } else {
    // Count linked
    const { data: counts } = await supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE gs_entity_id IS NOT NULL) as linked FROM grantconnect_awards`
    });
    if (counts?.[0]) {
      console.log(`  Linked: ${counts[0].linked}/${counts[0].total} (${(100 * counts[0].linked / counts[0].total).toFixed(1)}%)`);
    }
  }

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
