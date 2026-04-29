#!/usr/bin/env node
/**
 * Transitive name → ABN → gs_entity_id linker for vic_grants_awarded.
 *
 * Idea: many unlinked grant rows have short or differently-formatted recipient
 * names ("Burnet Institute") that can't be fuzzy-matched against the long
 * canonical name in gs_entities ("The Macfarlane Burnet Institute For Medical
 * Research And Public Health Ltd"). But austender_contracts, political_donations,
 * and ato_tax_transparency all carry both NAME and ABN — they're a free
 * name→ABN dictionary. Build the dictionary, match unlinked grants against it,
 * then UPDATE via the matched ABN → gs_entities.id.
 *
 * Usage:
 *   node --env-file=.env scripts/link-vic-grants-via-abn-dict.mjs
 *   node --env-file=.env scripts/link-vic-grants-via-abn-dict.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE creds'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const APPLY = process.argv.includes('--apply');

// Same normalize SQL as link-vic-grants-fuzzy.mjs (kept in sync)
const NORM_SQL = (col) => `
  trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  lower(${col}),
                  '[' || chr(8216) || chr(8217) || chr(8220) || chr(8221) || ']', '', 'g'
                ),
                '[' || chr(8211) || chr(8212) || ']', ' ', 'g'
              ),
              '[''."&,();:/]', '', 'g'
            ),
            '-', ' ', 'g'
          ),
          '^\\s*(?:the\\s+)?(?:trustee\\s+for\\s+(?:the\\s+)?)?', '', 'i'
        ),
        '\\s+(?:incorporated|inc|ltd|limited|pty(?:\\s+ltd)?|the|aboriginal corporation|rntbc|trust|trustee|trading as.*|a\\.?b\\.?n\\.?\\s+\\d+)\\s*$',
        '',
        'gi'
      ),
      '\\s+', ' ', 'g'
    )
  )
`;

async function main() {
  const run = await logStart(db, 'link-vic-grants-via-abn-dict', 'VIC Grants ABN-Dictionary Linker');
  console.log(`=== VIC Grants ABN-Dictionary Linker ===`);
  console.log(`  mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  // Build the dictionary from each source separately to stay under the 8s timeout
  const dictMap = new Map(); // norm_name → abn (last write wins, picking the most recent source)
  let totalDictRows = 0;

  const sources = [
    { table: 'public.austender_contracts', name_col: 'supplier_name', abn_col: 'supplier_abn' },
    { table: 'public.political_donations', name_col: 'donor_name', abn_col: 'donor_abn' },
    { table: 'public.ato_tax_transparency', name_col: 'entity_name', abn_col: 'abn' },
    { table: 'public.justice_funding', name_col: 'recipient_name', abn_col: 'recipient_abn' },
  ];

  for (const src of sources) {
    console.log(`  ingesting from ${src.table}…`);
    let offset = 0;
    let pulled = 0;
    while (true) {
      const sql = `
        SELECT DISTINCT ${NORM_SQL(src.name_col)} AS norm, ${src.abn_col} AS abn
        FROM ${src.table}
        WHERE ${src.abn_col} IS NOT NULL
          AND ${src.abn_col} ~ '^[0-9]{11}$'
          AND ${src.name_col} IS NOT NULL
        ORDER BY 1
        LIMIT 1000 OFFSET ${offset}
      `;
      const { data, error } = await db.rpc('exec_sql', { query: sql });
      if (error) { console.log(`    err: ${error.message.slice(0, 80)}`); break; }
      if (!data || data.length === 0) break;
      data.forEach(r => {
        if (r.norm && r.norm.length > 4) dictMap.set(r.norm, r.abn);
      });
      pulled += data.length;
      if (data.length < 1000) break;
      offset += 1000;
    }
    console.log(`    +${pulled} rows pulled`);
    totalDictRows += pulled;
  }
  console.log(`  dictionary built: ${dictMap.size} unique normalized names`);

  // Pull unlinked grants
  console.log(`\n  fetching unlinked grants…`);
  const allUnlinked = [];
  let offset = 0;
  while (true) {
    const { data } = await db.rpc('exec_sql', {
      query: `SELECT id, ${NORM_SQL('recipient_name')} AS norm, recipient_name FROM public.vic_grants_awarded WHERE gs_entity_id IS NULL ORDER BY id LIMIT 1000 OFFSET ${offset}`,
    });
    if (!data || data.length === 0) break;
    allUnlinked.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  unlinked grants: ${allUnlinked.length}`);

  // Match against dictionary
  const proposals = []; // {grant_id, abn, name, dict_name}
  for (const g of allUnlinked) {
    if (!g.norm || g.norm.length <= 4) continue;
    const abn = dictMap.get(g.norm);
    if (abn) proposals.push({ grant_id: g.id, abn, name: g.recipient_name });
  }
  console.log(`  proposals via dictionary: ${proposals.length}`);
  if (proposals.length) {
    console.log(`  preview:`);
    proposals.slice(0, 8).forEach(p => console.log(`    · "${p.name}" → ABN ${p.abn}`));
  }

  // Resolve ABN → gs_entities.id (in chunks to fit timeout)
  console.log(`\n  resolving ABNs to gs_entities…`);
  const abnSet = [...new Set(proposals.map(p => p.abn))];
  const abnToEntity = new Map();
  for (let i = 0; i < abnSet.length; i += 500) {
    const slice = abnSet.slice(i, i + 500);
    const { data } = await db.rpc('exec_sql', {
      query: `SELECT abn, id FROM public.gs_entities WHERE abn IN (${slice.map(a => `'${a}'`).join(',')})`,
    });
    (data || []).forEach(r => abnToEntity.set(r.abn, r.id));
  }
  console.log(`  ABNs resolved: ${abnToEntity.size} of ${abnSet.length}`);

  const resolvable = proposals.filter(p => abnToEntity.has(p.abn));
  console.log(`  resolvable proposals: ${resolvable.length} (rest are ABNs not yet in gs_entities)`);

  // Save proposals CSV
  const lines = ['grant_id,abn,entity_id,recipient_name'];
  resolvable.forEach(p => lines.push(`${p.grant_id},${p.abn},${abnToEntity.get(p.abn)},"${p.name.replace(/"/g, '""')}"`));
  writeFileSync('data/vic-grants-abn-dict-proposals.csv', lines.join('\n'));
  console.log(`  saved → data/vic-grants-abn-dict-proposals.csv`);

  if (!APPLY) {
    console.log(`\n  DRY RUN — pass --apply to write ${resolvable.length} updates`);
    await logComplete(db, run.id, { items_found: resolvable.length, items_new: 0, status: 'success' });
    return;
  }

  // Apply via psql -f (exec_sql can't UPDATE)
  const sqlPath = 'data/vic-grants-abn-dict-apply.sql';
  const sqlLines = ['BEGIN;'];
  for (let i = 0; i < resolvable.length; i += 200) {
    const batch = resolvable.slice(i, i + 200);
    const values = batch.map(p => `('${p.grant_id}','${abnToEntity.get(p.abn)}')`).join(',');
    sqlLines.push(`UPDATE public.vic_grants_awarded v SET gs_entity_id = m.entity_id::uuid FROM (VALUES ${values}) AS m(grant_id, entity_id) WHERE v.id::text = m.grant_id AND v.gs_entity_id IS NULL;`);
  }
  sqlLines.push('COMMIT;');
  writeFileSync(sqlPath, sqlLines.join('\n'));

  const PG = process.env.DATABASE_PASSWORD;
  if (!PG) { console.error(`  DATABASE_PASSWORD missing`); process.exit(1); }
  const out = execSync(
    `PGPASSWORD="${PG}" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f ${sqlPath} -t -A 2>&1`,
    { encoding: 'utf-8' }
  );
  const matches = out.match(/UPDATE (\d+)/g) || [];
  const applied = matches.reduce((s, m) => s + Number(m.replace('UPDATE ', '')), 0);
  console.log(`\n  ✓ applied ${applied} updates`);

  console.log(`\n=== Summary ===`);
  console.log(`  dictionary: ${dictMap.size} names · proposals: ${proposals.length} · resolvable: ${resolvable.length} · applied: ${applied}`);
  await logComplete(db, run.id, { items_found: resolvable.length, items_new: applied, status: 'success' });
}

main().catch(async err => {
  console.error('Fatal:', err);
  process.exit(1);
});
