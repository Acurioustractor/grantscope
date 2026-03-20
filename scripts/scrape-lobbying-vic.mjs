#!/usr/bin/env node
/**
 * scrape-lobbying-vic.mjs
 *
 * Scrapes the Victoria Register of Lobbyists and inserts
 * lobbying relationships into gs_relationships.
 *
 * Data source: https://www.lobbyistsregister.vic.gov.au/
 *
 * STATUS: The Victorian lobbyists register website (lobbyistsregister.vic.gov.au)
 * is currently unreachable (DNS resolution fails, no HTTP response).
 * No alternative data source (open data portal, CSV download, GitHub mirror)
 * has been found.
 *
 * This script attempts multiple fallback strategies:
 *   1. The official register website
 *   2. data.vic.gov.au CKAN API
 *   3. vic.gov.au search
 *   4. Manual CSV file at data/vic-lobbyists.csv
 *
 * If all automated sources fail, the script exits gracefully with
 * instructions for manual data collection.
 *
 * Alternatives:
 *   - FOI request to the Victorian Public Sector Commission
 *   - Manual download when the register comes back online
 *   - Place a CSV file at data/vic-lobbyists.csv with columns:
 *     lobbyist_name,lobbyist_abn,client_name,client_abn
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-lobbying-vic.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-lobbying-vic';
const AGENT_NAME = 'VIC Lobbyist Register Scraper';
const DATASET = 'lobbying_register_vic';

const REGISTER_URL = 'https://www.lobbyistsregister.vic.gov.au/';
const USER_AGENT = 'Mozilla/5.0 (compatible; CivicGraph/1.0; +https://civicgraph.au)';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// -- Phase 1: Attempt to fetch register data ------------------------------

async function fetchRegister() {
  log('Phase 1: Attempting to fetch VIC lobbyist register...');

  // Strategy A: Try the official register website
  const webData = await tryOfficialRegister();
  if (webData) return webData;

  // Strategy B: Try data.vic.gov.au
  const openData = await tryOpenData();
  if (openData) return openData;

  // Strategy C: Try local CSV fallback
  const csvData = await tryLocalCsv();
  if (csvData) return csvData;

  // All strategies failed
  log('  All automated strategies failed.');
  log('  The VIC lobbyists register (lobbyistsregister.vic.gov.au) is unreachable.');
  log('');
  log('  To manually provide VIC lobbying data:');
  log('    1. Visit https://www.lobbyistsregister.vic.gov.au/ when it comes back online');
  log('    2. Export the data to a CSV file');
  log('    3. Save it as data/vic-lobbyists.csv with columns:');
  log('       lobbyist_name,lobbyist_abn,client_name,client_abn');
  log('    4. Re-run this script');

  return { lobbyists: [], clients: [] };
}

async function tryOfficialRegister() {
  log('  Strategy A: Official register website...');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(REGISTER_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      log(`    Register returned ${res.status}`);
      return null;
    }

    const html = await res.text();

    // Parse lobbyist data from HTML
    const lobbyists = [];
    const clients = [];

    // The VIC register may use a table-based layout
    const tableRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = html.match(tableRegex) || [];

    for (const row of rows) {
      const cells = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
      }

      if (cells.length >= 2 && cells[0] && cells[0].length > 2) {
        lobbyists.push({
          name: cells[0],
          abn: cells.find(c => /^\d{11}$/.test(c.replace(/\s/g, ''))) || '',
        });
      }
    }

    if (lobbyists.length > 0) {
      log(`    Found ${lobbyists.length} lobbyists from HTML`);
      return { lobbyists, clients };
    }

    // Try parsing JSON data if the page is an SPA
    const jsonRegex = /(?:data|lobbyists?)\s*[:=]\s*(\[[\s\S]*?\])\s*[;,]/i;
    const jsonMatch = html.match(jsonRegex);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (Array.isArray(data) && data.length > 0) {
          log(`    Found ${data.length} entries from inline JSON`);
          return {
            lobbyists: data.map(d => ({
              name: d.name || d.tradingName || d.businessName || '',
              abn: d.abn || '',
            })),
            clients: [],
          };
        }
      } catch { /* not valid JSON */ }
    }

    log('    Could not extract lobbyist data from HTML');
    return null;
  } catch (err) {
    log(`    Failed: ${err.message}`);
    return null;
  }
}

