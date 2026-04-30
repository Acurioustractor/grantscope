#!/usr/bin/env node
/**
 * One-off: replace the wrong "annual reports" we have for FECCA + ECCV
 * (election platforms, magazines, application forms, landing pages) with
 * the actual annual report PDFs. Downloads via pdftotext and writes to the
 * existing cache filenames so the enricher will pick them up on next run.
 *
 *   node --env-file=.env scripts/fix-fecca-eccv-real-reports.mjs
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const FECCA_ABN = '23684792947';
const ECCV_ABN = '65071572705';

// Real annual report URLs found via Firecrawl Search.
// Year values map to the FY-ending year already in charity_impact_reports
// (year=2024 means "FY 2023-24"). Existing rows we're fixing:
//   FECCA: 2025, 2024, 2023, 2021  (only 2024 has a real annual report we found)
//   ECCV:  2024, 2023, 2021        (we have 2023-24, 2022-23, 2021-22 PDFs)
const REPORTS = [
  // ECCV — replace each existing wrong row with the closest real annual report
  { abn: ECCV_ABN, year: 2024, url: 'https://eccv.org.au/wp-content/uploads/2024/12/Annual-Report-2023-24.pdf', label: 'ECCV Annual Report 2023-24' },
  { abn: ECCV_ABN, year: 2023, url: 'https://eccv.org.au/wp-content/uploads/2023/12/ECCV-Annual-Report-2022-23.pdf', label: 'ECCV Annual Report 2022-23' },
  { abn: ECCV_ABN, year: 2021, url: 'https://eccv.org.au/wp-content/uploads/2022/12/Annual-Report-2021-22.pdf', label: 'ECCV Annual Report 2021-22' },
  // FECCA — only the 2023-24 has been published as a clearly-labelled annual
  // report. Combine the main report PDF with the audited financials supplement.
  { abn: FECCA_ABN, year: 2024, url: 'https://fecca.org.au/wp-content/uploads/2024/11/2023-24-FECCA-Annual-Report.pdf', label: 'FECCA Annual Report 2023-24' },
  { abn: FECCA_ABN, year: 2024, url: 'https://fecca.org.au/wp-content/uploads/2024/11/FECCA-Audited-2023_2024-Financial-Statements.pdf', label: 'FECCA Audited Financials 2023-24' },
];

const CACHE_DIR = 'data/charity-annual-reports';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function pdftotextDownload(url) {
  const tmp = join(tmpdir(), `realreport-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`);
  console.log(`  fetching ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 CivicGraphBot' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`    fetched ${(buf.length / 1024).toFixed(0)} KB`);
  writeFileSync(tmp, buf);
  const text = execSync(`pdftotext -layout -nopgbrk "${tmp}" -`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  try { execSync(`rm -f "${tmp}"`); } catch {}
  console.log(`    extracted ${(text.length / 1024).toFixed(0)} KB of text`);
  return text;
}

async function main() {
  // Group by (abn, year) — append-mode for the FECCA financials supplement
  const grouped = new Map();
  for (const r of REPORTS) {
    const k = `${r.abn}-${r.year}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(r);
  }

  for (const [key, parts] of grouped) {
    console.log(`\n==== ${key} ====`);
    let combined = '';
    let firstUrl = null;
    for (const p of parts) {
      try {
        const text = await pdftotextDownload(p.url);
        combined += `\n\n# === ${p.label} ===\n\n${text}`;
        if (!firstUrl) firstUrl = p.url;
      } catch (err) {
        console.log(`  ✗ ${p.label}: ${err.message}`);
      }
    }
    if (!combined) continue;
    const cachePath = join(CACHE_DIR, `${key}.md`);
    writeFileSync(cachePath, combined.trim());
    console.log(`  wrote cache → ${cachePath} (${(combined.length / 1024).toFixed(0)} KB)`);

    const [abn, year] = key.split('-');
    const { error } = await db.from('charity_impact_reports')
      .update({ source_url: firstUrl, source_type: 'website_pdf', extracted_text_chars: combined.length })
      .eq('abn', abn).eq('report_year', Number(year));
    if (error) console.log(`  ✗ DB update failed: ${error.message}`);
    else console.log(`  ✓ updated DB row(s)`);
  }
  console.log('\nDone. Now run: node --env-file=.env scripts/enrich-annual-reports-llm.mjs --abn=23684792947 --apply');
  console.log('Then:        node --env-file=.env scripts/enrich-annual-reports-llm.mjs --abn=65071572705 --apply');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
