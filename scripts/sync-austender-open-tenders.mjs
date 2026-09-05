#!/usr/bin/env node

/**
 * Sync OPEN AusTender ATMs (Approach To Market) → grant_opportunities
 *
 * Phase 3 of the Goods capital/procurement pipelines
 * (thoughts/shared/plans/2026-05-27-goods-capital-procurement-pipelines-scope.md).
 *
 * WHY a separate source from sync-austender-contracts.mjs:
 *   The OCDS API (api.tenders.gov.au/ocds/findByDates) only exposes AWARDED
 *   contracts — its DateType is restricted to
 *   ['contractPublished','contractLastModified','contractStart','contractEnd'].
 *   There is no tender/ATM/planning release type. "What open tenders can Goods
 *   bid on right now?" is therefore unanswerable from OCDS. The live answer is
 *   AusTender's Current ATM RSS feed (all government business opportunities
 *   currently out to market), enriched per-ATM from the public detail page which
 *   carries the UNSPSC category code, agency, ATM type and close date.
 *
 * FLOW:
 *   1. Fetch the Current ATM RSS feed (~90 latest open ATMs).
 *   2. Keyword pre-filter on title+description (Goods product words) — cheap,
 *      narrows ~90 → a handful before any detail fetches. (--all skips this and
 *      fetches every ATM, gating purely on UNSPSC; slower but no keyword misses.)
 *   3. Fetch each candidate's /Atm/Show/{guid} page → extract UNSPSC code,
 *      category title, agency, ATM type, close date, location.
 *   4. PRECISION GATE on UNSPSC: a present-but-non-Goods code REJECTS the row
 *      (this is what kills the keyword false-positives — "seabed" dredging,
 *      "road bed" asphalt, Defence-Housing-Australia civil works all carry
 *      construction/marine UNSPSC, not furniture/appliance). No code → fall back
 *      to the keyword match.
 *   5. Upsert survivors as grant_opportunities rows:
 *        source='austender-open-tenders', discovery_method='procurement',
 *        status='open', dedup on the unique `url` index (stable per ATM GUID).
 *      NOT marked manual — they score through the scorer's +25 procurement boost
 *      (goods-relevance.mjs BOOSTED_DISCOVERY_METHODS). Scored inline at ingest
 *      so rows are immediately useful; the nightly rescorer reconfirms.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-austender-open-tenders.mjs            # dry-run (no writes)
 *   node --env-file=.env scripts/sync-austender-open-tenders.mjs --apply
 *   node --env-file=.env scripts/sync-austender-open-tenders.mjs --all      # fetch every ATM (UNSPSC-only gate)
 *   node --env-file=.env scripts/sync-austender-open-tenders.mjs --limit=5  # cap detail fetches (debug)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { scoreGrantForGoods } from './lib/goods-relevance.mjs';

const RSS_URL = 'https://www.tenders.gov.au/public_data/rss/rss.xml';
const DETAIL_BASE = 'https://www.tenders.gov.au/Atm/Show/';
const SOURCE = 'austender-open-tenders';
// Browser-like UA: tenders.gov.au 403s bare/unknown agents.
const UA = 'Mozilla/5.0 (compatible; GrantScope/1.0; +https://grantscope.au)';
const TAGS = ['ACT-GD', 'goods']; // applied to aligned_projects when score >= 50

const APPLY = process.argv.includes('--apply');
const FETCH_ALL = process.argv.includes('--all');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Goods product words — mirrors GOODS_KEYWORDS in hydrate-goods-procurement.mjs.
// Used as the cheap RSS pre-filter and as the fallback gate when an ATM carries
// no UNSPSC code.
const GOODS_KEYWORDS = [
  'furniture', 'bed', 'mattress', 'housing', 'accommodation',
  'white goods', 'whitegood', 'appliance', 'washing', 'refrigerat', 'linen',
  'fitout', 'fit-out', 'furnish', 'kitchen', 'laundry',
  'fridge', 'freezer', 'dryer',
];

// UNSPSC families that ARE Goods product. The agency assigns these, so they are
// the authoritative category gate.
//   56xx  — Furniture and Furnishings (56101500 = Furniture, beds/mattresses etc.)
//   5210  — Floor coverings
//   5212  — Domestic bedclothes and linens (mattresses, bed linen)
//   5213  — Domestic kitchenware and tableware
//   5214  — Domestic appliances (whitegoods: refrigerators, washers, dryers)
// Deliberately EXCLUDES 5216/5217 (consumer/AV electronics) — not Goods.
const GOODS_UNSPSC_PREFIXES = ['5210', '5212', '5213', '5214'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[atm] ${msg}`); }

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripHtml(s) {
  return decodeEntities(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Parse the RSS feed into [{ title, link, guid, description, pubDate }]. */
