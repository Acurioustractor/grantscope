#!/usr/bin/env node
/**
 * link-entities-mega.mjs — Entity Mega-Linker
 *
 * 5-phase graph connectivity booster. Creates hundreds of thousands of new
 * edges in gs_relationships from existing data sources.
 *
 * Phase 1: Shared-Director Edges      (~50K-100K edges)
 * Phase 3: Foundation ↔ Charity       (~1K-5K edges)
 * Phase 5: Person Entities + Edges    (~300K+ edges)
 *
 * Dry-run by default, --live to insert.
 * Run specific phases: --phase=1,3,5
 *
 * Usage:
 *   node --env-file=.env scripts/link-entities-mega.mjs
 *   node --env-file=.env scripts/link-entities-mega.mjs --phase=1
 *   node --env-file=.env scripts/link-entities-mega.mjs --live
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { psql as _psqlBase } from './lib/psql.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LIVE = process.argv.includes('--live');
const PHASES = (() => {
  const arg = process.argv.find(a => a.startsWith('--phase='));
  if (!arg) return [1, 3, 5];
  return arg.split('=')[1].split(',').map(Number);
})();

const BATCH_SIZE = 500;
const stats = { phases: {} };

// ─────────────────────────────────────────────────────────
// psql helper — no statement timeout, CSV output
// ─────────────────────────────────────────────────────────
// Wrap shared psql with higher limits for mega-linker's large result sets
const psql = (query) => _psqlBase(query, { timeout: 300000, maxBuffer: 200 * 1024 * 1024, label: 'mega' });

// ─────────────────────────────────────────────────────────
// Batch insert into gs_relationships
// ─────────────────────────────────────────────────────────
async function batchInsert(rows, label) {
  let inserted = 0, skipped = 0, errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('gs_relationships').insert(chunk);

    if (error) {
      // Batch failed — fall back to individual inserts
      for (const row of chunk) {
        const { error: e2 } = await supabase.from('gs_relationships').insert(row);
        if (e2) {
          if (e2.code === '23505') skipped++;
          else { errors++; if (errors <= 5) console.error(`  ✗ ${label}: ${e2.message.slice(0, 100)}`); }
        } else {
          inserted++;
        }
      }
    } else {
      inserted += chunk.length;
    }

    if ((i + chunk.length) % 5000 < BATCH_SIZE || i + chunk.length === rows.length) {
      process.stdout.write(`\r  ${label}: ${inserted} inserted, ${skipped} dupes, ${errors} errors (${i + chunk.length}/${rows.length})`);
    }
  }
  console.log(`\r  ${label}: ${inserted} inserted, ${skipped} dupes, ${errors} errors — DONE                    `);
  return { inserted, skipped, errors };
}

// ─────────────────────────────────────────────────────────
// Batch insert into gs_entities (returns created rows)
// ─────────────────────────────────────────────────────────
async function batchInsertEntities(rows, label) {
  let inserted = 0, skipped = 0, errors = 0;
  const created = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('gs_entities').insert(chunk).select('id, canonical_name');

    if (error) {
      // Batch failed — fall back to individual inserts
      for (const row of chunk) {
        const { data: d2, error: e2 } = await supabase.from('gs_entities').insert(row).select('id, canonical_name');
        if (e2) {
          if (e2.code === '23505') skipped++;
          else { errors++; if (errors <= 5) console.error(`  ✗ ${label}: ${e2.message.slice(0, 100)}`); }
        } else if (d2 && d2.length > 0) {
          inserted++;
          created.push(d2[0]);
        }
      }
    } else {
      inserted += chunk.length;
      if (data) created.push(...data);
    }

    if ((i + chunk.length) % 5000 < BATCH_SIZE || i + chunk.length === rows.length) {
      process.stdout.write(`\r  ${label}: ${inserted} entities, ${skipped} dupes, ${errors} errors (${i + chunk.length}/${rows.length})`);
    }
  }
  console.log(`\r  ${label}: ${inserted} entities, ${skipped} dupes, ${errors} errors — DONE                    `);
  return { inserted, skipped, errors, created };
}

// ─────────────────────────────────────────────────────────
// Constraint migration — add new relationship types
// ─────────────────────────────────────────────────────────
function migrateConstraints() {
  console.log('Checking relationship_type constraint...');
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

  const sql = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gs_relationships_relationship_type_check'
    AND pg_get_constraintdef(oid) LIKE '%shared_director%'
  ) THEN
    ALTER TABLE gs_relationships DROP CONSTRAINT gs_relationships_relationship_type_check;
    ALTER TABLE gs_relationships ADD CONSTRAINT gs_relationships_relationship_type_check
      CHECK (relationship_type = ANY(ARRAY[
        'donation', 'contract', 'grant', 'directorship', 'ownership',
        'charity_link', 'program_funding', 'tax_record', 'registered_as',
        'listed_as', 'subsidiary_of', 'member_of', 'lobbies_for',
        'partners_with', 'shared_director', 'affiliated_with', 'trustee_of'
      ]));
    RAISE NOTICE 'Added shared_director, affiliated_with, trustee_of to constraint';
  ELSE
    RAISE NOTICE 'Constraint already up to date';
  END IF;
END $$;
`;

  const tmpFile = `/tmp/mega-migrate-${Date.now()}.sql`;
  writeFileSync(tmpFile, sql);
  try {
    const out = execSync(`psql "${connStr}" -f ${tmpFile} 2>&1`, { encoding: 'utf-8', timeout: 30000 });
    unlinkSync(tmpFile);
    const notice = out.match(/NOTICE:\s*(.*)/);
    console.log(`  ${notice ? notice[1] : 'Done'}`);
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    console.error('  Constraint migration failed:', err.message?.slice(0, 200));
    throw new Error('Cannot proceed without updated constraints');
  }
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: Shared-Director Edges
// People on 2+ boards → shared_director edge between the orgs
// ═══════════════════════════════════════════════════════════
async function phase1() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 1: Shared-Director Edges');
  console.log('═'.repeat(60));
  const t0 = Date.now();

  // 1. Load person_roles with entity linkage
  console.log('  Loading person_roles...');
  const roles = psql(`
    SELECT person_name_normalised, entity_id
    FROM person_roles
    WHERE entity_id IS NOT NULL
  `);
  console.log(`  ${roles.length} person_roles loaded`);

  // 2. Group by person → set of entity_ids
  const personEntities = new Map();
  for (const r of roles) {
    if (!r.person_name_normalised || !r.entity_id) continue;
    if (!personEntities.has(r.person_name_normalised)) {
      personEntities.set(r.person_name_normalised, new Set());
    }
    personEntities.get(r.person_name_normalised).add(r.entity_id);
  }
  console.log(`  ${personEntities.size} unique people`);

  // 3. Filter: 2-10 entities (avoid combinatorial explosion from name collisions)
  const multiBoard = [];
  let filteredOver10 = 0;
  for (const [person, entities] of personEntities) {
    if (entities.size >= 2 && entities.size <= 10) {
      multiBoard.push([person, entities]);
    } else if (entities.size > 10) {
      filteredOver10++;
    }
  }
  console.log(`  ${multiBoard.length} people on 2-10 boards (${filteredOver10} filtered with >10)`);

  // 4. Generate all pairs (unordered, deduped)
  const edgeMap = new Map();
  for (const [, entitySet] of multiBoard) {
    const ids = [...entitySet].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}_${ids[j]}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            source_entity_id: ids[i],
            target_entity_id: ids[j],
            relationship_type: 'shared_director',
            dataset: 'person_roles_crossmatch',
            confidence: 'inferred',
            properties: { shared_count: 1 },
          });
        } else {
          edgeMap.get(key).properties.shared_count++;
        }
      }
    }
  }

  const allEdges = [...edgeMap.values()];
  console.log(`  ${allEdges.length} unique shared-director pairs`);

  // Distribution of shared_count
  const countDist = {};
  for (const e of allEdges) {
    const c = e.properties.shared_count;
    const bucket = c >= 5 ? '5+' : String(c);
    countDist[bucket] = (countDist[bucket] || 0) + 1;
  }
  console.log('  Shared count distribution:', JSON.stringify(countDist));

  // 5. Check existing edges to avoid duplicates
  console.log('  Checking existing shared_director edges...');
  const existing = psql(`
    SELECT source_entity_id, target_entity_id
    FROM gs_relationships
    WHERE relationship_type = 'shared_director'
  `);
  const existingSet = new Set();
  for (const e of existing) {
    existingSet.add(`${e.source_entity_id}_${e.target_entity_id}`);
    existingSet.add(`${e.target_entity_id}_${e.source_entity_id}`);
  }

  const newEdges = allEdges.filter(e =>
    !existingSet.has(`${e.source_entity_id}_${e.target_entity_id}`)
  );
  console.log(`  ${existing.length} existing, ${newEdges.length} new edges`);

  // 6. Insert
  let result = { inserted: 0, skipped: 0, errors: 0 };
  if (LIVE && newEdges.length > 0) {
    result = await batchInsert(newEdges, 'Phase 1');
  }

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  stats.phases[1] = { found: allEdges.length, new: newEdges.length, ...result, duration };
  console.log(`  Phase 1 complete in ${duration}s`);
}

// ═══════════════════════════════════════════════════════════
// PHASE 3: Foundation ↔ Charity Name Matching
// Match foundation names to charity names (different entities)
// ═══════════════════════════════════════════════════════════
async function phase3() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 3: Foundation ↔ Charity Pairing');
  console.log('═'.repeat(60));
  const t0 = Date.now();

  // 1. Load foundations with their gs_entity IDs
  console.log('  Loading foundations...');
  const foundations = psql(`
    SELECT f.id as foundation_id, f.name, f.acnc_abn, ge.id as entity_id
    FROM foundations f
    JOIN gs_entities ge ON ge.abn = f.acnc_abn
    WHERE f.acnc_abn IS NOT NULL
  `);
  console.log(`  ${foundations.length} foundations with entities`);

  // 2. Load all charity-type entities
  console.log('  Loading charity entities...');
  const charities = psql(`
    SELECT id, canonical_name, abn
    FROM gs_entities
    WHERE entity_type IN ('charity', 'foundation')
  `);
  console.log(`  ${charities.length} charity/foundation entities`);

  // 3. Normalise names for matching
  const STRIP_WORDS = /\b(foundation|trust|fund|ltd|limited|inc|incorporated|pty|the|of|for|and|australia|australian)\b/gi;
  function normName(name) {
    return name
      .replace(STRIP_WORDS, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  // Build charity index by normalised name
  const charityByNorm = new Map();
  for (const c of charities) {
    const norm = normName(c.canonical_name);
    if (norm.length < 4) continue;
    if (!charityByNorm.has(norm)) charityByNorm.set(norm, []);
    charityByNorm.get(norm).push(c);
  }

  // 4. Match foundations to charities with different entity IDs
  const edges = [];
  const seenPairs = new Set();

  for (const f of foundations) {
    const norm = normName(f.name);
    if (norm.length < 4) continue;

    const matches = charityByNorm.get(norm) || [];
    for (const c of matches) {
      // Skip self-links (same entity)
      if (c.id === f.entity_id) continue;
      // Skip same ABN (same underlying org)
      if (c.abn && c.abn === f.acnc_abn) continue;

      const pairKey = [f.entity_id, c.id].sort().join('_');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      edges.push({
        source_entity_id: f.entity_id,
        target_entity_id: c.id,
        relationship_type: 'affiliated_with',
        dataset: 'foundation_charity_match',
        confidence: 'inferred',
        properties: {
          foundation_name: f.name,
          charity_name: c.canonical_name,
          match_method: 'name_normalised',
        },
      });
    }
  }
  console.log(`  ${edges.length} foundation↔charity matches`);

  if (edges.length > 0 && edges.length <= 20) {
    for (const e of edges) {
      console.log(`    ${e.properties.foundation_name} ↔ ${e.properties.charity_name}`);
    }
  }

  // 5. Check existing
  const existing = psql(`
    SELECT source_entity_id, target_entity_id
    FROM gs_relationships
    WHERE relationship_type = 'affiliated_with' AND dataset = 'foundation_charity_match'
  `);
  const existingSet = new Set();
  for (const e of existing) {
    existingSet.add(`${e.source_entity_id}_${e.target_entity_id}`);
    existingSet.add(`${e.target_entity_id}_${e.source_entity_id}`);
  }
  const newEdges = edges.filter(e =>
    !existingSet.has(`${e.source_entity_id}_${e.target_entity_id}`)
  );
  console.log(`  ${existing.length} existing, ${newEdges.length} new edges`);

  // 6. Insert
  let result = { inserted: 0, skipped: 0, errors: 0 };
  if (LIVE && newEdges.length > 0) {
    result = await batchInsert(newEdges, 'Phase 3');
  }

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  stats.phases[3] = { found: edges.length, new: newEdges.length, ...result, duration };
  console.log(`  Phase 3 complete in ${duration}s`);
}

// ═══════════════════════════════════════════════════════════
// PHASE 5: Person Entity Creation + Directorship Edges
// Create person-type gs_entities, then directorship edges
// ═══════════════════════════════════════════════════════════
async function phase5() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 5: Person Entities + Directorship Edges');
  console.log('═'.repeat(60));
  const t0 = Date.now();

  // 1. Load unique people from person_roles
  console.log('  Loading unique people from person_roles...');
  const uniquePeople = psql(`
    SELECT DISTINCT ON (person_name_normalised)
      person_name, person_name_normalised, source
    FROM person_roles
    WHERE entity_id IS NOT NULL
    ORDER BY person_name_normalised, source
  `);
  console.log(`  ${uniquePeople.length} unique people`);

  // 2. Load existing person entities
  console.log('  Loading existing person entities...');
  const existingPersons = psql(`
    SELECT id, canonical_name, UPPER(TRIM(canonical_name)) as name_norm
    FROM gs_entities
    WHERE entity_type = 'person'
  `);
  console.log(`  ${existingPersons.length} existing person entities`);

  const existingByNorm = new Map();
  for (const p of existingPersons) {
    existingByNorm.set(p.name_norm, p.id);
  }

  // 3. Find people who need new entities (filter out empty/short names)
  const needEntity = uniquePeople.filter(p =>
    !existingByNorm.has(p.person_name_normalised) &&
    cleanName(p.person_name).length >= 3
  );
  console.log(`  ${needEntity.length} people need new entities (${uniquePeople.length - needEntity.length} already exist)`);

  // 4. Generate gs_ids and prepare entity rows
  console.log('  Loading existing gs_ids...');
  const existingGsIds = psql(`
    SELECT gs_id FROM gs_entities WHERE gs_id LIKE 'GS-PERSON-%'
  `);
  const usedGsIds = new Set(existingGsIds.map(r => r.gs_id));

  function cleanName(name) {
    return name.replace(/^[\s\-–—]+/, '').replace(/[\s\-–—]+$/, '').trim();
  }

  function slugify(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  function makeGsId(name) {
    const base = `GS-PERSON-${slugify(name)}`;
    if (!usedGsIds.has(base)) { usedGsIds.add(base); return base; }
    for (let i = 2; i < 10000; i++) {
      const id = `${base}-${i}`;
      if (!usedGsIds.has(id)) { usedGsIds.add(id); return id; }
    }
    const id = `GS-PERSON-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    usedGsIds.add(id);
    return id;
  }

  const entityRows = needEntity.map(p => ({
    gs_id: makeGsId(cleanName(p.person_name)),
    canonical_name: cleanName(p.person_name),
    entity_type: 'person',
    confidence: 'registry',
    source_datasets: [p.source],
  }));

  console.log(`  ${entityRows.length} person entities to create`);
  if (entityRows.length > 0) {
    console.log(`  Sample: ${entityRows[0].gs_id} → "${entityRows[0].canonical_name}"`);
  }

  // 5. Create entities (LIVE only)
  const nameToEntityId = new Map(existingByNorm);
  let entityResult = { inserted: 0, skipped: 0, errors: 0 };

  if (LIVE && entityRows.length > 0) {
    console.log('  Creating person entities...');
    const res = await batchInsertEntities(entityRows, 'Phase 5 entities');
    entityResult = res;

    // Build mapping from created entities
    for (const e of res.created) {
      const norm = e.canonical_name.toUpperCase().replace(/\s+/g, ' ').trim();
      nameToEntityId.set(norm, e.id);
    }
  } else if (!LIVE) {
    // Dry-run: simulate the mapping
    for (const p of needEntity) {
      nameToEntityId.set(p.person_name_normalised, `DRY-${p.person_name_normalised.slice(0, 20)}`);
    }
  }

  // 6. Build directorship edges
  console.log('  Loading person_roles for directorship edges...');
  const allRoles = psql(`
    SELECT person_name_normalised, entity_id, role_type, source,
           appointment_date, cessation_date
    FROM person_roles
    WHERE entity_id IS NOT NULL
  `);
  console.log(`  ${allRoles.length} person_roles loaded`);

  // Check existing directorship edges
  console.log('  Checking existing directorship edges...');
  const existingDirEdges = psql(`
    SELECT source_entity_id, target_entity_id
    FROM gs_relationships
    WHERE relationship_type = 'directorship'
  `);
  const existingDirSet = new Set(
    existingDirEdges.map(e => `${e.source_entity_id}_${e.target_entity_id}`)
  );
  console.log(`  ${existingDirEdges.length} existing directorship edges`);

  // Build directorship edges (deduped by person+org pair)
  const dirEdgeMap = new Map();
  let noPersonEntity = 0;

  for (const r of allRoles) {
    const personEntityId = nameToEntityId.get(r.person_name_normalised);
    if (!personEntityId) { noPersonEntity++; continue; }

    const key = `${personEntityId}_${r.entity_id}`;
    if (existingDirSet.has(key)) continue;
    if (dirEdgeMap.has(key)) continue;

    dirEdgeMap.set(key, {
      source_entity_id: personEntityId,
      target_entity_id: r.entity_id,
      relationship_type: 'directorship',
      dataset: r.source || 'person_roles',
      confidence: 'registry',
      properties: {
        role_type: r.role_type,
        start_date: r.appointment_date || null,
        end_date: r.cessation_date || null,
      },
    });
  }

  const dirEdges = [...dirEdgeMap.values()];
  console.log(`  ${dirEdges.length} new directorship edges (${noPersonEntity} skipped — no person entity)`);

  // 7. Insert directorship edges
  let dirResult = { inserted: 0, skipped: 0, errors: 0 };
  if (LIVE && dirEdges.length > 0) {
    console.log('  Inserting directorship edges...');
    dirResult = await batchInsert(dirEdges, 'Phase 5 directorships');
  }

  const duration = ((Date.now() - t0) / 1000).toFixed(1);
  stats.phases[5] = {
    people: uniquePeople.length,
    newEntities: entityRows.length,
    entitiesCreated: entityResult.inserted,
    dirEdges: dirEdges.length,
    dirInserted: dirResult.inserted,
    duration,
  };
  console.log(`  Phase 5 complete in ${duration}s`);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  const t0 = Date.now();
  console.log(`Entity Mega-Linker — ${LIVE ? '🔴 LIVE' : '⚪ DRY RUN'}`);
  console.log(`Phases: ${PHASES.join(', ')}`);
  console.log('═'.repeat(60));

  // Migrate constraints (always — idempotent)
  if (PHASES.includes(1) || PHASES.includes(3)) {
    migrateConstraints();
  }

  const runId = LIVE
    ? (await logStart(supabase, 'link-entities-mega', 'Entity Mega-Linker'))?.id
    : null;

  try {
    if (PHASES.includes(1)) await phase1();
    if (PHASES.includes(3)) await phase3();
    if (PHASES.includes(5)) await phase5();

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    for (const [phase, s] of Object.entries(stats.phases)) {
      console.log(`  Phase ${phase}: ${JSON.stringify(s)}`);
    }

    const totalDuration = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  Total duration: ${totalDuration}s`);

    if (!LIVE) {
      console.log('\n  ⚪ DRY RUN — no changes made. Use --live to insert.');
    } else {
      // Show updated relationship counts
      const counts = psql(`
        SELECT relationship_type, COUNT(*) as cnt
        FROM gs_relationships
        GROUP BY relationship_type
        ORDER BY cnt DESC
      `);
      console.log('\n  Relationship counts:');
      for (const c of counts) {
        console.log(`    ${c.relationship_type}: ${Number(c.cnt).toLocaleString()}`);
      }
    }

    if (runId) {
      const totalInserted = Object.values(stats.phases)
        .reduce((sum, s) => sum + (s.inserted || s.dirInserted || 0), 0);
      const totalFound = Object.values(stats.phases)
        .reduce((sum, s) => sum + (s.found || s.dirEdges || 0), 0);
      await logComplete(supabase, runId, { items_found: totalFound, items_new: totalInserted });
    }
  } catch (err) {
    console.error('\nFatal error:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
