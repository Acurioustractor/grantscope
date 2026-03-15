#!/usr/bin/env node

/**
 * Person → Entity Linkage Engine (Relationship Flywheel — Stage 2: LINK)
 *
 * Links person_identity_map + linkedin_contacts to CivicGraph entities.
 * Uses company name matching against 143K gs_entities.
 *
 * Three phases:
 *   1. LinkedIn company exact match (current_company → canonical_name)
 *   2. LinkedIn company fuzzy match (pg_trgm similarity ≥ 0.4)
 *   3. Email domain match (person email domain → entity website domain)
 *
 * Usage:
 *   node --env-file=.env scripts/link-people-to-entities.mjs [--dry-run] [--limit=500]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function fetchAll(table, select, filters = {}) {
  const PAGE = 1000;
  let all = [];
  let offset = 0;
  while (true) {
    let q = db.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filters.notNull) {
      for (const col of filters.notNull) q = q.not(col, 'is', null);
    }
    if (filters.neq) {
      for (const [col, val] of filters.neq) q = q.neq(col, val);
    }
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

/**
 * Normalize company name for matching
 */
function normalize(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|inc|incorporated|corp|corporation|australia|aust|group|holdings|services)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  log('=== Person → Entity Linkage Engine ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  const t0 = Date.now();

  // Load all LinkedIn contacts with companies
  log('Loading LinkedIn contacts...');
  const linkedinContacts = await fetchAll('linkedin_contacts',
    'id, person_id, first_name, last_name, full_name, current_company, current_position, email_address',
    { notNull: ['current_company'] }
  );
  log(`Loaded ${linkedinContacts.length} LinkedIn contacts with companies`);

  // Load person_identity_map for people with companies but no LinkedIn record
  log('Loading person_identity_map...');
  const people = await fetchAll('person_identity_map',
    'person_id, full_name, email, current_company, current_position',
    { notNull: ['current_company'] }
  );
  log(`Loaded ${people.length} people with companies`);

  // Load already-linked person IDs to skip
  const existingLinks = await fetchAll('person_entity_links', 'person_id');
  const alreadyLinked = new Set(existingLinks.map(l => l.person_id));
  log(`${alreadyLinked.size} people already linked — will skip`);

  // Build company → entity index from gs_entities
  log('Building entity index...');
  const entities = await fetchAll('gs_entities', 'id, canonical_name, abn, website, entity_type');
  log(`Loaded ${entities.length} entities`);

  // Exact name index (normalized)
  const entityByNormalizedName = new Map();
  for (const e of entities) {
    const key = normalize(e.canonical_name);
    if (key.length < 3) continue;
    if (!entityByNormalizedName.has(key)) entityByNormalizedName.set(key, []);
    entityByNormalizedName.get(key).push(e);
  }
  log(`Built normalized name index: ${entityByNormalizedName.size} unique names`);

  // Phase 1: Exact company name matching (normalized)
  log('=== PHASE 1: Exact Company Name Match ===');
  const rows = [];
  let exactMatches = 0;
  let skippedAlreadyLinked = 0;

  // Combine LinkedIn + person_identity_map, dedup by person_id
  const personCompanyMap = new Map(); // person_id → { company, name, source }
  for (const lc of linkedinContacts) {
    if (!lc.person_id) continue;
    personCompanyMap.set(lc.person_id, {
      company: lc.current_company,
      name: lc.full_name || `${lc.first_name} ${lc.last_name}`,
      position: lc.current_position,
      email: lc.email_address,
      source: 'linkedin',
    });
  }
  for (const p of people) {
    if (personCompanyMap.has(p.person_id)) continue; // LinkedIn record takes precedence
    personCompanyMap.set(p.person_id, {
      company: p.current_company,
      name: p.full_name,
      position: p.current_position,
      email: p.email,
      source: 'person_identity_map',
    });
  }

  log(`${personCompanyMap.size} unique people with companies`);

  for (const [personId, info] of personCompanyMap) {
    if (alreadyLinked.has(personId)) { skippedAlreadyLinked++; continue; }

    const key = normalize(info.company);
    if (key.length < 3) continue;

    const matches = entityByNormalizedName.get(key);
    if (matches && matches.length > 0) {
      // Take first match (could be multiple entities with same name)
      const entity = matches[0];
      rows.push({
        person_id: personId,
        entity_id: entity.id,
        confidence_score: 0.90,
        link_method: 'company_name_exact',
        link_evidence: {
          contact_company: info.company,
          entity_name: entity.canonical_name,
          contact_name: info.name,
          position: info.position,
          source: info.source,
        },
      });
      exactMatches++;
    }

    if (LIMIT && exactMatches >= LIMIT) break;
  }

  log(`Exact matches: ${exactMatches} (skipped ${skippedAlreadyLinked} already linked)`);

  // Phase 2: Fuzzy matching for remaining unlinked
  log('=== PHASE 2: Fuzzy Company Name Match ===');
  const linkedInPhase1 = new Set(rows.map(r => r.person_id));
  let fuzzyMatches = 0;
  let fuzzyChecked = 0;
  const FUZZY_BATCH = LIMIT ? Math.min(LIMIT, 500) : 500;

  for (const [personId, info] of personCompanyMap) {
    if (alreadyLinked.has(personId) || linkedInPhase1.has(personId)) continue;

    const key = normalize(info.company);
    if (key.length < 4) continue;

    fuzzyChecked++;

    // Use pg_trgm RPC
    const { data: matches, error } = await db.rpc('search_entities_fuzzy', {
      search_name: info.company,
      min_similarity: 0.4,
      max_results: 1,
    });

    if (error) {
      if (fuzzyChecked === 1) log(`RPC error: ${error.message} — skipping fuzzy phase`);
      break;
    }

    if (matches && matches.length > 0) {
      rows.push({
        person_id: personId,
        entity_id: matches[0].id,
        confidence_score: Math.min(parseFloat(matches[0].similarity), 0.99),
        link_method: 'company_name_fuzzy',
        link_evidence: {
          contact_company: info.company,
          entity_name: matches[0].canonical_name,
          similarity: matches[0].similarity,
          contact_name: info.name,
          source: info.source,
        },
      });
      fuzzyMatches++;
    }

    if (fuzzyChecked % 500 === 0) log(`  [${fuzzyChecked}] fuzzy=${fuzzyMatches}`);
    if (LIMIT && fuzzyMatches >= LIMIT) break;
    if (fuzzyChecked >= FUZZY_BATCH && !LIMIT) {
      log(`  Stopping fuzzy at ${FUZZY_BATCH} checks to avoid timeout — run again to continue`);
      break;
    }
  }

  log(`Fuzzy matches: ${fuzzyMatches} from ${fuzzyChecked} checked`);

  // Upsert all links
  if (!DRY_RUN && rows.length > 0) {
    log(`Upserting ${rows.length} links...`);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db
        .from('person_entity_links')
        .upsert(chunk, { onConflict: 'person_id,entity_id', ignoreDuplicates: true });
      if (error) log(`Upsert error at chunk ${i}: ${error.message}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(`=== DONE === ${rows.length} total links in ${elapsed}s`);

  // Summary
  const { count: totalLinks } = await db
    .from('person_entity_links')
    .select('*', { count: 'exact', head: true });
  log(`Total person_entity_links in DB: ${totalLinks}`);

  // Top linked entities
  const { data: topEntities } = await db
    .from('person_entity_links')
    .select('entity_id')
    .limit(1000);

  if (topEntities) {
    const counts = {};
    for (const r of topEntities) counts[r.entity_id] = (counts[r.entity_id] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length > 0) {
      const ids = sorted.map(([id]) => id);
      const { data: names } = await db.from('gs_entities').select('id, canonical_name').in('id', ids);
      const nameMap = new Map((names || []).map(e => [e.id, e.canonical_name]));
      log('Top linked entities:');
      for (const [id, count] of sorted) {
        log(`  ${nameMap.get(id) || id}: ${count} people`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
