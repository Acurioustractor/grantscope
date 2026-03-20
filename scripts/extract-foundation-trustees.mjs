#!/usr/bin/env node

/**
 * Extract Foundation / Trust Governance from ACNC + foundations table
 *
 * Two sources:
 *   A. foundations.board_members text field (~1,360 foundations with data)
 *      Parses "Name - Role" comma-separated format
 *   B. ACNC API responsible persons for remaining foundations (~9,400)
 *      Fetches via ACNC entity API using ABN lookup
 *
 * Inserts into person_roles with source='foundation_board'.
 *
 * Usage:
 *   node --env-file=.env scripts/extract-foundation-trustees.mjs [options]
 *
 * Options:
 *   --live             Actually insert (default: dry run)
 *   --limit=N          Max foundations per source (default: all)
 *   --source=text|acnc|all  Which source to process (default: all)
 *   --rps=N            Requests per second for ACNC API (default: 3)
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

const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SOURCE = sourceArg ? sourceArg.split('=')[1] : 'all';

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

// Role mapping: text field role strings -> person_roles.role_type
const ROLE_MAP = {
  'director': 'director',
  'alternate director': 'alternate_director',
  'secretary': 'secretary',
  'public officer': 'public_officer',
  'chairperson': 'chair',
  'chair': 'chair',
  'chairman': 'chair',
  'chairwoman': 'chair',
  'deputy chairperson': 'chair',
  'deputy chair': 'chair',
  'chief executive officer': 'ceo',
  'ceo': 'ceo',
  'executive director': 'ceo',
  'managing director': 'director',
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
  'patron': 'other',
  'member': 'other',
  'governor': 'board_member',
  'other': 'other',
};

function mapRole(role) {
  if (!role) return 'trustee'; // default for foundations
  const normalized = role.toLowerCase().trim()
    .replace(/^(chair|deputy)\s+of\s+(trustees|the\s+board|directors)$/i, '$1')
    .replace(/\s*\(.*?\)\s*/g, '') // strip parenthetical dates etc.
    .trim();
  return ROLE_MAP[normalized] || 'other';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [foundation-trustees] ${msg}`);
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
          'User-Agent': 'CivicGraph/1.0 (civicgraph.com.au; public-benefit-research)',
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
// Source A: Parse board_members text field from foundations table
// ---------------------------------------------------------------------------

async function extractFromText() {
  log('=== Source A: Parsing board_members text from foundations table ===');

  // Fetch foundations with board_members text
  // board_members is a Postgres text[] array - cast to text for exec_sql
  let query = `
    SELECT f.acnc_abn, f.name, array_to_json(f.board_members)::text as board_members
    FROM foundations f
    WHERE f.board_members IS NOT NULL
      AND array_length(f.board_members, 1) > 0
    ORDER BY f.name
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`Query failed: ${error.message}`);

  log(`  Found ${data.length} foundations with board_members text`);

  let targets = data;
  if (LIMIT) {
    targets = targets.slice(0, LIMIT);
    log(`  Limited to ${LIMIT}`);
  }

  const personRecords = [];
  let parsed = 0;
  let totalPersons = 0;
  let parseErrors = 0;

  for (const foundation of targets) {
    try {
      const members = parseBoardMembers(foundation.board_members);

      for (const member of members) {
        const acn = foundation.acnc_abn && foundation.acnc_abn.length === 11
          ? foundation.acnc_abn.slice(2) : (foundation.acnc_abn || '');

        personRecords.push({
          person_name: member.name,
          person_name_normalised: normalizeName(member.name),
          role_type: mapRole(member.role),
          company_acn: acn,
          company_abn: foundation.acnc_abn || null,
          company_name: foundation.name,
          source: 'foundation_board',
          confidence: 'reported',
          properties: {
            original_role: member.role || null,
            raw_text: member.raw,
            extraction_method: 'text_parse',
          },
        });
        totalPersons++;
      }

      parsed++;
    } catch (err) {
      parseErrors++;
      if (parseErrors <= 5) log(`  Parse error (${foundation.name}): ${err.message}`);
      parsed++;
    }
  }

  log(`  Parsed ${parsed} foundations, extracted ${totalPersons} persons, ${parseErrors} errors`);
  return personRecords;
}

