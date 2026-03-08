#!/usr/bin/env node

/**
 * Import Government Procurement Social Enterprise Lists
 *
 * Sources:
 *   - buy.nsw Social Enterprise list
 *   - buyingfor.vic.gov.au social enterprise results
 *
 * Usage:
 *   node scripts/import-gov-procurement-se.mjs
 *   node scripts/import-gov-procurement-se.mjs --source=nsw
 *   node scripts/import-gov-procurement-se.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SINGLE_SOURCE = sourceArg ? sourceArg.split('=')[1] : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[import-gov-procurement] ${msg}`);
}

function inferSectors(text) {
  if (!text) return ['community'];
  const t = text.toLowerCase();
  const sectors = [];
  if (/food|cafe|catering/.test(t)) sectors.push('food');
  if (/clean|laundry|facility|maintenance|garden|landscap/.test(t)) sectors.push('facilities');
  if (/print|document|mail|pack/.test(t)) sectors.push('manufacturing');
  if (/tech|digital|IT|software/.test(t)) sectors.push('technology');
  if (/consult|advisory|professional/.test(t)) sectors.push('consulting');
  if (/recycle|waste|environment/.test(t)) sectors.push('environment');
  if (/employ|job|workforce/.test(t)) sectors.push('employment');
  if (sectors.length === 0) sectors.push('community');
  return sectors;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GrantScope/1.0 (research; contact@act.place)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ─── NSW (buy.nsw) ──────────────────────────────────────────
async function scrapeNSW() {
  log('buy.nsw Social Enterprise list...');
  const enterprises = [];

  const urls = [
    'https://buy.nsw.gov.au/social-enterprises',
    'https://buy.nsw.gov.au/buyer-guidance/social-procurement/social-enterprises',
    'https://buy.nsw.gov.au/social-enterprise-directory',
  ];

  for (const url of urls) {
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Look for tables (common for government lists)
      $('table tbody tr').each(function() {
        const $row = $(this);
        const cells = $row.find('td');
        if (cells.length >= 2) {
          const name = $(cells[0]).text().trim();
          const services = $(cells[1]).text().trim();
          const website = $row.find('a[href^="http"]').first().attr('href');
          const location = cells.length >= 3 ? $(cells[2]).text().trim() : null;

          if (name && name.length > 2 && !/social enterprise/i.test(name)) {
            enterprises.push({ name, description: services, website, location, state: 'NSW' });
          }
        }
      });

      // Also try card/list format
      if (enterprises.length === 0) {
        $('article, .listing, .card, .directory-item, .se-item').each(function() {
          const $el = $(this);
          const name = $el.find('h2, h3, h4, .title, .name').first().text().trim();
          const description = $el.find('p, .description').first().text().trim();
          const website = $el.find('a[href^="http"]').not('[href*="nsw.gov"]').first().attr('href');

          if (name && name.length > 2 && name.length < 200) {
            enterprises.push({ name, description, website, state: 'NSW' });
          }
        });
      }

      if (enterprises.length > 0) break;
    } catch (err) {
      log(`  Error fetching ${url}: ${err.message}`);
    }
  }

  log(`  Found ${enterprises.length} from NSW`);
  return enterprises;
}

// ─── VIC (buyingfor.vic.gov.au) ─────────────────────────────
async function scrapeVIC() {
  log('buyingfor.vic.gov.au social enterprises...');
  const enterprises = [];

  const urls = [
    'https://www.buyingfor.vic.gov.au/social-enterprise-directory',
    'https://www.buyingfor.vic.gov.au/social-enterprises',
    'https://www.buyingfor.vic.gov.au/supplier-directory?type=social-enterprise',
  ];

  for (const url of urls) {
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Tables
      $('table tbody tr').each(function() {
        const $row = $(this);
        const cells = $row.find('td');
        if (cells.length >= 2) {
          const name = $(cells[0]).text().trim();
          const services = $(cells[1]).text().trim();
          const website = $row.find('a[href^="http"]').first().attr('href');

          if (name && name.length > 2) {
            enterprises.push({ name, description: services, website, state: 'VIC' });
          }
        }
      });

      // Cards/lists
      if (enterprises.length === 0) {
        $('article, .listing, .card, .directory-item, .supplier-card').each(function() {
          const $el = $(this);
          const name = $el.find('h2, h3, h4, .title, .name').first().text().trim();
          const description = $el.find('p, .description').first().text().trim();
          const website = $el.find('a[href^="http"]').not('[href*="vic.gov"]').first().attr('href');

          if (name && name.length > 2 && name.length < 200) {
            enterprises.push({ name, description, website, state: 'VIC' });
          }
        });
      }

      if (enterprises.length > 0) break;
    } catch (err) {
      log(`  Error fetching ${url}: ${err.message}`);
    }
  }

  log(`  Found ${enterprises.length} from VIC`);
  return enterprises;
}

async function run() {
  log('Starting government procurement SE imports...');
  const totalStats = { total: 0, upserted: 0, errors: 0 };

  const scrapers = { nsw: scrapeNSW, vic: scrapeVIC };
  const sources = SINGLE_SOURCE ? { [SINGLE_SOURCE]: scrapers[SINGLE_SOURCE] } : scrapers;

  for (const [key, scraper] of Object.entries(sources)) {
    if (!scraper) {
      log(`Unknown source: ${key}`);
      continue;
    }

    const enterprises = await scraper();
    if (enterprises.length === 0) {
      log(`  No enterprises found — may need manual review`);
      continue;
    }

    const upsertRows = enterprises.map(e => ({
      name: e.name,
      description: e.description || null,
      website: e.website || null,
      state: e.state,
      org_type: 'social_enterprise',
      sector: inferSectors(e.description || e.name),
      source_primary: `gov-procurement-${key}`,
      sources: [{ source: `gov-procurement-${key}`, scraped_at: new Date().toISOString() }],
    }));

    totalStats.total += upsertRows.length;

    if (DRY_RUN) {
      log(`  [DRY RUN] Would upsert ${upsertRows.length} records`);
      totalStats.upserted += upsertRows.length;
      continue;
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
      const batch = upsertRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('social_enterprises')
        .upsert(batch, { onConflict: 'name,state', ignoreDuplicates: false });

      if (error) {
        log(`  Error: ${error.message}`);
        totalStats.errors += batch.length;
      } else {
        totalStats.upserted += batch.length;
      }
    }
  }

  log(`\nDone! Total: ${totalStats.total}, Upserted: ${totalStats.upserted}, Errors: ${totalStats.errors}`);
}

run().catch(err => {
  console.error('[import-gov-procurement] Fatal:', err);
  process.exit(1);
});
