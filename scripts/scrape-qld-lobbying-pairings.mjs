#!/usr/bin/env node
/**
 * scrape-qld-lobbying-pairings.mjs
 *
 * Uses headless browser (gstack/browse) to scrape QLD lobbying entity detail pages
 * and extract client-lobbyist pairings from the Dynamics 365 Power Pages portal.
 *
 * Output: data/qld-lobbying-pairings.json
 *
 * Usage:
 *   node scripts/scrape-qld-lobbying-pairings.mjs           # full scrape
 *   node scripts/scrape-qld-lobbying-pairings.mjs --limit 5  # test with 5 entities
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const B = '/Users/benknight/.claude/skills/gstack/browse/dist/browse';
const BASE_URL = 'https://lobbyists.integrity.qld.gov.au';
const OUTPUT = 'data/qld-lobbying-pairings.json';
const LIMIT = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : Infinity;

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function browse(cmd) {
  try {
    return execSync(`${B} ${cmd}`, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (err) {
    log(`  browse error: ${err.message?.slice(0, 120)}`);
    return '';
  }
}

function browseJs(code) {
  writeFileSync('/tmp/qld-browse-js.js', code);
  return browse('eval /tmp/qld-browse-js.js');
}

function sleep(ms) { execSync(`sleep ${ms / 1000}`); }

// -- Load existing ABN data from our CSV --

const existingAbns = new Map();
try {
  const csv = readFileSync('data/qld-lobbyists.csv', 'utf-8');
  for (const line of csv.split('\n').slice(1)) {
    const parts = [];
    let current = '';
    let inQuote = false;
    for (const char of line) {
      if (char === '"') { inQuote = !inQuote; continue; }
      if (char === ',' && !inQuote) { parts.push(current.trim()); current = ''; continue; }
      current += char;
    }
    parts.push(current.trim());
    if (parts[0] && parts[1]) existingAbns.set(parts[0], parts[1]);
  }
  log(`Loaded ${existingAbns.size} ABNs from existing CSV`);
} catch {}

// -- Phase 1: Collect all entity URLs --

async function collectEntityUrls() {
  log('Phase 1: Collecting entity URLs...');
  const allEntities = [];
  const seenIds = new Set();

  browse(`goto "${BASE_URL}/Lobbying-Register/"`);
  sleep(3000);

  for (let page = 1; page <= 10; page++) {
    log(`  Page ${page}...`);

    const raw = browseJs(`
      JSON.stringify(
        Array.from(document.querySelectorAll('a[href*="view-entity"]'))
          .filter(a => a.textContent.trim() !== 'View details')
          .map(a => ({ name: a.textContent.trim(), url: a.href }))
      )
    `);

    let links = [];
    try { links = JSON.parse(raw); } catch { log('    Failed to parse links'); }

    let added = 0;
    for (const link of links) {
      if (!link.url) continue;
      const idMatch = link.url.match(/id=([a-f0-9-]+)/);
      if (!idMatch) continue;
      const id = idMatch[1];
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      allEntities.push({ name: link.name, url: link.url, id });
      added++;
    }
    log(`    ${added} new (total: ${allEntities.length})`);

    // Click next page — pagination uses <a> tags inside <li> elements
    const nextResult = browseJs(`
      (() => {
        const next = document.querySelector('a[aria-label="Next page"]');
        if (next && !next.closest('li.disabled')) { next.click(); return 'clicked'; }
        return 'no-next';
      })()
    `);

    if (nextResult.includes('no-next')) break;
    sleep(3000);
    browse('wait --networkidle');
  }

  log(`  Total: ${allEntities.length} entities`);
  return allEntities;
}

// -- Phase 2: Extract data from detail pages --

// DOM structure: table.section[data-name="SUMMARY_TAB_section_N"]
//   section_3 = Officers (subgrid 0 = officers, subgrid 1 = employees)
//   section_4 = Clients (subgrid 0 = current clients, subgrid 1 = previous clients)
//   section_6 = Lobbyists
//   section_7 = Lobbying Activities
// Names in tr[data-name] attributes.

const EXTRACT_JS = `
(() => {
  const result = {
    abn: '',
    current_clients: [],
    previous_clients: [],
    officers: [],
    employees: [],
    lobbyist_people: [],
  };

  // ABN: find 11-digit number in account info section
  const acctSection = document.querySelector('[data-name="ACCOUNT_INFORMATION"]');
  if (acctSection) {
    const cells = acctSection.querySelectorAll('td, .value, span');
    for (const c of cells) {
      const t = c.textContent.trim().replace(/\\s/g, '');
      if (/^\\d{11}$/.test(t)) { result.abn = t; break; }
    }
  }

  function getRows(grid) {
    return Array.from(grid.querySelectorAll('tr[data-name]'))
      .filter(r => r.getAttribute('data-name')?.length > 1);
  }

  // Section 3: Officers (first subgrid) + Employees (second subgrid)
  const sec3 = document.querySelector('[data-name="SUMMARY_TAB_section_3"]');
  if (sec3) {
    const grids = sec3.querySelectorAll('.entity-grid.subgrid');
    if (grids[0]) {
      for (const row of getRows(grids[0])) {
        const cells = row.querySelectorAll('td');
        result.officers.push({
          name: row.getAttribute('data-name'),
          position: cells[1]?.textContent?.trim() || '',
        });
      }
    }
    if (grids[1]) {
      for (const row of getRows(grids[1])) {
        result.employees.push(row.getAttribute('data-name'));
      }
    }
  }

  // Section 4: Current Clients (first subgrid) + Previous Clients (second subgrid)
  const sec4 = document.querySelector('[data-name="SUMMARY_TAB_section_4"]');
  if (sec4) {
    const grids = sec4.querySelectorAll('.entity-grid.subgrid');
    if (grids[0]) {
      for (const row of getRows(grids[0])) {
        const cells = row.querySelectorAll('td');
        const dateText = cells[1]?.textContent?.trim() || '';
        const dateMatch = dateText.match(/(\\d{2}\\/\\d{2}\\/\\d{4})/);
        result.current_clients.push({
          name: row.getAttribute('data-name'),
          date: dateMatch ? dateMatch[1] : '',
        });
      }
    }
    if (grids[1]) {
      for (const row of getRows(grids[1])) {
        const cells = row.querySelectorAll('td');
        const dateText = cells[1]?.textContent?.trim() || '';
        const dateMatch = dateText.match(/(\\d{2}\\/\\d{2}\\/\\d{4})/);
        result.previous_clients.push({
          name: row.getAttribute('data-name'),
          date: dateMatch ? dateMatch[1] : '',
        });
      }
    }
  }

  // Section 6: Lobbyist people
  const sec6 = document.querySelector('[data-name="SUMMARY_TAB_section_6"]');
  if (sec6) {
    const grids = sec6.querySelectorAll('.entity-grid.subgrid');
    if (grids[0]) {
      for (const row of getRows(grids[0])) {
        const cells = row.querySelectorAll('td');
        result.lobbyist_people.push({
          name: row.getAttribute('data-name'),
          position_title: cells[1]?.textContent?.trim() || '',
          former_govt_rep: cells[2]?.textContent?.trim() === 'Yes',
        });
      }
    }
  }

  return JSON.stringify(result);
})()
`;

function scrapeEntityDetail(entity) {
  browse(`goto "${entity.url}"`);
  sleep(4000);
  browse('wait --networkidle');

  const raw = browseJs(EXTRACT_JS);
  let data;
  try { data = JSON.parse(raw); } catch {
    log(`    Failed to parse detail for ${entity.name}`);
    return null;
  }

  // Fallback ABN from our CSV
  if (!data.abn && existingAbns.has(entity.name)) {
    data.abn = existingAbns.get(entity.name);
  }

  const result = {
    entity_name: entity.name,
    entity_id: entity.id,
    entity_url: entity.url,
    abn: data.abn,
    current_clients: data.current_clients,
    previous_clients: data.previous_clients,
    officers: data.officers,
    employees: data.employees,
    lobbyist_people: data.lobbyist_people,
  };

  log(`    ${result.current_clients.length} current, ${result.previous_clients.length} previous clients`);
  return result;
}

// -- Main --

log('======================================================');
log('  QLD Lobbying Register — Client Pairing Scraper');
log(`  Limit: ${LIMIT === Infinity ? 'all' : LIMIT}`);
log('======================================================');

const entities = await collectEntityUrls();
const toScrape = entities.slice(0, LIMIT);

log(`\nPhase 2: Scraping ${toScrape.length} detail pages...`);

const results = [];
let totalCurrent = 0;
let totalPrevious = 0;

for (let i = 0; i < toScrape.length; i++) {
  log(`  [${i + 1}/${toScrape.length}] ${toScrape[i].name}`);
  const detail = scrapeEntityDetail(toScrape[i]);
  if (detail) {
    results.push(detail);
    totalCurrent += detail.current_clients.length;
    totalPrevious += detail.previous_clients.length;
  }

  if ((i + 1) % 10 === 0) {
    writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
    log(`  [checkpoint] Saved ${results.length} entities`);
  }

  if (i < toScrape.length - 1) sleep(1500);
}

writeFileSync(OUTPUT, JSON.stringify(results, null, 2));

log('\n======================================================');
log(`  Entities: ${results.length}`);
log(`  Current clients: ${totalCurrent}`);
log(`  Previous clients: ${totalPrevious}`);
log(`  Total pairings: ${totalCurrent + totalPrevious}`);
log(`  Output: ${OUTPUT}`);
log('======================================================');
