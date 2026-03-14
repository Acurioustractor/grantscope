#!/usr/bin/env node
/**
 * Import ARC Grants from the ARC Data Portal API
 *
 * API: https://dataportal.arc.gov.au/NCGP/API/grants
 * Format: JSON:API, paginated (max 1000 per page)
 * No auth required.
 *
 * Usage:
 *   node --env-file=.env scripts/import-arc-grants.mjs [--apply] [--limit=1000]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const PAGE_SIZE = 1000;
const API_BASE = 'https://dataportal.arc.gov.au/NCGP/API/grants';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchPage(pageNum) {
  const url = `${API_BASE}?page%5Bnumber%5D=${pageNum}&page%5Bsize%5D=${PAGE_SIZE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ARC API error: ${res.status} ${res.statusText}`);
  return res.json();
}

function mapGrant(item) {
  const a = item.attributes;
  return {
    source: 'arc',
    grant_code: a.code || item.id,
    scheme_name: a['scheme-name'],
    program: a['scheme-information']?.program || null,
    title: a['grant-summary']?.slice(0, 5000) || null,
    lead_investigator: a['lead-investigator'] || null,
    investigators: a.investigators || null,
    admin_organisation: a['current-admin-organisation'] || a['announcement-admin-organisation'] || null,
    funding_amount: a['current-funding-amount'] || null,
    announced_amount: a['announced-funding-amount'] || null,
    commencement_year: a['funding-commencement-year'] || null,
    end_date: a['anticipated-end-date'] || null,
    status: a['grant-status'] || null,
    field_of_research: a['primary-field-of-research'] || null,
    national_interest: a['national-interest-test-statement']?.slice(0, 5000) || null,
  };
}

async function main() {
  const run = await logStart(db, 'import-arc-grants', 'Import ARC Research Grants');

  try {
    console.log('=== ARC Grants Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    // Fetch first page to get total
    const firstPage = await fetchPage(1);
    const totalGrants = firstPage.meta['total-size'];
    const totalPages = firstPage.meta['total-pages'];
    console.log(`  Total grants: ${totalGrants} across ${totalPages} pages`);

    const allGrants = [];
    let pageNum = 1;

    while (pageNum <= totalPages) {
      const page = pageNum === 1 ? firstPage : await fetchPage(pageNum);
      const grants = page.data.map(mapGrant);
      allGrants.push(...grants);

      if (pageNum % 5 === 0 || pageNum === totalPages) {
        console.log(`  Fetched page ${pageNum}/${totalPages} (${allGrants.length} grants)`);
      }

      if (LIMIT && allGrants.length >= LIMIT) {
        allGrants.splice(LIMIT);
        break;
      }

      pageNum++;

      // Small delay to be polite
      if (pageNum <= totalPages) await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n  ${allGrants.length} grants fetched`);

    // Dedupe by grant_code
    const seen = new Set();
    const unique = allGrants.filter(g => {
      if (seen.has(g.grant_code)) return false;
      seen.add(g.grant_code);
      return true;
    });
    console.log(`  ${unique.length} unique grants after dedup`);

    if (APPLY && unique.length > 0) {
      console.log('\nUpserting to database...');
      let upserted = 0;
      let errors = 0;

      // Batch upsert in chunks of 500
      for (let i = 0; i < unique.length; i += 500) {
        const chunk = unique.slice(i, i + 500);
        const { error } = await db
          .from('research_grants')
          .upsert(chunk, { onConflict: 'source,grant_code' });

        if (error) {
          console.error(`  Error at batch ${Math.floor(i / 500) + 1}: ${error.message}`);
          errors++;
        } else {
          upserted += chunk.length;
        }
      }

      console.log(`  ${upserted} upserted, ${errors} batch errors`);
    }

    // Stats
    const schemeBreakdown = {};
    for (const g of unique) {
      const s = g.scheme_name || 'Unknown';
      schemeBreakdown[s] = (schemeBreakdown[s] || 0) + 1;
    }

    console.log('\n=== Scheme Breakdown ===');
    const sorted = Object.entries(schemeBreakdown).sort((a, b) => b[1] - a[1]);
    for (const [scheme, count] of sorted.slice(0, 15)) {
      console.log(`  ${count.toString().padStart(6)} | ${scheme}`);
    }

    const totalFunding = unique.reduce((sum, g) => sum + (g.funding_amount || 0), 0);
    console.log(`\n  Total funding: $${(totalFunding / 1e9).toFixed(2)}B`);
    if (!APPLY) console.log('  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: totalGrants,
      items_new: unique.length,
      items_updated: APPLY ? unique.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
