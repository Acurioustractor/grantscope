#!/usr/bin/env node
/**
 * scrape-vic-bills.mjs
 *
 * Scrapes Victorian Parliament bills via Playwright. Source listing lives at
 * legislation.vic.gov.au, not parliament.vic.gov.au — the parliament site
 * redirects to the legislation site for bill detail.
 *
 * Sources:
 *   https://www.legislation.vic.gov.au/bills/in-parliament   — currently before parliament
 *   https://www.legislation.vic.gov.au/bills                 — all bills (broader)
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-vic-bills.mjs [--dry-run] [--limit=N] [--detail]
 *     --detail enables per-bill page fetch for sponsor + status. Slower.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-vic-bills';
const AGENT_NAME = 'VIC Parliament Bills Register Scraper';
const JURISDICTION = 'VIC';

const PAGES = [
  { url: 'https://www.legislation.vic.gov.au/bills/in-parliament', session: 'In Parliament' },
];

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const DETAIL = process.argv.includes('--detail');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '300', 10);

const YJ_KEYWORDS = [
  'youth justice', 'children, youth and families', 'young offender',
  'bail', 'sentencing', 'crimes', 'criminal', 'corrections',
  'children and young persons', 'human rights and responsibilities',
  'community safety', 'victims', 'child protection',
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

function cleanText(s) { return (s ?? '').replace(/\s+/g, ' ').replace(/\s*Go To Page\s*$/i, '').trim(); }

async function getExistingUrls() {
  const { data } = await db.from('parliament_bills').select('source_url').eq('jurisdiction', JURISDICTION);
  return new Set((data ?? []).map(r => r.source_url));
}

async function scrapeListing(browser, pageDef) {
  log(`Scraping VIC ${pageDef.session}: ${pageDef.url}`);
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto(pageDef.url, { waitUntil: 'networkidle', timeout: 60000 });
  await delay(3000);

  // Bill anchors point to legislation.vic.gov.au/bills/<slug>. Filter strictly
  // to those (skip nav links, search, pagination).
  const links = await page.$$eval('a', as =>
    as.map(a => ({ href: a.href || '', text: a.textContent?.trim() || '' }))
      .filter(a => /legislation\.vic\.gov\.au\/bills\/[a-z0-9-]+\d{4}/i.test(a.href)
                && /Bill\s+20[12][0-9]/i.test(a.text)
                && a.text.length > 5)
  );
  await ctx.close();

  // Dedupe (the same bill often appears twice — top "currently before" plus letter list)
  const seen = new Map();
  for (const l of links) if (!seen.has(l.href)) seen.set(l.href, l);
  return [...seen.values()];
}

async function fetchDetail(browser, url) {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1500);
    return await page.evaluate(() => {
      const get = (label) => {
        const els = [...document.querySelectorAll('dt, th, strong, .field-label, .field__label')];
        const m = els.find(el => (el.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()));
        if (!m) return null;
        const next = m.nextElementSibling || m.parentElement?.querySelector('dd, td, .field-value, .field__item');
        return (next?.textContent || '').trim() || null;
      };
      return {
        sponsor: get('Member presenting') || get('Member') || get('Minister') || get('Sponsor'),
        status: get('Current status') || get('Status') || get('Stage'),
        introduced: get('Date of first reading') || get('Introduced'),
      };
    });
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
    const all = [];
    for (const p of PAGES) {
      const items = await scrapeListing(browser, p);
      log(`  ${items.length} bills from ${p.session}`);
      items.forEach(b => all.push({ ...b, parliament_session: p.session }));
    }
    log(`Total scraped: ${all.length}`);

    const existing = await getExistingUrls();
    log(`${existing.size} VIC bills already in DB`);

    for (const b of all.slice(0, LIMIT)) {
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
        parliament_session: b.parliament_session,
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
