#!/usr/bin/env node
/**
 * READ-ONLY diagnostics for the Goods buyer activation plan. SELECTs only.
 * Run: node --env-file=.env scripts/query-goods-buyers-readonly.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}`);
  return data || [];
}

const j = (x) => JSON.stringify(x);

async function main() {
  console.log('── 1. ENTITY SUMMARY ──');
  console.log(j(await sql(`
    SELECT count(*) total,
           count(*) FILTER (WHERE fit_score > 0) scored,
           count(*) FILTER (WHERE ghl_opportunity_id IS NOT NULL) pushed,
           count(*) FILTER (WHERE abn IS NOT NULL) with_abn
    FROM goods_procurement_entities`)));

  console.log('\n── 2. ANCHOR PRESENCE (grouped) ──');
  const anchors = await sql(`
    SELECT entity_name, count(*) dups, max(fit_score) fit, max(buyer_role) role,
           bool_or(is_community_controlled) cc, bool_or(ghl_opportunity_id IS NOT NULL) pushed
    FROM goods_procurement_entities
    WHERE entity_name ILIKE ANY (ARRAY['%outback stores%','%centrecorp%','%miwatj%','%alpa%','%arnhem land progress%','%tangentyere%'])
    GROUP BY entity_name ORDER BY entity_name`);
  anchors.forEach((r) => console.log(`  ${r.entity_name}  dups:${r.dups} fit:${r.fit} role:${r.role} cc:${r.cc} pushed:${r.pushed}`));
  console.log(`  (distinct names: ${anchors.length})`);

  console.log('\n── 3. TOP 25 BY fit_score ──');
  const top = await sql(`
    SELECT entity_name, fit_score, buyer_role, govt_contract_value, govt_contract_count,
           is_community_controlled,
           (ghl_opportunity_id IS NOT NULL) AS pushed
    FROM goods_procurement_entities
    ORDER BY fit_score DESC NULLS LAST, govt_contract_value DESC NULLS LAST
    LIMIT 25`);
  top.forEach((r, i) => console.log(
    `${String(i + 1).padStart(2)}. ${r.entity_name}  fit:${r.fit_score}  role:${r.buyer_role}  gov:$${r.govt_contract_value || 0}(${r.govt_contract_count || 0})  cc:${r.is_community_controlled}  pushed:${r.pushed}`));

  console.log('\n── 4. THE 9 LEFTOVER COMMUNITIES (demand basis) ──');
  const nine = await sql(`
    SELECT community_name, state, demand_beds, demand_washers
    FROM goods_communities
    WHERE upper(community_name) = ANY (ARRAY['THULKURR','NEW MERINEE','GUNUN WOONAM','SHIPTON FLATS','FORDY FARM','AAYKA','THAANGKUNH-NHIIN','BANNICK BURN','JILUNDARINA'])
    ORDER BY community_name`);
  nine.forEach((r) => console.log(
    `  ${r.community_name} (${r.state})  beds:${r.demand_beds}  washers:${r.demand_washers}`));
  console.log(`  (rows found: ${nine.length})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
