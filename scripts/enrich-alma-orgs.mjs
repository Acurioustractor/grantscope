#!/usr/bin/env node

/**
 * ALMA Organisation Enrichment Agent v2
 *
 * Enriches ALMA interventions with metadata scraped from their websites:
 *   - Organisation description, logo, favicon
 *   - Social media links
 *   - Photos, videos, annual reports
 *
 * v2 improvements:
 *   - Scrapes websites directly when URL exists (430 have URLs) — no search needed
 *   - Uses curl with hard timeout instead of Node fetch (fetch hangs on bad hosts)
 *   - Only falls back to search for orgs without websites
 *   - Single search call max per org (not 4)
 *   - Updates both alma_interventions.metadata and gs_entities.metadata
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-alma-orgs.mjs [--dry-run] [--limit=100] [--org="Org Name"] [--force]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');
const SINGLE_ORG = process.argv.find(a => a.startsWith('--org='))?.split('=').slice(1).join('=');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(phase, msg) {
  console.log(`[${new Date().toISOString()}] [${phase}] ${msg}`);
}

// ─── curl-based HTTP fetch (Node fetch hangs on unresolvable hosts) ─────────

function curlFetch(url, timeoutSecs = 10) {
  try {
    const escapedUrl = url.replace(/'/g, "'\\''");
    const html = execSync(
      `curl -sL --max-time ${timeoutSecs} --max-redirs 3 -H 'User-Agent: CivicGraph/1.0 (research)' '${escapedUrl}'`,
      { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: (timeoutSecs + 5) * 1000 }
    );
    return html;
  } catch {
    return null;
  }
}

// ─── Scrape a webpage for metadata ──────────────────────────────────────────

function scrapePage(url) {
  const html = curlFetch(url);
  if (!html || html.length < 200) return null;

  const meta = {};

  // Description from meta tags
  const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']{10,})/)
    || html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+(?:name|property)=["'](?:description|og:description)["']/);
  if (descMatch) meta.description = descMatch[1].trim().slice(0, 500);

  // og:image
  const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/);
  if (ogImgMatch) meta.og_image = resolveUrl(ogImgMatch[1], url);

  // Favicon / logo
  const iconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)/)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/);
  if (iconMatch) meta.favicon = resolveUrl(iconMatch[1], url);

  // Logo in img tags
  const logoImgMatch = html.match(/<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)/)
    || html.match(/<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["']/);
  if (logoImgMatch) meta.logo_url = resolveUrl(logoImgMatch[1], url);

  // Social media links
  const socialPatterns = [
    { name: 'facebook', pattern: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)/i },
    { name: 'twitter', pattern: /href=["'](https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^"'\s]+)/i },
    { name: 'linkedin', pattern: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"'\s]+)/i },
    { name: 'instagram', pattern: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)/i },
    { name: 'youtube', pattern: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"'\s]+)/i },
    { name: 'tiktok', pattern: /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[^"'\s]+)/i },
  ];

  meta.social = {};
  for (const { name, pattern } of socialPatterns) {
    const m = pattern.exec(html);
    if (m) meta.social[name] = m[1].replace(/["')\s]+$/, '');
  }
  if (Object.keys(meta.social).length === 0) delete meta.social;

  // Annual/impact report PDFs
  const reportPattern = /href=["']([^"']+(?:annual[-_]?report|impact[-_]?report|year[-_]?in[-_]?review)[^"']*\.pdf)/gi;
  const reports = [];
  let rm;
  while ((rm = reportPattern.exec(html)) !== null) reports.push(resolveUrl(rm[1], url));
  if (reports.length) meta.annual_reports = [...new Set(reports)].slice(0, 5);

  // Video embeds
  const videoPattern = /(?:src|href)=["']((?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/(?:embed|watch)|youtu\.be|vimeo\.com)\/[^"'\s]+)/gi;
  const videos = [];
  let vm;
  while ((vm = videoPattern.exec(html)) !== null) {
    videos.push(vm[1].startsWith('//') ? 'https:' + vm[1] : vm[1]);
  }
  if (videos.length) meta.videos = [...new Set(videos)].slice(0, 5);

  // Gallery/photo images (skip small icons)
  const imgPattern = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)/gi;
  const photos = [];
  let im;
  while ((im = imgPattern.exec(html)) !== null) {
    const src = resolveUrl(im[1], url);
    if (!src.includes('icon') && !src.includes('pixel') && !src.includes('1x1')
        && !src.includes('gravatar') && !src.includes('favicon') && !src.includes('spinner')) {
      photos.push(src);
    }
  }
  if (photos.length) meta.photos = [...new Set(photos)].slice(0, 10);

  return meta;
}

function resolveUrl(path, base) {
  try { return new URL(path, base).href; } catch { return path; }
}

// ─── Search (only used when no website) ─────────────────────────────────────

function searchForWebsite(orgName) {
  // Use DuckDuckGo lite — single search call
  try {
    const query = encodeURIComponent(`${orgName} Australia official site`);
    const html = curlFetch(`https://lite.duckduckgo.com/lite/?q=${query}`, 8);
    if (!html) return null;

    // Extract result URLs
    const urls = [];
    const linkRegex = /href="(https?:\/\/[^"]+)"/g;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      // Skip DDG internal links, ads
      if (!url.includes('duckduckgo.com') && !url.includes('duck.co')) {
        urls.push(url);
      }
    }

    // Prefer .org.au, .gov.au, .com.au
    const auSite = urls.find(u => u.match(/\.(org|gov|com)\.au/));
    return auSite || urls[0] || null;
  } catch {
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('MAIN', `=== ALMA Org Enrichment v2 ===`);
  log('MAIN', `Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}, Limit: ${LIMIT}, Force: ${FORCE}`);

  // Get unique orgs — prioritize those WITH websites (no search needed)
  let query = db
    .from('alma_interventions')
    .select('operating_organization, website, metadata, gs_entity_id')
    .not('operating_organization', 'is', null);

  if (SINGLE_ORG) {
    query = query.eq('operating_organization', SINGLE_ORG);
  }

  const { data: rows, error } = await query;
  if (error) { log('MAIN', `Error: ${error.message}`); process.exit(1); }

  // Deduplicate by org name
  const orgMap = new Map();
  for (const row of rows) {
    const org = row.operating_organization;
    if (!FORCE && row.metadata?.enriched_at && !SINGLE_ORG) continue;

    const existing = orgMap.get(org);
    if (!existing || (row.website && !existing.website)) {
      orgMap.set(org, { name: org, website: row.website, gs_entity_id: row.gs_entity_id });
    }
  }

  // Sort: orgs WITH websites first (fast path), then without
  const orgs = [...orgMap.values()]
    .sort((a, b) => (b.website ? 1 : 0) - (a.website ? 1 : 0))
    .slice(0, LIMIT);

  const withUrl = orgs.filter(o => o.website).length;
  const withoutUrl = orgs.length - withUrl;
  log('MAIN', `Processing ${orgs.length} orgs (${withUrl} with website, ${withoutUrl} need search)`);

  let enriched = 0;
  let failed = 0;
  let searched = 0;

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    if (i % 50 === 0 && i > 0) {
      log('PROGRESS', `[${i}/${orgs.length}] enriched=${enriched} failed=${failed} searched=${searched}`);
    }

    log('ENRICH', `[${i + 1}/${orgs.length}] ${org.name}`);

    try {
      let website = org.website;

      // Ensure protocol
      if (website && !website.startsWith('http')) {
        website = 'https://' + website;
      }

      // If no website, try a single search
      if (!website) {
        searched++;
        website = searchForWebsite(org.name);
        if (website) log('ENRICH', `  Found website: ${website}`);
      }

      const enrichment = { enriched_at: new Date().toISOString() };
      const found = [];

      if (website) {
        enrichment.website = website;
        log('ENRICH', `  Scraping: ${website}`);
        const meta = scrapePage(website);

        if (meta) {
          if (meta.description) { enrichment.description = meta.description; found.push('description'); }
          if (meta.logo_url) { enrichment.logo_url = meta.logo_url; found.push('logo'); }
          else if (meta.og_image) { enrichment.logo_url = meta.og_image; found.push('og_image'); }
          if (meta.favicon) enrichment.favicon_url = meta.favicon;
          if (meta.social) { enrichment.social_media = meta.social; found.push(`social(${Object.keys(meta.social).join(',')})`); }
          if (meta.annual_reports) { enrichment.annual_reports = meta.annual_reports; found.push(`reports(${meta.annual_reports.length})`); }
          if (meta.videos) { enrichment.videos = meta.videos; found.push(`videos(${meta.videos.length})`); }
          if (meta.photos) { enrichment.photos = meta.photos; found.push(`photos(${meta.photos.length})`); }
        }

        if (!org.website && website) found.push('website');
      }

      log('ENRICH', `  Found: ${found.length ? found.join(', ') : 'nothing'}`);

      if (!DRY_RUN) {
        // Always write metadata (even if empty) so we don't re-process
        const updatePayload = { metadata: enrichment };
        if (website && !org.website) updatePayload.website = website;

        const { error: updateErr } = await db
          .from('alma_interventions')
          .update(updatePayload)
          .eq('operating_organization', org.name);

        if (updateErr) {
          log('ENRICH', `  DB error: ${updateErr.message}`);
          failed++;
          continue;
        }

        // Update linked gs_entity too
        if (org.gs_entity_id && found.length) {
          const entityMeta = {};
          if (enrichment.logo_url) entityMeta.logo_url = enrichment.logo_url;
          if (enrichment.social_media) entityMeta.social_media = enrichment.social_media;
          if (enrichment.photos) entityMeta.photos = enrichment.photos.slice(0, 3);
          if (enrichment.videos) entityMeta.videos = enrichment.videos.slice(0, 3);

          const entityUpdate = {};
          if (enrichment.description) entityUpdate.description = enrichment.description;
          if (website) entityUpdate.website = website;
          if (Object.keys(entityMeta).length) entityUpdate.metadata = entityMeta;

          if (Object.keys(entityUpdate).length) {
            await db.from('gs_entities').update(entityUpdate).eq('id', org.gs_entity_id);
          }
        }

        if (found.length) enriched++;
        else failed++;
      } else {
        if (found.length) enriched++;
        else failed++;
      }

      // Gentle rate limit — 500ms for scrape-only, 2s if we searched
      await new Promise(r => setTimeout(r, website === org.website ? 500 : 2000));

    } catch (e) {
      log('ENRICH', `  Error: ${e.message}`);
      failed++;
    }
  }

  log('MAIN', `=== COMPLETE ===`);
  log('MAIN', `Enriched: ${enriched}, Failed/empty: ${failed}, Searches: ${searched}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
