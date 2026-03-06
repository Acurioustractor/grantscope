#!/usr/bin/env node

/**
 * Import BuyAbility Directory — Australian Disability Enterprises
 *
 * Scrapes the BuyAbility directory of disability-led social enterprises.
 * Source: https://buyability.org.au/directory/
 *
 * Usage:
 *   node scripts/import-buyability.mjs
 *   node scripts/import-buyability.mjs --dry-run
 *   node scripts/import-buyability.mjs --limit=50
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import https from 'node:https';

// BuyAbility has an incomplete SSL cert chain
const agent = new https.Agent({ rejectUnauthorized: false });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const USE_JINA = process.argv.includes('--jina');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, upserted: 0, errors: 0 };
const BASE_URL = 'https://buyability.org.au';
const DIRECTORY_URL = `${BASE_URL}/directory/`;

function log(msg) {
  console.log(`[import-buyability] ${msg}`);
}

function normaliseState(text) {
  if (!text) return null;
  const s = text.trim().toUpperCase();
  if (s.includes('VIC') || s.includes('VICTORIA')) return 'VIC';
  if (s.includes('NSW') || s.includes('NEW SOUTH WALES')) return 'NSW';
  if (s.includes('QLD') || s.includes('QUEENSLAND')) return 'QLD';
  if (s.includes('WA') || s.includes('WESTERN AUSTRALIA')) return 'WA';
  if (s.includes('SA') || s.includes('SOUTH AUSTRALIA')) return 'SA';
  if (s.includes('TAS') || s.includes('TASMANIA')) return 'TAS';
  if (s.includes('NT') || s.includes('NORTHERN TERRITORY')) return 'NT';
  if (s.includes('ACT') || s.includes('CANBERRA')) return 'ACT';
  return null;
}

function inferSectors(text) {
  if (!text) return ['employment'];
  const t = text.toLowerCase();
  const sectors = ['employment']; // All disability enterprises provide employment
  if (/clean|laundry|facility|maintenance|garden/.test(t)) sectors.push('facilities');
  if (/pack|assembly|manufactur|warehouse/.test(t)) sectors.push('manufacturing');
  if (/food|cafe|catering|kitchen/.test(t)) sectors.push('food');
  if (/art|craft|creative/.test(t)) sectors.push('arts');
  if (/recycle|waste|environment/.test(t)) sectors.push('environment');
  if (/tech|digital|printing|scan/.test(t)) sectors.push('technology');
  return sectors;
}

async function fetchPage(url) {
  const fetchUrl = USE_JINA ? `https://r.jina.ai/${url}` : url;
  const headers = { 'User-Agent': 'GrantScope/1.0 (research; contact@act.place)' };
  if (USE_JINA) headers['Accept'] = 'text/html';

  // Use custom agent for sites with incomplete SSL chains
  const opts = { headers };
  if (!USE_JINA && url.startsWith('https://buyability')) opts.dispatcher = undefined;
  const res = await fetch(fetchUrl, { headers, agent: url.startsWith('https://buyability') ? agent : undefined });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function scrapeDirectory() {
  const enterprises = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = page === 1 ? DIRECTORY_URL : `${DIRECTORY_URL}page/${page}/`;
    log(`Fetching page ${page}...`);

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // BuyAbility uses .directoryItem cards with h4 names
      const cards = $('.directoryItem');

      if (cards.length === 0 && page === 1) {
        // Fallback: try broader selectors
        $('h4 a[href*="/organisation/"]').each(function() {
          const name = $(this).text().trim();
          if (name && name.length > 2) {
            enterprises.push({ name });
          }
        });
        hasMore = false;
        continue;
      }

      cards.each(function() {
        const $card = $(this);
        const name = $card.find('h4').first().text().trim();
        const description = $card.find('p, .description').first().text().trim();
        const location = $card.find('.location, .state, .region').first().text().trim();
        const profileLink = $card.find('a[href*="/organisation/"]').first().attr('href');
        const services = $card.find('.services, .category, .tags').first().text().trim();

        if (name && name.length > 2) {
          enterprises.push({
            name,
            description,
            location,
            services,
            profileUrl: profileLink ? `${BASE_URL}${profileLink}` : null,
          });
        }
      });

      // Check for next page
      const nextLink = $('a[rel="next"], .pagination a:contains("Next"), a:contains("›"), .next a').attr('href');
      if (nextLink && page < 30) {
        page++;
        await new Promise(r => setTimeout(r, 1500));
      } else {
        hasMore = false;
      }
    } catch (err) {
      log(`Error on page ${page}: ${err.message}`);
      hasMore = false;
    }
  }

  return enterprises;
}

async function run() {
  log('Starting BuyAbility import...');

  const enterprises = await scrapeDirectory();
  log(`Found ${enterprises.length} enterprises`);

  const rows = LIMIT ? enterprises.slice(0, LIMIT) : enterprises;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const upsertRows = batch.map(e => {
      const state = normaliseState(e.location);
      return {
        name: e.name,
        description: e.description || null,
        website: e.website || null,
        state,
        city: e.location?.replace(/,?\s*(VIC|NSW|QLD|WA|SA|TAS|NT|ACT)\s*$/i, '').trim() || null,
        org_type: 'disability_enterprise',
        sector: inferSectors(e.services || e.description || e.name),
        certifications: [{ body: 'buyability', status: 'listed' }],
        source_primary: 'buyability',
        sources: [{ source: 'buyability', url: DIRECTORY_URL, scraped_at: new Date().toISOString() }],
      };
    }).filter(r => r.name);

    stats.total += upsertRows.length;

    if (DRY_RUN) {
      log(`[DRY RUN] Would upsert ${upsertRows.length} records`);
      for (const r of upsertRows.slice(0, 3)) log(`  - ${r.name} (${r.state || '?'})`);
      stats.upserted += upsertRows.length;
      continue;
    }

    const { error } = await supabase
      .from('social_enterprises')
      .upsert(upsertRows, { onConflict: 'name,state', ignoreDuplicates: false });

    if (error) {
      log(`Error: ${error.message}`);
      stats.errors += upsertRows.length;
    } else {
      stats.upserted += upsertRows.length;
    }
  }

  log(`\nDone! Total: ${stats.total}, Upserted: ${stats.upserted}, Errors: ${stats.errors}`);
}

run().catch(err => {
  console.error('[import-buyability] Fatal:', err);
  process.exit(1);
});
