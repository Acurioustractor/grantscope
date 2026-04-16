#!/usr/bin/env node

/**
 * GrantScope Discovery — Full multi-source grant discovery
 *
 * Resolves an active source set from the source frontier, then runs the grant
 * discovery plugins and upserts new grants to Supabase.
 *
 * Usage:
 *   node scripts/grantscope-discovery.mjs [--dry-run] [--sources=grantconnect,data-gov-au]
 *   node scripts/grantscope-discovery.mjs [--resolve-sources-only]
 *   node scripts/grantscope-discovery.mjs [--full-sweep]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GrantEngine } from '../packages/grant-engine/src/index.ts';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FULL_SWEEP = process.argv.includes('--full-sweep');
const RESOLVE_SOURCES_ONLY = process.argv.includes('--resolve-sources-only');

// Parse --sources=a,b,c
const sourcesArg = process.argv.find(a => a.startsWith('--sources='));
const explicitSources = sourcesArg
  ? sourcesArg.split('=')[1].split(',')
  : undefined; // undefined = all sources

const frontierWindowArg = process.argv.find(a => a.startsWith('--frontier-window-hours='));
const FRONTIER_WINDOW_HOURS = frontierWindowArg ? parseInt(frontierWindowArg.split('=')[1], 10) : 24;
const frontierFallbackArg = process.argv.find(a => a.startsWith('--frontier-fallback-count='));
const FRONTIER_FALLBACK_COUNT = frontierFallbackArg ? parseInt(frontierFallbackArg.split('=')[1], 10) : 4;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function toTimestamp(value) {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

async function resolveSourcesFromFrontier() {
  const cutoffIso = new Date(Date.now() - (FRONTIER_WINDOW_HOURS * 60 * 60 * 1000)).toISOString();

  const { data, error } = await supabase
    .from('source_frontier')
    .select('discovery_source, priority, last_changed_at, last_checked_at, last_success_at, next_check_at, last_error, metadata')
    .eq('enabled', true)
    .eq('source_kind', 'grant_source_page')
    .not('discovery_source', 'is', null);

  if (error) {
    throw new Error(`Failed to resolve sources from frontier: ${error.message}`);
  }

  const bySource = new Map();

  for (const row of data || []) {
    const sourceId = row.discovery_source;
    const current = bySource.get(sourceId) || {
      sourceId,
      highestPriority: 0,
      earliestNextCheckAt: null,
      hasRecentChange: false,
      hasRecentError: false,
      hasSuccessfulBaseline: false,
      hasRecentDiscoveryHit: false,
      hasRecentDiscoveryMiss: false,
      targetCount: 0,
    };
    const metadata = row.metadata || {};
    const lastDiscoveryRunAt = metadata.last_discovery_run_at;
    const lastDiscoveryGrantsFound = Number(metadata.last_discovery_grants_found || 0);

    current.targetCount += 1;
    current.highestPriority = Math.max(current.highestPriority, row.priority || 0);
    if (!current.earliestNextCheckAt || toTimestamp(row.next_check_at) < toTimestamp(current.earliestNextCheckAt)) {
      current.earliestNextCheckAt = row.next_check_at;
    }
    if (row.last_changed_at && row.last_changed_at >= cutoffIso) current.hasRecentChange = true;
    if (row.last_success_at) current.hasSuccessfulBaseline = true;
    if (row.last_error && row.last_checked_at && row.last_checked_at >= cutoffIso) current.hasRecentError = true;
    if (lastDiscoveryRunAt && lastDiscoveryRunAt >= cutoffIso) {
      if (lastDiscoveryGrantsFound > 0) current.hasRecentDiscoveryHit = true;
      else current.hasRecentDiscoveryMiss = true;
    }

    bySource.set(sourceId, current);
  }

  const aggregates = [...bySource.values()];
  const triggered = aggregates
    .map(source => ({
      ...source,
      hasUnbaselinedTarget: !source.hasSuccessfulBaseline,
    }))
    .filter(source => source.hasRecentChange || source.hasUnbaselinedTarget || source.hasRecentError || source.hasRecentDiscoveryHit)
    .sort((a, b) => {
      const aScore = (a.hasRecentChange ? 100 : 0) + (a.hasUnbaselinedTarget ? 50 : 0) + (a.hasRecentError ? 25 : 0) + (a.hasRecentDiscoveryHit ? 20 : 0) - (a.hasRecentDiscoveryMiss ? 15 : 0) + a.highestPriority;
      const bScore = (b.hasRecentChange ? 100 : 0) + (b.hasUnbaselinedTarget ? 50 : 0) + (b.hasRecentError ? 25 : 0) + (b.hasRecentDiscoveryHit ? 20 : 0) - (b.hasRecentDiscoveryMiss ? 15 : 0) + b.highestPriority;
      return bScore - aScore || toTimestamp(a.earliestNextCheckAt) - toTimestamp(b.earliestNextCheckAt);
    });

  const selected = [...triggered];
  if (selected.length < FRONTIER_FALLBACK_COUNT) {
    const fallback = aggregates
      .filter(source => !selected.some(selectedSource => selectedSource.sourceId === source.sourceId))
      .sort((a, b) => {
        return Number(Boolean(a.hasRecentDiscoveryMiss)) - Number(Boolean(b.hasRecentDiscoveryMiss))
          || toTimestamp(a.earliestNextCheckAt) - toTimestamp(b.earliestNextCheckAt)
          || b.highestPriority - a.highestPriority
          || a.sourceId.localeCompare(b.sourceId);
      })
      .slice(0, Math.max(0, FRONTIER_FALLBACK_COUNT - selected.length));

    selected.push(...fallback);
  }

  return {
    sources: selected.map(source => source.sourceId),
    details: selected,
    triggeredCount: triggered.length,
  };
}

async function resolveSources() {
  if (explicitSources?.length) {
    return { sources: explicitSources, mode: 'explicit', details: explicitSources.map(sourceId => ({ sourceId })) };
  }

  if (FULL_SWEEP) {
    return { sources: undefined, mode: 'full-sweep', details: [] };
  }

  try {
    const frontier = await resolveSourcesFromFrontier();
    if (frontier.sources.length > 0) {
      return {
        sources: frontier.sources,
        mode: frontier.triggeredCount > 0 ? 'frontier-triggered' : 'frontier-fallback',
        details: frontier.details,
      };
    }
  } catch (error) {
    console.warn(`[GrantScope] Frontier source resolution failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { sources: undefined, mode: 'fallback-all', details: [] };
}

async function recordDiscoveryFeedback(result, sourceMode) {
  if (DRY_RUN || !result.sourceStats?.length) return;

  const now = new Date().toISOString();
  const sourceIds = result.sourceStats.map(stat => stat.source);
  const { data, error } = await supabase
    .from('source_frontier')
    .select('id, discovery_source, metadata')
    .eq('source_kind', 'grant_source_page')
    .in('discovery_source', sourceIds);

  if (error) {
    console.warn(`[GrantScope] Failed to fetch frontier rows for discovery feedback: ${error.message}`);
    return;
  }

  const statsBySource = new Map(result.sourceStats.map(stat => [stat.source, stat]));

  for (const row of data || []) {
    const stats = statsBySource.get(row.discovery_source);
    if (!stats) continue;

    const metadata = {
      ...(row.metadata || {}),
      last_discovery_run_at: now,
      last_discovery_status: stats.errors.length > 0 ? 'partial' : 'success',
      last_discovery_grants_found: stats.grantsFound,
      last_discovery_duration_ms: stats.durationMs,
      last_discovery_errors: stats.errors,
      last_discovery_source_mode: sourceMode,
    };

    const { error: updateError } = await supabase
      .from('source_frontier')
      .update({
        metadata,
        updated_at: now,
      })
      .eq('id', row.id);

    if (updateError) {
      console.warn(`[GrantScope] Failed to update frontier feedback for ${row.discovery_source}: ${updateError.message}`);
    }
  }
}

async function main() {
  const resolved = await resolveSources();

  console.log('='.repeat(60));
  console.log('GrantScope Discovery Run');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Source mode: ${resolved.mode}`);
    console.log(`  Sources: ${resolved.sources?.join(', ') || 'all'}`);
  if (resolved.details.length > 0 && resolved.mode !== 'explicit') {
    for (const detail of resolved.details) {
      const flags = [
        detail.hasRecentChange ? 'changed' : null,
        detail.hasRecentError ? 'error' : null,
        detail.hasUnbaselinedTarget ? 'unbaselined' : null,
        detail.hasRecentDiscoveryHit ? 'recent-hit' : null,
        detail.hasRecentDiscoveryMiss ? 'recent-miss' : null,
      ].filter(Boolean).join(', ');
      console.log(`    - ${detail.sourceId}${flags ? ` [${flags}]` : ''}`);
    }
  }
  console.log('='.repeat(60));

  if (RESOLVE_SOURCES_ONLY) {
    return;
  }

  const run = await logStart(supabase, 'grantscope-discovery', 'Grant Discovery');

  try {
    const engine = new GrantEngine({
      supabase,
      sources: resolved.sources,
      dryRun: DRY_RUN,
    });

    const result = await engine.discover({
      geography: ['AU'],
      status: 'open',
    });

    await recordDiscoveryFeedback(result, resolved.mode);

    await logComplete(supabase, run.id, {
      items_found: result.grantsDiscovered,
      items_new: result.grantsNew,
      items_updated: result.grantsUpdated,
    });

    console.log('\n' + '='.repeat(60));
    console.log('Discovery Results:');
    console.log(`  Sources used: ${result.sourcesUsed.join(', ')}`);
    console.log(`  Grants discovered: ${result.grantsDiscovered}`);
    console.log(`  New grants: ${result.grantsNew}`);
    console.log(`  Updated: ${result.grantsUpdated}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Status: ${result.status}`);
    console.log('='.repeat(60));

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      for (const err of result.errors) {
        console.log(`  [${err.source}] ${err.error}`);
      }
    }
  } catch (err) {
    await logFailed(supabase, run.id, err);
    throw err;
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
