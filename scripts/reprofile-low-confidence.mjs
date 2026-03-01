#!/usr/bin/env node

/**
 * Re-profile Low Confidence Foundations
 *
 * Targets foundations that were profiled but got "low" confidence
 * (usually due to OpenAI quota errors). Re-runs them through the
 * multi-provider profiler which round-robins across Groq, OpenAI,
 * Perplexity, Minimax, and Anthropic.
 *
 * Usage:
 *   npx tsx scripts/reprofile-low-confidence.mjs [--limit=200] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { FoundationScraper } from '../packages/grant-engine/src/foundations/annual-report-scraper.ts';
import { FoundationProfiler } from '../packages/grant-engine/src/foundations/foundation-profiler.ts';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 200;

const offsetArg = process.argv.find(a => a.startsWith('--offset='));
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[reprofile] ${msg}`);
}

async function main() {
  log('Re-profiling low confidence foundations...');
  log(`  Limit: ${LIMIT}`);
  log(`  Offset: ${OFFSET}`);
  log(`  Dry run: ${DRY_RUN}`);

  // Find low-confidence foundations (with or without websites — gemini-grounded can web search)
  const includeUnenriched = process.argv.includes('--include-unenriched');
  let query = supabase
    .from('foundations')
    .select('*')
    .eq('profile_confidence', 'low');

  if (!includeUnenriched) {
    query = query.not('enriched_at', 'is', null);  // Only previously attempted
  }

  query = query.order('total_giving_annual', { ascending: false, nullsFirst: false });

  if (OFFSET > 0) {
    query = query.range(OFFSET, OFFSET + LIMIT - 1);
  } else {
    query = query.limit(LIMIT);
  }

  const { data: foundations, error } = await query;

  if (error) {
    log(`Error: ${error.message}`);
    process.exit(1);
  }

  log(`${foundations.length} low-confidence foundations to re-profile`);

  if (foundations.length === 0) {
    log('Nothing to do.');
    return;
  }

  const scraper = new FoundationScraper({ requestDelayMs: 2000, maxPagesPerFoundation: 5 });
  const profiler = new FoundationProfiler();

  let upgraded = 0;
  let stillLow = 0;
  let errors = 0;

  for (let i = 0; i < foundations.length; i++) {
    const foundation = foundations[i];
    const name = foundation.name;
    const website = foundation.website;

    log(`  [${i + 1}/${foundations.length}] Re-profiling: ${name} (${website})`);

    if (DRY_RUN) {
      log(`    Would re-scrape and re-profile`);
      continue;
    }

    try {
      // Re-scrape (if website exists)
      let scraped = { websiteContent: null, aboutContent: null, programsContent: null, annualReportContent: null, scrapedUrls: [], errors: [] };
      if (website) {
        try {
          scraped = await scraper.scrapeFoundation(website);
          log(`    Scraped ${scraped.scrapedUrls.length} pages`);
          if (scraped.scrapedUrls.length === 0) {
            log(`    0 pages scraped — relying on Gemini Google Search grounding`);
          }
        } catch {
          log(`    Scrape failed — relying on Gemini Google Search grounding`);
        }
      } else {
        log(`    No website — relying on Gemini Google Search grounding`);
      }

      // Re-profile with multi-provider (gemini-grounded goes first)
      const profile = await profiler.profileFoundation(foundation, scraped);
      log(`    New confidence: ${profile.profile_confidence}`);
      if (profile.description) log(`    "${profile.description.slice(0, 80)}..."`);

      if (profile.profile_confidence === 'low' && !profile.description) {
        stillLow++;
        continue;
      }

      // Update DB
      const updateData = {
        description: profile.description,
        thematic_focus: profile.thematic_focus,
        geographic_focus: profile.geographic_focus,
        target_recipients: profile.target_recipients,
        total_giving_annual: profile.total_giving_annual,
        avg_grant_size: profile.avg_grant_size,
        grant_range_min: profile.grant_range_min,
        grant_range_max: profile.grant_range_max,
        giving_history: profile.giving_history,
        giving_ratio: profile.giving_ratio,
        endowment_size: profile.endowment_size,
        revenue_sources: profile.revenue_sources,
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
        enrichment_source: 'firecrawl+multi-llm',
        enriched_at: new Date().toISOString(),
        last_scraped_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('foundations')
        .update(updateData)
        .eq('id', foundation.id);

      if (updateError) {
        log(`    DB error: ${updateError.message}`);
        errors++;
      } else {
        upgraded++;
      }

      // Insert programs
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
    } catch (err) {
      log(`    Error: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  log(`\nComplete: ${upgraded} upgraded, ${stillLow} still low, ${errors} errors`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
