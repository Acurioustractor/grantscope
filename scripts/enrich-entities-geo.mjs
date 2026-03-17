#!/usr/bin/env node
/**
 * Enrich gs_entities with geographic data.
 * 100% PostgREST. Updates by postcode batch.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAll(table, select, filters = []) {
  const results = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    for (const f of filters) f(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    results.push(...data);
    from += PAGE;
    if (data.length < PAGE) break;
  }
  return results;
}

async function main() {
  console.log('=== Entity Geographic Enrichment ===\n');

  // Build lookups
  console.log('Building postcode lookup...');
  const pcRows = await fetchAll('postcode_geo', 'postcode,lga_name,lga_code,remoteness_2021');
  const pcMap = new Map();
  for (const r of pcRows) {
    if (r.lga_name && !pcMap.has(r.postcode)) pcMap.set(r.postcode, r);
  }
  console.log(`  ${pcMap.size} postcodes with LGA data`);

  console.log('Building SEIFA lookup...');
  const seifaRows = await fetchAll('seifa_2021', 'postcode,index_type,decile_national');
  const seifaMap = new Map();
  for (const r of seifaRows) {
    if (r.index_type === 'IRSD' && r.decile_national && !seifaMap.has(r.postcode)) {
      seifaMap.set(r.postcode, r.decile_national);
    }
  }
  console.log(`  ${seifaMap.size} postcodes with SEIFA data\n`);

  // Get distinct postcodes from entities missing data — use a simpler query
  console.log('Getting distinct entity postcodes missing LGA...');
  const { data: lgaPostcodes, error: e1 } = await supabase
    .from('gs_entities')
    .select('postcode')
    .not('postcode', 'is', null)
    .is('lga_name', null)
    .limit(10000);
  if (e1) throw new Error(`LGA postcodes: ${e1.message}`);

  const uniquePc = [...new Set(lgaPostcodes.map(r => r.postcode))].sort();
  console.log(`  ${uniquePc.length} distinct postcodes need LGA\n`);

  // Also get postcodes missing SEIFA
  const { data: seifaPostcodes, error: e2 } = await supabase
    .from('gs_entities')
    .select('postcode')
    .not('postcode', 'is', null)
    .is('seifa_irsd_decile', null)
    .limit(10000);
  if (e2) throw new Error(`SEIFA postcodes: ${e2.message}`);

  const uniqueSeifaPc = [...new Set(seifaPostcodes.map(r => r.postcode))].sort();
  console.log(`  ${uniqueSeifaPc.length} distinct postcodes need SEIFA\n`);

  // Update LGA by postcode
  let lgaOk = 0, lgaErr = 0;
  console.log('Updating LGA + remoteness...');

  for (let i = 0; i < uniquePc.length; i++) {
    const pc = uniquePc[i];
    const geo = pcMap.get(pc);
    if (!geo) continue;

    const { error } = await supabase
      .from('gs_entities')
      .update({
        lga_name: geo.lga_name,
        lga_code: geo.lga_code,
        remoteness: geo.remoteness_2021,
      })
      .eq('postcode', pc)
      .is('lga_name', null);

    if (error) {
      lgaErr++;
      if (lgaErr <= 3) console.error(`  Error ${pc}: ${error.message}`);
    } else {
      lgaOk++;
    }

    if ((i + 1) % 100 === 0) console.log(`  LGA: ${i + 1}/${uniquePc.length} (ok: ${lgaOk}, err: ${lgaErr})`);
  }
  console.log(`  LGA done: ${lgaOk} postcodes updated, ${lgaErr} errors\n`);

  // Update SEIFA by postcode
  let seifaOk = 0, seifaErr = 0;
  console.log('Updating SEIFA...');

  for (let i = 0; i < uniqueSeifaPc.length; i++) {
    const pc = uniqueSeifaPc[i];
    const seifa = seifaMap.get(pc);
    if (seifa === undefined) continue;

    const { error } = await supabase
      .from('gs_entities')
      .update({ seifa_irsd_decile: seifa })
      .eq('postcode', pc)
      .is('seifa_irsd_decile', null);

    if (error) {
      seifaErr++;
      if (seifaErr <= 3) console.error(`  Error ${pc}: ${error.message}`);
    } else {
      seifaOk++;
    }

    if ((i + 1) % 100 === 0) console.log(`  SEIFA: ${i + 1}/${uniqueSeifaPc.length} (ok: ${seifaOk}, err: ${seifaErr})`);
  }
  console.log(`  SEIFA done: ${seifaOk} postcodes updated, ${seifaErr} errors\n`);

  // Also fill lga_code and remoteness for entities that have lga_name but missing those
  console.log('Backfilling lga_code + remoteness for entities with lga_name...');
  let codeOk = 0;
  for (const [pc, geo] of pcMap) {
    const { count } = await supabase
      .from('gs_entities')
      .select('id', { count: 'exact', head: true })
      .eq('postcode', pc)
      .is('lga_code', null)
      .not('lga_name', 'is', null);

    if (count > 0) {
      await supabase.from('gs_entities').update({ lga_code: geo.lga_code, remoteness: geo.remoteness_2021 }).eq('postcode', pc).is('lga_code', null);
      codeOk++;
    }
  }
  console.log(`  ${codeOk} postcodes backfilled with lga_code\n`);

  console.log('=== Done ===');
}

main().catch(err => { console.error(err); process.exit(1); });
