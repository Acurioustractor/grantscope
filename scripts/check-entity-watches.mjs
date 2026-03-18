#!/usr/bin/env node
/**
 * Entity Watch Notification Cron
 *
 * Checks all active entity watches for changes since last_checked_at.
 * For each watched entity, looks for:
 *   - New contracts (austender_contracts by supplier_abn)
 *   - New grants (justice_funding by recipient_abn)
 *   - New relationships (gs_relationships by entity UUID)
 *
 * Updates entity_watches.change_summary and last_checked_at/last_change_at.
 * Logs run to agent_runs table.
 *
 * Usage:
 *   node --env-file=.env scripts/check-entity-watches.mjs
 *
 * Intended to run daily via cron or scheduler.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const run = await logStart(supabase, 'check-entity-watches', 'Entity Watch Notifications');

try {
  // Fetch all active watches
  const { data: watches, error: watchErr } = await supabase
    .from('entity_watches')
    .select('id, user_id, entity_id, gs_id, canonical_name, watch_types, last_checked_at')
    .order('last_checked_at', { ascending: true, nullsFirst: true });

  if (watchErr) throw new Error(`Failed to fetch watches: ${watchErr.message}`);
  if (!watches || watches.length === 0) {
    console.log('No active watches found.');
    await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
    process.exit(0);
  }

  console.log(`Checking ${watches.length} entity watches...`);

  let totalChanges = 0;
  let watchesWithChanges = 0;

  for (const watch of watches) {
    const since = watch.last_checked_at || new Date(Date.now() - 7 * 86400000).toISOString(); // default: 7 days ago
    const changes = {};

    // Look up entity ABN for contract/funding queries
    const { data: entity } = await supabase
      .from('gs_entities')
      .select('abn')
      .eq('id', watch.entity_id)
      .single();

    const abn = entity?.abn;

    // Check for new contracts
    if (watch.watch_types?.includes('contracts') && abn) {
      const { count } = await supabase
        .from('austender_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_abn', abn)
        .gte('created_at', since);

      if (count > 0) {
        changes.new_contracts = count;
        totalChanges += count;
      }
    }

    // Check for new grants/funding
    if (watch.watch_types?.includes('grants') && abn) {
      const { count } = await supabase
        .from('justice_funding')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_abn', abn)
        .gte('created_at', since);

      if (count > 0) {
        changes.new_funding = count;
        totalChanges += count;
      }
    }

    // Check for new relationships
    if (watch.watch_types?.includes('relationships')) {
      const { count: srcCount } = await supabase
        .from('gs_relationships')
        .select('id', { count: 'exact', head: true })
        .eq('source_entity_id', watch.entity_id)
        .gte('created_at', since);

      const { count: tgtCount } = await supabase
        .from('gs_relationships')
        .select('id', { count: 'exact', head: true })
        .eq('target_entity_id', watch.entity_id)
        .gte('created_at', since);

      const relCount = (srcCount || 0) + (tgtCount || 0);
      if (relCount > 0) {
        changes.new_relationships = relCount;
        totalChanges += relCount;
      }
    }

    const now = new Date().toISOString();
    const hasChanges = Object.keys(changes).length > 0;

    if (hasChanges) {
      watchesWithChanges++;
      console.log(`  ${watch.canonical_name || watch.gs_id}: ${JSON.stringify(changes)}`);
    }

    // Update the watch record
    const updatePayload = {
      last_checked_at: now,
      ...(hasChanges && {
        last_change_at: now,
        change_summary: {
          ...changes,
          checked_since: since,
          checked_at: now,
        },
      }),
    };

    await supabase
      .from('entity_watches')
      .update(updatePayload)
      .eq('id', watch.id);
  }

  console.log(`Done. ${watchesWithChanges}/${watches.length} watches had changes. ${totalChanges} total new items.`);

  await logComplete(supabase, run.id, {
    items_found: watches.length,
    items_new: totalChanges,
    items_updated: watchesWithChanges,
  });
} catch (err) {
  console.error('Entity watch check failed:', err);
  await logFailed(supabase, run.id, err);
  process.exit(1);
}
