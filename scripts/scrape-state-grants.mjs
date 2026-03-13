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

    try {
      for await (const grant of plugin.discover({ geography: ['AU'], status: 'open' })) {
        grants.push(grant);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${plugin.id}: ${message}`);
      console.error(`Error running ${plugin.id}: ${message}`);
      continue;
    }

    console.log(`Found ${grants.length} grants from ${plugin.id}`);
    totalDiscovered += grants.length;

    if (DRY_RUN) {
      for (const g of grants.slice(0, 10)) {
        console.log(`  ${g.title} | ${g.provider} | ${g.sourceUrl || 'no url'}`);
      }
      if (grants.length > 10) console.log(`  ... and ${grants.length - 10} more`);
      continue;
    }

    // Upsert to grant_opportunities
    const BATCH_SIZE = 50;
    for (let i = 0; i < grants.length; i += BATCH_SIZE) {
      const batch = grants.slice(i, i + BATCH_SIZE).map(g => ({
        name: g.title,
        provider: g.provider,
        url: g.sourceUrl,
        description: g.description,
        amount_min: g.amount?.min || null,
        amount_max: g.amount?.max || null,
        deadline: g.deadline || null,
        categories: g.categories,
        source_id: g.sourceId,
        geography: g.geography?.[0] || 'AU',
        status: 'open',
        grant_type: 'open_opportunity',
        source: g.provider || 'state-grants',
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('grant_opportunities')
        .upsert(batch, { onConflict: 'url', ignoreDuplicates: true });

      if (error) {
        errors.push(`${plugin.id} upsert: ${error.message}`);
        console.error(`  Upsert error: ${error.message}`);
      } else {
        totalNew += batch.length;
      }
    }

    console.log(`  Upserted ${grants.length} grants from ${plugin.id}`);
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
