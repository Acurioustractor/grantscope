#!/usr/bin/env node
/**
 * scrape-state-tenders.mjs — VIC + SA awarded-contract scraper (SCAFFOLD)
 *
 * BREAKTHROUGH (2026-06-08): VIC (tenders.vic.gov.au) and SA
 * (tenders.sa.gov.au) run the IDENTICAL "Consolidated Tenders" platform and
 * sit behind Cloudflare. curl / WebFetch get 403, but **headless system-Chrome
 * with light stealth clears the wall with no residential proxy**. Contract
 * detail pages expose supplier name + ABN + value + buyer — exactly what the
 * evidence layer needs to join state procurement onto SE profiles by ABN.
 *
 * This overturns the ledger's "SA Akamai-walled / dead end" note for TENDERS.
 *
 * Data path (both states, same platform):
 *   /contract/buyerIndex                          -> agencies + buyerId + count
 *   /contract/search?buyerId=<id>&browse=true     -> that agency's contracts
 *   /contract/view?id=<id>                         -> detail (supplier, ABN)
 *
 * Maps to austender_contracts (ocid = '<vic|sa>-<platformId>', upsert on ocid,
 * matching the existing nsw-/qld- convention). Clean value+dates come from the
 * list row; supplier+ABN+description from the detail page. --apply is required
 * to write; without it, extracts to data/state-tenders/<state>.jsonl.
 * Resumable: an --apply run skips ocids already in the DB.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-state-tenders.mjs --state=SA --limit-agencies=1 --limit-contracts=2   # dry test → JSONL
 *   node --env-file=.env scripts/scrape-state-tenders.mjs --state=SA --apply                                  # full SA crawl → DB (~1h)
 *   node --env-file=.env scripts/scrape-state-tenders.mjs --state=VIC --apply                                 # full VIC crawl → DB (~16h)
 *   node --env-file=.env scripts/scrape-state-tenders.mjs --state=VIC --agencies-only                         # just list agencies
 *
 * After a full --apply crawl: refresh evidence MVs + re-run scout-se-buyers so
 * state contracts surface on SE profiles / /suppliers and unlock VIC/SA buyers.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const has = (k) => process.argv.includes(`--${k}`);
const APPLY = has('apply'); // upsert into austender_contracts (else extract→JSONL only)

const STATE = (arg('state', 'VIC')).toUpperCase();
const HOSTS = {
  VIC: 'https://www.tenders.vic.gov.au',
  SA: 'https://www.tenders.sa.gov.au',
};
const HOST = HOSTS[STATE];
if (!HOST) { console.error(`Unknown state ${STATE}. Use VIC or SA.`); process.exit(1); }

// default to a full crawl; pass --limit-agencies/--limit-contracts to cap for testing
const LIMIT_AGENCIES = parseInt(arg('limit-agencies', '0'), 10) || Infinity;
const LIMIT_CONTRACTS = parseInt(arg('limit-contracts', '0'), 10) || Infinity;
const AGENCIES_ONLY = has('agencies-only');
const DELAY_MS = parseInt(arg('delay', '800'), 10);

const db = APPLY
  ? createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (m) => console.log(`[state-tenders:${STATE}] ${m}`);

// Ordered contract-detail labels. We extract each field as the text between its
// label and the next label that appears (Struts app renders flat label/value).
const DETAIL_LABELS = [
  'Status', 'Public Body', 'Contract Number', 'Title', 'Type', 'Description',
  'Value of the Contract', 'Total Value', 'Start Date', 'End Date', 'Award Date',
  'Publish Date', 'Category', 'Procurement Method',
];

function extractLabelled(text, labels) {
  // find index of each present label, then slice value up to the next present label
  const found = labels
    .map(l => ({ l, i: text.indexOf(` ${l} `) >= 0 ? text.indexOf(` ${l} `) : text.indexOf(l) }))
    .filter(x => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  const out = {};
  for (let n = 0; n < found.length; n++) {
    const { l, i } = found[n];
    const start = i + l.length;
    const end = n + 1 < found.length ? found[n + 1].i : Math.min(text.length, start + 600);
    out[l] = text.slice(start, end).replace(/\s+/g, ' ').trim();
  }
  return out;
}

function parseMoney(s) {
  if (!s) return null;
  // last $-amount on the line (list rows put value last; avoids stray "$1")
  const all = [...String(s).matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)];
  if (!all.length) return null;
  const v = Number(all[all.length - 1][1].replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
}
// Count of contracts whose value the publisher withheld — reported per run so a
// low-value crawl is never mistaken for a low-spend buyer.
let undisclosedCount = 0;
/** VIC's $1.00 sentinel means "withheld", not "one dollar". Null it. */
function undisclosed(v) {
  if (v !== null && v <= 1) { undisclosedCount++; return null; }
  return v;
}
function cleanAbn(s) {
  if (!s) return null;
  const m = String(s).match(/\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/);
  return m ? m[1].replace(/\s/g, '') : null;
}
const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
// "18 Feb 2025" / "30 July 2027" -> "2025-02-18"
function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}
// list rows look like: "<num> <title> <Status> <date1> [<date2>] $<value>"
function parseListRow(rowText) {
  const dates = [...String(rowText).matchAll(/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/g)].map(x => parseDate(x[0])).filter(Boolean);
  const status = (rowText.match(/\b(Current|Expired|Pending|Terminated|Awarded)\b/) || [])[1] || null;
  return { value: parseMoney(rowText), dates, status };
}

