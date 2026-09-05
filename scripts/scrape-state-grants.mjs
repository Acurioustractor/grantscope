#!/usr/bin/env node

/**
 * Scrape State Grant Portals
 *
 * Runs state/territory grant scrapers and upserts to grant_opportunities.
 *
 * Usage:
 *   node scripts/scrape-state-grants.mjs                    # All states
 *   node scripts/scrape-state-grants.mjs --state=nsw        # Specific state
 *   node scripts/scrape-state-grants.mjs --dry-run          # Preview only
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { createACTGrantsPlugin } from '../packages/grant-engine/src/sources/act-grants.ts';
import { createQLDGrantsPlugin } from '../packages/grant-engine/src/sources/qld-grants.ts';
import { createNSWGrantsPlugin } from '../packages/grant-engine/src/sources/nsw-grants.ts';
import { createVICGrantsPlugin } from '../packages/grant-engine/src/sources/vic-grants.ts';
import { createTASGrantsPlugin } from '../packages/grant-engine/src/sources/tas-grants.ts';
import { createSAGrantsPlugin } from '../packages/grant-engine/src/sources/sa-grants.ts';
import { createWAGrantsPlugin } from '../packages/grant-engine/src/sources/wa-grants.ts';
import { createNTGrantsPlugin } from '../packages/grant-engine/src/sources/nt-grants.ts';
import { upsertGrantOpportunities } from './lib/upsert-grant-opportunities.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const stateArg = process.argv.find(a => a.startsWith('--state='));
const SINGLE_STATE = stateArg ? stateArg.split('=')[1].toLowerCase() : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentRunId = null;

const statePlugins = [
  createACTGrantsPlugin(),
  createQLDGrantsPlugin(),
  createNSWGrantsPlugin(),
  createVICGrantsPlugin(),
  createTASGrantsPlugin(),
  createSAGrantsPlugin(),
  createWAGrantsPlugin(),
  createNTGrantsPlugin(),
];

function isDuplicateUrlError(error) {
  return error?.code === '23505' && /grant_opportunities_url_idx|url/i.test(error.message || '');
}

function dedupeGrants(grants) {
  const seen = new Set();
  const deduped = [];

  for (const grant of grants) {
    const sourceId = grant.sourceId || grant.sourceUrl || grant.title;
    const key = `${grant.title || ''}::${sourceId || ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(grant);
  }

  return deduped;
}

function storedStatuses(applicationStatus) {
  if (applicationStatus === 'closed') return { status: 'closed', application_status: 'closed' };
  if (applicationStatus === 'upcoming') return { status: 'closed', application_status: 'upcoming' };
  if (applicationStatus === 'ongoing') return { status: 'ongoing', application_status: 'ongoing' };
  if (applicationStatus === 'unknown') return { status: 'unknown', application_status: 'unknown' };
  return { status: 'open', application_status: 'open' };
}

async function quarantineUnseenNTStubs(currentGrants) {
  const currentUrls = new Set(currentGrants.map(grant => grant.sourceUrl).filter(Boolean));
  const { data, error } = await supabase
    .from('grant_opportunities')
    .select('id, url, deadline, closes_at')
    .eq('source_id', 'nt-grants');

  if (error) throw new Error(`Failed to load existing NT grants for reconciliation: ${error.message}`);

  const staleIds = (data || [])
    .filter(row => !row.url || !currentUrls.has(row.url))
    .map(row => row.id);

  for (let i = 0; i < staleIds.length; i += 100) {
    const { error: updateError } = await supabase
      .from('grant_opportunities')
      .update({
        status: 'unknown',
        application_status: 'unknown',
        updated_at: new Date().toISOString(),
      })
      .in('id', staleIds.slice(i, i + 100));

    if (updateError) throw new Error(`Failed to quarantine stale NT grant stubs: ${updateError.message}`);
  }

  return staleIds.length;
}

async function main() {
  const run = await logStart(supabase, 'scrape-state-grants', 'Scrape State Grants');
  currentRunId = run.id;

  console.log('=== State Grant Scraper ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`State: ${SINGLE_STATE || 'all'}\n`);

  const plugins = SINGLE_STATE
    ? statePlugins.filter(p => p.id.startsWith(SINGLE_STATE))
    : statePlugins;

  if (plugins.length === 0) {
    console.error(`No plugin found for state: ${SINGLE_STATE}`);
    console.error(`Available: ${statePlugins.map(p => p.id).join(', ')}`);
    process.exit(1);
  }

  let totalDiscovered = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  const errors = [];

  for (const plugin of plugins) {
    console.log(`\n--- ${plugin.name} ---`);
    const grants = [];

    // Per-source run so "last successful yield per source" is queryable from
    // agent_runs — a source whose latest run yields 0 (broken selector) alarms
    // via classifySourceHealth even though the batch run overall "succeeds".
    const sourceRun = DRY_RUN ? null : await logStart(supabase, `source:${plugin.id}`, plugin.name);

    try {
      for await (const grant of plugin.discover({ geography: ['AU'], status: 'open' })) {
        grants.push(grant);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${plugin.id}: ${message}`);
      console.error(`Error running ${plugin.id}: ${message}`);
      if (sourceRun) await logFailed(supabase, sourceRun.id, err);
      continue;
    }

    const dedupedGrants = dedupeGrants(grants);
    const duplicateCount = grants.length - dedupedGrants.length;

    console.log(`Found ${grants.length} grants from ${plugin.id}${duplicateCount > 0 ? ` (${duplicateCount} duplicate records removed)` : ''}`);
    totalDiscovered += dedupedGrants.length;

    if (DRY_RUN) {
      for (const g of dedupedGrants.slice(0, 10)) {
        console.log(`  ${g.title} | ${g.provider} | ${g.sourceUrl || 'no url'}`);
      }
      if (dedupedGrants.length > 10) console.log(`  ... and ${dedupedGrants.length - 10} more`);
      continue;
    }

    let sourceNew = 0;
    const verifiedAt = new Date().toISOString();

    // Upsert to grant_opportunities
    const BATCH_SIZE = 50;
    for (let i = 0; i < dedupedGrants.length; i += BATCH_SIZE) {
      const batch = dedupedGrants.slice(i, i + BATCH_SIZE).map(g => {
        const statuses = storedStatuses(g.applicationStatus);
        const deadline = g.deadline ? g.deadline.slice(0, 10) : null;
        return {
          name: g.title,
          provider: g.provider,
          program: g.program || null,
          url: g.sourceUrl,
          description: g.description,
          amount_min: g.amount?.min || null,
          amount_max: g.amount?.max || null,
          deadline,
          closes_at: deadline,
          categories: g.categories,
          source_id: g.sourceId,
          discovery_method: g.sourceId,
          geography: g.geography?.[0] || 'AU',
          ...statuses,
          grant_type: 'open_opportunity',
          source: g.provider || 'state-grants',
          last_verified_at: verifiedAt,
          updated_at: verifiedAt,
        };
      });

      // One write contract (scripts/lib/upsert-grant-opportunities.mjs). It replaces a three-step ladder whose last
      // step retried the row with `url: null` when the url index bit, which pushed the round in a second time under a
      // second identity and threw the URL away. Resolving by url and by (source, name) and writing by primary key
      // means that collision cannot happen, so nothing has to be discarded to get a row in.
      const result = await upsertGrantOpportunities(supabase, batch);
      totalNew += result.written;
      sourceNew += result.written;
      for (const message of result.errors) {
        errors.push(`${plugin.id}: ${message}`);
        console.error(`  ${message}`);
      }
    }

    console.log(`  Upserted ${dedupedGrants.length} grants from ${plugin.id}`);
    if (plugin.id === 'nt-grants') {
      const quarantined = await quarantineUnseenNTStubs(dedupedGrants);
      console.log(`  Marked ${quarantined} unseen NT directory stubs as unknown`);
    }
    if (sourceRun) {
      await logComplete(supabase, sourceRun.id, {
        items_found: dedupedGrants.length,
        items_new: sourceNew,
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total new/updated: ${totalNew}`);
  console.log('Done.');

  await logComplete(supabase, run.id, {
    items_found: totalDiscovered,
    items_new: totalNew,
    items_updated: totalUpdated,
    status: errors.length > 0 ? 'partial' : 'success',
    errors,
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  const message = err instanceof Error ? err.message : String(err);
  logFailed(supabase, currentRunId, message).catch(() => {});
  process.exit(1);
});
