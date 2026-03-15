#!/usr/bin/env node
/**
 * link-alma-via-registry.mjs — ALMA → Entity resolution (Step 3 + 4)
 *
 * Multi-strategy linking:
 * 1. Government mapping table (hardcoded for state departments)
 * 2. Exact/normalized match against ACNC names → ABN → gs_entity
 * 3. Exact/normalized match against ORIC names → gs_entity
 * 4. Exact/normalized match directly against gs_entities canonical_name
 * 5. DB-side ILIKE substring search on gs_entities
 *
 * Also creates government body entities that don't exist yet.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');

// Government department mappings — create entities if they don't exist
const GOVT_ENTITIES = [
  { name: 'Queensland Department of Youth Justice', state: 'QLD', aliases: ['Department of Youth Justice and Victim Support'] },
  { name: 'NSW Youth Justice', state: 'NSW', aliases: ['Youth Justice NSW'] },
  { name: 'Crime Prevention Victoria', state: 'VIC', aliases: ['Community Crime Prevention Victoria'] },
  { name: 'Victorian Department of Justice and Community Safety', state: 'VIC', aliases: ['Victorian Department of Justice'] },
  { name: 'SA Department for Correctional Services', state: 'SA' },
  { name: 'NT Department of Attorney-General and Justice', state: 'NT' },
  { name: 'WA Department of Justice', state: 'WA' },
  { name: 'Tasmania Department of Justice', state: 'TAS' },
  { name: 'ACT Justice and Community Safety Directorate', state: 'ACT' },
];

// Names that are NOT organisations — skip these
const SKIP_PATTERNS = [
  /^multiple/i,
  /^various/i,
  /^several/i,
  /^community organisations?$/i,
  /^NGO providers?$/i,
  /^state and territory/i,
  /^australian (federal )?government/i,
  /^courts? of /i,
  /\+/,  // "Courts of Victoria + Aboriginal communities"
];

function shouldSkip(name) {
  return SKIP_PATTERNS.some(p => p.test(name));
}

function normName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|ltd|limited|pty|co-operative|cooperative|association|assoc|foundation|trust|the|of|and|for)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadPaginatedData(table, select, filters = {}) {
  let all = [];
  let offset = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + 999).order('id' in filters ? 'id' : Object.keys(filters)[0] || 'id', { ascending: true });

    // Apply filters - simple approach
    const { data: batch, error } = await supabase
      .from(table)
      .select(select)
      .range(offset, offset + 999);

    if (error || !batch?.length) break;
    all = all.concat(batch);
    offset += batch.length;
    if (batch.length < 1000) break;
  }
  return all;
}

async function main() {
  console.log('=== ALMA → Entity Resolution ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Get ALL unlinked ALMA interventions
  const { data: unlinked } = await supabase
    .from('alma_interventions')
    .select('id, name, operating_organization')
    .is('gs_entity_id', null)
    .order('id');

  const withOrg = unlinked.filter(a => a.operating_organization?.trim().length > 0);
  const noOrg = unlinked.filter(a => !a.operating_organization?.trim());
  console.log(`Total unlinked: ${unlinked.length} (${withOrg.length} with org, ${noOrg.length} without)`);

  // Step 1: Ensure government entities exist
  console.log('\n--- Step 1: Government Entity Setup ---');
  const govtEntityMap = {}; // orgName → entityId

  for (const govt of GOVT_ENTITIES) {
    // Check if entity exists
    const { data: existing } = await supabase
      .from('gs_entities')
      .select('id, canonical_name')
      .ilike('canonical_name', `%${govt.name}%`)
      .limit(1);

    if (existing?.length) {
      govtEntityMap[govt.name] = existing[0].id;
      if (govt.aliases) govt.aliases.forEach(a => govtEntityMap[a] = existing[0].id);
      console.log(`  Found: ${govt.name} → ${existing[0].id}`);
    } else if (!DRY_RUN) {
      // Create government entity
      const gsId = `GS-GOV-${govt.state}-${Date.now()}`;
      const { data: created, error } = await supabase
        .from('gs_entities')
        .insert({
          entity_type: 'government_body',
          canonical_name: govt.name,
          gs_id: gsId,
          state: govt.state,
          sector: 'justice',
          description: `${govt.state} state government department responsible for justice and youth justice services.`,
          source_datasets: ['alma'],
          confidence: 'reported',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  Error creating ${govt.name}: ${error.message}`);
      } else {
        govtEntityMap[govt.name] = created.id;
        if (govt.aliases) govt.aliases.forEach(a => govtEntityMap[a] = created.id);
        console.log(`  Created: ${govt.name} → ${created.id}`);
      }
    } else {
      console.log(`  Would create: ${govt.name}`);
      govtEntityMap[govt.name] = 'dry-run-id';
      if (govt.aliases) govt.aliases.forEach(a => govtEntityMap[a] = 'dry-run-id');
    }
  }

  // Step 2: Load ACNC name index
  console.log('\n--- Step 2: Loading Registry Indexes ---');
  const acncRecords = await loadPaginatedData('acnc_charities', 'abn, name, other_names');
  console.log(`ACNC records: ${acncRecords.length}`);

  const acncByNorm = {};
  for (const a of acncRecords) {
    const norm = normName(a.name);
    if (norm) acncByNorm[norm] = a.abn;
    if (a.other_names) {
      for (const alt of a.other_names.split(/[,;|]/)) {
        const n = normName(alt);
        if (n && n.length > 4) acncByNorm[n] = a.abn;
      }
    }
  }

  // Load ORIC name index
  const oricRecords = await loadPaginatedData('oric_corporations', 'name, abn, icn');
  console.log(`ORIC records: ${oricRecords.length}`);

  const oricByNorm = {};
  for (const o of oricRecords) {
    const norm = normName(o.name);
    if (norm) oricByNorm[norm] = o;
  }

  // Load entity ABN → id index
  let entityByAbn = {};
  let entOffset = 0;
  while (true) {
    const { data: batch, error } = await supabase
      .from('gs_entities')
      .select('id, abn')
      .not('abn', 'is', null)
      .range(entOffset, entOffset + 999)
      .order('id');
    if (error || !batch?.length) break;
    for (const e of batch) entityByAbn[e.abn] = e.id;
    entOffset += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`Entity ABN index: ${Object.keys(entityByAbn).length}`);

  // Step 3: Match each unlinked intervention
  console.log('\n--- Step 3: Matching ---');
  let linked = 0;
  let byMethod = { govt: 0, acnc_exact: 0, oric_exact: 0, entity_ilike: 0 };
  let skipped = 0;
  let noMatch = 0;
  const unmatched = [];

  for (const alma of withOrg) {
    const orgName = alma.operating_organization.trim();

    if (shouldSkip(orgName)) {
      skipped++;
      continue;
    }

    let entityId = null;
    let method = '';

    // 1. Government mapping
    if (govtEntityMap[orgName]) {
      entityId = govtEntityMap[orgName];
      method = 'govt';
    }

    // 2. ACNC exact/normalized match
    if (!entityId) {
      const norm = normName(orgName);
      const abn = acncByNorm[norm];
      if (abn && entityByAbn[abn]) {
        entityId = entityByAbn[abn];
        method = 'acnc_exact';
      }
    }

    // 3. ORIC exact/normalized match
    if (!entityId) {
      const norm = normName(orgName);
      const oric = oricByNorm[norm];
      if (oric?.abn && entityByAbn[oric.abn]) {
        entityId = entityByAbn[oric.abn];
        method = 'oric_exact';
      }
    }

    // 4. Direct gs_entities ILIKE search (catches things like "NACCHO", "WestJustice", etc)
    if (!entityId) {
      const searchTerm = orgName.replace(/[%_]/g, '');
      if (searchTerm.length >= 4) {
        const { data: matches } = await supabase
          .from('gs_entities')
          .select('id, canonical_name')
          .ilike('canonical_name', `%${searchTerm}%`)
          .limit(3);

        if (matches?.length === 1) {
          // Single match — confident
          entityId = matches[0].id;
          method = 'entity_ilike';
        } else if (matches?.length > 1) {
          // Multiple matches — try exact
          const exact = matches.find(m => m.canonical_name.toLowerCase() === orgName.toLowerCase());
          if (exact) {
            entityId = exact.id;
            method = 'entity_ilike';
          }
        }
      }
    }

    if (entityId && entityId !== 'dry-run-id') {
      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('alma_interventions')
          .update({ gs_entity_id: entityId, updated_at: new Date().toISOString() })
          .eq('id', alma.id);

        if (upErr) {
          console.error(`  Error linking "${alma.name}": ${upErr.message}`);
          continue;
        }
      }
      linked++;
      byMethod[method]++;
      if (linked <= 30) {
        console.log(`  ✓ [${method}] "${orgName}"`);
      }
    } else if (entityId === 'dry-run-id') {
      linked++;
      byMethod[method]++;
      console.log(`  ✓ [${method}] "${orgName}" (dry-run)`);
    } else {
      noMatch++;
      unmatched.push(orgName);
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Linked: ${linked}`);
  console.log(`  govt mapping: ${byMethod.govt}`);
  console.log(`  ACNC exact: ${byMethod.acnc_exact}`);
  console.log(`  ORIC exact: ${byMethod.oric_exact}`);
  console.log(`  entity ILIKE: ${byMethod.entity_ilike}`);
  console.log(`Skipped (generic): ${skipped}`);
  console.log(`No match: ${noMatch}`);

  // Calculate new total
  const { count: newLinked } = await supabase
    .from('alma_interventions')
    .select('id', { count: 'exact', head: true })
    .not('gs_entity_id', 'is', null);
  console.log(`\nTotal ALMA linked (before + new): ${newLinked} / ${unlinked.length + (newLinked || 0)}`);

  if (unmatched.length > 0) {
    console.log(`\n--- Unmatched (${unmatched.length}) ---`);
    for (const u of unmatched.slice(0, 40)) {
      console.log(`  • ${u}`);
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
