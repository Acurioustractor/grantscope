#!/usr/bin/env node
/**
 * Scout SE Buyers — lighthouse-buyer prospecting (buyer-wedge move 3).
 *
 * Mines austender_contracts for government buyers who ALREADY contract with
 * registry SEs. These are the warmest prospects for the paid buyer product:
 * we can show them their own social-procurement evidence ("your agency bought
 * $X from N social/Indigenous enterprises") plus the tender-pack.
 *
 * Writes the ranked table se_buyer_prospects (replaced each run).
 *
 * Usage:
 *   node --env-file=.env scripts/scout-se-buyers.mjs            # dry run (top 20 to stdout)
 *   node --env-file=.env scripts/scout-se-buyers.mjs --apply    # rebuild se_buyer_prospects
 *
 * Workflow that consumes this: .claude/skills/lighthouse/SKILL.md
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const APPLY = process.argv.includes('--apply');
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!process.env.DATABASE_PASSWORD) {
  console.error('DATABASE_PASSWORD not set — run with --env-file=.env');
  process.exit(1);
}

// One pass over austender joined to SE ABNs. The supplier_abn join is the
// expensive bit — materialise SE ABNs into a temp table first so the planner
// hash-joins instead of nested-looping 770K rows.
const BUILD_SQL = `
SET statement_timeout = '280s';

CREATE TEMP TABLE _se_abns AS
  SELECT DISTINCT abn, name, verification_tier, state
  FROM social_enterprises
  WHERE abn IS NOT NULL AND abn != '';

CREATE TABLE IF NOT EXISTS se_buyer_prospects (
  buyer_name text PRIMARY KEY,
  se_supplier_count int,
  contract_count int,
  total_value numeric,
  last_contract_end date,
  certified_supplier_count int,
  example_suppliers jsonb,
  states jsonb,
  computed_at timestamptz DEFAULT now()
);

TRUNCATE se_buyer_prospects;

INSERT INTO se_buyer_prospects
  (buyer_name, se_supplier_count, contract_count, total_value, last_contract_end,
   certified_supplier_count, example_suppliers, states, computed_at)
SELECT
  ac.buyer_name,
  COUNT(DISTINCT ac.supplier_abn)                                   AS se_supplier_count,
  COUNT(*)                                                          AS contract_count,
  SUM(ac.contract_value)                                            AS total_value,
  MAX(ac.contract_end)                                              AS last_contract_end,
  COUNT(DISTINCT ac.supplier_abn)
    FILTER (WHERE se.verification_tier = 'certified')               AS certified_supplier_count,
  to_jsonb((ARRAY_AGG(DISTINCT se.name))[1:5])                      AS example_suppliers,
  jsonb_agg(DISTINCT se.state) FILTER (WHERE se.state IS NOT NULL)  AS states,
  now()
FROM austender_contracts ac
JOIN _se_abns se ON se.abn = ac.supplier_abn
WHERE ac.buyer_name IS NOT NULL
GROUP BY ac.buyer_name;
`;

const RANK_SQL = `
SELECT buyer_name, se_supplier_count, contract_count,
       ROUND(total_value / 1e6, 1) AS value_m, last_contract_end
FROM se_buyer_prospects
ORDER BY se_supplier_count DESC, total_value DESC
LIMIT 20;
`;

// Dry-run variant computes in-memory without touching the table
const DRY_SQL = `
SET statement_timeout = '280s';
CREATE TEMP TABLE _se_abns AS
  SELECT DISTINCT abn, name, verification_tier, state
  FROM social_enterprises WHERE abn IS NOT NULL AND abn != '';
SELECT ac.buyer_name,
       COUNT(DISTINCT ac.supplier_abn) AS se_suppliers,
       COUNT(*) AS contracts,
       ROUND(SUM(ac.contract_value) / 1e6, 1) AS value_m,
       MAX(ac.contract_end) AS last_end
FROM austender_contracts ac
JOIN _se_abns se ON se.abn = ac.supplier_abn
WHERE ac.buyer_name IS NOT NULL
GROUP BY ac.buyer_name
ORDER BY 2 DESC, SUM(ac.contract_value) DESC
LIMIT 20;
`;

function runPsql(sql, { label = 'se-buyers' } = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const sqlFile = `/tmp/${label}-${stamp}.sql`;
  const outFile = `/tmp/${label}-${stamp}.out`;
  writeFileSync(sqlFile, `\\t on\n\\a\n\\o ${outFile}\n${sql}\n\\o\n`);
  try {
    const stdout = execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -f ${sqlFile}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { out: readFileSync(outFile, 'utf-8').trim(), stdout };
  } catch (err) {
    throw new Error(`psql failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(sqlFile); } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

let activeRun = { id: null };

async function main() {
  if (APPLY) activeRun = await logStart(supabase, 'scout-se-buyers', 'SE Buyer Prospect Scout');
  console.log(`SE buyer scout — ${APPLY ? 'APPLY (rebuild se_buyer_prospects)' : 'DRY RUN'}\n`);

  if (!APPLY) {
    const { out } = runPsql(DRY_SQL);
    console.log('Top 20 buyers by SE supplier count (not persisted):\n');
    console.log(out.split('\n').map((l) => `  ${l}`).join('\n'));
    console.log('\nDry run — re-run with --apply to rebuild se_buyer_prospects.');
    return;
  }

  runPsql(BUILD_SQL);
  const { out } = runPsql(RANK_SQL);
  const total = Number(runPsql('SELECT COUNT(*) FROM se_buyer_prospects;').out || 0);
  console.log(`se_buyer_prospects rebuilt: ${total} buyers\n\nTop 20:\n`);
  console.log(out.split('\n').map((l) => `  ${l}`).join('\n'));

  await logComplete(supabase, activeRun.id, { items_found: total, items_new: total });
}

main().catch(async (err) => {
  console.error(err);
  await logFailed(supabase, activeRun.id, err).catch(() => {});
  process.exit(1);
});
