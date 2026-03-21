#!/usr/bin/env node

/**
 * Bulk Foundation → Grantee Relationship Builder
 *
 * Maps grantees from multiple foundations to gs_entities and creates grant edges.
 * Grantee data sourced from annual reports, grants databases, and web scraping.
 *
 * Usage:
 *   node --env-file=.env scripts/map-foundation-grantees-bulk.mjs [--apply] [--verbose] [--foundation=myer]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const FILTER = process.argv.find(a => a.startsWith('--foundation='))?.split('=')[1];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ─── Foundation Grantee Data ─────────────────────────────────────────────────

const FOUNDATIONS = {
  gandel: {
    name: 'Gandel Foundation',
    abn: '51393866453',
    year: 2024,
    dataset: 'gandel_impact_report_2024',
    grantees: [
      // Arts & Culture
      'Australian Cultural Fund', 'Hellenic Museum', 'Jewish Museum of Australia',
      'Melbourne Youth Orchestras', 'Musica Viva', 'National Gallery of Victoria',
      'St Martins Youth Arts Centre', 'Melbourne Symphony Orchestra', 'Saltpillar Theatre',
      // Community
      'Australians Investing in Women', 'International Social Service Australia',
      'Thread Together', 'Adelaide Holocaust Museum', 'Ardoch Youth Foundation',
      'Mornington Peninsula Foundation', 'SecondBite', 'State Schools Relief',
      'All Things Equal', 'Flying Fox', 'Entertainment Assist',
      'Koala Kids Foundation', 'Project Rockit Foundation', 'Sandro Demaio Foundation',
      // Major & Flagship
      'Melbourne City Mission', 'Ending Loneliness Together', 'FareShare',
      'Food Ladder', 'Jesuit Social Services', 'Children\'s Ground',
      'Smiling Mind', 'Social Traders', 'Vision Australia',
      'Cancer Council Victoria', 'The Butterfly Foundation', 'Amaze',
      'Australians for Mental Health', 'Boys to the Bush', 'Ready Set',
      'Centre for Multicultural Youth', 'Courage to Care', 'Hadassah Australia',
      'Karrkad Kanjdji Trust', 'JDRF Australia', 'Australian Sports Foundation',
      'Maccabi Victoria', 'Stand Up',
      // Food security
      'Foodbank Victoria', 'FoodFilled',
    ],
  },
  'tim-fairfax': {
    name: 'Tim Fairfax Family Foundation',
    abn: '62124526760',
    year: 2024,
    dataset: 'tfff_annual_report_2024',
    grantees: [
      'Foundation for Rural and Regional Renewal', 'Murdoch Children\'s Research Institute',
      'Queensland Brain Institute', 'Cairns Indigenous Art Fair',
      'Brother to Another', 'Yiliyapinya Indigenous Corporation',
      'AEIOU Foundation', 'Umbrella Studio', 'Dancenorth',
      'Camerata', 'Crossroad Arts',
      // From previous research
      'Aurora Education Foundation', 'Beacon Foundation',
      'Black Dog Institute', 'Clontarf Foundation',
    ],
  },
  snow: {
    name: 'The Snow Foundation',
    abn: '49411415493',
    year: 2025,
    dataset: 'snow_foundation_2025',
    grantees: [
      // Known Snow Foundation grantees from various sources
      'Marymead', 'Communities at Work', 'Menslink', 'Lifeline Canberra',
      'The Smith Family', 'Salvation Army', 'St Vincent de Paul Society',
      'Care Financial Counselling', 'Hands Across Canberra', 'Barnardos',
      'Ted Noffs Foundation', 'Youth Coalition of the ACT',
      'ACT Council of Social Service', 'Roundabout Canberra',
      'Women\'s Legal Centre ACT', 'Canberra Rape Crisis Centre',
      'Toora Women', 'Beryl Women', 'Domestic Violence Crisis Service',
      'OzHarvest', 'Canberra City Care',
    ],
  },
  minderoo: {
    name: 'Minderoo Foundation',
    abn: '24819440618',
    year: 2024,
    dataset: 'minderoo_annual_report_2024',
    grantees: [
      // Known Minderoo grantees from various sources
      'Telethon Kids Institute', 'University of Western Australia',
      'Curtin University', 'Edith Cowan University',
      'Walk Free Foundation', 'International Justice Mission',
      'Blue Zone Group', 'Global Fishing Watch',
      'Minderoo Foundation\'s Flourishing Oceans',
      'CoderDojo', 'Teach for Australia', 'Australian Institute of Marine Science',
      'Fire to Flourish', 'Australian Red Cross',
      'The Collaborative Partnership for Forests', 'Thrive by Five',
      'Global Slavery Index', 'Bali Process',
    ],
  },
  'ian-potter-manual': {
    name: 'The Ian Potter Foundation',
    abn: '77950227010',
    year: 2024,
    dataset: 'ian_potter_known',
    grantees: [
      // Known from web scrape (first 30 results)
      'PLACE Australia', 'Burnet Institute', 'St Vincent\'s Hospital Melbourne',
      'The Ladder Project Foundation', 'Library Board of Queensland',
      'The Youth Impact Foundation', 'Alfred Health',
      'Queensland Performing Arts Trust', 'Children\'s Medical Research Institute',
      'Central Victorian Biolinks Alliance',
    ],
  },
};

// ─── Match grantee to entity ─────────────────────────────────────────────────

async function matchGrantee(name) {
  if (!name || name.length < 3) return null;
  const clean = name.replace(/[()[\]\\\/]/g, '').trim();
  if (clean.length < 4) return null;

  // Strategy 1: Direct entity ILIKE
  try {
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn')
      .ilike('canonical_name', `%${clean}%`)
      .limit(5);

    if (entities?.length === 1) return entities[0];
    if (entities?.length > 1) {
      const exact = entities.find(e => e.canonical_name.toLowerCase() === name.toLowerCase());
      if (exact) return exact;
      return entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
    }
  } catch {}

  // Strategy 2: ACNC lookup
  try {
    const { data: acnc } = await db
      .from('acnc_charities')
      .select('abn, name')
      .ilike('name', `%${clean}%`)
      .limit(3);

    if (acnc?.length) {
      for (const a of acnc) {
        const { data: entity } = await db
          .from('gs_entities')
          .select('id, canonical_name, abn')
          .eq('abn', a.abn)
          .limit(1);
        if (entity?.length) return entity[0];
      }
    }
  } catch {}

  // Strategy 3: pg_trgm fuzzy
  try {
    const escaped = name.replace(/'/g, "''");
    const { data: trgm } = await db.rpc('exec_sql', {
      query: `SELECT id, canonical_name, abn, similarity(canonical_name, '${escaped}') as sim
              FROM gs_entities WHERE canonical_name % '${escaped}'
              ORDER BY sim DESC LIMIT 1`
    });
    if (trgm?.length && trgm[0].sim >= 0.5) {
      return { id: trgm[0].id, canonical_name: trgm[0].canonical_name, abn: trgm[0].abn };
    }
  } catch {}

  return null;
}

// ─── Process one foundation ──────────────────────────────────────────────────

async function processFoundation(key, config) {
  log(`\n═══ ${config.name} ═══`);

  // Get entity
  const { data: fEntity } = await db
    .from('gs_entities')
    .select('id, canonical_name')
    .eq('abn', config.abn)
    .limit(1);

  if (!fEntity?.length) {
    log(`  ERROR: Entity not found for ABN ${config.abn}`);
    return { matched: 0, created: 0, notFound: 0 };
  }

  const foundationId = fEntity[0].id;
  log(`  Entity: ${fEntity[0].canonical_name}`);

  // Check existing edges
  const { data: existing } = await db
    .from('gs_relationships')
    .select('target_entity_id')
    .eq('source_entity_id', foundationId)
    .eq('relationship_type', 'grant');

  const existingTargets = new Set((existing || []).map(r => r.target_entity_id));
  log(`  Existing grant edges: ${existingTargets.size}`);
  log(`  Grantees to process: ${config.grantees.length}`);

  let matched = 0, created = 0, notFound = 0;
  const unmatched = [];

  for (const name of config.grantees) {
    const entity = await matchGrantee(name);

    if (!entity) {
      notFound++;
      unmatched.push(name);
      if (VERBOSE) log(`    ✗ "${name}" — no match`);
      continue;
    }

    if (existingTargets.has(entity.id) || entity.id === foundationId) {
      if (VERBOSE) log(`    ⊘ "${name}" → "${entity.canonical_name}" — exists/self`);
      continue;
    }

    matched++;
    if (VERBOSE) log(`    ✓ "${name}" → "${entity.canonical_name}"`);

    if (APPLY) {
      const { error } = await db
        .from('gs_relationships')
        .insert({
          source_entity_id: foundationId,
          target_entity_id: entity.id,
          relationship_type: 'grant',
          year: config.year,
          dataset: config.dataset,
          confidence: 'reported',
          properties: {
            source: 'annual_report',
            foundation: config.name,
          },
        });

      if (!error) {
        created++;
        existingTargets.add(entity.id);
      }
    }
  }

  log(`\n  Summary: ${matched} matched, ${APPLY ? created : matched} edges, ${notFound} unmatched`);
  if (unmatched.length) {
    log(`  Unmatched: ${unmatched.join(', ')}`);
  }

  return { matched, created: APPLY ? created : matched, notFound };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('═══ Bulk Foundation Grantee Mapper ═══');
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const toProcess = FILTER
    ? { [FILTER]: FOUNDATIONS[FILTER] }
    : FOUNDATIONS;

  if (FILTER && !FOUNDATIONS[FILTER]) {
    log(`Unknown: ${FILTER}. Available: ${Object.keys(FOUNDATIONS).join(', ')}`);
    return;
  }

  let totalMatched = 0, totalCreated = 0, totalNotFound = 0;

  for (const [key, config] of Object.entries(toProcess)) {
    const r = await processFoundation(key, config);
    totalMatched += r.matched;
    totalCreated += r.created;
    totalNotFound += r.notFound;
  }

  log('\n═══ GRAND TOTAL ═══');
  log(`  Matched: ${totalMatched}`);
  log(`  Edges: ${totalCreated}`);
  log(`  Not found: ${totalNotFound}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
