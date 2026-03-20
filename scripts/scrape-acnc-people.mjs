#!/usr/bin/env node

/**
 * Scrape ACNC Responsible Persons (Board Members)
 *
 * Scrapes the ACNC charity register API for responsible persons (board members,
 * directors, secretaries, trustees etc.) and stores them in the person_roles table.
 *
 * Phases:
 *   1. Collect charity UUIDs from ACNC search API (paginated, 25/page)
 *   2. Fetch entity detail for each charity to get ResponsiblePersons
 *   3. Upsert person_roles into database via psql
 *   4. Detect board interlocks (people on multiple boards)
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-acnc-people.mjs [options]
 *
 * Options:
 *   --phase=N          Run only phase N (1-4), default: all phases
 *   --limit=N          Max charities for phase 2 (default: all)
 *   --resume           Resume from last checkpoint
 *   --batch-size=N     DB insert batch size (default: 500)
 *   --rps=N            Requests per second rate limit (default: 5)
 *   --dry-run          Preview without DB writes
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');

const phaseArg = process.argv.find(a => a.startsWith('--phase='));
const PHASE_ONLY = phaseArg ? parseInt(phaseArg.split('=')[1], 10) : null;

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const batchArg = process.argv.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1], 10) : 500;

const rpsArg = process.argv.find(a => a.startsWith('--rps='));
const RPS = rpsArg ? parseInt(rpsArg.split('=')[1], 10) : 5;

const OUTPUT_DIR = new URL('../output', import.meta.url).pathname;
const UUID_FILE = `${OUTPUT_DIR}/acnc-charity-uuids.json`;
const PROGRESS_FILE = `${OUTPUT_DIR}/acnc-people-progress.json`;
const DATA_FILE = `${OUTPUT_DIR}/acnc-persons-data.json`;

// Ensure output dir exists
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACNC_BASE = 'https://www.acnc.gov.au/api/dynamics';
const SEARCH_URL = `${ACNC_BASE}/search/charity`;
const ENTITY_URL = `${ACNC_BASE}/entity`;
const PAGE_SIZE = 25; // API is fixed at 25

// ACNC role -> person_roles role_type mapping
// Constrained to: director, secretary, alternate_director, public_officer,
//                 chair, ceo, cfo, board_member, trustee, officeholder, other
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

function mapRole(acncRole) {
  if (!acncRole) return 'other';
  const normalized = acncRole.toLowerCase().trim();
  return ROLE_MAP[normalized] || 'other';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [acnc-people] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter: tracks request timestamps and enforces max RPS.
 */
class RateLimiter {
  constructor(maxRps) {
    this.maxRps = maxRps;
    this.window = []; // timestamps of recent requests
  }

  async wait() {
    const now = Date.now();
    // Remove entries older than 1 second
    this.window = this.window.filter(t => now - t < 1000);
    if (this.window.length >= this.maxRps) {
      const oldest = this.window[0];
      const waitMs = 1000 - (now - oldest) + 10; // +10ms buffer
      if (waitMs > 0) await sleep(waitMs);
    }
    this.window.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(RPS);

/**
 * Fetch with retry and rate limiting.
 */
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await rateLimiter.wait();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'CivicGraph/1.0 (civicgraph.com.au; public-benefit-research)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '10', 10);
        log(`  Rate limited (429), waiting ${retryAfter}s before retry ${attempt}/${maxRetries}`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.status === 503 || res.status === 502) {
        log(`  Server error (${res.status}), waiting 5s before retry ${attempt}/${maxRetries}`);
        await sleep(5000);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const waitMs = attempt * 2000;
      log(`  Fetch error: ${err.message}, retrying in ${waitMs}ms (${attempt}/${maxRetries})`);
      await sleep(waitMs);
    }
  }
}

/**
 * Extract ACN from ABN. ABN is 11 digits; ACN is the last 9.
 * Some ABNs start with non-company prefixes -- we still use last 9 as the identifier.
 */
function abnToAcn(abn) {
  if (!abn) return '';
  const digits = abn.replace(/\s/g, '');
  if (digits.length === 11) return digits.slice(2);
  if (digits.length === 9) return digits;
  return digits;
}

