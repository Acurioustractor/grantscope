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

  const { data: rows, error } = await supabase
    .from('alma_funding_opportunities')
    .select('id, name, funder_name, source_url, deadline, verification_status, opportunity_type')
    .neq('opportunity_type', 'unverified');

  if (error) {
    console.error('Read failed:', error.message);
    if (runId) await logFailed(supabase, runId, error);
    process.exit(1);
  }

  let verified = 0, stale = 0, unchanged = 0, skipped = 0;
  const updates = [];

  for (const row of rows ?? []) {
    // Deadline auto-stale: past-deadline rows can't be verified-active
    if (row.deadline && new Date(row.deadline) < new Date()) {
      if (row.verification_status !== 'stale') {
        updates.push({ id: row.id, verification_status: 'stale', verified_at: new Date().toISOString(), reason: 'past_deadline' });
        stale++;
      } else {
        unchanged++;
      }
      continue;
    }

    if (!row.source_url) {
      skipped++;
      continue;
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
      updates.push({
        id: row.id,
        verification_status: newStatus,
        verified_at: new Date().toISOString(),
        reason: result.status === 'ok' ? 'live_check' : `http_${result.code}`,
      });
      if (newStatus === 'verified') verified++;
      else if (newStatus === 'stale') stale++;
    } else if (result.status === 'ok' && wasVerified) {
      // refresh verified_at on live OK
      updates.push({ id: row.id, verification_status: 'verified', verified_at: new Date().toISOString(), reason: 'refresh' });
      unchanged++;
    } else {
      unchanged++;
    }

    console.log(`  ${result.status.padEnd(12)} ${row.funder_name?.slice(0,30).padEnd(30)} ${row.name.slice(0,60)}`);
  }

  if (!DRY_RUN && updates.length) {
    for (const u of updates) {
      await supabase
        .from('alma_funding_opportunities')
        .update({
          verification_status: u.verification_status,
          verified_at: u.verified_at,
          verification_notes: `Auto-check: ${u.reason} at ${new Date().toISOString()}`,
        })
        .eq('id', u.id);
    }
  }

  const summary = { verified, stale, unchanged, skipped, total: rows?.length ?? 0 };
  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Done in ${(Date.now() - startedAt) / 1000}s:`, summary);

  if (runId) {
    await logComplete(supabase, runId, {
      items_found: rows?.length ?? 0,
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
