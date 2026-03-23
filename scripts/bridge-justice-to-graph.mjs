#!/usr/bin/env node

/**
 * Bridge justice_funding → gs_relationships
 *
 * Creates program entities for distinct (program_name, state) pairs,
 * then creates funding relationships: program → recipient entity.
 * Uses source_record_id for dedup, so it's safe to run repeatedly.
 *
 * Usage:
 *   node --env-file=.env scripts/bridge-justice-to-graph.mjs [--dry-run] [--limit=100000]
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '100000');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

/** Collision-resistant gs_id: slug-80 + 4-char hash of full name */
function programGsId(name, state) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
  const hash = createHash('md5').update(name).digest('hex').slice(0, 4);
  return `GS-PROG-${slug}-${hash}-${state.toLowerCase()}`;
}

async function main() {
  log(`=== Justice Funding → Graph Bridge ===`);
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}, Limit: ${LIMIT}`);

  // Step 1: Get justice_funding records with ABNs (paginate past 1000 limit)
  const records = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (records.length < LIMIT) {
    const { data, error } = await db
      .from('justice_funding')
      .select('id, recipient_name, recipient_abn, program_name, amount_dollars, state, financial_year')
      .not('recipient_abn', 'is', null)
      .gt('amount_dollars', 0)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) { log(`Error: ${error.message}`); process.exit(1); }
    if (!data?.length) break;
    records.push(...data);
    page++;
    if (data.length < PAGE_SIZE) break;
  }
  log(`Fetched ${records.length} justice_funding records with ABNs (${page} pages)`);

  // Step 2: Get entity IDs for recipient ABNs
  const uniqueAbns = [...new Set(records.map(r => r.recipient_abn))];
  log(`Unique recipient ABNs: ${uniqueAbns.length}`);

  const abnToEntity = new Map();
  for (let i = 0; i < uniqueAbns.length; i += 500) {
    const batch = uniqueAbns.slice(i, i + 500);
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, abn')
      .in('abn', batch);
    for (const e of (entities || [])) {
      if (!abnToEntity.has(e.abn)) abnToEntity.set(e.abn, e.id);
    }
  }
  log(`Matched ${abnToEntity.size} ABNs to entities`);

  // Step 3: Find or create program entities for distinct (program_name, state) pairs
  const programKeys = new Set();
  for (const rec of records) {
    programKeys.add(`${rec.program_name}|||${rec.state || 'NAT'}`);
  }
  log(`Unique programs: ${programKeys.size}`);

  // Look up existing program entities
  const programToEntity = new Map(); // key → uuid
  const { data: existingPrograms } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name, state')
    .eq('entity_type', 'program');

  // Build lookup from gs_id → entity id
  const gsIdToEntity = new Map();
  for (const ep of (existingPrograms || [])) {
    gsIdToEntity.set(ep.gs_id, ep.id);
  }
  // Match program keys to existing entities (try new format, fall back to old)
  for (const key of programKeys) {
    const [name, state] = key.split('|||');
    const newGsId = programGsId(name, state);
    const oldGsId = `GS-PROG-${slugify(name)}-${state.toLowerCase()}`;
    if (gsIdToEntity.has(newGsId)) {
      programToEntity.set(key, gsIdToEntity.get(newGsId));
    } else if (gsIdToEntity.has(oldGsId)) {
      programToEntity.set(key, gsIdToEntity.get(oldGsId));
    }
  }
  log(`Found ${programToEntity.size} existing program entities`);

  // Create missing program entities
  let programsCreated = 0;
  for (const key of programKeys) {
    if (programToEntity.has(key)) continue;
    const [name, state] = key.split('|||');
    const gsId = programGsId(name, state);

    if (!DRY_RUN) {
      const { data: inserted, error: insertErr } = await db
        .from('gs_entities')
        .insert({
          gs_id: gsId,
          canonical_name: name,
          entity_type: 'program',
          sector: 'government',
          state: state === 'NAT' ? null : state,
          confidence: 'inferred',
        })
        .select('id')
        .single();

      if (insertErr) {
        if (insertErr.message.includes('duplicate')) {
          // Already exists, look it up
          const { data: existing } = await db
            .from('gs_entities')
            .select('id')
            .eq('gs_id', gsId)
            .single();
          if (existing) programToEntity.set(key, existing.id);
        } else {
          log(`Program insert error for "${name}" (${state}): ${insertErr.message}`);
        }
        continue;
      }
      programToEntity.set(key, inserted.id);
    }
    programsCreated++;
  }
  log(`${DRY_RUN ? 'Would create' : 'Created'} ${programsCreated} program entities`);

  // Step 4: Build relationships (program → recipient)
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH_SIZE = 50;
  let batch = [];

  for (const rec of records) {
    const targetId = abnToEntity.get(rec.recipient_abn);
    if (!targetId) { skipped++; continue; }

    const programKey = `${rec.program_name}|||${rec.state || 'NAT'}`;
    const sourceId = programToEntity.get(programKey);
    if (!sourceId) { skipped++; continue; }

    batch.push({
      source_entity_id: sourceId,
      target_entity_id: targetId,
      relationship_type: 'grant',
      amount: rec.amount_dollars,
      year: parseInt(rec.financial_year) || null,
      dataset: 'justice_funding',
      source_record_id: String(rec.id),
      properties: { program: rec.program_name, state: rec.state, recipient: rec.recipient_name },
    });

    if (batch.length >= BATCH_SIZE) {
      if (!DRY_RUN) {
        const { error: insertErr } = await db
          .from('gs_relationships')
          .insert(batch);
        if (insertErr) {
          for (const item of batch) {
            const { error: singleErr } = await db
              .from('gs_relationships')
              .insert(item);
            if (singleErr) {
              if (singleErr.message.includes('duplicate')) skipped++;
              else { if (errors < 3) log(`Insert error: ${singleErr.message}`); errors++; }
            } else {
              created++;
            }
          }
        } else {
          created += batch.length;
        }
      } else {
        created += batch.length;
      }
      batch = [];
    }
  }

  // Flush remaining
  if (batch.length) {
    if (!DRY_RUN) {
      const { error: insertErr } = await db
        .from('gs_relationships')
        .upsert(batch, {
          onConflict: 'source_entity_id,target_entity_id,relationship_type,dataset,source_record_id',
          ignoreDuplicates: true,
        });
      if (insertErr) {
        for (const item of batch) {
          const { error: singleErr } = await db
            .from('gs_relationships')
            .insert(item);
          if (singleErr) {
            if (singleErr.message.includes('duplicate')) skipped++;
            else errors++;
          } else {
            created++;
          }
        }
      } else {
        created += batch.length;
      }
    } else {
      created += batch.length;
    }
  }

  log(`=== COMPLETE ===`);
  log(`Programs: ${programsCreated} created, ${programToEntity.size} total`);
  log(`Relationships: ${created} created`);
  log(`Skipped (no entity or duplicate): ${skipped}`);
  log(`Errors: ${errors}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