/**
 * Normalize a person name for dedup.
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Phase 1: Collect Charity UUIDs
// ---------------------------------------------------------------------------

async function phase1CollectUUIDs() {
  log('=== Phase 1: Collecting charity UUIDs from ACNC search API ===');

  // Check for resume
  let existingUUIDs = [];
  let startPage = 0;

  if (RESUME && existsSync(UUID_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(UUID_FILE, 'utf8'));
      existingUUIDs = saved.charities || [];
      startPage = saved.lastPage || 0;
      log(`  Resuming from page ${startPage} with ${existingUUIDs.length} UUIDs already collected`);
    } catch {
      log('  Could not parse existing UUID file, starting fresh');
    }
  }

  // Get total pages from first request
  const firstPage = await fetchWithRetry(`${SEARCH_URL}?SearchText=&State=All&page=0`);
  const totalPages = firstPage.pager.total_pages;
  const totalResults = firstPage.pager.total_results;
  log(`  Total charities: ${totalResults}, pages: ${totalPages} (${PAGE_SIZE}/page)`);

  // Build map from existing data to avoid dupes
  const uuidSet = new Set(existingUUIDs.map(c => c.uuid));
  const charities = [...existingUUIDs];

  // If not resuming, process first page
  if (startPage === 0 && !RESUME) {
    for (const result of firstPage.results) {
      if (!uuidSet.has(result.uuid)) {
        uuidSet.add(result.uuid);
        charities.push({
          uuid: result.uuid,
          name: result.data?.Name || '',
          abn: result.data?.Abn || '',
          status: result.data?.Status || '',
          size: result.data?.CharitySize || null,
        });
      }
    }
    startPage = 1;
  }

  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 10;

  for (let page = startPage; page < totalPages; page++) {
    try {
      const data = await fetchWithRetry(`${SEARCH_URL}?SearchText=&State=All&page=${page}`);
      let newInPage = 0;

      for (const result of (data.results || [])) {
        if (!uuidSet.has(result.uuid)) {
          uuidSet.add(result.uuid);
          charities.push({
            uuid: result.uuid,
            name: result.data?.Name || '',
            abn: result.data?.Abn || '',
            status: result.data?.Status || '',
            size: result.data?.CharitySize || null,
          });
          newInPage++;
        }
      }

      consecutiveErrors = 0;

      if (page % 100 === 0 || page === totalPages - 1) {
        log(`  Page ${page}/${totalPages} — ${charities.length} charities collected (+${newInPage} new)`);
        // Save checkpoint
        writeFileSync(UUID_FILE, JSON.stringify({
          charities,
          lastPage: page + 1,
          totalPages,
          collectedAt: new Date().toISOString(),
        }, null, 2));
      }
    } catch (err) {
      consecutiveErrors++;
      log(`  ERROR page ${page}: ${err.message} (${consecutiveErrors} consecutive)`);
      if (consecutiveErrors >= maxConsecutiveErrors) {
        log(`  ${maxConsecutiveErrors} consecutive errors, saving and stopping`);
        break;
      }
    }
  }

  // Final save
  writeFileSync(UUID_FILE, JSON.stringify({
    charities,
    lastPage: totalPages,
    totalPages,
    collectedAt: new Date().toISOString(),
    complete: consecutiveErrors < maxConsecutiveErrors,
  }, null, 2));

  // Filter to registered only
  const registered = charities.filter(c => c.status === 'Registered');
  log(`  Complete: ${charities.length} total charities, ${registered.length} registered`);

  return charities;
}

// ---------------------------------------------------------------------------
// Phase 2: Fetch Responsible Persons
// ---------------------------------------------------------------------------

async function phase2FetchPersons(charities) {
  log('=== Phase 2: Fetching responsible persons for each charity ===');

  // Filter to registered charities with ABNs
  let targets = charities.filter(c => c.status === 'Registered' && c.abn);
  log(`  ${targets.length} registered charities with ABNs`);

  if (LIMIT) {
    targets = targets.slice(0, LIMIT);
    log(`  Limited to ${LIMIT} charities`);
  }

  // Load existing progress
  let processedUUIDs = new Set();
  let personRecords = [];

  if (RESUME && existsSync(PROGRESS_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
      processedUUIDs = new Set((saved.charities || []).map(c => c.uuid));
      log(`  Resuming: ${processedUUIDs.size} charities already processed`);
    } catch {
      log('  Could not parse progress file, starting fresh');
    }
  }

  if (RESUME && existsSync(DATA_FILE)) {
    try {
      personRecords = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
      log(`  Resuming: ${personRecords.length} person records already collected`);
    } catch {
      log('  Could not parse data file, starting fresh');
    }
  }

  // Filter out already-processed
  const remaining = targets.filter(c => !processedUUIDs.has(c.uuid));
  log(`  ${remaining.length} charities remaining to process`);

  let processed = 0;
  let totalPersons = 0;
  let errors = 0;
  let noPersons = 0;
  let consecutiveErrors = 0;

  for (const charity of remaining) {
    try {
      const entity = await fetchWithRetry(`${ENTITY_URL}/${charity.uuid}`);
      const persons = entity?.data?.ResponsiblePersons || [];

      if (persons.length === 0) {
        noPersons++;
      } else {
        for (const person of persons) {
          if (!person.Name) continue;

          const acn = abnToAcn(charity.abn);
          const record = {
            person_name: person.Name.trim(),
            person_name_normalised: normalizeName(person.Name),
            role_type: mapRole(person.Role),
            company_acn: acn,
            company_abn: charity.abn,
            company_name: charity.name,
            source: 'acnc_register',
            confidence: 'registry',
            properties: {
              person_uuid: person.uuid || null,
              charity_uuid: charity.uuid,
              charity_size: charity.size,
              original_role: person.Role || null,
            },
          };
          personRecords.push(record);
          totalPersons++;
        }
      }

      processedUUIDs.add(charity.uuid);
      processed++;
      consecutiveErrors = 0;

      // Progress logging
      if (processed % 100 === 0) {
        log(`  ${processed}/${remaining.length} — ${totalPersons} persons, ${noPersons} empty, ${errors} errors`);
      }

      // Checkpoint every 1000
      if (processed % 1000 === 0) {
        savePhase2Checkpoint(processedUUIDs, personRecords, processed, remaining.length);
      }
    } catch (err) {
      errors++;
      consecutiveErrors++;
      log(`  ERROR ${charity.uuid} (${charity.name}): ${err.message}`);

      if (consecutiveErrors >= 20) {
        log('  20 consecutive errors — saving checkpoint and stopping');
        break;
      }
    }
  }

  // Final save
  savePhase2Checkpoint(processedUUIDs, personRecords, processed, remaining.length);
  log(`  Complete: ${processed} charities processed, ${totalPersons} persons found, ${noPersons} empty, ${errors} errors`);
  log(`  Total person records: ${personRecords.length}`);

  return personRecords;
}

function savePhase2Checkpoint(processedUUIDs, personRecords, processed, total) {
  writeFileSync(PROGRESS_FILE, JSON.stringify({
    charities: [...processedUUIDs].map(uuid => ({ uuid })),
    lastProcessed: processed,
    total,
    savedAt: new Date().toISOString(),
  }));
  writeFileSync(DATA_FILE, JSON.stringify(personRecords, null, 2));
  log(`  Checkpoint saved: ${processedUUIDs.size} charities, ${personRecords.length} records`);
}

// ---------------------------------------------------------------------------
// Phase 3: Store in person_roles
// ---------------------------------------------------------------------------

async function phase3Store(personRecords) {
  log('=== Phase 3: Upserting person records to person_roles table ===');

  if (DRY_RUN) {
    log(`  DRY RUN: would upsert ${personRecords.length} records`);
    return { inserted: 0, updated: 0, errors: 0 };
  }

  if (personRecords.length === 0) {
    log('  No records to insert');
    return { inserted: 0, updated: 0, errors: 0 };
  }

  // First, build a lookup of ABN -> gs_entities.id for entity_id linking
  log('  Loading ABN -> entity_id mapping from gs_entities...');
  const uniqueAbns = [...new Set(personRecords.map(r => r.company_abn).filter(Boolean))];
  log(`  ${uniqueAbns.length} unique ABNs to look up`);

  const abnToEntityId = new Map();

  // Query in batches of 500 ABNs
  for (let i = 0; i < uniqueAbns.length; i += 500) {
    const batch = uniqueAbns.slice(i, i + 500);
    const abnList = batch.map(a => `'${a}'`).join(',');
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT id, abn FROM gs_entities WHERE abn IN (${abnList})`,
      });
      if (error) {
        log(`  Warning: ABN lookup batch error: ${error.message}`);
        continue;
      }
      for (const row of (data || [])) {
        abnToEntityId.set(row.abn, row.id);
      }
    } catch (err) {
      log(`  Warning: ABN lookup error: ${err.message}`);
    }
  }
  log(`  Mapped ${abnToEntityId.size} ABNs to entity IDs`);

  // Deduplicate by unique key before insert
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
  if (deduped.length < personRecords.length) {
    log(`  Deduplicated: ${personRecords.length} -> ${deduped.length} unique records`);
  }

  // Write SQL file in batches and execute via psql
  let totalInserted = 0;
  let totalErrors = 0;
  const batchCount = Math.ceil(deduped.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
    const batch = deduped.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    const sqlFile = `${OUTPUT_DIR}/acnc-people-batch-${batchIdx}.sql`;

    const values = batch.map(r => {
      const entityId = abnToEntityId.get(r.company_abn) || null;
      const escapeSql = (s) => s ? s.replace(/'/g, "''") : '';
      const propertiesJson = JSON.stringify(r.properties).replace(/'/g, "''");

      return `(
        '${escapeSql(r.person_name)}',
        '${escapeSql(r.role_type)}',
        '${escapeSql(r.company_acn)}',
        '${escapeSql(r.company_name)}',
        ${r.company_abn ? `'${escapeSql(r.company_abn)}'` : 'NULL'},
        ${entityId ? `'${entityId}'` : 'NULL'},
        'acnc_register',
        'registry',
        '${propertiesJson}'::jsonb
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
  confidence = EXCLUDED.confidence,
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

      // If batch fails, try individual inserts for this batch
      if (batch.length > 1) {
        log(`  Retrying batch ${batchIdx + 1} with individual inserts...`);
        const { inserted, errors: indivErrors } = await insertIndividually(batch, abnToEntityId);
        totalInserted += inserted;
        totalErrors += indivErrors;
      }
    }

    // Clean up temp file
    try {
      execSync(`rm -f "${sqlFile}"`, { encoding: 'utf8' });
    } catch { /* ignore */ }
  }

  log(`  Complete: ${totalInserted} inserted/updated, ${totalErrors} batch errors`);
  return { inserted: totalInserted, updated: 0, errors: totalErrors };
}

