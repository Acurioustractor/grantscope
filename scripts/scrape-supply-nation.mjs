#!/usr/bin/env node
/**
 * Scrape Supply Nation Indigenous Business Direct (IBD) directory
 *
 * The IBD is a Salesforce Lightning community app. This script uses the
 * Salesforce Aura endpoint to call:
 *   1. CustomSearchController.searchForIds() — returns Account IDs + service tree
 *   2. CustomSearchController.getSuppliers() — returns SupplierProfile__c details
 *
 * The service tree from searchForIds contains supplierIds for every category,
 * giving us comprehensive coverage of the full directory.
 *
 * Saves results to data/supply-nation/supply_nation_businesses.csv
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const BASE_URL = 'https://ibd.supplynation.org.au';
const AURA_URL = `${BASE_URL}/public/s/sfsites/aura`;

const OUTPUT_DIR = join(PROJECT_ROOT, 'data', 'supply-nation');
const OUTPUT_CSV = join(OUTPUT_DIR, 'supply_nation_businesses.csv');
const OUTPUT_JSON = join(OUTPUT_DIR, 'supply_nation_businesses.json');

const BATCH_SIZE = 50;
const DELAY_MS = 400;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Session ───────────────────────────────────────────────────────
async function getSessionContext() {
  console.log('Getting session context...');
  const resp = await fetch(`${BASE_URL}/public/s/search-results`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    }
  });
  const html = await resp.text();

  const fwuidMatch = html.match(/fwuid%22%3A%22([^%]+(?:%[0-9A-Fa-f]{2}[^%]*)*?)%22/);
  const fwuid = fwuidMatch ? decodeURIComponent(fwuidMatch[1]) : null;
  const loadedMatch = html.match(/APPLICATION%40markup%3A%2F%2Fsiteforce%3AcommunityApp%22%3A%22([^%"]+)/);
  const loadedHash = loadedMatch ? loadedMatch[1] : null;
  const cookies = resp.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

  if (!fwuid || !loadedHash) throw new Error('Failed to extract aura context');
  console.log(`  fwuid: ${fwuid.substring(0, 40)}...`);
  return { fwuid, loadedHash, cookieStr };
}

// ─── Aura call ─────────────────────────────────────────────────────
async function auraCall(ctx, actions) {
  const auraContext = JSON.stringify({
    mode: 'PROD',
    fwuid: ctx.fwuid,
    app: 'siteforce:communityApp',
    loaded: { 'APPLICATION@markup://siteforce:communityApp': ctx.loadedHash }
  });

  const resp = await fetch(AURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': ctx.cookieStr,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: `message=${encodeURIComponent(JSON.stringify({ actions }))}&aura.context=${encodeURIComponent(auraContext)}&aura.token=undefined`
  });

  return resp.json();
}

// ─── Extract all IDs from service tree ─────────────────────────────
function extractIdsFromServices(services, allIds, serviceMap) {
  for (const svc of services) {
    if (svc.supplierIds) {
      for (const id of svc.supplierIds) {
        allIds.add(id);
        // Map supplier -> services
        if (!serviceMap.has(id)) serviceMap.set(id, []);
        const leaf = svc.childServices?.length === 0;
        if (leaf || !svc.childServices) {
          serviceMap.get(id).push(svc.name);
        }
      }
    }
    if (svc.childServices?.length > 0) {
      extractIdsFromServices(svc.childServices, allIds, serviceMap);
    }
  }
}

// ─── Collect all supplier IDs ──────────────────────────────────────
async function collectAllIds(ctx) {
  console.log('\nPhase 1: Collecting all supplier IDs...');

  const allIds = new Set();
  const serviceMap = new Map(); // supplierId -> [service names]

  // First, do a broad search to get the service tree with all supplier IDs
  console.log('  Extracting IDs from service tree...');
  const searchTerms = ['indigenous', 'construction', 'the', 'aboriginal', 'pty'];

  for (const term of searchTerms) {
    try {
      const result = await auraCall(ctx, [{
        id: '1',
        descriptor: 'apex://CustomSearchController/ACTION$searchForIds',
        callingDescriptor: 'markup://c:customSearch',
        params: { searchText: term, searchCity: '', sourceSA: '' }
      }]);

      const action = result.actions?.[0];
      if (action?.state === 'SUCCESS') {
        const rv = action.returnValue;
        const ids = rv?.AccountIds || [];
        ids.forEach(id => allIds.add(id));

        // Extract all IDs from the service tree
        const services = rv?.Services || [];
        extractIdsFromServices(services, allIds, serviceMap);

        console.log(`    "${term}": ${ids.length} search IDs, cumulative: ${allIds.size} (serviceMap: ${serviceMap.size})`);
      }
    } catch (e) {
      console.log(`    "${term}": ERROR - ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  // Supplement with more search terms to catch businesses not in any service category
  console.log('  Supplementing with additional text searches...');
  const supplementTerms = [
    'group', 'trust', 'australia', 'national', 'first', 'people',
    'management', 'security', 'health', 'community', 'services',
    'consulting', 'cleaning', 'training', 'transport', 'catering',
    'media', 'labour', 'hire', 'environmental', 'cultural', 'education',
    'mining', 'civil', 'property', 'plumbing', 'landscaping',
    'painting', 'fencing', 'recruitment', 'staffing', 'logistics',
    'digital', 'creative', 'food', 'safety', 'fire', 'water',
    'land', 'earth', 'engineering', 'electrical', 'design', 'technology',
    'solutions', 'enterprise', 'supply', 'trading', 'printing',
    'north', 'south', 'east', 'west', 'central',
    'new', 'black', 'red', 'blue', 'green', 'white', 'gold',
    'star', 'rock', 'river', 'company', 'corporation',
    'foundation', 'council', 'association',
    'bros', 'sons', 'family',
  ];

  for (const term of supplementTerms) {
    try {
      const result = await auraCall(ctx, [{
        id: '1',
        descriptor: 'apex://CustomSearchController/ACTION$searchForIds',
        callingDescriptor: 'markup://c:customSearch',
        params: { searchText: term, searchCity: '', sourceSA: '' }
      }]);

      const action = result.actions?.[0];
      if (action?.state === 'SUCCESS') {
        const ids = action.returnValue?.AccountIds || [];
        const newCount = ids.filter(id => !allIds.has(id)).length;
        ids.forEach(id => allIds.add(id));
        if (newCount > 0) {
          console.log(`    "${term}": +${newCount} new (total: ${allIds.size})`);
        }
      }
    } catch (e) {
      // skip
    }
    await sleep(200);
  }

  // Try targeted 2-letter searches that commonly appear in business names
  // (Skip exhaustive 676-combo search — diminishing returns after service tree extraction)
  console.log('  Running targeted prefix searches...');
  const prefixes = [
    'ab', 'ac', 'ad', 'ag', 'al', 'am', 'an', 'ar', 'au',
    'ba', 'be', 'bi', 'bl', 'bo', 'br', 'bu',
    'ca', 'ch', 'ci', 'cl', 'co', 'cr', 'cu',
    'da', 'de', 'di', 'do', 'dr', 'du',
    'ea', 'el', 'em', 'en', 'eq', 'ev', 'ex',
    'fa', 'fi', 'fl', 'fo', 'fr', 'fu',
    'ga', 'ge', 'gi', 'gl', 'go', 'gr', 'gu',
    'ha', 'he', 'hi', 'ho', 'hu',
    'im', 'in', 'ir', 'is',
    'ja', 'je', 'ji', 'jo', 'ju',
    'ka', 'ke', 'ki', 'kn', 'ko', 'ku',
    'la', 'le', 'li', 'lo', 'lu',
    'ma', 'me', 'mi', 'mo', 'mu',
    'na', 'ne', 'ni', 'no', 'nu',
    'oc', 'of', 'on', 'op', 'or', 'ou',
    'pa', 'pe', 'pi', 'pl', 'po', 'pr', 'pu',
    'qu',
    'ra', 're', 'ri', 'ro', 'ru',
    'sa', 'sc', 'se', 'sh', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sp', 'sq', 'st', 'su', 'sw', 'sy',
    'ta', 'te', 'th', 'ti', 'to', 'tr', 'tu', 'tw',
    'un', 'up', 'ur',
    'va', 've', 'vi', 'vo',
    'wa', 'we', 'wh', 'wi', 'wo', 'wr',
    'ya', 'ye', 'yo',
    'ze',
  ];

  for (const term of prefixes) {
    try {
      const result = await auraCall(ctx, [{
        id: '1',
        descriptor: 'apex://CustomSearchController/ACTION$searchForIds',
        callingDescriptor: 'markup://c:customSearch',
        params: { searchText: term, searchCity: '', sourceSA: '' }
      }]);

      const action = result.actions?.[0];
      if (action?.state === 'SUCCESS') {
        const ids = action.returnValue?.AccountIds || [];
        const newCount = ids.filter(id => !allIds.has(id)).length;
        ids.forEach(id => allIds.add(id));
        if (newCount > 0) {
          process.stdout.write(`    "${term}": +${newCount} `);
        }
      }
    } catch (e) {
      // skip
    }
    await sleep(150);
  }
  console.log('');

  console.log(`\n  Total unique supplier IDs: ${allIds.size}`);
  console.log(`  Service mappings: ${serviceMap.size} suppliers with services`);

  return { allIds: [...allIds], serviceMap };
}

// ─── Fetch supplier details ────────────────────────────────────────
async function getSupplierDetails(ctx, supplierIds) {
  console.log(`\nPhase 2: Fetching supplier details for ${supplierIds.length} IDs...`);

  const allSuppliers = [];
  const totalBatches = Math.ceil(supplierIds.length / BATCH_SIZE);
  let errors = 0;

  for (let i = 0; i < supplierIds.length; i += BATCH_SIZE) {
    const batch = supplierIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    if (batchNum % 10 === 1 || batchNum === totalBatches) {
      process.stdout.write(`  Batch ${batchNum}/${totalBatches}...`);
    }

    try {
      const result = await auraCall(ctx, [{
        id: '1',
        descriptor: 'apex://CustomSearchController/ACTION$getSuppliers',
        callingDescriptor: 'markup://c:customSearch',
        params: { supplierIds: batch }
      }]);

      const action = result.actions?.[0];
      if (action?.state === 'SUCCESS') {
        const suppliers = action.returnValue || [];
        allSuppliers.push(...suppliers);
        if (batchNum % 10 === 1 || batchNum === totalBatches) {
          console.log(` ${suppliers.length} suppliers (total: ${allSuppliers.length})`);
        }
      } else {
        errors++;
        if (batchNum % 10 === 1) console.log(' ERROR');
      }
    } catch (err) {
      errors++;
    }

    if (i + BATCH_SIZE < supplierIds.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`  Fetched: ${allSuppliers.length} suppliers (${errors} batch errors)`);
  return allSuppliers;
}

// ─── Normalize supplier data ───────────────────────────────────────
function normalizeSuppliers(rawSuppliers, serviceMap) {
  return rawSuppliers.map(s => {
    const supplierId = s.Id || '';
    const states = s.Account__r?.Cities__c || '';

    return {
      supplier_profile_id: supplierId,
      account_id: s.Account__c || '',
      name: s.AccountName__c || '',
      certified: s.Certified__c === true ? 'Certified' : 'Registered',
      indigenous_marketplace: s.IndigenousMarketplace__c === true ? 'Yes' : 'No',
      services_all_australia: s.IServiceAllAustralia__c === true ? 'Yes' : 'No',
      states: states.replace(/;/g, ', '),
      annual_revenue: s.CompanysAnnualRevenue__c || '',
      employees: s.Employees__c != null ? String(s.Employees__c) : '',
      ownership_structure: s.Whatownershipstructureisyourcompany__c || '',
      services: (serviceMap.get(supplierId) || []).join('; '),
    };
  });
}

// ─── CSV export ────────────────────────────────────────────────────
function saveToCSV(suppliers, filepath) {
  if (suppliers.length === 0) return;

  const headers = Object.keys(suppliers[0]);
  const rows = suppliers.map(s =>
    headers.map(h => {
      let val = String(s[h] || '');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',')
  );

  writeFileSync(filepath, [headers.join(','), ...rows].join('\n'), 'utf-8');
  console.log(`\nSaved ${suppliers.length} businesses to ${filepath}`);
}

// ─── Stats ─────────────────────────────────────────────────────────
function printStats(suppliers) {
  console.log('\n════════════════════════════════════════════');
  console.log('  SUPPLY NATION DIRECTORY — SCRAPE RESULTS');
  console.log('════════════════════════════════════════════');
  console.log(`Total businesses: ${suppliers.length}`);

  // Certification
  const byCert = {};
  for (const s of suppliers) {
    byCert[s.certified] = (byCert[s.certified] || 0) + 1;
  }
  console.log('\nCertification:');
  for (const [cert, count] of Object.entries(byCert).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cert}: ${count}`);
  }

  // States (businesses can operate in multiple states)
  const byState = {};
  for (const s of suppliers) {
    const states = s.states ? s.states.split(', ') : ['Unknown'];
    for (const state of states) {
      byState[state.trim()] = (byState[state.trim()] || 0) + 1;
    }
  }
  console.log('\nState coverage (businesses may be in multiple states):');
  for (const [state, count] of Object.entries(byState).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${state}: ${count}`);
  }

  // Revenue distribution
  const byRevenue = {};
  for (const s of suppliers) {
    byRevenue[s.annual_revenue || 'Unknown'] = (byRevenue[s.annual_revenue || 'Unknown'] || 0) + 1;
  }
  console.log('\nRevenue distribution:');
  for (const [rev, count] of Object.entries(byRevenue).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rev}: ${count}`);
  }

  // Ownership
  const byOwn = {};
  for (const s of suppliers) {
    byOwn[s.ownership_structure || 'Unknown'] = (byOwn[s.ownership_structure || 'Unknown'] || 0) + 1;
  }
  console.log('\nOwnership structure:');
  for (const [own, count] of Object.entries(byOwn).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${own}: ${count}`);
  }

  // With services
  const withServices = suppliers.filter(s => s.services.length > 0).length;
  console.log(`\nWith service categories: ${withServices} (${(withServices / suppliers.length * 100).toFixed(1)}%)`);

  // Note about ABNs
  console.log('\nNote: ABNs are not exposed through the IBD public API.');
  console.log('ABN matching will be done via name-matching against gs_entities in the ingestion script.');
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const ctx = await getSessionContext();

  // Phase 1: Collect all IDs
  const { allIds, serviceMap } = await collectAllIds(ctx);

  if (allIds.length === 0) {
    console.log('No results found.');
    return;
  }

  // Phase 2: Fetch details
  const rawSuppliers = await getSupplierDetails(ctx, allIds);

  // Save raw JSON
  writeFileSync(OUTPUT_JSON, JSON.stringify(rawSuppliers, null, 2), 'utf-8');
  console.log(`Saved raw JSON to ${OUTPUT_JSON}`);

  // Normalize and save CSV
  const suppliers = normalizeSuppliers(rawSuppliers, serviceMap);
  saveToCSV(suppliers, OUTPUT_CSV);

  // Stats
  printStats(suppliers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
