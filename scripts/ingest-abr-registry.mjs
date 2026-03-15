#!/usr/bin/env node

/**
 * ABR Registry Ingestion Agent
 *
 * The ROOT of the CivicGraph data model. ABN is the universal key.
 * This agent enriches gs_entities from the Australian Business Register API:
 *
 * Phase 1: Fill missing ABNs (indigenous_corp, government_body, political_party)
 *          — searches ABR by name, matches with high confidence
 * Phase 2: Enrich entities that HAVE ABNs with ABR metadata
 *          — trading names, entity type, GST status, postcode, state
 * Phase 3: Repair dangling relationships
 *          — resolve entities on broken relationship edges
 *
 * ABR API: https://abr.business.gov.au (JSONP, 500ms rate limit)
 * Requires: ABN_LOOKUP_GUID in .env
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-abr-registry.mjs [--phase=1|2|3] [--limit=500] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GUID = process.env.ABN_LOOKUP_GUID;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const PHASE_FILTER = process.argv.find(a => a.startsWith('--phase='))?.split('=')[1];

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!GUID) { console.error('Missing ABN_LOOKUP_GUID'); process.exit(1); }

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const RATE_MS = 550; // ABR rate limit ~2/sec

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAll(table, select, filters = {}) {
  const PAGE = 1000;
  let all = [], offset = 0;
  while (true) {
    let q = db.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filters.notNull) for (const col of filters.notNull) q = q.not(col, 'is', null);
    if (filters.isNull) for (const col of filters.isNull) q = q.is(col, null);
    if (filters.eq) for (const [col, val] of filters.eq) q = q.eq(col, val);
    if (filters.in_) for (const [col, vals] of filters.in_) q = q.in(col, vals);
    if (filters.neq) for (const [col, val] of filters.neq) q = q.neq(col, val);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ─── ABR API ─────────────────────────────────────────────────────────

async function lookupAbn(abn) {
  const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&guid=${GUID}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const json = JSON.parse(text.replace(/^callback\(/, '').replace(/\)$/, ''));
    if (json.Abn) {
      return {
        abn: json.Abn,
        entityName: json.EntityName,
        entityType: json.EntityTypeName,
        entityTypeCode: json.EntityTypeCode,
        status: json.AbnStatus,
        statusDate: json.AbnStatusEffectiveFrom,
        postcode: json.AddressPostcode !== '0000' ? json.AddressPostcode : null,
        state: json.AddressState,
        gst: json.Gst,
        tradingNames: json.BusinessName || [],
      };
    }
  } catch { /* timeout or parse error */ }
  return null;
}

