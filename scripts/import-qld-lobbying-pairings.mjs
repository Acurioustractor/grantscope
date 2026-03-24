#!/usr/bin/env node
/**
 * import-qld-lobbying-pairings.mjs
 *
 * Reads data/qld-lobbying-pairings.json (from scrape-qld-lobbying-pairings.mjs)
 * and creates lobbies_for relationships in gs_relationships.
 *
 * For each lobbyist firm → client pairing:
 *   1. Find/create the lobbyist firm entity (by ABN)
 *   2. Find the client entity (by name match against gs_entities)
 *   3. Insert lobbies_for relationship: source=lobbyist, target=client
 *
 * Usage:
 *   node --env-file=.env scripts/import-qld-lobbying-pairings.mjs --dry-run
 *   node --env-file=.env scripts/import-qld-lobbying-pairings.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const INPUT = 'data/qld-lobbying-pairings.json';
const DATASET = 'lobbying_register_qld';

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function psql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const cmd = `source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -t -A -c '${escaped}'`;
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (err) {
    log(`  psql error: ${err.message?.slice(0, 120)}`);
    return '';
  }
}

function gsql(query) {
  try {
    return execSync(`node --env-file=.env scripts/gsql.mjs "${query.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    }).trim();
  } catch (err) {
    log(`  gsql error: ${err.message?.slice(0, 120)}`);
    return '';
  }
}

// -- Load pairings data --

log(`Loading pairings from ${INPUT}...`);
const pairings = JSON.parse(readFileSync(INPUT, 'utf-8'));
log(`  ${pairings.length} entities with client data`);

// Count total pairings
let totalPairings = 0;
for (const entity of pairings) {
  totalPairings += entity.current_clients.length + entity.previous_clients.length;
}
log(`  ${totalPairings} total client pairings`);

// -- Phase 1: Match lobbyist firms to gs_entities --

log('\nPhase 1: Matching lobbyist firms by ABN...');
const lobbyistEntityMap = new Map(); // entity_name -> { id, gs_id }
let lobbyistsMatched = 0;
let lobbyistsCreated = 0;

for (const entity of pairings) {
  if (!entity.abn) {
    log(`  No ABN for ${entity.entity_name} — skipping firm match`);
    continue;
  }

  // Look up by ABN
  const result = gsql(`SELECT id, gs_id FROM gs_entities WHERE abn = '${entity.abn}' LIMIT 1`);
  const match = result.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\s*\|\s*([\w-]+)/);

  if (match) {
    lobbyistEntityMap.set(entity.entity_name, { id: match[1], gs_id: match[2] });
    lobbyistsMatched++;
  } else if (!DRY_RUN) {
    // Create stub entity for unmatched lobbyist firm
    const gsId = `AU-ABN-${entity.abn}`;
    const name = entity.entity_name.replace(/'/g, "''");
    const insertResult = psql(`INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, state, tags, source_datasets, source_count, confidence) VALUES ('${gsId}', '${name}', '${entity.abn}', 'company', 'QLD', ARRAY['lobbyist_firm'], ARRAY['lobbying_register_qld'], 1, 'registry') ON CONFLICT (gs_id) DO UPDATE SET tags = array_cat(gs_entities.tags, ARRAY['lobbyist_firm']) RETURNING id, gs_id`);
    const newMatch = insertResult.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
    if (newMatch) {
      lobbyistEntityMap.set(entity.entity_name, { id: newMatch[1], gs_id: gsId });
      lobbyistsCreated++;
    } else {
      log(`  WARN: failed to create entity for ${entity.entity_name}: ${insertResult.slice(0, 80)}`);
    }
  }
}

log(`  Matched: ${lobbyistsMatched}, Created: ${lobbyistsCreated}, Total: ${lobbyistEntityMap.size}/${pairings.length}`);

// -- Phase 2: Match client entities --

log('\nPhase 2: Matching clients to gs_entities...');
const clientEntityMap = new Map(); // client_name -> { id, gs_id }
let clientsMatched = 0;
let clientsUnmatched = 0;
const allClients = new Set();

for (const entity of pairings) {
  for (const client of [...entity.current_clients, ...entity.previous_clients]) {
    allClients.add(client.name);
  }
}

log(`  ${allClients.size} unique client names to match`);

for (const clientName of allClients) {
  const UUID_RE = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\s*\|\s*([\w-]+)/;

  // Try exact match first
  const escaped = clientName.replace(/'/g, "''");
  let result = gsql(`SELECT id, gs_id FROM gs_entities WHERE canonical_name ILIKE '${escaped}' LIMIT 1`);
  let match = result.match(UUID_RE);

  // Try stripped name variant
  if (!match) {
    const stripped = clientName.replace(/\b(Pty|Ltd|Limited|Proprietary|Inc|Incorporated)\b\.?/gi, '').trim();
    if (stripped !== clientName && stripped.length > 3) {
      result = gsql(`SELECT id, gs_id FROM gs_entities WHERE canonical_name ILIKE '%${stripped.replace(/'/g, "''")}%' AND entity_type != 'person' LIMIT 1`);
      match = result.match(UUID_RE);
    }
  }

  if (match) {
    clientEntityMap.set(clientName, { id: match[1], gs_id: match[2] });
    clientsMatched++;
  } else {
    clientsUnmatched++;
  }
}

log(`  Matched: ${clientsMatched}/${allClients.size} (${(clientsMatched / allClients.size * 100).toFixed(1)}%)`);
log(`  Unmatched: ${clientsUnmatched}`);

// -- Phase 3: Create relationships --

log('\nPhase 3: Creating lobbies_for relationships...');
let relsCreated = 0;
let relsSkipped = 0;
const relBatch = [];

for (const entity of pairings) {
  const lobbyist = lobbyistEntityMap.get(entity.entity_name);
  if (!lobbyist) continue;

  for (const client of [...entity.current_clients, ...entity.previous_clients]) {
    const clientEntity = clientEntityMap.get(client.name);
    if (!clientEntity) {
      relsSkipped++;
      continue;
    }

    const isCurrent = entity.current_clients.some(c => c.name === client.name);

    relBatch.push({
      source_entity_id: lobbyist.id,
      target_entity_id: clientEntity.id,
      relationship_type: 'lobbies_for',
      dataset: DATASET,
      year: new Date().getFullYear(),
      properties: {
        lobbyist_firm: entity.entity_name,
        client_name: client.name,
        status: isCurrent ? 'current' : 'previous',
        date_added: client.date || null,
        jurisdiction: 'qld',
      },
    });
  }
}

// Filter out any rows with invalid UUIDs
const UUID_VALID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const validBatch = relBatch.filter(r => UUID_VALID.test(r.source_entity_id) && UUID_VALID.test(r.target_entity_id));
const invalidCount = relBatch.length - validBatch.length;
if (invalidCount > 0) log(`  Filtered out ${invalidCount} rows with invalid UUIDs`);

log(`  Relationships to insert: ${validBatch.length}`);
log(`  Skipped (no client match): ${relsSkipped}`);

if (!DRY_RUN && validBatch.length > 0) {
  // Insert in batches of 50 to avoid single-statement failures killing everything
  const BATCH_SIZE = 50;
  for (let i = 0; i < validBatch.length; i += BATCH_SIZE) {
    const batch = validBatch.slice(i, i + BATCH_SIZE);
    const sqlLines = batch.map(r => {
      const props = JSON.stringify(r.properties).replace(/'/g, "''");
      return `('${r.source_entity_id}', '${r.target_entity_id}', '${r.relationship_type}', '${r.dataset}', ${r.year}, '${props}'::jsonb, '')`;
    });

    const sql = `INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, dataset, year, properties, source_record_id)
VALUES ${sqlLines.join(',\n')}
ON CONFLICT (source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id, '')) DO UPDATE SET
  properties = EXCLUDED.properties,
  year = EXCLUDED.year;`;

    const sqlFile = '/tmp/qld-lobbying-import.sql';
    writeFileSync(sqlFile, sql);
    const insertResult = psql(`\\i ${sqlFile}`);
    if (insertResult.includes('ERROR')) {
      log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${insertResult.slice(0, 120)}`);
    } else {
      relsCreated += batch.length;
    }
  }
  log(`  Inserted ${relsCreated}/${validBatch.length} relationships`);
}

// -- Phase 4: Log agent run --

if (!DRY_RUN) {
  psql(`INSERT INTO agent_runs (agent_id, agent_name, status, items_found, items_new, started_at, completed_at) VALUES ('import-qld-lobbying-pairings', 'QLD Lobbying Pairing Import', 'success', ${totalPairings}, ${relsCreated}, NOW() - INTERVAL '1 minute', NOW())`);
}

// -- Summary --

log('\n======================================================');
log(`  QLD Lobbying Pairing Import — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
log(`  Lobbyist firms: ${lobbyistEntityMap.size}/${pairings.length} matched`);
log(`  Unique clients: ${clientsMatched}/${allClients.size} matched`);
log(`  Relationships: ${DRY_RUN ? `${validBatch.length} would be created` : `${relsCreated} created`}`);
log(`  Skipped: ${relsSkipped} (client not in entity graph)`);
log('======================================================');

// Show top unmatched clients for visibility
if (clientsUnmatched > 0) {
  const unmatched = [...allClients].filter(c => !clientEntityMap.has(c)).slice(0, 15);
  log('\nTop unmatched clients (sample):');
  for (const name of unmatched) {
    log(`  - ${name}`);
  }
}
