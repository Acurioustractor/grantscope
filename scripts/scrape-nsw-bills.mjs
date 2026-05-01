#!/usr/bin/env node
/**
 * scrape-nsw-bills.mjs
 *
 * Scrapes NSW Parliament Bills register via Playwright.
 * Source: https://www.parliament.nsw.gov.au/bills/Pages/all-bills.aspx
 *
 * Strategy:
 *   The NSW page lists bills A-Z with a top-of-page filter for House of Origin.
 *   Bills appear as anchors with text "<Title> Bill <YEAR>". We harvest all
 *   matching anchors, then for each bill we fetch its detail page and pull
 *   sponsor + status from the structured fields.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-nsw-bills.mjs [--dry-run] [--limit=N] [--detail]
 *
 *   --detail enables per-bill detail-page fetch (sponsor + status). Slow but
 *   accurate. Without --detail, only bill_name + source_url are stored, which
 *   is enough for the dashboard summary cards.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-nsw-bills';
const AGENT_NAME = 'NSW Parliament Bills Register Scraper';
const JURISDICTION = 'NSW';
const LISTING_URL = 'https://www.parliament.nsw.gov.au/bills/Pages/all-bills.aspx';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const DETAIL = process.argv.includes('--detail');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');

const YJ_KEYWORDS = [
  'youth justice', 'adult crime', 'adult time', 'youth detention',
  'watchhouse', 'watch-house', 'breach of bail', 'bail act',
  'community safety', 'criminal code', 'sentencing',
  'young offender', 'child protection', 'human rights act',
  'children (criminal proceedings)', 'children criminal',
  'making nsw safer', 'crimes act', 'youth offender',
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

function cleanText(s) { return (s ?? '').replace(/\s+/g, ' ').trim(); }

async function getExistingUrls() {
  const { data } = await db.from('parliament_bills').select('source_url').eq('jurisdiction', JURISDICTION);
  return new Set((data ?? []).map(r => r.source_url));
}

async function scrapeListing(browser) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for the bill anchors to render
  await page.waitForSelector('a', { timeout: 10000 }).catch(() => {});
  await delay(3000);

  const links = await page.$$eval('a', as =>
    as.map(a => ({ href: a.href || '', text: a.textContent?.trim() || '' }))
      .filter(a => a.href.includes('parliament.nsw.gov.au') && /Bill\s+20[12][0-9]\b/i.test(a.text))
  );

  // Dedupe on URL
  const seen = new Map();
  for (const l of links) {
    if (!seen.has(l.href)) seen.set(l.href, l);
  }
  await ctx.close();
  return [...seen.values()];
}

async function fetchDetail(browser, url) {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 Chrome/121.0' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    // NSW bill detail page has structured fields like "Member with Carriage:" + "Status:"
    const meta = await page.evaluate(() => {
      const get = (label) => {
        const els = [...document.querySelectorAll('dt, label, strong, b, .field-label')];
        const m = els.find(el => (el.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()));
        if (!m) return null;
        // sibling next-element or contained text
        const next = m.nextElementSibling || m.parentElement?.querySelector('dd, .field-value');
        return (next?.textContent || '').trim();
      };
      return {
        sponsor: get('Member with Carriage') || get('Sponsor') || get('Introduced By') || null,
        status: get('Status') || get('Stage') || null,
        introduced: get('Introduced') || get('Date Introduced') || null,
      };
    });
    return meta;
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
    log('Fetching NSW listing...');
    const bills = await scrapeListing(browser);
    log(`  Extracted ${bills.length} unique bills`);

    const existing = await getExistingUrls();
    log(`${existing.size} NSW bills already in DB`);

    for (const b of bills.slice(0, LIMIT)) {
      const billName = cleanText(b.text);
      const cls = classifyBill(billName);
      if (cls.isYjRelevant) yjFlagged++;

      let sponsor = null, status = null;
      if (DETAIL) {
        const detail = await fetchDetail(browser, b.href);
        sponsor = detail?.sponsor ?? null;
        status = detail?.status ?? null;
        await delay(500);
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
        parliament_session: 'NSW Parliament — All Bills',
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
