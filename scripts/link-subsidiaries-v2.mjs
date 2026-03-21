#!/usr/bin/env node
/**
 * link-subsidiaries-v2.mjs
 *
 * Finds subsidiary relationships: if entity A has an ABR trading name
 * matching entity B's canonical name, then B is subsidiary_of A.
 *
 * Uses Supabase REST API to page through gs_entities, then batch-queries
 * ABR trading names. All matching done in-memory.
 *
 * Safe: dry-run by default, use --live to insert.
 */
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LIVE = process.argv.includes('--live');
const PAGE = 1000;
const ABR_BATCH = 300; // ABNs per ABR query

async function paginate(table, select, filter) {
  const rows = [];
  let lastId = null;
  let retries = 0;
  while (true) {
    let query = supabase.from(table).select(select).order('id').limit(PAGE);
    if (lastId) query = query.gt('id', lastId);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) {
      if (retries < 3) {
        retries++;
        console.log(`\n  ⚠ Retry ${retries}/3 for ${table} after id ${lastId?.slice(0,8)}...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw new Error(`${table}: ${error.message}`);
    }
    retries = 0;
    if (!data || data.length === 0) break;
    rows.push(...data);
    lastId = data[data.length - 1].id;
    if (data.length < PAGE) break;
    if (rows.length % 5000 === 0) process.stdout.write(`  ${table}: ${rows.length.toLocaleString()}...\r`);
  }
  return rows;
}

async function main() {
  const startTime = Date.now();
  console.log(`Subsidiary Linker v2 — ${LIVE ? 'LIVE' : 'DRY RUN'}`);
  console.log('='.repeat(60));

  // Step 1: Load all entities (filter in memory — PostgREST timeout too short for WHERE filters)
  console.log('\n=== Step 1: Loading entities ===');
  const allEntities = await paginate(
    'gs_entities',
    'id,gs_id,canonical_name,abn,entity_type'
  );
  const entities = allEntities.filter(e => e.abn && e.entity_type !== 'person' && e.canonical_name);
  console.log(`  ${allEntities.length.toLocaleString()} total, ${entities.length.toLocaleString()} non-person with ABNs`);

  // Build indexes
  const nameIndex = new Map(); // UPPER(name) → [entities]
  const entityById = new Map();
  const abnList = [];

  for (const e of entities) {
    entityById.set(e.id, e);
    if (e.canonical_name && e.canonical_name.trim().length > 5) {
      const key = e.canonical_name.toUpperCase().trim();
      if (!nameIndex.has(key)) nameIndex.set(key, []);
      nameIndex.get(key).push(e);
    }
    if (e.abn) abnList.push(e.abn);
  }
  console.log(`  ${nameIndex.size.toLocaleString()} unique names, ${abnList.length.toLocaleString()} ABNs`);

  // Step 2: Load existing subsidiary_of relationships
  console.log('\n=== Step 2: Loading existing subsidiary_of ===');
  const existing = await paginate(
    'gs_relationships',
    'source_entity_id,target_entity_id',
    q => q.eq('relationship_type', 'subsidiary_of')
  );
  const existingSet = new Set(existing.map(r => `${r.source_entity_id}→${r.target_entity_id}`));
  console.log(`  ${existingSet.size} existing`);

  // Step 3: Batch-query ABR trading names for entity ABNs
  console.log('\n=== Step 3: Fetching ABR trading names ===');
  const entityByAbn = new Map();
  for (const e of entities) {
    if (e.abn) entityByAbn.set(e.abn, e);
  }

  const parentTrades = []; // { parent entity, trading names[] }
  let queriedAbns = 0;

  for (let i = 0; i < abnList.length; i += ABR_BATCH) {
    const batch = abnList.slice(i, i + ABR_BATCH);
    const { data, error } = await supabase
      .from('abr_registry')
      .select('abn,trading_names')
      .in('abn', batch)
      .not('trading_names', 'is', null);

    if (error) {
      console.log(`  ⚠ ABR batch ${Math.floor(i / ABR_BATCH)}: ${error.message?.slice(0, 60)}`);
      continue;
    }

    for (const row of (data || [])) {
      if (row.trading_names && row.trading_names.length > 0) {
        const entity = entityByAbn.get(row.abn);
        if (entity) {
          parentTrades.push({ entity, trades: row.trading_names });
        }
      }
    }

    queriedAbns += batch.length;
    if (queriedAbns % 5000 === 0) {
      process.stdout.write(`  ABR: ${queriedAbns.toLocaleString()}/${abnList.length.toLocaleString()} ABNs, ${parentTrades.length.toLocaleString()} with trades\r`);
    }
  }
  console.log(`\n  ${parentTrades.length.toLocaleString()} entities have trading names`);

  // Step 4: Match trading names → entity names
  console.log('\n=== Step 4: Matching ===');
  const links = [];
  const seen = new Set();

  const SKIP_RE = /^(st |saint |holy |our lady|christ |church of|baptist church|catholic church|uniting church|anglican |lutheran church|methodist)/i;
  const TWO_WORD_RE = /^\w+\s\w+$/;
  const PERSON_RE = /^[A-Z][a-z]+,\s/;

  for (const { entity: parent, trades } of parentTrades) {
    for (const tv of trades) {
      if (!tv || tv.trim().length <= 5) continue;
      if (PERSON_RE.test(tv)) continue;
      if (TWO_WORD_RE.test(tv)) continue;
      if (/trust|trustee|parish/i.test(tv)) continue;
      if (SKIP_RE.test(tv)) continue;

      const key = tv.toUpperCase().trim();
      const matches = nameIndex.get(key);
      if (!matches) continue;

      for (const child of matches) {
        if (child.id === parent.id) continue;
        const parentNorm = parent.canonical_name?.toUpperCase().trim();
        if (parentNorm === key) continue;

        const relKey = `${child.id}→${parent.id}`;
        if (existingSet.has(relKey)) continue;
        if (seen.has(relKey)) continue;
        seen.add(relKey);

        links.push({
          parent_id: parent.id,
          parent_name: parent.canonical_name,
          child_id: child.id,
          child_gs_id: child.gs_id,
          child_name: child.canonical_name,
          trading_name: tv,
        });
      }
    }
  }

  console.log(`  ${links.length} new subsidiary links found`);

  if (links.length > 0) {
    console.log('\n  Sample links (first 30):');
    for (const l of links.slice(0, 30)) {
      console.log(`    ${l.child_name}`);
      console.log(`      → subsidiary_of → ${l.parent_name}`);
      console.log(`      via: "${l.trading_name}"`);
    }
  }

  // Step 5: Insert
  let inserted = 0;
  let errors = 0;

  if (LIVE && links.length > 0) {
    console.log(`\n=== Step 5: Inserting ${links.length} relationships ===`);

    for (let i = 0; i < links.length; i += 200) {
      const batch = links.slice(i, i + 200).map(l => ({
        source_entity_id: l.child_id,
        target_entity_id: l.parent_id,
        relationship_type: 'subsidiary_of',
        dataset: 'abr_corporate_groups',
        confidence: 'inferred',
      }));

      const { error } = await supabase.from('gs_relationships').insert(batch);
      if (error) {
        for (const row of batch) {
          const { error: e2 } = await supabase.from('gs_relationships').insert(row);
          if (e2) { errors++; } else { inserted++; }
        }
      } else {
        inserted += batch.length;
      }
      process.stdout.write(`  ${inserted}/${links.length} inserted\r`);
    }
    console.log(`\n  Inserted: ${inserted}, Errors: ${errors}`);
  }

  const duration = Date.now() - startTime;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Entities with trades: ${parentTrades.length.toLocaleString()}`);
  console.log(`New subsidiary links: ${links.length}`);
  if (LIVE) console.log(`Inserted: ${inserted}, Errors: ${errors}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

  if (!LIVE) {
    console.log('\n⚠️  DRY RUN — no changes made. Use --live to insert.');
  }

  try {
    const runId = await logStart('link-subsidiaries-v2', 'Subsidiary Linker v2');
    await logComplete(runId, { itemsFound: links.length, itemsNew: inserted });
  } catch { /* non-critical */ }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
