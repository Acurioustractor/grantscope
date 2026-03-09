#!/usr/bin/env node
// Match GrantScope entities against OpenSanctions PEP + sanctions datasets
//
// Two-pass: (1) entities → sanctions, (2) AEC donation donors → PEPs
// Uses supabase-js with pagination + retries to handle flaky connections.
// Falls back to local JSON cache if DB is unavailable.
//
// Usage:
//   node --env-file=.env scripts/match-opensanctions.mjs           # dry-run (prints matches)
//   node --env-file=.env scripts/match-opensanctions.mjs --apply   # write to DB

import 'dotenv/config';
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = !process.argv.includes('--apply');
const DATA_DIR = resolve(import.meta.dirname, '../data/opensanctions');
const CACHE_DIR = resolve(import.meta.dirname, '../data/opensanctions/cache');

// --- Supabase client ---
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'public' }, global: { headers: {} } }
);

async function fetchAllPaginated(table, select, pageSize = 1000) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += pageSize;
    if (data.length < pageSize) break;
    // Brief pause to be gentle on connection pool
    await new Promise(r => setTimeout(r, 100));
  }
  return rows;
}

// --- CSV parser ---
async function loadCSV(filename, filter) {
  const rows = [];
  const rl = createInterface({ input: createReadStream(resolve(DATA_DIR, filename)) });
  let header = null;
  for await (const line of rl) {
    if (!header) {
      header = line.split(',').map(h => h.replace(/"/g, ''));
      continue;
    }
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current); current = ''; continue; }
      current += ch;
    }
    fields.push(current);
    const row = {};
    header.forEach((h, i) => row[h] = fields[i] || '');
    if (!filter || filter(row)) rows.push(row);
  }
  return rows;
}

