#!/usr/bin/env node
/**
 * Verify alma_funding_opportunities source URLs.
 *
 * For each row:
 *   - HEAD/GET the source_url
 *   - 200 → verification_status='verified', verified_at=now()
 *   - 4xx/5xx → verification_status='stale'
 *   - Auto-mark stale if deadline < now()
 *
 * Does NOT promote rows to 'open_grant' — that's a human classification call.
 * Only flips between verified ↔ stale ↔ unverified.
 *
 * Usage:
 *   node --env-file=.env scripts/verify-alma-opportunities.mjs [--dry-run]
 *
 * Run nightly. Logs to agent_runs via log-agent-run.mjs.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ID = 'verify-alma-opportunities';

async function checkUrl(url) {
  if (!url) return { status: 'no_url', code: null };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    // Many funder sites reject HEAD; use GET with a small range read.
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'CivicGraph-Verifier/1.0 (+https://civicgraph.au)' },
    });
    clearTimeout(t);
    return { status: res.ok ? 'ok' : 'http_error', code: res.status };
  } catch (err) {
    if (err.name === 'AbortError') return { status: 'timeout', code: null };
    return { status: 'fetch_error', code: null, error: err.message };
  }
}

async function run() {
  const runRow = await logStart(supabase, AGENT_ID, 'Alma opportunity URL verifier');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error } = await supabase
      .from('alma_funding_opportunities')
      .select('id, name, funder_name, source_url, deadline, verification_status, verified_at, opportunity_type')
      .neq('opportunity_type', 'unverified')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('Read failed:', error.message);
      if (runId) await logFailed(supabase, runId, error);
      process.exit(1);
    }
    rows.push(...(page ?? []));
    if (!page || page.length < pageSize) break;
  }

  let verified = 0, stale = 0, unchanged = 0, skipped = 0;
  let persistFailures = 0;
  const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
  const concurrency = Math.max(1, Number.parseInt(concurrencyArg?.split('=')[1] || '10', 10));
  const maxAgeArg = process.argv.find((arg) => arg.startsWith('--max-age-hours='));
  const maxAgeHours = Math.max(0, Number.parseInt(maxAgeArg?.split('=')[1] || '24', 10));

  // A single transient write failure used to abort the ENTIRE run: one `TypeError: fetch failed`
  // against a saturated shared pooler threw out of persist(), out of the worker, and killed the
  // whole verification pass. That is how the feed went stale — the nightly pipeline last succeeded
  // 2026-08-07 and timed out every night after, so nothing re-stamped verified_at, and on
  // 2026-08-14 all 2,592 opportunities quarantined at once and /ops/grant-recommendations went to
  // zeros. Retry the write, and if it still fails, skip THAT row rather than the other 2,591.
  async function persist(row, verificationStatus, reason) {
    if (DRY_RUN) return;
    const checkedAt = new Date().toISOString();
    const payload = {
      verification_status: verificationStatus,
      verified_at: checkedAt,
      verification_notes: `Auto-check: ${reason} at ${checkedAt}`,
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error: updateError } = await supabase
          .from('alma_funding_opportunities')
          .update(payload)
          .eq('id', row.id);
        if (!updateError) return;
        if (attempt === 3) {
          persistFailures++;
          console.warn(`  persist_failed  ${row.id}: ${updateError.message}`);
          return;
        }
      } catch (err) {
        // Network-level throw (fetch failed / socket hang up) — the case that killed the run.
        if (attempt === 3) {
          persistFailures++;
          console.warn(`  persist_failed  ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }

  async function verifyRow(row) {
    // Deadline auto-stale: past-deadline rows can't be verified-active
    if (row.deadline && new Date(row.deadline) < new Date()) {
      if (row.verification_status !== 'stale') {
        await persist(row, 'stale', 'past_deadline');
        stale++;
      } else {
        unchanged++;
      }
      return;
    }

    if (!row.source_url) {
      skipped++;
      return;
    }

    const lastVerifiedAt = row.verified_at ? new Date(row.verified_at).getTime() : 0;
    if (maxAgeHours > 0 && lastVerifiedAt >= Date.now() - maxAgeHours * 3_600_000) {
      skipped++;
      return;
    }

    const result = await checkUrl(row.source_url);
    const wasVerified = row.verification_status === 'verified';
    let newStatus = row.verification_status;

    if (result.status === 'ok') {
      newStatus = row.opportunity_type === 'open_grant' ? 'verified' : row.verification_status;
    } else if (result.status === 'http_error' && result.code === 404) {
      newStatus = 'stale';
    } else if (result.status === 'http_error' && result.code >= 500) {
      // server error — don't downgrade, retry next run
      newStatus = row.verification_status;
    } else if (result.status === 'timeout' || result.status === 'fetch_error') {
      // transient — don't downgrade
      newStatus = row.verification_status;
    }

    if (newStatus !== row.verification_status) {
      await persist(row, newStatus, result.status === 'ok' ? 'live_check' : `http_${result.code}`);
      if (newStatus === 'verified') verified++;
      else if (newStatus === 'stale') stale++;
    } else if (result.status === 'ok' && wasVerified) {
      // refresh verified_at on live OK
      await persist(row, 'verified', 'refresh');
      unchanged++;
    } else {
      unchanged++;
    }

    console.log(`  ${result.status.padEnd(12)} ${row.funder_name?.slice(0,30).padEnd(30)} ${row.name.slice(0,60)}`);
  }

  const queue = rows;
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < queue.length) {
      const row = queue[nextIndex++];
      await verifyRow(row);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));

  const summary = { verified, stale, unchanged, skipped, total: rows.length };
  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Done in ${(Date.now() - startedAt) / 1000}s:`, summary);

  if (runId) {
    await logComplete(supabase, runId, {
      items_found: rows.length,
      items_new: verified,
      items_updated: stale,
      metadata: summary,
    });
  }
}

run().catch(async (err) => {
  console.error('verify-alma failed:', err);
  process.exit(1);
});
