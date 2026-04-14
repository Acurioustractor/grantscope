#!/usr/bin/env node
/**
 * build-person-network.mjs
 *
 * Reads person_roles (340k director/board records) and builds two types of
 * relationships in gs_relationships:
 *
 *   1. PERSON_ROLE: person_entity → org_entity  (e.g. "John Smith is Director of Org X")
 *   2. CO_DIRECTOR: org_entity → org_entity     (e.g. "John Smith is Director of both X and Y")
 *
 * Run: node --env-file=.env scripts/build-person-network.mjs [--limit=1000] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '2000');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function safe(p) {
  try { return await p; }
  catch { return { data: null, error: { message: 'exception' } }; }
}

async function main() {
  console.log(`=== Person Network Graph Builder ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  console.log(`Processing up to ${LIMIT} person roles\n`);

  let runId = null;
  if (!DRY_RUN) {
    const run = await logStart(db, 'build-person-network', 'Build Person Network');
    runId = run?.id || null;
  }

  try {
    // Fetch person_roles that have entity_id set (linked to gs_entities)
    const { data: roles, error } = await db
      .from('person_roles')
      .select('id, person_name, person_name_normalised, role_type, entity_id, person_entity_id, company_abn, appointment_date, cessation_date, confidence')
      .not('entity_id', 'is', null)
      .is('cessation_date', null) // Active roles only
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (error) throw new Error(`Failed to fetch person_roles: ${error.message}`);
    if (!roles?.length) {
      console.log('No linked person roles found.');
      if (runId) await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`Loaded ${roles.length} active person roles with entity links\n`);

    let personOrgLinks = 0;
    let coDirectorLinks = 0;
    let errors = 0;
    const BATCH = 100;

    // --- Pass 1: PERSON_ROLE relationships (person → org) ---
    console.log('Pass 1: Building PERSON_ROLE relationships...');
    const personOrgRows = [];

    for (const role of roles) {
      if (!role.person_entity_id || !role.entity_id) continue;

      personOrgRows.push({
        source_entity_id: role.person_entity_id,
        target_entity_id: role.entity_id,
        relationship_type: 'directorship',
        dataset: 'person_roles',
        confidence: 'reported',
        start_date: role.appointment_date || null,
        end_date: role.cessation_date || null,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        properties: JSON.stringify({ role_type: role.role_type, person_name: role.person_name }),
      });
    }

    if (DRY_RUN) {
      console.log(`  Would insert ${personOrgRows.length} PERSON_ROLE relationships`);
    } else {
      for (let i = 0; i < personOrgRows.length; i += BATCH) {
        const batch = personOrgRows.slice(i, i + BATCH);
        const { error: bErr } = await db
          .from('gs_relationships')
          .insert(batch);
        if (bErr) {
          if (i === 0) console.error(`  Insert error sample: ${bErr.message}`);
          errors++;
        } else {
          personOrgLinks += batch.length;
        }
        if (i % 500 === 0 && i > 0) console.log(`  ${i}/${personOrgRows.length} processed...`);
      }
      console.log(`  Inserted ${personOrgLinks} PERSON_ROLE relationships\n`);
    }

    // --- Pass 2: CO_DIRECTOR relationships (org → org via shared person) ---
    console.log('Pass 2: Building CO_DIRECTOR relationships...');

    // Group roles by normalised person name to find shared directors
    const byPerson = new Map();
    for (const role of roles) {
      if (!role.entity_id) continue;
      const key = role.person_name_normalised || role.person_name?.toLowerCase() || '';
      if (!key || key.length < 4) continue;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key).push(role);
    }

    const coDirectorRows = [];
    for (const [personName, personRoles] of byPerson) {
      const entityIds = [...new Set(personRoles.map(r => r.entity_id))];
      if (entityIds.length < 2) continue;

      // Create a link between every pair of orgs this person controls
      for (let i = 0; i < entityIds.length; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
          coDirectorRows.push({
            source_entity_id: entityIds[i],
            target_entity_id: entityIds[j],
            relationship_type: 'shared_director',
            dataset: 'person_roles',
            confidence: 'inferred',
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            properties: JSON.stringify({ shared_person: personName, role_count: personRoles.length }),
          });
        }
      }
    }

    if (DRY_RUN) {
      console.log(`  Would insert ${coDirectorRows.length} CO_DIRECTOR relationships`);
    } else {
      for (let i = 0; i < coDirectorRows.length; i += BATCH) {
        const batch = coDirectorRows.slice(i, i + BATCH);
        const { error: bErr } = await safe(db.from('gs_relationships').insert(batch, { ignoreDuplicates: true }));
        if (bErr) errors++;
        else coDirectorLinks += batch.length;
        if (i % 1000 === 0 && i > 0) console.log(`  ${i}/${coDirectorRows.length} processed...`);
      }
      console.log(`  Inserted ${coDirectorLinks} CO_DIRECTOR relationships\n`);
    }

    console.log('=== SUMMARY ===');
    console.log(`Person roles processed:   ${roles.length}`);
    console.log(`PERSON_ROLE links:        ${personOrgLinks}`);
    console.log(`CO_DIRECTOR links:        ${coDirectorLinks}`);
    console.log(`Errors:                   ${errors}`);

    if (runId) await logComplete(db, runId, {
      items_found: roles.length,
      items_new: personOrgLinks + coDirectorLinks,
    });

  } catch (err) {
    console.error('Fatal:', err);
    if (runId) await logFailed(db, runId, err);
    process.exit(1);
  }
}

main();
