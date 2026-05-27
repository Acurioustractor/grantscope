#!/usr/bin/env node
/**
 * Task 1: add the 3 warm anchor buyers + dedupe ALPA. Approved by Ben 2026-05-27.
 * (Centrecorp skipped — it's a funder, in Supporter Journey.)
 *
 *   node --env-file=.env scripts/add-goods-anchor-buyers.mjs            # dry-run
 *   node --env-file=.env scripts/add-goods-anchor-buyers.mjs --apply
 *
 * - Inserts Outback Stores / Miwatj Health / Tangentyere Council with real ABNs +
 *   contract evidence (austender) and a warmth fit_score floor of 85 (these known
 *   relationships should rank near the top; the contract scorer under-rates buyers).
 * - Dedupes ALPA: 256 rows (128 communities x 2 name-casings) -> 1 per community (128),
 *   keeping the proper-cased name. Restore-first.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = async (q) => { const { data, error } = await supabase.rpc('exec_sql', { query: q }); if (error) throw new Error(error.message); return data || []; };

const WARMTH_FLOOR = 85;
// contract evidence pulled 2026-05-27 from austender_contracts (goods_value=0 for all → no +50)
const ANCHORS = [
  { entity_name: 'Outback Stores Pty Ltd', abn: '63120661234', buyer_role: 'store', community_id: null, is_community_controlled: false, website: 'https://www.outbackstores.com.au', govt_contract_value: 92000, govt_contract_count: 1 },
  { entity_name: 'Miwatj Health Aboriginal Corporation', abn: '96843428729', buyer_role: 'health_service', community_id: '9651e030-c893-40de-aee8-2df0d45a6706', is_community_controlled: true, website: 'https://www.miwatj.com.au', govt_contract_value: 48000, govt_contract_count: 1 },
  { entity_name: 'Tangentyere Council Aboriginal Corporation', abn: '81688672692', buyer_role: 'council', community_id: '6cec2c4f-d390-4bff-95e1-5ad9db9b08da', is_community_controlled: true, website: 'https://www.tangentyere.org.au', govt_contract_value: 3113493.21, govt_contract_count: 14 },
];
// contract-evidence fit (hydrate formula): +20 if total>$1M, +15 if count>10, +50 goods, +15 grant.
const contractFit = (a) => (a.govt_contract_value > 1e6 ? 20 : 0) + (a.govt_contract_count > 10 ? 15 : 0);

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n── Anchors ──`);
  const existing = await sql(`SELECT abn FROM goods_procurement_entities WHERE abn IN ('63120661234','96843428729','81688672692')`);
  const have = new Set(existing.map((r) => r.abn));
  const toInsert = ANCHORS.filter((a) => !have.has(a.abn)).map((a) => ({
    entity_name: a.entity_name, abn: a.abn, buyer_role: a.buyer_role, community_id: a.community_id,
    is_community_controlled: a.is_community_controlled, relationship_status: 'prospect', website: a.website,
    govt_contract_value: a.govt_contract_value, govt_contract_count: a.govt_contract_count,
    fit_score: Math.max(WARMTH_FLOOR, contractFit(a)),
  }));
  toInsert.forEach((a) => console.log(`  + ${a.entity_name}  fit:${a.fit_score} (contract ${contractFit({ govt_contract_value: a.govt_contract_value, govt_contract_count: a.govt_contract_count })}, floor ${WARMTH_FLOOR})  abn:${a.abn} community:${a.community_id || 'multi/none'}`));
  if (have.size) console.log(`  (skip ${have.size} already present)`);

  // ALPA dedupe
  console.log(`\n── ALPA dedupe ──`);
  const alpa = await sql(`SELECT id, entity_name, community_id FROM goods_procurement_entities WHERE entity_name ILIKE '%arnhem land progress%'`);
  const PROPER = 'The Arnhem Land Progress Aboriginal Corporation';
  const byComm = new Map();
  for (const r of alpa) { const k = r.community_id || 'null'; (byComm.get(k) || byComm.set(k, []).get(k)).push(r); }
  const deleteIds = [];
  for (const [, group] of byComm) {
    group.sort((a, b) => (a.entity_name === PROPER ? -1 : 0) - (b.entity_name === PROPER ? -1 : 0));
    deleteIds.push(...group.slice(1).map((r) => r.id));
  }
  console.log(`  ALPA rows: ${alpa.length} across ${byComm.size} communities → keep ${byComm.size}, delete ${deleteIds.length} dup-casing rows`);

  if (!APPLY) { console.log('\n(Dry-run. Re-run with --apply.)'); return; }

  const restorePath = '/Users/benknight/Code/grantscope/thoughts/2026-05-27-goods-anchor-add-alpa-dedupe.json';
  fs.writeFileSync(restorePath, JSON.stringify({ at: new Date().toISOString(), inserted: toInsert, alpaDeletedIds: deleteIds, alpaAll: alpa }, null, 2));
  console.log(`\nRestore snapshot: ${restorePath}`);

  if (toInsert.length) {
    const { data, error } = await supabase.from('goods_procurement_entities').insert(toInsert).select('id, entity_name');
    if (error) throw new Error(`anchor insert: ${error.message}`);
    console.log(`✓ inserted ${data.length} anchors`);
  }
  if (deleteIds.length) {
    // delete in chunks to keep URLs short
    for (let i = 0; i < deleteIds.length; i += 50) {
      const { error } = await supabase.from('goods_procurement_entities').delete().in('id', deleteIds.slice(i, i + 50));
      if (error) throw new Error(`ALPA dedupe delete: ${error.message}`);
    }
    console.log(`✓ deleted ${deleteIds.length} ALPA dup rows (ALPA now 1/community)`);
  }
  console.log('\n── Done ──');
}
main().catch((e) => { console.error(e); process.exit(1); });
