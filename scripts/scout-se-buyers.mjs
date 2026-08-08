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

-- One row per ABN. DISTINCT over the whole tuple is NOT enough: 527 registry
-- rows share an ABN with a different name/tier/state, and each duplicate fans
-- the contract join out, multiplying contract_count and total_value. That put
-- DSS at $10.9B when the true figure is $4.0B. Buyer-facing numbers come from
-- here, so the dedupe is deterministic: strongest verification mark wins.
CREATE TEMP TABLE _se_abns AS
  SELECT DISTINCT ON (abn) abn, name, verification_tier, state
  FROM social_enterprises
  WHERE abn IS NOT NULL AND abn != ''
  ORDER BY abn,
    CASE verification_tier
      WHEN 'certified' THEN 1 WHEN 'verified' THEN 2 WHEN 'identified' THEN 3 ELSE 4
    END,
    name;

-- Two evidence sources, deliberately kept distinguishable.
--   austender_contracts  — real contract_start/contract_end dates. Despite the
--                          name it carries NSW eTender rows as well as federal.
--   state_tenders        — QLD departmental disclosure logs. No contract dates
--                          exist; published_date is the END of the period the
--                          disclosure file covered, backfilled from the source
--                          filename by backfill-state-tenders-dates.mjs. It
--                          means "disclosed as at", never "awarded on".
-- State buyers are prefixed with their state so QLD's Department of Education
-- cannot collide with the Commonwealth one.
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
ALTER TABLE se_buyer_prospects ADD COLUMN IF NOT EXISTS evidence_basis text;

TRUNCATE se_buyer_prospects;

INSERT INTO se_buyer_prospects
  (buyer_name, se_supplier_count, contract_count, total_value, last_contract_end,
   certified_supplier_count, example_suppliers, states, evidence_basis, computed_at)
WITH evidence AS (
  SELECT ac.buyer_name, ac.supplier_abn, ac.contract_value,
         ac.contract_end AS last_date, 'contract-dates' AS basis
  FROM austender_contracts ac
  WHERE ac.buyer_name IS NOT NULL
  UNION ALL
  SELECT COALESCE(st.state || ' ', '') || st.buyer_name, st.supplier_abn, st.contract_value,
         st.published_date::date, 'disclosure-period'
  FROM state_tenders st
  WHERE st.buyer_name IS NOT NULL
)
SELECT
  e.buyer_name,
  COUNT(DISTINCT e.supplier_abn)                                    AS se_supplier_count,
  COUNT(*)                                                          AS contract_count,
  SUM(e.contract_value)                                             AS total_value,
  MAX(e.last_date)                                                  AS last_contract_end,
  COUNT(DISTINCT e.supplier_abn)
    FILTER (WHERE se.verification_tier = 'certified')               AS certified_supplier_count,
  to_jsonb((ARRAY_AGG(DISTINCT se.name))[1:5])                      AS example_suppliers,
  jsonb_agg(DISTINCT se.state) FILTER (WHERE se.state IS NOT NULL)  AS states,
  CASE WHEN COUNT(DISTINCT e.basis) > 1 THEN 'mixed' ELSE MIN(e.basis) END AS evidence_basis,
  now()
FROM evidence e
JOIN _se_abns se ON se.abn = e.supplier_abn
GROUP BY e.buyer_name;
`;

const RANK_SQL = `
SELECT buyer_name, se_supplier_count, contract_count,
       ROUND(total_value / 1e6, 1) AS value_m, last_contract_end, evidence_basis
FROM se_buyer_prospects
ORDER BY se_supplier_count DESC, total_value DESC
LIMIT 20;
`;

// Dry-run variant computes in-memory without touching the table
const DRY_SQL = `
SET statement_timeout = '280s';
CREATE TEMP TABLE _se_abns AS
  SELECT DISTINCT ON (abn) abn, name, verification_tier, state
  FROM social_enterprises WHERE abn IS NOT NULL AND abn != ''
  ORDER BY abn,
    CASE verification_tier
      WHEN 'certified' THEN 1 WHEN 'verified' THEN 2 WHEN 'identified' THEN 3 ELSE 4
    END,
    name;
WITH evidence AS (
  SELECT ac.buyer_name, ac.supplier_abn, ac.contract_value,
         ac.contract_end AS last_date, 'contract-dates' AS basis
  FROM austender_contracts ac WHERE ac.buyer_name IS NOT NULL
  UNION ALL
  SELECT COALESCE(st.state || ' ', '') || st.buyer_name, st.supplier_abn, st.contract_value,
         st.published_date::date, 'disclosure-period'
  FROM state_tenders st WHERE st.buyer_name IS NOT NULL
)
SELECT e.buyer_name,
       COUNT(DISTINCT e.supplier_abn) AS se_suppliers,
       COUNT(*) AS contracts,
       ROUND(SUM(e.contract_value) / 1e6, 1) AS value_m,
       MAX(e.last_date) AS last_end,
       CASE WHEN COUNT(DISTINCT e.basis) > 1 THEN 'mixed' ELSE MIN(e.basis) END AS basis
FROM evidence e
JOIN _se_abns se ON se.abn = e.supplier_abn
GROUP BY e.buyer_name
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
