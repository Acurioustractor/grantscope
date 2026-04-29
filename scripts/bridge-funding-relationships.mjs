#!/usr/bin/env node
/**
 * Bridge GrantConnect + VIC awarded grants → gs_relationships.
 *
 * For each row in grantconnect_awards / vic_grants_awarded that has a matched
 * gs_entity_id, emit a row into gs_relationships:
 *   source = funding agency (resolved or stub) → target = recipient entity
 *   relationship_type = 'grant'
 *   dataset = 'grantconnect' | 'vic_grants_{source}'
 *   amount = value_aud / amount_aud
 *
 * Funder entities: tries to match agency text to gs_entities (entity_type='government_body').
 * If no match found, inserts a stub government_body entity (gs_id = AU-GOVT-{slug}).
 *
 * Usage:
 *   node --env-file=.env scripts/bridge-funding-relationships.mjs --apply
 *   node --env-file=.env scripts/bridge-funding-relationships.mjs --apply --source=grantconnect
 *   node --env-file=.env scripts/bridge-funding-relationships.mjs --apply --source=vic
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const APPLY = process.argv.includes('--apply');
const sourceFilter = process.argv.find(a => a.startsWith('--source='))?.split('=')[1] || 'all';

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

const funderCache = new Map(); // agency text → gs_entities.id

async function resolveFunder(agencyText, defaultDataset) {
  if (!agencyText) return null;
  const key = agencyText.trim().toLowerCase();
  if (funderCache.has(key)) return funderCache.get(key);

  // Exact (case-insensitive) match
  const { data: exact } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', agencyText.trim())
    .eq('entity_type', 'government_body')
    .limit(1);

  if (exact?.[0]) {
    funderCache.set(key, exact[0].id);
    return exact[0].id;
  }

  // Stub funder
  if (!APPLY) {
    funderCache.set(key, null);
    return null;
  }

  const stubGsId = `AU-GOVT-${slugify(agencyText)}`;
  const { data: existing } = await db
    .from('gs_entities')
    .select('id')
    .eq('gs_id', stubGsId)
    .limit(1);
  if (existing?.[0]) {
    funderCache.set(key, existing[0].id);
    return existing[0].id;
  }

  const { data: ins, error } = await db
    .from('gs_entities')
    .insert({
      gs_id: stubGsId,
      canonical_name: agencyText.trim(),
      entity_type: 'government_body',
      sector: 'Government',
      confidence: 'inferred',
      source_datasets: [defaultDataset],
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`    stub funder error for "${agencyText}": ${error.message}`);
    funderCache.set(key, null);
    return null;
  }
  funderCache.set(key, ins.id);
  return ins.id;
}

async function bridgeGrantConnect() {
  console.log('\n--- GrantConnect → gs_relationships ---');

  const PAGE = 1000;
  let offset = 0;
  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  while (true) {
    const { data: rows, error } = await db
      .from('grantconnect_awards')
      .select('ga_id, agency, recipient_name, recipient_abn, value_aud, approval_date, gs_entity_id, go_title, pbs_program')
      .not('gs_entity_id', 'is', null)
      .not('value_aud', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!rows?.length) break;

    for (const r of rows) {
      processed++;
      const funderId = await resolveFunder(r.agency, 'grantconnect');
      if (!funderId) { skipped++; continue; }
      if (!APPLY) { inserted++; continue; }

      const fy = r.approval_date ? Number(String(r.approval_date).slice(0, 4)) : null;
      const { error: insErr } = await db.from('gs_relationships').insert({
        source_entity_id: funderId,
        target_entity_id: r.gs_entity_id,
        relationship_type: 'grant',
        dataset: 'grantconnect',
        amount: r.value_aud,
        year: fy,
        source_url: `https://www.grants.gov.au/Ga/Show/${r.ga_id}`,
        confidence: 'verified',
        properties: { title: [r.go_title, r.pbs_program].filter(Boolean).join(' — ').slice(0, 500) },
      });
      if (insErr) {
        skipped++;
      } else {
        inserted++;
      }
    }

    offset += PAGE;
    if (rows.length < PAGE) break;
  }

  console.log(`  processed: ${processed} | inserted: ${inserted} | skipped: ${skipped}`);
  return { processed, inserted };
}

async function bridgeVic() {
  console.log('\n--- VIC awarded grants → gs_relationships ---');

  const PAGE = 1000;
  let offset = 0;
  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  while (true) {
    const { data: rows, error } = await db
      .from('vic_grants_awarded')
      .select('id, source, agency, program_name, recipient_abn, amount_aud, approval_date, financial_year, gs_entity_id, source_url')
      .not('gs_entity_id', 'is', null)
      .not('amount_aud', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!rows?.length) break;

    for (const r of rows) {
      processed++;
      const agency = r.agency || `Victorian Government — ${r.source.toUpperCase()}`;
      const funderId = await resolveFunder(agency, `vic_grants_${r.source}`);
      if (!funderId) { skipped++; continue; }
      if (!APPLY) { inserted++; continue; }

      const fy = r.approval_date
        ? Number(String(r.approval_date).slice(0, 4))
        : (r.financial_year ? Number(r.financial_year.slice(0, 4)) : null);

      const { error: insErr } = await db.from('gs_relationships').insert({
        source_entity_id: funderId,
        target_entity_id: r.gs_entity_id,
        relationship_type: 'grant',
        dataset: `vic_grants_${r.source}`,
        amount: r.amount_aud,
        year: fy,
        source_url: r.source_url,
        confidence: 'reported',
        properties: { program_name: r.program_name?.slice(0, 500) },
      });
      if (insErr) skipped++;
      else inserted++;
    }

    offset += PAGE;
    if (rows.length < PAGE) break;
  }

  console.log(`  processed: ${processed} | inserted: ${inserted} | skipped: ${skipped}`);
  return { processed, inserted };
}

async function main() {
  const run = await logStart(db, 'bridge-funding-relationships', 'Bridge GrantConnect + VIC → Relationships');
  console.log('=== Bridge funding relationships ===');
  console.log(`  mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | source: ${sourceFilter}`);

  try {
    let totalProcessed = 0;
    let totalInserted = 0;

    if (sourceFilter === 'all' || sourceFilter === 'grantconnect') {
      const r = await bridgeGrantConnect();
      totalProcessed += r.processed;
      totalInserted += r.inserted;
    }
    if (sourceFilter === 'all' || sourceFilter === 'vic') {
      const r = await bridgeVic();
      totalProcessed += r.processed;
      totalInserted += r.inserted;
    }

    console.log(`\n=== Summary ===`);
    console.log(`  processed: ${totalProcessed} | inserted: ${totalInserted}`);
    await logComplete(db, run.id, { items_found: totalProcessed, items_new: totalInserted, status: 'success' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Fatal:', msg);
    await logFailed(db, run.id, msg).catch(() => {});
    process.exit(1);
  }
}

main();
