#!/usr/bin/env node
/**
 * Build se_search_index — the denormalised table behind need-first supplier
 * search (/suppliers). One row per social_enterprises row; capability_text
 * aggregates the enterprise's AusTender contract titles so "I need beds"
 * matches what government actually bought, not just names/descriptions.
 *
 * Junk titles (bare PO/order numbers) are filtered — they carry no capability
 * signal. Table is rebuilt in full each run (11.8K rows, cheap).
 *
 * Usage:
 *   node --env-file=.env scripts/build-se-search-index.mjs            # dry run (counts)
 *   node --env-file=.env scripts/build-se-search-index.mjs --apply
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

const BUILD_SQL = `
SET statement_timeout = '280s';

-- capability rollup: contract titles per SE ABN, junk titles excluded
CREATE TEMP TABLE _cap AS
SELECT ac.supplier_abn AS abn,
       COUNT(*) AS contract_count,
       COALESCE(SUM(ac.contract_value), 0) AS contract_value,
       MAX(ac.contract_end) AS last_contract_end,
       COUNT(DISTINCT ac.buyer_name) AS buyer_count,
       LEFT(STRING_AGG(DISTINCT ac.title, ' · '), 4000) AS capability_text
FROM austender_contracts ac
WHERE ac.supplier_abn IN (SELECT DISTINCT abn FROM social_enterprises WHERE abn IS NOT NULL AND abn != '')
  AND ac.title IS NOT NULL
  AND ac.title !~* '^\\s*(PO|NCD|SON|CN)?[-#]?\\s*\\d+\\s*$'  -- bare order numbers carry no signal
GROUP BY ac.supplier_abn;

TRUNCATE se_search_index;

INSERT INTO se_search_index
  (se_id, name, abn, state, city, postcode, sectors, sectors_text, description, source_primary,
   verification_tier, verification_basis, capability_text,
   contract_count, contract_value, last_contract_end, buyer_count, built_at)
SELECT
  se.id, se.name, se.abn, se.state, se.city, se.postcode, se.sector,
  array_to_string(se.sector, ' '), se.description,
  se.source_primary, se.verification_tier, se.verification_basis,
  c.capability_text,
  COALESCE(c.contract_count, 0), COALESCE(c.contract_value, 0),
  c.last_contract_end, COALESCE(c.buyer_count, 0), now()
FROM social_enterprises se
LEFT JOIN _cap c ON c.abn = se.abn;
`;

const STATS_SQL = `
SELECT COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE capability_text IS NOT NULL) AS with_capability,
       COUNT(*) FILTER (WHERE contract_count > 0) AS with_contracts
FROM se_search_index;
`;

function runPsql(sql, { label = 'se-search-index' } = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const sqlFile = `/tmp/${label}-${stamp}.sql`;
  const outFile = `/tmp/${label}-${stamp}.out`;
  writeFileSync(sqlFile, `\\t on\n\\a\n\\o ${outFile}\n${sql}\n\\o\n`);
  try {
    execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -f ${sqlFile}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return readFileSync(outFile, 'utf-8').trim();
  } catch (err) {
    throw new Error(`psql failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(sqlFile); } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

let activeRun = { id: null };

async function main() {
  if (APPLY) activeRun = await logStart(supabase, 'build-se-search-index', 'SE Search Index Builder');
  console.log(`SE search index — ${APPLY ? 'APPLY (rebuild)' : 'DRY RUN'}\n`);

  if (!APPLY) {
    // dry run: report what the capability rollup would cover, touch nothing
    const out = runPsql(`
      SET statement_timeout = '280s';
      SELECT COUNT(DISTINCT ac.supplier_abn) AS se_abns_with_titles
      FROM austender_contracts ac
      WHERE ac.supplier_abn IN (SELECT DISTINCT abn FROM social_enterprises WHERE abn IS NOT NULL AND abn != '')
        AND ac.title IS NOT NULL
        AND ac.title !~* '^\\s*(PO|NCD|SON|CN)?[-#]?\\s*\\d+\\s*$';
    `);
    console.log(`SE ABNs with usable contract titles: ${out}`);
    console.log('\nDry run — re-run with --apply to rebuild se_search_index.');
    return;
  }

  runPsql(BUILD_SQL);
  const stats = runPsql(STATS_SQL);
  const [rows, withCap, withContracts] = stats.split('|').map(Number);
  console.log(`Rebuilt: ${rows} rows, ${withCap} with capability text, ${withContracts} with contracts`);

  await logComplete(supabase, activeRun.id, { items_found: rows, items_new: withCap });
}

main().catch(async (err) => {
  console.error(err);
  await logFailed(supabase, activeRun.id, err).catch(() => {});
  process.exit(1);
});
