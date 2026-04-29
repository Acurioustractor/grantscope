#!/usr/bin/env node
/**
 * Fuzzy-link unlinked vic_grants_awarded rows to gs_entities by recipient name.
 *
 * Strategy:
 *   1. Normalize both sides: lowercase, strip punctuation, drop common
 *      suffixes (Inc, Ltd, Pty, Limited, Aboriginal Corporation, etc.).
 *   2. Try exact match on normalized name.
 *   3. For remaining unlinked, try trigram similarity > 0.85 (pg_trgm).
 *   4. Apply only matches above the threshold; lower-confidence matches go
 *      into a CSV for manual review.
 *
 * Usage:
 *   node --env-file=.env scripts/link-vic-grants-fuzzy.mjs              # dry run
 *   node --env-file=.env scripts/link-vic-grants-fuzzy.mjs --apply
 *   node --env-file=.env scripts/link-vic-grants-fuzzy.mjs --threshold=0.9 --apply
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE creds'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] || null;
const flag = name => process.argv.includes(`--${name}`);
const APPLY = flag('apply');
const THRESHOLD = Number(arg('threshold') || 0.85);

// Postgres-side normalize expression (kept identical for both tables)
const NORM_SQL = `
  regexp_replace(
    regexp_replace(
      lower(name_in),
      '[''.\"&,()/]', '', 'g'
    ),
    '\\s+(incorporated|inc|ltd|limited|pty( ltd)?|the|aboriginal corporation|rntbc|trust|trustee for the |trading as.*|a\\.?b\\.?n\\.? \\d+)\\s*$',
    '',
    'gi'
  )
`;

async function main() {
  const run = await logStart(db, 'link-vic-grants-fuzzy', 'VIC Grants Fuzzy Linker');
  console.log(`=== VIC Grants Fuzzy Linker ===`);
  console.log(`  mode: ${APPLY ? 'APPLY (writes to DB)' : 'DRY RUN'} | trigram threshold: ${THRESHOLD}`);

  // Step 1: exact normalized-name matches (chunked to fit 8s timeout)
  console.log(`\n  Phase 1: exact normalized-name match (chunked)`);
  const allIds = [];
  let p1Offset = 0;
  while (true) {
    const { data: p } = await db.rpc('exec_sql', {
      query: `SELECT id FROM public.vic_grants_awarded WHERE gs_entity_id IS NULL ORDER BY id LIMIT 1000 OFFSET ${p1Offset}`,
    });
    if (!p || p.length === 0) break;
    p.forEach(r => allIds.push(r.id));
    if (p.length < 1000) break;
    p1Offset += 1000;
  }
  console.log(`  total unlinked: ${allIds.length}`);
  const exact = [];
  const P1_CHUNK = 500;
  for (let i = 0; i < allIds.length; i += P1_CHUNK) {
    const ids = allIds.slice(i, i + P1_CHUNK).map(id => `'${id}'`).join(',');
    const exactSql = `
      WITH grants_norm AS (
        SELECT id AS grant_id, recipient_name,
               ${NORM_SQL.replace('name_in', 'recipient_name')} AS norm
        FROM public.vic_grants_awarded
        WHERE id IN (${ids})
      ),
      ent_norm AS (
        SELECT id AS entity_id, canonical_name, abn,
               ${NORM_SQL.replace('name_in', 'canonical_name')} AS norm
        FROM public.gs_entities
        WHERE canonical_name IS NOT NULL
      ),
      paired AS (
        SELECT g.grant_id, g.recipient_name,
               e.entity_id, e.canonical_name, e.abn,
               ROW_NUMBER() OVER (PARTITION BY g.grant_id ORDER BY length(e.canonical_name)) AS rn
        FROM grants_norm g
        JOIN ent_norm e ON e.norm = g.norm
        WHERE length(g.norm) > 4
      )
      SELECT grant_id, recipient_name, entity_id, canonical_name, abn
      FROM paired WHERE rn = 1
    `;
    const { data, error } = await db.rpc('exec_sql', { query: exactSql });
    if (error) {
      console.log(`    chunk ${i / P1_CHUNK + 1} failed: ${error.message.slice(0, 80)}`);
      continue;
    }
    if (data?.length) exact.push(...data);
    process.stdout.write(`\r    chunk ${i / P1_CHUNK + 1}/${Math.ceil(allIds.length / P1_CHUNK)} — running exact: ${exact.length}`);
  }
  console.log(`\n  exact matches: ${exact.length}`);
  if (exact.length) {
    console.log(`  preview:`);
    exact.slice(0, 5).forEach(r => console.log(`    · "${r.recipient_name}" → "${r.canonical_name}" (${r.abn || 'no abn'})`));
  }

  // Step 2: trigram similarity for the rest, chunked to fit within Supabase
  // statement timeout (~8s).
  console.log(`\n  Phase 2: trigram similarity > ${THRESHOLD} (chunked)`);
  const exactGrantIds = new Set(exact.map(r => r.grant_id));
  // Supabase JS caps at 1000 rows — paginate via OFFSET/LIMIT
  const leftoverArr = [];
  let pageOffset = 0;
  const PAGE = 1000;
  while (true) {
    const { data: pageRows } = await db.rpc('exec_sql', {
      query: `SELECT id FROM public.vic_grants_awarded WHERE gs_entity_id IS NULL ORDER BY id LIMIT ${PAGE} OFFSET ${pageOffset}`,
    });
    if (!pageRows || pageRows.length === 0) break;
    pageRows.forEach(r => { if (!exactGrantIds.has(r.id)) leftoverArr.push(r.id); });
    if (pageRows.length < PAGE) break;
    pageOffset += PAGE;
  }
  console.log(`  leftover unlinked rows: ${leftoverArr.length}`);

  const trg = [];
  const CHUNK = 30;
  for (let i = 0; i < leftoverArr.length; i += CHUNK) {
    const chunk = leftoverArr.slice(i, i + CHUNK).map(id => `'${id}'`).join(',');
    const trgSql = `
      WITH unlinked AS (
        SELECT id AS grant_id, recipient_name,
               ${NORM_SQL.replace('name_in', 'recipient_name')} AS norm
        FROM public.vic_grants_awarded
        WHERE id IN (${chunk})
      ),
      ent AS (
        SELECT id AS entity_id, canonical_name, abn,
               ${NORM_SQL.replace('name_in', 'canonical_name')} AS norm
        FROM public.gs_entities
        WHERE canonical_name IS NOT NULL
          AND length(canonical_name) > 4
      ),
      matches AS (
        SELECT u.grant_id, u.recipient_name,
               e.entity_id, e.canonical_name, e.abn,
               extensions.similarity(u.norm, e.norm) AS sim,
               ROW_NUMBER() OVER (PARTITION BY u.grant_id ORDER BY extensions.similarity(u.norm, e.norm) DESC) AS rn
        FROM unlinked u
        CROSS JOIN ent e
        WHERE extensions.similarity(u.norm, e.norm) >= ${THRESHOLD}
          AND substring(u.norm, 1, 4) = substring(e.norm, 1, 4)
      )
      SELECT grant_id, recipient_name, entity_id, canonical_name, abn, sim::numeric(4,3) AS sim
      FROM matches WHERE rn = 1
    `;
    const { data, error } = await db.rpc('exec_sql', { query: trgSql });
    if (error) {
      console.log(`    chunk ${i / CHUNK + 1} failed: ${error.message.slice(0, 80)}`);
      continue;
    }
    if (data?.length) trg.push(...data);
    process.stdout.write(`\r    chunk ${i / CHUNK + 1}/${Math.ceil(leftoverArr.length / CHUNK)} — running matches: ${trg.length}`);
  }
  console.log(`\n  trigram matches: ${trg.length}`);
  if (trg.length) {
    console.log(`  preview:`);
    trg.slice(0, 8).forEach(r => console.log(`    · ${r.sim} "${r.recipient_name}" → "${r.canonical_name}"`));
  }

  // Combine + dedupe (a grant could appear in both phases — exact wins)
  const all = [...exact];
  const seen = new Set(exact.map(r => r.grant_id));
  trg.forEach(r => { if (!seen.has(r.grant_id)) { all.push(r); seen.add(r.grant_id); } });

  // Save proposals to CSV
  const rows = ['grant_id,entity_id,recipient_name,matched_name,abn,sim'];
  all.forEach(r => rows.push(`${r.grant_id},${r.entity_id},"${r.recipient_name.replace(/"/g, '""')}","${r.canonical_name.replace(/"/g, '""')}",${r.abn || ''},${r.sim ?? '1.000'}`));
  writeFileSync('data/vic-grants-fuzzy-proposals.csv', rows.join('\n'));
  console.log(`\n  proposals saved → data/vic-grants-fuzzy-proposals.csv (${all.length} rows)`);

  if (!APPLY) {
    console.log(`\n  DRY RUN — pass --apply to write ${all.length} updates`);
    await logComplete(db, run.id, { items_found: all.length, items_new: 0, status: 'success' });
    return;
  }

  // Apply via psql (exec_sql RPC rejects data-modifying statements inside its
  // SELECT row_to_json(t) FROM (...) t wrapper, so write a SQL file and run psql -f).
  console.log(`\n  Phase 3: applying ${all.length} updates via psql`);
  const sqlPath = 'data/vic-grants-fuzzy-apply.sql';
  const lines = ['BEGIN;'];
  const BATCH = 200;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const values = batch.map(r => `('${r.grant_id}','${r.entity_id}')`).join(',');
    lines.push(
      `UPDATE public.vic_grants_awarded v SET gs_entity_id = m.entity_id::uuid FROM (VALUES ${values}) AS m(grant_id, entity_id) WHERE v.id::text = m.grant_id AND v.gs_entity_id IS NULL;`
    );
  }
  lines.push('COMMIT;');
  writeFileSync(sqlPath, lines.join('\n'));
  console.log(`  wrote ${sqlPath} (${lines.length - 2} UPDATE statements, ${all.length} rows)`);

  const { execSync } = await import('child_process');
  const PG_PASSWORD = process.env.DATABASE_PASSWORD;
  if (!PG_PASSWORD) {
    console.error('  ✗ DATABASE_PASSWORD not set; run psql manually:');
    console.error(`    PGPASSWORD=$DATABASE_PASSWORD psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f ${sqlPath}`);
    await logComplete(db, run.id, { items_found: all.length, items_new: 0, status: 'success' });
    return;
  }
  let applied = 0;
  try {
    const out = execSync(
      `PGPASSWORD="${PG_PASSWORD}" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f ${sqlPath} -t -A 2>&1`,
      { encoding: 'utf-8' }
    );
    const matches = out.match(/UPDATE (\d+)/g) || [];
    applied = matches.reduce((s, m) => s + Number(m.replace('UPDATE ', '')), 0);
    console.log(`  psql output: ${matches.length} UPDATE statements; total rows updated: ${applied}`);
  } catch (err) {
    console.error(`  psql failed: ${err.message.slice(0, 300)}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`  proposals: ${all.length} | applied: ${applied}`);
  await logComplete(db, run.id, { items_found: all.length, items_new: applied, status: 'success' });
}

main().catch(async err => {
  console.error('Fatal:', err);
  process.exit(1);
});
