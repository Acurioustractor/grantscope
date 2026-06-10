#!/usr/bin/env node
/**
 * Sync per-funder ask-framing from the ACT funder ledger into Goods.
 *
 * Reads the READ-ONLY ledger at
 *   act-global-infrastructure/wiki/narrative/funders.json
 * selects entries that fund Goods (projects_funded includes 'ACT-GD') OR whose
 * name matches a goods_relationships.display_name, and writes a compact framing
 * object onto each matched goods_relationships row's `framing jsonb` column.
 *
 * The framing is SYNCED, never generated: tone, framing_notes, claims to lead
 * with / avoid, primary contact, last-communicated date — straight from the
 * ledger, with provenance (slug + synced_at).
 *
 * Usage:
 *   node --env-file=.env scripts/sync-goods-framing.mjs           # dry-run: write SQL + print match table
 *   node --env-file=.env scripts/sync-goods-framing.mjs --apply   # also run psql to apply
 *
 * Pure matching/escaping/build helpers live in scripts/lib/goods-framing-shared.mjs
 * (unit-tested). This file only does I/O: read ledger, fetch rows, emit SQL, apply.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchFunders, buildUpdateSql } from './lib/goods-framing-shared.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// READ-ONLY source in the sibling infrastructure repo. We never write here.
const FUNDERS_JSON = resolve(
  REPO_ROOT,
  '..',
  'act-global-infrastructure',
  'wiki',
  'narrative',
  'funders.json',
);
const OUT_SQL = resolve(REPO_ROOT, 'scripts', 'generated', 'seed-goods-framing.generated.sql');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PG_PASSWORD = process.env.SUPABASE_PASSWORD || process.env.DATABASE_PASSWORD;
const PG_CONN =
  'postgresql://postgres.tednluwflfhxyucgwigh@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

const APPLY = process.argv.includes('--apply');

function loadFunders() {
  if (!existsSync(FUNDERS_JSON)) {
    console.error(`FATAL: funder ledger not found at ${FUNDERS_JSON}`);
    console.error('Expected the act-global-infrastructure repo as a sibling of grantscope.');
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(FUNDERS_JSON, 'utf8'));
  const funders = raw && raw.funders;
  if (!funders || typeof funders !== 'object') {
    console.error('FATAL: funders.json present but has no `funders` map (shape changed?).');
    process.exit(2);
  }
  return funders;
}

async function fetchGoodsRows() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('FATAL: need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to fetch goods_relationships.');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await supabase
    .from('goods_relationships')
    .select('id,display_name');
  if (error) {
    console.error(`FATAL: could not fetch goods_relationships: ${error.message}`);
    process.exit(2);
  }
  return data ?? [];
}

function printMatchTable(matches) {
  console.log('\nMatches (slug → display_name · matched-by):');
  if (matches.length === 0) {
    console.log('  (none)');
    return;
  }
  const slugW = Math.max(...matches.map((m) => m.slug.length), 4);
  for (const m of matches) {
    console.log(`  ${m.slug.padEnd(slugW)}  →  ${m.display_name}  (${m.matchedBy})`);
  }
}

async function main() {
  const funders = loadFunders();
  const rows = await fetchGoodsRows();
  console.log(`Loaded ${Object.keys(funders).length} ledger entries; ${rows.length} goods_relationships rows.`);

  const matches = matchFunders(funders, rows);
  printMatchTable(matches);

  if (matches.length === 0) {
    console.log('\nNo Goods funders matched the ledger. Writing no SQL (nothing to apply).');
    return;
  }

  const syncedAt = new Date().toISOString();
  const sql = buildUpdateSql(matches, syncedAt);
  mkdirSync(dirname(OUT_SQL), { recursive: true });
  writeFileSync(OUT_SQL, sql, 'utf8');
  console.log(`\nWrote ${matches.length} UPDATE statement(s) to ${OUT_SQL}`);

  if (!APPLY) {
    console.log('Dry-run (SQL only). Re-run with --apply to write framing onto goods_relationships.');
    return;
  }

  if (!PG_PASSWORD) {
    console.error('\nFATAL: --apply needs SUPABASE_PASSWORD (or DATABASE_PASSWORD) to run psql.');
    console.error(`Generated SQL is ready at ${OUT_SQL} for an operator to apply.`);
    process.exit(4);
  }

  try {
    execFileSync('psql', [PG_CONN, '-v', 'ON_ERROR_STOP=1', '-q', '-f', OUT_SQL], {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    console.log(`\nApplied: framing written onto ${matches.length} goods_relationships row(s).`);
  } catch (e) {
    console.error(`\nFATAL (apply): psql failed: ${e.message}`);
    console.error(`Generated SQL is ready at ${OUT_SQL} for an operator to apply.`);
    process.exit(4);
  }
}

main().catch((e) => {
  console.error('FATAL (unexpected):', e.message);
  process.exit(3);
});
