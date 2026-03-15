#!/usr/bin/env node

/**
 * Entity Enrichment Agent
 *
 * Enriches gs_entities with website, description, logo, social media,
 * photos, videos, and annual reports — focusing on high-value entity types.
 *
 * Priority order:
 *   1. Indigenous corps (7K, mostly unenriched)
 *   2. Social enterprises (5K, mostly unenriched)
 *   3. Foundations (10K, partial enrichment)
 *   4. Government bodies (103, zero websites)
 *   5. Charities (52K, partial enrichment)
 *
 * Stores enrichment in gs_entities columns + metadata jsonb.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-entities.mjs [--dry-run] [--limit=100] [--type=indigenous_corp]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');
const TYPE_FILTER = process.argv.find(a => a.startsWith('--type='))?.split('=')[1];
const RETRY_FAILED = process.argv.includes('--retry-failed');
const FIND_WEBSITES = process.argv.includes('--find-websites');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(phase, msg) {
  console.log(`[${new Date().toISOString()}] [${phase}] ${msg}`);
}

// Priority types — enriched in this order
const PRIORITY_TYPES = TYPE_FILTER
  ? [TYPE_FILTER]
  : ['indigenous_corp', 'social_enterprise', 'foundation', 'government_body'];

// ─── Web search via DuckDuckGo lite ─────────────────────────────────────────

async function webSearch(query) {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX;

  if (GOOGLE_API_KEY && GOOGLE_CX) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=5`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.items || []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        image: item.pagemap?.cse_image?.[0]?.src,
      }));
    } catch (e) { /* fall through */ }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CivicGraph-Enrichment/1.0 (research; ben@civicgraph.au)' },
    });
    clearTimeout(timeout);
    const html = await res.text();
    const results = [];
    const linkRegex = /class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)</g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      results.push({ url: match[1], title: match[2].trim(), snippet: '' });
    }
    return results.slice(0, 5);
  } catch (e) {
    return [];
  }
}

// ─── Scrape page metadata ───────────────────────────────────────────────────

