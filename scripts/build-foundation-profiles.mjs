#!/usr/bin/env node

/**
 * Build Foundation Profiles
 *
 * For each foundation with a website, scrapes the site using Firecrawl
 * and synthesizes a rich profile using Claude.
 *
 * Processes foundations in priority order:
 * 1. Manually-specified top foundations (from research)
 * 2. Largest estimated giving
 * 3. Has website but no description yet
 *
 * Usage:
 *   npx tsx scripts/build-foundation-profiles.mjs [--limit=50] [--concurrency=5] [--dry-run]
 *   npx tsx scripts/build-foundation-profiles.mjs --include-no-website --skip-scrape --limit=100
 *   npx tsx scripts/build-foundation-profiles.mjs --top-only
 *
 * Options:
 *   --limit=N              Max foundations to process (default: 50)
 *   --concurrency=N        Parallel batch size (default: 5)
 *   --offset=N             Skip first N results
 *   --include-no-website   Also profile foundations without websites (LLM-only)
 *   --skip-scrape          Skip website scraping, use LLM knowledge/search only
 *   --top-only             Only process the curated top foundations list
 *   --dry-run              Preview without making changes
 *
 * Costs: ~$0.05/foundation with scraping, ~$0.01/foundation LLM-only
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { FoundationScraper } from '../packages/grant-engine/src/foundations/annual-report-scraper.ts';
import { FoundationProfiler } from '../packages/grant-engine/src/foundations/foundation-profiler.ts';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const TOP_ONLY = process.argv.includes('--top-only');
const SKIP_SCRAPE = process.argv.includes('--skip-scrape');
const INCLUDE_NO_WEBSITE = process.argv.includes('--include-no-website');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const offsetArg = process.argv.find(a => a.startsWith('--offset='));
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;

const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 5;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentRunId = null;

function log(msg) {
  console.log(`[profiler] ${msg}`);
}

/**
 * Top Australian philanthropic foundations to prioritize.
 * These are researched separately and may need manual ABN matching.
 */
const TOP_FOUNDATION_NAMES = [
  // === TIER 1: Mega-philanthropists ($100M+/year or $1B+ lifetime) ===
  'Minderoo Foundation',              // Andrew & Nicola Forrest — iron ore (FMG), $7.6B endowment
  'Paul Ramsay Foundation',           // Estate — private hospitals, $3B bequest, $150M/year
  'Ian Potter Foundation',            // Historic family — ABN 77 950 227 010

  // === TIER 2: Mining & Resources wealth ===
  'Hancock Prospecting',              // Gina Rinehart — iron ore
  'Georgina Hope Foundation',         // Rinehart medical giving
  'Hancock Family Medical Foundation',// $200M medical research
  'The Rinehart Medical Foundation',
  'Pratt Foundation',                 // Visy Industries — packaging
  'The Pratt Foundation',
  'BHP Foundation',                   // Mining — iron ore, copper, coal
  'Rio Tinto',                        // Mining community programs
  'Santos Foundation',                // Oil & gas
  'Woodside',                         // Oil & gas
  'Palmer Care Foundation',           // Clive Palmer — mining

  // === TIER 3: Retail, Property & Finance dynasties ===
  'Myer Foundation',                  // Retail dynasty, $12M+/year
  'The Sidney Myer Fund',
  'Lowy Foundation',                  // Frank Lowy — Westfield, $35M/year avg
  'Lowy Institute',
  'Gandel Foundation',                // John & Pauline Gandel — Chadstone
  'Gandel Philanthropy',
  'James N. Kirby Foundation',
  'Harry Triguboff',                  // Meriton — apartments, ~$3M/year

  // === TIER 4: Tech billionaires (21% of Top 50 giving, up from 1%) ===
  'Canva Foundation',                 // Melanie Perkins & Cliff Obrecht — design software
  'Atlassian Foundation',             // Cannon-Brookes & Farquhar — enterprise software
  'Skip Foundation',                  // Scott Farquhar — equality, education
  'Wedgetail Foundation',             // Cameron Adams (Canva) — nature conservation

  // === TIER 5: Banking & Finance ===
  'Westpac Foundation',               // Founded 1879, $100M Scholars Trust
  'Commonwealth Bank Foundation',
  'NAB Foundation',                   // Disaster resilience focus
  'Macquarie Group Foundation',       // $330M cumulative since 1985

  // === TIER 6: Media & Conglomerates ===
  'Packer Family Foundation',         // Crown/Nine — $100M+ since 2015
  'Kerry Stokes',                     // Seven West Media
  'Seven Group Foundation',

  // === TIER 7: Major family PAFs ===
  'Vincent Fairfax Family Foundation',// Since 1962, $220M cumulative
  'Tim Fairfax Family Foundation',    // $25M+ over 5 years
  'Perpetual Foundation',             // $3.6B funds under advice
  'Yulgilbar Foundation',
  'Snow Foundation',                  // Regional/rural Australia
  'Scanlon Foundation',               // Social cohesion research
  'Origin Foundation',                // Origin Energy
  'Besen Family Foundation',
  'William Buckland Foundation',
  'Peter & Lyndy White Foundation',
  'Thyne Reid Foundation',            // Medicine, science, arts, environment
  'Sylvia and Charles Viertel Charitable Foundation',
  'RE Ross Trust',                    // $127M cumulative, Victoria
  'Helen Macpherson Smith Trust',
  'Balnaves Foundation',              // Neil Balnaves — $5M/year
  'Judith Neilson Foundation',        // $13.5M cumulative — arts, diversity
  'Nelson Meers Foundation',          // Arts — $1M+/year
  'Hugh D T Williamson Foundation',
  'Khuda Family Foundation',          // $100M to Sydney Uni STEM
  'Ainsworth Foundation',             // Len Ainsworth — gaming, Giving Pledge
  'Susan McKinnon Foundation',        // Political leadership, governance
  'Collier Charitable Fund',          // Poverty relief, Victoria
  'Reichstein Foundation',
  'Cuffe Family Foundation',          // Arts

  // === TIER 8: Corporate foundations ===
  'Telstra Foundation',               // Digital inclusion, 1M young people by 2030
  'Woolworths Group Foundation',      // Disaster relief
  'CSL',                              // Biotech/pharma
  'Coles',                            // Community support

  // === TIER 9: Community & sector foundations ===
  'Lord Mayor\'s Charitable Foundation',  // Melbourne, 100+ years, largest community foundation
  'Lord Mayor\'s Charitable Trust',       // Brisbane, 70+ years
  'Australian Communities Foundation',    // National, $25.2M/year through 1,569 grants
  'Foundation for Rural & Regional Renewal',
  'Queensland Community Foundation',
  'Sydney Community Foundation',

  // === TIER 10: Indigenous focused ===
  'Lowitja Institute',
  'Healing Foundation',

  // === Trustee/intermediary platforms (for reference) ===
  'Australian Philanthropic Services',  // $2.4B under management, $1.3B given
  'Equity Trustees',                    // 1,200+ charitable trusts, $100M+/year
];

