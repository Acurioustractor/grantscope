#!/usr/bin/env node

/**
 * Enrich Grant Descriptions — Free Tier
 *
 * Scrapes grant URLs with Cheerio and extracts descriptions using Groq (free).
 * ARC grants use the ARC API directly (faster, no scraping needed).
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-grants-free.mjs [--limit=100] [--source=arc-grants] [--dry-run]
 *
 * Cost: $0 (Groq free tier: 14,400 req/day)
 */

import { createClient } from '@supabase/supabase-js';
import { batchEnrichFree } from '../packages/grant-engine/src/enrichment-free.ts';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SOURCE = sourceArg ? sourceArg.split('=')[1] : undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== Enrich Grant Descriptions (Free) ===');
  console.log(`  Limit: ${LIMIT}`);
  console.log(`  Source filter: ${SOURCE || 'all'}`);
  console.log(`  Dry run: ${DRY_RUN}`);

  if (DRY_RUN) {
    // Count how many would be processed
    let query = supabase
      .from('grant_opportunities')
      .select('source', { count: 'exact', head: true })
      .not('url', 'is', null)
      .is('enriched_at', null);

    if (SOURCE) query = query.eq('source', SOURCE);

    const { count } = await query;
    console.log(`\nWould process up to ${Math.min(LIMIT, count || 0)} of ${count} grants needing enrichment`);
    return;
  }

  const run = await logStart(supabase, 'enrich-grants-free', 'Enrich Grants (Free)');

  try {
    const result = await batchEnrichFree(supabase, {
      limit: LIMIT,
      source: SOURCE,
      onProgress: console.log,
    });

    await logComplete(supabase, run.id, {
      items_found: result.enriched + result.skipped + result.errors,
      items_new: result.enriched,
      items_updated: result.scraped,
    });

    console.log(`\nDone: ${result.enriched} enriched, ${result.scraped} scraped, ${result.skipped} skipped, ${result.errors} errors`);
  } catch (err) {
    await logFailed(supabase, run.id, err);
    throw err;
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