/**
 * Parse board_members from Postgres text[] array (serialized as JSON string).
 * Each element is "Name - Role" or "Name - Role (as of Date)".
 */
function parseBoardMembers(text) {
  if (!text || !text.trim()) return [];

  // Parse JSON array from array_to_json()::text
  let parts;
  try {
    parts = JSON.parse(text);
    if (!Array.isArray(parts)) return [];
  } catch {
    // Fallback: split on comma (for plain text format)
    parts = text.split(/,(?![^(]*\))/);
  }

  const members = [];

  for (const part of parts) {
    const raw = (typeof part === 'string' ? part : String(part)).trim();
    if (!raw) continue;

    let name = raw;
    let role = null;

    // Pattern 1: "Name - Role"
    const dashMatch = raw.match(/^(.+?)\s*[-\u2013\u2014]\s*(.+)$/);
    if (dashMatch) {
      name = dashMatch[1].trim();
      role = dashMatch[2].trim();
    }

    // Pattern 2: "Name (Role)" if no dash found
    if (!dashMatch) {
      const parenMatch = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        role = parenMatch[2].trim();
      }
    }

    // Strip date annotations from role: "Trustee (as of June 2022)"
    if (role) {
      role = role.replace(/\s*\(as\s+of\s+[^)]+\)/gi, '').trim();
    }

    // Skip if name is too short or looks like garbage
    if (!name || name.length < 2) continue;
    // Skip if name is just a role word
    if (/^(director|secretary|trustee|chair|ceo|cfo|treasurer|president|member|board)$/i.test(name)) continue;

    members.push({ name, role, raw });
  }

  return members;
}

// ---------------------------------------------------------------------------
// Source B: ACNC API for foundations without board_members text
// ---------------------------------------------------------------------------

