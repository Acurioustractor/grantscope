#!/usr/bin/env node
/**
 * scrape-lobbying-sa.mjs
 *
 * Scrapes the South Australia Register of Lobbyists and inserts
 * lobbying relationships into gs_relationships.
 *
 * Data source: https://www.lobbyists.sa.gov.au/
 * API: https://saglobbyistapi02prdaue.azurewebsites.net/api/lobbyist
 *      https://saglobbyistapi02prdaue.azurewebsites.net/api/client?lobbyistId=X
 *
 * The SA register has a clean REST API that returns JSON with lobbyist firms
 * (including ABNs) and their clients.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-lobbying-sa.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-lobbying-sa';
const AGENT_NAME = 'SA Lobbyist Register Scraper';
const DATASET = 'lobbying_register_sa';

const API_BASE = 'https://saglobbyistapi02prdaue.azurewebsites.net/api';
const USER_AGENT = 'CivicGraph/1.0 (research; civicgraph.au)';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const delay = ms => new Promise(r => setTimeout(r, ms));

// -- Phase 1: Fetch register data via API ---------------------------------

async function fetchRegister() {
  log('Phase 1: Fetching SA lobbyist register via API...');

  // Fetch all lobbyists
  const lobRes = await fetch(`${API_BASE}/lobbyist`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });

  if (!lobRes.ok) {
    throw new Error(`SA lobbyist API returned ${lobRes.status}`);
  }

  const lobData = await lobRes.json();
  // API returns { $id, $values: [...] }
  const lobbyists = lobData.$values || lobData;

  // Filter to approved lobbyists only
  const approved = lobbyists.filter(
    l => l.StatusCode === 'STATUS_APPROVED' || !l.StatusCode
  );

  log(`  Total lobbyists: ${lobbyists.length}, Approved: ${approved.length}`);

  // Fetch clients for each lobbyist
  const allClients = [];
  for (let i = 0; i < approved.length; i++) {
    const lob = approved[i];
    try {
      const clientRes = await fetch(
        `${API_BASE}/client?lobbyistId=${lob.LobbyistId}`,
        { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } }
      );

      if (clientRes.ok) {
        const clientData = await clientRes.json();
        const clients = clientData.$values || clientData;
        if (Array.isArray(clients)) {
          for (const c of clients) {
            allClients.push({
              lobbyist_id: lob.LobbyistId,
              lobbyist_business_name: lob.BusinessName,
              lobbyist_trading_name: lob.TradingName,
              lobbyist_abn: (lob.Abn || '').replace(/\s/g, ''),
              client_name: c.Name || c.ClientName || '',
              client_start_date: c.StartDate,
              client_end_date: c.EndDate,
            });
          }
        }
      }
    } catch (err) {
      log(`  Warning: failed to fetch clients for ${lob.TradingName}: ${err.message}`);
    }

    if ((i + 1) % 20 === 0) {
      log(`  ${i + 1}/${approved.length} lobbyists queried for clients`);
      await delay(200); // polite rate limiting
    }
  }

  log(`  Clients found: ${allClients.length}`);

  // Save raw data
  await mkdir('output', { recursive: true });
  await writeFile(
    'output/sa-lobbyists-raw.json',
    JSON.stringify({ lobbyists: approved, clients: allClients }, null, 2)
  );

  return { lobbyists: approved, clients: allClients };
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

  // Build lobbyist lookup
  const lobbyistMap = new Map();
  for (const lob of lobbyists) {
    lobbyistMap.set(lob.LobbyistId, lob);
  }

  // Cache entity lookups for lobbyists
  const lobbyistEntityCache = new Map();
  for (const lob of lobbyists) {
    const name = lob.TradingName || lob.BusinessName;
    const abn = (lob.Abn || '').replace(/\s/g, '');
    const entity = await findEntity(name, abn);
    lobbyistEntityCache.set(lob.LobbyistId, entity);
    if (entity) stats.lobbyists_matched++;
  }

  log(`  Lobbyist firms matched: ${stats.lobbyists_matched}/${lobbyists.length}`);

  // Process each client relationship
  const relationships = [];

  for (const client of clients) {
    const lobEntity = lobbyistEntityCache.get(client.lobbyist_id);
    const clientEntity = await findEntity(client.client_name, null);
    if (clientEntity) stats.clients_matched++;

    relationships.push({
      lobbyist_name: client.lobbyist_trading_name || client.lobbyist_business_name,
      lobbyist_abn: client.lobbyist_abn,
      lobbyist_entity_id: lobEntity?.id || null,
      client_name: client.client_name,
      client_entity_id: clientEntity?.id || null,
    });
  }

  log(`  Client matches: ${stats.clients_matched}/${clients.length}`);

  // Save relationships data
  await writeFile(
    'output/sa-lobbyist-relationships.json',
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
          note: 'Client of registered SA lobbyist firm',
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
  log('  SA Lobbyist Register Scraper');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('======================================================');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    const data = await fetchRegister();
    const stats = await processData(data);

    await logComplete(db, runId, {
      items_found: stats.clients_total,
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
