#!/usr/bin/env node
/**
 * Person-Role Bridge — Inserts person_roles as board_member edges in gs_relationships
 *
 * For each person_role:
 *   1. Find the company entity by ABN or ACN in gs_entities
 *   2. Find or create a person entity
 *   3. Insert a 'board_member' relationship in gs_relationships
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

async function main() {
  const run = await logStart(db, 'bridge-person-roles', 'Bridge Person Roles');

  try {
    console.log('=== Bridge Person Roles to gs_relationships ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    console.log();

    // 1. Get person_roles that have entity_id (company linked) but need graph edges
    let query = db
      .from('person_roles')
      .select('id, person_name, person_name_normalised, role_type, company_name, company_abn, company_acn, entity_id, person_entity_id, appointment_date, cessation_date')
      .not('entity_id', 'is', null)
      .order('created_at', { ascending: false });

    if (LIMIT) query = query.limit(LIMIT);

    const { data: roles, error } = await query;
    if (error) throw error;

    if (!roles?.length) {
      console.log('No person roles with linked company entities found.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`${roles.length} person roles to process`);

    // 2. Get existing board_member relationships to avoid duplicates
    const { data: existingRels } = await db
      .from('gs_relationships')
      .select('source_entity_id, target_entity_id')
      .eq('relationship_type', 'board_member');

    const existingSet = new Set(
      (existingRels || []).map(r => `${r.source_entity_id}:${r.target_entity_id}`)
    );
    console.log(`${existingSet.size} existing board_member relationships`);

    // 3. Build person entity lookup — find person entities or track needed ones
    const personEntityIds = new Set();
    const personsByName = new Map();

    for (const role of roles) {
      if (role.person_entity_id) {
        personEntityIds.add(role.person_entity_id);
      } else {
        // Group by normalised name
        const normName = role.person_name_normalised || role.person_name.toUpperCase().trim();
        if (!personsByName.has(normName)) {
          personsByName.set(normName, { name: role.person_name, roles: [] });
        }
        personsByName.get(normName).roles.push(role);
      }
    }

    // 4. Look up existing person entities
    const { data: existingPersons } = await db
      .from('gs_entities')
      .select('id, canonical_name')
      .eq('entity_type', 'person')
      .in('canonical_name', [...personsByName.keys()].map(n =>
        n.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
      ));

    const personEntityByName = new Map();
    for (const p of existingPersons || []) {
      personEntityByName.set(p.canonical_name.toUpperCase(), p.id);
    }

    // 5. Create relationships
    let created = 0;
    let skipped = 0;
    const toInsert = [];

    for (const role of roles) {
      let personId = role.person_entity_id;
      if (!personId) {
        const normName = role.person_name_normalised || role.person_name.toUpperCase().trim();
        personId = personEntityByName.get(normName);
      }

      if (!personId || !role.entity_id) {
        skipped++;
        continue;
      }

      const key = `${personId}:${role.entity_id}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      existingSet.add(key); // Prevent dupes in this batch

      toInsert.push({
        source_entity_id: personId,
        target_entity_id: role.entity_id,
        relationship_type: 'board_member',
        dataset: 'asic_officeholders',
        year: role.appointment_date ? new Date(role.appointment_date).getFullYear() : null,
        properties: {
          role_type: role.role_type,
          appointment_date: role.appointment_date,
          cessation_date: role.cessation_date,
          active: !role.cessation_date,
        },
      });
    }

    console.log(`\n${toInsert.length} new relationships to create (${skipped} skipped)`);

    if (APPLY && toInsert.length > 0) {
      // Insert in batches of 500
      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        const { error: insertError } = await db
          .from('gs_relationships')
          .insert(batch);

        if (insertError) {
          console.error(`Batch insert error: ${insertError.message}`);
        } else {
          created += batch.length;
        }
      }
      console.log(`  ${created} relationships created`);
    }

    console.log(`\n=== Summary ===`);
    console.log(`Roles processed: ${roles.length}`);
    console.log(`New edges: ${toInsert.length}`);
    console.log(`Created: ${created}`);
    if (!APPLY) console.log('(DRY RUN — use --apply to write changes)');

    await logComplete(db, run.id, {
      items_found: roles.length,
      items_new: created,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
