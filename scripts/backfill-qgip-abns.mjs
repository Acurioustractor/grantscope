#!/usr/bin/env node
/**
 * Backfill unlinked QGIP justice_funding records by:
 * 1. Finding distinct unlinked ABNs
 * 2. Creating gs_entities for ABNs not yet in gs_entities (using ABR registry for names)
 * 3. Linking justice_funding rows to gs_entities via gs_id
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-qgip-abns.mjs [--dry-run] [--batch=500]
 *
 * Safe: uses INSERT ... ON CONFLICT DO NOTHING for entities, UPDATE ... WHERE gs_entity_id IS NULL for linking.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'backfill-qgip-abns';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] || '500');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

function makeGsId(abn) {
  return `AU-ABN-${abn}`;
}

async function main() {
  const startTime = Date.now();
  console.log(`[${AGENT_ID}] Starting... ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`[${AGENT_ID}] Batch size: ${BATCH_SIZE}`);

  // Step 1: Get all distinct unlinked ABNs from QGIP.
  // Previous impl used GROUP BY + pagination which triggered an 8s statement
  // timeout on 71K rows. Switched to DISTINCT ON + pure-row fetch + JS dedup
  // so PostgreSQL doesn't have to do the aggregation work.
  console.log('\n[Step 1] Finding unlinked QGIP ABNs...');
  const abnToName = new Map();
  let offset = 0;
  const PAGE = 2000;
  while (true) {
    const { data, error } = await db.rpc('exec_sql', {
      query: `
        SELECT recipient_abn as abn, recipient_name as name
        FROM justice_funding
        WHERE source = 'qgip'
          AND gs_entity_id IS NULL
          AND recipient_abn IS NOT NULL
          AND recipient_abn != ''
        LIMIT ${PAGE} OFFSET ${offset}
      `
    });
    if (error) { console.error('Failed to fetch unlinked:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (!abnToName.has(row.abn)) abnToName.set(row.abn, row.name);
    }
    if (data.length < PAGE) break;
    offset += PAGE;
    // Cap to prevent runaway
    if (offset > 100000) break;
  }
  const unlinkedRows = Array.from(abnToName.entries()).map(([abn, name]) => ({ abn, name }));
  console.log(`  Found ${unlinkedRows.length} distinct unlinked ABNs`);

  if (unlinkedRows.length === 0) {
    console.log('  Nothing to do!');
    return;
  }

  // Step 2: Check which ABNs already exist in gs_entities
  console.log('\n[Step 2] Checking existing gs_entities...');
  const allAbns = unlinkedRows.map(r => r.abn);
  const existingAbns = new Map();

  // Check in batches (PostgREST IN filter has limits)
  for (let i = 0; i < allAbns.length; i += 1000) {
    const batch = allAbns.slice(i, i + 1000);
    const { data, error } = await db
      .from('gs_entities')
      .select('abn, id')
      .in('abn', batch);
    if (error) { console.error('gs_entities lookup error:', error.message); continue; }
    for (const row of data || []) {
      existingAbns.set(row.abn, row.id); // UUID for justice_funding.gs_entity_id
    }
  }
  console.log(`  ${existingAbns.size} ABNs already in gs_entities`);
  console.log(`  ${allAbns.length - existingAbns.size} need new entities`);

  // Step 3: Look up names from ABR for missing ABNs
  const missingAbns = allAbns.filter(a => !existingAbns.has(a));

  if (missingAbns.length > 0) {
    console.log('\n[Step 3] Looking up names from ABR registry...');
    const abrNames = new Map();

    for (let i = 0; i < missingAbns.length; i += 1000) {
      const batch = missingAbns.slice(i, i + 1000);
      const { data, error } = await db
        .from('abr_registry')
        .select('abn, entity_name, entity_type, state, postcode')
        .in('abn', batch);
      if (error) { console.error('ABR lookup error:', error.message); continue; }
      for (const row of data || []) {
        abrNames.set(row.abn, row);
      }
    }
    console.log(`  Found ${abrNames.size} in ABR registry`);

    // Build name map from QGIP recipient_name as fallback
    const qgipNames = new Map();
    for (const row of unlinkedRows) {
      if (!qgipNames.has(row.abn)) {
        qgipNames.set(row.abn, row.name);
      }
    }

    // Step 4: Create gs_entities for missing ABNs
    console.log('\n[Step 4] Creating gs_entities...');
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < missingAbns.length; i += BATCH_SIZE) {
      const batch = missingAbns.slice(i, i + BATCH_SIZE);
      const entities = batch.map(abn => {
        const abr = abrNames.get(abn);
        const name = abr?.entity_name || qgipNames.get(abn) || `Unknown (${abn})`;
        return {
          gs_id: makeGsId(abn),
          canonical_name: name,
          abn,
          entity_type: abr?.entity_type === 'IND' ? 'person' : 'company',
          sector: 'unknown',
          state: abr?.state || null,
          postcode: abr?.postcode || null,
          confidence: 'registry',
        };
      });

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create ${entities.length} entities (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
        created += entities.length;
        continue;
      }

      const { data, error } = await db
        .from('gs_entities')
        .upsert(entities, { onConflict: 'gs_id', ignoreDuplicates: true })
        .select('id, abn');

      if (error) {
        console.error(`  Batch error:`, error.message);
        skipped += entities.length;
      } else {
        created += (data?.length || 0);
        // Add UUID to existingAbns map for linking step
        for (const row of data || []) {
          existingAbns.set(row.abn, row.id);
        }
      }

      if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= missingAbns.length) {
        console.log(`  Progress: ${Math.min(i + BATCH_SIZE, missingAbns.length)}/${missingAbns.length} (created: ${created}, skipped: ${skipped})`);
      }
    }
    console.log(`  Created ${created} new entities, skipped ${skipped}`);
  } else {
    console.log('\n[Step 3-4] All ABNs already have gs_entities — skipping creation');
  }

  // Step 5: Link justice_funding rows
  console.log('\n[Step 5] Linking justice_funding rows...');
  let linked = 0;
  let linkErrors = 0;

  // Group by ABN for efficient updates — only link ABNs we have UUIDs for
  const abnGroups = new Map();
  for (const row of unlinkedRows) {
    const uuid = existingAbns.get(row.abn);
    if (uuid && !abnGroups.has(row.abn)) {
      abnGroups.set(row.abn, uuid);
    }
  }
  console.log(`  ${abnGroups.size} ABNs have UUIDs to link (${unlinkedRows.length - abnGroups.size} skipped — no entity)`)

  // Update in batches by ABN
  const abnEntries = [...abnGroups.entries()];
  for (let i = 0; i < abnEntries.length; i += BATCH_SIZE) {
    const batch = abnEntries.slice(i, i + BATCH_SIZE);

    for (const [abn, gsId] of batch) {
      if (DRY_RUN) {
        linked++;
        continue;
      }

      const { error, count } = await db
        .from('justice_funding')
        .update({ gs_entity_id: gsId })
        .eq('source', 'qgip')
        .eq('recipient_abn', abn)
        .is('gs_entity_id', null);

      if (error) {
        console.error(`  Link error for ABN ${abn}:`, error.message);
        linkErrors++;
      } else {
        linked++;
      }
    }

    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= abnEntries.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, abnEntries.length)}/${abnEntries.length} ABNs linked`);
    }
  }

  console.log(`  Linked ${linked} ABNs, ${linkErrors} errors`);

  // Step 6: Verify
  console.log('\n[Step 6] Verification...');
  const { data: finalStats } = await db.rpc('exec_sql', {
    query: `
      SELECT
        COUNT(*) as total,
        COUNT(gs_entity_id) as linked,
        ROUND(100.0 * COUNT(gs_entity_id) / COUNT(*), 1) as pct
      FROM justice_funding
      WHERE source = 'qgip'
    `
  });

  if (finalStats?.[0]) {
    const s = finalStats[0];
    console.log(`  QGIP: ${s.total} total, ${s.linked} linked (${s.pct}%)`);
  }

  const duration = Date.now() - startTime;
  console.log(`\n[${AGENT_ID}] Done in ${(duration / 1000).toFixed(1)}s ${DRY_RUN ? '(DRY RUN)' : ''}`);

  // Log agent run
  if (!DRY_RUN) {
    try {
      const run = await logStart(db, AGENT_ID, 'Backfill QGIP ABNs');
      await logComplete(db, run.id, {
        items_found: unlinkedRows.length,
        items_new: missingAbns.length,
      });
    } catch (e) {
      console.error('Failed to log agent run:', e.message);
    }
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
