#!/usr/bin/env node

/**
 * GrantScope Discovery — Full multi-source grant discovery
 *
 * Runs all source plugins (GrantConnect, data.gov.au, QLD, business.gov.au,
 * web search, LLM knowledge) and upserts new grants to Supabase.
 *
 * Usage:
 *   node scripts/grantscope-discovery.mjs [--dry-run] [--sources=grantconnect,data-gov-au]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GrantEngine } from '../packages/grant-engine/src/index.ts';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

// Parse --sources=a,b,c
const sourcesArg = process.argv.find(a => a.startsWith('--sources='));
const sources = sourcesArg
  ? sourcesArg.split('=')[1].split(',')
  : undefined; // undefined = all sources

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('='.repeat(60));
  console.log('GrantScope Discovery Run');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Sources: ${sources?.join(', ') || 'all'}`);
  console.log('='.repeat(60));

  const run = await logStart(supabase, 'grantscope-discovery', 'Grant Discovery');

  try {
    const engine = new GrantEngine({
      supabase,
      sources,
      dryRun: DRY_RUN,
    });

    const result = await engine.discover({
      geography: ['AU'],
      status: 'open',
    });

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
