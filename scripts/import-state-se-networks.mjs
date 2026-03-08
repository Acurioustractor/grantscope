#!/usr/bin/env node

/**
 * Import State Social Enterprise Network Directories
 *
 * Single script covering all 6 state SE network member directories:
 *   - SENVIC (VIC) — senvic.org.au
 *   - QSEC (QLD) — qsec.org.au
 *   - SECNA (NSW/ACT) — socialenterprisecouncil.org.au
 *   - SASEC (SA) — sasec.org.au
 *   - WASEC (WA) — wasec.org.au
 *   - SENTAS (TAS) — sentas.org.au
 *
 * Usage:
 *   node scripts/import-state-se-networks.mjs
 *   node scripts/import-state-se-networks.mjs --source=senvic
 *   node scripts/import-state-se-networks.mjs --dry-run
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
  console.log(`[import-state-se] ${msg}`);
}

const NETWORKS = [
  {
    key: 'senvic',
    name: 'SENVIC',
    state: 'VIC',
    urls: [
      'https://www.senvic.org.au/directory',
      'https://www.senvic.org.au/members',
      'https://www.senvic.org.au/our-members',
    ],
  },
  {
    key: 'qsec',
    name: 'QSEC',
    state: 'QLD',
    urls: [
      'https://www.qsec.org.au/members',
      'https://www.qsec.org.au/directory',
      'https://www.qsec.org.au/our-members',
    ],
  },
  {
    key: 'secna',
    name: 'SECNA',
    state: 'NSW',
    urls: [
      'https://www.socialenterprisecouncil.org.au/members',
      'https://www.socialenterprisecouncil.org.au/directory',
    ],
  },
  {
    key: 'sasec',
    name: 'SASEC',
    state: 'SA',
    urls: [
      'https://www.sasec.org.au/members',
      'https://www.sasec.org.au/directory',
    ],
  },
  {
    key: 'wasec',
    name: 'WASEC',
    state: 'WA',
    urls: [
      'https://www.wasec.org.au/members',
      'https://www.wasec.org.au/directory',
    ],
  },
  {
    key: 'sentas',
    name: 'SENTAS',
    state: 'TAS',
    urls: [
      'https://www.sentas.org.au/members',
      'https://www.sentas.org.au/directory',
    ],
  },
];

function inferSectors(text) {
  if (!text) return ['community'];
  const t = text.toLowerCase();
  const sectors = [];
  if (/food|cafe|catering/.test(t)) sectors.push('food');
  if (/employ|job|workforce/.test(t)) sectors.push('employment');
  if (/art|craft|creative|design/.test(t)) sectors.push('arts');
  if (/health|wellbeing|mental/.test(t)) sectors.push('health');
  if (/environment|sustain|recycle/.test(t)) sectors.push('environment');
  if (/education|training/.test(t)) sectors.push('education');
  if (/housing|accommodation/.test(t)) sectors.push('housing');
  if (/tech|digital/.test(t)) sectors.push('technology');
  if (/indigenous|first nations/.test(t)) sectors.push('indigenous');
  if (sectors.length === 0) sectors.push('community');
  return sectors;
}

async function scrapeNetwork(network) {
  const enterprises = [];

  for (const url of network.urls) {
    try {
      log(`  Trying ${url}...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GrantScope/1.0 (research; contact@act.place)' },
        redirect: 'follow',
      });

      if (!res.ok) {
        log(`  ${res.status} — skipping`);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Try various common member directory patterns
      const selectors = [
        '.member-card', '.directory-item', '.enterprise-card',
        'article.member', '.listing', '.member-listing',
        '.team-member', '.partner-card', '.grid-item',
      ];

      let found = false;
      for (const sel of selectors) {
        const cards = $(sel);
        if (cards.length > 0) {
          cards.each(function() {
            const $card = $(this);
            const name = $card.find('h2, h3, h4, .title, .name').first().text().trim();
            const description = $card.find('p, .description, .excerpt').first().text().trim();
            const website = $card.find('a[href^="http"]').not(`[href*="${network.key}"]`).first().attr('href');

            if (name && name.length > 2 && name.length < 200) {
              enterprises.push({ name, description, website });
            }
          });
          found = true;
          break;
        }
      }

      if (!found) {
        // Fallback: look for lists of organisation names
        $('li, .item').each(function() {
          const text = $(this).text().trim();
          const link = $(this).find('a').first();
          const name = link.length > 0 ? link.text().trim() : text;
          const website = link.attr('href');

          if (name && name.length > 3 && name.length < 150 && !/menu|nav|contact|about|home|privacy|terms/i.test(name)) {
            enterprises.push({
              name,
              website: website?.startsWith('http') ? website : null,
            });
          }
        });
      }

      if (enterprises.length > 0) {
        log(`  Found ${enterprises.length} from ${url}`);
        break; // Got results, skip other URL variants
      }
    } catch (err) {
      log(`  Error: ${err.message}`);
    }
  }

  return enterprises;
}

async function run() {
  log('Starting state SE network imports...');
  const totalStats = { total: 0, upserted: 0, errors: 0 };

  const networks = SINGLE_SOURCE
    ? NETWORKS.filter(n => n.key === SINGLE_SOURCE)
    : NETWORKS;

  for (const network of networks) {
    log(`\n${network.name} (${network.state}):`);
    const enterprises = await scrapeNetwork(network);

    if (enterprises.length === 0) {
      log(`  No enterprises found — site may need manual review`);
      continue;
    }

    // Deduplicate by name (same state, so name is the unique part)
    const seen = new Set();
    const upsertRows = enterprises
      .map(e => ({
        name: e.name,
        description: e.description || null,
        website: e.website || null,
        state: network.state,
        org_type: 'social_enterprise',
        sector: inferSectors(e.description || e.name),
        source_primary: network.key,
        sources: [{ source: network.key, url: network.urls[0], scraped_at: new Date().toISOString() }],
      }))
      .filter(r => {
        const key = r.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    totalStats.total += upsertRows.length;

    if (DRY_RUN) {
      log(`  [DRY RUN] Would upsert ${upsertRows.length} records`);
      for (const r of upsertRows.slice(0, 3)) log(`    - ${r.name}`);
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

    // Rate limit between networks
    await new Promise(r => setTimeout(r, 2000));
  }

  log(`\nDone! Total: ${totalStats.total}, Upserted: ${totalStats.upserted}, Errors: ${totalStats.errors}`);
}

run().catch(err => {
  console.error('[import-state-se] Fatal:', err);
  process.exit(1);
});
