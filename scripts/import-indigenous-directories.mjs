#!/usr/bin/env node

/**
 * Import Indigenous Business Directories
 *
 * Sources:
 *   - Supply Nation (partial — paywalled, scrape public listings)
 *   - Kinaway (VIC) — kinaway.com.au
 *   - Black Business Finder (QLD) — blackbusinessfinder.com.au
 *
 * Usage:
 *   node scripts/import-indigenous-directories.mjs
 *   node scripts/import-indigenous-directories.mjs --source=kinaway
 *   node scripts/import-indigenous-directories.mjs --dry-run
 */

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
  console.log(`[import-indigenous] ${msg}`);
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
  if (!text) return ['indigenous'];
  const t = text.toLowerCase();
  const sectors = ['indigenous'];
  if (/food|catering|bush food/.test(t)) sectors.push('food');
  if (/art|craft|creative|design|fashion/.test(t)) sectors.push('arts');
  if (/construction|building|trades/.test(t)) sectors.push('construction');
  if (/consult|advisory|professional/.test(t)) sectors.push('consulting');
  if (/health|wellbeing/.test(t)) sectors.push('health');
  if (/education|training/.test(t)) sectors.push('education');
  if (/environment|land|ranger|country/.test(t)) sectors.push('environment');
  if (/tech|digital|IT/.test(t)) sectors.push('technology');
  if (/tourism|culture|heritage/.test(t)) sectors.push('tourism');
  if (/clean|facility|maintenance/.test(t)) sectors.push('facilities');
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

// ─── Supply Nation ──────────────────────────────────────────
async function scrapeSupplyNation() {
  log('Supply Nation (public listings only)...');
  const enterprises = [];

  // Supply Nation has a searchable directory — try public pages
  const urls = [
    'https://supplynation.org.au/search-supplier-diversity/',
    'https://supplynation.org.au/supplier-directory/',
    'https://supplynation.org.au/find-a-supplier/',
  ];

  for (const url of urls) {
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Look for supplier cards/listings
      $('article, .supplier-card, .listing, .member-card, .directory-item').each(function() {
        const $el = $(this);
        const name = $el.find('h2, h3, h4, .title, .name').first().text().trim();
        const description = $el.find('p, .description, .excerpt').first().text().trim();
        const location = $el.find('.location, .state, [class*="location"]').first().text().trim();
        const website = $el.find('a[href^="http"]').not('[href*="supplynation"]').first().attr('href');
        const category = $el.find('.category, .sector, [class*="category"]').first().text().trim();

        if (name && name.length > 2 && name.length < 200) {
          enterprises.push({ name, description, location, website, category, source: 'supply-nation' });
        }
      });

      if (enterprises.length > 0) break;
    } catch (err) {
      log(`  Error fetching ${url}: ${err.message}`);
    }
  }

  log(`  Found ${enterprises.length} from Supply Nation (public)`);
  return enterprises;
}

// ─── Kinaway (VIC) ──────────────────────────────────────────
async function scrapeKinaway() {
  log('Kinaway (VIC)...');
  const enterprises = [];

  const urls = [
    'https://kinaway.com.au/business-directory/',
    'https://kinaway.com.au/directory/',
    'https://kinaway.com.au/our-members/',
    'https://kinaway.com.au/find-a-business/',
  ];

  for (const url of urls) {
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Kinaway typically uses a grid or list layout
      $('article, .business-card, .directory-item, .member-card, .listing, .entry').each(function() {
        const $el = $(this);
        const name = $el.find('h2, h3, h4, .title, .name').first().text().trim();
        const description = $el.find('p, .description, .excerpt').first().text().trim();
        const website = $el.find('a[href^="http"]').not('[href*="kinaway"]').first().attr('href');
        const category = $el.find('.category, .sector, [class*="category"]').first().text().trim();

        if (name && name.length > 2 && name.length < 200) {
          enterprises.push({ name, description, website, category, state: 'VIC', source: 'kinaway' });
        }
      });

      if (enterprises.length > 0) break;

      // Fallback: links
      $('a[href*="/business/"], a[href*="/member/"]').each(function() {
        const name = $(this).text().trim();
        if (name && name.length > 3 && name.length < 200) {
          enterprises.push({ name, state: 'VIC', source: 'kinaway' });
        }
      });

      if (enterprises.length > 0) break;
    } catch (err) {
      log(`  Error fetching ${url}: ${err.message}`);
    }
  }

  log(`  Found ${enterprises.length} from Kinaway`);
  return enterprises;
}

