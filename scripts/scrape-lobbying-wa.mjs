#!/usr/bin/env node
/**
 * scrape-lobbying-wa.mjs
 *
 * Scrapes the Western Australia Register of Lobbyists and inserts
 * lobbying relationships into gs_relationships.
 *
 * Data source: https://www.lobbyists.wa.gov.au/
 * Strategy: WA renders lobbyist data inline as JavaScript gridData.push({...})
 * in the homepage HTML. Lobbyist names and ABNs are in the main page.
 * Detail pages (clients, owners) use Dynamics 365 entity grids requiring
 * browser sessions, so we scrape the detail page HTML for pre-rendered content.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-lobbying-wa.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-lobbying-wa';
const AGENT_NAME = 'WA Lobbyist Register Scraper';
const DATASET = 'lobbying_register_wa';

const REGISTER_URL = 'https://www.lobbyists.wa.gov.au/';
const USER_AGENT = 'Mozilla/5.0 (compatible; CivicGraph/1.0; +https://civicgraph.au)';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const delay = ms => new Promise(r => setTimeout(r, ms));

// -- Phase 1: Scrape the register -----------------------------------------

async function scrapeRegister() {
  log('Phase 1: Fetching WA lobbyist register...');

  const res = await fetch(REGISTER_URL, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`WA register returned ${res.status}`);
  }

  const html = await res.text();

  // Extract gridData.push({...}) entries from the inline JavaScript
  const lobbyists = [];
  const pushRegex = /gridData\.push\(\{([^}]+)\}\)/g;
  let match;

  while ((match = pushRegex.exec(html)) !== null) {
    const block = match[1];

    // Parse the JavaScript object properties
    const nameMatch = block.match(/name:\s*`([^`]*)`/);
    const abnMatch = block.match(/abn:\s*`([^`]*)`/);
    const updatedMatch = block.match(/lastUpdated:\s*'([^']*)'/);
    const idMatch = block.match(/companyId:\s*'([^']*)'/);

    if (nameMatch) {
      lobbyists.push({
        name: nameMatch[1].trim(),
        abn: abnMatch ? abnMatch[1].trim() : '',
        lastUpdated: updatedMatch ? updatedMatch[1].trim() : '',
        companyId: idMatch ? idMatch[1].trim() : '',
      });
    }
  }

  log(`  Found ${lobbyists.length} lobbyist firms`);

  // Fetch detail pages to get clients for each lobbyist
  const allClients = [];
  for (let i = 0; i < lobbyists.length; i++) {
    const lob = lobbyists[i];
    if (!lob.companyId) continue;

    try {
      const detailRes = await fetch(
        `${REGISTER_URL}searchdetails/?id=${lob.companyId}`,
        { headers: { 'User-Agent': USER_AGENT } }
      );

      if (detailRes.ok) {
        const detailHtml = await detailRes.text();

        // Parse clients from the detail page HTML
        // WA detail pages have "Client Details" section with a subgrid
        // The client names may be rendered as text in table cells or sections
        const clients = parseClientsFromDetailHtml(detailHtml, lob);
        allClients.push(...clients);
      }
    } catch (err) {
      log(`  Warning: failed to fetch details for ${lob.name}: ${err.message}`);
    }

    if ((i + 1) % 20 === 0) {
      log(`  ${i + 1}/${lobbyists.length} detail pages fetched`);
      await delay(500); // polite rate limiting
    }
  }

  log(`  Total client relationships found: ${allClients.length}`);

  // Save raw data
  await mkdir('output', { recursive: true });
  await writeFile(
    'output/wa-lobbyists-raw.json',
    JSON.stringify({ lobbyists, clients: allClients }, null, 2)
  );

  return { lobbyists, clients: allClients };
}

function parseClientsFromDetailHtml(html, lobbyist) {
  const clients = [];

  // WA detail pages use Dynamics 365 entity subgrids.
  // The client data may be pre-rendered in grid cells, or may only load
  // via AJAX (requiring session). We attempt to parse any visible data.

  // Look for table cells in the clients section
  // Pattern: <div id="clients" class="section">...<td>ClientName</td>...
  const clientSection = html.match(
    /id="clients"[\s\S]*?(?=id="|<\/body)/i
  );

  if (clientSection) {
    // Extract text from table cells
    const tdRegex = /<td[^>]*>([^<]+)<\/td>/gi;
    let tdMatch;
    const seenNames = new Set();
    while ((tdMatch = tdRegex.exec(clientSection[0])) !== null) {
      const name = tdMatch[1].trim();
      // Filter out non-client values (dates, statuses, etc.)
      if (
        name.length > 2 &&
        !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(name) &&
        !['Active', 'Inactive', 'Name', 'Status', 'Date'].includes(name) &&
        !seenNames.has(name)
      ) {
        seenNames.add(name);
        clients.push({
          lobbyist_name: lobbyist.name,
          lobbyist_abn: lobbyist.abn,
          client_name: name,
        });
      }
    }
  }

  // Also look for client names in div.xrm-attribute-value elements
  const attrRegex = /class="xrm-attribute-value"[^>]*>([^<]+)</gi;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(html)) !== null) {
    const name = attrMatch[1].trim();
    if (
      name.length > 2 &&
      !clients.some(c => c.client_name === name) &&
      !/^\d/.test(name) &&
      !['Client Details', 'Lobbyist Details', 'Owner Details'].includes(name)
    ) {
      clients.push({
        lobbyist_name: lobbyist.name,
        lobbyist_abn: lobbyist.abn,
        client_name: name,
      });
    }
  }

  return clients;
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

  // Cache entity lookups for lobbyists
  const lobbyistEntityCache = new Map();
  for (const lob of lobbyists) {
    const entity = await findEntity(lob.name, lob.abn);
    lobbyistEntityCache.set(lob.name, entity);
    if (entity) stats.lobbyists_matched++;
  }

  log(`  Lobbyist firms matched: ${stats.lobbyists_matched}/${lobbyists.length}`);

  // Process relationships
  const relationships = [];

  if (clients.length > 0) {
    // We have client data from detail pages
    for (const client of clients) {
      const lobEntity = lobbyistEntityCache.get(client.lobbyist_name);
      const clientEntity = await findEntity(client.client_name, null);
      if (clientEntity) stats.clients_matched++;

      relationships.push({
        lobbyist_name: client.lobbyist_name,
        lobbyist_abn: client.lobbyist_abn,
        lobbyist_entity_id: lobEntity?.id || null,
        client_name: client.client_name,
        client_entity_id: clientEntity?.id || null,
      });
    }
  } else {
    // No client data from detail pages (Dynamics 365 subgrids not pre-rendered)
    // Fall back to lobbyist-only mode: register each lobbyist firm
    log('  No client data extracted from detail pages (Dynamics 365 subgrids require browser session).');
    log('  Registering lobbyist firms as self-referencing lobbies_for relationships.');
    for (const lob of lobbyists) {
      const lobEntity = lobbyistEntityCache.get(lob.name);
      if (lobEntity) {
        relationships.push({
          lobbyist_name: lob.name,
          lobbyist_abn: lob.abn,
          lobbyist_entity_id: lobEntity.id,
          client_name: null,
          client_entity_id: null,
        });
      }
    }
  }

  log(`  Client matches: ${stats.clients_matched}/${clients.length}`);

  // Save relationships data
  await writeFile(
    'output/wa-lobbyist-relationships.json',
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

  // Phase 3b: Client-only or lobbyist-only matches (self-referencing)
  if (!DRY_RUN) {
    // Client-only: client is matched but lobbyist is not
    const clientOnlyRels = relationships.filter(r => !r.lobbyist_entity_id && r.client_entity_id);
    const uniqueClients = new Map();
    for (const r of clientOnlyRels) {
      if (!uniqueClients.has(r.client_entity_id)) {
        uniqueClients.set(r.client_entity_id, []);
      }
      uniqueClients.get(r.client_entity_id).push(r.lobbyist_name);
    }

    // Lobbyist-only: lobbyist matched, no client data (fallback mode)
    const lobbyistOnlyRels = relationships.filter(r => r.lobbyist_entity_id && !r.client_entity_id && !r.client_name);
    for (const r of lobbyistOnlyRels) {
      if (!uniqueClients.has(r.lobbyist_entity_id)) {
        uniqueClients.set(r.lobbyist_entity_id, ['WA registered lobbyist']);
      }
    }

    log(`\nPhase 3b: Flagging ${uniqueClients.size} entities as lobbying-connected...`);

    const BATCH_SIZE = 50;
    const clientBatches = [...uniqueClients.entries()];
    for (let i = 0; i < clientBatches.length; i += BATCH_SIZE) {
      const batch = clientBatches.slice(i, i + BATCH_SIZE).map(([entityId, names]) => ({
        source_entity_id: entityId,
        target_entity_id: entityId,
        relationship_type: 'lobbies_for',
        dataset: DATASET,
        properties: {
          lobbyist_firms: names.slice(0, 5),
          note: 'WA registered lobbyist or client of registered lobbyist firm',
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
    log(`  ${uniqueClients.size} lobbying flags inserted`);
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
  log('  WA Lobbyist Register Scraper');
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
