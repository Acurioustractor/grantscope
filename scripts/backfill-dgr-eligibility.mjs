#!/usr/bin/env node
/**
 * Backfill DGR + entity-type eligibility flags on grant_opportunities.
 *
 * Reads eligibility_criteria JSONB + name + description and infers boolean
 * flags via pattern matching. Conservative: only sets TRUE/FALSE when the
 * signal is unambiguous; leaves NULL otherwise.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-dgr-eligibility.mjs --dry-run
 *   node --env-file=.env scripts/backfill-dgr-eligibility.mjs --limit=500
 *   node --env-file=.env scripts/backfill-dgr-eligibility.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;

const AGENT_ID = 'backfill-dgr-eligibility';
const AGENT_NAME = 'Backfill DGR + entity eligibility';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DGR_POSITIVE = [
  /\bdgr\b/i,
  /deductible gift recipient/i,
  /\bdgr[\s-]?endors/i,
  /item 1 dgr/i,
  /tcc.*dgr|dgr.*tcc/i,
];

const DGR_REQUIRED_PATTERNS = [
  /(must|required to|need to|need|requires? you to) (?:be|have|hold|maintain).*\bdgr\b/i,
  /\bdgr\s+(?:endorsement|status|registration)\s+(?:required|mandatory|essential)/i,
  /only (?:dgr|deductible gift recipient)/i,
  /must be (?:a )?dgr/i,
  /dgr (?:item 1 )?(?:status|endorsement) is required/i,
];

const DGR_NOT_REQUIRED_PATTERNS = [
  /no dgr (?:status|endorsement) required/i,
  /dgr not required/i,
  /(?:does not require|not required to be) (?:a )?dgr/i,
];

const SOLE_TRADER_POSITIVE = [
  /\bsole trader/i,
  /individual abn/i,
  /freelancer/i,
];

const SOLE_TRADER_NEGATIVE = [
  /sole traders (?:are )?not eligible/i,
  /individuals (?:are )?not eligible/i,
  /not (?:open|available) to (?:individuals|sole traders)/i,
  /must be (?:an? )?(?:incorporated|company|registered organisation)/i,
  /must be (?:an? )?(?:not.for.profit|nfp|charity|charitable)/i,
];

const PTY_LTD_POSITIVE = [
  /\bpty (?:ltd|limited)\b/i,
  /\bcompany\b/i,
  /incorporated/i,
  /\bnfp\b/i,
  /not.for.profit/i,
  /for.purpose/i,
  /social enterprise/i,
  /\bbusiness(?:es)?\b/i,
];

const PTY_LTD_NEGATIVE = [
  /only (?:registered )?charities/i,
  /must be a charity/i,
  /individuals only/i,
];

const CHARITY_POSITIVE = [
  /\bcharity\b/i,
  /charit(?:ies|able)/i,
  /acnc/i,
  /not.for.profit/i,
  /\bnfp\b/i,
];

const CHARITY_NEGATIVE = [
  /charities (?:are )?not eligible/i,
  /not open to charities/i,
  /for-profit only/i,
  /business(?:es)? only/i,
];

const UNINCORPORATED_POSITIVE = [
  /unincorporated association/i,
  /community group/i,
  /auspice/i,
];

function anyMatch(haystack, patterns) {
  return patterns.some((p) => p.test(haystack));
}

function classify(text) {
  const t = text || '';

  let dgr_required = null;
  if (anyMatch(t, DGR_REQUIRED_PATTERNS)) dgr_required = true;
  else if (anyMatch(t, DGR_NOT_REQUIRED_PATTERNS)) dgr_required = false;
  else if (anyMatch(t, DGR_POSITIVE) && /(?:eligib|criteria|require)/i.test(t)) dgr_required = true;

  let accepts_sole_trader = null;
  if (anyMatch(t, SOLE_TRADER_NEGATIVE)) accepts_sole_trader = false;
  else if (anyMatch(t, SOLE_TRADER_POSITIVE)) accepts_sole_trader = true;

  let accepts_pty_ltd = null;
  if (anyMatch(t, PTY_LTD_NEGATIVE)) accepts_pty_ltd = false;
  else if (anyMatch(t, PTY_LTD_POSITIVE)) accepts_pty_ltd = true;

  let accepts_charity = null;
  if (anyMatch(t, CHARITY_NEGATIVE)) accepts_charity = false;
  else if (anyMatch(t, CHARITY_POSITIVE)) accepts_charity = true;

  let accepts_unincorporated = null;
  if (anyMatch(t, UNINCORPORATED_POSITIVE)) accepts_unincorporated = true;

  return {
    dgr_required,
    accepts_sole_trader,
    accepts_pty_ltd,
    accepts_charity,
    accepts_unincorporated,
  };
}

function extractText(row) {
  const ec = row.eligibility_criteria;
  const ecText = typeof ec === 'string'
    ? ec
    : (ec && typeof ec === 'object')
      ? JSON.stringify(ec)
      : '';
  return [row.name, row.description, ecText].filter(Boolean).join(' \n ');
}

async function main() {
  const runRow = await logStart(supabase, AGENT_ID, AGENT_NAME);
  const runId = runRow?.id ?? null;
  console.log(`[${AGENT_NAME}] dryRun=${DRY_RUN} limit=${LIMIT ?? 'none'}`);

  // Paginate to bypass PostgREST's default 1000-row cap. We slice manually
  // with .range() until we either fill LIMIT or run out of rows.
  const PAGE = 1000;
  const target = LIMIT ?? 10000;
  const data = [];
  let error = null;
  for (let offset = 0; offset < target; offset += PAGE) {
    const upper = Math.min(offset + PAGE, target) - 1;
    const { data: pageRows, error: pageErr } = await supabase
      .from('grant_opportunities')
      .select('id, name, description, eligibility_criteria')
      .or('eligibility_signals_at.is.null,eligibility_signals_at.lt.2026-01-01')
      .order('created_at', { ascending: false })
      .range(offset, upper);
    if (pageErr) { error = pageErr; break; }
    if (!pageRows || pageRows.length === 0) break;
    data.push(...pageRows);
    if (pageRows.length < PAGE) break; // last page
  }
  if (error) {
    await logFailed(supabase, runId, error.message);
    console.error(`[${AGENT_NAME}] fetch error:`, error.message);
    process.exit(1);
  }

  console.log(`[${AGENT_NAME}] fetched ${data.length} rows`);

  const updates = [];
  const stats = { dgr_required: 0, accepts_sole_trader: 0, accepts_pty_ltd: 0, accepts_charity: 0, accepts_unincorporated: 0, total: 0 };

  for (const row of data) {
    const flags = classify(extractText(row));
    const anySet = Object.values(flags).some((v) => v !== null);
    if (!anySet) continue;

    Object.entries(flags).forEach(([k, v]) => {
      if (v !== null) stats[k]++;
    });
    stats.total++;

    updates.push({
      id: row.id,
      ...flags,
      eligibility_signals_at: new Date().toISOString(),
    });
  }

  console.log(`[${AGENT_NAME}] classified ${stats.total}/${data.length}`);
  console.log(`  dgr_required: ${stats.dgr_required}`);
  console.log(`  accepts_sole_trader: ${stats.accepts_sole_trader}`);
  console.log(`  accepts_pty_ltd: ${stats.accepts_pty_ltd}`);
  console.log(`  accepts_charity: ${stats.accepts_charity}`);
  console.log(`  accepts_unincorporated: ${stats.accepts_unincorporated}`);

  if (DRY_RUN) {
    console.log(`[${AGENT_NAME}] DRY RUN — no writes. Sample:`, updates.slice(0, 3));
    await logComplete(supabase, runId, { items_found: data.length, items_updated: 0 });
    return;
  }

  // Update per-row (.update has no NOT NULL trap since we don't pass `name`).
  // Parallelised in chunks of 25 to keep request load bounded.
  const CHUNK = 25;
  let written = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map(({ id, ...patch }) =>
        supabase.from('grant_opportunities').update(patch).eq('id', id)
      )
    );
    for (const r of results) {
      if (r.error) {
        console.error(`[${AGENT_NAME}] update error:`, r.error.message);
      } else {
        written += 1;
      }
    }
    if (i % 200 === 0) console.log(`[${AGENT_NAME}] wrote ${written}/${updates.length}`);
  }

  console.log(`[${AGENT_NAME}] wrote ${written} updates`);
  await logComplete(supabase, runId, { items_found: data.length, items_updated: written });
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] fatal:`, err);
  process.exit(1);
});
