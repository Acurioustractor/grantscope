#!/usr/bin/env node
/**
 * sweep-abn-entities.mjs
 *
 * Phase 1: For gs_entities missing an ABN, look them up in abr_registry by name.
 * Phase 2: If the found ABN already belongs to another gs_entity, flag as a
 *          likely duplicate (add to entity_identifiers for human review) 
 *          rather than blindly overwriting.
 * Phase 3: For clear matches with no conflict, write the ABN + metadata.
 *
 * Run: node --env-file=.env scripts/sweep-abn-entities.mjs [--limit=500] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalise(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\bpty\b\.?/g, '')
    .replace(/\bltd\b\.?/g, '')
    .replace(/\binc\b\.?/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log(`=== ABN Sweeper Agent ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  console.log(`Limit: ${LIMIT}\n`);

  let runId = null;
  if (!DRY_RUN) {
    const run = await logStart(db, 'sweep-abn-entities', 'ABN Sweeper');
    runId = run?.id || null;
  }

  try {
    // Fetch entities missing ABN
    const { data: entities, error: entitiesError } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, abn, entity_type, postcode')
      .is('abn', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (entitiesError) throw new Error(`Failed to fetch entities: ${entitiesError.message}`);
    if (!entities?.length) {
      console.log('No entities missing ABN — all clean!');
      if (runId) await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`Found ${entities.length} entities missing ABN\n`);

    let matched = 0;
    let updated = 0;
    let conflicts = 0; // ABN belongs to another entity — flagged for merge review

    for (const entity of entities) {
      const normName = normalise(entity.canonical_name);
      if (!normName || normName.length < 4) continue;

      // Search first 3 words of name in ABR
      const searchTerms = entity.canonical_name.split(' ').slice(0, 3).join(' ');
      const { data: abrMatches } = await db
        .from('abr_registry')
        .select('abn, entity_name, entity_type, postcode, state, status, acnc_registered')
        .eq('status', 'Active')
        .ilike('entity_name', `%${searchTerms}%`)
        .limit(5);

      if (!abrMatches?.length) continue;

      // Score matches
      const scored = abrMatches.map(r => {
        const normAbr = normalise(r.entity_name);
        const exactMatch = normAbr === normName;
        const wordOverlap = normAbr.split(' ').filter(w => normName.includes(w) && w.length > 3).length;
        return { ...r, score: exactMatch ? 100 : wordOverlap };
      });
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (best.score < 2) continue;

      matched++;

      // Check ABN conflict — does another entity already have this ABN?
      const { data: conflictEntity } = await db
        .from('gs_entities')
        .select('id, gs_id, canonical_name')
        .eq('abn', best.abn)
        .neq('id', entity.id)
        .limit(1);

      if (conflictEntity?.length) {
        // Flag in entity_identifiers for merge review rather than overwriting
        conflicts++;
        if (!DRY_RUN) {
          await db.from('entity_identifiers').upsert({
            entity_id: entity.id,
            identifier_type: 'abn_conflict',
            identifier_value: best.abn,
            source: 'sweep-abn-entities',
          }, { onConflict: 'entity_id,identifier_type,identifier_value', ignoreDuplicates: true });
        } else {
          console.log(`  CONFLICT: ${entity.canonical_name} → ABN ${best.abn} already owned by ${conflictEntity[0].canonical_name}`);
        }
        continue;
      }

      if (DRY_RUN) {
        console.log(`  WOULD UPDATE: ${entity.canonical_name} → ABN: ${best.abn}, Type: ${best.entity_type}, Postcode: ${best.postcode}`);
        continue;
      }

      const updates = {
        abn: best.abn,
        updated_at: new Date().toISOString(),
      };
      if (!entity.entity_type && best.entity_type) updates.entity_type = best.entity_type;
      if (!entity.postcode && best.postcode) updates.postcode = best.postcode;

      const { error: updateError } = await db
        .from('gs_entities')
        .update(updates)
        .eq('id', entity.id);

      if (updateError) {
        console.error(`  Error updating ${entity.canonical_name}: ${updateError.message}`);
      } else {
        updated++;
        if (updated % 25 === 0) console.log(`  Updated ${updated} entities...`);
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Entities scanned:         ${entities.length}`);
    console.log(`ABR matches found:        ${matched}`);
    console.log(`ABNs cleanly assigned:    ${updated}`);
    console.log(`ABN conflicts flagged:    ${conflicts} (logged to entity_identifiers for merge review)`);

    if (runId) await logComplete(db, runId, { items_found: entities.length, items_new: updated, items_updated: conflicts });

  } catch (err) {
    console.error('Fatal:', err);
    if (runId) await logFailed(db, runId, err);
    process.exit(1);
  }
}

main();
