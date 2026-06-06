#!/usr/bin/env node

/**
 * Community Services Directory Scraper
 *
 * The biggest untapped "lake" of Australian community orgs: frontline service
 * directories. These list thousands of small, active community organisations
 * (with service type, location, and contact details) that are often too small
 * to surface in funding records or ACNC — exactly the on-the-ground orgs the
 * mission cares about.
 *
 * Sources (public listing pages only — see compliance note below):
 *   - mycommunitydirectory : mycommunitydirectory.com.au (national, via its public JSON API)
 *   - askizzy              : askizzy.org.au / Infoxchange (stub — needs API/selector config)
 *
 * Extraction strategy (mycommunitydirectory): the site renders listings client-side,
 * so static HTML has NO listing data (verified 2026-06-06). Instead we use the same
 * public JSON API the site's own frontend calls:
 *   GET /api/councils                                  → all 563 council regions (id, name, state)
 *   GET /api/search/council/{id}/0?SearchType=Category
 *        &Council={id}&PageNo={n}&PageSize=100         → paged listings for a council
 * Each result carries OrganisationName, Outlet {Nickname, Suburb, Phone, lat/lng},
 * Category {Name}, Service {DisplayName} and a canonical listing Url.
 *
 * For future HTML sources, the JSON-LD (Organization / LocalBusiness / NGO) and CSS
 * fallback extractors below are kept intact.
 *
 * Writes raw listings to the `community_directory_orgs` STAGING table. A downstream
 * bridge resolves ABNs and promotes matched orgs into gs_entities — scraped, ABN-less
 * listings never land in the canonical graph directly.
 *
 * Compliance (per the public-data scraping playbook):
 *   - Only fetches public listing pages the directory publishes to be found.
 *   - Identifying User-Agent, polite delays, no paywalls bypassed, no ToS-breaking
 *     authenticated areas. Respect each source's robots.txt before enabling it.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-community-directories.mjs            # DRY RUN
 *   node --env-file=.env scripts/scrape-community-directories.mjs --apply
 *   node --env-file=.env scripts/scrape-community-directories.mjs --source=mycommunitydirectory --state=QLD --apply
 *   node --env-file=.env scripts/scrape-community-directories.mjs --state=QLD --council=Brisbane --limit=200
 *   node --env-file=.env scripts/scrape-community-directories.mjs --state=QLD --max-councils=5 --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const argVal = (name, def) => {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const APPLY = process.argv.includes('--apply');
const SINGLE_SOURCE = argVal('source', null);
const STATE_FILTER = argVal('state', null)?.toUpperCase() || null;
const MAX_PAGES = parseInt(argVal('max-pages', '5'), 10);
const LIMIT = parseInt(argVal('limit', '0'), 10); // 0 = no cap
const DELAY_MS = parseInt(argVal('delay-ms', '1500'), 10);
const COUNCIL_FILTER = argVal('council', null);           // council id or name substring
const MAX_COUNCILS = parseInt(argVal('max-councils', '0'), 10); // 0 = all matching
const PAGE_SIZE = Math.min(parseInt(argVal('page-size', '100'), 10), 100);
const INCLUDE_NONLOCAL = process.argv.includes('--include-nonlocal');

const USER_AGENT = 'GrantScope/1.0 (community-services research; ben@act.place)';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[community-dir] ${msg}`); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Source registry ─────────────────────────────────────────────────────────
// Each source provides browse "seed" pages and how to find listing detail links.
// Selectors are best-effort and intended to be tuned against live HTML — JSON-LD
// extraction (below) does the heavy lifting and is source-agnostic.
const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const SOURCES = {
  mycommunitydirectory: {
    displayName: 'MyCommunityDirectory',
    base: 'https://www.mycommunitydirectory.com.au',
    // Listings come from the site's public JSON API, not HTML (which is JS-rendered).
    collect: collectFromMcdApi,
  },

  askizzy: {
    displayName: 'Ask Izzy (Infoxchange)',
    base: 'https://www.askizzy.org.au',
    // Ask Izzy is a JS SPA backed by the Infoxchange ISS API. Scraping the
    // rendered HTML needs Playwright, or (preferred) an ISS API key. Left as a
    // documented stub so it can be wired without re-touching the pipeline.
    seeds: () => [],
    listingLinkSelector: 'a[href*="/service/"]',
    nextPageSelector: null,
    note: 'Needs Playwright render or Infoxchange ISS API key — seeds intentionally empty.',
  },
};

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ── Normalisation helpers ──────────────────────────────────────────────────
function normaliseState(text) {
  if (!text) return null;
  const s = String(text).trim().toUpperCase();
  if (/\bVIC\b|VICTORIA/.test(s)) return 'VIC';
  if (/\bNSW\b|NEW SOUTH WALES/.test(s)) return 'NSW';
  if (/\bQLD\b|QUEENSLAND/.test(s)) return 'QLD';
  if (/\bWA\b|WESTERN AUSTRALIA/.test(s)) return 'WA';
  if (/\bSA\b|SOUTH AUSTRALIA/.test(s)) return 'SA';
  if (/\bTAS\b|TASMANIA/.test(s)) return 'TAS';
  if (/\bNT\b|NORTHERN TERRITORY/.test(s)) return 'NT';
  if (/\bACT\b|CANBERRA|AUSTRALIAN CAPITAL/.test(s)) return 'ACT';
  return null;
}

function extractPostcode(text) {
  if (!text) return null;
  const m = String(text).match(/\b(\d{4})\b/);
  return m ? m[1] : null;
}

function cleanStr(v, max = 2000) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// Pull schema.org Organization/LocalBusiness-like nodes out of JSON-LD blocks.
const ORG_TYPES = new Set([
  'Organization', 'LocalBusiness', 'NGO', 'GovernmentOrganization',
  'GovernmentService', 'Service', 'CivicStructure', 'MedicalOrganization',
]);

function collectJsonLdOrgs($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let parsed;
    try { parsed = JSON.parse($(el).contents().text()); } catch { return; }
    const nodes = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (Array.isArray(node['@graph'])) node['@graph'].forEach(walk);
      nodes.push(node);
    };
    walk(parsed);
    for (const node of nodes) {
      const types = [].concat(node['@type'] || []).map(String);
      if (types.some(t => ORG_TYPES.has(t))) out.push(node);
    }
  });
  return out;
}

function fromJsonLd(node, sourceUrl) {
  const addr = node.address || {};
  const addressStr = typeof addr === 'string'
    ? addr
    : [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
        .filter(Boolean).join(', ');
  const region = typeof addr === 'object' ? (addr.addressRegion || addr.addressLocality) : null;
  return {
    name: cleanStr(node.name, 300),
    description: cleanStr(node.description),
    service_type: cleanStr([].concat(node['@type'] || []).join(', '), 200),
    website: cleanStr(node.url, 500),
    phone: cleanStr(node.telephone, 60),
    email: cleanStr(typeof node.email === 'string' ? node.email.replace(/^mailto:/, '') : null, 200),
    address: cleanStr(addressStr, 500),
    suburb: cleanStr(typeof addr === 'object' ? addr.addressLocality : null, 120),
    state: normaliseState(region) || normaliseState(addressStr),
    postcode: cleanStr(typeof addr === 'object' ? addr.postalCode : null, 8) || extractPostcode(addressStr),
    source_url: sourceUrl,
    raw: node,
  };
}

// CSS fallback when a listing page has no structured data.
function fromCss($, sourceUrl) {
  const name = cleanStr($('h1, .listing-title, .service-title, [itemprop="name"]').first().text(), 300);
  if (!name) return null;
  const bodyText = $('main, .listing, .service-detail, body').first().text();
  return {
    name,
    description: cleanStr($('[itemprop="description"], .description, .about, .listing-description').first().text()),
    service_type: cleanStr($('.category, .service-type, [class*="category"]').first().text(), 200),
    website: cleanStr($('a[href^="http"]').not('[href*="mycommunitydirectory"]').not('[href*="askizzy"]').first().attr('href'), 500),
    phone: cleanStr($('a[href^="tel:"]').first().attr('href')?.replace(/^tel:/, '')
      || (bodyText.match(/\b(?:0\d[\d ()-]{7,})\b/) || [])[0], 60),
    email: cleanStr($('a[href^="mailto:"]').first().attr('href')?.replace(/^mailto:/, ''), 200),
    address: cleanStr($('[itemprop="address"], .address, .location').first().text(), 500),
    suburb: null,
    state: normaliseState($('[itemprop="addressRegion"], .state, .region').first().text()) || normaliseState(bodyText),
    postcode: extractPostcode($('[itemprop="address"], .address, .location').first().text()),
    source_url: sourceUrl,
    raw: null,
  };
}

// ── MyCommunityDirectory JSON API ───────────────────────────────────────────
async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// One search result (an outlet-service in a council region) → staging row.
function fromMcdResult(r, council) {
  const outlet = r.Outlet || {};
  const name = cleanStr(r.OrganisationName || outlet.Nickname, 300);
  if (!name) return null;
  const serviceType = cleanStr(
    [r.Category?.Name, r.Service?.DisplayName].filter(Boolean).join(' — '), 200);
  // Keep raw light: SubResults duplicates sibling outlets of the same service.
  const { SubResults, ...raw } = r;
  return {
    name,
    description: cleanStr(r.Description),
    service_type: serviceType,
    website: null, // not exposed by the search API
    phone: cleanStr(outlet.Phone || outlet.OutletManager?.Phone, 60),
    email: cleanStr(outlet.OutletManager?.Email, 200),
    address: cleanStr(outlet.DisplayAddress, 500),
    suburb: cleanStr(outlet.Suburb, 120),
    state: normaliseState(council.state) || null,
    postcode: extractPostcode(outlet.DisplayAddress),
    source_url: r.Url ? new URL(r.Url, SOURCES.mycommunitydirectory.base).toString() : null,
    raw,
  };
}

async function collectFromMcdApi(cfg, stats) {
  const base = cfg.base;
  const councils = (await fetchJson(`${base}/api/councils`))
    .map(c => ({
      id: c.CouncilRegionID,
      name: c.DisplayName,
      state: normaliseState(c.StateName),
    }))
    .filter(c => c.id && c.name)
    .filter(c => !STATE_FILTER || c.state === STATE_FILTER)
    .filter(c => !COUNCIL_FILTER
      || String(c.id) === COUNCIL_FILTER
      || c.name.toLowerCase().includes(COUNCIL_FILTER.toLowerCase()));
  const scoped = MAX_COUNCILS ? councils.slice(0, MAX_COUNCILS) : councils;
  log(`  ${scoped.length} council regions in scope${STATE_FILTER ? ` (${STATE_FILTER})` : ''}`);

  const rows = [];
  const seenOutletService = new Set(); // statewide services repeat across councils
  for (const council of scoped) {
    let total = null;
    let kept = 0;
    for (let page = 1; page <= 200; page++) { // backstop; real stop is Total below
      const url = `${base}/api/search/council/${council.id}/0`
        + `?SearchType=Category&Council=${council.id}`
        + `&SortField=Relevance&SortDirection=DESC&PageNo=${page}&PageSize=${PAGE_SIZE}`;
      let data;
      try { data = await fetchJson(url); }
      catch (err) { stats.errors.push(`${council.name} p${page}: ${err.message}`); break; }
      total = data.Total ?? total;
      const results = data.Results || [];
      if (results.length === 0) break;
      for (const r of results) {
        if (!INCLUDE_NONLOCAL && r.IsLocal === false) continue;
        if (r.OutletServiceID && seenOutletService.has(r.OutletServiceID)) continue;
        if (r.OutletServiceID) seenOutletService.add(r.OutletServiceID);
        const row = fromMcdResult(r, council);
        if (row) { rows.push(row); kept++; }
      }
      if (LIMIT && rows.length >= LIMIT) break;
      if (page * PAGE_SIZE >= (total ?? 0)) break;
      await sleep(DELAY_MS);
    }
    log(`  ${council.name}: ${kept} kept (total reported: ${total ?? '?'})`);
    if (LIMIT && rows.length >= LIMIT) break;
    await sleep(DELAY_MS);
  }
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

// ── Per-source crawl ─────────────────────────────────────────────────────────
async function collectListingUrls(source, cfg) {
  const seeds = cfg.seeds(STATE_FILTER);
  if (seeds.length === 0) {
    log(`  ${cfg.displayName}: no seed pages${cfg.note ? ` (${cfg.note})` : ''}`);
    return [];
  }
  const urls = new Set();
  for (const seed of seeds) {
    let pageUrl = seed;
    for (let page = 0; page < MAX_PAGES && pageUrl; page++) {
      let html;
      try { html = await fetchPage(pageUrl); }
      catch (err) { log(`  fetch failed (${pageUrl}): ${err.message}`); break; }
      const $ = cheerio.load(html);
      $(cfg.listingLinkSelector).each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try { urls.add(new URL(href, cfg.base).toString()); } catch { /* skip bad href */ }
      });
      const next = cfg.nextPageSelector ? $(cfg.nextPageSelector).first().attr('href') : null;
      pageUrl = next ? new URL(next, cfg.base).toString() : null;
      await sleep(DELAY_MS);
      if (LIMIT && urls.size >= LIMIT) break;
    }
    if (LIMIT && urls.size >= LIMIT) break;
  }
  return [...urls].slice(0, LIMIT || undefined);
}