async function scrapePage(url, parentSignal) {
  try {
    // Use curl with hard timeout — Node fetch hangs on unresolvable hosts
    const html = execSync(
      `curl -sL --max-time 5 --connect-timeout 3 -A "CivicGraph-Enrichment/1.0" "${url}"`,
      { encoding: 'utf-8', timeout: 6000, maxBuffer: 2 * 1024 * 1024 }
    );
    if (!html || html.length < 100) return null;

    const meta = {};

    // Description
    const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
    if (descMatch) meta.description = descMatch[1].trim();

    // OG image
    const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImg) meta.og_image = resolveUrl(ogImg[1], url);

    // Logo
    const logoImg = html.match(/<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)/i)
      || html.match(/<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["']/i);
    if (logoImg) meta.logo_url = resolveUrl(logoImg[1], url);

    // Favicon
    const iconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)/i);
    if (iconMatch) meta.favicon = resolveUrl(iconMatch[1], url);

    // Social media
    const socialPatterns = [
      { name: 'facebook', pattern: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)/gi },
      { name: 'twitter', pattern: /href=["'](https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^"'\s]+)/gi },
      { name: 'linkedin', pattern: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"'\s]+)/gi },
      { name: 'instagram', pattern: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)/gi },
      { name: 'youtube', pattern: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"'\s]+)/gi },
    ];
    meta.social = {};
    for (const { name, pattern } of socialPatterns) {
      const m = pattern.exec(html);
      if (m) meta.social[name] = m[1].replace(/["')\s]+$/, '');
    }
    if (!Object.keys(meta.social).length) delete meta.social;

    // Annual reports
    const reportPattern = /href=["']([^"']+(?:annual[-_]?report|impact[-_]?report|year[-_]?in[-_]?review)[^"']*\.pdf)/gi;
    const reports = [];
    let rm;
    while ((rm = reportPattern.exec(html)) !== null) reports.push(resolveUrl(rm[1], url));
    if (reports.length) meta.annual_reports = [...new Set(reports)];

    // Videos
    const videoPattern = /(?:src|href)=["']((?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/(?:embed|watch)|youtu\.be|vimeo\.com)\/[^"'\s]+)/gi;
    const videos = [];
    let vm;
    while ((vm = videoPattern.exec(html)) !== null) videos.push(vm[1].startsWith('//') ? 'https:' + vm[1] : vm[1]);
    if (videos.length) meta.videos = [...new Set(videos)].slice(0, 5);

    // Photos
    const imgPattern = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)/gi;
    const photos = [];
    let im;
    while ((im = imgPattern.exec(html)) !== null) {
      const src = resolveUrl(im[1], url);
      if (!src.includes('icon') && !src.includes('pixel') && !src.includes('1x1')
          && !src.includes('gravatar') && !src.includes('favicon')) {
        photos.push(src);
      }
    }
    if (photos.length) meta.photos = [...new Set(photos)].slice(0, 10);

    return meta;
  } catch (e) {
    return null;
  }
}

function resolveUrl(path, base) {
  try { return new URL(path, base).href; } catch { return path; }
}

// ─── Enrich a single entity ─────────────────────────────────────────────────

async function enrichEntity(entity, signal) {
  const enrichment = { enriched_at: new Date().toISOString() };
  let website = entity.website;

  // Only scrape — no web search (DDG blocks/rate-limits)
  if (!website) return enrichment;

  // Ensure protocol
  if (website && !website.startsWith('http')) website = 'https://' + website;

  // Scrape website
  if (website) {
    enrichment.website = website;
    const meta = await scrapePage(website, signal);
    if (meta) {
      if (meta.description) enrichment.description = meta.description;
      if (meta.logo_url) enrichment.logo_url = meta.logo_url;
      else if (meta.og_image) enrichment.logo_url = meta.og_image;
      if (meta.favicon) enrichment.favicon_url = meta.favicon;
      if (meta.social) enrichment.social_media = meta.social;
      if (meta.annual_reports) enrichment.annual_reports = meta.annual_reports;
      if (meta.videos) enrichment.videos = meta.videos;
      if (meta.photos) enrichment.photos = meta.photos;
    }
  }

  // Skip web search steps — DDG is rate-limited/blocking
  // Annual reports and videos are captured from website scrape if present

  return enrichment;
}

// ─── Process a batch of entities of one type ────────────────────────────────

async function processType(entityType, limit) {
  log(entityType, `Fetching unenriched entities...`);

  // Get entities WITH websites but missing description (scrape-only, no web search)
  const { data: entities, error } = await db
    .from('gs_entities')
    .select('id, canonical_name, abn, website, description, entity_type')
    .eq('entity_type', entityType)
    .not('website', 'is', null)
    .is('description', null)
    .limit(limit);

  if (error) {
    log(entityType, `Error: ${error.message}`);
    return { enriched: 0, failed: 0 };
  }

  log(entityType, `Found ${entities.length} entities to enrich`);

  let enriched = 0;
  let failed = 0;

  for (const entity of entities) {
    const idx = enriched + failed + 1;
    if (idx % 50 === 0 || idx === 1) {
      log(entityType, `[${idx}/${entities.length}] enriched=${enriched} failed=${failed}`);
    }

    try {
      const orgAbort = new AbortController();
      const orgTimeout = setTimeout(() => orgAbort.abort(), 8000);
      const data = await enrichEntity(entity, orgAbort.signal);
      clearTimeout(orgTimeout);

      const found = [];
      if (data.description) found.push('desc');
      if (data.logo_url) found.push('logo');
      if (data.social_media) found.push('social');
      if (data.annual_reports) found.push('reports');
      if (data.videos) found.push('video');
      if (data.photos) found.push('photos');
      if (data.website && !entity.website) found.push('website');

      if (found.length && !DRY_RUN) {
        const update = {};
        if (data.description && !entity.description) update.description = data.description;
        if (data.website && !entity.website) update.website = data.website;

        // Store rich metadata
        update.metadata = {
          enriched_at: data.enriched_at,
          ...(data.logo_url && { logo_url: data.logo_url }),
          ...(data.favicon_url && { favicon_url: data.favicon_url }),
          ...(data.social_media && { social_media: data.social_media }),
          ...(data.annual_reports && { annual_reports: data.annual_reports }),
          ...(data.videos && { videos: data.videos }),
          ...(data.photos && { photos: data.photos }),
        };

        const { error: updateErr } = await db
          .from('gs_entities')
          .update(update)
          .eq('id', entity.id);

        if (updateErr) {
          failed++;
        } else {
          enriched++;
        }
      } else if (found.length && DRY_RUN) {
        enriched++;
        if (found.length > 1) log(entityType, `  → ${entity.canonical_name}: ${found.join(', ')}`);
      } else {
        failed++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 1200));

    } catch (e) {
      log(entityType, `  skip: ${entity.canonical_name} (${e.message})`);
      failed++;
    }
  }

  log(entityType, `Done. Enriched: ${enriched}, Failed/empty: ${failed}`);
  return { enriched, failed };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('MAIN', `=== Entity Enrichment Agent ===`);
  log('MAIN', `Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}, Limit: ${LIMIT}/type, Types: ${PRIORITY_TYPES.join(', ')}`);

  const totals = { enriched: 0, failed: 0 };

  for (const type of PRIORITY_TYPES) {
    const result = await processType(type, LIMIT);
    totals.enriched += result.enriched;
    totals.failed += result.failed;
  }

  log('MAIN', `=== COMPLETE ===`);
  log('MAIN', `Total enriched: ${totals.enriched}`);
  log('MAIN', `Total failed/empty: ${totals.failed}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
