#!/usr/bin/env node
/**
 * Anchor-gap backfill: add the marquee remote-NT councils + big ACCHOs that the operating
 * model expects but goods_procurement_entities was MISSING. Flagged in
 * thoughts/shared/handoffs/goods-foundation-pipeline-2026-05-27/buyers-candidates.md (Table 3).
 *
 * Mirrors add-goods-anchor-buyers.mjs. Idempotent (skips ABNs already present). Restore snapshot.
 *   node --env-file=.env scripts/backfill-goods-anchor-councils-acchos-2026-05-27.mjs          # dry-run
 *   node --env-file=.env scripts/backfill-goods-anchor-councils-acchos-2026-05-27.mjs --apply
 *
 * Data provenance: every abn + govt_contract_value/count is REAL, aggregated by ABN from
 * austender_contracts (queried 2026-05-27). No values invented. Sunrise Health + Mala'la Health
 * are NOT austender suppliers (no verifiable ABN/contract) → deliberately EXCLUDED, listed below
 * for manual add. fit_score = 70 ("high-fit anchor prospect, contract-evidenced, NOT yet warm")
 * — deliberately below the 85 floor the original script used for genuinely-warm relationships.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FIT = 70; // anchor-prospect floor (warm relationships are 85; cold default scoring under-rates these)

// abn + contract evidence aggregated by ABN from austender_contracts (2026-05-27). community_id=null
// (councils span many communities — same as Outback Stores in the original anchor script).
const ANCHORS = [
  { entity_name: 'MacDonnell Regional Council',                         abn: '21340804903', buyer_role: 'council',        is_community_controlled: false, govt_contract_value: 44125295, govt_contract_count: 32 },
  { entity_name: 'Roper Gulf Regional Council',                         abn: '94746956090', buyer_role: 'council',        is_community_controlled: false, govt_contract_value: 22248695, govt_contract_count: 29 },
  { entity_name: 'Victoria Daly Regional Council',                      abn: '66931675319', buyer_role: 'council',        is_community_controlled: false, govt_contract_value: 9824405,  govt_contract_count: 29 },
  { entity_name: 'West Daly Regional Council',                          abn: '25966579574', buyer_role: 'council',        is_community_controlled: false, govt_contract_value: 4518868,  govt_contract_count: 17 },
  { entity_name: 'Barkly Regional Council',                             abn: '32171281456', buyer_role: 'council',        is_community_controlled: false, govt_contract_value: 3591517,  govt_contract_count: 8 },
  { entity_name: 'East Arnhem Regional Council',                        abn: '92334301078', buyer_role: 'council',        is_community_controlled: false, govt_contract_value: 2701282,  govt_contract_count: 9 },
  { entity_name: 'Central Australian Aboriginal Congress',             abn: '76210591710', buyer_role: 'health_service', is_community_controlled: true,  govt_contract_value: 2039174,  govt_contract_count: 5 },
  { entity_name: 'Laynhapuy Homelands Aboriginal Corporation',         abn: '86695642473', buyer_role: 'community_org',  is_community_controlled: true,  govt_contract_value: 1073818,  govt_contract_count: 11 },
  { entity_name: 'Katherine West Health Board Aboriginal Corporation', abn: '23351866925', buyer_role: 'health_service', is_community_controlled: true,  govt_contract_value: 168217,   govt_contract_count: 1 },
];
// NOT added (no verifiable ABN/contract in austender — do NOT fabricate): Sunrise Health Service
// Aboriginal Corporation, Mala'la Health Service Aboriginal Corporation (Mala'la already a GHL contact).

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}  (target: goods_procurement_entities)\n`);
  const abns = ANCHORS.map((a) => a.abn);
  const { data: existing, error: exErr } = await supabase.from('goods_procurement_entities').select('abn').in('abn', abns);
  if (exErr) throw new Error(`existence check: ${exErr.message}`);
  const have = new Set((existing || []).map((r) => r.abn));

  const toInsert = ANCHORS.filter((a) => !have.has(a.abn)).map((a) => ({
    entity_name: a.entity_name, abn: a.abn, buyer_role: a.buyer_role, community_id: null,
    is_community_controlled: a.is_community_controlled, relationship_status: 'prospect',
    govt_contract_value: a.govt_contract_value, govt_contract_count: a.govt_contract_count, fit_score: FIT,
  }));

  for (const a of toInsert) console.log(`  + ${a.entity_name.padEnd(52)} ${a.buyer_role.padEnd(14)} fit:${a.fit_score}  $${a.govt_contract_value.toLocaleString()} / ${a.govt_contract_count} contracts  abn:${a.abn}`);
  if (have.size) console.log(`  (skip ${have.size} already present: ${[...have].join(', ')})`);
  console.log(`\nWould insert: ${toInsert.length}`);

  if (!APPLY) { console.log('\n(Dry-run. Re-run with --apply to write.)'); return; }
  if (!toInsert.length) { console.log('Nothing to insert.'); return; }

  const restorePath = '/Users/benknight/Code/grantscope/thoughts/2026-05-27-goods-anchor-councils-acchos-backfill.json';
  fs.writeFileSync(restorePath, JSON.stringify({ at: new Date().toISOString(), inserted: toInsert }, null, 2));
  console.log(`Restore snapshot: ${restorePath}`);

  const { data, error } = await supabase.from('goods_procurement_entities').insert(toInsert).select('id, entity_name, fit_score');
  if (error) throw new Error(`anchor backfill insert: ${error.message}`);
  console.log(`✓ inserted ${data.length} anchor buyers`);
  data.forEach((r) => console.log(`   ${r.id}  ${r.entity_name}  fit:${r.fit_score}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
