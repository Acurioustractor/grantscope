#!/usr/bin/env node
/**
 * scrape-federal-lobbyists.mjs
 *
 * Scrapes the Australian Federal Register of Lobbyists and inserts
 * lobbying relationships into gs_relationships.
 *
 * Data source: https://lobbyists.ag.gov.au/register (web scrape)
 * Fallback: https://github.com/henare/australian_government_lobbyists_register (CSV)
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-federal-lobbyists.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-federal-lobbyists';
const AGENT_NAME = 'Federal Lobbyist Register Scraper';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Phase 1: Scrape the register ──────────────────────

async function scrapeRegister() {
  log('Phase 1: Fetching lobbyist register...');

  // Try the official register first
  const registerUrl = 'https://lobbyists.ag.gov.au/register';
  const res = await fetch(registerUrl, {
    headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' }
  });

  if (!res.ok) {
    log(`  Register returned ${res.status}, trying GitHub fallback...`);
    return await fetchGitHubData();
  }

  const html = await res.text();

  // Parse lobbyist entries from HTML
  const lobbyists = [];

  // Match lobbyist blocks — the register uses table rows with lobbyist details
  // Pattern: each lobbyist has name, ABN, clients, employees
  const tableRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(tableRegex) || [];

  log(`  Found ${rows.length} table rows`);

  // If HTML parsing doesn't yield results, fall back to GitHub
  if (rows.length < 10) {
    log('  Insufficient data from HTML, using GitHub fallback...');
    return await fetchGitHubData();
  }

  // Parse each row for lobbyist data
  for (const row of rows) {
    const nameMatch = row.match(/<td[^>]*>(.*?)<\/td>/);
    if (nameMatch) {
      const name = nameMatch[1].replace(/<[^>]*>/g, '').trim();
      if (name && name.length > 2 && !name.startsWith('#')) {
        lobbyists.push({ name, source: 'register' });
      }
    }
  }

  return lobbyists;
}

async function fetchGitHubData() {
  log('  Fetching from GitHub CSV mirror...');

  const baseUrl = 'https://raw.githubusercontent.com/henare/australian_government_lobbyists_register/master';

  // Fetch all three CSVs
  const [lobbyistsRes, clientsRes, ownersRes] = await Promise.all([
    fetch(`${baseUrl}/lobbyists.csv`),
    fetch(`${baseUrl}/clients.csv`),
    fetch(`${baseUrl}/owners.csv`),
  ]);

  if (!lobbyistsRes.ok) throw new Error(`GitHub lobbyists.csv: ${lobbyistsRes.status}`);
  if (!clientsRes.ok) throw new Error(`GitHub clients.csv: ${clientsRes.status}`);

  const lobbyistsCsv = await lobbyistsRes.text();
  const clientsCsv = await clientsRes.text();
  const ownersCsv = ownersRes.ok ? await ownersRes.text() : '';

  // Parse CSVs (simple — no quoted commas in this data)
  function parseSimpleCsv(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      // Handle quoted fields
      const values = [];
      let current = '';
      let inQuote = false;
      for (const char of line) {
        if (char === '"') { inQuote = !inQuote; continue; }
        if (char === ',' && !inQuote) { values.push(current.trim()); current = ''; continue; }
        current += char;
      }
      values.push(current.trim());

      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
  }

  const lobbyists = parseSimpleCsv(lobbyistsCsv);
  const clients = parseSimpleCsv(clientsCsv);
  const owners = parseSimpleCsv(ownersCsv);

  log(`  Lobbyist firms: ${lobbyists.length}`);
  log(`  Clients: ${clients.length}`);
  log(`  Owners: ${owners.length}`);

  // Save raw data
  await mkdir('output', { recursive: true });
  await writeFile('output/federal-lobbyists-raw.json', JSON.stringify({ lobbyists, clients, owners }, null, 2));

  return { lobbyists, clients, owners };
}

// ── Phase 2: Match to entities ────────────────────────

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

// ── Phase 3: Create entities and relationships ────────

async function processData({ lobbyists, clients, owners }) {
  log('\nPhase 2: Matching lobbyists and clients to entities...');

  const stats = {
    lobbyist_firms: lobbyists.length,
    clients_total: clients.length,
    lobbyists_matched: 0,
    clients_matched: 0,
    relationships_created: 0,
    entities_created: 0,
  };

  // Build client lookup by lobbyist trading name
  const clientsByLobbyist = new Map();
  for (const c of clients) {
    const key = c.trading_name || c.lobbyist_trading_name || c.Trading_Name || Object.values(c)[0];
    if (!clientsByLobbyist.has(key)) clientsByLobbyist.set(key, []);
    clientsByLobbyist.get(key).push(c);
  }

  const relationships = [];

  for (let i = 0; i < lobbyists.length; i++) {
    const lob = lobbyists[i];
    const lobName = lob.trading_name || lob.Trading_Name || lob.name || Object.values(lob)[0];
    const lobAbn = lob.abn || lob.ABN || '';

    if (!lobName) continue;

    // Find or note the lobbyist entity
    const lobEntity = await findEntity(lobName, lobAbn);
    if (lobEntity) stats.lobbyists_matched++;

    // Get this lobbyist's clients
    const lobClients = clientsByLobbyist.get(lobName) || [];

    for (const client of lobClients) {
      const clientName = client.client_name || client.Client_Name || client.name || Object.values(client)[1] || '';
      const clientAbn = client.abn || client.ABN || '';

      if (!clientName) continue;

      const clientEntity = await findEntity(clientName, clientAbn);
      if (clientEntity) stats.clients_matched++;

      relationships.push({
        lobbyist_name: lobName,
        lobbyist_abn: lobAbn,
        lobbyist_entity_id: lobEntity?.id || null,
        client_name: clientName,
        client_abn: clientAbn,
        client_entity_id: clientEntity?.id || null,
      });
    }

    if ((i + 1) % 50 === 0) {
      log(`  ${i + 1}/${lobbyists.length} firms processed`);
    }
  }

  log(`\n  Lobbyist firms: ${stats.lobbyist_firms} (${stats.lobbyists_matched} matched to entities)`);
  log(`  Client relationships: ${relationships.length} (${stats.clients_matched} clients matched)`);

  // Save relationships data
  await writeFile('output/federal-lobbyist-relationships.json', JSON.stringify(relationships, null, 2));

  // Insert into gs_relationships where both sides are matched
  if (!DRY_RUN) {
    const matchedRels = relationships.filter(r => r.lobbyist_entity_id && r.client_entity_id);
    log(`\nPhase 3: Inserting ${matchedRels.length} matched relationships...`);

    const BATCH = 50;
    for (let i = 0; i < matchedRels.length; i += BATCH) {
      const batch = matchedRels.slice(i, i + BATCH).map(r => ({
        source_entity_id: r.client_entity_id,
        target_entity_id: r.lobbyist_entity_id,
        relationship_type: 'lobbies_for',
        dataset: 'lobbying_register_federal',
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
        // Fall back to individual inserts
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

  // Phase 3b: For client-only matches, insert a lobbies_for relationship
  // using the client entity as both source and target (self-loop flag).
  // This ensures the revolving door MV detects these clients as lobbying entities.
  if (!DRY_RUN) {
    const clientOnlyRels = relationships.filter(r => !r.lobbyist_entity_id && r.client_entity_id);
    // Deduplicate by client entity ID (same client may use multiple lobbyists)
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
        dataset: 'lobbying_register_federal',
        properties: {
          lobbyist_firms: lobbyistNames.slice(0, 5),
          note: 'Client of registered lobbyist firm',
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

  log(`\n  Total: ${relationships.length} relationships`);
  log(`  Both matched: ${relationships.filter(r => r.lobbyist_entity_id && r.client_entity_id).length}`);
  log(`  Lobbyist only: ${relationships.filter(r => r.lobbyist_entity_id && !r.client_entity_id).length}`);
  log(`  Client only: ${relationships.filter(r => !r.lobbyist_entity_id && r.client_entity_id).length}`);
  log(`  Neither: ${relationships.filter(r => !r.lobbyist_entity_id && !r.client_entity_id).length}`);

  return stats;
}

// ── Main ──────────────────────────────────────────────

async function main() {
  log('╔══════════════════════════════════════════════════╗');
  log('║  Federal Lobbyist Register Scraper                ║');
  log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                    ║`);
  log('╚══════════════════════════════════════════════════╝');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    const data = await scrapeRegister();

    // If scrapeRegister returned the GitHub structured data
    if (data.lobbyists && data.clients) {
      const stats = await processData(data);

      await logComplete(db, runId, {
        items_found: stats.clients_total,
        items_new: stats.relationships_created,
      });
    } else {
      log('Could not retrieve structured data');
      await logComplete(db, runId, { items_found: 0, items_new: 0 });
    }
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
