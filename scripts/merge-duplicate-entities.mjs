#!/usr/bin/env node
/**
 * merge-duplicate-entities.mjs
 *
 * Finds gs_entities with the same canonical_name (exact) and merges them:
 * - The entity WITH an ABN becomes the "survivor"
 * - All relationships, identifiers referencing the duplicate are re-pointed to survivor
 * - The duplicate row is deleted
 *
 * Run: node --env-file=.env scripts/merge-duplicate-entities.mjs [--limit=200] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '200');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`=== Entity Merge Agent ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  console.log(`Limit: ${LIMIT} duplicate groups\n`);

  let runId = null;
  if (!DRY_RUN) {
    const run = await logStart(db, 'merge-duplicate-entities', 'Merge Duplicate Entities');
    runId = run?.id || null;
  }

  try {
    // Find exact-name duplicates using exec_sql (group by normalised name)
    const { data: dupeGroups, error } = await db.rpc('exec_sql', {
      query: `
        SELECT 
          lower(trim(canonical_name)) as norm_name,
          COUNT(*) as dupe_count,
          array_agg(id ORDER BY abn NULLS LAST, created_at) as entity_ids,
          array_agg(abn ORDER BY abn NULLS LAST, created_at) as abns,
          array_agg(canonical_name ORDER BY abn NULLS LAST, created_at) as names
        FROM gs_entities
        GROUP BY lower(trim(canonical_name))
        HAVING COUNT(*) > 1
        ORDER BY dupe_count DESC
        LIMIT ${LIMIT}
      `
    });

    if (error) throw new Error(`Failed to find duplicates: ${error.message}`);
    if (!dupeGroups?.length) {
      console.log('No duplicate entities found!');
      if (runId) await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`Found ${dupeGroups.length} duplicate name groups\n`);

    let merged = 0;
    let relationshipsMoved = 0;
    let errors = 0;

    for (const group of dupeGroups) {
      const ids = group.entity_ids;
      const abns = group.abns;

      // Survivor = first entity (has ABN or oldest) — rest are duplicates
      const survivorId = ids[0];
      const duplicateIds = ids.slice(1);

      if (DRY_RUN) {
        console.log(`  MERGE: "${group.names[0]}" — survivor: ${survivorId}, removing: ${duplicateIds.join(', ')}`);
        continue;
      }

      // Re-point all relationships where duplicate is the source
      for (const dupId of duplicateIds) {
        const { error: relSourceErr, count: relSourceCount } = await db
          .from('gs_relationships')
          .update({ source_entity_id: survivorId })
          .eq('source_entity_id', dupId)
          .neq('target_entity_id', survivorId); // avoid self-loops
        
        // Re-point all relationships where duplicate is the target
        const { error: relTargetErr } = await db
          .from('gs_relationships')
          .update({ target_entity_id: survivorId })
          .eq('target_entity_id', dupId)
          .neq('source_entity_id', survivorId);

        // Re-point entity_identifiers
        await db
          .from('entity_identifiers')
          .update({ entity_id: survivorId })
          .eq('entity_id', dupId);

        // Delete self-referencing relationships created by merge
        await db
          .from('gs_relationships')
          .delete()
          .eq('source_entity_id', survivorId)
          .eq('target_entity_id', survivorId);

        if (!relSourceErr && !relTargetErr) {
          // Now safe to delete the duplicate entity
          const { error: deleteErr } = await db
            .from('gs_entities')
            .delete()
            .eq('id', dupId);
          
          if (deleteErr) {
            if (deleteErr.message?.includes('foreign key')) {
              // Entity is referenced by other tables (ALMA, etc) — skip, relationships already re-pointed
            } else {
              console.error(`  Error deleting duplicate ${dupId}: ${deleteErr.message.slice(0, 80)}`);
              errors++;
            }
          } else {
            merged++;
            relationshipsMoved += relSourceCount || 0;
          }
        } else {
          errors++;
        }
      }

      if (merged % 25 === 0 && merged > 0) console.log(`  Merged ${merged} duplicates...`);
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Duplicate groups found:     ${dupeGroups.length}`);
    console.log(`Entities merged (removed):  ${merged}`);
    console.log(`Relationships re-pointed:   ${relationshipsMoved}`);
    console.log(`Errors:                     ${errors}`);

    if (runId) await logComplete(db, runId, { items_found: dupeGroups.length, items_new: merged });

  } catch (err) {
    console.error('Fatal:', err);
    if (runId) await logFailed(db, runId, err);
    process.exit(1);
  }
}

main();