async function searchByName(name) {
  const cleanName = name.replace(/[""']/g, '').replace(/\(.*\)/g, '').trim();
  if (cleanName.length < 4) return null;
  const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(cleanName)}&maxResults=5&guid=${GUID}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const json = JSON.parse(text.replace(/^callback\(/, '').replace(/\)$/, ''));
    if (json.Names && json.Names.length > 0) {
      // Find best match by score and name overlap
      const nameLower = cleanName.toLowerCase();
      const nameWords = new Set(nameLower.split(/\s+/).filter(w => w.length > 2));

      for (const m of json.Names) {
        if (m.Score < 85) continue;
        const matchWords = new Set(m.Name.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        let overlap = 0;
        for (const w of nameWords) if (matchWords.has(w)) overlap++;
        const overlapPct = nameWords.size > 0 ? overlap / nameWords.size : 0;
        if (overlapPct >= 0.6) {
          return {
            abn: m.Abn,
            matchedName: m.Name,
            score: m.Score,
            postcode: m.Postcode,
            state: m.State,
            nameType: m.NameType,
          };
        }
      }
    }
  } catch { /* timeout */ }
  return null;
}

// ─── Phase 1: Fill missing ABNs ─────────────────────────────────────

async function phase1_fillMissingAbns() {
  log('=== PHASE 1: Fill Missing ABNs ===');

  const entities = await fetchAll('gs_entities', 'id, canonical_name, entity_type', {
    isNull: ['abn'],
    in_: [['entity_type', ['indigenous_corp', 'government_body', 'political_party', 'social_enterprise', 'company']]],
  });

  log(`${entities.length} entities missing ABNs`);

  let found = 0, notFound = 0, errors = 0, checked = 0;

  for (const e of entities) {
    if (LIMIT && found >= LIMIT) break;
    checked++;

    const result = await searchByName(e.canonical_name);
    await sleep(RATE_MS);

    if (result && result.abn) {
      // Verify ABN isn't already used by another entity
      const { data: existing } = await db.from('gs_entities').select('id').eq('abn', result.abn).maybeSingle();
      if (existing && existing.id !== e.id) {
        // ABN already belongs to another entity — skip
        notFound++;
        continue;
      }

      if (!DRY_RUN) {
        const update = { abn: result.abn };
        if (result.postcode && !e.postcode) update.postcode = result.postcode;
        if (result.state && !e.state) update.state = result.state;

        const { error } = await db.from('gs_entities').update(update).eq('id', e.id);
        if (error) { errors++; continue; }
      }
      found++;
      if (found % 50 === 0) log(`  [${checked}] found=${found} notFound=${notFound} (${e.entity_type})`);
    } else {
      notFound++;
    }

    if (checked % 100 === 0) log(`  [${checked}] found=${found} notFound=${notFound}`);
  }

  log(`Phase 1 done: ${found} ABNs filled, ${notFound} not found, ${errors} errors (of ${checked} checked)`);
  return found;
}

// ─── Phase 2: Enrich entities with ABR metadata ─────────────────────

async function phase2_enrichFromAbr() {
  log('=== PHASE 2: Enrich Entities from ABR ===');

  // Get entities with ABN but missing postcode or description gaps
  const entities = await fetchAll('gs_entities', 'id, canonical_name, abn, entity_type, postcode, state, metadata', {
    notNull: ['abn'],
  });

  // Filter to those needing enrichment (no postcode, or no ABR metadata yet)
  const needsEnrichment = entities.filter(e => {
    const meta = e.metadata || {};
    return !meta.abr_enriched && (!e.postcode || !e.state);
  });

  log(`${needsEnrichment.length} entities need ABR enrichment (of ${entities.length} with ABN)`);

  let enriched = 0, errors = 0, checked = 0;

  for (const e of needsEnrichment) {
    if (LIMIT && enriched >= LIMIT) break;
    checked++;

    const result = await lookupAbn(e.abn);
    await sleep(RATE_MS);

    if (result) {
      if (!DRY_RUN) {
        const update = {};
        if (!e.postcode && result.postcode) update.postcode = result.postcode;
        if (!e.state && result.state) update.state = result.state;

        // Store ABR metadata
        const meta = e.metadata || {};
        meta.abr_enriched = true;
        meta.abr_entity_type = result.entityType;
        meta.abr_status = result.status;
        meta.abr_gst = result.gst;
        if (result.tradingNames && result.tradingNames.length > 0) {
          meta.trading_names = result.tradingNames.map(t => t.OrganisationName || t.Value || t).filter(Boolean);
        }
        update.metadata = meta;

        const { error } = await db.from('gs_entities').update(update).eq('id', e.id);
        if (error) { errors++; continue; }
      }
      enriched++;
    }

    if (checked % 200 === 0) log(`  [${checked}] enriched=${enriched} errors=${errors}`);
  }

  log(`Phase 2 done: ${enriched} entities enriched, ${errors} errors (of ${checked} checked)`);
  return enriched;
}

// ─── Phase 3: Repair dangling relationships ─────────────────────────

async function phase3_repairRelationships() {
  log('=== PHASE 3: Repair Dangling Relationships ===');

  // Find relationships where one side has no ABN
  // Get entities with no ABN that ARE in relationships
  const { data: danglingSourceIds } = await db.rpc('get_dangling_relationship_entities').catch(() => ({ data: null }));

  if (!danglingSourceIds) {
    // Fallback: just count
    const noAbn = await fetchAll('gs_entities', 'id, canonical_name, entity_type', { isNull: ['abn'] });
    log(`${noAbn.length} entities still without ABN`);

    // Try to resolve a batch using ABR name search
    let resolved = 0, checked = 0;
    for (const e of noAbn) {
      if (LIMIT && resolved >= LIMIT) break;
      if (e.entity_type === 'person') continue; // People don't have ABNs
      checked++;

      const result = await searchByName(e.canonical_name);
      await sleep(RATE_MS);

      if (result && result.abn) {
        const { data: existing } = await db.from('gs_entities').select('id').eq('abn', result.abn).maybeSingle();
        if (existing && existing.id !== e.id) continue;

        if (!DRY_RUN) {
          await db.from('gs_entities').update({
            abn: result.abn,
            postcode: result.postcode || undefined,
            state: result.state || undefined,
          }).eq('id', e.id);
        }
        resolved++;
      }

      if (checked % 100 === 0) log(`  [${checked}] resolved=${resolved}`);
    }

    log(`Phase 3 done: ${resolved} additional ABNs resolved (of ${checked} checked)`);
    return resolved;
  }

  return 0;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  log('=== ABR Registry Ingestion Agent ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (LIMIT) log(`Limit: ${LIMIT} per phase`);
  if (PHASE_FILTER) log(`Phase: ${PHASE_FILTER} only`);

  const t0 = Date.now();
  let totalActions = 0;

  if (!PHASE_FILTER || PHASE_FILTER === '1') {
    totalActions += await phase1_fillMissingAbns();
  }

  if (!PHASE_FILTER || PHASE_FILTER === '2') {
    totalActions += await phase2_enrichFromAbr();
  }

  if (!PHASE_FILTER || PHASE_FILTER === '3') {
    totalActions += await phase3_repairRelationships();
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== DONE === ${totalActions} total actions in ${elapsed} minutes`);

  // Summary
  const { data: summary } = await db.rpc('get_abn_coverage_summary').catch(() => ({ data: null }));
  if (!summary) {
    // Manual summary
    const types = ['indigenous_corp', 'government_body', 'political_party', 'company', 'charity'];
    for (const t of types) {
      const all = await db.from('gs_entities').select('*', { count: 'exact', head: true }).eq('entity_type', t);
      const withAbn = await db.from('gs_entities').select('*', { count: 'exact', head: true }).eq('entity_type', t).not('abn', 'is', null);
      log(`  ${t}: ${withAbn.count}/${all.count} with ABN (${((withAbn.count/all.count)*100).toFixed(1)}%)`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
