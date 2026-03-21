#!/usr/bin/env node

/**
 * Enrich ORIC Corporations with Governance / Director Data
 *
 * ORIC's public register does NOT expose director names publicly (privacy by design).
 * However, ~1,292 ORIC corporations are also ACNC-registered charities.
 * This script fetches responsible persons from the ACNC API for those corps
 * and inserts them into person_roles with source='oric_acnc'.
 *
 * Phases:
 *   1. Query ORIC corporations that are ACNC-registered (have ABN in acnc_charities)
 *   2. For each, look up ACNC entity UUID and fetch ResponsiblePersons
 *   3. Upsert into person_roles via psql
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-oric-governance.mjs [options]
 *
 * Options:
 *   --live             Actually insert (default: dry run)
 *   --limit=N          Max corporations to process (default: all)
 *   --rps=N            Requests per second (default: 3)
 *   --batch-size=N     DB insert batch size (default: 200)
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LIVE = process.argv.includes('--live');
const DRY_RUN = !LIVE;

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const rpsArg = process.argv.find(a => a.startsWith('--rps='));
const RPS = rpsArg ? parseInt(rpsArg.split('=')[1], 10) : 3;

const batchArg = process.argv.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1], 10) : 200;

const OUTPUT_DIR = new URL('../output', import.meta.url).pathname;
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// ACNC API
// ---------------------------------------------------------------------------

const ACNC_SEARCH = 'https://www.acnc.gov.au/api/dynamics/search/charity';
const ACNC_ENTITY = 'https://www.acnc.gov.au/api/dynamics/entity';

// ORIC role -> person_roles role_type mapping
const ROLE_MAP = {
  'director': 'director',
  'alternate director': 'alternate_director',
  'secretary': 'secretary',
  'public officer': 'public_officer',
  'chairperson': 'chair',
  'chair': 'chair',
  'deputy chairperson': 'chair',
  'deputy chair': 'chair',
  'chief executive officer': 'ceo',
  'ceo': 'ceo',
  'chief financial officer': 'cfo',
  'cfo': 'cfo',
  'board member': 'board_member',
  'trustee': 'trustee',
  'treasurer': 'officeholder',
  'president': 'officeholder',
  'vice-president': 'officeholder',
  'vice president': 'officeholder',
  'committee member': 'other',
  'responsible person': 'other',
  'other': 'other',
};

function mapRole(role) {
  if (!role) return 'other';
  return ROLE_MAP[role.toLowerCase().trim()] || 'other';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [oric-governance] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RateLimiter {
  constructor(maxRps) {
    this.maxRps = maxRps;
    this.window = [];
  }
  async wait() {
    const now = Date.now();
    this.window = this.window.filter(t => now - t < 1000);
    if (this.window.length >= this.maxRps) {
      const oldest = this.window[0];
      const waitMs = 1000 - (now - oldest) + 10;
      if (waitMs > 0) await sleep(waitMs);
    }
    this.window.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(RPS);

async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await rateLimiter.wait();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'CivicGraph/1.0 (civicgraph.app; public-benefit-research)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '10', 10);
        log(`  Rate limited (429), waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.status === 503 || res.status === 502) {
        log(`  Server error (${res.status}), waiting 5s`);
        await sleep(5000);
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const waitMs = attempt * 2000;
      log(`  Fetch error: ${err.message}, retrying in ${waitMs}ms (${attempt}/${maxRetries})`);
      await sleep(waitMs);
    }
  }
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeSql(s) {
  return s ? s.replace(/'/g, "''") : '';
}

// ---------------------------------------------------------------------------
// Phase 1: Get ORIC corps with ACNC ABNs
// ---------------------------------------------------------------------------

async function getOricAcncCorps() {
  log('=== Phase 1: Finding ORIC corps registered with ACNC ===');

  const query = `
    SELECT oc.icn, oc.name, oc.abn, oc.corporation_size, oc.state,
           ac.abn as acnc_abn, ac.number_of_responsible_persons
    FROM oric_corporations oc
    JOIN acnc_charities ac ON oc.abn = ac.abn
    WHERE oc.status = 'Registered'
      AND oc.abn IS NOT NULL
    ORDER BY ac.number_of_responsible_persons DESC NULLS LAST
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`Query failed: ${error.message}`);

  log(`  Found ${data.length} ORIC corporations also in ACNC`);

  // Check which already have person_roles
  const checkQuery = `
    SELECT DISTINCT company_abn
    FROM person_roles
    WHERE source IN ('oric_acnc', 'acnc_register')
      AND company_abn IS NOT NULL
  `;
  const { data: existing } = await supabase.rpc('exec_sql', { query: checkQuery });
  const existingAbns = new Set((existing || []).map(r => r.company_abn));

  const needsEnrichment = data.filter(r => !existingAbns.has(r.abn));
  log(`  ${existingAbns.size} already have person_roles, ${needsEnrichment.length} need enrichment`);

  return needsEnrichment;
}

// ---------------------------------------------------------------------------
// Phase 2: Fetch responsible persons from ACNC API
// ---------------------------------------------------------------------------

async function fetchPersons(corps) {
  log('=== Phase 2: Fetching responsible persons from ACNC API ===');

  // Load cached ACNC UUIDs (from scrape-acnc-people.mjs phase 1)
  const UUID_FILE = `${OUTPUT_DIR}/acnc-charity-uuids.json`;
  const abnToUuid = new Map();

  if (existsSync(UUID_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(UUID_FILE, 'utf8'));
      for (const c of (cached.charities || [])) {
        if (c.abn && c.uuid) abnToUuid.set(c.abn, c.uuid);
      }
      log(`  Loaded ${abnToUuid.size} ABN->UUID mappings from cache`);
    } catch (err) {
      log(`  Warning: could not load UUID cache: ${err.message}`);
    }
  } else {
    log(`  Warning: No UUID cache at ${UUID_FILE}. Run scrape-acnc-people.mjs --phase=1 first.`);
    log('  Will fall back to ACNC search API (less reliable).');
  }

  let targets = corps;
  if (LIMIT) {
    targets = targets.slice(0, LIMIT);
    log(`  Limited to ${LIMIT} corporations`);
  }

  const personRecords = [];
  let processed = 0;
  let totalPersons = 0;
  let noPersons = 0;
  let errors = 0;
  let noUuid = 0;

  for (const corp of targets) {
    try {
      // Look up ACNC UUID from cache first, fall back to search API
      let uuid = abnToUuid.get(corp.abn);

      if (!uuid) {
        // Fallback: search ACNC API by ABN
        try {
          const searchUrl = `${ACNC_SEARCH}?SearchText=${corp.abn}&State=All&page=0`;
          const searchData = await fetchWithRetry(searchUrl);
          const match = (searchData.results || []).find(r => {
            const abn = (r.data?.Abn || '').replace(/\s/g, '');
            return abn === corp.abn;
          });
          if (match) uuid = match.uuid;
        } catch { /* ignore search errors */ }
      }

      if (!uuid) {
        noUuid++;
        processed++;
        continue;
      }

      // Fetch entity detail for responsible persons
      const entity = await fetchWithRetry(`${ACNC_ENTITY}/${uuid}`);
      const persons = entity?.data?.ResponsiblePersons || [];

      if (persons.length === 0) {
        noPersons++;
      } else {
        for (const person of persons) {
          if (!person.Name) continue;

          const acn = corp.abn.length === 11 ? corp.abn.slice(2) : corp.abn;
          personRecords.push({
            person_name: person.Name.trim(),
            person_name_normalised: normalizeName(person.Name),
            role_type: mapRole(person.Role),
            company_acn: acn,
            company_abn: corp.abn,
            company_name: corp.name,
            source: 'oric_acnc',
            confidence: 'registry',
            properties: {
              oric_icn: corp.icn,
              corporation_size: corp.corporation_size,
              state: corp.state,
              acnc_uuid: uuid,
              original_role: person.Role || null,
            },
          });
          totalPersons++;
        }
      }

      processed++;

      if (processed % 50 === 0) {
        log(`  ${processed}/${targets.length} — ${totalPersons} persons, ${noPersons} empty, ${noUuid} no UUID, ${errors} errors`);
      }
    } catch (err) {
      errors++;
      processed++;
      if (errors <= 10) log(`  ERROR ${corp.icn} (${corp.name}): ${err.message}`);
    }
  }

  log(`  Complete: ${processed} processed, ${totalPersons} persons, ${noPersons} empty, ${noUuid} no UUID, ${errors} errors`);
  return personRecords;
}

