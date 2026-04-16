#!/usr/bin/env node
/**
 * run-full-session.mjs
 *
 * Orchestrates a complete enrichment + never-ran agent session.
 * Designed to run overnight on your Mac with Gemma 4 local.
 *
 * What it does (in order):
 *   Phase 1 — Housekeeping   (recover stuck runs, refresh MVs)
 *   Phase 2 — Never-ran agents  (safe ones first: data imports, scrapers)
 *   Phase 3 — Local LLM enrichment  (foundations → charities → entities)
 *   Phase 4 — Wrap-up        (final MV refresh, export to kb)
 *
 * Usage:
 *   node --env-file=.env scripts/run-full-session.mjs --dry-run
 *   node --env-file=.env scripts/run-full-session.mjs
 *   node --env-file=.env scripts/run-full-session.mjs --kb-path=~/social-impact-kb
 *   node --env-file=.env scripts/run-full-session.mjs --phase=enrichment
 *   node --env-file=.env scripts/run-full-session.mjs --skip-imports
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const DRY_RUN    = process.argv.includes('--dry-run');
const SKIP_IMPORTS = process.argv.includes('--skip-imports');
const PHASE      = process.argv.find(a => a.startsWith('--phase='))?.split('=')[1] || 'all';
const KB_PATH    = process.argv.find(a => a.startsWith('--kb-path='))?.split('=')[1]?.replace('~', homedir());
const FOUNDATIONS_LIMIT = parseInt(process.argv.find(a => a.startsWith('--foundations='))?.split('=')[1] || '200');

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = { bold:'\x1b[1m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', red:'\x1b[31m', dim:'\x1b[2m', reset:'\x1b[0m' };
const ts  = () => new Date().toISOString().slice(11,19);
const log = (m) => console.log(`${C.dim}[${ts()}]${C.reset} ${m}`);
const ok  = (m) => console.log(`${C.green}✓${C.reset} [${ts()}] ${m}`);
const warn= (m) => console.log(`${C.yellow}⚠${C.reset} [${ts()}] ${m}`);
const err = (m) => console.log(`${C.red}✗${C.reset} [${ts()}] ${m}`);
const sep = () => console.log(`\n${C.dim}${'─'.repeat(70)}${C.reset}`);
const h   = (m) => { sep(); console.log(`${C.bold}${C.cyan}${m}${C.reset}\n`); };

// ─── Results tracker ─────────────────────────────────────────────────────────
const results = [];
const t0Total  = Date.now();

function run(label, script, args = [], opts = {}) {
  const { optional = false, timeout = 300_000 } = opts;

  // Check the script exists
  if (!existsSync(`scripts/${script}`)) {
    if (optional) { warn(`${label} — script not found (optional, skipping)`); results.push({ label, status: 'skipped' }); return false; }
    err(`${label} — scripts/${script} not found`);
    results.push({ label, status: 'missing' });
    return false;
  }

  const cmdArgs = ['--env-file=.env', `scripts/${script}`, ...args];
  if (DRY_RUN && !opts.noSkipDry) cmdArgs.push('--dry-run');
  log(`Running: node ${cmdArgs.join(' ')}`);

  const t = Date.now();
  const result = spawnSync('node', cmdArgs, {
    stdio: 'inherit',
    timeout,
    env: { ...process.env },
  });

  const elapsed = ((Date.now() - t) / 1000).toFixed(0);

  if (result.status === 0) {
    ok(`${label} — ${elapsed}s`);
    results.push({ label, status: 'ok', elapsed });
    return true;
  } else if (result.signal === 'SIGTERM') {
    warn(`${label} — timed out after ${elapsed}s`);
    results.push({ label, status: 'timeout', elapsed });
    return false;
  } else {
    err(`${label} — exit ${result.status} after ${elapsed}s`);
    results.push({ label, status: 'failed', elapsed });
    return false;
  }
}

// ─── Check local LLM ─────────────────────────────────────────────────────────
async function checkLLM() {
  try {
    const r = await fetch('http://127.0.0.1:8080/v1/models', { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}CivicGraph Full Enrichment Session${C.reset}`);
  console.log(`Mode: ${DRY_RUN ? C.yellow+'DRY RUN' : C.green+'LIVE'}${C.reset}`);
  console.log(`Phase: ${PHASE}`);
  console.log(`Foundations limit: ${FOUNDATIONS_LIMIT}`);
  if (KB_PATH) console.log(`KB export path: ${KB_PATH}`);
  console.log('');

  // ── Check .env
  if (!existsSync('.env')) { err('No .env found — run from grantscope root'); process.exit(1); }

  // ── Check local LLM
  const llmAvailable = await checkLLM();
  if (llmAvailable) { ok('Local LLM running at localhost:8080'); }
  else { warn('Local LLM not detected — enrichment phases will use API providers'); }

  const localFlag = llmAvailable ? ['--local-only'] : [];

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1 — Housekeeping
  // ════════════════════════════════════════════════════════════════════════════
  if (PHASE === 'all' || PHASE === 'housekeeping') {
    h('Phase 1 — Housekeeping');

    run('Recover stuck agent runs',    'recover-stale-agent-runs.mjs', [],   { noSkipDry: true, timeout: 30_000 });
    run('Refresh materialized views',  'refresh-views.mjs', [], { timeout: 120_000 });
    run('Schema health check',         'watch-schema-health.mjs', [],        { optional: true, timeout: 60_000 });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2 — Never-ran agents (imports & scrapers)
  // ════════════════════════════════════════════════════════════════════════════
  if ((PHASE === 'all' || PHASE === 'imports') && !SKIP_IMPORTS) {
    h('Phase 2 — Never-ran Agents (Imports & Scrapers)');

    // Priority 3 — scrapers (fast, data-gathering)
    run('Fix QGIP grants scraper',     'scrape-qgip-grants-fixed.mjs',  ['--live'], { optional: true, timeout: 120_000 });
    run('Scrape grant deadlines',      'scrape-grant-deadlines.mjs',    [],          { timeout: 180_000 });
    run('Scrape state grants',         'scrape-state-grants.mjs',       [],          { timeout: 300_000 });
    run('Scrape QLD Hansard',          'scrape-qld-hansard.mjs',        ['--limit=50'], { timeout: 300_000 });
    run('Scrape QLD YJ contracts',     'scrape-qld-yj-contracts.mjs',   [],          { timeout: 180_000 });

    // Priority 4 — data imports
    run('Import ACNC financials',      'import-acnc-financials.mjs',    [],          { timeout: 600_000 });
    run('Import gov grants',           'import-gov-grants.mjs',         [],          { timeout: 600_000 });
    run('Import NDIS provider register','import-ndis-provider-register.mjs',[], { timeout: 600_000 });
    run('Import lobbying register',    'import-lobbying-register.mjs',  [],          { timeout: 300_000 });
    run('Import modern slavery',       'import-modern-slavery.mjs',     [],          { timeout: 300_000 });
    run('Import ROGS justice',         'import-rogs-justice.mjs',       [],          { timeout: 300_000 });

    // Priority 5 — supplementary imports (longer, can fail without blocking)
    run('Import B Corp AU',            'import-bcorp-au.mjs',           [],          { optional: true, timeout: 300_000 });
    run('Import Social Traders',       'import-social-traders.mjs',     [],          { optional: true, timeout: 300_000 });
    run('Import BuyAbility',           'import-buyability.mjs',         [],          { optional: true, timeout: 300_000 });
    run('Import NDIS provider market', 'import-ndis-provider-market.mjs',[], { optional: true, timeout: 300_000 });
    run('Import gov procurement SE',   'import-gov-procurement-se.mjs', [],          { optional: true, timeout: 300_000 });
    run('Import indigenous directories','import-indigenous-directories.mjs',[],{ optional: true, timeout: 300_000 });
    run('Import state SE networks',    'import-state-se-networks.mjs',  [],          { optional: true, timeout: 300_000 });
    run('Sync ASIC companies',         'sync-asic-companies.mjs',       ['--limit=1000'], { optional: true, timeout: 300_000 });

    // Classify & link after new data
    run('Classify ACNC social enterprises','classify-acnc-social-enterprises.mjs',['--limit=500'],{ timeout: 180_000 });
    run('Enrich ORIC corporations',    'enrich-oric-corporations.mjs',  ['--limit=100'],{ timeout: 180_000 });

    // Refresh MVs after new imports
    run('Refresh materialized views (post-import)', 'refresh-views.mjs', [], { timeout: 120_000 });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3 — Local LLM Enrichment (the big one)
  // ════════════════════════════════════════════════════════════════════════════
  if (PHASE === 'all' || PHASE === 'enrichment') {
    h('Phase 3 — Local LLM Enrichment');

    // 3a — Foundations: low-confidence profiles (5,873 never enriched)
    log(`Enriching up to ${FOUNDATIONS_LIMIT} low-confidence foundations...`);
    run(
      `Enrich foundations (${FOUNDATIONS_LIMIT} low-confidence)`,
      'enrich-foundations-local.mjs',
      [...localFlag, '--no-website', `--limit=${FOUNDATIONS_LIMIT}`],
      { timeout: FOUNDATIONS_LIMIT * 8000 } // ~8s per foundation
    );

    // 3b — Reprofile missing descriptions (foundations with enriched_at but blank desc)
    run('Reprofile missing descriptions', 'reprofile-missing-descriptions.mjs',
      ['--limit=100'],
      { optional: true, timeout: 300_000 }
    );

    // 3c — Reprofile low-confidence existing profiles
    run('Reprofile low-confidence profiles', 'reprofile-low-confidence.mjs',
      ['--limit=50'],
      { optional: true, timeout: 300_000 }
    );

    // 3d — VIP foundations (top 50 by giving — use deeper profiling)
    run('Profile VIP foundations (top-50)', 'profile-vip-foundations.mjs',
      ['--limit=50'],
      { optional: true, timeout: 600_000 }
    );

    // 3e — Discover foundation programs (grantee data — biggest gap)
    run('Discover foundation programs', 'discover-foundation-programs.mjs',
      ['--limit=100'],
      { optional: true, timeout: 600_000 }
    );

    // 3f — Enrich charities
    run('Enrich charities', 'enrich-charities.mjs',
      ['--limit=200'],
      { optional: true, timeout: 600_000 }
    );

    // 3g — Enrich social enterprises
    run('Enrich social enterprises', 'enrich-social-enterprises.mjs',
      ['--limit=200'],
      { optional: true, timeout: 600_000 }
    );

    // 3h — NEW: Enrich gs_entities (local-only, highest source_count first)
    run('Enrich gs_entities (local)', 'enrich-entities-local.mjs',
      [`--limit=300`],
      { optional: true, timeout: 300 * 8000 }
    );

    // 3i — Classify entity duplicates
    run('Classify entity duplicates (local)', 'dedup-entities-local.mjs',
      ['--limit=50', '--min-confidence=0.8', '--apply'],
      { optional: true, timeout: 120_000 }
    );

    // 3j — Community org profiles
    run('Profile community orgs', 'profile-community-orgs.mjs',
      ['--limit=50'],
      { optional: true, timeout: 300_000 }
    );

    // 3k — Programs enrichment
    run('Enrich programs', 'enrich-programs.mjs',
      ['--limit=100'],
      { optional: true, timeout: 300_000 }
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4 — Wrap-up
  // ════════════════════════════════════════════════════════════════════════════
  if (PHASE === 'all' || PHASE === 'wrapup') {
    h('Phase 4 — Wrap-up');

    run('Final MV refresh',            'refresh-views.mjs',[], { timeout: 120_000 });
    run('Watch data quality',          'watch-data-quality.mjs',       [], { optional: true, timeout: 120_000 });
    run('Watch funding anomalies',     'watch-funding-anomalies.mjs',  [], { optional: true, timeout: 120_000 });

    // Export to kb if path provided
    // Sync to Notion
    if (existsSync('scripts/sync-enrichment-to-notion.mjs')) {
      run('Sync to Notion dashboard',  'sync-enrichment-to-notion.mjs', [], { optional: true, noSkipDry: true, timeout: 60_000 });
    }

    if (KB_PATH && existsSync(KB_PATH)) {
      run('Export to knowledge base',  'export-to-kb.mjs',
        [`--kb-path=${KB_PATH}`, '--type=all'],
        { optional: true, noSkipDry: true, timeout: 60_000 }
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════════
  const elapsed = ((Date.now() - t0Total) / 1000 / 60).toFixed(1);
  sep();
  console.log(`\n${C.bold}Session Summary — ${elapsed} minutes${C.reset}\n`);

  const byStatus = { ok: [], failed: [], skipped: [], timeout: [], missing: [] };
  for (const r of results) (byStatus[r.status] || byStatus.failed).push(r);

  if (byStatus.ok.length)      ok(`Completed (${byStatus.ok.length}): ${byStatus.ok.map(r=>r.label).join(', ')}`);
  if (byStatus.failed.length)  err(`Failed (${byStatus.failed.length}): ${byStatus.failed.map(r=>r.label).join(', ')}`);
  if (byStatus.timeout.length) warn(`Timed out (${byStatus.timeout.length}): ${byStatus.timeout.map(r=>r.label).join(', ')}`);
  if (byStatus.skipped.length) log(`Skipped (${byStatus.skipped.length}): optional steps not present`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}Dry run — no changes made. Remove --dry-run to apply.${C.reset}`);
  }
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