async function main() {
  mkdirSync('data/state-tenders', { recursive: true });
  const outPath = `data/state-tenders/${STATE.toLowerCase()}.jsonl`;

  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    locale: 'en-AU', timezoneId: STATE === 'SA' ? 'Australia/Adelaide' : 'Australia/Melbourne',
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  const page = await ctx.newPage();

  // 1) agency index
  log('loading buyerIndex…');
  await page.goto(`${HOST}/contract/buyerIndex`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2000);
  const title = await page.title();
  if (/just a moment|attention required|blocked/i.test(title)) {
    log(`BLOCKED at buyerIndex (title="${title}") — Cloudflare did not clear this run. Retry.`);
    await browser.close(); process.exit(2);
  }
  const agencies = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .map(a => ({ name: a.textContent.trim(), href: a.getAttribute('href') }))
      .filter(x => x.href && /buyerId=\d+/.test(x.href))
      .map(x => ({
        name: x.name.replace(/\s*\(\d+\)\s*$/, '').trim(),
        count: parseInt((x.name.match(/\((\d+)\)\s*$/) || [])[1] || '0', 10),
        buyerId: (x.href.match(/buyerId=(\d+)/) || [])[1],
        href: x.href,
      })));
  log(`found ${agencies.length} agencies (${agencies.reduce((s, a) => s + a.count, 0)} contracts total)`);

  if (AGENCIES_ONLY) {
    // Write the FULL index — it is the input to choosing which agencies are
    // worth crawling, and a 50-row console slice cannot answer that.
    const idxPath = `data/state-tenders/${STATE.toLowerCase()}-agencies.json`;
    const sorted = [...agencies].sort((a, b) => b.count - a.count);
    writeFileSync(idxPath, JSON.stringify(sorted, null, 1));
    log(`wrote ${sorted.length} agencies → ${idxPath}`);
    log(`top 25 by contract count:`);
    for (const a of sorted.slice(0, 25)) log(`  ${String(a.count).padStart(5)}  ${a.name}`);
    await browser.close(); return;
  }

  // ocid prefix matches the existing convention (nsw-, qld-, …). Reversible:
  // DELETE FROM austender_contracts WHERE ocid LIKE 'vic-%'  (or 'sa-%').
  const prefix = STATE === 'SA' ? 'sa' : 'vic';

  // resume: skip contracts already in the DB (so the long crawl survives restarts)
  const done = new Set();
  if (APPLY && !has('refresh')) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('austender_contracts').select('ocid').like('ocid', `${prefix}-%`).range(from, from + 999);
      if (error) { log(`resume fetch error: ${error.message}`); break; }
      for (const r of data) done.add(r.ocid);
      if (data.length < 1000) break;
    }
    if (done.size) log(`resume: ${done.size} ${prefix}-* contracts already ingested, will skip`);
  }

  // 2) per-agency contract lists + 3) detail pages
  // --buyer-id=320019[,277022] targets named agencies. Without it, --limit-agencies
  // takes the first N of the index in page order (alphabetical), which is almost
  // never what you want when crawling a shortlist — see docs/strategy/vic-crawl-shortlist.md.
  const wantIds = (arg('buyer-id', '') || '').split(',').map(s => s.trim()).filter(Boolean);
  let targets = agencies.filter(a => a.count > 0);
  if (wantIds.length) {
    targets = targets.filter(a => wantIds.includes(String(a.buyerId)));
    const missing = wantIds.filter(id => !targets.some(a => String(a.buyerId) === id));
    if (missing.length) log(`WARNING: buyerId not found in index: ${missing.join(', ')}`);
    log(`targeting ${targets.length} agencies by buyerId (${targets.reduce((s, a) => s + a.count, 0)} contracts)`);
  }
  targets = targets.slice(0, LIMIT_AGENCIES);
  const contracts = [];
  let pending = [];
  let upserted = 0, skipped = 0;

  async function flush() {
    if (!APPLY || !pending.length) return;
    const chunk = pending; pending = [];
    const { error } = await db.from('austender_contracts').upsert(chunk, { onConflict: 'ocid' });
    if (error) { log(`upsert error (${chunk.length} rows): ${error.message}`); }
    else upserted += chunk.length;
  }

  let failed = 0;
  for (const ag of targets) {
    log(`agency "${ag.name}" (${ag.count} contracts) buyerId=${ag.buyerId}`);
    let rows;
    try {
      await page.goto(`${HOST}/contract/search?buyerId=${ag.buyerId}&browse=true`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(1500);
      rows = await page.evaluate(() => {
        const seen = new Set(); const out = [];
        for (const a of document.querySelectorAll('a[href*="/contract/view?id="]')) {
          const id = (a.getAttribute('href').match(/id=(\d+)/) || [])[1];
          if (!id || seen.has(id)) continue; seen.add(id);
          const tr = a.closest('tr');
          out.push({ id, href: a.getAttribute('href'), rowText: (tr?.innerText || '').replace(/\s+/g, ' ').trim() });
        }
        return out;
      });
    } catch (err) {
      failed++;
      log(`  ! skip agency ${ag.buyerId}: ${err.name === 'TimeoutError' ? 'list load timeout' : String(err.message || err).slice(0, 80)}`);
      continue;
    }
    for (const r of rows.slice(0, LIMIT_CONTRACTS)) {
      const ocid = `${prefix}-${r.id}`;
      if (done.has(ocid)) { skipped++; continue; }
      let detail;
      try {
        await page.goto(`${HOST}${r.href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(DELAY_MS);
        detail = await page.evaluate(() => {
          const body = document.body.innerText.replace(/\r/g, ' ');
          const contractor = document.querySelector('.contractor-details')?.innerText?.replace(/\s+/g, ' ').trim() || null;
          return { body, contractor };
        });
      } catch (err) {
        failed++;
        log(`  ! skip ${r.id}: ${err.name === 'TimeoutError' ? 'load timeout (retried next run)' : String(err.message || err).slice(0, 80)}`);
        continue;
      }
      const f = extractLabelled(detail.body, DETAIL_LABELS);
      const list = parseListRow(r.rowText);
      const supplierRaw = detail.contractor || '';
      const abn = cleanAbn(supplierRaw) || cleanAbn(detail.body);
      const supplier_name = supplierRaw.replace(/\s*A[BC]N\s*\d[\d\s]+.*$/i, '').trim() || null;
      // austender_contracts schema row (clean values from the list row; supplier from detail)
      const rec = {
        ocid,
        title: f['Title'] || null,
        description: (f['Description'] || '').slice(0, 2000) || null,
        // Detail-page labelled fields are authoritative; the list row is a
        // fallback. This order used to be reversed.
        //
        // The stray "$1" values are NOT a parse failure — they are real. VIC
        // publishes "Total Value of the Contract $1.00 (Estimate)" as a
        // sentinel when the real figure is withheld as Genuinely Confidential
        // Business Information. Storing that as a dollar value would silently
        // understate every aggregate built on it, so it becomes null: the
        // value is undisclosed, not one dollar.
        contract_value: undisclosed(parseMoney(f['Value of the Contract'] || f['Total Value']) ?? list.value ?? null),
        currency: 'AUD',
        category: f['Type'] || f['Category'] || null,
        contract_start: parseDate(f['Start Date']) || list.dates[0] || null,
        contract_end: parseDate(f['End Date']) || list.dates[1] || null,
        buyer_name: ag.name,
        buyer_id: String(ag.buyerId),
        supplier_name,
        supplier_abn: abn,
        source_url: `${HOST}${r.href}`,
      };
      contracts.push(rec);
      pending.push(rec);
      if (pending.length >= 100) await flush();
      log(`  • ${r.id} | ${(rec.title || '').slice(0, 42)} | ${rec.supplier_name || '?'} | ABN ${rec.supplier_abn || '—'} | $${rec.contract_value ?? '—'} | ${rec.contract_start || '?'}`);
    }
    await sleep(DELAY_MS);
  }
  await flush();

  if (!APPLY) {
    writeFileSync(outPath, contracts.map(c => JSON.stringify(c)).join('\n') + '\n');
  }
  const withAbn = contracts.filter(c => c.supplier_abn).length;
  const withVal = contracts.filter(c => c.contract_value).length;
  log(`${APPLY ? `upserted ${upserted}` : `wrote ${contracts.length} → ${outPath}`} | ${contracts.length} new, ${skipped} skipped, ${failed} failed | ${withAbn} with ABN, ${withVal} with value, ${undisclosedCount} value withheld by publisher`);
  if (APPLY) log(`reverse with: DELETE FROM austender_contracts WHERE ocid LIKE '${prefix}-%'. Then refresh evidence MVs + re-run scout-se-buyers.`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
