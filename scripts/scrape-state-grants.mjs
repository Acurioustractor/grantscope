#!/usr/bin/env node

/**
 * Scrape State Grant Portals
 *
 * Runs state-level grant scrapers (NSW, VIC) and upserts to grant_opportunities.
 * QLD is already handled by the main discovery engine via CKAN API.
 *
 * Usage:
 *   node scripts/scrape-state-grants.mjs                    # All states
 *   node scripts/scrape-state-grants.mjs --state=nsw        # Specific state
 *   node scripts/scrape-state-grants.mjs --dry-run          # Preview only
 */

import { createClient } from '@supabase/supabase-js';
import { createNSWGrantsPlugin } from '../packages/grant-engine/src/sources/nsw-grants.ts';
import { createVICGrantsPlugin } from '../packages/grant-engine/src/sources/vic-grants.ts';

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

const statePlugins = [
  createNSWGrantsPlugin(),
  createVICGrantsPlugin(),
];

async function main() {
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

  let totalNew = 0;
  let totalUpdated = 0;

  for (const plugin of plugins) {
    console.log(`\n--- ${plugin.name} ---`);
    const grants = [];

    try {
      for await (const grant of plugin.discover({ geography: ['AU'], status: 'open' })) {
        grants.push(grant);
      }
    } catch (err) {
      console.error(`Error running ${plugin.id}: ${err.message}`);
      continue;
    }

    console.log(`Found ${grants.length} grants from ${plugin.id}`);

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
        title: g.title,
        provider: g.provider,
        source_url: g.sourceUrl,
        description: g.description,
        amount_min: g.amount?.min || null,
        amount_max: g.amount?.max || null,
        deadline: g.deadline || null,
        categories: g.categories,
        source_id: g.sourceId,
        geography: g.geography?.[0] || 'AU',
        status: 'open',
        grant_type: 'open_opportunity',
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('grant_opportunities')
        .upsert(batch, { onConflict: 'title,source_id' });

      if (error) {
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
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
