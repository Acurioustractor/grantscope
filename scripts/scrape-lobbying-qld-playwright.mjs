#!/usr/bin/env node
/**
 * scrape-lobbying-qld-playwright.mjs
 * 
 * Automated extraction of QLD Lobbyist Register using Playwright.
 * The Dynamics 365 Power Pages portal requires full browser JavaScript execution.
 * 
 * Prerequisites:
 *   npm install -D playwright
 *   npx playwright install chromium
 * 
 * Usage:
 *   node scripts/scrape-lobbying-qld-playwright.mjs [--dry-run]
 * 
 * Output:
 *   data/qld-lobbyists.csv — ready for ingestion by scrape-lobbying-qld.mjs
 */

import { writeFile } from 'fs/promises';

const DRY_RUN = process.argv.includes('--dry-run');
const BASE_URL = 'https://lobbyists.integrity.qld.gov.au';

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  log('QLD Lobbyist Register — Playwright Extraction');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    console.error('Playwright not installed. Run: npm install -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // --- Extract Lobbyists ---
    log('Phase 1: Extracting lobbyists...');
    await page.goto(`${BASE_URL}/Lobbying-Register/Search-lobbyists/`, { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });

    // Wait for entity grid to render
    await page.waitForSelector('table tbody tr, .view-grid table tbody tr', { timeout: 30000 });
    await delay(2000); // Extra wait for full render

    const lobbyists = [];
    let pageNum = 1;

    while (true) {
      const rows = await page.$$eval('table.table tbody tr, .view-grid table tbody tr', trs => {
        return trs.map(tr => {
          const cells = [...tr.querySelectorAll('td')];
          const texts = cells.map(c => c.textContent.trim());
          return { name: texts[0] || '', abn: texts[1] || '', raw: texts };
        }).filter(r => r.name.length > 2);
      });

      log(`  Page ${pageNum}: ${rows.length} lobbyists`);
      lobbyists.push(...rows);

      // Try next page
      const nextBtn = await page.$('.pagination .next:not(.disabled) a, a[aria-label="Next"]:not([disabled])');
      if (!nextBtn) break;
      
      await nextBtn.click();
      await delay(2000);
      await page.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {});
      pageNum++;
      
      if (pageNum > 20) {
        log('  Safety limit reached (20 pages)');
        break;
      }
    }

    // Deduplicate
    const uniqueLobs = new Map();
    for (const l of lobbyists) {
      if (!uniqueLobs.has(l.name)) uniqueLobs.set(l.name, l);
    }

    log(`  Total unique lobbyists: ${uniqueLobs.size}`);

    // --- Extract Clients ---
    log('\nPhase 2: Extracting clients...');
    await page.goto(`${BASE_URL}/Lobbying-Register/Search-clients/`, { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });

    await page.waitForSelector('table tbody tr', { timeout: 30000 }).catch(() => {});
    await delay(2000);

    const clients = [];
    pageNum = 1;

    while (true) {
      const rows = await page.$$eval('table.table tbody tr, .view-grid table tbody tr', trs => {
        return trs.map(tr => {
          const cells = [...tr.querySelectorAll('td')];
          const texts = cells.map(c => c.textContent.trim());
          return { client_name: texts[0] || '', lobbyist_name: texts[1] || '', raw: texts };
        }).filter(r => r.client_name.length > 2);
      });

      log(`  Page ${pageNum}: ${rows.length} clients`);
      clients.push(...rows);

      const nextBtn = await page.$('.pagination .next:not(.disabled) a, a[aria-label="Next"]:not([disabled])');
      if (!nextBtn) break;
      
      await nextBtn.click();
      await delay(2000);
      await page.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {});
      pageNum++;
      
      if (pageNum > 50) break;
    }

    log(`  Total client records: ${clients.length}`);

    // --- Generate CSV ---
    log('\nPhase 3: Generating CSV...');
    const csvLines = ['lobbyist_name,lobbyist_abn,client_name,client_abn'];

    // Add lobbyist-only entries (for firms without client data)
    const lobsWithClients = new Set(clients.map(c => c.lobbyist_name));
    for (const [name, lob] of uniqueLobs) {
      if (!lobsWithClients.has(name)) {
        const cleanName = name.replace(/"/g, '""');
        const cleanAbn = (lob.abn || '').replace(/[^0-9]/g, '');
        csvLines.push(`"${cleanName}","${cleanAbn}","",""`);
      }
    }

    // Add client entries (includes lobbyist name)
    for (const c of clients) {
      const lobName = (c.lobbyist_name || '').replace(/"/g, '""');
      const clientName = (c.client_name || '').replace(/"/g, '""');
      // Try to get ABN from our lobbyist lookup
      const lobData = uniqueLobs.get(c.lobbyist_name);
      const lobAbn = lobData ? (lobData.abn || '').replace(/[^0-9]/g, '') : '';
      csvLines.push(`"${lobName}","${lobAbn}","${clientName}",""`);
    }

    const csv = csvLines.join('\n');
    const outputPath = 'data/qld-lobbyists.csv';

    if (DRY_RUN) {
      log(`DRY RUN: would write ${csvLines.length - 1} rows to ${outputPath}`);
      log('Sample rows:');
      csvLines.slice(0, 6).forEach(l => log(`  ${l}`));
    } else {
      await writeFile(outputPath, csv);
      log(`Wrote ${csvLines.length - 1} rows to ${outputPath}`);
    }

    log('\nDone. Run `node --env-file=.env scripts/scrape-lobbying-qld.mjs` to ingest.');

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