// ─── Black Business Finder (QLD) ────────────────────────────
async function scrapeBlackBusinessFinder() {
  log('Black Business Finder (QLD)...');
  const enterprises = [];

  const urls = [
    'https://www.blackbusinessfinder.com.au/directory/',
    'https://www.blackbusinessfinder.com.au/find-a-business/',
    'https://www.blackbusinessfinder.com.au/businesses/',
  ];

  for (const url of urls) {
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      $('article, .business-card, .directory-item, .listing, .entry, .business-listing').each(function() {
        const $el = $(this);
        const name = $el.find('h2, h3, h4, .title, .name, .business-name').first().text().trim();
        const description = $el.find('p, .description, .excerpt').first().text().trim();
        const location = $el.find('.location, .state, [class*="location"]').first().text().trim();
        const website = $el.find('a[href^="http"]').not('[href*="blackbusinessfinder"]').first().attr('href');
        const category = $el.find('.category, .sector, [class*="category"]').first().text().trim();

        if (name && name.length > 2 && name.length < 200) {
          enterprises.push({
            name, description, website, category,
            state: normaliseState(location) || 'QLD',
            source: 'black-business-finder',
          });
        }
      });

      if (enterprises.length > 0) break;
    } catch (err) {
      log(`  Error fetching ${url}: ${err.message}`);
    }
  }

  log(`  Found ${enterprises.length} from Black Business Finder`);
  return enterprises;
}

async function run() {
  log('Starting indigenous directory imports...');
  const totalStats = { total: 0, upserted: 0, errors: 0 };

  const scrapers = {
    'supply-nation': scrapeSupplyNation,
    'kinaway': scrapeKinaway,
    'black-business-finder': scrapeBlackBusinessFinder,
  };

  const sources = SINGLE_SOURCE ? { [SINGLE_SOURCE]: scrapers[SINGLE_SOURCE] } : scrapers;

  for (const [key, scraper] of Object.entries(sources)) {
    if (!scraper) {
      log(`Unknown source: ${key}`);
      continue;
    }

    const enterprises = await scraper();

    if (enterprises.length === 0) {
      log(`  No enterprises found — may need manual review or partnership access`);
      continue;
    }

    // Check for existing ORIC records to avoid duplicates
    const names = enterprises.map(e => e.name);
    const { data: existingOric } = await supabase
      .from('social_enterprises')
      .select('name')
      .eq('source_primary', 'oric')
      .in('name', names);
    const oricNames = new Set((existingOric || []).map(r => r.name.toLowerCase()));

    const upsertRows = enterprises
      .filter(e => !oricNames.has(e.name.toLowerCase()))
      .map(e => ({
        name: e.name,
        description: e.description || null,
        website: e.website || null,
        state: e.state || null,
        org_type: 'indigenous_business',
        sector: inferSectors(e.category || e.description || e.name),
        source_primary: e.source || key,
        sources: [{ source: e.source || key, scraped_at: new Date().toISOString() }],
      }));

    const dedupSkipped = enterprises.length - upsertRows.length;
    if (dedupSkipped > 0) log(`  Skipped ${dedupSkipped} already in ORIC`);

    totalStats.total += upsertRows.length;

    if (DRY_RUN) {
      log(`  [DRY RUN] Would upsert ${upsertRows.length} records`);
      for (const r of upsertRows.slice(0, 3)) log(`    - ${r.name} (${r.state || '?'})`);
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

    await new Promise(r => setTimeout(r, 2000));
  }

  log(`\nDone! Total: ${totalStats.total}, Upserted: ${totalStats.upserted}, Errors: ${totalStats.errors}`);
}

run().catch(err => {
  console.error('[import-indigenous] Fatal:', err);
  process.exit(1);
});
