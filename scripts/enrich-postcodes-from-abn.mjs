#!/usr/bin/env node
// Enrich gs_entities with postcode + state from ABN Lookup API
//
// Targets entities that have an ABN but no postcode.
// Uses the free ABN Lookup JSON API (requires GUID registration).
// Rate-limited to ~3 req/sec to be a good citizen.
//
// Register for a GUID at:
//   https://abr.business.gov.au/Documentation/WebServiceRegistration
// Then add to .env:
//   ABN_LOOKUP_GUID=your-guid-here
//
// Usage:
//   node scripts/enrich-postcodes-from-abn.mjs                # dry run — preview counts
//   node scripts/enrich-postcodes-from-abn.mjs --apply        # fetch + update DB
//   node scripts/enrich-postcodes-from-abn.mjs --apply --limit 100  # test with small batch

import 'dotenv/config';
import { execSync } from 'child_process';

const DRY_RUN = !process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((a, i) => a === '--limit' && process.argv[i + 1]);
const LIMIT = LIMIT_ARG ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : null;
const CONCURRENCY = 3; // parallel requests
const DELAY_MS = 350; // ~3 req/sec per slot, ~9/sec total
const SAVE_EVERY = 200; // write to DB every N lookups

const GUID = process.env.ABN_LOOKUP_GUID;
if (!GUID) {
  console.error('Missing ABN_LOOKUP_GUID in .env');
  console.error('Register at: https://abr.business.gov.au/Documentation/WebServiceRegistration');
  process.exit(1);
}

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

// --- 1. Get entities needing postcodes ---
console.log('Finding entities with ABN but no postcode...');
const limitClause = LIMIT ? `LIMIT ${LIMIT}` : '';
const raw = psql(`SELECT id || '|' || abn FROM gs_entities WHERE abn IS NOT NULL AND postcode IS NULL ORDER BY id ${limitClause}`);

const entities = [];
for (const line of raw.split('\n')) {
  const [id, abn] = line.split('|');
  if (id && abn) entities.push({ id, abn: abn.replace(/\s/g, '') });
}

console.log(`  ${entities.length} entities to look up`);

if (DRY_RUN) {
  console.log('\n🔍 DRY RUN — would look up these entities via ABN Lookup API.');
  console.log('  Run with --apply to fetch and update.');
  console.log('  Run with --apply --limit 10 to test with a small batch first.');
  process.exit(0);
}

// --- 2. Look up ABNs via JSON API ---
const ABN_URL = 'https://abr.business.gov.au/json/AbnDetails.aspx';

async function lookupAbn(abn) {
  const url = `${ABN_URL}?abn=${abn}&callback=cb&guid=${GUID}`;
  try {
    const resp = await fetch(url);
    const text = await resp.text();
    // JSONP: cb({...})
    const json = JSON.parse(text.replace(/^cb\(/, '').replace(/\)$/, ''));
    if (json.Message) return { abn, error: json.Message };
    return {
      abn,
      postcode: json.AddressPostcode || null,
      state: json.AddressState || null,
      entityName: json.EntityName || null,
    };
  } catch (err) {
    return { abn, error: err.message };
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Process in parallel with rate limiting
const results = []; // { id, abn, postcode, state }
let done = 0;
let errors = 0;
let noPostcode = 0;
const startTime = Date.now();

async function worker(queue) {
  while (queue.length > 0) {
    const entity = queue.shift();
    const result = await lookupAbn(entity.abn);

    if (result.error) {
      errors++;
      if (errors <= 5) console.log(`  ⚠ ABN ${entity.abn}: ${result.error}`);
      if (errors === 5) console.log('  (suppressing further errors...)');
    } else if (result.postcode) {
      results.push({ id: entity.id, postcode: result.postcode, state: result.state });
    } else {
      noPostcode++;
    }

    done++;
    if (done % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = done / elapsed;
      const eta = Math.round((entities.length - done) / rate);
      console.log(`  ${done}/${entities.length} (${results.length} postcodes found, ${rate.toFixed(1)}/sec, ETA ${eta}s)`);
    }

    // Flush to DB periodically
    if (results.length >= SAVE_EVERY) {
      await flushToDb();
    }

    await sleep(DELAY_MS);
  }
}

async function flushToDb() {
  if (results.length === 0) return;
  const batch = results.splice(0, results.length);

  // Build a single UPDATE using a VALUES list
  const values = batch.map(r =>
    `('${r.id}', '${r.postcode.replace(/'/g, "''")}', '${(r.state || '').replace(/'/g, "''")}')`
  ).join(',');

  const sql = `UPDATE gs_entities SET postcode = v.postcode, state = COALESCE(gs_entities.state, v.state) FROM (VALUES ${values}) AS v(id, postcode, state) WHERE gs_entities.id = v.id::uuid`;

  try {
    psql(sql, 60000);
    console.log(`  💾 Saved ${batch.length} postcodes to DB`);
  } catch (err) {
    console.error(`  ❌ DB write failed: ${err.message}`);
    // Put them back for retry
    results.push(...batch);
  }
}

// Run workers
console.log(`\nFetching from ABN Lookup API (${CONCURRENCY} workers, ${DELAY_MS}ms delay)...\n`);
const queue = [...entities];
const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
await Promise.all(workers);

// Final flush
await flushToDb();

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n✅ Done in ${elapsed}s`);
console.log(`  Looked up: ${done}`);
console.log(`  Postcodes found: ${done - errors - noPostcode}`);
console.log(`  No postcode in ABR: ${noPostcode}`);
console.log(`  Errors: ${errors}`);

// Now backfill remoteness for newly-postcoded entities
console.log('\nBackfilling remoteness for newly-postcoded entities...');
try {
  execSync('node scripts/backfill-remoteness-from-abs.mjs --apply', {
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 120000,
  });
} catch {
  console.log('  (remoteness backfill skipped or failed — run manually)');
}
