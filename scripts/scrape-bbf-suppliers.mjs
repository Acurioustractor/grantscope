#!/usr/bin/env node

/**
 * Black Business Finder (BBF) — Indigenous supplier directory scraper
 *
 * Source: https://gateway.icn.org.au/bbf/capability-statements
 * Hosted by ICN (Industry Capability Network). Data is public (no auth
 * required for /bbf/capability-statements or /suppliers/{id} detail pages).
 *
 * Strategy:
 *   1. Paginate through /bbf/capability-statements?page={1..N}
 *   2. Extract supplier IDs from onclick="window.location='/suppliers/{id}'"
 *   3. Dedupe
 *   4. For each unique ID, fetch /suppliers/{id} detail page and extract
 *      name (h1) + ABN (paragraph-3 with "ABN {num}")
 *   5. Upsert to gs_entities with tags ['bbf-listed','indigenous-supplier']
 *      and is_community_controlled=true
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-bbf-suppliers.mjs [--dry-run] [--pages=200] [--detail-limit=500]
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = process.argv.includes('--dry-run');
const PAGES = parseInt(process.argv.find(a => a.startsWith('--pages='))?.split('=')[1] || '200') || 200;
const DETAIL_LIMIT = parseInt(process.argv.find(a => a.startsWith('--detail-limit='))?.split('=')[1] || '500') || 500;
const BASE = 'https://gateway.icn.org.au';
const UA = 'CivicGraph/1.0 (research; ben@benjamink.com.au)';
const DELAY_MS = 400; // 2.5 requests/sec — respectful throttle

function log(msg) { console.log(`[${new Date().toISOString()}] [bbf] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i === attempts) throw e;
      await sleep(500 * i);
    }
  }
}

// Extract supplier IDs + card-level name/description/location from a list page
function parseListPage(html) {
  const cards = [];
  // Each card is: onclick="window.location='/suppliers/{id}'" then <p class="card-title">NAME</p>
  // Then <p class="card-text">DESC</p> then <span>LOCATION</span>
  const cardBlocks = html.split('class="card-slides');
  for (const block of cardBlocks.slice(1)) {
    const idMatch = block.match(/window\.location='\/suppliers\/(\d+)'/);
    if (!idMatch) continue;
    const titleMatch = block.match(/<p class="card-title">([^<]+)</);
    const descMatch = block.match(/<p class="card-text">([^<]+)</);
    const locMatch = block.match(/<span>([^<]+,\s*[A-Z]{2,3})<\/span>/);
    cards.push({
      id: idMatch[1],
      name: titleMatch?.[1]?.trim() ?? null,
      description: descMatch?.[1]?.trim() ?? null,
      location: locMatch?.[1]?.trim() ?? null,
    });
  }
  return cards;
}

// Extract ABN + name from detail page
function parseDetailPage(html) {
  const nameMatch = html.match(/<h1 class="fw-normal">\s*([^<]+?)\s*<\/h1>/);
  const abnMatch = html.match(/ABN\s+(\d{11})/);
  const addressMatch = html.match(/<p class="paragraph-3 mb-0">([^<]*(?:Street|Road|Rd|Drive|Lane|Avenue|Way|Boulevard|Crescent|Court|Place|Parade|Highway|Terrace)[^<]*)<\/p>/i);
  return {
    name: nameMatch?.[1]?.trim() ?? null,
    abn: abnMatch?.[1] ?? null,
    address: addressMatch?.[1]?.trim() ?? null,
  };
}

async function main() {
  log(`starting ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} — pages=${PAGES} detail_limit=${DETAIL_LIMIT}`);

  // Phase 1: harvest supplier IDs + card metadata
  const suppliersById = new Map();
  for (let p = 1; p <= PAGES; p++) {
    try {
      const html = await fetchHtml(`${BASE}/bbf/capability-statements?page=${p}`);
      const cards = parseListPage(html);
      if (cards.length === 0) break; // Likely hit end of pagination
      for (const c of cards) {
        if (!suppliersById.has(c.id)) suppliersById.set(c.id, c);
      }
      if (p % 20 === 0) log(`  page ${p}/${PAGES} — ${suppliersById.size} unique suppliers`);
      await sleep(DELAY_MS);
    } catch (e) {
      log(`  page ${p} error: ${e.message}`);
    }
  }
  log(`phase 1 done: ${suppliersById.size} unique suppliers harvested from ${PAGES} pages`);

  // Phase 2: fetch detail pages for ABNs
  const withDetail = [];
  let withAbn = 0, detailErrors = 0;
  const toFetch = Array.from(suppliersById.values()).slice(0, DETAIL_LIMIT);
  log(`phase 2: fetching ${toFetch.length} detail pages for ABN extraction`);
  for (let i = 0; i < toFetch.length; i++) {
    const card = toFetch[i];
    try {
      const html = await fetchHtml(`${BASE}/suppliers/${card.id}`);
      const detail = parseDetailPage(html);
      const merged = {
        ...card,
        name: detail.name || card.name,
        abn: detail.abn,
        address: detail.address,
      };
      withDetail.push(merged);
      if (detail.abn) withAbn++;
      if ((i + 1) % 50 === 0) log(`  ${i + 1}/${toFetch.length} — ${withAbn} with ABN`);
      await sleep(DELAY_MS);
    } catch (e) {
      detailErrors++;
      log(`  detail ${card.id} error: ${e.message}`);
    }
  }
  log(`phase 2 done: ${withAbn} have ABN, ${detailErrors} errors`);

  // Phase 3: save to output file (always)
  mkdirSync('output', { recursive: true });
  const stamp = new Date().toISOString().split('T')[0];
  const outPath = `output/bbf-suppliers-${stamp}.json`;
  writeFileSync(outPath, JSON.stringify({ harvestedAt: new Date().toISOString(), suppliers: withDetail }, null, 2));
  log(`saved: ${outPath} (${withDetail.length} suppliers)`);

  if (DRY_RUN) {
    log('DRY RUN — skipping DB upsert');
    log('Top 10 samples:');
    for (const s of withDetail.slice(0, 10)) {
      log(`  ${s.abn ?? '--no-abn--'} | ${s.name} | ${s.location ?? ''}`);
    }
    return;
  }

  // Phase 4: upsert to gs_entities
  let created = 0, updated = 0, skipped = 0;
  for (const s of withDetail) {
    if (!s.abn) { skipped++; continue; } // Only upsert rows with ABN for now

    const { data: existing } = await supabase
      .from('gs_entities')
      .select('id, tags, is_community_controlled')
      .eq('abn', s.abn)
      .maybeSingle();

    if (existing) {
      const currentTags = Array.isArray(existing.tags) ? existing.tags : [];
      const newTags = Array.from(new Set([...currentTags, 'bbf-listed', 'indigenous-supplier']));
      const { error } = await supabase
        .from('gs_entities')
        .update({
          is_community_controlled: true,
          tags: newTags,
        })
        .eq('id', existing.id);
      if (!error) updated++;
    } else {
      const state = s.location?.match(/\b([A-Z]{2,3})$/)?.[1] ?? null;
      const gs_id = `AU-ABN-${s.abn}`;
      const { error } = await supabase
        .from('gs_entities')
        .insert({
          gs_id,
          canonical_name: s.name,
          abn: s.abn,
          entity_type: 'company',
          state,
          is_community_controlled: true,
          confidence: 'reported',
          source_datasets: ['bbf'],
          source_count: 1,
          tags: ['bbf-listed', 'indigenous-supplier'],
          description: s.description,
        });
      if (!error) created++;
    }
  }
  log(`=== DONE === created=${created} updated=${updated} skipped_no_abn=${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
