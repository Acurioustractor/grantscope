#!/usr/bin/env node
/**
 * import-agil-communities.mjs
 *
 * Imports communities from the AGIL dataset (Australian Government Indigenous
 * Programs & Policy Locations) — the authoritative government list of 1,546
 * Indigenous locations across Australia.
 *
 * Cross-references with:
 * - BushTel NT (897 NT communities with population, language, land council)
 * - CivicGraph postcode_geo (nearest postcode, remoteness classification)
 * - CivicGraph gs_entities (local procurement entities)
 *
 * Replaces the old postcode_geo-based seeder which missed NT entirely and
 * included non-Indigenous localities.
 *
 * Run: node --env-file=.env scripts/import-agil-communities.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL: ${error.message}\n${query.slice(0, 200)}`);
  return data || [];
}

// ─── Load AGIL ────────────────────────────────────────────
function loadAGIL() {
  const locCsv = readFileSync(join(DATA_DIR, 'agil', 'agil_locations.csv'), 'utf8');
  const nameCsv = readFileSync(join(DATA_DIR, 'agil', 'agil_names.csv'), 'utf8');

  // Parse locations
  const locLines = locCsv.split('\n').filter(l => l.trim());
  const locations = new Map();
  for (const line of locLines.slice(1)) {
    const [lcode, state, lat, lon, created, retired] = line.split(',');
    if (retired) continue; // skip retired locations
    locations.set(lcode, {
      lcode, state: state.trim(),
      lat: parseFloat(lat), lon: parseFloat(lon),
      names: [], preferredName: null,
    });
  }

  // Parse names and attach to locations
  const nameLines = nameCsv.split('\n').filter(l => l.trim());
  for (const line of nameLines.slice(1)) {
    const parts = line.split(',');
    const lcode = parts[0];
    const ncode = parts[1];
    const name = parts[2];
    const flag = parts[3]; // P=preferred, A=alternate
    const retired = parts[5];

    if (retired) continue;
    const loc = locations.get(lcode);
    if (!loc) continue;

    if (flag === 'P') loc.preferredName = name;
    loc.names.push({ name, flag });
  }

  return locations;
}

// ─── Load BushTel NT ──────────────────────────────────────
function loadBushTel() {
  const csvPath = join(DATA_DIR, 'bushtel-nt-communities.csv');
  let csv;
  try { csv = readFileSync(csvPath, 'utf8'); } catch { return new Map(); }

  const lines = csv.split('\n').filter(l => l.trim());
  const communities = new Map();

  for (const line of lines.slice(1)) {
    // CSV with potential commas in quoted fields
    const parts = parseCSVLine(line);
    const name = (parts[1] || '').trim();
    if (!name) continue;

    communities.set(name.toLowerCase(), {
      name,
      communityId: parts[2],
      aliases: parts[3],
      localGovernment: parts[4],
      mainLanguage: parts[5] === 'Not recorded' ? null : parts[5],
      landCouncil: parts[6],
      electorate: parts[8],
      population: parts[9] ? parseInt(parts[9]) : null,
      lon: parts[10] ? parseFloat(parts[10]) : null,
      lat: parts[11] ? parseFloat(parts[11]) : null,
      location: parts[12],
    });
  }

  return communities;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ─── Freight corridors ───────────────────────────────────
const FREIGHT_CORRIDORS = {
  NT: { hub: 'Darwin', corridor: 'Darwin-Stuart Highway', freightPerKg: 6.3 },
  WA: { hub: 'Perth', corridor: 'Perth-Great Northern Highway', freightPerKg: 5.0 },
  QLD: { hub: 'Cairns', corridor: 'Cairns-Peninsula Development Road', freightPerKg: 4.5 },
  SA: { hub: 'Adelaide', corridor: 'Adelaide-Stuart Highway', freightPerKg: 5.5 },
  NSW: { hub: 'Sydney', corridor: 'Sydney-Mitchell Highway', freightPerKg: 3.0 },
  TAS: { hub: 'Hobart', corridor: 'Hobart-regional', freightPerKg: 3.0 },
  VIC: { hub: 'Melbourne', corridor: 'Melbourne-regional', freightPerKg: 2.5 },
  ACT: { hub: 'Canberra', corridor: 'Canberra-local', freightPerKg: 2.0 },
};

// NT-specific corridors based on lat/lon
function ntCorridor(lat, lon) {
  if (lat > -13) return { hub: 'Darwin', corridor: 'Top End', lastMile: 'road', freightPerKg: 6.3 };
  if (lon > 135) return { hub: 'Darwin', corridor: 'East Arnhem', lastMile: 'barge', freightPerKg: 17.5 };
  if (lat < -22) return { hub: 'Alice Springs', corridor: 'Central Australia', lastMile: 'road', freightPerKg: 5.0 };
  if (lat < -18 && lat > -22) return { hub: 'Katherine', corridor: 'Barkly/Victoria River', lastMile: 'road', freightPerKg: 6.0 };
  return { hub: 'Darwin', corridor: 'West Arnhem/Daly', lastMile: 'road', freightPerKg: 8.0 };
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  let itemsFound = 0, itemsNew = 0;

  console.log('=== Import AGIL Communities ===');
  if (!APPLY) console.log('🔒 DRY RUN — pass --apply to execute changes\n');

  // 1. Load data sources
  console.log('1. Loading data sources...');
  const agil = loadAGIL();
  const bushtel = loadBushTel();
  console.log(`   AGIL: ${agil.size} active locations`);
  console.log(`   BushTel NT: ${bushtel.size} communities`);
  itemsFound = agil.size;

  // 2. Load postcode_geo for nearest-postcode matching
  console.log('\n2. Loading postcode reference data...');
  // Load all postcodes in batches (exec_sql returns max 1000)
  let postcodes = [];
  const states = ['NSW','VIC','QLD','SA','WA','TAS','NT','ACT'];
  for (const st of states) {
    const rows = await sql(`
      SELECT postcode, locality, state, latitude, longitude,
             remoteness_2021, lga_name, lga_code
      FROM postcode_geo
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND state = '${st}'
    `);
    postcodes = postcodes.concat(rows);
  }
  console.log(`   ${postcodes.length} postcodes loaded`);

  // Build spatial index (simple nearest-postcode by state)
  const postcodesByState = {};
  for (const p of postcodes) {
    const s = p.state;
    if (!postcodesByState[s]) postcodesByState[s] = [];
    postcodesByState[s].push(p);
  }

  function nearestPostcode(lat, lon, state) {
    const candidates = postcodesByState[state] || postcodesByState['NT'] || [];
    let best = null, bestDist = Infinity;
    for (const p of candidates) {
      const dlat = lat - Number(p.latitude);
      const dlon = lon - Number(p.longitude);
      const d = dlat * dlat + dlon * dlon;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  // 3. Clear old data and prepare for fresh import
  console.log('\n3. Clearing old community data...');
  // Delete in FK order: signals → asset_lifecycle → supply_routes → procurement_entities → communities
  const tables = ['goods_procurement_signals', 'goods_asset_lifecycle', 'goods_supply_routes', 'goods_procurement_entities', 'goods_communities'];

  if (APPLY) {
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) console.log(`   Warning deleting ${table}: ${error.message.slice(0, 100)}`);
      else console.log(`   Cleared ${table}`);
    }
  } else {
    console.log('   ⏭️  DRY RUN: Would delete all rows from the following tables:');
    for (const table of tables) {
      // Query count to show what would be deleted
      const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });
      console.log(`      - ${table}: ${count || 0} rows`);
    }
  }

  // 4. Build community rows from AGIL + BushTel
  console.log('\n4. Building community records...');
  const rows = [];

  for (const [lcode, loc] of agil) {
    if (!loc.preferredName) continue;

    const state = loc.state;
    const corridor = state === 'NT' ? ntCorridor(loc.lat, loc.lon) : FREIGHT_CORRIDORS[state] || FREIGHT_CORRIDORS.NSW;
    const nearest = nearestPostcode(loc.lat, loc.lon, state);

    // Try to match BushTel
    const nameLower = loc.preferredName.toLowerCase();
    let bt = bushtel.get(nameLower);
    // Also try matching with " - " patterns (BushTel uses "Name - Type" format)
    if (!bt) {
      for (const [key, val] of bushtel) {
        if (key.startsWith(nameLower + ' -') || key.includes(nameLower)) {
          bt = val; break;
        }
      }
    }

    // Determine remoteness
    let remoteness = nearest?.remoteness_2021 || null;
    // AGIL locations are by definition Indigenous program locations
    // Most without a nearby postcode are very remote
    if (!remoteness && state === 'NT') remoteness = 'Very Remote Australia';

    // Determine community type from BushTel or name
    let communityType = 'community';
    if (bt) {
      const btName = bt.name.toLowerCase();
      if (btName.includes('outstation') || btName.includes('family outstation')) communityType = 'outstation';
      else if (btName.includes('town camp')) communityType = 'town_camp';
      else if (btName.includes('village')) communityType = 'village';
    }

    rows.push({
      community_name: loc.preferredName,
      agil_code: lcode,
      state,
      latitude: loc.lat,
      longitude: loc.lon,
      postcode: nearest?.postcode || null,
      remoteness: remoteness,
      lga_name: nearest?.lga_name || null,
      lga_code: nearest?.lga_code || null,
      community_type: communityType,
      // BushTel enrichment
      estimated_population: bt?.population || null,
      main_language: bt?.mainLanguage || null,
      land_council: bt?.landCouncil || null,
      local_government: bt?.localGovernment || null,
      // Freight
      nearest_staging_hub: corridor.hub,
      freight_corridor: corridor.corridor,
      last_mile_method: corridor.lastMile || 'road',
      estimated_freight_cost_per_kg: corridor.freightPerKg,
      // Alternate names for matching
      aliases: loc.names.filter(n => n.flag === 'A').map(n => n.name),
      data_sources: [
        'agil',
        ...(bt ? ['bushtel'] : []),
        ...(nearest ? ['postcode_geo'] : []),
      ],
      // Priority: start with all as 'monitor', agents will upgrade
      priority: 'monitor',
    });
  }

  console.log(`   ${rows.length} communities prepared`);

  // 5. Upsert communities
  console.log('\n5. Inserting communities...');
  const BATCH = 100;

  if (APPLY) {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase.from('goods_communities').upsert(batch, {
        onConflict: 'community_name,state',
        ignoreDuplicates: false,
      });
      if (error) {
        console.log(`   Batch ${i} error: ${error.message.slice(0, 150)}`);
        // Try one-by-one for diagnostics
        for (const row of batch) {
          const { error: e2 } = await supabase.from('goods_communities').upsert([row], {
            onConflict: 'community_name,state',
            ignoreDuplicates: true,
          });
          if (!e2) itemsNew++;
        }
      } else {
        itemsNew += batch.length;
      }
      if (i % 500 === 0 && i > 0) process.stdout.write(`   ${i}/${rows.length}\r`);
    }
    console.log(`   Inserted ${itemsNew} communities\n`);
  } else {
    console.log(`   ⏭️  DRY RUN: Would upsert ${rows.length} communities`);
    console.log(`   Sample communities:`);
    for (const row of rows.slice(0, 5)) {
      console.log(`      - ${row.community_name}, ${row.state} (${row.remoteness || 'unknown remoteness'})`);
    }
    console.log();
  }

  // 6. Enrich with CivicGraph procurement entities
  console.log('6. Matching procurement entities...');

  if (!APPLY) {
    console.log('   ⏭️  DRY RUN: Would match procurement entities (skipping in dry run)\n');
    console.log('=== SUMMARY (DRY RUN) ===');
    console.log(`Total AGIL locations:     ${agil.size}`);
    console.log(`Communities to import:     ${rows.length}`);
    console.log('');
    console.log('By state:');
    const byState = {};
    for (const r of rows) {
      byState[r.state] = (byState[r.state] || 0) + 1;
    }
    for (const [s, n] of Object.entries(byState).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${s}: ${n}`);
    }
    if (runId) await logComplete(supabase, runId, { items_found: itemsFound, items_new: 0 });
    return;
  }

  // Get all communities with postcodes
  const commWithPostcodes = await sql(`
    SELECT id, community_name, state, postcode
    FROM goods_communities
    WHERE postcode IS NOT NULL
  `);

  // For each postcode, find entities
  const postcodeSet = new Set(commWithPostcodes.map(c => c.postcode));
  const postcodeArray = [...postcodeSet].map(p => `'${p}'`).join(',');

  let entities = [];
  if (postcodeArray) {
    entities = await sql(`
      SELECT gs_id, canonical_name, abn, entity_type, sector, postcode, state,
             is_community_controlled
      FROM gs_entities
      WHERE postcode IN (${postcodeArray})
        AND entity_type IN ('charity', 'government', 'company', 'indigenous_org', 'nfp')
      ORDER BY postcode, canonical_name
    `);
  }
  console.log(`   ${entities.length} entities found in community postcodes`);

  // Map postcode -> community IDs
  const postcodeToComm = {};
  for (const c of commWithPostcodes) {
    if (!postcodeToComm[c.postcode]) postcodeToComm[c.postcode] = [];
    postcodeToComm[c.postcode].push(c);
  }

  // Build procurement entity rows
  const procRows = [];
  for (const ent of entities) {
    const comms = postcodeToComm[ent.postcode] || [];
    for (const c of comms) {
      // Classify buyer role using valid enum values
      let buyerRole = 'other';
      const name = (ent.canonical_name || '').toLowerCase();
      const type = ent.entity_type || '';
      if (name.includes('land council')) buyerRole = 'land_council';
      else if (type === 'government' || name.includes('council') || name.includes('shire')) buyerRole = 'government';
      else if (name.includes('art centre') || name.includes('arts centre')) buyerRole = 'art_centre';
      else if (name.includes('store') || name.includes('outback stores')) buyerRole = 'store';
      else if (name.includes('housing') || name.includes('shelter') || name.includes('accommodation')) buyerRole = 'housing_provider';
      else if (name.includes('health') || name.includes('hospital') || name.includes('medical')) buyerRole = 'health_service';
      else if (name.includes('school') || name.includes('education') || name.includes('university')) buyerRole = 'education';
      else if (name.includes('aged care') || name.includes('elder')) buyerRole = 'aged_care';
      else if (name.includes('disability') || name.includes('ndis')) buyerRole = 'disability_service';
      else if (ent.is_community_controlled || name.includes('aboriginal') || name.includes('indigenous')) buyerRole = 'community_org';

      procRows.push({
        community_id: c.id,
        entity_name: ent.canonical_name,
        gs_id: ent.gs_id,
        abn: ent.abn,
        buyer_role: buyerRole,
        entity_type: ent.entity_type,
        is_community_controlled: ent.is_community_controlled || false,
        procurement_method: buyerRole === 'government' ? 'tender' : 'direct',
        relationship_status: 'prospect',
      });
    }
  }

  // Insert procurement entities
  let procInserted = 0;
  for (let i = 0; i < procRows.length; i += BATCH) {
    const batch = procRows.slice(i, i + BATCH);
    const { error } = await supabase.from('goods_procurement_entities').insert(batch);
    if (error) {
      if (!error.message.includes('duplicate')) {
        console.log(`   Proc batch ${i} warning: ${error.message.slice(0, 120)}`);
      }
    } else {
      procInserted += batch.length;
    }
  }
  console.log(`   Linked ${procInserted} procurement entities\n`);

  // 7. Update entity counts on communities
  console.log('7. Updating community entity counts...');
  const entityCounts = await sql(`
    SELECT community_id, COUNT(*) as total,
      COUNT(CASE WHEN buyer_role = 'community_controlled' THEN 1 END) as cc,
      COUNT(CASE WHEN buyer_role = 'government' THEN 1 END) as govt
    FROM goods_procurement_entities
    GROUP BY community_id
  `);
  for (const ec of entityCounts) {
    await supabase.from('goods_communities').update({
      total_local_entities: Number(ec.total),
      buyer_entity_count: Number(ec.total),
    }).eq('id', ec.community_id);
  }
  console.log(`   Updated ${entityCounts.length} communities\n`);

  // 8. Summary
  const byState = {};
  for (const r of rows) {
    byState[r.state] = (byState[r.state] || 0) + 1;
  }
  const btMatched = rows.filter(r => r.data_sources.includes('bushtel')).length;

  console.log('=== SUMMARY ===');
  console.log(`Total AGIL locations:     ${agil.size}`);
  console.log(`Communities imported:      ${itemsNew}`);
  console.log(`BushTel NT enriched:       ${btMatched}`);
  console.log(`Procurement entities:      ${procInserted}`);
  console.log('');
  console.log('By state:');
  for (const [s, n] of Object.entries(byState).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${n}`);
  }

  if (runId) await logComplete(supabase, runId, { items_found: itemsFound, items_new: itemsNew });
}

let runId;
(async () => {
  try {
    const run = await logStart(supabase, 'import-agil-communities', 'Import AGIL Communities');
    runId = run?.id || null;
  } catch {}
  await main();
})().catch(async (err) => {
  console.error('FATAL:', err);
  if (runId) try { await logFailed(supabase, runId, err); } catch {}
  process.exit(1);
});
