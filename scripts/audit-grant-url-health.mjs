#!/usr/bin/env node
/**
 * Does a grant's URL still lead anywhere?
 *
 * Usage:
 *   node --env-file=.env scripts/audit-grant-url-health.mjs [--sample=400] [--open-only]
 *
 * Why two passes (2026-09-21): the first version of this used a bare fetch and
 * reported that 93 of 93 open GrantConnect grants were 404 "gone". Every one of
 * them loads fine in a browser. grants.gov.au answers a plain HTTP client with
 * 403/404 regardless of whether the page exists — curl gets 403 on its own
 * homepage. A bot wall and a dead link are indistinguishable to fetch, and
 * reading one as the other would have had us delete 30% of the live desk.
 *
 * So: fetch is the cheap first pass, and every non-2xx is re-checked in a real
 * browser before it is called dead. Nothing is reported as gone on fetch alone.
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const SAMPLE = parseInt(arg('sample', '400'), 10);
const OPEN_ONLY = process.argv.includes('--open-only');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

async function fetchProbe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      // Never trust a failing HEAD. grants.gov.au answers HEAD with 404 and the
      // same URL with GET with 200 and a full page. Taking the HEAD status at
      // face value is what made 94 live Commonwealth grants look bot-blocked.
      if (method === 'HEAD' && !(r.status >= 200 && r.status < 300)) continue;
      return { status: r.status };
    } catch (e) {
      if (method === 'GET') return { status: 0, err: e.name === 'TimeoutError' ? 'timeout' : String(e.cause?.code || e.message).slice(0, 40) };
    }
  }
  return { status: 0, err: 'unreachable' };
}

/** The adjudicator. A page is only dead if a real browser cannot get it either. */
async function browserProbe(ctx, url) {
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = resp?.status() ?? 0;
    const title = (await page.title().catch(() => '')) || '';
    return { status, title: title.slice(0, 80) };
  } catch (e) {
    return { status: 0, err: String(e.message).slice(0, 60) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; out.push(await fn(it)); } }));
  return out;
}

const where = OPEN_ONLY
  ? `WHERE url ~ '^https?://' AND (closes_at >= current_date OR deadline >= current_date)`
  : `WHERE url ~ '^https?://'`;
const order = OPEN_ONLY ? '' : `ORDER BY md5(id::text) LIMIT ${SAMPLE}`;
const { data: rows } = await sb.rpc('exec_sql', { query: `SELECT id, name, url, source FROM grant_opportunities ${where} ${order}` });
console.log(`probing ${rows.length} URLs (${OPEN_ONLY ? 'every open grant' : `random sample of ${SAMPLE}`})`);

const first = await pool(rows, 10, async r => ({ ...r, ...(await fetchProbe(r.url)) }));
const ok = first.filter(r => r.status >= 200 && r.status < 300);
const suspect = first.filter(r => !(r.status >= 200 && r.status < 300));
console.log(`fetch pass: ${ok.length} ok, ${suspect.length} non-2xx -> re-checking in a browser`);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({ userAgent: UA, locale: 'en-AU' });
const adjudicated = await pool(suspect, 4, async r => ({ ...r, browser: await browserProbe(ctx, r.url) }));
await browser.close();

const revived = adjudicated.filter(r => r.browser.status >= 200 && r.browser.status < 300);
const dead = adjudicated.filter(r => !(r.browser.status >= 200 && r.browser.status < 300));

console.log(`\n=== RESULT (n=${rows.length})`);
console.log(`  ${String(ok.length).padStart(4)}  ${(100 * ok.length / rows.length).toFixed(1).padStart(5)}%  reachable by plain fetch`);
console.log(`  ${String(revived.length).padStart(4)}  ${(100 * revived.length / rows.length).toFixed(1).padStart(5)}%  BOT-BLOCKED — fetch failed, browser loaded it fine`);
console.log(`  ${String(dead.length).padStart(4)}  ${(100 * dead.length / rows.length).toFixed(1).padStart(5)}%  genuinely dead (browser could not load it either)`);

const byHost = {};
for (const r of revived) { const h = new URL(r.url).host; byHost[h] = (byHost[h] || 0) + 1; }
console.log('\n  hosts that block plain HTTP clients:');
for (const [h, n] of Object.entries(byHost).sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(4)}  ${h}`);

const deadBySource = {};
for (const r of dead) { const s = r.source || '?'; (deadBySource[s] ||= []).push(r); }
console.log('\n  genuinely dead, by source:');
for (const [s, list] of Object.entries(deadBySource).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`     ${String(list.length).padStart(4)}  ${s}`);
}
console.log('\n  first 20 genuinely dead:');
for (const d of dead.slice(0, 20)) console.log(`     fetch=${d.status || d.err} browser=${d.browser.status || d.browser.err}  ${d.name?.slice(0, 40)}  ${d.url?.slice(0, 55)}`);
