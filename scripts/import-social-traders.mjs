#!/usr/bin/env node

/**
 * Import Social Traders Directory
 *
 * Uses Jina Reader to scrape the Social Traders certified social enterprise directory.
 * Source: https://www.socialtraders.com.au/find-a-social-enterprise/
 *
 * The directory returns 635 results in a paginated list. Jina renders the SPA
 * and returns plain text with structured fields per entry.
 *
 * Usage:
 *   node scripts/import-social-traders.mjs
 *   node scripts/import-social-traders.mjs --dry-run
 *   node scripts/import-social-traders.mjs --limit=50
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, upserted: 0, errors: 0 };
const DIRECTORY_URL = 'https://www.socialtraders.com.au/find-a-social-enterprise/';

function log(msg) {
  console.log(`[import-social-traders] ${msg}`);
}

function normaliseState(stateStr) {
  if (!stateStr) return null;
  const s = stateStr.trim().toUpperCase();
  // Handle multi-state entries — take the first one
  const states = s.split(/[,\s]+/).filter(Boolean);
  for (const st of states) {
    if (['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'].includes(st)) return st;
  }
  return null;
}

function mapServiceToSectors(services, description) {
  const text = `${services || ''} ${description || ''}`.toLowerCase();
  const sectors = [];
  if (/food|cafe|catering|restaurant|kitchen|coffee|hospitality/.test(text)) sectors.push('food');
  if (/employ|job|workforce|recruit|staffing/.test(text)) sectors.push('employment');
  if (/clean|laundry|facility|maintenance|garden|horticulture/.test(text)) sectors.push('facilities');
  if (/tech|digital|software|it\b|telecomm/.test(text)) sectors.push('technology');
  if (/art|craft|creative|design|gift/.test(text)) sectors.push('arts');
  if (/health|wellbeing|disability|medical|healthcare/.test(text)) sectors.push('health');
  if (/environment|sustain|recycle|waste|green|carbon/.test(text)) sectors.push('environment');
  if (/education|school|learning|training/.test(text)) sectors.push('education');
  if (/housing|accommodation/.test(text)) sectors.push('housing');
  if (/indigenous|first nations|aboriginal/.test(text)) sectors.push('indigenous');
  if (/community|social service/.test(text)) sectors.push('community');
  if (/build|construction|material/.test(text)) sectors.push('construction');
  if (/transport|logistics|delivery/.test(text)) sectors.push('logistics');
  if (/financ|insurance|banking/.test(text)) sectors.push('finance');
  if (/sport|recreation|fitness/.test(text)) sectors.push('sport');
  if (/office|admin|business/.test(text)) sectors.push('business_services');
  if (/manufactur|production|industrial/.test(text)) sectors.push('manufacturing');
  if (/cloth|textile|fashion|safety equipment/.test(text)) sectors.push('retail');
  if (/print|media|marketing/.test(text)) sectors.push('media');
  if (sectors.length === 0) sectors.push('community');
  return sectors;
}

/**
 * Parse Jina Reader plain text output from Social Traders directory.
 *
 * Each entry looks like:
 *   Company Name
 *   Description paragraph... Read more
 *   Service locations:
 *   VIC, NSW, ...
 *   Products & Services:
 *   Service list...
 *   Beneficiaries:
 *   Beneficiary type
 *   Visit Website
 */
