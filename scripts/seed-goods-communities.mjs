#!/usr/bin/env node
/**
 * seed-goods-communities.mjs
 *
 * Seeds goods_communities + goods_procurement_entities from CivicGraph data.
 * Uses exec_sql RPC for reads, supabase.from().insert() for writes.
 *
 * Run: node --env-file=.env scripts/seed-goods-communities.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}\nQuery: ${query.slice(0, 300)}`);
  return data || [];
}

async function insertBatch(table, rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'community_name,state', ignoreDuplicates: true });
  if (error) throw new Error(`Insert ${table} error: ${error.message}`);
}

async function insertProcEntities(rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.from('goods_procurement_entities').insert(rows);
  if (error && !error.message.includes('duplicate')) {
    console.log(`   Proc insert warning: ${error.message.slice(0, 150)}`);
  }
}

// Freight corridors
const FREIGHT_CORRIDORS = {
  NT: { hub: 'Darwin', corridor: 'Darwin-Stuart Highway' },
  WA: { hub: 'Perth', corridor: 'Perth-Great Northern Highway' },
  QLD: { hub: 'Cairns', corridor: 'Cairns-Peninsula Development Road' },
  SA: { hub: 'Adelaide', corridor: 'Adelaide-Stuart Highway' },
  NSW: { hub: 'Sydney', corridor: 'Sydney-Mitchell Highway' },
  TAS: { hub: 'Hobart', corridor: 'Hobart-regional' },
  VIC: { hub: 'Melbourne', corridor: 'Melbourne-regional' },
};
const REGION_CORRIDORS = {
  'East Arnhem': { hub: 'Darwin', corridor: 'Darwin-Nhulunbuy (road/barge)', lastMile: 'barge' },
  'West Arnhem': { hub: 'Darwin', corridor: 'Darwin-Jabiru-Gunbalanya', lastMile: 'road' },
  'Katherine & Roper': { hub: 'Darwin', corridor: 'Darwin-Katherine-Roper Highway', lastMile: 'road' },
  'Tiwi Islands': { hub: 'Darwin', corridor: 'Darwin-Tiwi (barge)', lastMile: 'barge' },
  'Groote Archipelago': { hub: 'Darwin', corridor: 'Darwin-Groote Eylandt (barge)', lastMile: 'barge' },
  'Alice Springs': { hub: 'Alice Springs', corridor: 'Adelaide-Alice Springs (rail/road)', lastMile: 'road' },
  'Tennant Creek': { hub: 'Alice Springs', corridor: 'Alice Springs-Tennant Creek', lastMile: 'road' },
  'APY Lands': { hub: 'Alice Springs', corridor: 'Alice Springs-APY Lands', lastMile: 'road' },
  'Kimberley': { hub: 'Broome', corridor: 'Broome-Great Northern Highway', lastMile: 'road' },
  'Pilbara': { hub: 'Port Hedland', corridor: 'Perth-Port Hedland', lastMile: 'road' },
  'Goldfields': { hub: 'Kalgoorlie', corridor: 'Perth-Kalgoorlie', lastMile: 'road' },
  'Cape York': { hub: 'Cairns', corridor: 'Cairns-Peninsula Development Road', lastMile: 'road' },
  'Torres Strait': { hub: 'Cairns', corridor: 'Cairns-Torres Strait (flight/barge)', lastMile: 'barge' },
  'Gulf Country': { hub: 'Mount Isa', corridor: 'Townsville-Mount Isa', lastMile: 'road' },
};

function estimateFreightCost(remoteness, lastMile) {
  const base = remoteness === 'Very Remote Australia' ? 3.5 : 2.0;
  const mult = { road: 1.0, barge: 1.8, charter_flight: 5.0, mail_plane: 4.0, mixed: 2.5 };
  return base * (mult[lastMile] || 1.0);
}

function classifyBuyerRole(ent) {
  const n = (ent.canonical_name || '').toLowerCase();
  const s = (ent.sector || '').toLowerCase();
  const ss = (ent.sub_sector || '').toLowerCase();
  if (n.includes('store') || n.includes('retail') || n.includes('alpa') || n.includes('outback stores')) return 'store';
  if (s.includes('health') || n.includes('health') || n.includes('clinic') || n.includes('medical')) return 'health_service';
  if (n.includes('housing') || n.includes('tenancy') || ss.includes('housing')) return 'housing_provider';
  if (n.includes('council') || n.includes('shire')) return 'council';
  if (n.includes('school') || n.includes('education') || s.includes('education')) return 'education';
  if (n.includes('aged care') || n.includes('elder')) return 'aged_care';
  if (n.includes('land council')) return 'land_council';
  if (n.includes('art') && (n.includes('centre') || n.includes('center'))) return 'art_centre';
  if (ent.is_community_controlled) return 'community_org';
  return 'other';
}

function dataQualityScore(c) {
  let s = 0;
  if (c.postcode) s += 15;
  if (c.lga_name) s += 10;
  if (c.totalEntities > 0) s += 20;
  if (c.buyerCount > 0) s += 15;
  if (c.contractValue > 0) s += 15;
  if (c.communityControlled > 0) s += 10;
  return Math.min(s, 100);
}

async function main() {
  console.log('=== Goods Community Seeder ===\n');

  // 1. Remote localities
  console.log('1. Fetching remote localities...');
  const localities = await sql(`
    SELECT DISTINCT ON (locality, state)
      postcode, locality, state, latitude, longitude,
      remoteness_2021 as remoteness, lga_name, lga_code, sa3_name
    FROM postcode_geo
    WHERE remoteness_2021 IN ('Remote Australia', 'Very Remote Australia')
      AND locality IS NOT NULL AND state IS NOT NULL
    ORDER BY locality, state, postcode
  `);
  console.log(`   ${localities.length} remote/very remote localities\n`);

  // 2. Entity counts per postcode
  console.log('2. Fetching entity landscape...');
  const entityCounts = await sql(`
    SELECT e.postcode,
      COUNT(*) as total_entities,
      COUNT(CASE WHEN e.is_community_controlled THEN 1 END) as community_controlled,
      COUNT(CASE WHEN e.sector ILIKE '%health%' OR e.canonical_name ILIKE '%health%' OR e.canonical_name ILIKE '%clinic%' THEN 1 END) as health_count,
      COUNT(CASE WHEN e.canonical_name ILIKE '%housing%' OR e.sub_sector ILIKE '%housing%' THEN 1 END) as housing_count,
      COUNT(CASE WHEN e.canonical_name ILIKE '%store%' OR e.canonical_name ILIKE '%retail%' OR e.canonical_name ILIKE '%alpa%' THEN 1 END) as store_count,
      COUNT(CASE WHEN e.canonical_name ILIKE '%council%' OR e.canonical_name ILIKE '%shire%' THEN 1 END) as council_count
    FROM gs_entities e
    WHERE e.postcode IS NOT NULL AND e.remoteness IN ('Remote Australia', 'Very Remote Australia')
    GROUP BY e.postcode
  `);
  const entityMap = new Map(entityCounts.map(r => [r.postcode, r]));
  console.log(`   ${entityCounts.length} postcodes with entities\n`);

  // 3. Contract values per postcode
  console.log('3. Fetching contract values...');
  const contractValues = await sql(`
    SELECT e.postcode, SUM(ac.contract_value) as total_contract_value
    FROM austender_contracts ac JOIN gs_entities e ON ac.supplier_abn = e.abn
    WHERE e.remoteness IN ('Remote Australia', 'Very Remote Australia')
      AND e.postcode IS NOT NULL AND ac.contract_value IS NOT NULL
    GROUP BY e.postcode
  `);
  const contractMap = new Map(contractValues.map(r => [r.postcode, r]));
  console.log(`   ${contractValues.length} postcodes with contracts\n`);

  // 4. Existing communities
  const existing = await sql(`SELECT community_name, state FROM goods_communities`);
  const existingSet = new Set(existing.map(r => `${r.community_name}|${r.state}`));
  console.log(`4. ${existing.length} communities already exist\n`);

  // 5. NT enrichment
  let ntMap = new Map();
  try {
    const ntRows = await sql(`
      SELECT community_name, region_label, service_region, land_council,
             goods_focus_priority, goods_signal_type, known_buyer_name,
             demand_beds, demand_washers, proof_line
      FROM nt_communities
    `);
    ntMap = new Map(ntRows.map(r => [r.community_name, r]));
    console.log(`5. Loaded ${ntRows.length} NT community records\n`);
  } catch { console.log('5. No nt_communities, skipping\n'); }

  // 6. Deduplicate
  const unique = new Map();
  for (const loc of localities) {
    const key = `${loc.locality}|${loc.state}`;
    if (!unique.has(key)) unique.set(key, loc);
  }

  // 7. Build community rows
  console.log('6. Building community rows...');
  const rows = [];
  let skipped = 0;

  for (const [key, loc] of unique) {
    if (existingSet.has(key)) { skipped++; continue; }

    const ent = entityMap.get(loc.postcode) || {};
    const con = contractMap.get(loc.postcode) || {};
    const nt = ntMap.get(loc.locality);

    const sf = FREIGHT_CORRIDORS[loc.state] || { hub: 'Unknown', corridor: 'Unknown' };
    const rl = nt?.region_label || loc.sa3_name || null;
    const rf = rl ? REGION_CORRIDORS[rl] : null;
    const hub = rf?.hub || sf.hub;
    const corr = rf?.corridor || sf.corridor;
    const lm = rf?.lastMile || 'road';
    const fc = estimateFreightCost(loc.remoteness, lm);

    const priority = nt?.goods_focus_priority === 'lead' ? 'lead'
      : nt?.goods_focus_priority === 'monitor' ? 'monitor'
      : (Number(ent.total_entities || 0) > 5 || Number(con.total_contract_value || 0) > 100000) ? 'monitor'
      : 'background';

    const storeC = Number(ent.store_count || 0);
    const healthC = Number(ent.health_count || 0);
    const housingC = Number(ent.housing_count || 0);
    const councilC = Number(ent.council_count || 0);
    const buyerC = storeC + healthC + housingC + councilC;
    const ccC = Number(ent.community_controlled || 0);
    const totalE = Number(ent.total_entities || 0);
    const cv = Number(con.total_contract_value || 0);
    const dq = dataQualityScore({ postcode: loc.postcode, lga_name: loc.lga_name, totalEntities: totalE, buyerCount: buyerC, contractValue: cv, communityControlled: ccC });

    rows.push({
      community_name: loc.locality,
      state: loc.state,
      postcode: loc.postcode,
      lga_name: loc.lga_name,
      lga_code: loc.lga_code,
      region_label: rl,
      service_region: nt?.service_region || null,
      land_council: nt?.land_council || null,
      remoteness: loc.remoteness,
      latitude: loc.latitude ? Number(loc.latitude) : null,
      longitude: loc.longitude ? Number(loc.longitude) : null,
      priority,
      signal_type: nt?.goods_signal_type || 'none',
      signal_source: nt ? 'nt_community_data' : 'postcode_geo_inference',
      demand_beds: Number(nt?.demand_beds || 0),
      demand_washers: Number(nt?.demand_washers || 0),
      known_buyer_name: nt?.known_buyer_name || null,
      buyer_entity_count: buyerC,
      store_count: storeC,
      health_service_count: healthC,
      housing_org_count: housingC,
      council_count: councilC,
      community_controlled_org_count: ccC,
      total_local_entities: totalE,
      total_govt_contract_value: cv > 0 ? cv : null,
      nearest_staging_hub: hub,
      freight_corridor: corr,
      estimated_freight_cost_per_kg: fc,
      last_mile_method: lm,
      proof_line: nt?.proof_line || null,
      data_quality_score: dq,
      last_profiled_at: new Date().toISOString(),
    });
  }
  console.log(`   ${rows.length} to insert, ${skipped} skipped\n`);

  // 8. Insert in batches of 100
  console.log('7. Inserting communities...');
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await insertBatch('goods_communities', batch);
    process.stdout.write(`   ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log(`   Done — inserted ${rows.length} communities\n`);

  // 9. Seed procurement entities
  console.log('8. Seeding procurement entities...');
  // Re-fetch communities with IDs
  const communities = await sql(`SELECT id, community_name, postcode FROM goods_communities WHERE postcode IS NOT NULL`);
  const commByPc = new Map();
  for (const c of communities) {
    if (!commByPc.has(c.postcode)) commByPc.set(c.postcode, []);
    commByPc.get(c.postcode).push(c);
  }

  // Fetch buyer entities in batches
  const postcodes = [...new Set(communities.map(c => c.postcode).filter(Boolean))];
  console.log(`   Searching ${postcodes.length} postcodes for buyer entities...`);

  const allBuyers = [];
  for (let i = 0; i < postcodes.length; i += 80) {
    const pcBatch = postcodes.slice(i, i + 80);
    const pcList = pcBatch.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
    const rows = await sql(`
      SELECT id, gs_id, canonical_name, abn, entity_type, sector, sub_sector,
             is_community_controlled, website, postcode
      FROM gs_entities
      WHERE postcode IN (${pcList})
        AND remoteness IN ('Remote Australia', 'Very Remote Australia')
        AND (canonical_name ILIKE '%store%' OR canonical_name ILIKE '%health%'
          OR canonical_name ILIKE '%housing%' OR canonical_name ILIKE '%council%'
          OR canonical_name ILIKE '%shire%' OR canonical_name ILIKE '%clinic%'
          OR canonical_name ILIKE '%school%' OR canonical_name ILIKE '%aged%'
          OR canonical_name ILIKE '%alpa%' OR canonical_name ILIKE '%art centre%'
          OR canonical_name ILIKE '%land council%' OR is_community_controlled = true)
    `);
    allBuyers.push(...rows);
  }
  console.log(`   Found ${allBuyers.length} buyer entities`);

  // Map by postcode
  const buyersByPc = new Map();
  for (const b of allBuyers) {
    if (!buyersByPc.has(b.postcode)) buyersByPc.set(b.postcode, []);
    buyersByPc.get(b.postcode).push(b);
  }

  // Build procurement entity rows
  const procRows = [];
  for (const [pc, comms] of commByPc) {
    const buyers = buyersByPc.get(pc) || [];
    for (const comm of comms) {
      for (const b of buyers) {
        procRows.push({
          community_id: comm.id,
          entity_id: b.id,
          gs_id: b.gs_id,
          entity_name: b.canonical_name,
          abn: b.abn,
          entity_type: b.entity_type,
          buyer_role: classifyBuyerRole(b),
          is_community_controlled: b.is_community_controlled || false,
          website: b.website,
        });
      }
    }
  }
  console.log(`   ${procRows.length} procurement entity rows to insert`);

  for (let i = 0; i < procRows.length; i += BATCH) {
    const batch = procRows.slice(i, i + BATCH);
    await insertProcEntities(batch);
    if (i % 500 === 0 && i > 0) process.stdout.write(`   ${i}/${procRows.length}\r`);
  }
  console.log(`   Done — inserted procurement entities\n`);

  // 10. Refresh MV
  console.log('9. Refreshing MV...');
  // Use psql for REFRESH since it's DDL
  const { execSync } = await import('child_process');
  const pw = process.env.DATABASE_PASSWORD;
  execSync(
    `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "REFRESH MATERIALIZED VIEW mv_goods_community_intelligence"`,
    { env: { ...process.env, PGPASSWORD: pw }, stdio: 'pipe', timeout: 30000 }
  );
  console.log('   Done\n');

  // 11. Summary
  const [summary] = await sql(`
    SELECT COUNT(*) as total, COUNT(CASE WHEN priority IN ('lead','active','warm') THEN 1 END) as high,
      COUNT(CASE WHEN priority = 'monitor' THEN 1 END) as monitor,
      COUNT(CASE WHEN total_local_entities > 0 THEN 1 END) as with_entities,
      SUM(total_local_entities) as entities_mapped, SUM(community_controlled_org_count) as cc_orgs
    FROM goods_communities
  `);
  const [proc] = await sql(`SELECT COUNT(*) as count FROM goods_procurement_entities`);

  console.log('=== SUMMARY ===');
  console.log(`Communities:           ${summary.total}`);
  console.log(`  Lead/Active/Warm:    ${summary.high}`);
  console.log(`  Monitor:             ${summary.monitor}`);
  console.log(`  With entities:       ${summary.with_entities}`);
  console.log(`Entities mapped:       ${summary.entities_mapped}`);
  console.log(`Community-controlled:  ${summary.cc_orgs}`);
  console.log(`Procurement entities:  ${proc.count}`);

  const products = await sql(`SELECT name, idiot_index, cost_advantage_pct FROM goods_products ORDER BY idiot_index DESC`);
  console.log('\n=== IDIOT INDEX ===');
  for (const p of products) console.log(`${p.name}: ${p.idiot_index}x (Goods advantage: ${p.cost_advantage_pct}%)`);

  const top = await sql(`
    SELECT community_name, state, total_local_entities, community_controlled_org_count,
      COALESCE(total_govt_contract_value, 0) as cv, priority
    FROM goods_communities ORDER BY total_local_entities DESC LIMIT 20
  `);
  console.log('\n=== TOP 20 COMMUNITIES ===');
  for (const c of top) {
    console.log(`${c.community_name} (${c.state}): ${c.total_local_entities} entities, ${c.community_controlled_org_count} CC, $${Number(c.cv).toLocaleString()} contracts [${c.priority}]`);
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
