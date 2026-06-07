#!/usr/bin/env node
/**
 * Compute verification_tier for social_enterprises (buyer-wedge move 4).
 *
 * certified   — external certification/verification mark from a recognised body
 *               (source: social-traders, supply-nation, buyability, b-corp) or a
 *               non-empty certifications jsonb on any row
 * verified    — statutory register or state-SE-network member, WITH abn
 *               (oric, senvic, secna, wasec, qsec, sasec, acnc-classified)
 * identified  — directory/LLM-classified or no external mark (everything else)
 *
 * Tier = strength of external verification, NOT SE-ness.
 * Definitions: docs/strategy/buyer-wedge.md
 *
 * Usage:
 *   node --env-file=.env scripts/compute-se-verification-tiers.mjs           # dry run (counts)
 *   node --env-file=.env scripts/compute-se-verification-tiers.mjs --apply
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

// Single CASE expression — used by both the dry-run count and the apply UPDATE
// so they can never disagree.
const HAS_CERT_MARK = `(
  source_primary IN ('social-traders', 'supply-nation', 'buyability', 'b-corp')
  OR (certifications IS NOT NULL
      AND ((jsonb_typeof(certifications) = 'object' AND certifications != '{}'::jsonb)
        OR (jsonb_typeof(certifications) = 'array' AND jsonb_array_length(certifications) > 0)))
)`;

// v2: a row is ALSO verified when its ABN appears in a statutory register we
// hold (ACNC charities, ORIC corporations) — regardless of how the row was
// sourced. A self-registered row whose ABN is a 2012-registered charity should
// not sit at 'identified'. Tier = strength of external verification.
const STATUTORY_MATCH = `(
  EXISTS (SELECT 1 FROM acnc_charities c WHERE c.abn = social_enterprises.abn)
  OR EXISTS (SELECT 1 FROM oric_corporations o WHERE o.abn = social_enterprises.abn AND o.deregistered_on IS NULL)
)`;

const TIER_CASE = `CASE
  WHEN ${HAS_CERT_MARK} THEN 'certified'
  WHEN abn IS NOT NULL AND abn != ''
       AND (source_primary IN ('oric', 'senvic', 'secna', 'wasec', 'qsec', 'sasec', 'acnc-classified')
            OR ${STATUTORY_MATCH})
    THEN 'verified'
  ELSE 'identified'
END`;

const BASIS_CASE = `CASE
  WHEN ${HAS_CERT_MARK} THEN
    CASE source_primary
      WHEN 'social-traders' THEN 'Social Traders certified'
      WHEN 'supply-nation'  THEN 'Supply Nation registered/certified'
      WHEN 'buyability'     THEN 'BuyAbility (Australian Disability Enterprise)'
      WHEN 'b-corp'         THEN 'B Corp certified'
      ELSE 'External certification on record'
    END
  WHEN abn IS NOT NULL AND abn != ''
       AND source_primary IN ('oric', 'senvic', 'secna', 'wasec', 'qsec', 'sasec', 'acnc-classified')
    THEN
    CASE source_primary
      WHEN 'oric'            THEN 'ORIC-registered Indigenous corporation, ABN matched'
      WHEN 'acnc-classified' THEN 'ACNC-registered charity, ABN matched'
      ELSE 'State SE network member (' || source_primary || '), ABN matched'
    END
  WHEN abn IS NOT NULL AND abn != ''
       AND EXISTS (SELECT 1 FROM acnc_charities c WHERE c.abn = social_enterprises.abn)
    THEN 'ACNC-registered charity (statutory cross-check), ABN matched'
  WHEN abn IS NOT NULL AND abn != ''
       AND EXISTS (SELECT 1 FROM oric_corporations o WHERE o.abn = social_enterprises.abn AND o.deregistered_on IS NULL)
    THEN 'ORIC-registered corporation (statutory cross-check), ABN matched'
  ELSE 'Directory-identified (' || COALESCE(source_primary, 'unknown') || ')'
END`;

function runPsql(sql, { label = 'se-tiers' } = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const sqlFile = `/tmp/${label}-${stamp}.sql`;
  const outFile = `/tmp/${label}-${stamp}.out`;
  writeFileSync(sqlFile, `SET statement_timeout = '120s';\n\\t on\n\\a\n\\o ${outFile}\n${sql}\n\\o\n`);
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
  if (APPLY) activeRun = await logStart(supabase, 'compute-se-verification-tiers', 'SE Verification Tiers');
  console.log(`SE verification tiers — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  const { out } = runPsql(`SELECT (${TIER_CASE}) AS tier, COUNT(*) FROM social_enterprises GROUP BY 1 ORDER BY 2 DESC;`);
  console.log('Tier distribution:');
  console.log(out.split('\n').map((l) => `  ${l}`).join('\n'));

  if (!APPLY) {
    console.log('\nDry run — re-run with --apply to write.');
    return;
  }

  // \o redirects psql's "UPDATE n" status tag into the output file — parse
  // both channels so the count survives either way
  const { out: updOut, stdout } = runPsql(`
    UPDATE social_enterprises SET
      verification_tier = ${TIER_CASE},
      verification_basis = ${BASIS_CASE},
      verification_computed_at = now()
    WHERE verification_tier IS DISTINCT FROM (${TIER_CASE})
       OR verification_computed_at IS NULL;
  `);
  const updated = Number(((updOut + stdout).match(/UPDATE (\d+)/) || [])[1] || 0);
  console.log(`\nUpdated ${updated} rows.`);

  await logComplete(supabase, activeRun.id, { items_found: updated, items_new: updated });
}

main().catch(async (err) => {
  console.error(err);
  await logFailed(supabase, activeRun.id, err).catch(() => {});
  process.exit(1);
});