function parseRss(xml) {
  const items = [];
  const get = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? decodeEntities(m[1]).trim() : '';
  };
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    items.push({
      title: get(block, 'title'),
      link: get(block, 'link'),
      guid: get(block, 'guid'),
      description: stripHtml(get(block, 'description')),
      pubDate: get(block, 'pubDate'),
    });
  }
  return items;
}

async function fetchText(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/html,application/xml', 'User-Agent': UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1500));
      return fetchText(url, attempt + 1);
    }
    throw err;
  }
}

/** Pull a single-quoted value out of the page's embedded analytics object. */
function pickAtmField(html, key) {
  const m = html.match(new RegExp(`'${key}':\\s*'([^']*)'`));
  return m ? m[1].trim() : null;
}

/** Close date sits in the TimeZone modal link as MM/DD/YYYY HH:MM:SS (URL-encoded). */
function extractCloseDate(html) {
  const m = html.match(/CloseDateTime=([^"'&]+)/);
  if (!m) return { date: null, datetime: null };
  const raw = decodeURIComponent(m[1]).trim(); // "05/29/2026 15:00:00"
  const dm = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+([\d:]+)?/);
  if (!dm) return { date: null, datetime: raw };
  const [, mm, dd, yyyy, time] = dm;
  return { date: `${yyyy}-${mm}-${dd}`, datetime: `${yyyy}-${mm}-${dd}${time ? ' ' + time : ''}` };
}

// AusTender uses bare state codes; map the Goods-relevant ones to the scorer's
// geography format (AU-NT/AU-WA/AU-QLD/AU-SA get a +10 boost). Anything else (or
// multi-jurisdiction) lands as 'AU' (national, +4).
const STATE_TO_GEO = { NT: 'AU-NT', WA: 'AU-WA', QLD: 'AU-QLD', SA: 'AU-SA' };

/** Fetch + parse one ATM detail page. */
async function fetchAtmDetail(link) {
  const html = await fetchText(link);
  const close = extractCloseDate(html);
  return {
    atmId: pickAtmField(html, 'atmID'),
    agency: pickAtmField(html, 'atmAgencyName'),
    unspscCode: pickAtmField(html, 'atmCategoryCode'),
    unspscTitle: pickAtmField(html, 'atmCategoryTitle'),
    atmType: pickAtmField(html, 'atmType'),
    locationState: pickAtmField(html, 'atmLocationState'),
    locationCity: pickAtmField(html, 'atmLocationCity'),
    closeDate: close.date,
    closeDateTime: close.datetime,
  };
}

/**
 * Decide whether an ATM is Goods-relevant.
 * @returns {{ accept: boolean, reason: string }}
 */
function gate(detail, rssText) {
  const code = (detail.unspscCode || '').replace(/\D/g, '');
  if (code) {
    const isGoods = code.startsWith('56') || GOODS_UNSPSC_PREFIXES.some(p => code.startsWith(p));
    // A present-but-non-Goods UNSPSC is authoritative → reject (kills the
    // keyword false-positives). Only the category title is allowed to rescue it,
    // for the rare case the agency coded it generically but titled it clearly.
    if (isGoods) return { accept: true, reason: `unspsc:${code}` };
    const titleHit = GOODS_KEYWORDS.find(k => (detail.unspscTitle || '').toLowerCase().includes(k));
    if (titleHit) return { accept: true, reason: `category-title:${titleHit}` };
    return { accept: false, reason: `unspsc-non-goods:${code}` };
  }
  // No UNSPSC on the page → fall back to the keyword match on free text.
  const hay = `${rssText} ${detail.unspscTitle || ''}`.toLowerCase();
  const kw = GOODS_KEYWORDS.find(k => hay.includes(k));
  return kw ? { accept: true, reason: `keyword:${kw}` } : { accept: false, reason: 'no-unspsc-no-keyword' };
}

function buildRow(item, detail, gateReason) {
  const geography = STATE_TO_GEO[detail.locationState] || 'AU';
  const categories = ['procurement'];
  if (detail.unspscTitle) categories.push(detail.unspscTitle.toLowerCase());

  const descParts = [item.description];
  if (detail.agency) descParts.push(`Agency: ${detail.agency}.`);
  if (detail.atmType) descParts.push(`ATM type: ${detail.atmType}.`);
  if (detail.unspscTitle) descParts.push(`Category: ${detail.unspscTitle} (UNSPSC ${detail.unspscCode}).`);
  if (detail.closeDate) descParts.push(`Closes ${detail.closeDate}.`);
  const description = descParts.filter(Boolean).join(' ').slice(0, 2000);

  const row = {
    name: item.title,
    provider: detail.agency || 'AusTender',
    program: detail.atmType || 'Approach to Market',
    source: SOURCE,
    source_id: detail.atmId || item.guid || item.link,
    discovery_method: 'procurement',
    status: 'open',
    closes_at: detail.closeDate,
    deadline: detail.closeDate,
    url: item.link,
    description,
    categories,
    geography,
    accepts_pty_ltd: true,   // open tenders accept Pty Ltd suppliers (Goods' entity)
    accepts_charity: true,
    metadata: {
      atm_id: detail.atmId,
      unspsc_code: detail.unspscCode,
      unspsc_title: detail.unspscTitle,
      atm_type: detail.atmType,
      location_state: detail.locationState,
      location_city: detail.locationCity,
      close_datetime: detail.closeDateTime,
      gate_reason: gateReason,
      rss_pub_date: item.pubDate,
      ingested_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };

  // Score inline through the shared scorer (discovery_method='procurement' → +25).
  const { score, signals } = scoreGrantForGoods(row);
  row.goods_relevance_score = score;
  row.goods_relevance_scored_at = new Date().toISOString();
  row.goods_relevance_signals = signals;
  row.aligned_projects = score >= 50 ? TAGS : [];
  return row;
}

async function main() {
  console.log(`\n=== Sync AusTender open ATMs → grant_opportunities === ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}\n`);

  log('Fetching Current ATM RSS feed...');
  const xml = await fetchText(RSS_URL);
  const items = parseRss(xml);
  log(`RSS carries ${items.length} open ATMs.`);

  // Pre-filter unless --all.
  let candidates = items;
  if (!FETCH_ALL) {
    candidates = items.filter(it => {
      const hay = `${it.title} ${it.description}`.toLowerCase();
      return GOODS_KEYWORDS.some(k => hay.includes(k));
    });
    log(`Keyword pre-filter: ${items.length} → ${candidates.length} candidates (use --all to fetch every ATM).`);
  }
  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);

  const accepted = [];
  let rejected = 0, errored = 0;
  for (const item of candidates) {
    const guid = item.link?.startsWith('http') ? item.link : `${DETAIL_BASE}${item.guid}`;
    try {
      const detail = await fetchAtmDetail(item.link || guid);
      const g = gate(detail, `${item.title} ${item.description}`);
      if (!g.accept) {
        rejected++;
        console.log(`  ✗ ${g.reason.padEnd(26)} ${item.title.slice(0, 70)}`);
      } else {
        const row = buildRow(item, detail, g.reason);
        accepted.push(row);
        console.log(`  ✓ [${String(row.goods_relevance_score).padStart(3)}] ${g.reason.padEnd(26)} ${item.title.slice(0, 60)}  (${detail.closeDate || 'no close'}, ${detail.agency || '?'})`);
      }
    } catch (err) {
      errored++;
      console.error(`  ! fetch failed: ${item.title.slice(0, 60)} — ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 600)); // polite delay between detail fetches
  }

  console.log(`\nGate: ${accepted.length} accepted · ${rejected} rejected · ${errored} fetch errors`);
  const scoring = accepted.filter(r => r.goods_relevance_score >= 50).length;
  console.log(`Scoring: ${scoring}/${accepted.length} clear the ACT-GD threshold (>=50) and get tagged.`);

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to upsert.');
    if (accepted[0]) console.log('\nSample row:\n', JSON.stringify({ ...accepted[0], description: accepted[0].description.slice(0, 120) + '…' }, null, 2));
    return;
  }

  // One write contract for every writer of grant_opportunities (scripts/lib/upsert-grant-opportunities.mjs).
  // Conflicting on url alone was safe against the url index but not against (source, name): a re-published ATM under
  // a name already stored would have raised there. The contract resolves both and writes by primary key.
  const result = await upsertGrantOpportunities(supabase, accepted);
  const up = result.written;
  const err = result.failed + result.ambiguous;
  for (const message of result.errors) console.error(`  ${message.slice(0, 160)}`);
  console.log(`\n✓ Upserted ${up}/${accepted.length} open ATMs (${err} errors).`);
  console.log('Rows are scored inline; nightly score-goods-relevance.mjs --rescore-all reconfirms.');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
