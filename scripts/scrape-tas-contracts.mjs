#!/usr/bin/env node
/**
 * Scrape Tasmania Government Awarded Contracts
 *
 * Source: https://www.tenders.tas.gov.au/ContractAwarded/Details/{id}
 * Sequential integer IDs, no bot protection, server-rendered HTML.
 *
 * Scrapes contract detail pages and writes to data/tas-contracts/contracts.json
 * then imports to austender_contracts.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-tas-contracts.mjs [--apply] [--max-id=14500] [--resume]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const RESUME = process.argv.includes('--resume');
const MAX_ID = parseInt(process.argv.find(a => a.startsWith('--max-id='))?.split('=')[1] || '14500', 10);
const DATA_DIR = 'data/tas-contracts';
const DATA_FILE = `${DATA_DIR}/contracts.json`;
const BASE_URL = 'https://www.tenders.tas.gov.au/ContractAwarded/Details';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const DELAY_MS = 500; // polite delay between requests

function extractField(html, ulName) {
  // TAS uses <ul name="FieldName"><li>value</li></ul> pattern
  const re = new RegExp(`<ul[^>]*name="${ulName}"[^>]*>\\s*<li>(.*?)</li>`, 'si');
  const m = html.match(re);
  if (m) return m[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return null;
}

function extractLabelValue(html, labelText) {
  // For fields using label text -> next editor-field div content
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}[\\s\\S]*?editor-field[\\s\\S]*?<(?:li|td|div)[^>]*>\\s*(.*?)\\s*</(?:li|td|div)>`, 'i');
  const m = html.match(re);
  if (m) return m[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return null;
}

function parseValue(val) {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(val) {
  if (!val) return null;
  // Try DD/MM/YYYY
  const dmyMatch = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
  const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  // Try "DD Month YYYY"
  const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
                   Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
                   January:'01', February:'02', March:'03', April:'04', June:'06',
                   July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
  const textMatch = val.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (textMatch && months[textMatch[2]]) {
    return `${textMatch[3]}-${months[textMatch[2]]}-${textMatch[1].padStart(2, '0')}`;
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchContract(id) {
  const url = `${BASE_URL}/${id}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CivicGraph Data Pipeline (civic transparency research)' },
    });
    if (res.status === 404 || res.status === 302) return null;
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 1000) return null; // too short, probably error page

    const title = extractField(html, 'ProcurementTitle');
    if (!title) return null;

    // Business name is in a <th>Business</th>...<td>...</td> inside a table (multiline)
    const supplierMatch = html.match(/<th[^>]*>\s*Business\s*<\/th>[\s\S]*?<td[^>]*>\s*([\s\S]*?)\s*<\/td>/i);
    const supplier = supplierMatch ? supplierMatch[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : null;

    const awardedDate = extractField(html, 'AwardedDate');
    const totalValue = extractField(html, 'TotalContractValue');
    const allocatedAmount = extractField(html, 'AllocatedAmount');
    const agency = extractField(html, 'Agency');
    const category = extractField(html, 'UNSPSCDescription');
    const method = extractField(html, 'ProcurementMethod');
    const description = extractField(html, 'Description');

    // Period is in a different format: "From DD/MM/YYYY to DD/MM/YYYY"
    const periodMatch = html.match(/From\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : null;

    // Parse period for start/end dates
    let contractStart = parseDate(awardedDate);
    let contractEnd = null;
    if (periodMatch) {
      contractStart = parseDate(periodMatch[1]);
      contractEnd = parseDate(periodMatch[2]);
    }

    return {
      id,
      title,
      supplier_name: supplier || null,
      contract_value: parseValue(totalValue) || parseValue(allocatedAmount),
      buyer_name: agency || null,
      category: category || null,
      procurement_method: method || null,
      contract_start: contractStart,
      contract_end: contractEnd,
      awarded_date: parseDate(awardedDate),
      description: description?.slice(0, 2000) || null,
    };
  } catch (err) {
    return null;
  }
}

async function main() {
  const run = await logStart(db, 'scrape-tas-contracts', 'Scrape TAS Awarded Contracts');

  try {
    console.log('=== Tasmania Awarded Contracts Scraper ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    console.log(`  Max ID: ${MAX_ID}`);

    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    // Load existing data if resuming
    let contracts = [];
    let startId = 1;
    if (RESUME && existsSync(DATA_FILE)) {
      contracts = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
      startId = Math.max(...contracts.map(c => c.id)) + 1;
      console.log(`  Resuming from ID ${startId} (${contracts.length} existing)`);
    }

    let notFound = 0;
    let consecutive404 = 0;

    for (let id = startId; id <= MAX_ID; id++) {
      if (id % 100 === 0) {
        console.log(`  Progress: ${id}/${MAX_ID} (${contracts.length} found, ${notFound} missing)`);
        // Save checkpoint
        writeFileSync(DATA_FILE, JSON.stringify(contracts, null, 2));
      }

      const contract = await fetchContract(id);
      if (contract) {
        contracts.push(contract);
        consecutive404 = 0;
      } else {
        notFound++;
        consecutive404++;
      }

      // If we get 200 consecutive 404s, we've probably hit the end
      if (consecutive404 > 200) {
        console.log(`  Stopped at ID ${id} after 200 consecutive missing entries`);
        break;
      }

      await sleep(DELAY_MS);
    }

    // Final save
    writeFileSync(DATA_FILE, JSON.stringify(contracts, null, 2));
    console.log(`\n  ${contracts.length} contracts scraped`);
    console.log(`  ${notFound} IDs not found`);

    const totalValue = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    console.log(`  Total value: $${(totalValue / 1e9).toFixed(2)}B`);

    // Top buyers
    const buyers = {};
    for (const c of contracts) {
      const b = c.buyer_name || 'Unknown';
      buyers[b] = (buyers[b] || 0) + 1;
    }
    console.log('\n=== Top Buyers ===');
    const sortedBuyers = Object.entries(buyers).sort((a, b) => b[1] - a[1]);
    for (const [buyer, count] of sortedBuyers.slice(0, 10)) {
      console.log(`  ${count.toString().padStart(5)} | ${buyer}`);
    }

    if (APPLY && contracts.length > 0) {
      console.log('\nUpserting to austender_contracts...');
      const rows = contracts.map(c => ({
        ocid: `tas-${c.id}`,
        title: c.title,
        description: c.description,
        contract_value: c.contract_value,
        currency: 'AUD',
        supplier_name: c.supplier_name,
        buyer_name: c.buyer_name,
        contract_start: c.contract_start,
        contract_end: c.contract_end,
        date_published: c.awarded_date ? new Date(c.awarded_date).toISOString() : null,
        category: c.category,
        procurement_method: c.procurement_method,
        source_url: 'https://www.tenders.tas.gov.au',
      }));

      let upserted = 0;
      let errors = 0;

      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db
          .from('austender_contracts')
          .upsert(chunk, { onConflict: 'ocid' });

        if (error) {
          console.error(`  Error at batch ${Math.floor(i / 500) + 1}: ${error.message}`);
          errors++;
        } else {
          upserted += chunk.length;
        }
      }

      console.log(`  ${upserted} upserted, ${errors} batch errors`);
    }

    if (!APPLY) console.log('\n  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: contracts.length + notFound,
      items_new: contracts.length,
      items_updated: APPLY ? contracts.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