// ---------------------------------------------------------------------------
// Phase 3: Upsert into person_roles via psql
// ---------------------------------------------------------------------------

async function storePersons(personRecords) {
  log('=== Phase 3: Upserting person records ===');

  if (DRY_RUN) {
    log(`  DRY RUN: would upsert ${personRecords.length} records`);
    // Show sample
    for (const r of personRecords.slice(0, 5)) {
      log(`    ${r.person_name} — ${r.role_type} — ${r.company_name} (ICN: ${r.properties.oric_icn})`);
    }
    if (personRecords.length > 5) log(`    ... and ${personRecords.length - 5} more`);
    return { inserted: 0 };
  }

  if (personRecords.length === 0) {
    log('  No records to insert');
    return { inserted: 0 };
  }

  // Build ABN -> entity_id mapping
  log('  Loading ABN -> entity_id mapping...');
  const uniqueAbns = [...new Set(personRecords.map(r => r.company_abn).filter(Boolean))];
  const abnToEntityId = new Map();

  for (let i = 0; i < uniqueAbns.length; i += 500) {
    const batch = uniqueAbns.slice(i, i + 500);
    const abnList = batch.map(a => `'${a}'`).join(',');
    try {
      const { data } = await supabase.rpc('exec_sql', {
        query: `SELECT id, abn FROM gs_entities WHERE abn IN (${abnList})`,
      });
      for (const row of (data || [])) {
        abnToEntityId.set(row.abn, row.id);
      }
    } catch (err) {
      log(`  Warning: ABN lookup error: ${err.message}`);
    }
  }
  log(`  Mapped ${abnToEntityId.size} ABNs to entity IDs`);

  // Deduplicate by unique key (person_name_normalised + role_type + company_acn + appointment_date)
  const seen = new Set();
  const deduped = [];
  for (const r of personRecords) {
    const norm = r.person_name.toUpperCase().replace(/\s+/g, ' ').trim();
    const key = `${norm}|${r.role_type}|${r.company_acn}|${r.appointment_date || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  log(`  Deduplicated: ${personRecords.length} -> ${deduped.length} unique records`);
  const dedupedRecords = deduped;

  // Insert via psql in batches
  let totalInserted = 0;
  let totalErrors = 0;
  const batchCount = Math.ceil(dedupedRecords.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
    const batch = dedupedRecords.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    const sqlFile = `${OUTPUT_DIR}/oric-governance-batch-${batchIdx}.sql`;

    const values = batch.map(r => {
      const entityId = abnToEntityId.get(r.company_abn) || null;
      const propsJson = JSON.stringify(r.properties).replace(/'/g, "''");

      return `(
        '${escapeSql(r.person_name)}',
        '${escapeSql(r.role_type)}',
        '${escapeSql(r.company_acn)}',
        '${escapeSql(r.company_name)}',
        ${r.company_abn ? `'${escapeSql(r.company_abn)}'` : 'NULL'},
        ${entityId ? `'${entityId}'` : 'NULL'},
        'oric_acnc',
        'registry',
        '${propsJson}'::jsonb
      )`;
    });

    const sql = `
-- Batch ${batchIdx + 1}/${batchCount}: ${batch.length} records
INSERT INTO person_roles (
  person_name,
  role_type,
  company_acn,
  company_name,
  company_abn,
  entity_id,
  source,
  confidence,
  properties
) VALUES
${values.join(',\n')}
ON CONFLICT (person_name_normalised, role_type, company_acn, COALESCE(appointment_date, '1900-01-01'::date))
DO UPDATE SET
  company_name = EXCLUDED.company_name,
  company_abn = EXCLUDED.company_abn,
  entity_id = COALESCE(EXCLUDED.entity_id, person_roles.entity_id),
  properties = EXCLUDED.properties,
  source = EXCLUDED.source,
  updated_at = NOW();
`;

    writeFileSync(sqlFile, sql);

    try {
      const dbPassword = process.env.DATABASE_PASSWORD;
      if (!dbPassword) {
        log('  ERROR: DATABASE_PASSWORD not set');
        totalErrors++;
        continue;
      }

      execSync(
        `psql --set ON_ERROR_STOP=1 -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f "${sqlFile}"`,
        {
          env: { ...process.env, PGPASSWORD: dbPassword },
          encoding: 'utf8',
          timeout: 120000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      totalInserted += batch.length;
      log(`  Batch ${batchIdx + 1}/${batchCount}: ${batch.length} records upserted (${totalInserted} total)`);
    } catch (err) {
      totalErrors++;
      const stderr = err.stderr || err.message || '';
      log(`  ERROR batch ${batchIdx + 1}: ${stderr.slice(0, 300)}`);
    }

    // Clean up temp file
    try { execSync(`rm -f "${sqlFile}"`, { encoding: 'utf8' }); } catch { /* ignore */ }
  }

  log(`  Complete: ${totalInserted} inserted/updated, ${totalErrors} batch errors`);
  return { inserted: totalInserted, errors: totalErrors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('Starting ORIC Governance Enrichment');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`  Limit: ${LIMIT || 'none'}`);
  log(`  Rate limit: ${RPS} req/s`);
  log(`  Batch size: ${BATCH_SIZE}`);
  log('');
  log('  Note: ORIC public register does not expose directors publicly.');
  log('  Using ACNC API for ORIC corps that are also ACNC-registered charities.');
  log('');

  const run = await logStart(supabase, 'enrich-oric-governance', 'ORIC Governance Enrichment');

  try {
    // Phase 1: Get ORIC corps with ACNC ABNs
    const corps = await getOricAcncCorps();

    // Phase 2: Fetch persons from ACNC API
    const personRecords = await fetchPersons(corps);

    // Phase 3: Store in DB
    const result = await storePersons(personRecords);

    await logComplete(supabase, run.id, {
      items_found: personRecords.length,
      items_new: result.inserted,
      status: 'success',
    });

    log('\nDone.');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    await logFailed(supabase, run.id, err.message || String(err));
    process.exit(1);
  }
}

main();
