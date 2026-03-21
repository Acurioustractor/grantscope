#!/usr/bin/env node

/**
 * ALMA Entity Linker v4 — Comprehensive multi-strategy linkage
 *
 * Strategy:
 *   Phase 0: Data quality — flag junk records (URLs, SA Health, Raising Children Network, etc.)
 *   Phase 1: State govt linkage — link generated seed data to state justice department entities
 *   Phase 2: Org-in-name extraction — parse org names from intervention names
 *   Phase 3: Parent org resolution — extract parent orgs from program names
 *   Phase 4: ABN cross-ref — ACNC other_names + ORIC fuzzy match via pg_trgm
 *   Phase 5: Direct entity name match — fuzzy match remaining org names to gs_entities
 *
 * Usage:
 *   node --env-file=.env scripts/link-alma-v4.mjs [--apply] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ─── Phase 0: Data Quality — flag junk records ────────────────────────────────

async function phase0_flagJunk() {
  log('=== Phase 0: Flag junk/non-justice records ===');

  // Patterns that indicate non-justice content scraped in error
  const junkPatterns = [
    // SA Health aged care / rehabilitation pages
    `name LIKE '%| SA Health%'`,
    `name LIKE '%services at SALHN%'`,
    `name LIKE '%SALHN | SA Health%'`,
    `name LIKE '%sahealth.sa.gov%'`,
    // Parenting / child development sites
    `name LIKE '%| Raising Children%'`,
    `name LIKE '%| Parenting SA%'`,
    // News articles, not interventions
    `name LIKE '%| The Guardian%'`,
    `name LIKE '%ABC listen%'`,
    // URLs stored as names
    `name LIKE 'http%'`,
    // Broken scrapes
    `name LIKE 'Page not found%'`,
    `name LIKE '404 page%'`,
    // Arts grants, not justice
    `name LIKE '%| Office for the Arts%'`,
    // AIHW overview pages
    `name LIKE '%Overview - Australian Institute%'`,
    // Native Title cultural heritage (not justice interventions)
    `name LIKE '%SA Native Title%'`,
    // Generic government pages
    `name LIKE '%Department of Health, Disability and Ageing%'`,
  ];

  const whereClause = junkPatterns.join(' OR ');

  // Get junk record IDs via exec_sql
  const { data: junkRows } = await db.rpc('exec_sql', {
    query: `SELECT id FROM alma_interventions WHERE (${whereClause}) AND (review_status IS NULL OR review_status != 'flagged_junk')`
  });
  const count = junkRows?.length || 0;
  log(`  Found ${count} junk records to flag`);

  if (APPLY && count > 0) {
    const ids = junkRows.map(r => r.id);
    // Batch update in chunks
    let flagged = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await db
        .from('alma_interventions')
        .update({ review_status: 'flagged_junk', updated_at: new Date().toISOString() })
        .in('id', chunk);
      if (!error) flagged += chunk.length;
      else log(`  Flag error: ${error.message}`);
    }
    log(`  Flagged ${flagged} records as junk`);
    return flagged;
  }

  return count;
}

// ─── Phase 1: Link generated seed data to state government entities ──────────

async function phase1_linkSeedData() {
  log('=== Phase 1: Link generated seed data to state govt entities ===');

  // State → government entity name mapping
  const stateGovtNames = {
    'QLD': ['Department of Youth Justice', 'Queensland Department of Youth Justice'],
    'NSW': ['NSW Youth Justice', 'Youth Justice NSW', 'NSW Department of Communities and Justice'],
    'VIC': ['Victorian Department of Justice and Community Safety', 'Crime Prevention Victoria'],
    'SA': ['SA Department for Correctional Services', 'SA Department of Human Services'],
    'WA': ['WA Department of Justice', 'WA Department of Communities'],
    'TAS': ['Tasmania Department of Justice', 'Department of Education, Children and Young People Tasmania'],
    'NT': ['NT Department of Attorney-General and Justice', 'Territory Families'],
    'ACT': ['ACT Justice and Community Safety Directorate'],
  };

  let linked = 0;

  for (const [state, govtNames] of Object.entries(stateGovtNames)) {
    // Find the state govt entity
    let entityId = null;
    for (const name of govtNames) {
      const { data: entities } = await db
        .from('gs_entities')
        .select('id, canonical_name')
        .ilike('canonical_name', `%${name}%`)
        .limit(1);

      if (entities?.length) {
        entityId = entities[0].id;
        if (VERBOSE) log(`  ${state}: found "${entities[0].canonical_name}"`);
        break;
      }
    }

    if (!entityId) {
      if (VERBOSE) log(`  ${state}: no govt entity found, skipping`);
      continue;
    }

    // Count unlinked generated interventions for this state
    const { data: unlinked } = await db.rpc('exec_sql', {
      query: `SELECT id FROM alma_interventions WHERE gs_entity_id IS NULL AND metadata->>'generated' = 'true' AND metadata->>'state' = '${state}'`
    });

    if (!unlinked?.length) {
      if (VERBOSE) log(`  ${state}: no unlinked seed data`);
      continue;
    }

    log(`  ${state}: ${unlinked.length} seed records → entity ${entityId}`);

    if (APPLY) {
      const ids = unlinked.map(u => u.id);
      // Batch update in chunks of 100
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await db
          .from('alma_interventions')
          .update({ gs_entity_id: entityId, updated_at: new Date().toISOString() })
          .in('id', chunk);
        if (error) log(`  Error: ${error.message}`);
        else linked += chunk.length;
      }
    } else {
      linked += unlinked.length;
    }
  }

  log(`  Linked ${linked} seed records to state govt entities${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Phase 2: Extract org names from intervention names ──────────────────────

async function phase2_orgInName() {
  log('=== Phase 2: Extract org names from intervention names ===');

  // Get unlinked interventions with org-like names (contain known separators or known org names)
  const { data: unlinked } = await db
    .from('alma_interventions')
    .select('id, name, operating_organization')
    .is('gs_entity_id', null)
    .or('review_status.is.null,review_status.neq.flagged_junk');

  if (!unlinked?.length) {
    log('  No unlinked interventions');
    return 0;
  }

  // Known org name patterns that appear in intervention names
  const knownOrgs = [
    { pattern: /Aboriginal Legal Service/i, search: 'Aboriginal Legal Service' },
    { pattern: /NAAJA/i, search: 'NAAJA' },
    { pattern: /NATSILS/i, search: 'NATSILS' },
    { pattern: /NACCHO/i, search: 'NACCHO' },
    { pattern: /Jesuit Social Services/i, search: 'Jesuit Social Services' },
    { pattern: /Anglicare/i, search: 'Anglicare' },
    { pattern: /ATSILS/i, search: 'ATSILS' },
    { pattern: /Wirrpanda Foundation/i, search: 'Wirrpanda Foundation' },
    { pattern: /Maranguka/i, search: 'Maranguka' },
    { pattern: /Just Reinvest NSW/i, search: 'Just Reinvest' },
    { pattern: /CAYLUS/i, search: 'CAYLUS' },
    { pattern: /Tangentyere/i, search: 'Tangentyere' },
    { pattern: /WestJustice/i, search: 'WestJustice' },
    { pattern: /VALS/i, search: 'Victorian Aboriginal Legal Service' },
    { pattern: /Balund-a/i, search: 'Balund-a' },
    { pattern: /Desert Pea/i, search: 'Desert Pea' },
    { pattern: /PCYC/i, search: 'PCYC' },
    { pattern: /YMCA/i, search: 'YMCA' },
    { pattern: /Salvation Army/i, search: 'Salvation Army' },
    { pattern: /Mission Australia/i, search: 'Mission Australia' },
    { pattern: /Smith Family/i, search: 'Smith Family' },
    { pattern: /Beyondblue|Beyond Blue/i, search: 'Beyond Blue' },
    { pattern: /Headspace/i, search: 'Headspace' },
    { pattern: /Legal Aid/i, search: 'Legal Aid' },
    { pattern: /Change the Record/i, search: 'Change the Record' },
    { pattern: /Urapuntja/i, search: 'Urapuntja' },
    { pattern: /Community Justice Centre/i, search: 'Community Justice Centre' },
    { pattern: /Ngurratjuta/i, search: 'Ngurratjuta' },
    { pattern: /Anindilyakwa/i, search: 'Anindilyakwa' },
  ];

  let linked = 0;
  const entityCache = new Map(); // search term → entity id

  for (const intv of unlinked) {
    const name = intv.name?.trim();
    const orgName = intv.operating_organization?.trim();
    if (!name) continue;

    // Check against known org patterns
    for (const { pattern, search } of knownOrgs) {
      if (pattern.test(name) || (orgName && pattern.test(orgName))) {
        // Look up entity (with cache)
        if (!entityCache.has(search)) {
          const { data: entities } = await db
            .from('gs_entities')
            .select('id, canonical_name')
            .ilike('canonical_name', `%${search}%`)
            .limit(5);

          if (entities?.length === 1) {
            entityCache.set(search, entities[0].id);
          } else if (entities?.length > 1) {
            // Pick shortest name (most specific match)
            const best = entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
            entityCache.set(search, best.id);
          } else {
            entityCache.set(search, null);
          }
        }

        const entityId = entityCache.get(search);
        if (entityId) {
          if (VERBOSE) log(`  "${name}" → "${search}" → entity`);
          if (APPLY) {
            const { error } = await db
              .from('alma_interventions')
              .update({ gs_entity_id: entityId, updated_at: new Date().toISOString() })
              .eq('id', intv.id);
            if (!error) linked++;
          } else {
            linked++;
          }
          break; // First match wins
        }
      }
    }
  }

  log(`  Linked ${linked} interventions via name extraction${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Phase 3: Parent org resolution ──────────────────────────────────────────

async function phase3_parentOrg() {
  log('=== Phase 3: Parent org resolution from program names ===');

  // Patterns: "Program Name – Parent Org Location" or "Parent Org Program Name"
  const parentOrgPatterns = [
    // "Blue EDGE – YMCA Acacia Ridge" → YMCA
    { pattern: /YMCA/i, org: 'YMCA' },
    { pattern: /PCYC/i, org: 'PCYC' },
    { pattern: /Salvation Army/i, org: 'Salvation Army' },
    { pattern: /Anglicare/i, org: 'Anglicare' },
    { pattern: /Mission Australia/i, org: 'Mission Australia' },
    { pattern: /YFS/i, org: 'YFS' },
    { pattern: /Uniting/i, org: 'UnitingCare' },
    { pattern: /Life Without Barriers/i, org: 'Life Without Barriers' },
    { pattern: /Amnesty/i, org: 'Amnesty International' },
    // State-specific youth justice services
    { pattern: /Cleveland Youth Detention/i, org: 'Queensland Department of Youth Justice' },
    { pattern: /West Moreton Youth Detention/i, org: 'Queensland Department of Youth Justice' },
    { pattern: /Ashley Youth Detention/i, org: 'Tasmania Department of Justice' },
    { pattern: /Alice Springs Youth Detention/i, org: 'NT Department of Attorney-General and Justice' },
    { pattern: /Banksia Hill/i, org: 'WA Department of Justice' },
    // Government programs
    { pattern: /Free Kindy Program/i, org: 'Queensland Department of Education' },
    { pattern: /Transition 2 Success/i, org: 'Queensland Department of Youth Justice' },
  ];

  // Get unlinked interventions with operating_organization
  const { data: unlinked } = await db
    .from('alma_interventions')
    .select('id, operating_organization, name')
    .is('gs_entity_id', null)
    .or('review_status.is.null,review_status.neq.flagged_junk');

  if (!unlinked?.length) return 0;

  let linked = 0;
  const entityCache = new Map();

  for (const intv of unlinked) {
    const text = intv.operating_organization?.trim() || intv.name?.trim() || '';
    if (!text) continue;

    for (const { pattern, org } of parentOrgPatterns) {
      if (pattern.test(text)) {
        if (!entityCache.has(org)) {
          const { data: entities } = await db
            .from('gs_entities')
            .select('id, canonical_name')
            .ilike('canonical_name', `%${org}%`)
            .limit(5);

          if (entities?.length) {
            const best = entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
            entityCache.set(org, best.id);
          } else {
            entityCache.set(org, null);
          }
        }

        const entityId = entityCache.get(org);
        if (entityId) {
          if (VERBOSE) log(`  "${text}" → parent "${org}" → entity`);
          if (APPLY) {
            const { error } = await db
              .from('alma_interventions')
              .update({ gs_entity_id: entityId, updated_at: new Date().toISOString() })
              .eq('id', intv.id);
            if (!error) linked++;
          } else {
            linked++;
          }
          break;
        }
      }
    }
  }

  log(`  Linked ${linked} via parent org resolution${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Phase 3b: Manual hardcoded mappings for known ALMA orgs ─────────────────

async function phase3b_manualMappings() {
  log('=== Phase 3b: Manual hardcoded org mappings ===');

  // Known ALMA org names → entity search OR entity creation data
  // For orgs not in gs_entities, we create them using ACNC/known data
  const manualMap = [
    // Orgs with known ABN from ACNC — will create entity if missing
    { alma_org: 'NACCHO', canonical_name: 'National Aboriginal Community Controlled Health Organisation', abn: '89078949710', entity_type: 'charity', sector: 'health', state: 'ACT' },
    { alma_org: 'Wirrpanda Foundation', canonical_name: 'Wirrpanda Foundation', entity_type: 'foundation', sector: 'community', state: 'WA' },
    { alma_org: 'WestJustice', canonical_name: 'WestJustice - Western Community Legal Centre', entity_type: 'charity', sector: 'justice', state: 'VIC' },
    { alma_org: 'Change the Record', canonical_name: 'Change the Record Coalition', entity_type: 'charity', sector: 'justice', state: 'ACT' },
    { alma_org: 'ATSILS Tasmania', canonical_name: 'Aboriginal and Torres Strait Islander Legal Service Tasmania', entity_type: 'charity', sector: 'justice', state: 'TAS' },
    { alma_org: 'Community Justice Centres NSW', canonical_name: 'Community Justice Centres NSW', entity_type: 'government_body', sector: 'justice', state: 'NSW' },
    { alma_org: 'Koorie Youth Council', canonical_name: 'Koorie Youth Council', entity_type: 'charity', sector: 'community', state: 'VIC' },
    { alma_org: 'PICC', canonical_name: 'Perth Inner City Community', entity_type: 'charity', sector: 'community', state: 'WA' },
    { alma_org: 'Ceduna Justice Reinvestment', canonical_name: 'Ceduna Justice Reinvestment Initiative', entity_type: 'charity', sector: 'justice', state: 'SA' },
    { alma_org: 'Njamarleya Aboriginal Corporation', canonical_name: 'Njamarleya Aboriginal Corporation', entity_type: 'indigenous_corp', sector: 'community', state: 'NT', is_community_controlled: true },
    { alma_org: 'Balund-a Aboriginal Corporation', canonical_name: 'Balund-a Aboriginal Corporation', entity_type: 'indigenous_corp', sector: 'justice', state: 'NSW', is_community_controlled: true },
    { alma_org: 'Marr Mooditj Foundation', canonical_name: 'Marr Mooditj Foundation', entity_type: 'foundation', sector: 'health', state: 'WA', is_community_controlled: true },
    { alma_org: 'Yabun Panjoo Elders', canonical_name: 'Yabun Panjoo Elders', entity_type: 'indigenous_corp', sector: 'community', state: 'NSW', is_community_controlled: true },
    { alma_org: 'Made by Mob', canonical_name: 'Made by Mob', entity_type: 'indigenous_corp', sector: 'community', state: 'QLD', is_community_controlled: true },
    { alma_org: 'Flame Project', canonical_name: 'Flame Project', entity_type: 'charity', sector: 'community', state: 'QLD' },
    { alma_org: 'Oochiumpa Youth Services', canonical_name: 'Oochiumpa Youth Services', entity_type: 'indigenous_corp', sector: 'community', state: 'QLD', is_community_controlled: true },
  ];

  let linked = 0;
  let created = 0;

  for (const mapping of manualMap) {
    // Check if any unlinked interventions have this org
    const { data: unlinked } = await db
      .from('alma_interventions')
      .select('id')
      .is('gs_entity_id', null)
      .eq('operating_organization', mapping.alma_org);

    if (!unlinked?.length) continue;

    // Try to find existing entity first
    let entityId = null;
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, canonical_name')
      .ilike('canonical_name', `%${mapping.canonical_name}%`)
      .limit(3);

    if (entities?.length) {
      const best = entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
      entityId = best.id;
      if (VERBOSE) log(`  "${mapping.alma_org}" → existing "${best.canonical_name}"`);
    } else if (APPLY) {
      // Create new entity
      const gsId = `GS-ALMA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const insertData = {
        entity_type: mapping.entity_type,
        canonical_name: mapping.canonical_name,
        gs_id: gsId,
        state: mapping.state,
        sector: mapping.sector,
        source_datasets: ['alma'],
        confidence: 'reported',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (mapping.abn) insertData.abn = mapping.abn;
      if (mapping.is_community_controlled) insertData.is_community_controlled = true;

      const { data: newEntity, error: createErr } = await db
        .from('gs_entities')
        .insert(insertData)
        .select('id')
        .single();

      if (createErr) {
        log(`  Error creating entity for "${mapping.canonical_name}": ${createErr.message}`);
        continue;
      }
      entityId = newEntity.id;
      created++;
      if (VERBOSE) log(`  "${mapping.alma_org}" → created "${mapping.canonical_name}" (${gsId})`);
    } else {
      if (VERBOSE) log(`  "${mapping.alma_org}" → would create "${mapping.canonical_name}" [${unlinked.length} records]`);
      linked += unlinked.length;
      continue;
    }

    if (entityId && APPLY) {
      const ids = unlinked.map(u => u.id);
      const { error } = await db
        .from('alma_interventions')
        .update({ gs_entity_id: entityId, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (!error) linked += ids.length;
    }
  }

  log(`  Created ${created} new entities, linked ${linked} via manual mappings${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Phase 4: ACNC/ORIC fuzzy match via pg_trgm ─────────────────────────────

async function phase4_registryFuzzy() {
  log('=== Phase 4: ACNC/ORIC fuzzy match via pg_trgm ===');

  // Get remaining unlinked with org names
  const { data: unlinked } = await db
    .from('alma_interventions')
    .select('id, operating_organization')
    .is('gs_entity_id', null)
    .not('operating_organization', 'is', null)
    .or('review_status.is.null,review_status.neq.flagged_junk');

  if (!unlinked?.length) {
    log('  No unlinked with org names');
    return 0;
  }

  // Dedupe by org name
  const orgMap = new Map();
  const skipPatterns = /^(Multiple|Various|Several|Community org|Unknown|N\/A|TBC|http)/i;

  for (const row of unlinked) {
    const org = row.operating_organization?.trim();
    if (!org || org.length < 4 || skipPatterns.test(org)) continue;
    if (!orgMap.has(org)) orgMap.set(org, []);
    orgMap.get(org).push(row.id);
  }

  log(`  ${orgMap.size} unique org names to fuzzy match`);

  let linked = 0;
  let matched = 0;

  for (const [orgName, ids] of orgMap) {
    // Use pg_trgm similarity search against ACNC
    try {
      const { data: acncMatches } = await db.rpc('exec_sql', {
        query: `SELECT abn, name, similarity(name, '${orgName.replace(/'/g, "''")}') as sim
                FROM acnc_charities
                WHERE name % '${orgName.replace(/'/g, "''")}'
                ORDER BY sim DESC LIMIT 3`
      });

      if (acncMatches?.length) {
        const best = acncMatches[0];
        if (best.sim >= 0.6) {
          // Look up entity by ABN
          const { data: entities } = await db
            .from('gs_entities')
            .select('id')
            .eq('abn', best.abn)
            .limit(1);

          if (entities?.length) {
            matched++;
            if (VERBOSE) log(`  ACNC: "${orgName}" → "${best.name}" (sim=${best.sim.toFixed(2)}) → entity`);

            if (APPLY) {
              for (const id of ids) {
                const { error } = await db
                  .from('alma_interventions')
                  .update({ gs_entity_id: entities[0].id, updated_at: new Date().toISOString() })
                  .eq('id', id);
                if (!error) linked++;
              }
            } else {
              linked += ids.length;
            }
            continue;
          }
        }
      }
    } catch (e) {
      // pg_trgm may timeout on certain queries — skip
      if (VERBOSE) log(`  ACNC trgm error for "${orgName}": ${e.message}`);
    }

    // Try ORIC
    try {
      const { data: oricMatches } = await db.rpc('exec_sql', {
        query: `SELECT name, abn, similarity(name, '${orgName.replace(/'/g, "''")}') as sim
                FROM oric_corporations
                WHERE name % '${orgName.replace(/'/g, "''")}'
                ORDER BY sim DESC LIMIT 3`
      });

      if (oricMatches?.length) {
        const best = oricMatches[0];
        if (best.sim >= 0.6 && best.abn) {
          const { data: entities } = await db
            .from('gs_entities')
            .select('id')
            .eq('abn', best.abn)
            .limit(1);

          if (entities?.length) {
            matched++;
            if (VERBOSE) log(`  ORIC: "${orgName}" → "${best.name}" (sim=${best.sim.toFixed(2)}) → entity`);

            if (APPLY) {
              for (const id of ids) {
                const { error } = await db
                  .from('alma_interventions')
                  .update({ gs_entity_id: entities[0].id, updated_at: new Date().toISOString() })
                  .eq('id', id);
                if (!error) linked++;
              }
            } else {
              linked += ids.length;
            }
          }
        }
      }
    } catch (e) {
      if (VERBOSE) log(`  ORIC trgm error for "${orgName}": ${e.message}`);
    }
  }

  log(`  Matched ${matched} orgs, linked ${linked} interventions${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Phase 5: Direct entity fuzzy match ──────────────────────────────────────

async function phase5_directEntityMatch() {
  log('=== Phase 5: Direct entity fuzzy match ===');

  const { data: unlinked } = await db
    .from('alma_interventions')
    .select('id, operating_organization, name')
    .is('gs_entity_id', null)
    .or('review_status.is.null,review_status.neq.flagged_junk');

  if (!unlinked?.length) {
    log('  All linked!');
    return 0;
  }

  // Dedupe by search name
  const orgMap = new Map();
  const skipPatterns = /^(Multiple|Various|Several|Community org|Unknown|N\/A|TBC|http|Page not|404)/i;

  for (const row of unlinked) {
    const searchName = row.operating_organization?.trim() || '';
    if (!searchName || searchName.length < 5 || skipPatterns.test(searchName)) continue;
    if (!orgMap.has(searchName)) orgMap.set(searchName, []);
    orgMap.get(searchName).push(row.id);
  }

  log(`  ${orgMap.size} unique names for direct entity matching`);

  let linked = 0;
  let matched = 0;

  for (const [searchName, ids] of orgMap) {
    try {
      // Use pg_trgm similarity search against gs_entities
      const { data: matches } = await db.rpc('exec_sql', {
        query: `SELECT id, canonical_name, similarity(canonical_name, '${searchName.replace(/'/g, "''")}') as sim
                FROM gs_entities
                WHERE canonical_name % '${searchName.replace(/'/g, "''")}'
                ORDER BY sim DESC LIMIT 3`
      });

      if (matches?.length) {
        const best = matches[0];
        // Higher threshold for direct match to avoid false positives
        // Also validate: reject if best match has very different word count (sign of substring noise)
        const searchWords = searchName.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const matchWords = best.canonical_name.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const wordRatio = Math.min(searchWords.length, matchWords.length) / Math.max(searchWords.length, matchWords.length);
        if (best.sim >= 0.6 || (best.sim >= 0.55 && wordRatio >= 0.5)) {
          matched++;
          if (VERBOSE) log(`  "${searchName}" → "${best.canonical_name}" (sim=${best.sim.toFixed(2)})`);

          if (APPLY) {
            for (const id of ids) {
              const { error } = await db
                .from('alma_interventions')
                .update({ gs_entity_id: best.id, updated_at: new Date().toISOString() })
                .eq('id', id);
              if (!error) linked++;
            }
          } else {
            linked += ids.length;
          }
        }
      }
    } catch (e) {
      if (VERBOSE) log(`  trgm error for "${searchName}": ${e.message}`);
    }
  }

  log(`  Matched ${matched} names, linked ${linked} interventions${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('════════════════════════════════════════════');
  log('  ALMA Entity Linker v4 — Comprehensive');
  log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  log('════════════════════════════════════════════');

  // Initial stats
  const { count: totalCount } = await db.from('alma_interventions').select('*', { count: 'exact', head: true });
  const { count: linkedBefore } = await db.from('alma_interventions').select('*', { count: 'exact', head: true }).not('gs_entity_id', 'is', null);
  // Count real (non-generated) interventions via raw SQL since Supabase client JSONB filter syntax is tricky
  const { data: realRows } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM alma_interventions WHERE metadata->>'generated' IS DISTINCT FROM 'true'`
  });
  const realCount = realRows?.[0]?.cnt || 0;

  log(`\nBefore: ${linkedBefore}/${totalCount} linked (${((linkedBefore / totalCount) * 100).toFixed(1)}%)`);
  log(`Real interventions: ${realCount}, Generated seed: ${totalCount - realCount}`);

  const p0 = await phase0_flagJunk();
  const p1 = await phase1_linkSeedData();
  const p2 = await phase2_orgInName();
  const p3 = await phase3_parentOrg();
  const p3b = await phase3b_manualMappings();
  const p4 = await phase4_registryFuzzy();
  const p5 = await phase5_directEntityMatch();

  // Final stats
  const { count: linkedAfter } = await db.from('alma_interventions').select('*', { count: 'exact', head: true }).not('gs_entity_id', 'is', null);
  const { count: junkCount } = await db.from('alma_interventions').select('*', { count: 'exact', head: true }).eq('review_status', 'flagged_junk');
  const effectiveDenominator = totalCount - (junkCount || 0);

  log('\n════════════════════════════════════════════');
  log('  SUMMARY');
  log('════════════════════════════════════════════');
  log(`  Phase 0 (junk flagged): ${p0}`);
  log(`  Phase 1 (seed → state govt): ${p1}`);
  log(`  Phase 2 (org-in-name): ${p2}`);
  log(`  Phase 3 (parent org): ${p3}`);
  log(`  Phase 3b (manual mappings): ${p3b}`);
  log(`  Phase 4 (ACNC/ORIC fuzzy): ${p4}`);
  log(`  Phase 5 (direct entity): ${p5}`);
  log(`  ─────────────────────────`);
  log(`  Total new links: ${linkedAfter - linkedBefore}`);
  log(`  Overall: ${linkedAfter}/${totalCount} (${((linkedAfter / totalCount) * 100).toFixed(1)}%)`);
  log(`  Effective (excl junk): ${linkedAfter}/${effectiveDenominator} (${((linkedAfter / effectiveDenominator) * 100).toFixed(1)}%)`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