async function getFoundationsToProfile() {
  // First: try to find top foundations by name
  const topFoundations = [];

  if (!TOP_ONLY) {
    // Get foundations ordered by estimated giving, that haven't been profiled yet
    // Prioritise those with websites first, then no-website if flag set
    let query = supabase
      .from('foundations')
      .select('*')
      .is('enriched_at', null)
      .order('total_giving_annual', { ascending: false, nullsFirst: false });

    if (!INCLUDE_NO_WEBSITE) {
      query = query.not('website', 'is', null);
    }

    if (OFFSET > 0) {
      query = query.range(OFFSET, OFFSET + LIMIT - 1);
    } else {
      query = query.limit(LIMIT);
    }

    const { data, error } = await query;

    if (error) {
      log(`Error fetching foundations: ${error.message}`);
      return [];
    }
    return data || [];
  }

  // Top-only mode: find by name matching
  for (const name of TOP_FOUNDATION_NAMES) {
    const { data } = await supabase
      .from('foundations')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(1);

    if (data && data.length > 0) {
      // Skip if already profiled
      if (!data[0].enriched_at) {
        topFoundations.push(data[0]);
      }
    }
  }

  log(`Found ${topFoundations.length} top foundations to profile`);
  return topFoundations.slice(0, LIMIT);
}

/**
 * Process a single foundation: scrape (if has website) → LLM profile → DB update.
 * Returns 'profiled' | 'error'.
 */
async function profileOne(foundation, scraper, profiler, index, total) {
  const name = foundation.name;
  const website = foundation.website;

  const label = website
    ? `${name} (${website})`
    : `${name} (no website — LLM only)`;

  log(`  [${index}/${total}] ${label}`);

  if (DRY_RUN) {
    log(`    Would profile ${name}`);
    return 'profiled';
  }

  try {
    // Step 1: Scrape website (skip if no website or --skip-scrape)
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
    if (profile.description) log(`    "${profile.description.slice(0, 100)}..."`);
    if (profile.open_programs) log(`    ${profile.open_programs.length} open programs found`);

    // Step 3: Update database
    // Ensure array fields are actually arrays (LLMs sometimes return strings)
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
  log('Starting foundation profiling...');
  log(`  Limit: ${LIMIT}`);
  log(`  Offset: ${OFFSET}`);
  log(`  Concurrency: ${CONCURRENCY}`);
  log(`  Dry run: ${DRY_RUN}`);
  log(`  Top only: ${TOP_ONLY}`);
  log(`  Skip scrape: ${SKIP_SCRAPE}`);
  log(`  Include no-website: ${INCLUDE_NO_WEBSITE}`);

  const foundations = await getFoundationsToProfile();
  log(`${foundations.length} foundations to process`);

  if (foundations.length === 0) {
    log('Nothing to do.');
    return;
  }

  const run = await logStart(supabase, 'build-foundation-profiles', 'Profile Foundations');
  currentRunId = run.id;

  const scraper = SKIP_SCRAPE ? null : new FoundationScraper({ requestDelayMs: 2000, maxPagesPerFoundation: 5 });
  const profiler = new FoundationProfiler();

  let profiled = 0;
  let errors = 0;
  let processed = 0;

  // Process in parallel batches
  for (let i = 0; i < foundations.length; i += CONCURRENCY) {
    const batch = foundations.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((f, j) => profileOne(f, scraper, profiler, i + j + 1, foundations.length))
    );

    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled' && result.value === 'profiled') {
        profiled++;
      } else {
        errors++;
      }
    }

    log(`  --- Batch complete: ${processed}/${foundations.length} (${profiled} profiled, ${errors} errors) ---`);
  }

  await logComplete(supabase, run.id, {
    items_found: foundations.length,
    items_new: profiled,
    items_updated: 0,
    status: errors > 0 ? 'partial' : 'success',
    errors: errors > 0 ? [`${errors} foundation profiling errors`] : [],
  });

  log(`\nComplete: ${profiled} profiled, ${errors} errors out of ${foundations.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  const message = err instanceof Error ? err.message : String(err);
  logFailed(supabase, currentRunId, message).catch(() => {});
  process.exit(1);
});