function parseJinaOutput(text) {
  const enterprises = [];
  const lines = text.split('\n');

  // Skip header lines until we find "results found"
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/\d+\s+results?\s+found/i.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }

  // Skip "List View" / "Map View" lines
  while (startIdx < lines.length && /^(List View|Map View|$)/.test(lines[startIdx].trim())) {
    startIdx++;
  }

  let current = null;
  let phase = 'name'; // name -> description -> service_locations -> products -> beneficiaries

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // End markers
    if (line === 'Visit Website') {
      if (current && current.name) {
        enterprises.push(current);
      }
      current = null;
      phase = 'name';
      continue;
    }

    // Section markers
    if (line === 'Service locations:') {
      phase = 'service_locations';
      continue;
    }
    if (line.startsWith('Products & Services:') || line.startsWith('Products &amp; Services:')) {
      phase = 'products';
      continue;
    }
    if (line === 'Beneficiaries:') {
      phase = 'beneficiaries';
      continue;
    }

    // Parse based on current phase
    if (phase === 'name') {
      // This is a company name
      if (line.length > 2 && line.length < 200 && !line.startsWith('Social Enterprise Finder') && !line.startsWith('Welcome to')) {
        current = { name: line, description: '', locations: '', services: '', beneficiaries: '' };
        phase = 'description';
      }
      continue;
    }

    if (phase === 'description' && current) {
      // Description is everything before the first section marker
      if (current.description) {
        current.description += ' ' + line;
      } else {
        current.description = line;
      }
      // Clean up "Read more" suffix
      current.description = current.description.replace(/\s*Read more\s*$/, '');
      continue;
    }

    if (phase === 'service_locations' && current) {
      current.locations = line;
      phase = 'wait_products'; // Wait for next section
      continue;
    }

    if (phase === 'wait_products') {
      if (line.startsWith('Products')) {
        phase = 'products';
      }
      continue;
    }

    if (phase === 'products' && current) {
      current.services = line;
      phase = 'wait_beneficiaries';
      continue;
    }

    if (phase === 'wait_beneficiaries') {
      if (line === 'Beneficiaries:') {
        phase = 'beneficiaries';
      }
      continue;
    }

    if (phase === 'beneficiaries' && current) {
      current.beneficiaries = line;
      phase = 'wait_visit'; // Wait for "Visit Website"
      continue;
    }

    if (phase === 'wait_visit') {
      // Already handled by "Visit Website" check above
      continue;
    }
  }

  // Don't forget last entry
  if (current && current.name) {
    enterprises.push(current);
  }

  return enterprises;
}

async function fetchAllPages() {
  const allEnterprises = [];
  const seen = new Set();
  let page = 1;
  const maxPages = 30;

  while (page <= maxPages) {
    const url = page === 1
      ? DIRECTORY_URL
      : `${DIRECTORY_URL}?page=${page}`;

    log(`Fetching page ${page}...`);

    try {
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          'Accept': 'text/plain',
          'X-Return-Format': 'text',
        },
      });

      if (!res.ok) {
        log(`  Jina returned ${res.status} — stopping`);
        break;
      }

      const text = await res.text();
      const enterprises = parseJinaOutput(text);

      if (enterprises.length === 0) {
        log(`  No entries found — stopping`);
        break;
      }

      // Check for duplicates (end of pagination)
      const newEntries = enterprises.filter(e => !seen.has(e.name.toLowerCase()));
      if (newEntries.length === 0) {
        log(`  All duplicates — reached end`);
        break;
      }

      for (const e of enterprises) {
        const key = e.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        allEnterprises.push(e);
      }

      log(`  Page ${page}: ${enterprises.length} entries, ${newEntries.length} new, ${allEnterprises.length} total`);

      if (LIMIT && allEnterprises.length >= LIMIT) break;

      page++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      log(`  Error: ${err.message}`);
      if (page === 1) throw err;
      break;
    }
  }

  return allEnterprises;
}

async function run() {
  log('Starting Social Traders import via Jina Reader...');

  const enterprises = await fetchAllPages();
  log(`Found ${enterprises.length} certified social enterprises`);

  const rows = LIMIT ? enterprises.slice(0, LIMIT) : enterprises;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const upsertRows = batch.map(e => {
      const state = normaliseState(e.locations);
      return {
        name: e.name,
        description: e.description || null,
        state,
        org_type: 'social_enterprise',
        sector: mapServiceToSectors(e.services, e.description),
        certifications: [{ body: 'social-traders', status: 'certified' }],
        source_primary: 'social-traders',
        sources: [{
          source: 'social-traders',
          url: DIRECTORY_URL,
          scraped_at: new Date().toISOString(),
          beneficiaries: e.beneficiaries || null,
          services: e.services || null,
        }],
      };
    }).filter(r => r.name && r.name !== 'Social Traders SE New Portal'); // Skip test entry

    stats.total += upsertRows.length;

    if (DRY_RUN) {
      log(`[DRY RUN] Would upsert ${upsertRows.length} records`);
      for (const r of upsertRows.slice(0, 5)) log(`  - ${r.name} (${r.state || 'multi-state'})`);
      stats.upserted += upsertRows.length;
      continue;
    }

    // Handle multi-state entries by using null state (national orgs)
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
  console.error('[import-social-traders] Fatal:', err);
  process.exit(1);
});
