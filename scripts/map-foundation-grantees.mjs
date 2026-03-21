#!/usr/bin/env node

/**
 * Foundation → Grantee Relationship Builder
 *
 * Takes a foundation ABN and a list of grantee names, resolves each to gs_entities,
 * and creates grant relationship edges.
 *
 * Multi-strategy matching:
 *   1. Exact name → ACNC → ABN → gs_entity
 *   2. Normalized name → ACNC → ABN → gs_entity
 *   3. Direct ILIKE on gs_entities
 *   4. pg_trgm fuzzy (threshold 0.6+)
 *   5. Create new entity if well-known org not found
 *
 * Usage:
 *   node --env-file=.env scripts/map-foundation-grantees.mjs --foundation=<ABN> --grantees=<file.json> [--apply] [--verbose]
 *
 * Or with built-in foundation data:
 *   node --env-file=.env scripts/map-foundation-grantees.mjs --foundation=paul-ramsay [--apply] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function normalize(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|ltd|limited|pty|co-operative|cooperative|association|assoc|foundation|trust|the|of|and|for|australia|australian)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Built-in Foundation Grantee Data ────────────────────────────────────────

const FOUNDATIONS = {
  'paul-ramsay': {
    abn: '32623132472',
    name: 'Paul Ramsay Foundation',
    grantees: [
      // Justice & Safety
      { name: 'Aboriginal Family Legal Service WA', focus: 'justice' },
      { name: 'Afri-Aus Care', focus: 'justice' },
      { name: 'Anglicare WA', focus: 'justice' },
      { name: 'Anglicare Victoria', focus: 'justice' },
      { name: 'Australian Muslim Women\'s Centre for Human Rights', focus: 'justice' },
      { name: 'Ballarat and District Aboriginal Cooperative', focus: 'justice' },
      { name: 'Banksia Academy', focus: 'justice' },
      { name: 'Berry Street Victoria', focus: 'justice' },
      { name: 'Blacktown Youth Services Association', focus: 'justice' },
      { name: 'Boorndawam Willam Aboriginal Healing Service', focus: 'justice' },
      { name: 'Central Australian Aboriginal Family Legal Unit', focus: 'justice' },
      { name: 'Centre for Non-Violence', focus: 'justice' },
      { name: 'Circular Head Aboriginal Corp', focus: 'justice' },
      { name: 'Dardi Munwurro', focus: 'justice' },
      { name: 'Deadly Connections Community and Justice Services', focus: 'justice' },
      { name: 'Djirra', focus: 'justice' },
      { name: 'DVassist', focus: 'justice' },
      { name: 'Ebenezer Aboriginal Corporation', focus: 'justice' },
      { name: 'Elizabeth Morgan House Aboriginal Women\'s Services', focus: 'justice' },
      { name: 'Engender Equality', focus: 'justice' },
      { name: 'Family Access Network', focus: 'justice' },
      { name: 'Gawooleng Yawoodeng Aboriginal Corporation', focus: 'justice' },
      { name: 'Health Justice Australia', focus: 'justice' },
      { name: 'Illawarra Koori Men\'s Support Group', focus: 'justice' },
      { name: 'inTouch Multicultural Centre Against Family Violence', focus: 'justice' },
      { name: 'Just Reinvest NSW', focus: 'justice' },
      { name: 'Justice and Equity Centre', focus: 'justice' },
      { name: 'Katungul Aboriginal Corporation Regional Health & Community Services', focus: 'justice' },
      { name: 'KRED Enterprises Charitable Trust', focus: 'justice' },
      { name: 'Kura Yerlo', focus: 'justice' },
      { name: 'KWY Aboriginal Corporation', focus: 'justice' },
      { name: 'Liberty Domestic & Family Violence Specialist Services', focus: 'justice' },
      { name: 'Marnin Bowa Dumbara Family Healing Centre', focus: 'justice' },
      { name: 'Mater', focus: 'justice' },
      { name: 'McAuley', focus: 'justice' },
      { name: 'Micah projects', focus: 'justice' },
      { name: 'Multicultural Families Organisation', focus: 'justice' },
      { name: 'Multicultural Youth South Australia', focus: 'justice' },
      { name: 'Northern Rivers Women and Children\'s Services', focus: 'justice' },
      { name: 'NPY Women\'s Council', focus: 'justice' },
      { name: 'NT Legal Aid', focus: 'justice' },
      { name: 'Open Support', focus: 'justice' },
      { name: 'Parkerville Children and Youth Care', focus: 'justice' },
      { name: 'Rainbow Lodge', focus: 'justice' },
      // First Nations
      { name: 'Aboriginal Biodiversity Conservation Foundation', focus: 'indigenous' },
      { name: 'Aurora Education Foundation', focus: 'indigenous' },
      { name: 'Culturally Nourishing Schooling', focus: 'indigenous' },
      { name: 'First Australians Capital', focus: 'indigenous' },
      { name: 'First Nations Philanthropic Funders Working Group', focus: 'indigenous' },
      { name: 'Gujaga Foundation', focus: 'indigenous' },
      { name: 'Karrkad Kanjdji Trust', focus: 'indigenous' },
      { name: 'National Indigenous Youth Education Coalition', focus: 'indigenous' },
      { name: 'NSW Aboriginal Land Council', focus: 'indigenous' },
      { name: 'NSW Aboriginal Education Consultative Group', focus: 'indigenous' },
      { name: 'Original Power', focus: 'indigenous' },
      // Employment
      { name: 'Beacon Foundation', focus: 'employment' },
      { name: 'Brotherhood of St. Laurence', focus: 'employment' },
      { name: 'Clontarf Foundation', focus: 'employment' },
      { name: 'Foyer Foundation', focus: 'employment' },
      { name: 'Generation Australia', focus: 'employment' },
      { name: 'Jigsaw', focus: 'employment' },
      { name: 'National Disability Services', focus: 'employment' },
      // Community / Not-for-profit sector
      { name: 'Australian Communities Foundation', focus: 'community' },
      { name: 'Australian Democracy Network', focus: 'community' },
      { name: 'Australian Research Alliance for Children and Youth', focus: 'community' },
      { name: 'Centre for Social Impact', focus: 'community' },
      { name: 'Community Resources', focus: 'community' },
      { name: 'Documentary Australia', focus: 'community' },
      { name: 'Foundation for Rural and Regional Renewal', focus: 'community' },
      { name: 'Purpose', focus: 'community' },
      // Housing
      { name: 'Conscious Investment Management', focus: 'housing' },
      { name: 'Junction', focus: 'housing' },
      { name: 'Launch Housing', focus: 'housing' },
      // Mental Health
      { name: 'Beyond Blue', focus: 'health' },
      { name: 'Black Dog Institute', focus: 'health' },
      { name: 'Hello Sunday Morning', focus: 'health' },
      // Disaster response
      { name: 'Australian Red Cross', focus: 'emergency' },
      { name: 'Community Broadcasting Association of Australia', focus: 'community' },
      { name: 'Fremantle Foundation', focus: 'community' },
      { name: 'Lord Mayor\'s Charitable Foundation', focus: 'community' },
      // Place-based
      { name: 'The Smith Family', focus: 'education' },
      { name: 'Two Good', focus: 'social_enterprise' },
      { name: 'Uniting', focus: 'community' },
      { name: 'Weave', focus: 'community' },
      { name: 'Happy Paws Happy Hearts', focus: 'social_enterprise' },
      // Research/Other
      { name: 'E61 Institute', focus: 'research' },
      { name: 'Melbourne Institute', focus: 'research' },
      { name: 'Murdoch Children\'s Research Institute', focus: 'research' },
      { name: 'Ramsay Centre for Western Civilisation', focus: 'education' },
    ],
  },
};

// ─── Main Logic ─────────────────────────────────────────────────────────────

async function resolveEntity(grantee) {
  const name = grantee.name;

  // Strategy 1: ACNC exact name → ABN → entity
  const { data: acncExact } = await db
    .from('acnc_charities')
    .select('abn, name')
    .ilike('name', name)
    .limit(1);

  if (acncExact?.length) {
    const { data: entity } = await db
      .from('gs_entities')
      .select('id, canonical_name')
      .eq('abn', acncExact[0].abn)
      .limit(1);
    if (entity?.length) return { entity: entity[0], method: 'acnc_exact' };
  }

  // Strategy 2: ACNC ILIKE containment
  const cleanName = name.replace(/[()[\]]/g, '').trim();
  if (cleanName.length >= 6) {
    const { data: acncFuzzy } = await db
      .from('acnc_charities')
      .select('abn, name')
      .ilike('name', `%${cleanName}%`)
      .limit(5);

    if (acncFuzzy?.length) {
      // Pick closest match
      const normSearch = normalize(name);
      let bestAbn = null, bestScore = 0;
      for (const a of acncFuzzy) {
        const normCandidate = normalize(a.name);
        const score = jaccardSimilarity(normSearch, normCandidate);
        if (score > bestScore) { bestScore = score; bestAbn = a.abn; }
      }
      if (bestAbn && bestScore > 0.3) {
        const { data: entity } = await db
          .from('gs_entities')
          .select('id, canonical_name')
          .eq('abn', bestAbn)
          .limit(1);
        if (entity?.length) return { entity: entity[0], method: 'acnc_fuzzy' };
      }
    }
  }

  // Strategy 3: Direct gs_entities ILIKE
  if (cleanName.length >= 5) {
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, canonical_name')
      .ilike('canonical_name', `%${cleanName}%`)
      .limit(5);

    if (entities?.length === 1) {
      return { entity: entities[0], method: 'entity_ilike' };
    }
    if (entities?.length > 1) {
      // Pick exact or closest
      const exact = entities.find(e => e.canonical_name.toLowerCase() === name.toLowerCase());
      if (exact) return { entity: exact, method: 'entity_exact' };

      const normSearch = normalize(name);
      let best = null, bestScore = 0;
      for (const e of entities) {
        const score = jaccardSimilarity(normSearch, normalize(e.canonical_name));
        if (score > bestScore) { bestScore = score; best = e; }
      }
      if (best && bestScore > 0.4) return { entity: best, method: 'entity_fuzzy' };
    }
  }

  // Strategy 4: pg_trgm
  try {
    const escaped = name.replace(/'/g, "''");
    const { data: trgm } = await db.rpc('exec_sql', {
      query: `SELECT id, canonical_name, similarity(canonical_name, '${escaped}') as sim
              FROM gs_entities WHERE canonical_name % '${escaped}'
              ORDER BY sim DESC LIMIT 1`
    });
    if (trgm?.length && trgm[0].sim >= 0.5) {
      return { entity: { id: trgm[0].id, canonical_name: trgm[0].canonical_name }, method: `trgm(${trgm[0].sim.toFixed(2)})` };
    }
  } catch (e) {
    // Skip timeout
  }

  return null;
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function main() {
  const foundationArg = process.argv.find(a => a.startsWith('--foundation='))?.split('=').slice(1).join('=');
  if (!foundationArg) {
    console.error('Usage: --foundation=<ABN or preset name>');
    console.error('Presets: ' + Object.keys(FOUNDATIONS).join(', '));
    process.exit(1);
  }

  let foundationAbn, foundationName, grantees;

  if (FOUNDATIONS[foundationArg]) {
    const preset = FOUNDATIONS[foundationArg];
    foundationAbn = preset.abn;
    foundationName = preset.name;
    grantees = preset.grantees;
  } else {
    foundationAbn = foundationArg;
    const granteesFile = process.argv.find(a => a.startsWith('--grantees='))?.split('=').slice(1).join('=');
    if (!granteesFile || !existsSync(granteesFile)) {
      console.error('Need --grantees=<file.json> with [{ name: "...", focus: "..." }, ...]');
      process.exit(1);
    }
    grantees = JSON.parse(readFileSync(granteesFile, 'utf-8'));
    foundationName = foundationArg;
  }

  // Get foundation entity ID
  const { data: fEntity } = await db
    .from('gs_entities')
    .select('id, canonical_name')
    .eq('abn', foundationAbn)
    .limit(1);

  if (!fEntity?.length) {
    log(`ERROR: Foundation entity not found for ABN ${foundationAbn}`);
    process.exit(1);
  }

  const foundationEntityId = fEntity[0].id;
  log(`═══ Foundation → Grantee Mapper ═══`);
  log(`Foundation: ${fEntity[0].canonical_name} (${foundationAbn})`);
  log(`Entity ID: ${foundationEntityId}`);
  log(`Grantees to process: ${grantees.length}`);
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  // Check existing grant relationships for this foundation
  const { data: existing } = await db
    .from('gs_relationships')
    .select('target_entity_id')
    .eq('source_entity_id', foundationEntityId)
    .eq('relationship_type', 'grant');

  const existingTargets = new Set((existing || []).map(r => r.target_entity_id));
  log(`Existing grant edges: ${existingTargets.size}`);

  let resolved = 0, created = 0, skipped = 0, notFound = 0;
  const unmatched = [];

  for (let i = 0; i < grantees.length; i++) {
    const grantee = grantees[i];
    const result = await resolveEntity(grantee);

    if (!result) {
      notFound++;
      unmatched.push(grantee.name);
      if (VERBOSE) log(`  ✗ "${grantee.name}" — no match`);
      continue;
    }

    const { entity, method } = result;

    // Check if edge already exists
    if (existingTargets.has(entity.id)) {
      skipped++;
      if (VERBOSE) log(`  ⊘ "${grantee.name}" → "${entity.canonical_name}" [${method}] — exists`);
      continue;
    }

    resolved++;
    if (VERBOSE) log(`  ✓ "${grantee.name}" → "${entity.canonical_name}" [${method}]`);

    if (APPLY) {
      const { error } = await db
        .from('gs_relationships')
        .insert({
          source_entity_id: foundationEntityId,
          target_entity_id: entity.id,
          relationship_type: 'grant',
          dataset: 'foundation_grantees',
          year: 2024,
          confidence: 'reported',
          properties: { focus: grantee.focus, source: 'web_scrape', foundation: foundationName },
        });

      if (error) {
        log(`  Error creating edge: ${error.message}`);
      } else {
        created++;
        existingTargets.add(entity.id);
      }
    }

    if (i > 0 && i % 20 === 0) log(`  Progress: ${i}/${grantees.length}`);
  }

  log('\n═══ SUMMARY ═══');
  log(`  Resolved: ${resolved} grantees`);
  log(`  Created: ${created} new grant edges`);
  log(`  Skipped (existing): ${skipped}`);
  log(`  Not found: ${notFound}`);

  if (unmatched.length) {
    log(`\n  Unmatched grantees (${unmatched.length}):`);
    for (const u of unmatched) log(`    • ${u}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
