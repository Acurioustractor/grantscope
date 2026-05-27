#!/usr/bin/env node
/**
 * Task 3: drop the 9 AGIL template-noise localities (all 52 beds/6 washers default).
 * Approved by Ben 2026-05-27 ("Drop fully"). Restore-first; reversible.
 *
 *   node --env-file=.env scripts/drop-goods-noise-localities.mjs            # dry-run
 *   node --env-file=.env scripts/drop-goods-noise-localities.mjs --apply    # writes
 *
 * Deletes: 9 GHL Demand-Register opps + their placeholder contacts;
 *          9 goods_communities rows (CASCADE clears their entities/signals).
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
// CASCADE-deleting the 9 communities also deletes 147 linked entities (incl. real ones
// like NLC/AMSANT). --ghl-only does the GHL signal cleanup WITHOUT touching the DB.
const GHL_ONLY = process.argv.includes('--ghl-only');
const DB_ONLY = process.argv.includes('--db-only'); // GHL opps already deleted; do the DB cascade only
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_KEY = process.env.GHL_API_KEY;

const NAMES = ['THULKURR','NEW MERINEE','GUNUN WOONAM','SHIPTON FLATS','FORDY FARM','AAYKA','THAANGKUNH-NHIIN','BANNICK BURN','JILUNDARINA'];
// GHL Demand-Register opp + placeholder contact ids (from audit 2026-05-27)
const GHL_RECORDS = [
  ['cj7CXxIDLzKMxIVHHpNm','7sp5Zwueh0OKblAKQirR','THULKURR'],
  ['8CAq5cV6LBlozjP4fmbo','xBxaigCAdO1v8ARO1lo2','NEW MERINEE'],
  ['7rqTX3XLuiwMz8cvLMw3','gPxPrnGkA01DbSigTaYM','GUNUN WOONAM'],
  ['HTtygM4ogZ3gacHk3wwE','dYbBIH1H5deXDEerV5HE','SHIPTON FLATS'],
  ['58uGnRzT5FdHuDAvjKia','fm0tdDRDfl3EFTOg1JS7','FORDY FARM'],
  ['1HJOMb5vZMw0ulxm2tBS','jkXvzq4QJDPKCur8akIX','AAYKA'],
  ['NVnUPdbDuJlKwlFT4Zx6','cAt1QstivkhGfT2ShFAc','THAANGKUNH-NHIIN'],
  ['omkK7FwtMTormWvwpXcK','wu6SihnJXkEkKrUYtheG','BANNICK BURN'],
  ['seEc4BT9h5csxlXAJVhO','Q0HsirXpDJJ3vLpNIKmj','JILUNDARINA'],
];

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}`);
  return data || [];
}
async function ghlDelete(path) {
  const r = await fetch(`${GHL_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${GHL_KEY}`, Version: '2021-07-28' },
  });
  if (!r.ok) throw new Error(`GHL ${r.status}: ${await r.text()}`);
}

async function main() {
  const inList = NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
  const rows = await sql(`SELECT id, community_name, state, demand_beds, demand_washers FROM goods_communities WHERE upper(community_name) IN (${inList})`);
  const ids = rows.map((r) => r.id);
  const cascade = ids.length
    ? await sql(`SELECT
        (SELECT count(*) FROM goods_procurement_entities WHERE community_id = ANY(ARRAY['${ids.join("','")}']::uuid[])) entities,
        (SELECT count(*) FROM goods_procurement_signals WHERE community_id = ANY(ARRAY['${ids.join("','")}']::uuid[])) signals`)
    : [{ entities: 0, signals: 0 }];

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`goods_communities rows matched: ${rows.length}/${NAMES.length}`);
  rows.forEach((r) => console.log(`  ${r.community_name} (${r.state}) beds:${r.demand_beds} id:${r.id}`));
  console.log(`Will CASCADE: ${cascade[0].entities} entities + ${cascade[0].signals} signals`);
  console.log(`GHL deletes: ${GHL_RECORDS.length} opps + ${GHL_RECORDS.length} placeholder contacts\n`);

  if (!APPLY) { console.log('(Dry-run. Re-run with --apply.)'); return; }

  // Capture the entities + signals to be deleted, for full reversibility.
  const cascadeEntities = ids.length
    ? await sql(`SELECT id, entity_name, abn, fit_score, buyer_role, community_id FROM goods_procurement_entities WHERE community_id = ANY(ARRAY['${ids.join("','")}']::uuid[])`)
    : [];
  const cascadeSignals = ids.length
    ? await sql(`SELECT * FROM goods_procurement_signals WHERE community_id = ANY(ARRAY['${ids.join("','")}']::uuid[])`)
    : [];
  const restorePath = '/Users/benknight/Code/grantscope/thoughts/2026-05-27-goods-9-noise-drop-restore.json';
  fs.writeFileSync(restorePath, JSON.stringify({ removedAt: new Date().toISOString(), communities: rows, ghl: GHL_RECORDS, cascade: cascade[0], cascadeEntities, cascadeSignals }, null, 2));
  console.log(`Restore snapshot (incl. ${cascadeEntities.length} entities + ${cascadeSignals.length} signals): ${restorePath}\n`);

  let ok = 0, fail = 0;
  if (!DB_ONLY) {
    for (const [opp, contact, name] of GHL_RECORDS) {
      try { await ghlDelete(`/opportunities/${opp}`); console.log(`✓ GHL opp ${name}`); ok++; }
      catch (e) { console.error(`✗ GHL opp ${name}: ${e.message}`); fail++; }
      try { await ghlDelete(`/contacts/${contact}`); ok++; }
      catch (e) { console.error(`✗ GHL contact ${name}: ${e.message}`); fail++; }
    }
  }
  if (GHL_ONLY) {
    console.log(`\n(--ghl-only: DB rows left intact — ${cascade[0].entities} entities NOT cascaded.)`);
  } else if (ids.length) {
    // exec_sql is SELECT-only → PostgREST writes. signals FK = RESTRICT (delete first);
    // entities FK = CASCADE but delete explicitly too for determinism. Then communities.
    let e;
    ({ error: e } = await supabase.from('goods_procurement_signals').delete().in('community_id', ids));
    if (e) throw new Error(`signals delete: ${e.message}`);
    ({ error: e } = await supabase.from('goods_procurement_entities').delete().in('community_id', ids));
    if (e) throw new Error(`entities delete: ${e.message}`);
    ({ error: e } = await supabase.from('goods_communities').delete().in('id', ids));
    if (e) throw new Error(`communities delete: ${e.message}`);
    console.log(`✓ deleted ${ids.length} communities + ${cascadeEntities.length} entities + ${cascadeSignals.length} signals`);
  }
  console.log(`\n── Done ── GHL ok:${ok} fail:${fail}; DB rows deleted:${ids.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
