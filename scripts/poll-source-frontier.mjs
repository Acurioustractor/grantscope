#!/usr/bin/env node

/**
 * Poll Source Frontier
 *
 * Lightweight HTTP polling for due frontier targets. This turns source_frontier
 * from a static inventory into a monitored queue with:
 * - last_checked_at / last_success_at
 * - last_changed_at when content materially changes
 * - etag + content_hash baselines
 * - backoff on repeated failures
 *
 * By default this only polls grant_source_page targets so the high-signal
 * source pages become self-refreshing without disturbing the larger foundation
 * queue. Other kinds can be targeted explicitly via --kinds.
 *
 * Usage:
 *   node --env-file=.env scripts/poll-source-frontier.mjs
 *   node --env-file=.env scripts/poll-source-frontier.mjs --kinds=grant_source_page,foundation_program_page --limit=50
 *   node --env-file=.env scripts/poll-source-frontier.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DEFAULT_KINDS = ['grant_source_page'];
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX_BODY_BYTES = 1024 * 1024;
const AUTO_DISABLE_404_FAILURES = 2;
const AUTO_DISABLE_REASON = 'repeated_404_candidate_page';
const FOUNDATION_SOURCE_KINDS = new Set([
  'foundation_homepage',
  'foundation_known_page',
  'foundation_candidate_page',
  'foundation_program_page',
]);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const concurrencyArg = process.argv.find(arg => arg.startsWith('--concurrency='));
const kindsArg = process.argv.find(arg => arg.startsWith('--kinds='));
const foundationIdArg = process.argv.find(arg => arg.startsWith('--foundation-id='));
const agentIdArg = process.argv.find(arg => arg.startsWith('--agent-id='));
const agentNameArg = process.argv.find(arg => arg.startsWith('--agent-name='));
const LIMIT = limitArg ? Math.max(1, Number.parseInt(limitArg.split('=')[1], 10) || 20) : 20;
const CONCURRENCY = concurrencyArg ? Math.max(1, Number.parseInt(concurrencyArg.split('=')[1], 10) || 5) : 5;
const KINDS = kindsArg ? kindsArg.split('=')[1].split(',').map(kind => kind.trim()).filter(Boolean) : DEFAULT_KINDS;
const FOUNDATION_ID = foundationIdArg ? foundationIdArg.split('=')[1].trim() : null;
const AGENT_ID = agentIdArg ? agentIdArg.split('=')[1].trim() : 'poll-source-frontier';
const AGENT_NAME = agentNameArg ? agentNameArg.split('=').slice(1).join('=').trim() : 'Poll Source Frontier';

function log(message) {
  console.log(`[frontier-poll] ${message}`);
}

function addHours(isoString, hours) {
  return new Date(new Date(isoString).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function hashBuffer(buffer) {
  return createHash('sha1').update(buffer).digest('hex');
}

function isTextLike(contentType) {
  return /text\/|application\/(json|xml|rss\+xml|atom\+xml|javascript|x-javascript)/i.test(contentType || '');
}

function contentHashFromBuffer(buffer) {
  const slice = buffer.length > MAX_BODY_BYTES ? buffer.subarray(0, MAX_BODY_BYTES) : buffer;
  return hashBuffer(slice);
}

function shorten(value, max = 1000) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function effectiveCadenceDecision(row) {
  const baseHours = row.cadence_hours || 24;
  if (!FOUNDATION_SOURCE_KINDS.has(row.source_kind)) {
    return { hours: baseHours, reason: 'base' };
  }

  const metadata = row.metadata || {};
  const selectedRuns = Number(metadata.relationship_page_selected_runs || 0);
  const zeroYieldRuns = Number(metadata.relationship_page_zero_yield_runs || 0);
  const failedRuns = Number(metadata.relationship_page_failed_runs || 0);
  const peopleTotal = Number(metadata.relationship_page_people_total || 0);
  const granteesTotal = Number(metadata.relationship_page_grantees_total || 0);
  const signalsTotal = Number(metadata.relationship_page_signals_total || 0);
  const lastGranteesFound = Number(metadata.relationship_page_last_grantees_found || 0);
  const lastSignalsFound = Number(metadata.relationship_page_last_signals_found || 0);

  let hours = baseHours;
  let reason = 'base';

  if (selectedRuns > 0) {
    if (lastGranteesFound > 0 || lastSignalsFound > 0 || granteesTotal >= 5 || signalsTotal >= 5) {
      hours = Math.min(baseHours, 24);
      reason = 'relationship_high_yield';
    } else if (granteesTotal > 0 || signalsTotal > 0 || peopleTotal >= 5) {
      hours = Math.min(baseHours, 48);
      reason = 'relationship_medium_yield';
    } else if (selectedRuns >= 2 && zeroYieldRuns / Math.max(selectedRuns, 1) >= 0.75) {
      hours = Math.max(baseHours, 24 * 7);
      reason = 'relationship_zero_yield_backoff';
    }
  }

  if (failedRuns >= 2) {
    hours = Math.max(hours, Math.min(baseHours * 2, 24 * 7));
    reason = reason === 'base' ? 'relationship_failed_backoff' : `${reason}_failed_backoff`;
  }

  return { hours, reason };
}

function nextSuccessDecision(row, changed) {
  const decision = effectiveCadenceDecision(row);
  if (!changed) {
    return {
      hours: decision.hours,
      baseHours: decision.hours,
      reason: decision.reason,
    };
  }

  return {
    hours: Math.max(1, Math.floor(decision.hours / 2)),
    baseHours: decision.hours,
    reason: `${decision.reason}_changed`,
  };
}

function nextFailureDecision(row, nextFailureCount) {
  const decision = effectiveCadenceDecision(row);
  return {
    hours: Math.min(decision.hours * Math.max(2, nextFailureCount), 24 * 7),
    baseHours: decision.hours,
    reason: `${decision.reason}_failure_backoff`,
  };
}

function mergeMetadata(existingMetadata, extraMetadata) {
  return {
    ...(existingMetadata || {}),
    ...extraMetadata,
  };
}

function shouldAutoDisableCandidate(row, status, nextFailureCount) {
  return row.source_kind === 'foundation_candidate_page'
    && (status === 404 || status === 410)
    && nextFailureCount >= AUTO_DISABLE_404_FAILURES;
}

async function fetchDueTargets() {
  let query = db
    .from('source_frontier')
    .select('id, source_key, source_kind, source_name, target_url, cadence_hours, priority, etag, content_hash, failure_count, last_changed_at, metadata, change_detection')
    .eq('enabled', true)
    .lte('next_check_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('next_check_at', { ascending: true })
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(LIMIT);

  if (KINDS.length > 0) {
    query = query.in('source_kind', KINDS);
  }
  if (FOUNDATION_ID) {
    query = query.eq('foundation_id', FOUNDATION_ID);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch due frontier rows: ${error.message}`);
  return data || [];
}

async function fetchWithProbe(row) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en-AU,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  };

  if (row.etag) headers['If-None-Match'] = row.etag;

  let method = row.change_detection === 'pdf' ? 'HEAD' : 'GET';
  let response = await fetch(row.target_url, {
    method,
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });

  if ((response.status === 405 || response.status === 501) && method === 'HEAD') {
    method = 'GET';
    response = await fetch(row.target_url, {
      method,
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
  }

  return { response, method };
}

async function probeTarget(row) {
  const checkedAt = new Date().toISOString();

  try {
    const { response, method } = await fetchWithProbe(row);
    const contentType = response.headers.get('content-type') || null;
    const contentLength = response.headers.get('content-length');
    const etag = response.headers.get('etag') || null;
    const finalUrl = response.url || row.target_url;

    if (response.status === 304) {
      const cadence = nextSuccessDecision(row, false);
      return {
        rowId: row.id,
        sourceKey: row.source_key,
        success: true,
        changed: false,
        status: 304,
        checkedAt,
        update: {
          last_checked_at: checkedAt,
          last_success_at: checkedAt,
          next_check_at: addHours(checkedAt, cadence.hours),
          last_http_status: 304,
          last_error: null,
          failure_count: 0,
          updated_at: checkedAt,
          metadata: mergeMetadata(row.metadata, {
            last_probe_method: method,
            last_final_url: finalUrl,
            last_content_type: contentType,
            last_content_length: contentLength ? Number(contentLength) : null,
            last_effective_cadence_hours: cadence.hours,
            last_effective_base_cadence_hours: cadence.baseHours,
            last_effective_cadence_reason: cadence.reason,
            auto_disabled_reason: null,
            auto_disabled_at: null,
            auto_disabled_status: null,
            auto_disabled_failure_count: null,
          }),
        },
      };
    }

    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    }

    let contentHash = row.content_hash || null;
    if (method !== 'HEAD') {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      contentHash = isTextLike(contentType)
        ? hashBuffer(Buffer.from(buffer.toString('utf8')))
        : contentHashFromBuffer(buffer);
    } else if (etag) {
      contentHash = row.content_hash || null;
    }

    const changed = Boolean(
      (row.etag && etag && row.etag !== etag) ||
      (row.content_hash && contentHash && row.content_hash !== contentHash)
    );
    const cadence = nextSuccessDecision(row, changed);

    return {
      rowId: row.id,
      sourceKey: row.source_key,
      success: true,
      changed,
      status: response.status,
      checkedAt,
      update: {
        last_checked_at: checkedAt,
        last_success_at: checkedAt,
        last_changed_at: changed ? checkedAt : row.last_changed_at,
        next_check_at: addHours(checkedAt, cadence.hours),
        last_http_status: response.status,
        etag: etag || row.etag,
        content_hash: contentHash,
        last_error: null,
        failure_count: 0,
        updated_at: checkedAt,
        metadata: mergeMetadata(row.metadata, {
          last_probe_method: method,
          last_final_url: finalUrl,
          last_content_type: contentType,
          last_content_length: contentLength ? Number(contentLength) : null,
          last_effective_cadence_hours: cadence.hours,
          last_effective_base_cadence_hours: cadence.baseHours,
          last_effective_cadence_reason: cadence.reason,
          auto_disabled_reason: null,
          auto_disabled_at: null,
          auto_disabled_status: null,
          auto_disabled_failure_count: null,
        }),
      },
    };
  } catch (error) {
    const nextFailureCount = (row.failure_count || 0) + 1;
    const cadence = nextFailureDecision(row, nextFailureCount);
    const shouldDisable = shouldAutoDisableCandidate(row, error?.status ?? null, nextFailureCount);
    return {
      rowId: row.id,
      sourceKey: row.source_key,
      success: false,
      changed: false,
      status: error?.status ?? null,
      checkedAt,
      error: shorten(error instanceof Error ? error.message : String(error)),
      update: {
        last_checked_at: checkedAt,
        next_check_at: addHours(checkedAt, cadence.hours),
        last_http_status: error?.status ?? null,
        last_error: shorten(error instanceof Error ? error.message : String(error)),
        failure_count: nextFailureCount,
        updated_at: checkedAt,
        metadata: mergeMetadata(row.metadata, {
          last_effective_cadence_hours: cadence.hours,
          last_effective_base_cadence_hours: cadence.baseHours,
          last_effective_cadence_reason: cadence.reason,
          auto_disabled_reason: shouldDisable ? AUTO_DISABLE_REASON : row.metadata?.auto_disabled_reason || null,
          auto_disabled_at: shouldDisable ? checkedAt : row.metadata?.auto_disabled_at || null,
          auto_disabled_status: shouldDisable ? String(error?.status ?? '') : row.metadata?.auto_disabled_status || null,
          auto_disabled_failure_count: shouldDisable ? nextFailureCount : row.metadata?.auto_disabled_failure_count || null,
        }),
        ...(shouldDisable ? { enabled: false } : {}),
      },
      autoDisabled: shouldDisable,
    };
  }
}

async function applyUpdate(result) {
  const { error } = await db
    .from('source_frontier')
    .update(result.update)
    .eq('id', result.rowId);

  if (error) {
    throw new Error(`Failed to update ${result.sourceKey}: ${error.message}`);
  }
}

async function runWorkers(items, workerFn, concurrency) {
  const results = [];
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await workerFn(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main() {
  const run = DRY_RUN ? { id: null } : await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    log(`Polling due frontier targets (${KINDS.join(', ')})`);
    log(`  Limit: ${LIMIT}`);
    log(`  Concurrency: ${CONCURRENCY}`);
    log(`  Dry run: ${DRY_RUN}`);
    if (FOUNDATION_ID) log(`  Foundation filter: ${FOUNDATION_ID}`);

    const targets = await fetchDueTargets();
    log(`  Due targets fetched: ${targets.length}`);

    if (targets.length === 0) {
      if (!DRY_RUN) {
        await logComplete(db, run.id, { items_found: 0, items_new: 0, items_updated: 0 });
      }
      return;
    }

    const results = await runWorkers(targets, probeTarget, CONCURRENCY);

    let changed = 0;
    let unchanged = 0;
    let failed = 0;

    for (const result of results) {
      if (result.success && result.changed) changed++;
      else if (result.success) unchanged++;
      else failed++;

      if (!DRY_RUN) {
        await applyUpdate(result);
      }
    }

    for (const result of results) {
      if (!result.success) {
        log(`  FAIL ${result.sourceKey}: ${result.error}${result.autoDisabled ? ' [auto-disabled]' : ''}`);
      } else if (result.changed) {
        log(`  CHANGED ${result.sourceKey} (${result.status})`);
      } else {
        log(`  OK ${result.sourceKey} (${result.status})`);
      }
    }

    log(`Complete: ${changed} changed, ${unchanged} unchanged, ${failed} failed`);

    if (!DRY_RUN) {
      await logComplete(db, run.id, {
        items_found: targets.length,
        items_new: changed,
        items_updated: unchanged,
        status: failed > 0 ? 'partial' : 'success',
        errors: results.filter(result => !result.success).map(result => result.error),
      });
    }
  } catch (error) {
    if (!DRY_RUN) {
      await logFailed(db, run.id, error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