/**
 * Fallback: insert records one by one when a batch fails.
 */
async function insertIndividually(records, abnToEntityId) {
  let inserted = 0;
  let errors = 0;

  for (const r of records) {
    const entityId = abnToEntityId.get(r.company_abn) || null;

    try {
      const { error } = await supabase.from('person_roles').upsert(
        {
          person_name: r.person_name,
          role_type: r.role_type,
          company_acn: r.company_acn,
          company_name: r.company_name,
          company_abn: r.company_abn || null,
          entity_id: entityId,
          source: 'acnc_register',
          confidence: 'registry',
          properties: r.properties,
        },
        {
          onConflict: 'person_name_normalised,role_type,company_acn,appointment_date',
          ignoreDuplicates: true,
        }
      );

      if (error) {
        errors++;
        if (errors <= 5) log(`    Individual insert error: ${error.message}`);
      } else {
        inserted++;
      }
    } catch (err) {
      errors++;
    }
  }

  log(`    Individual insert: ${inserted} OK, ${errors} errors`);
  return { inserted, errors };
}

// ---------------------------------------------------------------------------
// Phase 4: Detect Board Interlocks
// ---------------------------------------------------------------------------

async function phase4Interlocks() {
  log('=== Phase 4: Detecting board interlocks ===');

  const query = `
    SELECT
      person_name_normalised,
      COUNT(DISTINCT entity_id) as org_count,
      array_agg(DISTINCT company_name ORDER BY company_name) as orgs
    FROM person_roles
    WHERE source IN ('acnc', 'acnc_register')
      AND entity_id IS NOT NULL
      AND person_name_normalised IS NOT NULL
      AND person_name_normalised != ''
    GROUP BY person_name_normalised
    HAVING COUNT(DISTINCT entity_id) > 1
    ORDER BY org_count DESC
    LIMIT 100
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) {
      log(`  Query error: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      log('  No board interlocks found');
      return;
    }

    log(`  Found ${data.length} people on multiple boards:`);
    log('');

    // Print top 30
    const top = data.slice(0, 30);
    for (const row of top) {
      const orgs = Array.isArray(row.orgs) ? row.orgs : [];
      log(`  ${row.person_name_normalised} — ${row.org_count} orgs:`);
      for (const org of orgs.slice(0, 5)) {
        log(`    - ${org}`);
      }
      if (orgs.length > 5) {
        log(`    ... and ${orgs.length - 5} more`);
      }
    }

    // Save full results
    const interlockFile = `${OUTPUT_DIR}/acnc-board-interlocks.json`;
    writeFileSync(interlockFile, JSON.stringify(data, null, 2));
    log(`\n  Full interlock data saved to ${interlockFile}`);
    log(`  Total interlockers: ${data.length}`);

    // Summary stats
    const totalByCount = {};
    for (const row of data) {
      const count = row.org_count;
      totalByCount[count] = (totalByCount[count] || 0) + 1;
    }
    log('\n  Distribution:');
    for (const [count, num] of Object.entries(totalByCount).sort((a, b) => b[0] - a[0])) {
      log(`    ${count} orgs: ${num} people`);
    }

    return data;
  } catch (err) {
    log(`  Error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('Starting ACNC Responsible Persons scraper');
  log(`  Phase: ${PHASE_ONLY || 'all'}`);
  log(`  Limit: ${LIMIT || 'none'}`);
  log(`  Rate limit: ${RPS} req/s`);
  log(`  Batch size: ${BATCH_SIZE}`);
  log(`  Resume: ${RESUME}`);
  log(`  Dry run: ${DRY_RUN}`);
  log('');

  const run = await logStart(supabase, 'scrape-acnc-people', 'Scrape ACNC Responsible Persons');
  let runId = run.id;

  try {
    let charities;
    let personRecords;
    let storeResult;

    // Phase 1: Collect UUIDs
    if (!PHASE_ONLY || PHASE_ONLY === 1) {
      charities = await phase1CollectUUIDs();
    } else if (existsSync(UUID_FILE)) {
      const saved = JSON.parse(readFileSync(UUID_FILE, 'utf8'));
      charities = saved.charities || [];
      log(`  Loaded ${charities.length} charities from ${UUID_FILE}`);
    } else {
      log('  ERROR: No UUID file found. Run phase 1 first.');
      process.exit(1);
    }

    // Phase 2: Fetch persons
    if (!PHASE_ONLY || PHASE_ONLY === 2) {
      personRecords = await phase2FetchPersons(charities);
    } else if (existsSync(DATA_FILE)) {
      personRecords = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
      log(`  Loaded ${personRecords.length} person records from ${DATA_FILE}`);
    }

    // Phase 3: Store in DB
    if (!PHASE_ONLY || PHASE_ONLY === 3) {
      if (!personRecords || personRecords.length === 0) {
        if (existsSync(DATA_FILE)) {
          personRecords = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
          log(`  Loaded ${personRecords.length} person records from ${DATA_FILE}`);
        } else {
          log('  No person records to store');
        }
      }
      if (personRecords && personRecords.length > 0) {
        storeResult = await phase3Store(personRecords);
      }
    }

    // Phase 4: Interlocks
    if (!PHASE_ONLY || PHASE_ONLY === 4) {
      await phase4Interlocks();
    }

    // Complete
    await logComplete(supabase, runId, {
      items_found: personRecords?.length || 0,
      items_new: storeResult?.inserted || 0,
      status: 'success',
    });

    log('\nDone.');
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    await logFailed(supabase, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
