#!/usr/bin/env node

/**
 * Import B Corp Australia Directory
 *
 * Uses Jina Reader to render the B Corp directory (SPA) and extract
 * Australian B Corps. Paginates through the full directory.
 *
 * Source: https://www.bcorporation.net/en-us/find-a-b-corp/
 *
 * Usage:
 *   node scripts/import-bcorp-au.mjs
 *   node scripts/import-bcorp-au.mjs --dry-run
 *   node scripts/import-bcorp-au.mjs --limit=50
 *   node scripts/import-bcorp-au.mjs --pages=5
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const pagesArg = process.argv.find(a => a.startsWith('--pages='));
const MAX_PAGES = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : 30;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, upserted: 0, errors: 0, skippedNonAu: 0 };

function log(msg) {
  console.log(`[import-bcorp] ${msg}`);
}

const DIRECTORY_URL = 'https://www.bcorporation.net/en-us/find-a-b-corp/';

// Australian location keywords to identify AU companies from descriptions
const AU_KEYWORDS = [
  'australia', 'australian', 'melbourne', 'sydney', 'brisbane', 'perth',
  'adelaide', 'hobart', 'darwin', 'canberra', 'gold coast', 'newcastle',
  'geelong', 'wollongong', 'cairns', 'townsville', 'sunshine coast',
  'fremantle', 'ballarat', 'bendigo', 'toowoomba', 'launceston',
  'new south wales', 'nsw', 'victoria', 'queensland', 'qld',
  'western australia', 'south australia', 'tasmania', 'northern territory',
  'pty ltd', 'pty. ltd.', // Australian company structure
  'aboriginal', 'first nations', // Indigenous Australian context
];

// Non-Australian keywords to exclude false positives
const NON_AU_KEYWORDS = [
  'united states', 'united kingdom', 'canada', 'france', 'germany', 'italy',
  'spain', 'netherlands', 'belgium', 'japan', 'korea', 'china', 'india',
  'brazil', 'mexico', 'new zealand', 'bangkok', 'thai', 'uk based',
  'us-based', 'headquartered in the us', 'london', 'new york', 'california',
  'oregon', 'texas', 'colorado', 'british columbia', 'ontario', 'dublin',
  'berlin', 'amsterdam', 'paris', 'barcelona', 'milan', 'copenhagen',
  'stockholm', 'oslo', 'helsinki', 'tokyo', 'singapore', 'hong kong',
  'nederland', 'italiano', 'española', 'deutsche', 'français',
];

function isLikelyAustralian(name, description) {
  const text = `${name} ${description || ''}`.toLowerCase();
  // Check for AU indicators
  const hasAuKeyword = AU_KEYWORDS.some(k => text.includes(k));
  if (!hasAuKeyword) return false;
  // Check for strong non-AU indicators (some descriptions mention AU but are based elsewhere)
  const hasNonAuKeyword = NON_AU_KEYWORDS.some(k => text.includes(k));
  // If both, check if AU keyword appears before non-AU (likely AU company mentioning international)
  if (hasNonAuKeyword) {
    const auIdx = AU_KEYWORDS.reduce((min, k) => {
      const idx = text.indexOf(k);
      return idx >= 0 && idx < min ? idx : min;
    }, Infinity);
    const nonAuIdx = NON_AU_KEYWORDS.reduce((min, k) => {
      const idx = text.indexOf(k);
      return idx >= 0 && idx < min ? idx : min;
    }, Infinity);
    return auIdx < nonAuIdx; // AU keyword appears first = likely AU company
  }
  return true;
}

function inferState(name, description) {
  const text = `${name} ${description || ''}`.toLowerCase();
  if (/\bmelbourne\b|\bgeelong\b|\bballarat\b|\bbendigo\b|\bvictoria\b|\bvic\b/.test(text)) return 'VIC';
  if (/\bsydney\b|\bnewcastle\b|\bwollongong\b|\bnew south wales\b|\bnsw\b/.test(text)) return 'NSW';
  if (/\bbrisbane\b|\bgold coast\b|\bsunshine coast\b|\bcairns\b|\btownsville\b|\bqueensland\b|\bqld\b/.test(text)) return 'QLD';
  if (/\bperth\b|\bfremantle\b|\bwestern australia\b/.test(text)) return 'WA';
  if (/\badelaide\b|\bsouth australia\b/.test(text)) return 'SA';
  if (/\bhobart\b|\blaunceston\b|\btasmania\b/.test(text)) return 'TAS';
  if (/\bdarwin\b|\balice springs\b|\bnorthern territory\b/.test(text)) return 'NT';
  if (/\bcanberra\b/.test(text)) return 'ACT';
  return null; // Could be anywhere in AU
}

function inferSectors(description) {
  if (!description) return ['community'];
  const t = description.toLowerCase();
  const sectors = [];
  if (/food|beverage|agriculture|farm|cafe|coffee/.test(t)) sectors.push('food');
  if (/tech|software|digital|data|platform|saas/.test(t)) sectors.push('technology');
  if (/consult|advisory|strategy|professional/.test(t)) sectors.push('consulting');
  if (/fashion|apparel|clothing|retail/.test(t)) sectors.push('retail');
  if (/financ|banking|invest|insurance|superannuation/.test(t)) sectors.push('finance');
  if (/energy|renewable|solar|clean|environment|sustain|carbon|climate/.test(t)) sectors.push('environment');
  if (/health|wellness|pharmaceutical|medical/.test(t)) sectors.push('health');
  if (/education|training|learning|school|university/.test(t)) sectors.push('education');
  if (/media|publishing|creative|design|brand|marketing/.test(t)) sectors.push('arts');
  if (/construction|real estate|property|architecture|building/.test(t)) sectors.push('construction');
  if (/travel|tourism|hospitality/.test(t)) sectors.push('hospitality');
  if (/manufactur|production/.test(t)) sectors.push('manufacturing');
  if (/employ|recruit|workforce|staffing/.test(t)) sectors.push('employment');
  if (sectors.length === 0) sectors.push('community');
  return sectors;
}

function parseJinaOutput(text) {
  // Jina Reader returns plain text. B Corp directory shows:
  //   Company Name\n\nDescription paragraph\n\nCertified since\nMonth Year
  const enterprises = [];
  const lines = text.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip navigation, cookie consent, and pagination text
    if (!line || /^(Cookie|We use|Limit|Accept|The Movement|Standards|Programs|About|Find a|News|Donate|Sign in|Looking|Sort by|Newest|Location|Ownership|More filters|Showing|Previous|Next|\d+$|The information|Transforming|Sign up|We take|Submit)/.test(line)) {
      i++;
      continue;
    }

    // Check if this looks like a "Certified since" marker
    if (line === 'Certified since') {
      i++;
      continue;
    }

    // Skip date lines (Month Year)
    if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/.test(line)) {
      i++;
      continue;
    }

    // Skip info_outline (placeholder for missing descriptions)
    if (line === 'info_outline') {
      i++;
      continue;
    }

    // Check if this line could be a company name:
    // - Relatively short (< 150 chars)
    // - Followed by either a description or "Certified since"
    // - Not a generic navigation item
    if (line.length > 2 && line.length < 150) {
      // Look ahead for description and "Certified since"
      let description = '';
      let j = i + 1;

      // Skip blank lines
      while (j < lines.length && !lines[j].trim()) j++;

      // Collect description lines until we hit "Certified since"
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (nextLine === 'Certified since') {
          // This confirms the previous text was a company entry
          enterprises.push({
            name: line,
            description: description.trim() || null,
          });
          break;
        }
        if (!nextLine) {
          j++;
          continue;
        }
        // If we've gone too far without finding "Certified since", this wasn't a company
        if (j - i > 50) break;
        description += (description ? ' ' : '') + nextLine;
        j++;
      }
    }

    i++;
  }

  return enterprises;
}

async function fetchPage(pageNum) {
  const url = `https://r.jina.ai/${DIRECTORY_URL}?query=Australia&page=${pageNum}&hitsPerPage=25`;
  log(`Fetching page ${pageNum}...`);

  const res = await fetch(url, {
    headers: {
      'Accept': 'text/plain',
      'X-Return-Format': 'text',
    },
  });

  if (!res.ok) throw new Error(`Jina returned ${res.status}`);
  return res.text();
}

async function run() {
  log('Starting B Corp Australia import via Jina Reader...');

  const allEnterprises = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const text = await fetchPage(page);
      const enterprises = parseJinaOutput(text);

      if (enterprises.length === 0) {
        log(`  Page ${page}: no entries found — stopping`);
        break;
      }

      // Check if this page returned same results (reached end)
      const newNames = enterprises.filter(e => !seen.has(e.name.toLowerCase()));
      if (newNames.length === 0) {
        log(`  Page ${page}: all duplicates — reached end`);
        break;
      }

      for (const e of enterprises) {
        const key = e.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        if (isLikelyAustralian(e.name, e.description)) {
          allEnterprises.push(e);
        } else {
          stats.skippedNonAu++;
        }
      }

      log(`  Page ${page}: ${enterprises.length} entries, ${newNames.length} new, ${allEnterprises.length} Australian so far`);

      if (LIMIT && allEnterprises.length >= LIMIT) break;

      // Rate limit between pages
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      log(`  Error on page ${page}: ${err.message}`);
      if (page === 1) throw err; // Fatal if first page fails
      break;
    }
  }

  log(`\nFound ${allEnterprises.length} Australian B Corps (skipped ${stats.skippedNonAu} non-AU)`);

  const rows = LIMIT ? allEnterprises.slice(0, LIMIT) : allEnterprises;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const upsertRows = batch.map(e => ({
      name: e.name,
      description: e.description || null,
      state: inferState(e.name, e.description),
      org_type: 'b_corp',
      sector: inferSectors(e.description),
      certifications: [{ body: 'b-corp', status: 'certified' }],
      source_primary: 'b-corp',
      sources: [{ source: 'b-corp', url: DIRECTORY_URL, scraped_at: new Date().toISOString() }],
    })).filter(r => r.name);

    stats.total += upsertRows.length;

    if (DRY_RUN) {
      log(`[DRY RUN] Would upsert ${upsertRows.length} records`);
      for (const r of upsertRows.slice(0, 5)) log(`  - ${r.name} (${r.state || '?'})`);
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
  console.error('[import-bcorp] Fatal:', err);
  process.exit(1);
});
