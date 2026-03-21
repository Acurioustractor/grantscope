#!/usr/bin/env node
/**
 * Ingest NDIS Providers — Bridge ndis_registered_providers to gs_entities
 *
 * Links NDIS registered providers (already in `ndis_registered_providers` table)
 * to the CivicGraph entity graph (gs_entities) via ABN matching, and creates
 * new entities for providers not yet in the graph.
 *
 * Phase 1: ABN exact match (ndis_registered_providers.abn -> gs_entities.abn)
 * Phase 2: Create new gs_entities for unmatched NDIS providers with ABNs
 * Phase 3: Summary and stats
 *
 * Prerequisites:
 *   - Run import-ndis-provider-register.mjs first to populate ndis_registered_providers
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-ndis-providers.mjs --dry-run
 *   node --env-file=.env scripts/ingest-ndis-providers.mjs --apply
 *   node --env-file=.env scripts/ingest-ndis-providers.mjs --apply --skip-create
 *   node --env-file=.env scripts/ingest-ndis-providers.mjs --apply --limit=5000
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run') || !APPLY;
const SKIP_CREATE = process.argv.includes('--skip-create');
const BATCH_SIZE = 500;
const PAGE_SIZE = 1000;

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[ingest-ndis-providers] ${msg}`);
}

/**
 * Generate a CivicGraph entity ID from an ABN.
 */
function makeGsId(abn) {
  return 'AU-ABN-' + abn.replace(/\s/g, '');
}

/**
 * Infer entity_type from provider characteristics.
 * Most NDIS providers are private businesses, but some are charities/community orgs.
 */
function inferEntityType(provider) {
  // NDIS providers are a mix of companies, charities, sole traders etc.
  // Use 'company' as default — most are corporate entities
  return 'company';
}

/**
 * Map state code from NDIS format to CivicGraph standard.
 */
function normalizeState(stateCode) {
  const map = {
    'NSW': 'NSW',
    'VIC': 'VIC',
    'QLD': 'QLD',
    'SA': 'SA',
    'WA': 'WA',
    'TAS': 'TAS',
    'NT': 'NT',
    'ACT': 'ACT',
  };
  return map[stateCode?.toUpperCase()] || stateCode || null;
}

/**
 * Load all unique NDIS providers (approved only) with their latest data.
 * Groups by ABN to deduplicate multiple provider_detail_ids under the same ABN.
 */
async function loadNdisProviders() {
  const providers = new Map(); // abn -> provider
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await db
      .from('ndis_registered_providers')
      .select('abn, provider_name, legal_name, state_code, postcode, website, registration_status')
      .eq('registration_status', 'Approved')
      .not('abn', 'is', null)
      .order('abn')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load NDIS providers: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      const abn = row.abn.replace(/\s/g, '');
      if (!abn || abn.length !== 11) continue;

      // Keep the first occurrence (or update if this has more info)
      if (!providers.has(abn)) {
        providers.set(abn, {
          abn,
          provider_name: row.provider_name,
          legal_name: row.legal_name,
          state_code: row.state_code,
          postcode: row.postcode,
          website: row.website,
          registration_status: row.registration_status,
        });
      }
    }

    total += data.length;
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  log(`Loaded ${total} NDIS provider rows, ${providers.size} unique ABNs`);
  return providers;
}

/**
 * Load all gs_entities ABN index into memory.
 */
