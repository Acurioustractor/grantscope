#!/usr/bin/env node
/**
 * scrape-qld-bills.mjs
 *
 * Scrapes the QLD Parliament bills register via Playwright (the page is
 * JS-rendered). Inserts/updates rows in qld_bills.
 *
 * Sources:
 *   - https://www.parliament.qld.gov.au/Work-of-the-Assembly/Bills-and-Legislation/Bills-this-Parliament
 *   - https://www.parliament.qld.gov.au/Work-of-the-Assembly/Bills-and-Legislation/Bills-before-the-House
 *
 * YJ-relevance: a bill is flagged is_yj_relevant=true if its name matches
 * youth justice / adult crime / bail / sentencing / criminal code / community
 * safety / making queensland safer / breach of bail / etc.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qld-bills.mjs [--dry-run] [--limit=N]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-qld-bills';
const AGENT_NAME = 'QLD Parliament Bills Register Scraper';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');

const PAGES = [
  { url: 'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Bills-and-Legislation/Bills-this-Parliament', session: 'Bills this Parliament' },
  { url: 'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Bills-and-Legislation/Bills-before-the-House', session: 'Bills before the House' },
];

const YJ_KEYWORDS = [
  'youth justice', 'adult crime', 'adult time', 'youth detention',
  'watchhouse', 'watch-house', 'breach of bail', 'making queensland safer',
  'community safety', 'criminal code', 'sentencing',
  'young offender', 'child protection', 'human rights act',
  'bail act', 'castle law', 'youth offender',
];

const PARTY_HINTS = {
  // Best-effort party inference from sponsor name patterns. The QLD bills page
  // doesn't include party in the listing, so we infer from known minister-to-
  // party mappings and known opposition figures. Fallback to null.
  'crisafulli': 'LNP', 'frecklington': 'LNP', 'bleijie': 'LNP', 'last': 'LNP',
  'gerber': 'LNP', 'purdie': 'LNP', 'nicholls': 'LNP', 'powell': 'LNP',
  'langbroek': 'LNP', 'mander': 'LNP', "o'connor": 'LNP', 'minnikin': 'LNP',
  'simpson': 'LNP', 'stuckey': 'LNP', 'janetzki': 'LNP', 'molhoek': 'LNP',
  'miles': 'ALP', 'palaszczuk': 'ALP', 'fentiman': 'ALP', 'farmer': 'ALP',
  'crawford': 'ALP', 'ryan': 'ALP', 'enoch': 'ALP', 'pegg': 'ALP',
  'dick': 'ALP', "d'ath": 'ALP', 'butcher': 'ALP', 'grace': 'ALP',
  'katter': 'KAP', 'dametto': 'KAP', 'knuth': 'KAP',
  'berkman': 'GRN', 'macmahon': 'GRN', "o'sullivan": 'GRN',
  'scanlon': 'ALP',
};

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

function inferParty(sponsor) {
  if (!sponsor) return null;
  const s = sponsor.toLowerCase();
  for (const [name, party] of Object.entries(PARTY_HINTS)) {
    if (s.includes(name)) return party;
  }
  return null;
}

function classifyBill(name) {
  const n = name.toLowerCase();
  const matched = YJ_KEYWORDS.filter(k => n.includes(k));
  return { isYjRelevant: matched.length > 0, topics: matched.slice(0, 8) };
}

function parseDate(s) {
  if (!s) return null;
  // Handle "(22/4/2026)" or "22/4/2026" or "Hon X MP (22/4/2026)"
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function parseYear(billName) {
  const m = billName.match(/\b(20[12][0-9])\b/);
  return m ? parseInt(m[1], 10) : null;
}

function cleanText(s) {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

async function scrapePage(browser, pageDef) {
  log(`Scraping ${pageDef.session}: ${pageDef.url}`);
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  await page.goto(pageDef.url, { waitUntil: 'networkidle', timeout: 60000 });
  await delay(3000);

  // Each row = one bill. The QLD bills table layout:
  //   c0: bill name (often with trailing "*")
  //   c3: sponsor "Hon X MP (DD/MM/YYYY)"
  //   c4: status "Referred to Committee (DD/MM/YYYY)" / "Assented" / etc.
  //   links: "Bill" / "Exp Note" / "Statement of Compatibility" — all share
  //          the same /bills/YYYY/NNNN/ URL stem, so any link.href works.
  const bills = await page.$$eval('table tbody tr', trs =>
    trs.map(tr => {
      const cells = [...tr.querySelectorAll('td')].map(td => td.textContent?.trim() || '');
      const links = [...tr.querySelectorAll('a')].map(a => ({ href: a.href, text: a.textContent?.trim() || '' }));
      return { cells, links };
    }).filter(r => r.cells.some(c => /Bill\s+20[12][0-9]/i.test(c)))
  );

  log(`  Extracted ${bills.length} bill rows`);
  await ctx.close();

  return bills.map(b => {
    // Bill name = first cell containing "Bill YYYY"
    const rawName = b.cells.find(c => /Bill\s+20[12][0-9]/i.test(c)) || '';
    const billName = cleanText(rawName.replace(/\s*\*\s*$/, '')); // strip trailing "*"

    // Source URL — first link href (Bill / Exp Note / Statement of Compatibility all same stem)
    const sourceUrl = b.links[0]?.href || null;

    // Sponsor cell = first cell with "MP" and a (DD/MM/YYYY) date
    const sponsorCell = b.cells.find(c => /\bMP\b/.test(c) && /\d{1,2}\/\d{1,2}\/\d{4}/.test(c)) || '';
    const sponsorMatch = sponsorCell.match(/^(.+?)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\)/);
    const sponsor = cleanText(sponsorMatch?.[1]) || cleanText(sponsorCell.split('(')[0]) || null;
    const introducedDate = parseDate(sponsorMatch?.[2]);

    // Status cell = the LAST cell with "(date)" that's NOT the sponsor cell.
    const statusCells = b.cells.filter(c => /\(\d{1,2}\/\d{1,2}\/\d{4}\)/.test(c) && c !== sponsorCell);
    const statusCell = statusCells[statusCells.length - 1] || '';
    const statusMatch = statusCell.match(/^(.+?)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\)/);
    const status = cleanText(statusMatch?.[1]) || null;
    const statusDate = parseDate(statusMatch?.[2]);

    return { billName, sourceUrl, sponsor, introducedDate, status, statusDate };
  }).filter(b => b.billName && b.sourceUrl);
}

async function getExistingUrls() {
  const { data } = await db.from('qld_bills').select('source_url');
  return new Set((data ?? []).map(r => r.source_url));
}

async function main() {
  log(`Starting ${AGENT_NAME} (limit=${LIMIT}, dry_run=${DRY_RUN})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  let pw, browser;
  try {
    pw = await import('playwright');
    browser = await pw.chromium.launch({ headless: true });
  } catch (e) {
    log(`FATAL: Playwright not installed: ${e.message}`);
    await logFailed(db, run, 'Playwright not installed');
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let yjFlagged = 0;

  try {
    const all = [];
    for (const p of PAGES) {
      const bills = await scrapePage(browser, p);
      bills.forEach(b => all.push({ ...b, parliament_session: p.session }));
    }
    log(`Total scraped: ${all.length}`);

    const existing = await getExistingUrls();
    log(`${existing.size} existing rows`);

    for (const b of all.slice(0, LIMIT)) {
      const cls = classifyBill(b.billName);
      if (cls.isYjRelevant) yjFlagged++;
      const row = {
        source_url: b.sourceUrl,
        bill_name: b.billName,
        bill_year: parseYear(b.billName),
        sponsor: b.sponsor,
        sponsor_party: inferParty(b.sponsor),
        introduced_date: b.introducedDate,
        status: b.status,
        status_date: b.statusDate,
        parliament_session: b.parliament_session,
        is_yj_relevant: cls.isYjRelevant,
        topics: cls.topics,
        updated_at: new Date().toISOString(),
      };

      if (DRY_RUN) {
        log(`  [DRY] ${cls.isYjRelevant ? '★' : ' '} ${b.billName.slice(0, 70)} · ${b.sponsor ?? '?'} · ${b.status ?? '?'}`);
        inserted++;
        continue;
      }

      if (existing.has(b.sourceUrl)) {
        const { error } = await db.from('qld_bills')
          .update(row)
          .eq('source_url', b.sourceUrl);
        if (error) log(`  update failed: ${error.message}`);
        else updated++;
      } else {
        const { error } = await db.from('qld_bills').insert(row);
        if (error) {
          if (!/duplicate/i.test(error.message)) log(`  insert failed: ${error.message}`);
          skipped++;
        } else {
          inserted++;
        }
      }
    }

    log(`Done. inserted=${inserted}, updated=${updated}, skipped=${skipped}, YJ-flagged=${yjFlagged}/${all.length}`);
    await logComplete(db, run, { items_found: all.length, items_new: inserted });
  } catch (e) {
    log(`FATAL: ${e.message}`);
    await logFailed(db, run, e.message);
  } finally {
    await browser.close();
  }
}

main();
