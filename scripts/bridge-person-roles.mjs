#!/usr/bin/env node
/**
 * Bridge Person Roles → Graph
 *
 * 1. Match person_roles.company_abn → gs_entities to find company entities
 * 2. Create person entities in gs_entities for each unique person
 * 3. Create gs_relationships from person → company with role_type
 * 4. Backfill person_roles.entity_id and person_entity_id
 *
 * Usage:
 *   node --env-file=.env scripts/bridge-person-roles.mjs [--apply] [--limit=1000]
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
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function titleCase(name) {
  return name.split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

// Map person_roles role_type → gs_relationships relationship_type
const ROLE_TO_REL = {
  director: 'directorship',
  chair: 'directorship',
  board_member: 'member_of',
  secretary: 'member_of',
  trustee: 'member_of',
  officeholder: 'member_of',
  public_officer: 'member_of',
  other: 'member_of',
};

function personGsId(normName) {
  const slug = normName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `GS-PERSON-${slug}`.slice(0, 80);
}

async function main() {
  const run = await logStart(db, 'bridge-person-roles', 'Bridge Person Roles');

  try {
    console.log('=== Bridge Person Roles → Graph ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    console.log();

    // 1. Fetch all person_roles with company_abn
    const allRoles = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      let query = db
        .from('person_roles')
        .select('id, person_name, person_name_normalised, role_type, company_name, company_abn, appointment_date, cessation_date, source')
        .not('company_abn', 'is', null)
        .range(offset, offset + pageSize - 1);

      const { data: page, error } = await query;
      if (error) throw error;
      if (!page || page.length === 0) break;
      allRoles.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    console.log(`  ${allRoles.length} person roles with company ABN`);

    // 2. Build ABN → gs_entity map
    const uniqueAbns = [...new Set(allRoles.map(r => r.company_abn))];
    const abnToEntity = new Map();

    for (let i = 0; i < uniqueAbns.length; i += 100) {
      const batch = uniqueAbns.slice(i, i + 100);
      const { data: entities, error } = await db
        .from('gs_entities')
        .select('id, abn')
        .in('abn', batch);
      if (error) throw error;
      for (const e of entities) abnToEntity.set(e.abn, e.id);
    }

    console.log(`  ${abnToEntity.size}/${uniqueAbns.length} company ABNs matched to gs_entities`);

    // 3. Group roles by person
    const personMap = new Map(); // norm_name → { displayName, roles[] }
    for (const role of allRoles) {
      const key = role.person_name_normalised || role.person_name.toUpperCase().trim();
      if (!personMap.has(key)) {
        personMap.set(key, { displayName: titleCase(key), roles: [] });
      }
      personMap.get(key).roles.push(role);
    }

    console.log(`  ${personMap.size} unique persons`);

    // 4. Process each person
    let personsCreated = 0;
    let relsCreated = 0;
    let skipped = 0;
    let errors = 0;

    const entries = [...personMap.entries()];
    const toProcess = LIMIT ? entries.slice(0, LIMIT) : entries;

    for (let i = 0; i < toProcess.length; i++) {
      const [normName, { displayName, roles }] = toProcess[i];

      // Find distinct companies for this person
      const companyEdges = new Map(); // entityId-relType → edge data
      for (const role of roles) {
        const companyEntityId = abnToEntity.get(role.company_abn);
        if (!companyEntityId) continue;
        const relType = ROLE_TO_REL[role.role_type] || 'member_of';
        const key = `${companyEntityId}:${relType}`;
        if (!companyEdges.has(key)) {
          companyEdges.set(key, {
            companyEntityId,
            relType,
            originalRole: role.role_type,
            appointmentDate: role.appointment_date,
            cessationDate: role.cessation_date,
            source: role.source || 'acnc',
          });
        }
      }

      if (companyEdges.size === 0) {
        skipped++;
        continue;
      }

      if (!APPLY) {
        personsCreated++;
        relsCreated += companyEdges.size;
        continue;
      }

      // Create person entity
      const gsId = personGsId(normName);
      const { data: personEntity, error: personError } = await db
        .from('gs_entities')
        .upsert({
          gs_id: gsId,
          canonical_name: displayName,
          entity_type: 'person',
          source_count: roles.length,
          confidence: 'registry',
        }, { onConflict: 'gs_id' })
        .select('id')
        .single();

      if (personError) {
        errors++;
        if (errors <= 5) console.error(`  Error creating person ${displayName}: ${personError.message}`);
        continue;
      }

      personsCreated++;
      const personEntityId = personEntity.id;

      // Create relationships
      const relBatch = [];
      for (const [, edge] of companyEdges) {
        relBatch.push({
          source_entity_id: personEntityId,
          target_entity_id: edge.companyEntityId,
          relationship_type: edge.relType,
          dataset: 'person_roles',
          confidence: 'registry',
          start_date: edge.appointmentDate || null,
          end_date: edge.cessationDate || null,
          properties: { source: edge.source, original_role: edge.originalRole },
        });
      }

      const { error: relError } = await db
        .from('gs_relationships')
        .insert(relBatch);

      if (relError) {
        errors++;
        if (errors <= 5) console.error(`  Error creating relationships for ${displayName}: ${relError.message}`);
      } else {
        relsCreated += relBatch.length;
      }

      // Update person_roles with entity references
      const roleIds = roles.filter(r => abnToEntity.has(r.company_abn)).map(r => r.id);
      if (roleIds.length > 0) {
        const firstCompanyId = abnToEntity.get(roles.find(r => abnToEntity.has(r.company_abn)).company_abn);
        await db
          .from('person_roles')
          .update({ person_entity_id: personEntityId, entity_id: firstCompanyId })
          .in('id', roleIds);
      }

      if ((i + 1) % 500 === 0) {
        console.log(`  Progress: ${i + 1}/${toProcess.length} (${personsCreated} persons, ${relsCreated} relationships)`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`  Persons: ${personsCreated} created`);
    console.log(`  Relationships: ${relsCreated} created`);
    console.log(`  Skipped (no matching company): ${skipped}`);
    console.log(`  Errors: ${errors}`);
    if (!APPLY) console.log('  (DRY RUN — use --apply to write changes)');

    await logComplete(db, run.id, {
      items_found: toProcess.length,
      items_new: personsCreated,
      items_updated: relsCreated,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
