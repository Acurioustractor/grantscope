#!/usr/bin/env node

/**
 * Profile VIP Foundations — Top 50 Philanthropists + Corporate Givers
 *
 * Sources:
 * - AFR Philanthropy 50 (2025)
 * - AFR Corporate Philanthropy 50 (2025)
 * - Forbes Australia Top 50 Corporate Givers
 * - Fundraising Research Australia Top Donors
 * - CSI High Net Wealth Giving Report
 *
 * This script:
 * 1. Creates missing foundations that aren't in the ACNC register
 * 2. Force re-profiles all VIP foundations regardless of current confidence
 * 3. Tags them with source lists and priority tier
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { FoundationScraper } from '../packages/grant-engine/src/foundations/annual-report-scraper.ts';
import { FoundationProfiler } from '../packages/grant-engine/src/foundations/foundation-profiler.ts';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[vip] ${msg}`);
}

/**
 * VIP Foundations — Australia's top philanthropic entities.
 * Data compiled from AFR Philanthropy 50, Forbes Corporate 50, and Fundraising Research.
 */
const VIP_FOUNDATIONS = [
  // === AFR PHILANTHROPY 50 (2025) — Private Giving ===
  { name: 'Yajilarra Trust', search: 'Yajilarra', website: null, annual_giving: 214000000, wealth_source: 'Cannon-Brookes (Atlassian)', tier: 'platinum', lists: ['afr_philanthropy_50'] },
  { name: 'Minderoo Foundation', search: 'Minderoo', website: 'https://www.minderoo.org', annual_giving: 210000000, wealth_source: 'Forrest (Fortescue Metals)', tier: 'platinum', lists: ['afr_philanthropy_50', 'fundraising_research'] },
  { name: 'Paul Ramsay Foundation', search: 'Paul Ramsay', website: 'https://www.paulramsayfoundation.org.au', annual_giving: 183000000, wealth_source: 'Ramsay Health Care', tier: 'platinum', lists: ['afr_philanthropy_50', 'fundraising_research'] },
  { name: 'Besen Family Foundation', search: 'Besen', website: null, annual_giving: 144000000, wealth_source: 'Sussan Group retail', tier: 'platinum', lists: ['afr_philanthropy_50'] },
  { name: 'Stan Perron Charitable Trust', search: 'Stan Perron', website: 'https://www.stanperronfoundation.com.au', annual_giving: 45000000, wealth_source: 'Property, Toyota dealerships', tier: 'gold', lists: ['afr_philanthropy_50', 'fundraising_research'] },
  { name: 'The Ian Potter Foundation', search: 'Ian Potter', website: 'https://www.ianpotter.org.au', annual_giving: 38000000, wealth_source: 'Stockbroking, finance', tier: 'gold', lists: ['afr_philanthropy_50'] },
  { name: 'Judith Neilson Foundation', search: 'Judith Neilson', website: 'https://www.jnf.org.au', annual_giving: 33000000, wealth_source: 'Property (Platinum Asset Management divorce)', tier: 'gold', lists: ['afr_philanthropy_50'] },
  { name: 'Kinghorn Foundation', search: 'Kinghorn', website: 'https://www.kinghornfoundation.org', annual_giving: 31000000, wealth_source: 'RAMS Home Loans, finance', tier: 'gold', lists: ['afr_philanthropy_50', 'fundraising_research'] },
  { name: 'Pratt Foundation', search: 'Pratt', website: 'https://www.prattfoundation.com.au', annual_giving: 31000000, wealth_source: 'Visy Industries (packaging)', tier: 'gold', lists: ['afr_philanthropy_50'] },
  { name: 'Susan McKinnon Foundation', search: 'Susan McKinnon', website: 'https://www.susanmckinnon.org.au', annual_giving: 29000000, wealth_source: 'Carsales.com.au', tier: 'gold', lists: ['afr_philanthropy_50'] },

  // === FUNDRAISING RESEARCH TOP DONORS ===
  { name: 'Lowy Foundation', search: 'Lowy', website: 'https://www.lowyfoundation.org.au', annual_giving: 50000000, wealth_source: 'Westfield (property/retail)', tier: 'gold', lists: ['fundraising_research'] },
  { name: 'Ainsworth Foundation', search: 'Ainsworth', website: null, annual_giving: 50000000, wealth_source: 'Ainsworth Game Technology (gaming machines)', tier: 'gold', lists: ['fundraising_research'] },
  { name: 'Geoffrey Cumming Foundation', search: 'Cumming', website: null, annual_giving: 250000000, wealth_source: null, tier: 'platinum', lists: ['fundraising_research'] },
  { name: 'Vincent Fairfax Family Foundation', search: 'Fairfax', website: 'https://www.vfrr.org.au', annual_giving: 155000000, wealth_source: 'Fairfax Media', tier: 'platinum', lists: ['fundraising_research'] },
  { name: 'Lindsay Fox Foundation', search: 'Lindsay Fox', website: null, annual_giving: 100000000, wealth_source: 'Linfox (transport/logistics)', tier: 'gold', lists: ['fundraising_research'] },
  { name: 'Poche Foundation', search: 'Poche', website: 'https://www.pochefoundation.org.au', annual_giving: 40000000, wealth_source: 'Quantitative trading', tier: 'gold', lists: ['fundraising_research'] },
  { name: 'Hancock Foundation', search: 'Hancock', website: null, annual_giving: 200000000, wealth_source: 'Hancock Prospecting (mining)', tier: 'platinum', lists: ['fundraising_research'] },
  { name: 'Talbot Family Foundation', search: 'Talbot', website: null, annual_giving: 300000000, wealth_source: 'Mining', tier: 'platinum', lists: ['fundraising_research'] },
  { name: 'Wedgetail Foundation', search: 'Wedgetail', website: 'https://www.wedgetailfoundation.org.au', annual_giving: null, wealth_source: 'Cameron Adams (Canva)', tier: 'gold', lists: ['fundraising_research'] },

  // === OTHER MAJOR PRIVATE FOUNDATIONS ===
  { name: 'The Myer Foundation', search: 'Myer Foundation', website: 'https://www.myerfoundation.org.au', annual_giving: 25000000, wealth_source: 'Myer retail', tier: 'gold', lists: ['major_private'] },
  { name: 'Tim Fairfax Family Foundation', search: 'Tim Fairfax', website: null, annual_giving: 20000000, wealth_source: 'Fairfax Media, property', tier: 'gold', lists: ['major_private'] },
  { name: 'Gandel Foundation', search: 'Gandel', website: 'https://www.gandelfoundation.org.au', annual_giving: 25000000, wealth_source: 'Chadstone Shopping Centre (property)', tier: 'gold', lists: ['major_private'] },
  { name: 'Snow Medical Research Foundation', search: 'Snow Medical', website: 'https://www.snowmedical.org.au', annual_giving: 20000000, wealth_source: 'Terry Snow (Canberra Airport)', tier: 'gold', lists: ['major_private'] },
  { name: 'Scanlon Foundation', search: 'Scanlon Foundation', website: 'https://www.scanlonfoundation.org.au', annual_giving: 15000000, wealth_source: 'Peter Scanlon (property)', tier: 'silver', lists: ['major_private'] },
  { name: 'Colonial Foundation Trust', search: 'Colonial Foundation', website: null, annual_giving: 9000000, wealth_source: 'Colonial Group (finance)', tier: 'silver', lists: ['afr_corporate_50'] },

  // === AFR CORPORATE PHILANTHROPY 50 (2025) ===
  { name: 'BHP Foundation', search: 'BHP', website: 'https://www.bhp.com/community', annual_giving: 195100000, wealth_source: 'Mining (ASX: BHP)', tier: 'platinum', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Rio Tinto Foundation', search: 'Rio Tinto', website: 'https://www.riotinto.com/sustainability/communities', annual_giving: 153700000, wealth_source: 'Mining (ASX: RIO)', tier: 'platinum', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Woolworths Group Foundation', search: 'Woolworths', website: 'https://www.woolworthsgroup.com.au/au/en/community.html', annual_giving: 146500000, wealth_source: 'Retail (ASX: WOW)', tier: 'platinum', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Coles Group Foundation', search: 'Coles Group', website: 'https://www.colesgroup.com.au/community', annual_giving: 132700000, wealth_source: 'Retail (ASX: COL)', tier: 'platinum', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Telstra Foundation', search: 'Telstra Foundation', website: 'https://www.telstra.com.au/aboutus/community-environment', annual_giving: 120900000, wealth_source: 'Telecommunications (ASX: TLS)', tier: 'platinum', lists: ['afr_corporate_50'] },
  { name: 'CBA Foundation', search: 'Commonwealth Bank', website: 'https://www.commbank.com.au/about-us/opportunity-initiatives.html', annual_giving: 56700000, wealth_source: 'Banking (ASX: CBA)', tier: 'gold', lists: ['afr_corporate_50'] },
  { name: 'Canva Foundation', search: 'Canva Foundation', website: 'https://www.canva.com/about/', annual_giving: 52800000, wealth_source: 'Tech (design platform)', tier: 'gold', lists: ['afr_corporate_50'] },
  { name: 'Westpac Foundation', search: 'Westpac', website: 'https://www.westpac.com.au/about-westpac/sustainability/initiatives-for-you', annual_giving: 42500000, wealth_source: 'Banking (ASX: WBC)', tier: 'gold', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'NAB Foundation', search: 'NAB Foundation', website: 'https://www.nab.com.au/about-us/social-impact', annual_giving: 17000000, wealth_source: 'Banking (ASX: NAB)', tier: 'silver', lists: ['afr_corporate_50'] },
  { name: 'Wesfarmers Foundation', search: 'Wesfarmers', website: 'https://www.wesfarmers.com.au/sustainability/community', annual_giving: 45300000, wealth_source: 'Conglomerate (ASX: WES)', tier: 'gold', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Santos Foundation', search: 'Santos Foundation', website: 'https://www.santos.com/sustainability/communities', annual_giving: 35600000, wealth_source: 'Oil & Gas (ASX: STO)', tier: 'gold', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Cotton On Foundation', search: 'Cotton On Foundation', website: 'https://cottonongroup.com.au/cotton-on-foundation/', annual_giving: 20200000, wealth_source: 'Retail (Cotton On Group)', tier: 'silver', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Atlassian Foundation', search: 'Atlassian Foundation', website: 'https://www.atlassian.com/company/philanthropy', annual_giving: 18300000, wealth_source: 'Tech (ASX: TEAM)', tier: 'silver', lists: ['afr_corporate_50'] },
  { name: 'Goodman Foundation', search: 'Goodman Foundation', website: 'https://www.goodman.com/sustainability/goodman-foundation', annual_giving: 16700000, wealth_source: 'Property (ASX: GMG)', tier: 'silver', lists: ['afr_corporate_50'] },
  { name: 'Macquarie Group Foundation', search: 'Macquarie Group', website: 'https://www.macquarie.com/au/en/about/community.html', annual_giving: 37500000, wealth_source: 'Finance (ASX: MQG)', tier: 'gold', lists: ['forbes_corporate_50'] },
  { name: 'ANZ Foundation', search: 'ANZ Foundation', website: 'https://www.anz.com.au/about-us/esg/', annual_giving: 32500000, wealth_source: 'Banking (ASX: ANZ)', tier: 'gold', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Fortescue Foundation', search: 'Fortescue', website: 'https://www.fortescue.com/sustainability', annual_giving: 54900000, wealth_source: 'Mining (ASX: FMG)', tier: 'gold', lists: ['afr_corporate_50'] },
  { name: 'CSL Foundation', search: 'CSL Foundation', website: 'https://www.csl.com/we-are-csl/our-commitment/community', annual_giving: 54000000, wealth_source: 'Biotech (ASX: CSL)', tier: 'gold', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Suncorp Foundation', search: 'Suncorp', website: 'https://www.suncorpgroup.com.au/corporate-responsibility', annual_giving: 9000000, wealth_source: 'Insurance/Banking (ASX: SUN)', tier: 'silver', lists: ['forbes_corporate_50'] },
  { name: 'QBE Foundation', search: 'QBE Foundation', website: 'https://www.qbe.com/au/about/sustainability', annual_giving: 12400000, wealth_source: 'Insurance (ASX: QBE)', tier: 'silver', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
  { name: 'Humanitix Foundation', search: 'Humanitix', website: 'https://www.humanitix.com', annual_giving: 5900000, wealth_source: 'Social enterprise (ticketing)', tier: 'silver', lists: ['afr_corporate_50', 'forbes_corporate_50'] },
];

async function main() {
  log(`Processing ${VIP_FOUNDATIONS.length} VIP foundations...`);
  log(`Dry run: ${DRY_RUN}`);

  const scraper = new FoundationScraper({ requestDelayMs: 1500, maxPagesPerFoundation: 5, preferJina: true });
  const profiler = new FoundationProfiler();

  let profiled = 0;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < VIP_FOUNDATIONS.length; i++) {
    const vip = VIP_FOUNDATIONS[i];
    log(`\n[${i + 1}/${VIP_FOUNDATIONS.length}] ${vip.name} (${vip.tier}) — $${((vip.annual_giving || 0) / 1000000).toFixed(0)}M/yr`);

    // Find in database
    const { data: existing } = await supabase
      .from('foundations')
      .select('*')
      .ilike('name', `%${vip.search}%`)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(1);

    let foundation = existing?.[0];

    if (!foundation) {
      // Create new entry for this VIP foundation
      log(`  Creating new foundation entry...`);
      if (!DRY_RUN) {
        const { data: created_f, error } = await supabase
          .from('foundations')
          .insert({
            name: vip.name,
            website: vip.website,
            total_giving_annual: vip.annual_giving,
            type: vip.lists.includes('afr_corporate_50') || vip.lists.includes('forbes_corporate_50') ? 'corporate_foundation' : 'private_ancillary_fund',
            wealth_source: vip.wealth_source,
          })
          .select()
          .single();

        if (error) {
          log(`  Error creating: ${error.message}`);
          errors++;
          continue;
        }
        foundation = created_f;
        created++;
      } else {
        log(`  Would create: ${vip.name}`);
        continue;
      }
    }

    const website = vip.website || foundation.website;

    if (DRY_RUN) {
      log(`  Would re-profile: ${foundation.name} (current: ${foundation.profile_confidence || 'none'})`);
      continue;
    }

    try {
      // Scrape (if website available)
      let scraped;
      if (website) {
        scraped = await scraper.scrapeFoundation(website);
        log(`  Scraped ${scraped.scrapedUrls.length} pages`);
      } else {
        log(`  No website — profiling from LLM knowledge only`);
        scraped = { websiteContent: null, aboutContent: null, programsContent: null, annualReportContent: null, scrapedUrls: [] };
      }

      // Profile
      const profile = await profiler.profileFoundation(foundation, scraped);
      log(`  Confidence: ${profile.profile_confidence}`);
      if (profile.description) log(`  "${profile.description.slice(0, 80)}..."`);

      // Update DB with profile + VIP metadata
      const updateData = {
        description: profile.description,
        thematic_focus: profile.thematic_focus,
        geographic_focus: profile.geographic_focus,
        target_recipients: profile.target_recipients,
        total_giving_annual: vip.annual_giving || profile.total_giving_annual,  // Prefer our verified data
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
        wealth_source: vip.wealth_source || profile.wealth_source,
        application_tips: profile.application_tips,
        notable_grants: profile.notable_grants,
        board_members: profile.board_members,
        scraped_urls: scraped.scrapedUrls,
        enrichment_source: 'firecrawl+jina+multi-llm+vip',
        enriched_at: new Date().toISOString(),
        last_scraped_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('foundations')
        .update(updateData)
        .eq('id', foundation.id);

      if (updateError) {
        log(`  DB error: ${updateError.message}`);
        errors++;
      } else {
        profiled++;
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
      log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  log(`\n=== VIP Profiling Complete ===`);
  log(`Profiled: ${profiled}`);
  log(`Created: ${created}`);
  log(`Errors: ${errors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