async function extractFromAcnc() {
  log('=== Source B: Fetching responsible persons from ACNC API ===');

  // Get foundations without board_members text that have ACNC ABNs
  // Exclude ones that already have person_roles from any source
  const query = `
    SELECT f.acnc_abn, f.name
    FROM foundations f
    WHERE f.acnc_abn IS NOT NULL
      AND (f.board_members IS NULL OR array_length(f.board_members, 1) IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM person_roles pr
        WHERE pr.company_abn = f.acnc_abn
          AND pr.source IN ('foundation_board', 'acnc_register')
      )
    ORDER BY f.name
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`Query failed: ${error.message}`);

  log(`  Found ${data.length} foundations needing ACNC lookup`);

  let targets = data;
  if (LIMIT) {
    targets = targets.slice(0, LIMIT);
    log(`  Limited to ${LIMIT}`);
  }

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
  }

  const personRecords = [];
  let processed = 0;
  let totalPersons = 0;
  let noPersons = 0;
  let noUuid = 0;
  let errors = 0;

  for (const foundation of targets) {
    try {
      // Look up ACNC UUID from cache first
      let uuid = abnToUuid.get(foundation.acnc_abn);

      if (!uuid) {
        // Fallback: search ACNC API
        try {
          const searchUrl = `${ACNC_SEARCH}?SearchText=${foundation.acnc_abn}&State=All&page=0`;
          const searchData = await fetchWithRetry(searchUrl);
          const match = (searchData.results || []).find(r => {
            const abn = (r.data?.Abn || '').replace(/\s/g, '');
            return abn === foundation.acnc_abn;
          });
          if (match) uuid = match.uuid;
        } catch { /* ignore search errors */ }
      }

      if (!uuid) {
        noUuid++;
        processed++;
        continue;
      }

      // Fetch entity detail
      const entity = await fetchWithRetry(`${ACNC_ENTITY}/${uuid}`);
      const persons = entity?.data?.ResponsiblePersons || [];

      if (persons.length === 0) {
        noPersons++;
      } else {
        for (const person of persons) {
          if (!person.Name) continue;

          const acn = foundation.acnc_abn.length === 11
            ? foundation.acnc_abn.slice(2) : foundation.acnc_abn;

          personRecords.push({
            person_name: person.Name.trim(),
            person_name_normalised: normalizeName(person.Name),
            role_type: mapRole(person.Role),
            company_acn: acn,
            company_abn: foundation.acnc_abn,
            company_name: foundation.name,
            source: 'foundation_board',
            confidence: 'registry',
            properties: {
              acnc_uuid: uuid,
              original_role: person.Role || null,
              extraction_method: 'acnc_api',
            },
          });
          totalPersons++;
        }
      }

      processed++;

      if (processed % 100 === 0) {
        log(`  ${processed}/${targets.length} — ${totalPersons} persons, ${noPersons} empty, ${noUuid} no UUID, ${errors} errors`);
      }
    } catch (err) {
      errors++;
      processed++;
      if (errors <= 10) log(`  ERROR ${foundation.acnc_abn} (${foundation.name}): ${err.message}`);
    }
  }

  log(`  Complete: ${processed} processed, ${totalPersons} persons, ${noPersons} empty, ${noUuid} no UUID, ${errors} errors`);
  return personRecords;
}

// ---------------------------------------------------------------------------
// Store records via psql
// ---------------------------------------------------------------------------

async function storePersons(personRecords) {
  log('=== Upserting person records ===');

  if (DRY_RUN) {
    log(`  DRY RUN: would upsert ${personRecords.length} records`);

    // Show distribution by extraction method
    const bySrc = {};
    for (const r of personRecords) {
      const method = r.properties.extraction_method || 'unknown';
      bySrc[method] = (bySrc[method] || 0) + 1;
    }
    for (const [method, count] of Object.entries(bySrc)) {
      log(`    ${method}: ${count} records`);
    }

    // Show sample
    for (const r of personRecords.slice(0, 8)) {
      log(`    ${r.person_name} — ${r.role_type} — ${r.company_name}`);
    }
    if (personRecords.length > 8) log(`    ... and ${personRecords.length - 8} more`);

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

  // Insert via psql in batches
  let totalInserted = 0;
  let totalErrors = 0;
  const batchCount = Math.ceil(personRecords.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
    const batch = personRecords.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    const sqlFile = `${OUTPUT_DIR}/foundation-trustees-batch-${batchIdx}.sql`;

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
        'foundation_board',
        '${r.confidence}',
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

      const result = execSync(
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
  log('Starting Foundation Trustee Extraction');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`  Source: ${SOURCE}`);
  log(`  Limit: ${LIMIT || 'none'}`);
  log(`  Rate limit: ${RPS} req/s`);
  log(`  Batch size: ${BATCH_SIZE}`);
  log('');

  const run = await logStart(supabase, 'extract-foundation-trustees', 'Foundation Trustee Extraction');

  try {
    const allRecords = [];

    // Source A: Text parsing
    if (SOURCE === 'all' || SOURCE === 'text') {
      const textRecords = await extractFromText();
      allRecords.push(...textRecords);
      log(`  Source A total: ${textRecords.length} records`);
    }

    // Source B: ACNC API
    if (SOURCE === 'all' || SOURCE === 'acnc') {
      const acncRecords = await extractFromAcnc();
      allRecords.push(...acncRecords);
      log(`  Source B total: ${acncRecords.length} records`);
    }

    log(`\n  Combined total: ${allRecords.length} person records`);

    // Deduplicate by (normalised_name, role_type, company_abn)
    const seen = new Set();
    const deduped = [];
    for (const r of allRecords) {
      const key = `${r.person_name_normalised}|${r.role_type}|${r.company_abn || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(r);
      }
    }
    log(`  After dedup: ${deduped.length} records (${allRecords.length - deduped.length} duplicates removed)`);

    // Store
    const result = await storePersons(deduped);

    await logComplete(supabase, run.id, {
      items_found: deduped.length,
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