// --- Name normalization ---
function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[''`\u2019]/g, "'")
    .replace(/[^\w\s'-]/g, '')
    .replace(/\b(pty|ltd|limited|inc|incorporated|co|corp|corporation|the|of|and|for)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIndex(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = normalize(entry.name);
    if (key.length < 3) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
    // Also index aliases
    for (const alias of (entry.aliases || '').split(';').filter(Boolean)) {
      const ak = normalize(alias);
      if (ak.length < 3) continue;
      if (!map.has(ak)) map.set(ak, []);
      map.get(ak).push(entry);
    }
  }
  return map;
}

console.log(DRY_RUN ? '🔍 DRY RUN (use --apply to write)' : '✏️  APPLYING CHANGES');

// === Load OpenSanctions ===
console.log('\n📥 Loading OpenSanctions datasets...');
const sanctions = await loadCSV('sanctions.csv');
console.log(`  Sanctions: ${sanctions.length} entries`);

const auPeps = await loadCSV('peps.csv', row => row.countries.includes('au'));
console.log(`  Australian PEPs: ${auPeps.length} entries`);

const sanctionsMap = buildIndex(sanctions);
console.log(`  Sanctions index: ${sanctionsMap.size} normalized names`);

const pepMap = buildIndex(auPeps);
console.log(`  PEP index: ${pepMap.size} normalized names`);

// === Load entities (DB or cache) ===
console.log('\n📥 Loading GrantScope entities...');
let entities, donors;

// Try DB first, fall back to cache
try {
  entities = await fetchAllPaginated('gs_entities', 'id,canonical_name,abn');
  console.log(`  Entities from DB: ${entities.length}`);
  // Cache for offline use
  writeFileSync(resolve(CACHE_DIR, 'entities.json'), JSON.stringify(entities));
} catch (e) {
  console.log(`  ⚠️  DB unavailable (${e.message}), checking cache...`);
  const cachePath = resolve(CACHE_DIR, 'entities.json');
  if (existsSync(cachePath)) {
    entities = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`  Entities from cache: ${entities.length}`);
  } else {
    console.error('  ❌ No entity cache found. Run when DB is available to build cache.');
    process.exit(1);
  }
}

// Load AEC donors
console.log('\n📥 Loading AEC donation donors...');
try {
  const donorRows = await fetchAllPaginated('political_donations', 'donor_name');
  const donorSet = new Set(donorRows.map(r => r.donor_name).filter(Boolean));
  donors = [...donorSet];
  console.log(`  Unique donors from DB: ${donors.length}`);
  writeFileSync(resolve(CACHE_DIR, 'donors.json'), JSON.stringify(donors));
} catch (e) {
  console.log(`  ⚠️  DB unavailable, checking cache...`);
  const cachePath = resolve(CACHE_DIR, 'donors.json');
  if (existsSync(cachePath)) {
    donors = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`  Donors from cache: ${donors.length}`);
  } else {
    console.log('  ⚠️  No donor cache — skipping PEP matching');
    donors = [];
  }
}

// === Match entities against sanctions ===
console.log('\n🔍 Matching entities against sanctions...');
const entityMatches = [];
for (const ent of entities) {
  const key = normalize(ent.canonical_name);
  const hits = sanctionsMap.get(key);
  if (hits) {
    for (const h of hits) {
      entityMatches.push({
        entity_id: ent.id,
        entity_name: ent.canonical_name,
        match_type: 'sanctions',
        match_id: h.id,
        match_name: h.name,
        match_schema: h.schema,
        match_score: 1.0,
        dataset: h.dataset,
        sanctions_info: h.sanctions,
      });
    }
  }
}
console.log(`  Entity → Sanctions matches: ${entityMatches.length}`);
if (entityMatches.length > 0) {
  console.log('  Matches:');
  entityMatches.forEach(m =>
    console.log(`    ${m.entity_name} → ${m.match_name} [${m.match_schema}] (${m.sanctions_info || m.dataset})`)
  );
}

// === Match donors against PEPs ===
console.log('\n🔍 Matching donation donors against Australian PEPs...');
const pepMatches = [];
for (const donor of donors) {
  const key = normalize(donor);
  const hits = pepMap.get(key);
  if (hits) {
    for (const h of hits) {
      pepMatches.push({
        donor_name: donor,
        match_type: 'pep',
        match_id: h.id,
        match_name: h.name,
        match_score: 1.0,
        dataset: h.dataset,
      });
    }
  }
}
console.log(`  Donor → PEP matches: ${pepMatches.length}`);
if (pepMatches.length > 0) {
  console.log('  Top 30 matches:');
  pepMatches.slice(0, 30).forEach(m =>
    console.log(`    "${m.donor_name}" → ${m.match_name} (PEP)`)
  );
  if (pepMatches.length > 30) console.log(`  ... and ${pepMatches.length - 30} more`);
}

// === Summary ===
const allMatches = [...entityMatches, ...pepMatches];
console.log('\n📊 Summary:');
console.log(`  Entity ↔ Sanctions: ${entityMatches.length} matches`);
console.log(`  Donor ↔ PEP: ${pepMatches.length} matches`);
console.log(`  Total: ${allMatches.length} matches`);

// Save results locally regardless
const outPath = resolve(DATA_DIR, 'matches.json');
writeFileSync(outPath, JSON.stringify({ entityMatches, pepMatches, generated: new Date().toISOString() }, null, 2));
console.log(`\n💾 Results saved to ${outPath}`);

if (DRY_RUN) {
  console.log('\nRun with --apply to write matches to database.');
  process.exit(0);
}

// === Write to DB ===
console.log('\n✏️  Writing matches to database...');

// Create table via RPC (raw SQL through supabase-js)
const { error: createErr } = await sb.rpc('exec_sql', {
  query: `CREATE TABLE IF NOT EXISTS opensanctions_matches (
    id SERIAL PRIMARY KEY,
    entity_id TEXT,
    entity_name TEXT,
    donor_name TEXT,
    match_type TEXT NOT NULL,
    match_id TEXT NOT NULL,
    match_name TEXT NOT NULL,
    match_schema TEXT,
    match_score REAL DEFAULT 1.0,
    dataset TEXT,
    sanctions_info TEXT,
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`
}).catch(() => null);

// Batch insert
const batchSize = 50;
let inserted = 0;
const rows = allMatches.map(m => ({
  entity_id: m.entity_id || null,
  entity_name: m.entity_name || null,
  donor_name: m.donor_name || null,
  match_type: m.match_type,
  match_id: m.match_id,
  match_name: m.match_name,
  match_schema: m.match_schema || null,
  match_score: m.match_score,
  dataset: m.dataset || null,
  sanctions_info: m.sanctions_info || null,
}));

for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  const { error } = await sb.from('opensanctions_matches').upsert(batch, { onConflict: 'match_id,entity_id' });
  if (error) {
    console.log(`  ⚠️  Batch ${i / batchSize + 1} error: ${error.message}`);
  } else {
    inserted += batch.length;
  }
}

console.log(`\n✅ Done. Inserted ${inserted} matches.`);
