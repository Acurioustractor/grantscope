#!/usr/bin/env node
/**
 * scrape-wa-bills.mjs
 *
 * Scrapes the WA Parliament Bills Progress register via Playwright. The page
 * lists every current bill alphabetically with progress columns for both
 * houses. Each bill links to a popup with sponsor + reading dates.
 *
 * Source:
 *   https://www.parliament.wa.gov.au/Parliament/Bills.nsf/screenBillsProgress
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-wa-bills.mjs [--dry-run] [--limit=N] [--detail]
 *     --detail enables per-bill popup fetch for sponsor + status. Slower.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-wa-bills';
const AGENT_NAME = 'WA Parliament Bills Progress Scraper';
const JURISDICTION = 'WA';
const LISTING_URL = 'https://www.parliament.wa.gov.au/Parliament/Bills.nsf/screenBillsProgress';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const DETAIL = process.argv.includes('--detail');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '300', 10);

const YJ_KEYWORDS = [
  'youth justice', 'young offenders', 'children and community services',
  'criminal code', 'sentencing', 'bail', 'corrections',
  'community safety', 'children', 'criminal investigation',
  'restraining orders', 'misuse of drugs', 'human rights',
  'post and boast', 'crimes',
];

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

function classifyBill(name) {
  const n = name.toLowerCase();
  const matched = YJ_KEYWORDS.filter(k => n.includes(k));
  return { isYjRelevant: matched.length > 0, topics: matched.slice(0, 8) };
}

function parseYear(billName) {
  const m = billName.match(/\b(20[12][0-9])\b/);
  return m ? parseInt(m[1], 10) : null;
}

function cleanText(s) { return (s ?? '').replace(/\s+/g, ' ').replace(/\s*Go\s*To\s*Page\s*$/i, '').trim(); }

async function getExistingUrls() {
  const { data } = await db.from('parliament_bills').select('source_url').eq('jurisdiction', JURISDICTION);
  return new Set((data ?? []).map(r => r.source_url));
}

async function scrapeListing(browser) {
  log(`Scraping WA bills progress: ${LISTING_URL}`);
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await delay(2500);

  // Each bill anchor points to BillProgressPopup with a ParentUNID query param.
  const links = await page.$$eval('a', as =>
    as.map(a => ({ href: a.href || '', text: a.textContent?.trim() || '' }))
      .filter(a => /BillProgressPopup/i.test(a.href) && /Bill\s+20[12][0-9]/i.test(a.text))
  );

  // Dedupe on href
  const seen = new Map();
  for (const l of links) if (!seen.has(l.href)) seen.set(l.href, l);
  await ctx.close();
  return [...seen.values()];
}

async function fetchDetail(browser, url) {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1200);
    // The popup is mostly a single table with rows like "Member in Charge: Hon X". Pull plain text.
    const body = await page.evaluate(() => document.body?.textContent || '');
    const sponsor = body.match(/Member\s+in\s+Charge[:\s]+([^\n]+?)(?:House|Last|Status|$)/i)?.[1]?.trim() || null;
    const status = body.match(/(?:Last\s+Action|Status)[:\s]+([^\n]+?)(?:Date|$)/i)?.[1]?.trim() || null;
    return { sponsor, status };
  } catch {
    return null;
  } finally {
    await ctx.close();
  }
}

async function main() {
  log(`Starting ${AGENT_NAME} (limit=${LIMIT}, dry_run=${DRY_RUN}, detail=${DETAIL})`);
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

  let inserted = 0, updated = 0, skipped = 0, yjFlagged = 0;
  try {
    const bills = await scrapeListing(browser);
    log(`  ${bills.length} unique bills`);

    const existing = await getExistingUrls();
    log(`${existing.size} WA bills already in DB`);

    for (const b of bills.slice(0, LIMIT)) {
      const billName = cleanText(b.text);
      const cls = classifyBill(billName);
      if (cls.isYjRelevant) yjFlagged++;

      let sponsor = null, status = null;
      if (DETAIL) {
        const d = await fetchDetail(browser, b.href);
        sponsor = d?.sponsor ?? null;
        status = d?.status ?? null;
        await delay(400);
      }

      const row = {
        jurisdiction: JURISDICTION,
        source_url: b.href,
        bill_name: billName,
        bill_year: parseYear(billName),
        sponsor,
        sponsor_party: null,
        introduced_date: null,
        status,
        status_date: null,
        parliament_session: 'Bills Progress',
        is_yj_relevant: cls.isYjRelevant,
        topics: cls.topics,
        updated_at: new Date().toISOString(),
      };

      if (DRY_RUN) {
        log(`  [DRY] ${cls.isYjRelevant ? '★' : ' '} ${billName.slice(0, 80)}`);
        inserted++;
        continue;
      }

      if (existing.has(b.href)) {
        const { error } = await db.from('parliament_bills').update(row)
          .eq('source_url', b.href).eq('jurisdiction', JURISDICTION);
        if (error) log(`  update failed: ${error.message}`);
        else updated++;
      } else {
        const { error } = await db.from('parliament_bills').insert(row);
        if (error) {
          if (!/duplicate/i.test(error.message)) log(`  insert failed: ${error.message}`);
          skipped++;
        } else {
          inserted++;
        }
      }
    }

    log(`Done. inserted=${inserted}, updated=${updated}, skipped=${skipped}, YJ-flagged=${yjFlagged}/${bills.length}`);
    await logComplete(db, run, { items_found: bills.length, items_new: inserted });
  } catch (e) {
    log(`FATAL: ${e.message}`);
    await logFailed(db, run, e.message);
  } finally {
    await browser.close();
  }
}

main();