async function scrapeListing(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const orgs = collectJsonLdOrgs($).map(n => fromJsonLd(n, url)).filter(o => o.name);
  if (orgs.length > 0) return orgs;
  const css = fromCss($, url);
  return css ? [css] : [];
}

async function upsertBatch(rows) {
  // Split on whether we have a source_url (the two unique indexes differ).
  let written = 0;
  const withUrl = rows.filter(r => r.source_url);
  const withoutUrl = rows.filter(r => !r.source_url);
  for (const [batchRows, conflict] of [
    [withUrl, 'source,source_url'],
    [withoutUrl, null], // fallback index is expression-based; let PG dedup via insert+ignore
  ]) {
    for (let i = 0; i < batchRows.length; i += 50) {
      const slice = batchRows.slice(i, i + 50).map(r => ({ ...r, last_seen: new Date().toISOString() }));
      const opts = conflict ? { onConflict: conflict, ignoreDuplicates: false } : { ignoreDuplicates: true };
      const { error, count } = await supabase
        .from('community_directory_orgs')
        .upsert(slice, { ...opts, count: 'estimated' });
      if (error) { log(`  upsert error: ${error.message}`); continue; }
      written += count ?? slice.length;
    }
  }
  return written;
}

async function run() {
  const runRow = await logStart(supabase, 'scrape-community-directories', 'Community Services Directory Scraper');
  const stats = { found: 0, written: 0, errors: [] };
  try {
    log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | source=${SINGLE_SOURCE || 'all'} | state=${STATE_FILTER || 'all'} | council=${COUNCIL_FILTER || 'all'} | limit=${LIMIT || '∞'}`);

    const sources = SINGLE_SOURCE
      ? { [SINGLE_SOURCE]: SOURCES[SINGLE_SOURCE] }
      : SOURCES;

    for (const [key, cfg] of Object.entries(sources)) {
      if (!cfg) { log(`Unknown source: ${key}`); continue; }
      log(`── ${cfg.displayName} ──`);

      const collected = [];
      if (cfg.collect) {
        // API-backed source: returns fully-mapped staging rows.
        const apiRows = await cfg.collect(cfg, stats);
        for (const o of apiRows) collected.push({ ...o, source: key });
      } else {
        const listingUrls = await collectListingUrls(key, cfg);
        log(`  ${listingUrls.length} listing URLs`);
        for (const url of listingUrls) {
          try {
            const orgs = await scrapeListing(url);
            for (const o of orgs) collected.push({ ...o, source: key });
          } catch (err) {
            stats.errors.push(`${url}: ${err.message}`);
          }
          await sleep(DELAY_MS);
        }
      }

      // Drop rows with no usable name; apply state filter if set.
      const rows = collected
        .filter(o => o.name)
        .filter(o => !STATE_FILTER || o.state === STATE_FILTER);
      stats.found += rows.length;
      log(`  ${rows.length} listings extracted`);

      if (!APPLY) {
        for (const r of rows.slice(0, 3)) log(`    [dry] ${r.name} — ${r.state || '?'} ${r.postcode || ''}`);
        continue;
      }
      const written = await upsertBatch(rows);
      stats.written += written;
      log(`  upserted ${written}`);
    }

    log(`Done. found=${stats.found} written=${stats.written} errors=${stats.errors.length}`);
    await logComplete(supabase, runRow.id, {
      items_found: stats.found,
      items_new: stats.written,
      status: stats.errors.length > 0 ? 'partial' : 'success',
      errors: stats.errors.slice(0, 20),
    });
  } catch (err) {
    log(`FATAL: ${err.message}`);
    await logFailed(supabase, runRow.id, err);
    process.exitCode = 1;
  }
}

run();
