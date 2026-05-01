#!/usr/bin/env node
/**
 * fetch-bill-explanatory-notes.mjs
 *
 * For YJ-relevant bills with an explanatory_note_url but no extracted text,
 * download the PDF and run `pdftotext` (poppler) to extract plain text. Stores
 * the result in parliament_bills.explanatory_note_text (truncated to ~200KB).
 *
 * Why poppler / pdftotext: zero npm deps, layout-aware, handles QLD parliament
 * PDFs (which use embedded fonts that some JS-only parsers choke on).
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-bill-explanatory-notes.mjs [--limit=N] [--all] [--refetch]
 *     --limit=N    process at most N bills (default 25)
 *     --all        include non-YJ bills too (default: YJ only)
 *     --refetch    re-fetch even bills that already have explanatory_note_text
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'fetch-bill-explanatory-notes';
const AGENT_NAME = 'Bill Explanatory Note PDF Fetcher';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '25', 10);
const YJ_ONLY = !process.argv.includes('--all');
const REFETCH = process.argv.includes('--refetch');
const MAX_TEXT_BYTES = 200_000;

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

async function selectBills() {
  // PostgREST: filter by jurisdiction QLD (only QLD has been scraped) + YJ flag
  // + has explanatory_note_url + (no text yet OR refetch).
  let q = db.from('parliament_bills')
    .select('id, bill_name, explanatory_note_url, explanatory_note_text')
    .not('explanatory_note_url', 'is', null)
    .order('introduced_date', { ascending: false, nullsFirst: false })
    .limit(LIMIT);
  if (YJ_ONLY) q = q.eq('is_yj_relevant', true);
  if (!REFETCH) q = q.is('explanatory_note_text', null);
  const { data, error } = await q;
  if (error) throw new Error(`select bills: ${error.message}`);
  return data ?? [];
}

async function downloadPdf(url, dir) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CivicGraph/1.0; +https://civicgraph.au)',
      Accept: 'application/pdf,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error(`response too small (${buf.length}b)`);
  const path = join(dir, 'doc.pdf');
  writeFileSync(path, buf);
  return { path, bytes: buf.length };
}

function pdfToText(pdfPath) {
  // -layout preserves columns/lists in QLD parliament docs. Output to stdout.
  const out = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], {
    maxBuffer: 32 * 1024 * 1024,
    encoding: 'utf8',
  });
  return out.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function processOne(bill) {
  const dir = mkdtempSync(join(tmpdir(), 'bill-'));
  try {
    const { path, bytes } = await downloadPdf(bill.explanatory_note_url, dir);
    const text = pdfToText(path);
    const truncated = text.length > MAX_TEXT_BYTES ? text.slice(0, MAX_TEXT_BYTES) + '\n\n[... truncated]' : text;
    const { error } = await db.from('parliament_bills').update({
      explanatory_note_text: truncated,
      explanatory_note_chars: text.length,
      explanatory_note_fetched_at: new Date().toISOString(),
    }).eq('id', bill.id);
    if (error) throw new Error(`update: ${error.message}`);
    log(`  ✓ ${bill.bill_name.slice(0, 60)} · ${bytes}b PDF → ${text.length} chars`);
    return { ok: true, chars: text.length };
  } catch (e) {
    log(`  ✗ ${bill.bill_name.slice(0, 60)}: ${e.message}`);
    return { ok: false, error: e.message };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  log(`Starting ${AGENT_NAME} (limit=${LIMIT}, yj_only=${YJ_ONLY}, refetch=${REFETCH})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  let ok = 0; let failed = 0;
  try {
    const bills = await selectBills();
    log(`${bills.length} bills to process`);
    for (let i = 0; i < bills.length; i++) {
      const r = await processOne(bills[i]);
      if (r.ok) ok++; else failed++;
      // Rate-limit: parliament PDF servers throttle bursts. 800ms between requests.
      if (i < bills.length - 1) await new Promise(res => setTimeout(res, 800));
    }
    log(`Done. extracted=${ok}, failed=${failed}`);
    await logComplete(db, run, { items_found: bills.length, items_new: ok });
  } catch (e) {
    log(`FATAL: ${e.message}`);
    await logFailed(db, run, e.message);
    process.exit(1);
  }
}

main();
