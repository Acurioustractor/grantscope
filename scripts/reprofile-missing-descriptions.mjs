#!/usr/bin/env node

/**
 * Re-profile Foundations Missing Descriptions
 *
 * Targets foundations that have enriched_at set (were previously profiled)
 * but ended up with no description. Re-runs website scraping + LLM profiling
 * to fill the gap.
 *
 * Usage:
 *   npx tsx scripts/reprofile-missing-descriptions.mjs [--limit=100] [--concurrency=3] [--dry-run]
 *   npx tsx scripts/reprofile-missing-descriptions.mjs --skip-scrape --limit=50
 *
 * Options:
 *   --limit=N          Max foundations to process (default: 50)
 *   --concurrency=N    Parallel batch size (default: 3)
 *   --skip-scrape      Skip website scraping, use LLM knowledge/search only
 *   --dry-run          Preview without making changes
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { FoundationScraper } from '../packages/grant-engine/src/foundations/annual-report-scraper.ts';
import { FoundationProfiler } from '../packages/grant-engine/src/foundations/foundation-profiler.ts';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_SCRAPE = process.argv.includes('--skip-scrape');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 3;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[reprofile] ${msg}`);
}

async function getFoundationsToReprofile() {
  // Foundations that were profiled but got no description
  // Prioritise those with websites (can scrape), ordered by giving size
  let query = supabase
    .from('foundations')
    .select('*')
    .not('enriched_at', 'is', null)   // Already attempted
    .is('description', null)           // But no description resulted
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (!SKIP_SCRAPE) {
    // Only those with websites when scraping
    query = query.not('website', 'is', null);
  }

  const { data, error } = await query;

  if (error) {
    log(`Error fetching foundations: ${error.message}`);
    return [];
  }
  return data || [];
}

async function reprofileOne(foundation, scraper, profiler, index, total) {
  const name = foundation.name;
  const website = foundation.website;

  const label = website
    ? `${name} (${website})`
    : `${name} (no website — LLM only)`;

  log(`  [${index}/${total}] ${label}`);

  if (DRY_RUN) {
    log(`    Would reprofile ${name}`);
    return 'profiled';
  }

  try {
    // Step 1: Scrape website
    let scraped;
    if (!website || SKIP_SCRAPE) {
      scraped = { websiteContent: null, aboutContent: null, programsContent: null, annualReportContent: null, scrapedUrls: [], errors: [] };
      if (!website) log(`    No website — relying on LLM web search/knowledge`);
      else log(`    Skipping scrape — using LLM web search/knowledge only`);
    } else {
      scraped = await scraper.scrapeFoundation(website);
      log(`    Scraped ${scraped.scrapedUrls.length} pages`);
      if (scraped.errors.length > 0) {
        log(`    ${scraped.errors.length} scrape errors`);
      }
    }

    // Step 2: Profile with LLM
    const profile = await profiler.profileFoundation(foundation, scraped);
    log(`    Profile confidence: ${profile.profile_confidence}`);

    if (!profile.description) {
      log(`    Still no description — skipping DB update`);
      return 'no_description';
    }

    log(`    "${profile.description.slice(0, 100)}..."`);
    if (profile.open_programs) log(`    ${profile.open_programs.length} open programs found`);

    // Step 3: Update database
    const ensureArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
    const updateData = {
      description: profile.description,
      thematic_focus: ensureArray(profile.thematic_focus),
      geographic_focus: ensureArray(profile.geographic_focus),
      target_recipients: ensureArray(profile.target_recipients),
      total_giving_annual: profile.total_giving_annual,
      avg_grant_size: profile.avg_grant_size,
      grant_range_min: profile.grant_range_min,
      grant_range_max: profile.grant_range_max,
      giving_history: profile.giving_history,
      giving_ratio: profile.giving_ratio,
      endowment_size: profile.endowment_size,
      revenue_sources: ensureArray(profile.revenue_sources),
      parent_company: profile.parent_company,
      asx_code: profile.asx_code,
      open_programs: profile.open_programs,
      profile_confidence: profile.profile_confidence,
      giving_philosophy: profile.giving_philosophy,
      wealth_source: profile.wealth_source,
      application_tips: profile.application_tips,
      notable_grants: profile.notable_grants,
      board_members: profile.board_members,
      scraped_urls: scraped.scrapedUrls,
      enrichment_source: website ? 'scrape+llm' : 'llm-only',
      enriched_at: new Date().toISOString(),
      last_scraped_at: website ? new Date().toISOString() : undefined,
    };

    const { error: updateError } = await supabase
      .from('foundations')
      .update(updateData)
      .eq('id', foundation.id);

    if (updateError) {
      log(`    DB update error: ${updateError.message}`);
      return 'error';
    }

    // Also insert open programs into foundation_programs table
    if (profile.open_programs && profile.open_programs.length > 0) {
      for (const program of profile.open_programs) {
        await supabase.from('foundation_programs').upsert({
          foundation_id: foundation.id,
          name: program.name,
          url: program.url || null,
          description: program.description || null,
          amount_max: program.amount || null,
          deadline: program.deadline || null,
          status: 'open',
          scraped_at: new Date().toISOString(),
        }, { onConflict: 'foundation_id,name' }).select();
      }
    }

    return 'profiled';
  } catch (err) {
    log(`    Error: ${err instanceof Error ? err.message : String(err)}`);
    return 'error';
  }
}

async function main() {
  log('Starting foundation re-profiling (missing descriptions)...');
  log(`  Limit: ${LIMIT}`);
  log(`  Concurrency: ${CONCURRENCY}`);
  log(`  Dry run: ${DRY_RUN}`);
  log(`  Skip scrape: ${SKIP_SCRAPE}`);

  const foundations = await getFoundationsToReprofile();
  log(`${foundations.length} foundations to reprofile`);

  if (foundations.length === 0) {
    log('Nothing to do — all profiled foundations have descriptions.');
    return;
  }

  const run = await logStart(supabase, 'reprofile-missing-descriptions', 'Re-profile Missing Descriptions');

  const scraper = SKIP_SCRAPE ? null : new FoundationScraper({ requestDelayMs: 2000, maxPagesPerFoundation: 5 });
  const profiler = new FoundationProfiler();

  let profiled = 0;
  let noDescription = 0;
  let errors = 0;
  let processed = 0;

  // Process in parallel batches
  for (let i = 0; i < foundations.length; i += CONCURRENCY) {
    const batch = foundations.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((f, j) => reprofileOne(f, scraper, profiler, i + j + 1, foundations.length))
    );

    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled') {
        if (result.value === 'profiled') profiled++;
        else if (result.value === 'no_description') noDescription++;
        else errors++;
      } else {
        errors++;
      }
    }

    log(`  --- Batch complete: ${processed}/${foundations.length} (${profiled} profiled, ${noDescription} still no desc, ${errors} errors) ---`);
  }

  await logComplete(supabase, run.id, {
    items_found: foundations.length,
    items_new: profiled,
    items_updated: 0,
  });

  log(`\nComplete: ${profiled} profiled, ${noDescription} still no description, ${errors} errors out of ${foundations.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
