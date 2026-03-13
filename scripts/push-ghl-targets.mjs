#!/usr/bin/env node
/**
 * push-ghl-targets.mjs
 *
 * Scores goods communities and pushes top targets to GoHighLevel CRM
 * as contacts + opportunities. Uses the existing GHL API integration.
 *
 * Env: GHL_API_KEY, GHL_LOCATION_ID, GHL_GOODS_PIPELINE_ID (optional)
 *
 * Run: node --env-file=.env scripts/push-ghl-targets.mjs [--dry-run] [--limit 100]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 100;

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}\nQuery: ${query.slice(0, 300)}`);
  return data || [];
}

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

async function ghlFetch(endpoint, options = {}) {
  if (!GHL_API_KEY) throw new Error('GHL_API_KEY not set');
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${res.status}: ${text}`);
  }
  return res.json();
}

function scoreCommunity(c) {
  // Dollar value of demand
  const bedValue = (Number(c.demand_beds) || 0) * 850;
  const washerValue = (Number(c.demand_washers) || 0) * 1200;
  const fridgeValue = (Number(c.demand_fridges) || 0) * 1500;
  const totalDemandValue = bedValue + washerValue + fridgeValue;

  // Multipliers
  const remoteMultiplier = {
    'Very Remote Australia': 2.0,
    'Remote Australia': 1.5,
    'Outer Regional Australia': 1.0,
  }[c.remoteness] || 0.8;

  const entityMultiplier = Math.min(2.0, 1 + (Number(c.community_controlled_org_count) || 0) * 0.1);
  const fundingSignal = (Number(c.total_govt_contract_value) || 0) > 0 ? 1.3 : 1.0;

  const score = totalDemandValue * remoteMultiplier * entityMultiplier * fundingSignal;

  // Tier classification
  let tier;
  if (totalDemandValue > 500000) tier = 'hot';
  else if (totalDemandValue > 100000) tier = 'warm';
  else tier = 'nurture';

  return { score, tier, totalDemandValue };
}

async function main() {
  console.log(`=== Push Goods Targets to GHL ===${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // 1. Load communities with demand data
  const communities = await sqlAll(`
    SELECT
      gc.id, gc.community_name, gc.state, gc.postcode, gc.remoteness,
      gc.estimated_population, gc.estimated_households,
      gc.demand_beds, gc.demand_washers, gc.demand_fridges,
      gc.total_govt_contract_value, gc.total_justice_funding,
      gc.community_controlled_org_count, gc.total_local_entities,
      gc.housing_org_count, gc.health_service_count,
      gc.nearest_staging_hub, gc.freight_corridor, gc.priority,
      gc.known_buyer_name
    FROM goods_communities gc
    WHERE gc.demand_beds > 0
  `, 'gc.id');
  console.log(`Found ${communities.length} communities with demand data`);

  // 2. Score and rank
  const scored = communities.map(c => ({
    ...c,
    ...scoreCommunity(c),
  })).sort((a, b) => b.score - a.score);

  const targets = scored.slice(0, LIMIT);
  console.log(`Top ${targets.length} targets selected\n`);

  // Summary by tier
  const tiers = { hot: 0, warm: 0, nurture: 0 };
  for (const t of targets) tiers[t.tier]++;
  console.log(`Tier breakdown: hot=${tiers.hot}, warm=${tiers.warm}, nurture=${tiers.nurture}\n`);

  // 3. Load nearby procurement entities for each target
  const procEntities = await sqlAll(`
    SELECT gpe.id, gpe.community_id, gpe.entity_name, gpe.buyer_role,
           gpe.estimated_annual_spend, gpe.govt_contract_value
    FROM goods_procurement_entities gpe
    WHERE gpe.estimated_annual_spend > 0
  `, 'gpe.id');
  const procByCommunity = new Map();
  for (const pe of procEntities) {
    if (!procByCommunity.has(pe.community_id)) procByCommunity.set(pe.community_id, []);
    procByCommunity.get(pe.community_id).push(pe);
  }

  // 4. Load grant opportunities by state
  const grantsByState = new Map();
  const grantRows = await sql(`
    SELECT
      CASE
        WHEN array_to_string(focus_areas, ',') ILIKE '%NT%' OR array_to_string(focus_areas, ',') ILIKE '%northern territory%' THEN 'NT'
        WHEN array_to_string(focus_areas, ',') ILIKE '%WA%' OR array_to_string(focus_areas, ',') ILIKE '%western australia%' THEN 'WA'
        WHEN array_to_string(focus_areas, ',') ILIKE '%QLD%' OR array_to_string(focus_areas, ',') ILIKE '%queensland%' THEN 'QLD'
        WHEN array_to_string(focus_areas, ',') ILIKE '%SA%' OR array_to_string(focus_areas, ',') ILIKE '%south australia%' THEN 'SA'
        WHEN array_to_string(focus_areas, ',') ILIKE '%NSW%' OR array_to_string(focus_areas, ',') ILIKE '%new south wales%' THEN 'NSW'
        ELSE 'national'
      END as matched_state,
      COUNT(*) as grant_count
    FROM grant_opportunities
    WHERE (status != 'closed' OR status IS NULL)
      AND (array_to_string(categories, ',') ILIKE '%indigenous%' OR array_to_string(categories, ',') ILIKE '%housing%' OR array_to_string(categories, ',') ILIKE '%community%' OR array_to_string(categories, ',') ILIKE '%remote%')
    GROUP BY matched_state
  `);
  for (const r of grantRows) {
    grantsByState.set(r.matched_state, Number(r.grant_count));
  }

  // 5. Push to GHL (or print in dry-run)
  if (DRY_RUN) {
    console.log('Top 20 targets (dry run):\n');
    console.log('Rank | Community | State | Pop | Beds | Demand $ | Tier | Score | Buyers');
    console.log('-----|-----------|-------|-----|------|----------|------|-------|-------');
    for (let i = 0; i < Math.min(20, targets.length); i++) {
      const t = targets[i];
      const buyers = procByCommunity.get(t.id)?.length || 0;
      console.log(
        `${(i + 1).toString().padStart(4)} | ${t.community_name.slice(0, 25).padEnd(25)} | ${t.state.padEnd(3)} | ` +
        `${String(t.estimated_population || 0).padStart(5)} | ${String(t.demand_beds || 0).padStart(4)} | ` +
        `$${(t.totalDemandValue / 1000).toFixed(0).padStart(6)}K | ${t.tier.padEnd(7)} | ` +
        `${t.score.toFixed(0).padStart(8)} | ${buyers}`
      );
    }
    console.log('\nDry run complete — no data pushed to GHL.');
    return;
  }

  if (!GHL_API_KEY) {
    console.log('GHL_API_KEY not set — printing summary instead.\n');
    printSummary(targets, procByCommunity, grantsByState);
    return;
  }

  // Get pipeline and stages
  const pipelines = await ghlFetch(`/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`);
  let pipelineId = process.env.GHL_GOODS_PIPELINE_ID;
  let stageIds = {};

  const goodsPipeline = pipelines.pipelines?.find(p =>
    pipelineId ? p.id === pipelineId : (p.name.toLowerCase().includes('goods') || p.name.toLowerCase().includes('country'))
  );

  if (goodsPipeline) {
    pipelineId = goodsPipeline.id;
    for (const stage of goodsPipeline.stages || []) {
      stageIds[stage.name.toLowerCase()] = stage.id;
    }
    console.log(`Pipeline: ${goodsPipeline.name} (${pipelineId})`);
    console.log(`Stages: ${Object.keys(stageIds).join(', ')}`);
  } else {
    console.log('No goods pipeline found. Set GHL_GOODS_PIPELINE_ID to specify.');
    printSummary(targets, procByCommunity, grantsByState);
    return;
  }

  let pushed = 0;
  let errors = 0;

  for (const t of targets) {
    try {
      const buyers = procByCommunity.get(t.id) || [];
      const grants = (grantsByState.get(t.state) || 0) + (grantsByState.get('national') || 0);
      const nearestBuyer = buyers[0]?.entity_name || t.known_buyer_name || 'Unknown';

      // Upsert contact for the community
      const slugEmail = `${t.community_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@goods.civicgraph.io`;
      let contactId;
      try {
        // Try create first
        const contact = await ghlFetch('/contacts/', {
          method: 'POST',
          body: JSON.stringify({
            locationId: GHL_LOCATION_ID,
            firstName: t.community_name,
            lastName: t.state,
            email: slugEmail,
            companyName: `${t.community_name}, ${t.state}`,
            tags: [
              `goods-${t.tier}`,
              `state-${t.state}`,
              t.remoteness ? `remoteness-${t.remoteness.replace(/\s+/g, '-').toLowerCase()}` : null,
            ].filter(Boolean),
            source: 'CivicGraph Goods Intelligence',
          }),
        });
        contactId = contact?.contact?.id;
      } catch (createErr) {
        // Contact likely exists — look up by email
        const lookup = await ghlFetch(
          `/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(slugEmail)}`
        );
        contactId = lookup?.contact?.id;
        if (!contactId) throw createErr;
      }

      // Create opportunity if we have a pipeline
      if (pipelineId && contactId) {
        // All new targets go into "New Lead" stage
        const stageId = stageIds['new lead'] || stageIds['new'] || Object.values(stageIds)[0];
        if (stageId) {
          await ghlFetch('/opportunities/', {
            method: 'POST',
            body: JSON.stringify({
              locationId: GHL_LOCATION_ID,
              name: `${t.community_name} — Goods Demand $${(t.totalDemandValue / 1000).toFixed(0)}K`,
              pipelineId,
              pipelineStageId: stageId,
              status: 'open',
              monetaryValue: Math.round(t.totalDemandValue),
              contactId,
            }),
          });
        }
      }

      pushed++;
      process.stdout.write(`\r  Pushed ${pushed}/${targets.length} (${errors} errors)`);

      // Rate limit: GHL allows ~100 requests/min
      if (pushed % 5 === 0) await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      errors++;
      console.error(`\n  Error pushing ${t.community_name}: ${err.message}`);
    }
  }

  console.log(`\n\nGHL push complete: ${pushed} targets pushed, ${errors} errors`);
}

function printSummary(targets, procByCommunity, grantsByState) {
  console.log('Top 20 targets:\n');
  console.log('Rank | Community | State | Pop | Beds | Demand $ | Tier | Buyers | Grants');
  console.log('-----|-----------|-------|-----|------|----------|------|--------|-------');
  for (let i = 0; i < Math.min(20, targets.length); i++) {
    const t = targets[i];
    const buyers = procByCommunity.get(t.id)?.length || 0;
    const grants = (grantsByState.get(t.state) || 0) + (grantsByState.get('national') || 0);
    console.log(
      `${(i + 1).toString().padStart(4)} | ${t.community_name.slice(0, 25).padEnd(25)} | ${t.state.padEnd(3)} | ` +
      `${String(t.estimated_population || 0).padStart(5)} | ${String(t.demand_beds || 0).padStart(4)} | ` +
      `$${(t.totalDemandValue / 1000).toFixed(0).padStart(6)}K | ${t.tier.padEnd(7)} | ${String(buyers).padStart(6)} | ${grants}`
    );
  }

  const totalDemand = targets.reduce((sum, t) => sum + t.totalDemandValue, 0);
  console.log(`\nTotal demand across ${targets.length} targets: $${(totalDemand / 1_000_000).toFixed(1)}M`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
