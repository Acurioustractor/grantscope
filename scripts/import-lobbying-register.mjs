#!/usr/bin/env node
/**
 * Import Australian Lobbying Registers
 *
 * Sources:
 * 1. NSW Third-Party Lobbyists (lobbyists.elections.nsw.gov.au) — Salesforce HTML, ~450 firms
 * 2. Federal Register (lobbyists.ag.gov.au) — SPA, requires JS rendering (TODO)
 *
 * The federal register is a JS SPA that can't be scraped without a headless browser.
 * We start with NSW which has server-rendered HTML with 450+ lobbyist firms.
 *
 * Cross-references lobbyist clients against the entity graph to find:
 * - Companies that lobby AND donate to political parties
 * - Companies that lobby AND hold government contracts
 *
 * Usage:
 *   node scripts/import-lobbying-register.mjs              # full import
 *   node scripts/import-lobbying-register.mjs --dry-run    # count only
 *   node scripts/import-lobbying-register.mjs --skip-download  # use cached HTML
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_DOWNLOAD = process.argv.includes('--skip-download');

const NSW_URL = 'https://lobbyists.elections.nsw.gov.au/whoisontheregister';
const NSW_HTML_PATH = '/tmp/nsw-lobbyists.html';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (msg) => console.log(`[lobbying] ${msg}`);

const ENTITY_PAGE_SIZE = 1000;
const CORPORATE_SUFFIX_RE = /\b(?:PTY|LTD|LIMITED|PROPRIETARY|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|HOLDINGS?|HOLDING|GROUP|TRUST|TRADING AS)\b/g;
const STOPWORDS = new Set(['THE', 'AND', 'FOR', 'OF', 'TO', 'AT', 'IN', 'ON', 'WITH', 'BY', 'PTY', 'LTD', 'LIMITED', 'TRUST', 'GROUP', 'HOLDINGS', 'COMPANY', 'CO']);

function makeGsId(identifier) {
  if (identifier.abn) return 'AU-ABN-' + identifier.abn.replace(/\s/g, '');
  const upper = identifier.name.toUpperCase().trim();
  let hash = 0;
  for (let i = 0; i < upper.length; i++) {
    hash = ((hash << 5) - hash) + upper.charCodeAt(i);
    hash |= 0;
  }
  return 'AU-LOBBY-' + Math.abs(hash).toString(36);
}

function normalizeName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/['".,()/:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCorporateSuffixes(value) {
  const cleaned = normalizeName(value).replace(CORPORATE_SUFFIX_RE, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || normalizeName(value);
}

function significantTokens(value) {
  return stripCorporateSuffixes(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function inferEntityTypeFromName(name) {
  const text = normalizeName(name);
  if (/\b(?:DEPARTMENT|MINISTER|COUNCIL|SHIRE|CITY OF|GOVERNMENT|AUTHORITY|COMMISSION|AGENCY)\b/.test(text)) {
    return 'government_body';
  }
  if (/\b(?:FOUNDATION|ASSOCIATION|SOCIETY|INCORPORATED|CHARITY)\b/.test(text)) {
    return 'charity';
  }
  return 'company';
}

async function loadEntityIndexes() {
  log('Loading entity graph name index for lobbying client matching...');
  const entities = [];

  for (let offset = 0; ; offset += ENTITY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('gs_entities')
      .select('id, canonical_name, entity_type, state, abn, gs_id')
      .range(offset, offset + ENTITY_PAGE_SIZE - 1)
      .order('id', { ascending: true });

    if (error) throw error;
    if (!data?.length) break;
    entities.push(...data);
    if (data.length < ENTITY_PAGE_SIZE) break;
  }

  const exactIndex = new Map();
  const strippedIndex = new Map();
  const tokenIndex = new Map();

  function addToIndex(entity) {
    const normalized = normalizeName(entity.canonical_name);
    const stripped = stripCorporateSuffixes(entity.canonical_name);
    const tokens = significantTokens(entity.canonical_name);

    if (!exactIndex.has(normalized)) exactIndex.set(normalized, []);
    exactIndex.get(normalized).push(entity);

    if (!strippedIndex.has(stripped)) strippedIndex.set(stripped, []);
    strippedIndex.get(stripped).push(entity);

    for (const token of tokens) {
      if (!tokenIndex.has(token)) tokenIndex.set(token, []);
      tokenIndex.get(token).push(entity);
    }
  }

  for (const entity of entities) addToIndex(entity);

  log(`  Indexed ${entities.length} entities for lobbying client matching`);
  return { entities, exactIndex, strippedIndex, tokenIndex, addToIndex };
}

function scoreCandidate(clientName, entity) {
  const clientNorm = normalizeName(clientName);
  const clientStripped = stripCorporateSuffixes(clientName);
  const entityNorm = normalizeName(entity.canonical_name);
  const entityStripped = stripCorporateSuffixes(entity.canonical_name);

  const clientTokens = new Set(significantTokens(clientName));
  const entityTokens = new Set(significantTokens(entity.canonical_name));
  const overlap = [...clientTokens].filter((token) => entityTokens.has(token)).length;
  const union = new Set([...clientTokens, ...entityTokens]).size || 1;
  const jaccard = overlap / union;
  const typeHint = inferEntityTypeFromName(clientName);

  let score = 0;
  if (clientNorm === entityNorm) score += 120;
  if (clientStripped === entityStripped) score += 110;
  if (entityNorm.includes(clientStripped) || clientStripped.includes(entityStripped)) score += 45;
  score += overlap * 12;
  score += Math.round(jaccard * 40);
  if (entity.entity_type === typeHint) score += 10;
  if (typeHint === 'government_body' && entity.entity_type === 'government_body') score += 15;
  if (clientTokens.size > 0 && overlap === 0) score -= 25;
  if (Math.abs(entityStripped.length - clientStripped.length) > 25) score -= 10;
  return score;
}

function findClientEntityMatch(clientName, indexes) {
  const normalized = normalizeName(clientName);
  const stripped = stripCorporateSuffixes(clientName);
  const direct = [
    ...(indexes.exactIndex.get(normalized) || []),
    ...(indexes.strippedIndex.get(stripped) || []),
  ];

  const candidates = new Map();
  for (const entity of direct) candidates.set(entity.id, entity);

  for (const token of significantTokens(clientName)) {
    for (const entity of indexes.tokenIndex.get(token) || []) {
      candidates.set(entity.id, entity);
      if (candidates.size >= 250) break;
    }
    if (candidates.size >= 250) break;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates.values()) {
    const score = scoreCandidate(clientName, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best) return null;
  if (bestScore < 38) return null;
  return { entity: best, score: bestScore };
}

async function ensureStubClientEntity(clientName, indexes) {
  const gsId = makeGsId({ name: clientName });
  const entityType = inferEntityTypeFromName(clientName);

  const { data, error } = await supabase
    .from('gs_entities')
    .upsert({
      gs_id: gsId,
      canonical_name: clientName,
      entity_type: entityType,
      state: entityType === 'government_body' ? 'NSW' : null,
      tags: ['lobbied_client'],
      source_datasets: ['lobbying_register_client'],
      source_count: 1,
      confidence: 'reported',
    }, { onConflict: 'gs_id' })
    .select('id, canonical_name, entity_type, state, abn, gs_id')
    .single();

  if (error) throw error;
  indexes.addToIndex(data);
  return data;
}

async function downloadNSWRegister() {
  if (SKIP_DOWNLOAD && existsSync(NSW_HTML_PATH)) {
    log('Using cached NSW HTML (--skip-download)');
    return;
  }

  if (existsSync(NSW_HTML_PATH)) {
    const stats = readFileSync(NSW_HTML_PATH).length;
    if (stats > 100000) {
      log('NSW HTML already cached');
      return;
    }
  }

  log('Downloading NSW lobbyist register...');
  execSync(
    `curl -sL -A "${BROWSER_UA}" -o "${NSW_HTML_PATH}" "${NSW_URL}"`,
    { timeout: 60000 }
  );
  const size = readFileSync(NSW_HTML_PATH).length;
  log(`Downloaded ${(size / 1024).toFixed(0)}KB`);
}

function parseNSWRegister() {
  const html = readFileSync(NSW_HTML_PATH, 'utf-8');

  // Extract all table cells
  const cellRegex = /<td[^>]*>(.*?)<\/td>/gs;
  const rawCells = [];
  let match;
  while ((match = cellRegex.exec(html)) !== null) {
    // Strip HTML tags and clean whitespace
    let text = match[1].replace(/<[^>]+>/g, ' ').trim();
    text = text.replace(/\s+/g, ' ').trim();
    if (text && text.length > 2 && !text.startsWith('if(!window')) {
      rawCells.push(text);
    }
  }

  log(`  Raw table cells: ${rawCells.length}`);

  // The table structure alternates: Business Name (CAPS) | Trading Name | Clients+Employees | Status
  // Business names end in PTY LTD/LIMITED and are typically ALL CAPS
  const lobbyists = [];
  let current = null;

  for (const cell of rawCells) {
    const isCorpName = /(?:PTY\s*LTD|LIMITED|PROPRIETARY|INCORPORATED)\s*$/i.test(cell);
    const isAllCaps = cell === cell.toUpperCase() && cell.length > 5;

    if (isCorpName && isAllCaps && cell.length < 200) {
      // New lobbyist firm
      if (current && current.business_name) {
        lobbyists.push(current);
      }
      current = {
        business_name: cell,
        trading_name: null,
        raw_clients: [],
        jurisdiction: 'nsw',
      };
    } else if (current) {
      // Try to identify trading name (first non-caps, non-corporate cell after business name)
      if (!current.trading_name && !isAllCaps && cell.length < 80 &&
          !/PTY|LTD|LIMITED|TRUST/i.test(cell) && !/^Active$/i.test(cell)) {
        current.trading_name = cell;
      } else if (cell !== 'Active' && cell !== 'Inactive' && cell.length > 3) {
        // Everything else goes into raw clients text for entity matching
        // Split on corporate suffixes to separate multiple company names
        const parts = cell.split(/(?<=(?:PTY\s*LTD|LIMITED|TRUST|FOUNDATION))/i);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length > 3 && /(?:PTY|LTD|LIMITED|TRUST|FOUNDATION|COUNCIL|ASSOCIATION|CORPORATION)/i.test(trimmed)) {
            current.raw_clients.push(trimmed);
          }
        }
      }
    }
  }

  if (current && current.business_name) {
    lobbyists.push(current);
  }

  // Deduplicate by name
  const seen = new Set();
  const unique = lobbyists.filter(l => {
    const key = l.business_name.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Deduplicate clients within each lobbyist
  for (const l of unique) {
    const clientSeen = new Set();
    l.raw_clients = l.raw_clients.filter(c => {
      const key = c.toUpperCase().trim();
      if (clientSeen.has(key)) return false;
      if (key === l.business_name.toUpperCase()) return false; // Don't self-reference
      clientSeen.add(key);
      return true;
    });
  }

  return unique;
}

async function importToEntityGraph(lobbyists) {
  log(`\nImporting ${lobbyists.length} lobbyist firms into entity graph...`);
  const entityIndexes = await loadEntityIndexes();

  let entitiesCreated = 0;
  let entitiesUpdated = 0;
  let relationshipsCreated = 0;
  let clientsMatched = 0;
  let clientsCreated = 0;
  let errors = 0;

  for (let i = 0; i < lobbyists.length; i++) {
    const lob = lobbyists[i];

    if (DRY_RUN) {
      log(`  [DRY] ${lob.business_name} (Clients: ${lob.raw_clients.length})`);
      entitiesCreated++;
      continue;
    }

    // Try to find this lobbyist by name in ASIC companies (to get ABN)
    const { data: asicMatch } = await supabase
      .from('asic_companies')
      .select('abn, company_name')
      .ilike('company_name', lob.business_name)
      .limit(1);

    const abn = asicMatch?.[0]?.abn || null;
    const gsId = makeGsId({ abn, name: lob.business_name });

    // Check if entity already exists
    let entityId;
    if (abn) {
      const { data: existing } = await supabase
        .from('gs_entities')
        .select('id, source_datasets')
        .eq('abn', abn)
        .limit(1)
        .single();

      if (existing) {
        const sources = existing.source_datasets || [];
        if (!sources.includes('lobbying_register')) {
          await supabase
            .from('gs_entities')
            .update({
              source_datasets: [...sources, 'lobbying_register'],
              source_count: sources.length + 1,
              tags: ['lobbyist'],
            })
            .eq('id', existing.id);
          entitiesUpdated++;
        }
        entityId = existing.id;
      }
    }

    if (!entityId) {
      // Check by gs_id
      const { data: byGsId } = await supabase
        .from('gs_entities')
        .select('id')
        .eq('gs_id', gsId)
        .single();

      if (byGsId) {
        entityId = byGsId.id;
      } else {
        // Create new entity
        const { data: inserted, error } = await supabase
          .from('gs_entities')
          .upsert({
            entity_type: 'company',
            canonical_name: lob.business_name,
            abn: abn,
            gs_id: gsId,
            state: 'NSW',
            sector: 'professional_services',
            tags: ['lobbyist'],
            source_datasets: ['lobbying_register'],
            source_count: 1,
            confidence: abn ? 'verified' : 'reported',
          }, { onConflict: 'gs_id' })
          .select('id')
          .single();

        if (error) {
          errors++;
          continue;
        }
        entityId = inserted?.id;
        entitiesCreated++;
      }
    }

    if (!entityId) continue;

    // Create lobbies_for relationships for each client
    for (const clientName of lob.raw_clients.slice(0, 30)) {
      let targetEntityId = null;
      try {
        const match = findClientEntityMatch(clientName, entityIndexes);
        if (match?.entity?.id) {
          targetEntityId = match.entity.id;
          clientsMatched++;
        } else {
          const stubEntity = await ensureStubClientEntity(clientName, entityIndexes);
          targetEntityId = stubEntity.id;
          clientsCreated++;
        }
      } catch (matchError) {
        errors++;
        if (errors <= 5) {
          log(`  Client matching error for "${clientName}": ${matchError.message}`);
        }
        continue;
      }

      if (targetEntityId) {
        const sourceRecordId = `${lob.business_name}|${clientName}`;
        const { data: existingRelationship, error: selectError } = await supabase
          .from('gs_relationships')
          .select('id')
          .eq('source_entity_id', entityId)
          .eq('target_entity_id', targetEntityId)
          .eq('relationship_type', 'lobbies_for')
          .eq('dataset', 'lobbying_register_nsw')
          .eq('source_record_id', sourceRecordId)
          .limit(1)
          .maybeSingle();

        if (selectError) {
          errors++;
          if (errors <= 5) log(`  Relationship lookup error for "${clientName}": ${selectError.message}`);
          continue;
        }

        if (existingRelationship?.id) {
          continue;
        }

        const { error } = await supabase.from('gs_relationships').insert({
          source_entity_id: entityId,
          target_entity_id: targetEntityId,
          relationship_type: 'lobbies_for',
          dataset: 'lobbying_register_nsw',
          source_record_id: sourceRecordId,
          source_url: NSW_URL,
          confidence: 'registry',
          properties: {
            client_name: clientName,
            lobbyist_name: lob.business_name,
            jurisdiction: 'nsw',
          },
        });

        if (!error) {
          relationshipsCreated++;
        } else if (!/duplicate key value/i.test(error.message)) {
          errors++;
          if (errors <= 5) log(`  Relationship error for "${clientName}": ${error.message}`);
        }
      }
    }

    if ((i + 1) % 20 === 0 || i === lobbyists.length - 1) {
      log(`  Progress: ${i + 1}/${lobbyists.length} (${entitiesCreated} new, ${entitiesUpdated} enriched, ${relationshipsCreated} relationships)`);
    }
  }

  log(`\n=== Results ===`);
  log(`  Lobbyist firms processed: ${lobbyists.length}`);
  log(`  New entities created: ${entitiesCreated}`);
  log(`  Existing entities enriched: ${entitiesUpdated}`);
  log(`  Lobbying relationships created: ${relationshipsCreated}`);
  log(`  Clients matched to entity graph: ${clientsMatched}`);
  log(`  Stub client entities created: ${clientsCreated}`);
  log(`  Errors: ${errors}`);
}

async function main() {
  log('=== Import Australian Lobbying Registers ===');
  if (DRY_RUN) log('(DRY RUN — no data will be written)');

  // Phase 1: NSW Register (server-rendered HTML)
  log('\n--- NSW Third-Party Lobbyists ---');
  await downloadNSWRegister();
  const nswLobbyists = parseNSWRegister();
  log(`  Parsed ${nswLobbyists.length} NSW lobbyist firms`);
  log(`  Total client references: ${nswLobbyists.reduce((s, l) => s + l.raw_clients.length, 0)}`);

  // Phase 2: Federal Register (TODO — needs headless browser or Firecrawl)
  log('\n--- Federal Register ---');
  log('  Skipped (SPA — requires headless browser. See lobbyists.ag.gov.au)');
  log('  TODO: Use Playwright or Firecrawl to scrape when credits available');

  // Import all collected lobbyists
  await importToEntityGraph(nswLobbyists);

  // Summary stats
  if (!DRY_RUN) {
    const { count } = await supabase
      .from('gs_entities')
      .select('*', { count: 'exact', head: true })
      .contains('source_datasets', ['lobbying_register']);
    log(`\n  Total entities with lobbying_register source: ${count}`);

    const { count: relCount } = await supabase
      .from('gs_relationships')
      .select('*', { count: 'exact', head: true })
      .eq('relationship_type', 'lobbies_for');
    log(`  Total lobbies_for relationships: ${relCount}`);
  }

  log('\nDone.');
}

main().catch(err => {
  console.error('[lobbying] Fatal error:', err);
  process.exit(1);
});
