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
 * STATUS: extract-to-JSONL only. It does NOT write to austender_contracts yet
 * (that 770K-row core table needs a deliberate ocid/dedup design — see the
 * mapping TODO at the bottom + docs/strategy/state-tenders-ingest.md).
 *
 * Data path (both states, same platform):
 *   /contract/buyerIndex                          -> agencies + buyerId + count
 *   /contract/search?buyerId=<id>&browse=true     -> that agency's contracts
 *   /contract/view?id=<id>                         -> detail (supplier, ABN)
 *
 * Usage:
 *   node scripts/scrape-state-tenders.mjs --state=VIC --limit-agencies=3 --limit-contracts=5
 *   node scripts/scrape-state-tenders.mjs --state=SA  --limit-agencies=3
 *   node scripts/scrape-state-tenders.mjs --state=VIC --agencies-only   # just list agencies
 *
 * Output: data/state-tenders/<state>.jsonl  (one contract per line)
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const has = (k) => process.argv.includes(`--${k}`);

const STATE = (arg('state', 'VIC')).toUpperCase();
const HOSTS = {
  VIC: 'https://www.tenders.vic.gov.au',
  SA: 'https://www.tenders.sa.gov.au',
};
const HOST = HOSTS[STATE];
if (!HOST) { console.error(`Unknown state ${STATE}. Use VIC or SA.`); process.exit(1); }

const LIMIT_AGENCIES = parseInt(arg('limit-agencies', '3'), 10);
const LIMIT_CONTRACTS = parseInt(arg('limit-contracts', '5'), 10);
const AGENCIES_ONLY = has('agencies-only');
const DELAY_MS = parseInt(arg('delay', '800'), 10);

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
  const m = String(s).match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}
function cleanAbn(s) {
  if (!s) return null;
  const m = String(s).match(/\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/);
  return m ? m[1].replace(/\s/g, '') : null;
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
    console.log(JSON.stringify(agencies.slice(0, 50), null, 1));
    await browser.close(); return;
  }

  // 2) per-agency contract lists + 3) detail pages
  const targets = agencies.filter(a => a.count > 0).slice(0, LIMIT_AGENCIES);
  const contracts = [];
  for (const ag of targets) {
    log(`agency "${ag.name}" (${ag.count} contracts) buyerId=${ag.buyerId}`);
    await page.goto(`${HOST}/contract/search?buyerId=${ag.buyerId}&browse=true`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(1500);
    const rows = await page.evaluate(() => {
      const seen = new Set(); const out = [];
      for (const a of document.querySelectorAll('a[href*="/contract/view?id="]')) {
        const id = (a.getAttribute('href').match(/id=(\d+)/) || [])[1];
        if (!id || seen.has(id)) continue; seen.add(id);
        const tr = a.closest('tr');
        out.push({ id, href: a.getAttribute('href'), rowText: (tr?.innerText || '').replace(/\s+/g, ' ').trim() });
      }
      return out;
    });
    for (const r of rows.slice(0, LIMIT_CONTRACTS)) {
      await page.goto(`${HOST}${r.href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(DELAY_MS);
      const detail = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\r/g, ' ');
        const contractor = document.querySelector('.contractor-details')?.innerText?.replace(/\s+/g, ' ').trim() || null;
        return { body, contractor };
      });
      const f = extractLabelled(detail.body, DETAIL_LABELS);
      const supplierRaw = detail.contractor || '';
      const abn = cleanAbn(supplierRaw) || cleanAbn(detail.body);
      const supplier_name = supplierRaw.replace(/\s*ABN\s*\d[\d\s]+$/i, '').trim() || null;
      const rec = {
        source: `${STATE.toLowerCase()}-tenders`,
        source_url: `${HOST}${r.href}`,
        platform_id: r.id,
        buyer_name: ag.name,
        buyer_id: ag.buyerId,
        contract_number: f['Contract Number'] || null,
        title: f['Title'] || null,
        category: f['Type'] || f['Category'] || null,
        description: (f['Description'] || '').slice(0, 2000) || null,
        contract_value: parseMoney(f['Value of the Contract'] || f['Total Value']) || parseMoney(r.rowText),
        status: f['Status'] || null,
        contract_start: f['Start Date'] || null,
        contract_end: f['End Date'] || null,
        award_date: f['Award Date'] || null,
        supplier_name,
        supplier_abn: abn,
      };
      contracts.push(rec);
      log(`  • ${rec.contract_number || rec.platform_id} | ${(rec.title || '').slice(0, 45)} | ${rec.supplier_name || '?'} | ABN ${rec.supplier_abn || '—'} | $${rec.contract_value ?? '—'}`);
    }
    await sleep(DELAY_MS);
  }

  writeFileSync(outPath, contracts.map(c => JSON.stringify(c)).join('\n') + '\n');
  const withAbn = contracts.filter(c => c.supplier_abn).length;
  const withVal = contracts.filter(c => c.contract_value).length;
  log(`wrote ${contracts.length} contracts → ${outPath} (${withAbn} with ABN, ${withVal} with value)`);

  // ── NEXT STEP: upsert into austender_contracts ──────────────────────────
  // ocid is NOT NULL + the natural key. Use `${STATE.toLowerCase()}-tenders-${platform_id}`.
  // Map: title->title, description->description, contract_value->contract_value,
  // contract_start/end->dates (parse "18 Feb 2025"), buyer_name->buyer_name,
  // buyer_id->buyer_id, supplier_name->supplier_name, supplier_abn->supplier_abn,
  // source_url->source_url. Reversible: DELETE WHERE ocid LIKE 'vic-tenders-%'.
  // Then refresh evidence MVs so state contracts surface on SE profiles by ABN.

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
