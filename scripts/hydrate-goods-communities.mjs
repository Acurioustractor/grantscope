#!/usr/bin/env node
/**
 * hydrate-goods-communities.mjs
 *
 * Fills empty intelligence columns in goods_communities using CivicGraph data:
 *   - total_govt_contract_value  ← mv_funding_by_postcode / mv_funding_by_lga
 *   - total_justice_funding      ← justice_funding by state
 *   - total_foundation_grants    ← grant_opportunities by state
 *   - entity counts              ← gs_entities by postcode/lga
 *   - seifa/remoteness           ← seifa_2021, postcode_geo
 *
 * Run: node --env-file=.env scripts/hydrate-goods-communities.mjs
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

// Paginated SQL for queries that may exceed 1000-row RPC limit
async function sqlAll(query, orderCol = 'id') {
  const PAGE = 900;
  let all = [];
  let offset = 0;
  while (true) {
    const page = await sql(`${query} ORDER BY ${orderCol} LIMIT ${PAGE} OFFSET ${offset}`);
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function main() {
  console.log('=== Hydrate Goods Communities from CivicGraph ===\n');

  // 1. Get all goods communities
  const communities = await sqlAll(`
    SELECT id, community_name, state, postcode, lga_name, lga_code, remoteness
    FROM goods_communities
  `, 'id');
  console.log(`Found ${communities.length} communities to hydrate\n`);

  // 2. Load funding by postcode (indexed lookup)
  const fundingByPostcode = new Map();
  const postcodeRows = await sqlAll(`
    SELECT postcode, state, entity_count, community_controlled_count,
           total_funding, relationship_count
    FROM mv_funding_by_postcode
    WHERE total_funding > 0 OR entity_count > 0
  `, 'postcode');
  for (const r of postcodeRows) {
    const key = `${r.postcode}-${r.state}`;
    fundingByPostcode.set(key, r);
    // Also store postcode-only for fallback
    if (!fundingByPostcode.has(r.postcode)) {
      fundingByPostcode.set(r.postcode, r);
    }
  }
  console.log(`Loaded ${postcodeRows.length} postcode funding rows`);

  // 3. Load funding by LGA
  const fundingByLga = new Map();
  const lgaRows = await sqlAll(`
    SELECT lga_code, lga_name, state, entity_count, community_controlled_count,
           total_funding, relationship_count, avg_seifa_decile
    FROM mv_funding_by_lga
    WHERE total_funding > 0 OR entity_count > 0
  `, 'lga_code');
  for (const r of lgaRows) {
    if (r.lga_code) fundingByLga.set(r.lga_code, r);
  }
  console.log(`Loaded ${lgaRows.length} LGA funding rows`);

  // 4. Load justice funding totals by state
  const justiceFunding = new Map();
  const justiceRows = await sql(`
    SELECT state, SUM(amount_dollars) as total_justice
    FROM justice_funding
    WHERE state IS NOT NULL
    GROUP BY state
  `);
  for (const r of justiceRows) {
    justiceFunding.set(r.state, Number(r.total_justice) || 0);
  }
  console.log(`Loaded justice funding for ${justiceRows.length} states`);

  // 5. Load entity counts by postcode from gs_entities
  const entityCountsByPostcode = new Map();
  const entityRows = await sqlAll(`
    SELECT postcode, state,
           COUNT(*) as entity_count,
           COUNT(*) FILTER (WHERE is_community_controlled = true) as cc_count,
           COUNT(*) FILTER (WHERE entity_type = 'indigenous_corp') as indigenous_count,
           COUNT(*) FILTER (WHERE sector ILIKE '%health%') as health_count,
           COUNT(*) FILTER (WHERE sector ILIKE '%housing%' OR canonical_name ILIKE '%housing%') as housing_count
    FROM gs_entities
    WHERE postcode IS NOT NULL
    GROUP BY postcode, state
  `, 'postcode');
  for (const r of entityRows) {
    const key = `${r.postcode}-${r.state}`;
    entityCountsByPostcode.set(key, r);
    if (!entityCountsByPostcode.has(r.postcode)) {
      entityCountsByPostcode.set(r.postcode, r);
    }
  }
  console.log(`Loaded entity counts for ${entityRows.length} postcode groups`);

  // 6. Load SEIFA data by postcode
  const seifaByPostcode = new Map();
  const seifaRows = await sqlAll(`
    SELECT postcode, score, decile_national
    FROM seifa_2021
    WHERE index_type = 'IRSD'
  `, 'postcode');
  for (const r of seifaRows) {
    seifaByPostcode.set(r.postcode, r);
  }
  console.log(`Loaded SEIFA IRSD for ${seifaRows.length} postcodes`);

  // 7. Load grant opportunities by state
  const grantsByState = new Map();
  const grantRows = await sql(`
    SELECT
      CASE
        WHEN array_to_string(focus_areas, ',') ILIKE '%NT%' OR array_to_string(focus_areas, ',') ILIKE '%northern territory%' THEN 'NT'
        WHEN array_to_string(focus_areas, ',') ILIKE '%WA%' OR array_to_string(focus_areas, ',') ILIKE '%western australia%' THEN 'WA'
        WHEN array_to_string(focus_areas, ',') ILIKE '%QLD%' OR array_to_string(focus_areas, ',') ILIKE '%queensland%' THEN 'QLD'
        WHEN array_to_string(focus_areas, ',') ILIKE '%SA%' OR array_to_string(focus_areas, ',') ILIKE '%south australia%' THEN 'SA'
        WHEN array_to_string(focus_areas, ',') ILIKE '%NSW%' OR array_to_string(focus_areas, ',') ILIKE '%new south wales%' THEN 'NSW'
        WHEN array_to_string(focus_areas, ',') ILIKE '%VIC%' OR array_to_string(focus_areas, ',') ILIKE '%victoria%' THEN 'VIC'
        WHEN array_to_string(focus_areas, ',') ILIKE '%TAS%' OR array_to_string(focus_areas, ',') ILIKE '%tasmania%' THEN 'TAS'
        ELSE 'national'
      END as matched_state,
      COUNT(*) as grant_count,
      SUM(COALESCE(amount_max, amount_min, 0)) as total_value
    FROM grant_opportunities
    WHERE status != 'closed' OR status IS NULL
    GROUP BY matched_state
  `);
  for (const r of grantRows) {
    grantsByState.set(r.matched_state, { count: Number(r.grant_count), value: Number(r.total_value) || 0 });
  }
  console.log(`Loaded grant opportunities for ${grantRows.length} state groups\n`);

  // 8. Hydrate each community
  let updated = 0;
  let skipped = 0;
  const BATCH_SIZE = 50;
  let batch = [];

  for (const c of communities) {
    // Try postcode match first, then LGA
    const pcKey = c.postcode && c.state ? `${c.postcode}-${c.state}` : null;
    const pcFunding = (pcKey && fundingByPostcode.get(pcKey)) || (c.postcode && fundingByPostcode.get(c.postcode)) || null;
    const lgaFunding = c.lga_code ? fundingByLga.get(c.lga_code) : null;

    const entityData = (pcKey && entityCountsByPostcode.get(pcKey)) || (c.postcode && entityCountsByPostcode.get(c.postcode)) || null;
    const seifa = c.postcode ? seifaByPostcode.get(c.postcode) : null;
    const stateJustice = c.state ? (justiceFunding.get(c.state) || 0) : 0;
    const stateGrants = c.state ? (grantsByState.get(c.state) || grantsByState.get('national') || { count: 0, value: 0 }) : { count: 0, value: 0 };
    const nationalGrants = grantsByState.get('national') || { count: 0, value: 0 };

    // Use best available funding source
    const funding = pcFunding || lgaFunding;

    const updates = {
      total_govt_contract_value: Number(funding?.total_funding) || 0,
      total_justice_funding: stateJustice,
      total_foundation_grants: (stateGrants.value || 0) + (nationalGrants.value || 0),
      total_local_entities: Number(entityData?.entity_count) || Number(funding?.entity_count) || 0,
      community_controlled_org_count: Number(entityData?.cc_count) || Number(funding?.community_controlled_count) || 0,
      health_service_count: Number(entityData?.health_count) || 0,
      housing_org_count: Number(entityData?.housing_count) || 0,
      data_quality_score: calculateDataQuality(funding, entityData, seifa, c),
      updated_at: new Date().toISOString(),
    };

    // Only set remoteness if not already set
    if (!c.remoteness && lgaFunding?.avg_seifa_decile) {
      // We don't have remoteness from LGA — leave it
    }

    batch.push({ id: c.id, ...updates });

    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch);
      updated += batch.length;
      batch = [];
      process.stdout.write(`\r  Updated ${updated}/${communities.length} communities`);
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await upsertBatch(batch);
    updated += batch.length;
  }

  console.log(`\n\nHydration complete: ${updated} communities updated\n`);

  // 9. Verify
  const verify = await sql(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE total_govt_contract_value > 0) as has_funding,
      COUNT(*) FILTER (WHERE total_justice_funding > 0) as has_justice,
      COUNT(*) FILTER (WHERE total_local_entities > 0) as has_entities,
      COUNT(*) FILTER (WHERE community_controlled_org_count > 0) as has_cc_orgs,
      ROUND(AVG(data_quality_score)::numeric, 2) as avg_dq_score
    FROM goods_communities
  `);
  console.log('Verification:');
  console.table(verify);
}

function calculateDataQuality(funding, entityData, seifa, community) {
  let score = 0;
  if (funding?.total_funding > 0) score += 25;
  if (entityData?.entity_count > 0) score += 25;
  if (seifa) score += 15;
  if (community.postcode) score += 15;
  if (community.lga_code) score += 10;
  if (community.remoteness) score += 10;
  return score;
}

async function upsertBatch(rows) {
  // Use individual updates since upsert requires all NOT NULL columns
  for (const { id, ...updates } of rows) {
    const { error } = await supabase
      .from('goods_communities')
      .update(updates)
      .eq('id', id);
    if (error) throw new Error(`Update error for ${id}: ${error.message}`);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
