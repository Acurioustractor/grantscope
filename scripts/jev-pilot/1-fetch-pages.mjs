#!/usr/bin/env node
/**
 * 1-fetch-pages.mjs — build the replay corpus the JEV pilot needs.
 *
 * WHY THIS STAGE EXISTS: data/grant-eligibility-cache.jsonl stores VERDICTS ONLY
 * (id, name, the five flags, eligible_summary, confidence, provider). It does not
 * store the page text the verdict was made from, nor the url. So a like-for-like
 * replay cannot reuse the cache alone — the source text has to be fetched again.
 * That is the single biggest setup cost of this pilot, and the reason it is its
 * own stage: fetch once, then run JEV as many times as you like for free.
 *
 * Fidelity matters here. This reuses enrich-grant-eligibility.mjs's browser
 * config and its exact DOM extraction (strip nav/header/footer/script/style,
 * prefer main/article, fall back to body when main is thin). If the extraction
 * drifts, the comparison measures the scraper, not the model.
 *
 * Polite by default: 1.2s between pages, and --limit caps the run. These are
 * third-party funder and government pages we have already fetched once.
 *
 * Usage:
 *   node --env-file=.env scripts/jev-pilot/1-fetch-pages.mjs --limit=40
 *   node --env-file=.env scripts/jev-pilot/1-fetch-pages.mjs --limit=400   # all 337
 *
 * Writes data/jev-pilot/pages.jsonl (append-only, resumable — reruns skip ids
 * already present, so an interrupted run costs nothing to resume).
 */

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const LIMIT = parseInt(arg('limit', '40'), 10);
const CACHE_PATH = 'data/grant-eligibility-cache.jsonl';
const OUT_PATH = 'data/jev-pilot/pages.jsonl';

const log = (m) => console.log(`[jev-pilot:fetch] ${m}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
);

function readJsonl(path) {
  if (!fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

// Identical to fetchPageText() in scripts/enrich-grant-eligibility.mjs — do not
// "improve" this independently, or the replay stops being like-for-like.
async function fetchPageText(ctx, url) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await sleep(1500);
    const title = await page.title();
    if (/just a moment|attention required|access denied/i.test(title)) return { text: '', blocked: true };
    const text = await page.evaluate(() => {
      for (const sel of ['nav', 'header', 'footer', 'script', 'style', '[role=navigation]']) document.querySelectorAll(sel).forEach(e => e.remove());
      const main = document.querySelector('main, [role=main], #content, .content, article');
      const mainText = (main?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      const bodyText = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      return mainText.length >= 400 ? mainText : bodyText;
    });
    return { text, blocked: false };
  } catch (e) { return { text: '', blocked: false, error: String(e.message).slice(0, 80) }; }
  finally { await page.close(); }
}

async function main() {
  fs.mkdirSync('data/jev-pilot', { recursive: true });

  const cached = readJsonl(CACHE_PATH);
  const done = new Set(readJsonl(OUT_PATH).map(r => r.id));
  log(`${cached.length} cached verdicts; ${done.size} pages already fetched`);

  const wanted = cached.filter(r => !done.has(r.id)).slice(0, LIMIT);
  if (!wanted.length) { log('nothing to fetch — corpus is complete for this limit'); return; }

  // The cache has no url, so join back to the DB by id, in chunks (PostgREST
  // chokes on very long .in() lists).
  const urls = new Map();
  for (let i = 0; i < wanted.length; i += 100) {
    const ids = wanted.slice(i, i + 100).map(r => r.id);
    const { data, error } = await supabase
      .from('grant_opportunities')
      .select('id, name, provider, url')
      .in('id', ids);
    if (error) { console.error(error); process.exit(1); }
    for (const g of data || []) urls.set(g.id, g);
  }
  log(`${urls.size}/${wanted.length} ids still resolve to a row with a url`);

  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    locale: 'en-AU',
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  const stats = { ok: 0, blocked: 0, empty: 0, gone: 0 };
  for (const rec of wanted) {
    const g = urls.get(rec.id);
    if (!g?.url) { stats.gone++; continue; }

    const { text, blocked, error } = await fetchPageText(ctx, g.url);
    if (blocked) stats.blocked++;
    else if (!text || text.length < 200) stats.empty++;
    else stats.ok++;

    fs.appendFileSync(OUT_PATH, JSON.stringify({
      id: rec.id,
      name: g.name,
      provider: g.provider,
      url: g.url,
      text,            // full text; the 6,000-char trim happens at question time
      blocked: !!blocked,
      error: error || null,
      fetched_at: new Date().toISOString(),
    }) + '\n');

    log(`${stats.ok + stats.blocked + stats.empty + stats.gone}/${wanted.length} ${blocked ? 'BLOCKED' : text ? `${text.length}c` : 'EMPTY'} — ${g.name.slice(0, 60)}`);
    await sleep(1200);
  }

  await browser.close();
  log(`done — ok=${stats.ok} blocked=${stats.blocked} empty=${stats.empty} no-url=${stats.gone}`);
  log(`corpus: ${OUT_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