async function tryOpenData() {
  log('  Strategy B: data.vic.gov.au open data...');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      'https://discover.data.vic.gov.au/api/3/action/package_search?q=lobbyist+register&rows=5',
      {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      log(`    data.vic.gov.au returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.success || !data.result?.results?.length) {
      log('    No lobbyist datasets found on data.vic.gov.au');
      return null;
    }

    // Look for CSV or JSON resources
    for (const pkg of data.result.results) {
      for (const resource of pkg.resources || []) {
        if (['CSV', 'JSON'].includes(resource.format?.toUpperCase()) && resource.url) {
          log(`    Found resource: ${resource.name} (${resource.format})`);

          const resRes = await fetch(resource.url, {
            headers: { 'User-Agent': USER_AGENT },
          });

          if (resRes.ok) {
            const text = await resRes.text();
            // Parse CSV or JSON
            if (resource.format?.toUpperCase() === 'JSON') {
              const jsonData = JSON.parse(text);
              return parseOpenDataJson(jsonData);
            } else {
              return parseOpenDataCsv(text);
            }
          }
        }
      }
    }

    log('    No usable resources found');
    return null;
  } catch (err) {
    log(`    Failed: ${err.message}`);
    return null;
  }
}

function parseOpenDataJson(data) {
  const items = Array.isArray(data) ? data : data.records || data.results || [];
  if (items.length === 0) return null;

  const lobbyists = [];
  const clients = [];

  for (const item of items) {
    const name = item.lobbyist_name || item.trading_name || item.name || '';
    const abn = item.abn || '';
    if (name) {
      lobbyists.push({ name, abn });
      if (item.client_name || item.clients) {
        const clientList = item.clients || [item.client_name];
        for (const c of Array.isArray(clientList) ? clientList : [clientList]) {
          if (c) {
            clients.push({
              lobbyist_name: name,
              lobbyist_abn: abn,
              client_name: typeof c === 'string' ? c : c.name || '',
            });
          }
        }
      }
    }
  }

  return lobbyists.length > 0 ? { lobbyists, clients } : null;
}

function parseOpenDataCsv(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
  const lobbyists = [];
  const clients = [];
  const seen = new Set();

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

    if (lobName && !seen.has(lobName)) {
      seen.add(lobName);
      lobbyists.push({ name: lobName, abn: lobAbn });
    }

    if (lobName && clientName) {
      clients.push({ lobbyist_name: lobName, lobbyist_abn: lobAbn, client_name: clientName });
    }
  }

  return lobbyists.length > 0 ? { lobbyists, clients } : null;
}

async function tryLocalCsv() {
  const csvPath = 'data/vic-lobbyists.csv';
  log(`  Strategy C: Local CSV fallback (${csvPath})...`);

  if (!existsSync(csvPath)) {
    log('    No local CSV found');
    return null;
  }

  const csv = await readFile(csvPath, 'utf-8');
  const result = parseOpenDataCsv(csv);
  if (result) {
    log(`    Loaded ${result.lobbyists.length} lobbyists from local CSV`);
  }
  return result;
}

// -- Phase 2: Match to gs_entities ----------------------------------------

async function findEntity(name, abn) {
  if (!name && !abn) return null;

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
    log('  No lobbyist data available.');
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

  const relationships = [];

  for (const client of clients) {
    const lobEntity = lobbyistEntityCache.get(client.lobbyist_name);
    const clientEntity = await findEntity(client.client_name, client.client_abn || null);
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

  await mkdir('output', { recursive: true });
  await writeFile(
    'output/vic-lobbyist-relationships.json',
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

  // Phase 3b: Client-only matches
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
          note: 'Client of registered VIC lobbyist firm',
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
  log('  VIC Lobbyist Register Scraper');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('======================================================');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    const data = await fetchRegister();
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
