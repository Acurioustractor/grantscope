#!/usr/bin/env node
/**
 * enrich-from-acnc.mjs — Registry-anchored enrichment (Step 1)
 *
 * For every gs_entity with an ABN matching acnc_charities:
 *   - Backfill description from ACNC purposes/beneficiaries (if missing)
 *   - Backfill website (if missing)
 *   - Backfill charity_size, sector tags, beneficiary flags into metadata
 *   - Set is_community_controlled from ben_aboriginal_tsi
 *   - Backfill state/postcode if missing
 *
 * Zero scraping. Pure registry data. Should enrich ~64K entities.
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
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

// Build a human-readable description from ACNC purpose and beneficiary flags
function buildDescription(acnc) {
  const purposes = [];
  if (acnc.purpose_education) purposes.push('education');
  if (acnc.purpose_health) purposes.push('health');
  if (acnc.purpose_social_welfare) purposes.push('social welfare');
  if (acnc.purpose_culture) purposes.push('culture');
  if (acnc.purpose_reconciliation) purposes.push('reconciliation');
  if (acnc.purpose_human_rights) purposes.push('human rights');
  if (acnc.purpose_animal_welfare) purposes.push('animal welfare');
  if (acnc.purpose_natural_environment) purposes.push('environment');
  if (acnc.purpose_law_policy) purposes.push('law and policy');
  if (acnc.purpose_religion) purposes.push('religion');
  if (acnc.purpose_general_public) purposes.push('general public benefit');
  if (acnc.purpose_security) purposes.push('security and safety');

  const beneficiaries = [];
  if (acnc.ben_aboriginal_tsi) beneficiaries.push('Aboriginal and Torres Strait Islander peoples');
  if (acnc.ben_children) beneficiaries.push('children');
  if (acnc.ben_youth) beneficiaries.push('young people');
  if (acnc.ben_aged) beneficiaries.push('older people');
  if (acnc.ben_families) beneficiaries.push('families');
  if (acnc.ben_people_with_disabilities) beneficiaries.push('people with disabilities');
  if (acnc.ben_financially_disadvantaged) beneficiaries.push('financially disadvantaged people');
  if (acnc.ben_migrants_refugees) beneficiaries.push('migrants and refugees');
  if (acnc.ben_people_at_risk_of_homelessness) beneficiaries.push('people at risk of homelessness');
  if (acnc.ben_pre_post_release) beneficiaries.push('people pre/post release from prison');
  if (acnc.ben_people_with_chronic_illness) beneficiaries.push('people with chronic illness');
  if (acnc.ben_victims_of_crime) beneficiaries.push('victims of crime');
  if (acnc.ben_unemployed) beneficiaries.push('unemployed people');
  if (acnc.ben_veterans) beneficiaries.push('veterans');
  if (acnc.ben_rural_regional_remote) beneficiaries.push('rural, regional and remote communities');
  if (acnc.ben_lgbtiqa) beneficiaries.push('LGBTIQA+ people');
  if (acnc.ben_ethnic_groups) beneficiaries.push('ethnic groups');
  if (acnc.ben_victims_of_disaster) beneficiaries.push('victims of disaster');

  if (purposes.length === 0 && beneficiaries.length === 0) return null;

  let desc = '';
  if (acnc.charity_size) {
    desc += `${acnc.charity_size.charAt(0).toUpperCase() + acnc.charity_size.slice(1)} charity`;
  } else {
    desc += 'Registered charity';
  }

  if (acnc.pbi) desc += ' (Public Benevolent Institution)';
  if (acnc.date_established) {
    const year = new Date(acnc.date_established).getFullYear();
    if (year > 1800 && year < 2030) desc += `, established ${year}`;
  }
  desc += '.';

  if (purposes.length > 0) {
    desc += ` Purposes: ${purposes.join(', ')}.`;
  }
  if (beneficiaries.length > 0) {
    desc += ` Serves: ${beneficiaries.join(', ')}.`;
  }

  // Operating states
  const states = [];
  if (acnc.operates_in_nsw) states.push('NSW');
  if (acnc.operates_in_vic) states.push('VIC');
  if (acnc.operates_in_qld) states.push('QLD');
  if (acnc.operates_in_sa) states.push('SA');
  if (acnc.operates_in_wa) states.push('WA');
  if (acnc.operates_in_tas) states.push('TAS');
  if (acnc.operates_in_act) states.push('ACT');
  if (acnc.operates_in_nt) states.push('NT');
  if (states.length > 0 && states.length < 8) {
    desc += ` Operates in: ${states.join(', ')}.`;
  } else if (states.length === 8) {
    desc += ' Operates nationally.';
  }

  return desc;
}

// Build sector from ACNC purposes
function deriveSector(acnc) {
  if (acnc.purpose_health) return 'health';
  if (acnc.purpose_education) return 'education';
  if (acnc.purpose_social_welfare) return 'social-services';
  if (acnc.purpose_reconciliation) return 'reconciliation';
  if (acnc.purpose_law_policy) return 'justice';
  if (acnc.purpose_human_rights) return 'human-rights';
  if (acnc.purpose_culture) return 'culture';
  if (acnc.purpose_natural_environment) return 'environment';
  if (acnc.purpose_animal_welfare) return 'animal-welfare';
  if (acnc.purpose_religion) return 'religion';
  if (acnc.purpose_general_public) return 'community';
  return null;
}

// Build metadata object from ACNC
function buildMetadata(acnc, existingMeta) {
  const meta = { ...(existingMeta || {}) };

  meta.acnc = {
    charity_size: acnc.charity_size,
    pbi: acnc.pbi || false,
    hpc: acnc.hpc || false,
    is_foundation: acnc.is_foundation || false,
    is_social_enterprise: acnc.is_social_enterprise || false,
    is_oric_corporation: acnc.is_oric_corporation || false,
    oric_icn: acnc.oric_icn || null,
    registration_date: acnc.registration_date,
    date_established: acnc.date_established,
    responsible_persons: acnc.number_of_responsible_persons,
  };

  // Beneficiary flags for filtering
  const bens = [];
  if (acnc.ben_aboriginal_tsi) bens.push('aboriginal_tsi');
  if (acnc.ben_children) bens.push('children');
  if (acnc.ben_youth) bens.push('youth');
  if (acnc.ben_aged) bens.push('aged');
  if (acnc.ben_families) bens.push('families');
  if (acnc.ben_people_with_disabilities) bens.push('disabilities');
  if (acnc.ben_financially_disadvantaged) bens.push('financially_disadvantaged');
  if (acnc.ben_migrants_refugees) bens.push('migrants_refugees');
  if (acnc.ben_people_at_risk_of_homelessness) bens.push('homelessness');
  if (acnc.ben_pre_post_release) bens.push('pre_post_release');
  if (acnc.ben_people_with_chronic_illness) bens.push('chronic_illness');
  if (acnc.ben_victims_of_crime) bens.push('victims_of_crime');
  if (acnc.ben_unemployed) bens.push('unemployed');
  if (acnc.ben_veterans) bens.push('veterans');
  if (acnc.ben_rural_regional_remote) bens.push('rural_regional_remote');
  if (acnc.ben_lgbtiqa) bens.push('lgbtiqa');
  if (bens.length > 0) meta.beneficiary_groups = bens;

  // Purpose tags
  const purps = [];
  if (acnc.purpose_education) purps.push('education');
  if (acnc.purpose_health) purps.push('health');
  if (acnc.purpose_social_welfare) purps.push('social_welfare');
  if (acnc.purpose_culture) purps.push('culture');
  if (acnc.purpose_reconciliation) purps.push('reconciliation');
  if (acnc.purpose_human_rights) purps.push('human_rights');
  if (acnc.purpose_law_policy) purps.push('law_policy');
  if (acnc.purpose_natural_environment) purps.push('environment');
  if (purps.length > 0) meta.purpose_tags = purps;

  return meta;
}

async function main() {
  console.log('=== ACNC Registry Enrichment ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);

  // Count matchable
  const { count } = await supabase
    .from('gs_entities')
    .select('id', { count: 'exact', head: true })
    .not('abn', 'is', null);

  console.log(`\nTotal entities with ABN: ${count}`);

  let offset = 0;
  let updated = 0;
  let descFilled = 0;
  let websiteFilled = 0;
  let sectorFilled = 0;
  let metaFilled = 0;
  let communityControlled = 0;
  let skipped = 0;
  const total = LIMIT || Infinity;

  while (updated + skipped < total) {
    // Fetch batch of entities with ABNs
    const batchLimit = Math.min(BATCH_SIZE, total - (updated + skipped));
    const { data: entities, error: entErr } = await supabase
      .from('gs_entities')
      .select('id, abn, canonical_name, description, website, sector, state, postcode, metadata, is_community_controlled')
      .not('abn', 'is', null)
      .range(offset, offset + batchLimit - 1)
      .order('id');

    if (entErr) { console.error('Entity fetch error:', entErr.message); break; }
    if (!entities || entities.length === 0) break;

    // Get matching ACNC records
    const abns = entities.map(e => e.abn).filter(Boolean);
    const { data: acncRecords, error: acncErr } = await supabase
      .from('acnc_charities')
      .select('*')
      .in('abn', abns);

    if (acncErr) { console.error('ACNC fetch error:', acncErr.message); break; }

    // Index by ABN
    const acncByAbn = {};
    for (const a of (acncRecords || [])) {
      acncByAbn[a.abn] = a;
    }

    // Process each entity
    for (const entity of entities) {
      const acnc = acncByAbn[entity.abn];
      if (!acnc) { skipped++; continue; }

      const updates = {};
      let changed = false;

      // Description
      if (!entity.description) {
        const desc = buildDescription(acnc);
        if (desc) {
          updates.description = desc;
          descFilled++;
          changed = true;
        }
      }

      // Website
      if (!entity.website && acnc.website) {
        updates.website = acnc.website;
        websiteFilled++;
        changed = true;
      }

      // Sector
      if (!entity.sector) {
        const sector = deriveSector(acnc);
        if (sector) {
          updates.sector = sector;
          sectorFilled++;
          changed = true;
        }
      }

      // State/postcode backfill
      if (!entity.state && acnc.state) updates.state = acnc.state;
      if (!entity.postcode && acnc.postcode) updates.postcode = acnc.postcode;

      // Community controlled flag — only set for entities with Indigenous-related names
      // (not just charities that list Aboriginal/TSI as beneficiaries — Red Cross serves
      // Indigenous people but isn't community-controlled BY them)
      if (!entity.is_community_controlled && acnc.ben_aboriginal_tsi && entity.entity_type === 'indigenous_corp') {
        updates.is_community_controlled = true;
        communityControlled++;
        changed = true;
      }

      // Metadata — always enrich with ACNC data
      const meta = buildMetadata(acnc, entity.metadata);
      updates.metadata = meta;
      metaFilled++;
      changed = true;

      if (!changed) { skipped++; continue; }

      updates.updated_at = new Date().toISOString();

      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('gs_entities')
          .update(updates)
          .eq('id', entity.id);

        if (upErr) {
          console.error(`  Error updating ${entity.canonical_name}: ${upErr.message}`);
          continue;
        }
      }

      updated++;

      if (updated % 500 === 0) {
        console.log(`  [${updated}] desc=${descFilled} web=${websiteFilled} sector=${sectorFilled} meta=${metaFilled} community=${communityControlled}`);
      }
    }

    offset += entities.length;

    if (entities.length < batchLimit) break; // last page
  }

  console.log(`\n=== DONE ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no ACNC match): ${skipped}`);
  console.log(`Descriptions filled: ${descFilled}`);
  console.log(`Websites filled: ${websiteFilled}`);
  console.log(`Sectors filled: ${sectorFilled}`);
  console.log(`Metadata enriched: ${metaFilled}`);
  console.log(`Community-controlled flagged: ${communityControlled}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
