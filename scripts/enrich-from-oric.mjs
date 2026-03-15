#!/usr/bin/env node
/**
 * enrich-from-oric.mjs — ORIC registry enrichment for indigenous corps
 *
 * Two-phase:
 * 1. For gs_entities missing ABN: match by name to oric_corporations → backfill ABN + ICN
 * 2. For all indigenous_corp entities: backfill description, sector, metadata from ORIC
 *
 * Also stores ICN in entity_identifiers for future cross-referencing.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes('--dry-run');

// Normalize name for matching
function normName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(aboriginal|torres strait islander|corporation|incorporated|inc|ltd|limited|pty|co-operative|association|assoc)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDescription(oric) {
  let desc = '';

  if (oric.corporation_size) {
    desc += `${oric.corporation_size} Aboriginal and Torres Strait Islander corporation`;
  } else {
    desc += 'Aboriginal and Torres Strait Islander corporation';
  }

  if (oric.registered_on) {
    const year = new Date(oric.registered_on).getFullYear();
    if (year > 1800 && year < 2030) desc += `, registered ${year}`;
  }

  if (oric.status && oric.status !== 'Registered') {
    desc += ` (status: ${oric.status})`;
  }

  desc += '.';

  if (oric.industry_sectors && oric.industry_sectors.length > 0) {
    desc += ` Industry sectors: ${oric.industry_sectors.join(', ')}.`;
  }

  if (oric.enriched_description) {
    desc += ' ' + oric.enriched_description;
  }

  if (oric.enriched_community_served) {
    desc += ` Serves: ${oric.enriched_community_served}.`;
  }

  if (oric.state) {
    desc += ` Based in ${oric.state}.`;
  }

  return desc;
}

function deriveSector(oric) {
  if (!oric.industry_sectors) return null;
  const sectors = oric.industry_sectors.map(s => s.toLowerCase());
  if (sectors.some(s => s.includes('health'))) return 'health';
  if (sectors.some(s => s.includes('education') || s.includes('training'))) return 'education';
  if (sectors.some(s => s.includes('housing') || s.includes('construction'))) return 'housing';
  if (sectors.some(s => s.includes('art') || s.includes('culture'))) return 'culture';
  if (sectors.some(s => s.includes('land') || s.includes('environment'))) return 'land-management';
  if (sectors.some(s => s.includes('social') || s.includes('community'))) return 'community';
  if (sectors.some(s => s.includes('legal') || s.includes('justice'))) return 'justice';
  return 'community';
}

async function main() {
  console.log('=== ORIC Registry Enrichment ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  // Phase 1: ABN backfill via name matching
  console.log('\n--- Phase 1: ABN Backfill ---');

  // Get all ORIC records with ABNs (paginated)
  let oricWithAbn = [];
  let p1Offset = 0;
  while (true) {
    const { data: batch, error: oe1 } = await supabase
      .from('oric_corporations')
      .select('id, icn, name, abn, status')
      .not('abn', 'is', null)
      .range(p1Offset, p1Offset + 999)
      .order('id');
    if (oe1 || !batch?.length) break;
    oricWithAbn = oricWithAbn.concat(batch);
    p1Offset += batch.length;
    if (batch.length < 1000) break;
  }

  console.log(`ORIC records with ABN: ${oricWithAbn.length}`);

  // Build normalized name index
  const oricByNorm = {};
  for (const o of (oricWithAbn || [])) {
    const norm = normName(o.name);
    if (norm) oricByNorm[norm] = o;
  }

  // Get entities missing ABN
  let offset = 0;
  let abnsFilled = 0;

  while (true) {
    const { data: entities, error } = await supabase
      .from('gs_entities')
      .select('id, canonical_name')
      .eq('entity_type', 'indigenous_corp')
      .is('abn', null)
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error || !entities?.length) break;

    for (const e of entities) {
      const norm = normName(e.canonical_name);
      const match = oricByNorm[norm];
      if (!match) continue;

      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('gs_entities')
          .update({ abn: match.abn, updated_at: new Date().toISOString() })
          .eq('id', e.id);

        if (upErr) {
          console.error(`  ABN backfill error for ${e.canonical_name}: ${upErr.message}`);
          continue;
        }
      }
      abnsFilled++;
      if (abnsFilled <= 5) console.log(`  ABN: ${e.canonical_name} → ${match.abn}`);
    }

    offset += entities.length;
    if (entities.length < BATCH_SIZE) break;
  }
  console.log(`ABNs backfilled: ${abnsFilled}`);

  // Phase 2: Enrich all indigenous_corp entities from ORIC data
  console.log('\n--- Phase 2: ORIC Data Enrichment ---');

  // Load all ORIC records (paginated to avoid 1000-row limit)
  let allOric = [];
  let oricOffset = 0;
  while (true) {
    const { data: batch, error: oe2 } = await supabase
      .from('oric_corporations')
      .select('*')
      .range(oricOffset, oricOffset + 999)
      .order('id');
    if (oe2 || !batch?.length) break;
    allOric = allOric.concat(batch);
    oricOffset += batch.length;
    if (batch.length < 1000) break;
  }

  console.log(`Total ORIC records: ${allOric.length}`);

  const oricByNormAll = {};
  const oricByAbn = {};
  for (const o of (allOric || [])) {
    const norm = normName(o.name);
    if (norm) oricByNormAll[norm] = o;
    if (o.abn) oricByAbn[o.abn] = o;
  }

  offset = 0;
  let updated = 0;
  let descFilled = 0;
  let sectorFilled = 0;
  let icnStored = 0;

  while (true) {
    const { data: entities, error } = await supabase
      .from('gs_entities')
      .select('id, canonical_name, abn, description, sector, metadata, state, postcode')
      .eq('entity_type', 'indigenous_corp')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error || !entities?.length) break;

    for (const e of entities) {
      // Match by ABN first, then name
      let oric = e.abn ? oricByAbn[e.abn] : null;
      if (!oric) oric = oricByNormAll[normName(e.canonical_name)];
      if (!oric) continue;

      const updates = {};
      let changed = false;

      // Description
      if (!e.description) {
        const desc = buildDescription(oric);
        if (desc) {
          updates.description = desc;
          descFilled++;
          changed = true;
        }
      }

      // Sector
      if (!e.sector) {
        const sector = deriveSector(oric);
        if (sector) {
          updates.sector = sector;
          sectorFilled++;
          changed = true;
        }
      }

      // State/postcode
      if (!e.state && oric.state) { updates.state = oric.state; changed = true; }
      if (!e.postcode && oric.postcode) { updates.postcode = oric.postcode; changed = true; }

      // Metadata
      const meta = { ...(e.metadata || {}) };
      meta.oric = {
        icn: oric.icn,
        status: oric.status,
        corporation_size: oric.corporation_size,
        industry_sectors: oric.industry_sectors,
        registered_on: oric.registered_on,
        registered_with_acnc: oric.registered_with_acnc,
      };
      if (oric.enriched_focus_areas?.length) meta.oric.focus_areas = oric.enriched_focus_areas;
      if (oric.enriched_community_served) meta.oric.community_served = oric.enriched_community_served;
      updates.metadata = meta;
      updates.is_community_controlled = true;
      changed = true;

      if (!changed) continue;

      updates.updated_at = new Date().toISOString();

      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('gs_entities')
          .update(updates)
          .eq('id', e.id);

        if (upErr) {
          console.error(`  Error updating ${e.canonical_name}: ${upErr.message}`);
          continue;
        }

        // Store ICN in entity_identifiers
        if (oric.icn) {
          const { error: idErr } = await supabase
            .from('entity_identifiers')
            .upsert({
              entity_id: e.id,
              identifier_type: 'oric_icn',
              identifier_value: oric.icn,
              source: 'oric_registry'
            }, { onConflict: 'entity_id,identifier_type,identifier_value' });

          if (!idErr) icnStored++;
        }
      }

      updated++;
      if (updated % 500 === 0) {
        console.log(`  [${updated}] desc=${descFilled} sector=${sectorFilled} icn=${icnStored}`);
      }
    }

    offset += entities.length;
    if (entities.length < BATCH_SIZE) break;
  }

  console.log(`\n=== DONE ===`);
  console.log(`Phase 1 — ABNs backfilled: ${abnsFilled}`);
  console.log(`Phase 2 — Entities updated: ${updated}`);
  console.log(`Descriptions filled: ${descFilled}`);
  console.log(`Sectors filled: ${sectorFilled}`);
  console.log(`ICNs stored in identifiers: ${icnStored}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
