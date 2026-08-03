#!/usr/bin/env node
/**
 * Ingest GrantConnect CURRENT Grant Opportunities (GO list)
 *
 * Unlike ingest-grantconnect.mjs (awarded grants, manual CSV download), this
 * scrapes the live OPEN opportunities list. grants.gov.au serves full
 * server-rendered HTML when given a browser User-Agent — the CloudFront 403
 * is UA-gating only. Use the www. host; the bare host 302s.
 *
 *   list:   https://www.grants.gov.au/go/list?page=N   (15 records/page)
 *   detail: https://www.grants.gov.au/Go/Show?GoUuid=  (amount + publish date)
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-grantconnect-go.mjs --dry-run
 *   node --env-file=.env scripts/ingest-grantconnect-go.mjs              # list only
 *   node --env-file=.env scripts/ingest-grantconnect-go.mjs --details   # + amount from detail pages
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const DETAILS = process.argv.includes('--details');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const BASE = 'https://www.grants.gov.au';
const MAX_PAGES = 30; // 133 open GOs = 9 pages today; cap is a runaway guard
const THROTTLE_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// "9-Jun-2026 5:00 pm" -> "2026-06-09"
const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
function parseCloseDate(text) {
  const m = text.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  return mm ? `${m[3]}-${mm}-${m[1].padStart(2, '0')}` : null;
}

// same taxonomy as import-gov-grants.mjs
function inferCategories(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const cats = [];
  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage|music|theatre|film|broadcast/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical|mental/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|export|innovation/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|research|stem|child care|childcare/.test(text)) cats.push('education');
  if (/justice|youth|safety/.test(text)) cats.push('justice');
  if (/disaster|recovery|flood|bushfire|drought/.test(text)) cats.push('disaster_relief');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/housing|homelessness|accommodation/.test(text)) cats.push('housing');
  if (/disability|inclusion|accessible/.test(text)) cats.push('disability');
  return cats.length > 0 ? cats : ['general'];
}

function labelled(article, label) {
  // <span>Label:</span> <div class="list-desc-inner">value</div>
  const re = new RegExp(`<span>${label}[^<]*</span>\\s*<div class="list-desc-inner">([\\s\\S]*?)</div>`, 'i');
  const m = article.match(re);
  return m ? strip(m[1]) : null;
}

function parseListPage(html) {
  const records = [];
  for (const article of html.split('<article role="article">').slice(1)) {
    const uuid = article.match(/Go\/Show\?GoUuid=([0-9a-f-]{36})/i)?.[1];
    const goId = article.match(/title="(GO\d+)"/)?.[1];
    const title = strip(article.match(/<p class="font20"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '');
    if (!uuid || !goId || !title) continue;
    records.push({
      goId,
      uuid,
      title,
      closeDate: parseCloseDate(labelled(article, 'Close Date') || ''),
      agency: labelled(article, 'Agency'),
      category: labelled(article, 'Primary Category'),
      description: labelled(article, 'Description'),
    });
  }
  return records;
}

function parseAmount(html) {
  const m = html.match(/Total Amount Available \(AUD\):<\/span>[\s\S]{0,300}?\$([\d,]+(?:\.\d{2})?)/);
  return m ? Math.round(Number(m[1].replace(/,/g, ''))) : null;
}

let activeRun = { id: null };

async function main() {
  if (!DRY_RUN) activeRun = await logStart(supabase, 'ingest-grantconnect-go', 'GrantConnect Open Opportunities');
  console.log(`GrantConnect GO ingest — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${DETAILS ? ' +details' : ''}\n`);

  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchHtml(`${BASE}/go/list?page=${page}`);
    const records = parseListPage(html);
    if (records.length === 0) break;
    all.push(...records);
    console.log(`  page ${page}: ${records.length} records`);
    await sleep(THROTTLE_MS);
  }
  console.log(`\n${all.length} open opportunities scraped`);

  if (DETAILS) {
    let fetched = 0;
    for (const rec of all) {
      try {
        rec.amount = parseAmount(await fetchHtml(`${BASE}/Go/Show?GoUuid=${rec.uuid}`));
        fetched++;
      } catch (err) {
        console.error(`  detail failed ${rec.goId}: ${err.message}`);
      }
      await sleep(THROTTLE_MS);
    }
    console.log(`  details fetched: ${fetched}/${all.length} (${all.filter((r) => r.amount).length} with amount)`);
  }

  const rows = all.map((rec) => ({
    name: rec.title,
    description: rec.description,
    deadline: rec.closeDate,
    closes_at: rec.closeDate,
    source: 'grantconnect',
    source_id: rec.goId,
    url: `${BASE}/Go/Show?GoUuid=${rec.uuid}`,
    provider: rec.agency,
    categories: inferCategories(rec.title, `${rec.category || ''} ${rec.description || ''}`),
    status: 'open',
    grant_type: 'government',
    geography: 'national',
    discovery_method: 'grantconnect-go-scrape',
    last_verified_at: new Date().toISOString(),
    ...(rec.amount ? { amount_max: rec.amount } : {}),
    metadata: { go_id: rec.goId, go_uuid: rec.uuid, primary_category: rec.category, agency: rec.agency },
  }));

  if (DRY_RUN) {
    rows.slice(0, 8).forEach((r) => console.log(`  ${r.source_id} | ${r.deadline} | ${r.provider} | ${r.name.slice(0, 70)}`));
    console.log(`  ... ${rows.length} total. Dry run — not writing.`);
    return;
  }

  // GrantConnect can republish the same titled opportunity under a new UUID.
  // The canonical table contract is one row per (source, name), so conflict on
  // that key and refresh the URL/source_id instead of colliding with it while
  // attempting a URL-based insert.
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from('grant_opportunities').upsert(batch, { onConflict: 'source,name', ignoreDuplicates: false });
    if (error) throw new Error(`upsert failed: ${error.message}`);
    upserted += batch.length;
  }
  console.log(`Upserted ${upserted} rows (source=grantconnect)`);

  await logComplete(supabase, activeRun.id, { items_found: all.length, items_new: upserted });
}

main().catch(async (err) => {
  console.error(err);
  await logFailed(supabase, activeRun.id, err).catch(() => {});
  process.exit(1);
});
