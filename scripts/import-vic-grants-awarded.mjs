#!/usr/bin/env node
/**
 * Import Victorian awarded grants from per-source CSVs.
 *
 * Sources (each publishes a grant register annually or quarterly):
 *   - vmc          Victorian Multicultural Commission Grants Register
 *                  https://www.multiculturalcommission.vic.gov.au/grants
 *   - dffh         Dept Families Fairness & Housing — Strengthening Communities, Family Violence, Settlement
 *                  https://providers.dffh.vic.gov.au
 *   - dpc          Dept Premier & Cabinet — Multicultural Affairs grants
 *   - creative_vic Creative Victoria
 *   - health_vic   Health Victoria
 *   - rdv          Regional Development Victoria
 *   - djsir / djcs / deeca — other portfolios as needed
 *
 * Drop a CSV per source per FY into data/vic-grants-awarded/{source}-{fy}.csv
 * with columns matching VIC_COLUMN_MAP below (Government Grants Register format
 * is the de facto standard — Recipient, Program, Amount, Approval Date, etc).
 *
 * Usage:
 *   node --env-file=.env scripts/import-vic-grants-awarded.mjs
 *   node --env-file=.env scripts/import-vic-grants-awarded.mjs --source=vmc
 *   node --env-file=.env scripts/import-vic-grants-awarded.mjs --file data/vic-grants-awarded/vmc-2024-25.csv --source=vmc --fy=2024-25
 *   node --env-file=.env scripts/import-vic-grants-awarded.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse } from 'csv-parse/sync';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const sourceArg = process.argv.find(a => a.startsWith('--source='))?.split('=')[1];
const fileArg   = process.argv.find(a => a.startsWith('--file='))?.split('=')[1];
const fyArg     = process.argv.find(a => a.startsWith('--fy='))?.split('=')[1];

const ALLOWED_SOURCES = ['vmc', 'dffh', 'dpc', 'creative_vic', 'health_vic', 'rdv', 'djsir', 'djcs', 'deeca', 'other'];
const DATA_DIR = 'data/vic-grants-awarded';

// VIC Government Grants Register CSVs use varying column names — map them all.
const VIC_COLUMN_MAP = {
  'recipient': 'recipient_name',
  'recipient name': 'recipient_name',
  'recipient organisation': 'recipient_name',
  'organisation': 'recipient_name',
  'grantee': 'recipient_name',
  'abn': 'recipient_abn',
  'recipient abn': 'recipient_abn',
  'program': 'program_name',
  'program name': 'program_name',
  'grant program': 'program_name',
  'funding program': 'program_name',
  'round': 'round_name',
  'round name': 'round_name',
  'agency': 'agency',
  'department': 'agency',
  'amount': 'amount_aud',
  'amount aud': 'amount_aud',
  'amount ($)': 'amount_aud',
  'grant amount': 'amount_aud',
  'value': 'amount_aud',
  'approval date': 'approval_date',
  'date approved': 'approval_date',
  'start date': 'start_date',
  'end date': 'end_date',
  'financial year': 'financial_year',
  'fy': 'financial_year',
  'description': 'description',
  'project description': 'description',
  'purpose': 'description',
  'region': 'region',
  'location': 'region',
  'lga': 'region',
  'url': 'source_url',
  'source url': 'source_url',
  'source id': 'source_id',
  'reference': 'source_id',
  'grant id': 'source_id',
};

function parseDate(val) {
  if (!val) return null;
  const v = String(val).trim();
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return v.slice(0, 10);
  const au = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (au) return `${au[3]}-${au[2].padStart(2, '0')}-${au[1].padStart(2, '0')}`;
  return null;
}

function parseMoney(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normaliseAbn(val) {
  if (!val) return null;
  const cleaned = String(val).replace(/\s/g, '');
  return /^\d{11}$/.test(cleaned) ? cleaned : null;
}

function inferSourceFromFilename(filename) {
  const lower = filename.toLowerCase();
  for (const s of ALLOWED_SOURCES) {
    if (lower.startsWith(`${s}-`) || lower.includes(`/${s}-`)) return s;
  }
  return null;
}

function inferFyFromFilename(filename) {
  const m = filename.match(/(\d{4})[-_](\d{2,4})/);
  if (!m) return null;
  const right = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${m[1]}-${right.slice(2, 4)}`;
}

async function ingestFile(filePath, source, fy) {
  const filename = basename(filePath);
  const sourceCode = source || inferSourceFromFilename(filename);
  if (!sourceCode || !ALLOWED_SOURCES.includes(sourceCode)) {
    throw new Error(`Cannot determine source for ${filename}; pass --source=<one of ${ALLOWED_SOURCES.join('|')}>`);
  }
  const fyCode = fy || inferFyFromFilename(filename);

  const raw = readFileSync(filePath, 'utf-8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true });
  console.log(`  ${filename}: parsed ${records.length} rows (source=${sourceCode}, fy=${fyCode || 'unknown'})`);
  if (!records.length) return { found: 0, inserted: 0 };

  // Auto-map headers
  const headers = Object.keys(records[0]);
  const headerMap = {};
  for (const h of headers) {
    const norm = h.toLowerCase().trim();
    if (VIC_COLUMN_MAP[norm]) headerMap[h] = VIC_COLUMN_MAP[norm];
  }
  const unmapped = headers.filter(h => !headerMap[h]);
  if (unmapped.length) console.log(`    unmapped: ${unmapped.slice(0, 6).join(', ')}${unmapped.length > 6 ? '...' : ''}`);

  const rows = [];
  for (const rec of records) {
    const row = { source: sourceCode, financial_year: fyCode || null, raw: rec };
    for (const [csvCol, dbCol] of Object.entries(headerMap)) {
      const val = rec[csvCol];
      if (val == null || String(val).trim() === '') continue;
      if (dbCol === 'amount_aud') row[dbCol] = parseMoney(val);
      else if (['approval_date', 'start_date', 'end_date'].includes(dbCol)) row[dbCol] = parseDate(val);
      else if (dbCol === 'recipient_abn') row[dbCol] = normaliseAbn(val);
      else row[dbCol] = String(val).trim();
    }
    if (!row.recipient_name) continue;
    rows.push(row);
  }

  const totalAmt = rows.reduce((s, r) => s + (r.amount_aud || 0), 0);
  const withAbn = rows.filter(r => r.recipient_abn).length;
  console.log(`    valid: ${rows.length} | with ABN: ${withAbn} (${((withAbn / rows.length) * 100).toFixed(1)}%) | total: $${(totalAmt / 1e6).toFixed(2)}M`);

  if (DRY_RUN) {
    for (const r of rows.slice(0, 3)) {
      console.log(`    sample: ${r.recipient_name} | ${r.program_name || '?'} | $${r.amount_aud || 0} | ABN: ${r.recipient_abn || 'none'}`);
    }
    return { found: rows.length, inserted: 0 };
  }

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await db.from('vic_grants_awarded').upsert(batch, {
      onConflict: 'source,source_id,recipient_name,program_name,financial_year,amount_aud',
      ignoreDuplicates: true,
    });
    if (error) {
      console.log(`    batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`    inserted: ${inserted}`);
  return { found: rows.length, inserted };
}

async function linkAbns() {
  console.log('\nLinking vic_grants_awarded → gs_entities by ABN...');
  const { data, error } = await db.rpc('exec_sql', {
    query: `UPDATE vic_grants_awarded vga
            SET gs_entity_id = ge.id
            FROM gs_entities ge
            WHERE ge.abn = vga.recipient_abn
              AND vga.gs_entity_id IS NULL
              AND vga.recipient_abn IS NOT NULL
            RETURNING 1`,
  });
  if (error) {
    console.log(`  link error: ${error.message}`);
    return 0;
  }
  const linked = Array.isArray(data) ? data.length : 0;
  console.log(`  linked: ${linked}`);
  return linked;
}

async function main() {
  const run = await logStart(db, 'import-vic-grants-awarded', 'VIC Grants Awarded Ingest');
  let totalFound = 0;
  let totalInserted = 0;
  const errors = [];

  try {
    console.log('=== VIC Grants Awarded Ingest ===');
    console.log(`  mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

    let files = [];
    if (fileArg) {
      files = [fileArg];
    } else if (existsSync(DATA_DIR)) {
      files = readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.csv'))
        .filter(f => !sourceArg || f.toLowerCase().startsWith(`${sourceArg}-`))
        .map(f => join(DATA_DIR, f));
    }

    if (!files.length) {
      console.log(`\n  No CSVs found in ${DATA_DIR}/ (or matching --source=${sourceArg || '*'}).`);
      console.log('  Drop CSVs named {source}-{fy}.csv into data/vic-grants-awarded/');
      console.log(`  Allowed sources: ${ALLOWED_SOURCES.join(', ')}`);
      await logComplete(db, run.id, { items_found: 0, items_new: 0, status: 'success' });
      return;
    }

    for (const f of files) {
      try {
        const r = await ingestFile(f, sourceArg, fyArg);
        totalFound += r.found;
        totalInserted += r.inserted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${f}: ${msg}`);
        console.error(`  error in ${f}: ${msg}`);
      }
    }

    if (!DRY_RUN && totalInserted > 0) {
      await linkAbns();
    }

    console.log(`\n=== Summary ===`);
    console.log(`  files: ${files.length} | rows found: ${totalFound} | inserted: ${totalInserted}`);

    await logComplete(db, run.id, {
      items_found: totalFound,
      items_new: totalInserted,
      status: errors.length ? 'partial' : 'success',
      errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Fatal:', msg);
    await logFailed(db, run.id, msg).catch(() => {});
    process.exit(1);
  }
}

main();
