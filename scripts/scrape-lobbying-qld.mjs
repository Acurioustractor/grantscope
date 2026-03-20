#!/usr/bin/env node
/**
 * scrape-lobbying-qld.mjs
 *
 * Scrapes the Queensland Register of Lobbyists and inserts
 * lobbying relationships into gs_relationships.
 *
 * Data source: https://lobbyists.integrity.qld.gov.au/
 * Maintained by the QLD Integrity Commissioner.
 *
 * Strategy: QLD uses a Dynamics 365 Power Pages portal. The entity grid API
 * requires session cookies with Azure B2C auth, so direct API calls return 500.
 * We fall back to parsing the HTML search pages, which contain lobbyist names
 * rendered as links and table data. A secondary approach fetches individual
 * lobbyist detail pages which may contain client info.
 *
 * If the portal blocks scraping entirely, the script produces a stub output
 * noting the issue for manual data collection.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-lobbying-qld.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-lobbying-qld';
const AGENT_NAME = 'QLD Lobbyist Register Scraper';
const DATASET = 'lobbying_register_qld';

const BASE_URL = 'https://lobbyists.integrity.qld.gov.au';
const USER_AGENT = 'Mozilla/5.0 (compatible; CivicGraph/1.0; +https://civicgraph.au)';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const delay = ms => new Promise(r => setTimeout(r, ms));

// -- Phase 1: Scrape the register -----------------------------------------

async function scrapeRegister() {
  log('Phase 1: Fetching QLD lobbyist register...');

  // Strategy A: Try the Dynamics 365 entity grid API with session cookies
  const lobbyists = await tryEntityGridApi();
  if (lobbyists && lobbyists.length > 0) {
    log(`  Strategy A (entity grid API) succeeded: ${lobbyists.length} lobbyists`);
    return await enrichWithClients(lobbyists);
  }

  // Strategy B: Parse HTML from the search pages
  log('  Strategy A failed, trying HTML parsing...');
  const htmlLobbyists = await parseSearchPages();
  if (htmlLobbyists.length > 0) {
    log(`  Strategy B (HTML parsing) found ${htmlLobbyists.length} lobbyists`);
    return await enrichWithClients(htmlLobbyists);
  }

  // Strategy C: Local CSV fallback
  log('  Trying local CSV fallback...');
  const csvData = await tryLocalCsv();
  if (csvData) return csvData;

  // All strategies failed
  log('  All strategies failed. QLD Dynamics 365 portal requires browser session.');
  log('  To manually provide QLD lobbying data:');
  log('    1. Visit https://lobbyists.integrity.qld.gov.au/ in a browser');
  log('    2. Export the Search Lobbyists and Search Clients data');
  log('    3. Save as data/qld-lobbyists.csv with columns:');
  log('       lobbyist_name,lobbyist_abn,client_name,client_abn');
  log('    4. Re-run this script');
  return { lobbyists: [], clients: [] };
}

async function tryLocalCsv() {
  const csvPath = 'data/qld-lobbyists.csv';
  if (!existsSync(csvPath)) {
    log(`    No local CSV found at ${csvPath}`);
    return null;
  }

  const csv = await readFile(csvPath, 'utf-8');
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
  const lobbyists = [];
  const clients = [];
  const seenLob = new Set();

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuote = false;
    for (const char of lines[i]) {
      if (char === '"') { inQuote = !inQuote; continue; }
      if (char === ',' && !inQuote) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    const lobName = row.lobbyist_name || row.trading_name || row.name || '';
    const lobAbn = row.lobbyist_abn || row.abn || '';
    const clientName = row.client_name || row.client || '';

    if (lobName && !seenLob.has(lobName)) {
      seenLob.add(lobName);
      lobbyists.push({ name: lobName, abn: lobAbn, id: '' });
    }

    if (lobName && clientName) {
      clients.push({ lobbyist_name: lobName, lobbyist_abn: lobAbn, client_name: clientName });
    }
  }

  if (lobbyists.length > 0) {
    log(`    Loaded ${lobbyists.length} lobbyists, ${clients.length} clients from local CSV`);
    await mkdir('output', { recursive: true });
    await writeFile('output/qld-lobbyists-raw.json', JSON.stringify({ lobbyists, clients }, null, 2));
    return { lobbyists, clients };
  }

  return null;
}

async function tryEntityGridApi() {
  try {
    // Fetch the search page to get cookies
    const pageRes = await fetch(`${BASE_URL}/Lobbying-Register/Search-lobbyists/`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!pageRes.ok) return null;

    // Extract cookies
    const cookies = pageRes.headers.getSetCookie?.() || [];
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

    // Get anti-forgery token
    const tokenRes = await fetch(`${BASE_URL}/_layout/tokenhtml`, {
      headers: {
        'User-Agent': USER_AGENT,
        Cookie: cookieStr,
        Referer: `${BASE_URL}/Lobbying-Register/Search-lobbyists/`,
      },
    });

    const tokenHtml = await tokenRes.text();
    const tokenMatch = tokenHtml.match(/value="([^"]+)"/);
    const token = tokenMatch ? tokenMatch[1] : '';

    if (!token) {
      log('  Could not extract anti-forgery token');
      return null;
    }

    // Try the entity grid data endpoint
    const gridRes = await fetch(
      `${BASE_URL}/_services/entity-grid-data.json/44f6b10d-7da7-ed11-aad0-00224814b8f0`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          Cookie: cookieStr,
          Referer: `${BASE_URL}/Lobbying-Register/Search-lobbyists/`,
          'X-Requested-With': 'XMLHttpRequest',
          '__RequestVerificationToken': token,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          base64SecureConfiguration: '',
          sortExpression: 'dpc_entity ASC',
          search: '',
          page: 1,
          pageSize: 500,
          filter: '',
          metaFilter: '',
        }),
      }
    );

    if (!gridRes.ok) {
      log(`  Entity grid API returned ${gridRes.status}`);
      return null;
    }

    const contentType = gridRes.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      log('  Entity grid API returned non-JSON response');
      return null;
    }

    const data = await gridRes.json();
    const records = data.Records || [];

    return records.map(r => ({
      name: r.dpc_entity || r.name || '',
      abn: r.dpc_abn || r.abn || '',
      id: r.Id || r.id || '',
    }));
  } catch (err) {
    log(`  Entity grid API error: ${err.message}`);
    return null;
  }
}

async function parseSearchPages() {
  const lobbyists = [];

  // The search pages may have lobbyist data rendered in table rows
  const pages = [
    '/Lobbying-Register/Search-lobbyists/',
    '/Lobbying-Register/Search-clients/',
    '/Lobbying-Register/',
  ];

  for (const path of pages) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Extract lobbyist/entity names from table rows
      // QLD uses table.entitylist with td cells
      const tdRegex = /<td[^>]*data-attribute="dpc_entity"[^>]*>([^<]+)<\/td>/gi;
      let match;
      while ((match = tdRegex.exec(html)) !== null) {
        const name = match[1].trim();
        if (name && name.length > 2) {
          lobbyists.push({ name, abn: '', id: '' });
        }
      }

      // Also try generic anchor links to lobbyist detail pages
      // Exclude navigation items (Search X, Register, etc.)
      const NAV_BLACKLIST = new Set([
        'search', 'register', 'back', 'next', 'previous', 'home',
        'search entities', 'search clients', 'search lobbyists',
        'search lobbying activity', 'login', 'sign in', 'sign out',
        'about', 'contact', 'help', 'faq',
      ]);
      const linkRegex = /href="\/Lobbying-Register\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
      while ((match = linkRegex.exec(html)) !== null) {
        const name = match[1].trim();
        if (
          name.length > 2 &&
          !NAV_BLACKLIST.has(name.toLowerCase()) &&
          !lobbyists.some(l => l.name === name)
        ) {
          lobbyists.push({ name, abn: '', id: '' });
        }
      }
    } catch (err) {
      log(`  Warning: failed to parse ${path}: ${err.message}`);
    }
  }

  // Deduplicate by name
  const unique = new Map();
  for (const l of lobbyists) {
    if (!unique.has(l.name)) unique.set(l.name, l);
  }

  return [...unique.values()];
}

async function enrichWithClients(lobbyists) {
  // Try to get client data from search-clients page
  const clients = [];

  try {
    const res = await fetch(`${BASE_URL}/Lobbying-Register/Search-clients/`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (res.ok) {
      const html = await res.text();

      // Look for client data in table cells
      const tdRegex = /<td[^>]*>([^<]+)<\/td>/gi;
      let match;
      while ((match = tdRegex.exec(html)) !== null) {
        const name = match[1].trim();
        if (
          name.length > 2 &&
          !/^\d/.test(name) &&
          !['Name', 'ABN', 'Status', 'Date'].includes(name)
        ) {
          // Without knowing which lobbyist this client belongs to,
          // we store them as unlinked client entries
          clients.push({
            lobbyist_name: 'Unknown',
            lobbyist_abn: '',
            client_name: name,
          });
        }
      }
    }
  } catch (err) {
    log(`  Warning: failed to fetch client page: ${err.message}`);
  }

  await mkdir('output', { recursive: true });
  await writeFile(
    'output/qld-lobbyists-raw.json',
    JSON.stringify({ lobbyists, clients }, null, 2)
  );

  return { lobbyists, clients };
}

// -- Phase 2: Match to gs_entities ----------------------------------------

async function findEntity(name, abn) {
  if (!name && !abn) return null;

  // Try ABN first
  if (abn) {
    const cleaned = abn.replace(/\s/g, '');
    if (/^\d{11}$/.test(cleaned)) {
      const { data } = await db
        .from('gs_entities')
        .select('id, gs_id, canonical_name, abn')
        .eq('abn', cleaned)
        .limit(1);
      if (data?.[0]) return data[0];
    }
  }

  // Try exact name match
  if (name) {
    const { data } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, abn')
      .ilike('canonical_name', name)
      .limit(1);
    if (data?.[0]) return data[0];
  }

  return null;
}

// -- Phase 3: Create relationships ----------------------------------------

async function processData({ lobbyists, clients }) {
  log('\nPhase 2: Matching lobbyists and clients to entities...');

  const stats = {
    lobbyist_firms: lobbyists.length,
    clients_total: clients.length,
    lobbyists_matched: 0,
    clients_matched: 0,
    relationships_created: 0,
  };

  if (lobbyists.length === 0) {
    log('  No lobbyist data available. QLD Dynamics 365 portal requires browser session.');
    log('  Alternative: manually download lobbyist list and place CSV at data/qld-lobbyists.csv');
    return stats;
  }

  // Cache entity lookups for lobbyists
  const lobbyistEntityCache = new Map();
  for (const lob of lobbyists) {
    const entity = await findEntity(lob.name, lob.abn);
    lobbyistEntityCache.set(lob.name, entity);
    if (entity) stats.lobbyists_matched++;
  }

  log(`  Lobbyist firms matched: ${stats.lobbyists_matched}/${lobbyists.length}`);

  // Process each client relationship
  const relationships = [];

  for (const client of clients) {
    const lobEntity = lobbyistEntityCache.get(client.lobbyist_name);
    const clientEntity = await findEntity(client.client_name, null);
    if (clientEntity) stats.clients_matched++;

    relationships.push({
      lobbyist_name: client.lobbyist_name,
      lobbyist_abn: client.lobbyist_abn || '',
      lobbyist_entity_id: lobEntity?.id || null,
      client_name: client.client_name,
      client_entity_id: clientEntity?.id || null,
    });
  }

  log(`  Client matches: ${stats.clients_matched}/${clients.length}`);

  // Save relationships data
  await writeFile(
    'output/qld-lobbyist-relationships.json',
    JSON.stringify(relationships, null, 2)
  );

  // Phase 3a: Insert where both sides are matched
  if (!DRY_RUN) {
    const matchedRels = relationships.filter(r => r.lobbyist_entity_id && r.client_entity_id);
    log(`\nPhase 3a: Inserting ${matchedRels.length} matched relationships...`);

    const BATCH = 50;
    for (let i = 0; i < matchedRels.length; i += BATCH) {
      const batch = matchedRels.slice(i, i + BATCH).map(r => ({
        source_entity_id: r.client_entity_id,
        target_entity_id: r.lobbyist_entity_id,
        relationship_type: 'lobbies_for',
        dataset: DATASET,
        properties: {
          lobbyist_name: r.lobbyist_name,
          client_name: r.client_name,
        },
      }));

      const { error } = await db
        .from('gs_relationships')
        .upsert(batch, {
          onConflict: 'source_entity_id,target_entity_id,relationship_type,dataset',
          ignoreDuplicates: true,
        });

      if (error) {
        for (const row of batch) {
          const { error: e2 } = await db.from('gs_relationships').insert(row);
          if (!e2) stats.relationships_created++;
        }
      } else {
        stats.relationships_created += batch.length;
      }
    }
    log(`  ${stats.relationships_created} relationships inserted`);
  }

  // Phase 3b: Client-only matches (self-referencing)
  if (!DRY_RUN) {
    const clientOnlyRels = relationships.filter(r => !r.lobbyist_entity_id && r.client_entity_id);
    const uniqueClients = new Map();
    for (const r of clientOnlyRels) {
      if (!uniqueClients.has(r.client_entity_id)) {
        uniqueClients.set(r.client_entity_id, []);
      }
      uniqueClients.get(r.client_entity_id).push(r.lobbyist_name);
    }
    log(`\nPhase 3b: Flagging ${uniqueClients.size} client entities as lobbying-connected...`);

    const BATCH_SIZE = 50;
    const clientBatches = [...uniqueClients.entries()];
    for (let i = 0; i < clientBatches.length; i += BATCH_SIZE) {
      const batch = clientBatches.slice(i, i + BATCH_SIZE).map(([clientId, lobbyistNames]) => ({
        source_entity_id: clientId,
        target_entity_id: clientId,
        relationship_type: 'lobbies_for',
        dataset: DATASET,
        properties: {
          lobbyist_firms: lobbyistNames.slice(0, 5),
          note: 'Client of registered QLD lobbyist firm',
        },
      }));

      const { error } = await db
        .from('gs_relationships')
        .upsert(batch, {
          onConflict: 'source_entity_id,target_entity_id,relationship_type,dataset',
          ignoreDuplicates: true,
        });

      if (error) {
        for (const row of batch) {
          const { error: e2 } = await db.from('gs_relationships').insert(row);
          if (!e2) stats.relationships_created++;
        }
      } else {
        stats.relationships_created += batch.length;
      }
    }
    log(`  ${uniqueClients.size} client lobbying flags inserted`);
  }

  log(`\n  Summary:`);
  log(`  Total: ${relationships.length} relationships`);
  log(`  Both matched: ${relationships.filter(r => r.lobbyist_entity_id && r.client_entity_id).length}`);
  log(`  Lobbyist only: ${relationships.filter(r => r.lobbyist_entity_id && !r.client_entity_id).length}`);
  log(`  Client only: ${relationships.filter(r => !r.lobbyist_entity_id && r.client_entity_id).length}`);
  log(`  Neither: ${relationships.filter(r => !r.lobbyist_entity_id && !r.client_entity_id).length}`);

  return stats;
}

// -- Main -----------------------------------------------------------------

async function main() {
  log('======================================================');
  log('  QLD Lobbyist Register Scraper');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('======================================================');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    const data = await scrapeRegister();
    const stats = await processData(data);

    await logComplete(db, runId, {
      items_found: stats.lobbyist_firms + stats.clients_total,
      items_new: stats.relationships_created,
    });

    log('\nDone.');
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
