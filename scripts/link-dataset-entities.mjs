#!/usr/bin/env node
/**
 * Universal Entity Linker — connects any dataset to gs_entities via ABN.
 *
 * Pattern: find unlinked rows with ABNs → create missing gs_entities from ABR → link rows.
 * This is the compound agent — build once, run against every dataset.
 *
 * Usage:
 *   node --env-file=.env scripts/link-dataset-entities.mjs --table=ndis_registered_providers --abn-col=abn --name-col=provider_name --link-col=gs_entity_id [--dry-run] [--batch=500]
 *
 * Required flags:
 *   --table      Source table name
 *   --abn-col    Column containing ABN values
 *   --name-col   Column containing entity name (fallback if not in ABR)
 *   --link-col   Column to write the gs_entities UUID into
 *
 * Optional:
 *   --dry-run    Don't write anything
 *   --batch=N    Batch size (default 500)
 *   --filter=X   Additional WHERE clause (e.g. "source='qgip'")
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete } from './lib/log-agent-run.mjs';

// Parse args
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.join('=') || 'true'];
    })
);

const TABLE = args.table;
const ABN_COL = args['abn-col'];
const NAME_COL = args['name-col'];
const LINK_COL = args['link-col'];
const DRY_RUN = 'dry-run' in args;
const BATCH = parseInt(args.batch || '500');
const FILTER = args.filter || null;
const AGENT_ID = `link-${TABLE}`;

if (!TABLE || !ABN_COL || !NAME_COL || !LINK_COL) {
  console.error('Required: --table, --abn-col, --name-col, --link-col');
  console.error('Example: node --env-file=.env scripts/link-dataset-entities.mjs --table=ndis_registered_providers --abn-col=abn --name-col=provider_name --link-col=gs_entity_id');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1); }
const db = createClient(supabaseUrl, supabaseKey);

async function paginatedQuery(sql) {
  const rows = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await db.rpc('exec_sql', {
      query: `${sql} LIMIT ${PAGE} OFFSET ${offset}`
    });
    if (error) throw new Error(`SQL error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function main() {
  const start = Date.now();
  console.log(`\n=== Universal Entity Linker ===`);
  console.log(`  Table: ${TABLE}`);
  console.log(`  ABN column: ${ABN_COL}`);
  console.log(`  Name column: ${NAME_COL}`);
  console.log(`  Link column: ${LINK_COL}`);
  console.log(`  Filter: ${FILTER || '(none)'}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Step 1: Find distinct unlinked ABNs
  console.log('[1] Finding unlinked ABNs...');
  const filterClause = FILTER ? ` AND ${FILTER}` : '';
  const unlinked = await paginatedQuery(`
    SELECT DISTINCT "${ABN_COL}" as abn, MIN("${NAME_COL}") as name
    FROM "${TABLE}"
    WHERE "${LINK_COL}" IS NULL
      AND "${ABN_COL}" IS NOT NULL
      AND "${ABN_COL}" != ''
      ${filterClause}
    GROUP BY "${ABN_COL}"
    ORDER BY abn
  `);
  console.log(`  ${unlinked.length} distinct unlinked ABNs`);

  if (unlinked.length === 0) {
    console.log('  Nothing to do!');
    return;
  }

  // Step 2: Check existing gs_entities
  console.log('[2] Checking existing gs_entities...');
  const allAbns = unlinked.map(r => r.abn);
  const existingAbns = new Map(); // abn → UUID

  for (let i = 0; i < allAbns.length; i += 1000) {
    const batch = allAbns.slice(i, i + 1000);
    const { data, error } = await db.from('gs_entities').select('abn, id').in('abn', batch);
    if (error) { console.error('  gs_entities lookup error:', error.message); continue; }
    for (const row of data || []) existingAbns.set(row.abn, row.id);
  }

  const missingAbns = allAbns.filter(a => !existingAbns.has(a));
  console.log(`  ${existingAbns.size} already in gs_entities`);
  console.log(`  ${missingAbns.length} need new entities`);

  // Step 3: ABR lookup for missing
  if (missingAbns.length > 0) {
    console.log('[3] Looking up names from ABR registry...');
    const abrData = new Map();
    for (let i = 0; i < missingAbns.length; i += 1000) {
      const batch = missingAbns.slice(i, i + 1000);
      const { data, error } = await db.from('abr_registry').select('abn, entity_name, entity_type, state, postcode').in('abn', batch);
      if (error) { console.error('  ABR error:', error.message); continue; }
      for (const row of data || []) abrData.set(row.abn, row);
    }
    console.log(`  ${abrData.size} found in ABR`);

    // Fallback names from source table
    const srcNames = new Map();
    for (const row of unlinked) {
      if (!srcNames.has(row.abn)) srcNames.set(row.abn, row.name);
    }

    // Step 4: Create gs_entities
    console.log('[4] Creating gs_entities...');
    let created = 0, skipped = 0;

    for (let i = 0; i < missingAbns.length; i += BATCH) {
      const batch = missingAbns.slice(i, i + BATCH);
      const entities = batch.map(abn => {
        const abr = abrData.get(abn);
        const name = abr?.entity_name || srcNames.get(abn) || `Unknown (${abn})`;
        return {
          gs_id: `AU-ABN-${abn}`,
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
        for (const row of data || []) existingAbns.set(row.abn, row.id);
      }

      if ((i + BATCH) % 2000 === 0 || i + BATCH >= missingAbns.length) {
        console.log(`  ${Math.min(i + BATCH, missingAbns.length)}/${missingAbns.length} (created: ${created}, skipped: ${skipped})`);
      }
    }
    console.log(`  Created ${created}, skipped ${skipped}`);
  }

  // Step 5: Link rows
  console.log('[5] Linking rows...');
  let linked = 0, errors = 0;

  const linkable = unlinked.filter(r => existingAbns.has(r.abn));
  console.log(`  ${linkable.length} ABNs to link`);

  for (let i = 0; i < linkable.length; i++) {
    const { abn } = linkable[i];
    const uuid = existingAbns.get(abn);

    if (DRY_RUN) { linked++; continue; }

    let query = db.from(TABLE).update({ [LINK_COL]: uuid }).eq(ABN_COL, abn).is(LINK_COL, null);
    if (FILTER) {
      // Parse simple filters like "source='qgip'"
      const match = FILTER.match(/(\w+)\s*=\s*'([^']+)'/);
      if (match) query = query.eq(match[1], match[2]);
    }

    const { error } = await query;
    if (error) { errors++; if (errors <= 3) console.error(`  Error ABN ${abn}:`, error.message); }
    else linked++;

    if ((i + 1) % 2000 === 0 || i + 1 === linkable.length) {
      console.log(`  ${i + 1}/${linkable.length} (linked: ${linked}, errors: ${errors})`);
    }
  }

  // Step 6: Verify
  console.log('[6] Verification...');
  const { data: stats } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as total, COUNT("${LINK_COL}") as linked, ROUND(100.0 * COUNT("${LINK_COL}") / NULLIF(COUNT(*),0), 1) as pct FROM "${TABLE}" ${FILTER ? 'WHERE ' + FILTER : ''}`
  });

  if (stats?.[0]) {
    const s = stats[0];
    console.log(`  ${TABLE}: ${s.total} total, ${s.linked} linked (${s.pct}%)`);
  }

  const duration = Date.now() - start;
  console.log(`\nDone in ${(duration / 1000).toFixed(1)}s ${DRY_RUN ? '(DRY RUN)' : ''}`);

  if (!DRY_RUN) {
    try {
      const run = await logStart(db, AGENT_ID, `Link ${TABLE}`);
      await logComplete(db, run.id, { items_found: unlinked.length, items_new: missingAbns.length });
    } catch (e) { console.error('Log error:', e.message); }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
