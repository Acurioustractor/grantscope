#!/usr/bin/env node
/**
 * download-arc-grants.mjs
 *
 * Downloads all ARC (Australian Research Council) NCGP grants via their public API.
 * 34,475 grants across 1,724 pages (20 per page).
 *
 * Usage:
 *   node scripts/download-arc-grants.mjs
 *
 * Output: tmp/arc-grants.json
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const OUTPUT = 'tmp/arc-grants.json';
const API_BASE = 'https://dataportal.arc.gov.au/NCGP/API/grants';
const PAGE_SIZE = 100; // Max per page

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function fetchPage(page) {
  try {
    const url = `${API_BASE}?page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`;
    const result = execSync(
      `curl -sL --max-time 30 -H "User-Agent: CivicGraph/1.0 (research)" -H "Accept: application/json" "${url}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 35000 }
    );
    return JSON.parse(result);
  } catch (e) {
    log(`  Error fetching page ${page}: ${e.message}`);
    return null;
  }
}

async function main() {
  log('═══ ARC Grants Download ═══');

  // Resume support
  let allGrants = [];
  let startPage = 1;
  if (existsSync(OUTPUT)) {
    const existing = JSON.parse(readFileSync(OUTPUT, 'utf8'));
    allGrants = existing.grants || [];
    startPage = Math.floor(allGrants.length / PAGE_SIZE) + 1;
    log(`  Resuming from page ${startPage} (${allGrants.length} grants already downloaded)`);
  }

  // Get first page to determine total
  const first = fetchPage(1);
  if (!first) { log('Failed to fetch first page'); return; }

  const totalGrants = first.meta['total-size'];
  const totalPages = first.meta['total-pages'];
  log(`  Total grants: ${totalGrants} across ${totalPages} pages`);

  if (startPage === 1) {
    for (const grant of first.data) {
      allGrants.push({
        id: grant.id,
        scheme: grant.attributes['scheme-name'],
        year: grant.attributes['funding-commencement-year'],
        org: grant.attributes['current-admin-organisation'],
        announcementOrg: grant.attributes['announcement-admin-organisation'],
        investigator: grant.attributes['lead-investigator'],
        amount: grant.attributes['current-funding-amount'],
        announcedAmount: grant.attributes['announced-funding-amount'],
        status: grant.attributes['grant-status'],
        summary: grant.attributes['grant-summary']?.substring(0, 500),
        program: grant.attributes['scheme-information']?.program,
      });
    }
    startPage = 2;
  }

  // Fetch remaining pages
  for (let page = startPage; page <= totalPages; page++) {
    const result = fetchPage(page);
    if (!result?.data) {
      log(`  Failed page ${page}, retrying...`);
      await new Promise(r => setTimeout(r, 2000));
      const retry = fetchPage(page);
      if (!retry?.data) { log(`  Skipping page ${page}`); continue; }
      result.data = retry.data;
    }

    for (const grant of result.data) {
      allGrants.push({
        id: grant.id,
        scheme: grant.attributes['scheme-name'],
        year: grant.attributes['funding-commencement-year'],
        org: grant.attributes['current-admin-organisation'],
        announcementOrg: grant.attributes['announcement-admin-organisation'],
        investigator: grant.attributes['lead-investigator'],
        amount: grant.attributes['current-funding-amount'],
        announcedAmount: grant.attributes['announced-funding-amount'],
        status: grant.attributes['grant-status'],
        summary: grant.attributes['grant-summary']?.substring(0, 500),
        program: grant.attributes['scheme-information']?.program,
      });
    }

    if (page % 50 === 0) {
      log(`  Progress: ${allGrants.length}/${totalGrants} grants (page ${page}/${totalPages})`);
      // Save checkpoint
      if (!existsSync('tmp')) mkdirSync('tmp');
      writeFileSync(OUTPUT, JSON.stringify({ grants: allGrants, meta: { totalGrants, totalPages, lastPage: page } }, null, 2));
    }

    // Be polite
    if (page % 10 === 0) await new Promise(r => setTimeout(r, 500));
  }

  // Final save
  if (!existsSync('tmp')) mkdirSync('tmp');
  writeFileSync(OUTPUT, JSON.stringify({ grants: allGrants, meta: { totalGrants, totalPages, lastPage: totalPages } }, null, 2));

  log(`  Done! ${allGrants.length} grants saved to ${OUTPUT}`);

  // Quick stats
  const byScheme = {};
  const byOrg = {};
  let totalAmount = 0;
  for (const g of allGrants) {
    byScheme[g.scheme] = (byScheme[g.scheme] || 0) + 1;
    byOrg[g.org] = (byOrg[g.org] || 0) + 1;
    totalAmount += g.amount || 0;
  }

  log(`\n  Grants by scheme:`);
  Object.entries(byScheme).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([k, v]) => log(`    ${v} | ${k}`));

  log(`\n  Top orgs:`);
  Object.entries(byOrg).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([k, v]) => log(`    ${v} | ${k}`));

  log(`\n  Total funding: $${(totalAmount / 1e9).toFixed(2)}B`);
}

main().catch(console.error);
