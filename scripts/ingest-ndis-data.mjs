#!/usr/bin/env node
/**
 * ingest-ndis-data.mjs
 *
 * Ingests NDIS public data from dataresearch.ndis.gov.au into CivicGraph.
 * Fills gaps not covered by existing scripts:
 *   - ndis_participants_lga — LGA-level participant counts
 *   - ndis_utilisation — plan utilisation rates (thin market evidence)
 *   - ndis_first_nations — First Nations participant data by remoteness
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-ndis-data.mjs [--download] [--dataset=lga|utilisation|first-nations|all]
 *
 * Data sources:
 *   - Participants by LGA: https://dataresearch.ndis.gov.au/media/4237/download?attachment
 *   - Utilisation: https://dataresearch.ndis.gov.au/media/4485/download?attachment
 *   - First Nations: https://dataresearch.ndis.gov.au/media/4227/download?attachment
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'ingest-ndis-data';
const AGENT_NAME = 'NDIS Data Ingest';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DOWNLOAD = process.argv.includes('--download');
const DATASET = (process.argv.find(a => a.startsWith('--dataset='))?.split('=')[1] || 'all').toLowerCase();
const DATA_DIR = 'data/ndis';
const BATCH_SIZE = 500;

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── CSV URLs ──────────────────────────────────────────

const DATASETS = {
  lga: {
    url: 'https://dataresearch.ndis.gov.au/media/4237/download?attachment',
    file: `${DATA_DIR}/participants-by-lga-dec2025.csv`,
    table: 'ndis_participants_lga',
  },
  utilisation: {
    url: 'https://dataresearch.ndis.gov.au/media/4485/download?attachment',
    file: `${DATA_DIR}/utilisation-dec2025.csv`,
    table: 'ndis_utilisation',
  },
  'first-nations': {
    url: 'https://dataresearch.ndis.gov.au/media/4227/download?attachment',
    file: `${DATA_DIR}/first-nations-dec2025.csv`,
    table: 'ndis_first_nations',
  },
};

// ── CSV Parser (handles quoted fields with commas) ────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || null; });
    return row;
  });
}

// ── Date parser (31DEC2025 → 2025-12-31) ──────────────

function parseDateStr(s) {
  if (!s) return null;
  const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
                   JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
  const day = s.slice(0, 2);
  const mon = months[s.slice(2, 5)];
  const year = s.slice(5);
  if (!mon || !year) return null;
  return `${year}-${mon}-${day}`;
}

function quarterFromDate(dateStr) {
  // 2025-12-31 → 2025-Q4
  if (!dateStr) return null;
  const month = parseInt(dateStr.slice(5, 7));
  const q = Math.ceil(month / 3);
  return `${dateStr.slice(0, 4)}-Q${q}`;
}

// ── Number parser (handles "117,000.00", "<11", percentages) ──

function parseNum(s) {
  if (!s || s.startsWith('<')) return null;
  return parseFloat(s.replace(/,/g, ''));
}

function parsePct(s) {
  if (!s || s === 'n/a') return null;
  return parseFloat(s.replace('%', ''));
}

function parseInt2(s) {
  if (!s || s.startsWith('<')) return null;
  return parseInt(s.replace(/,/g, ''), 10);
}

// ── Download ──────────────────────────────────────────

async function downloadFile(url, dest) {
  log(`  Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  log(`  Saved ${dest} (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── Batch upsert helper ──────────────────────────────

async function batchInsert(table, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await db.from(table).insert(batch);
    if (error) {
      log(`  ERROR batch ${i}-${i + batch.length}: ${error.message}`);
      // Try one-by-one for this batch
      for (const row of batch) {
        const { error: e2 } = await db.from(table).insert(row);
        if (!e2) inserted++;
      }
    } else {
      inserted += batch.length;
    }
    if ((i + BATCH_SIZE) % 2000 === 0) {
      log(`  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
    }
  }
  return inserted;
}

// ── Dataset: Participants by LGA ─────────────────────

async function ingestLGA() {
  const ds = DATASETS.lga;
  if (!existsSync(ds.file)) {
    if (!DOWNLOAD) { log(`  File not found: ${ds.file} — use --download`); return 0; }
    await downloadFile(ds.url, ds.file);
  }

  log('Parsing participants by LGA...');
  const raw = readFileSync(ds.file, 'utf-8');
  const csvRows = parseCSV(raw);
  log(`  CSV rows: ${csvRows.length}`);

  // Transform
  const rows = csvRows
    .filter(r => r.ReportDt && r.StateCd)
    .map(r => {
      const qd = parseDateStr(r.ReportDt);
      return {
        lga_name: r.LGANm2020 || null,
        state: r.StateCd,
        service_district: r.RsdsInSrvcDstrctNm || null,
        participant_count: parseInt2(r.PrtcpntCnt),
        reporting_period: quarterFromDate(qd),
        quarter_date: qd,
      };
    })
    .filter(r => r.quarter_date && r.participant_count !== null);

  log(`  Valid rows: ${rows.length}`);

  // Clear existing data and insert
  const { error: delErr } = await db.from(ds.table).delete().gte('id', 0);
  if (delErr) log(`  Warning: could not clear table: ${delErr.message}`);

  const inserted = await batchInsert(ds.table, rows);
  log(`  Inserted ${inserted} rows into ${ds.table}`);
  return inserted;
}

// ── Dataset: Utilisation ─────────────────────────────

async function ingestUtilisation() {
  const ds = DATASETS.utilisation;
  if (!existsSync(ds.file)) {
    if (!DOWNLOAD) { log(`  File not found: ${ds.file} — use --download`); return 0; }
    await downloadFile(ds.url, ds.file);
  }

  log('Parsing utilisation data...');
  const raw = readFileSync(ds.file, 'utf-8');
  const csvRows = parseCSV(raw);
  log(`  CSV rows: ${csvRows.length}`);

  // CSV columns: RprtDt,StateCd,SrvcDstrctNm,DsbltyGrpNm,AgeBnd,SILorSDA,suppclass,Utlstn
  const rows = csvRows
    .filter(r => r.RprtDt && r.StateCd)
    .map(r => {
      const qd = parseDateStr(r.RprtDt);
      return {
        service_district: r.SrvcDstrctNm || null,
        state: r.StateCd,
        age_group: r.AgeBnd || null,
        disability_type: r.DsbltyGrpNm || null,
        support_class: r.suppclass || null,
        utilisation_rate: parsePct(r.Utlstn),
        reporting_period: quarterFromDate(qd),
        quarter_date: qd,
      };
    })
    .filter(r => r.quarter_date && r.utilisation_rate !== null);

  log(`  Valid rows: ${rows.length}`);

  const { error: delErr } = await db.from(ds.table).delete().gte('id', 0);
  if (delErr) log(`  Warning: could not clear table: ${delErr.message}`);

  const inserted = await batchInsert(ds.table, rows);
  log(`  Inserted ${inserted} rows into ${ds.table}`);
  return inserted;
}

// ── Dataset: First Nations ───────────────────────────

async function ingestFirstNations() {
  const ds = DATASETS['first-nations'];
  if (!existsSync(ds.file)) {
    if (!DOWNLOAD) { log(`  File not found: ${ds.file} — use --download`); return 0; }
    await downloadFile(ds.url, ds.file);
  }

  log('Parsing First Nations data...');
  const raw = readFileSync(ds.file, 'utf-8');
  const csvRows = parseCSV(raw);
  log(`  CSV rows: ${csvRows.length}`);

  // CSV columns: RprtDt,StateCd,MMMCd,AvgAnlsdCmtdSuppBdgt,PrtcpntCnt
  // MMMCd = Modified Monash Model (remoteness classification)
  const mmmLabels = {
    'MMM1': 'Major Cities',
    'MMM2': 'Inner Regional',
    'MMM3': 'Outer Regional',
    'MMM4': 'Remote',
    'MMM5': 'Very Remote',
    'MMM6': 'Very Remote',
    'MMM7': 'Very Remote',
    'ALL': 'All',
    'MMM': 'Unknown MMM',
  };

  const rows = csvRows
    .filter(r => r.RprtDt && r.StateCd)
    .map(r => {
      const qd = parseDateStr(r.RprtDt);
      return {
        state: r.StateCd,
        remoteness: mmmLabels[r.MMMCd] || r.MMMCd || null,
        participant_count: parseInt2(r.PrtcpntCnt),
        avg_annualised_support: parseNum(r.AvgAnlsdCmtdSuppBdgt),
        reporting_period: quarterFromDate(qd),
        quarter_date: qd,
      };
    })
    .filter(r => r.quarter_date);

  log(`  Valid rows: ${rows.length}`);

  const { error: delErr } = await db.from(ds.table).delete().gte('id', 0);
  if (delErr) log(`  Warning: could not clear table: ${delErr.message}`);

  const inserted = await batchInsert(ds.table, rows);
  log(`  Inserted ${inserted} rows into ${ds.table}`);
  return inserted;
}

// ── Main ─────────────────────────────────────────────

async function main() {
  const runId = await logStart(db, AGENT_ID, AGENT_NAME);

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // Download phase
  if (DOWNLOAD) {
    log('=== DOWNLOAD PHASE ===');
    const toDownload = DATASET === 'all'
      ? Object.values(DATASETS)
      : DATASETS[DATASET] ? [DATASETS[DATASET]] : [];

    for (const ds of toDownload) {
      try {
        await downloadFile(ds.url, ds.file);
      } catch (e) {
        log(`  WARN: ${e.message}`);
      }
    }
  }

  // Ingest phase
  log('=== INGEST PHASE ===');
  let totalInserted = 0;

  try {
    if (DATASET === 'all' || DATASET === 'lga') {
      totalInserted += await ingestLGA();
    }
    if (DATASET === 'all' || DATASET === 'utilisation') {
      totalInserted += await ingestUtilisation();
    }
    if (DATASET === 'all' || DATASET === 'first-nations') {
      totalInserted += await ingestFirstNations();
    }

    log(`\n=== COMPLETE: ${totalInserted} total rows inserted ===`);
    await logComplete(db, runId, { items_found: totalInserted, items_new: totalInserted });
  } catch (e) {
    log(`FATAL: ${e.message}`);
    await logFailed(db, runId, e.message);
    process.exit(1);
  }
}

main();