async function loadEntityAbnIndex() {
  const index = new Map(); // abn -> entity_id
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from('gs_entities')
      .select('id, abn')
      .not('abn', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load entity index: ${error.message}`);
    if (!data?.length) break;
    for (const e of data) {
      if (e.abn) index.set(e.abn, e.id);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  log(`Loaded ${index.size} entities with ABNs`);
  return index;
}

/**
 * Phase 1: Match NDIS providers to existing gs_entities by ABN.
 */
function matchByAbn(providers, entityIndex) {
  const matched = [];
  const unmatched = [];

  for (const [abn, provider] of providers) {
    const entityId = entityIndex.get(abn);
    if (entityId) {
      matched.push({ abn, entityId, provider });
    } else {
      unmatched.push({ abn, provider });
    }
  }

  return { matched, unmatched };
}

/**
 * Phase 2: Create new gs_entities for unmatched NDIS providers.
 */
async function createEntities(unmatchedProviders) {
  if (DRY_RUN || SKIP_CREATE) {
    log(`  [${DRY_RUN ? 'dry-run' : 'skip-create'}] Would create ${unmatchedProviders.length} new entities`);
    return { created: 0, errors: 0 };
  }

  let created = 0;
  let errors = 0;

  // Process in batches
  const toCreate = LIMIT ? unmatchedProviders.slice(0, LIMIT) : unmatchedProviders;

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    const rows = batch.map(({ abn, provider }) => ({
      gs_id: makeGsId(abn),
      canonical_name: provider.legal_name || provider.provider_name,
      abn,
      entity_type: inferEntityType(provider),
      state: normalizeState(provider.state_code),
      postcode: provider.postcode || null,
      confidence: 'registry',
      metadata: {
        ndis_provider_name: provider.provider_name,
        ndis_legal_name: provider.legal_name,
        ndis_registration_status: provider.registration_status,
        ndis_website: provider.website,
        source: 'ndis_provider_register',
      },
    }));

    const { error } = await db
      .from('gs_entities')
      .upsert(rows, { onConflict: 'gs_id', ignoreDuplicates: true });

    if (error) {
      errors++;
      if (errors <= 3) log(`  Batch error at offset ${i}: ${error.message}`);
    } else {
      created += batch.length;
    }

    if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= toCreate.length) {
      log(`  Created ${created}/${toCreate.length} entities (${errors} batch errors)`);
    }
  }

  return { created, errors };
}

/**
 * Phase 3: Generate summary statistics.
 */
function generateSummary(providers, matched, unmatched, createResult) {
  const byState = new Map();
  for (const [, provider] of providers) {
    const state = provider.state_code || 'Unknown';
    byState.set(state, (byState.get(state) || 0) + 1);
  }

  return {
    total_providers: providers.size,
    matched_to_existing: matched.length,
    unmatched: unmatched.length,
    match_rate_pct: ((matched.length / providers.size) * 100).toFixed(1),
    entities_created: createResult.created,
    create_errors: createResult.errors,
    by_state: Object.fromEntries([...byState.entries()].sort((a, b) => b[1] - a[1])),
  };
}

async function main() {
  log('=== NDIS Provider Ingestion Pipeline ===');
  log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  log(`  Skip entity creation: ${SKIP_CREATE}`);
  log(`  Limit: ${LIMIT || 'none'}`);
  log('');

  const run = await logStart(db, 'ingest-ndis-providers', 'Ingest NDIS Providers');

  try {
    // Load data
    log('--- Phase 0: Load data ---');
    const providers = await loadNdisProviders();
    const entityIndex = await loadEntityAbnIndex();

    // Phase 1: ABN match
    log('');
    log('--- Phase 1: ABN Exact Match ---');
    const { matched, unmatched } = matchByAbn(providers, entityIndex);
    log(`  Matched: ${matched.length} NDIS providers already in CivicGraph`);
    log(`  Unmatched: ${unmatched.length} NDIS providers not yet in CivicGraph`);
    log(`  Match rate: ${((matched.length / providers.size) * 100).toFixed(1)}%`);

    // Show entity_type breakdown of matched entities
    const matchedTypes = new Map();
    for (const { provider } of matched) {
      const state = provider.state_code || 'Unknown';
      matchedTypes.set(state, (matchedTypes.get(state) || 0) + 1);
    }

    // Phase 2: Create entities for unmatched
    log('');
    log('--- Phase 2: Create New Entities ---');
    const createResult = await createEntities(unmatched);

    // Phase 3: Summary
    log('');
    log('--- Phase 3: Summary ---');
    const summary = generateSummary(providers, matched, unmatched, createResult);

    log(`  Total NDIS providers (approved, with ABN): ${summary.total_providers}`);
    log(`  Already in CivicGraph: ${summary.matched_to_existing} (${summary.match_rate_pct}%)`);
    log(`  New entities created: ${summary.entities_created}`);
    if (summary.create_errors > 0) log(`  Create errors: ${summary.create_errors}`);

    log('');
    log('  Providers by state:');
    for (const [state, count] of Object.entries(summary.by_state)) {
      log(`    ${state.padEnd(5)} ${count.toLocaleString()}`);
    }

    // Report what the power index integration would look like
    const totalInGraph = summary.matched_to_existing + summary.entities_created;
    log('');
    log(`  Total NDIS providers now linkable in CivicGraph: ${totalInGraph}`);
    log(`  These will appear as system #8 in mv_entity_power_index after running:`);
    log(`    psql -f scripts/migrations/add-ndis-to-power-index.sql`);
    log(`    node --env-file=.env scripts/refresh-views.mjs --view mv_entity_power_index`);

    if (!APPLY) {
      log('');
      log('  (DRY RUN -- use --apply to write changes)');
    }

    await logComplete(db, run.id, {
      items_found: summary.total_providers,
      items_new: summary.entities_created,
      items_updated: summary.matched_to_existing,
      status: summary.create_errors > 0 ? 'partial' : 'success',
      errors: summary.create_errors > 0 ? [`${summary.create_errors} batch insert errors`] : [],
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
