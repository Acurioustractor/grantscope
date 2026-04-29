#!/usr/bin/env node

/**
 * Seed Public Grant Finder Sources
 *
 * Adds public council/funding-finder landing pages and public GrantGuru /
 * SmartySearch information pages to source_frontier. These are not paywalled
 * subscriber datasets. They are public upstream/source-discovery pages used to
 * find council, corporate, philanthropic, and government grant sources.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-public-grant-finder-sources.mjs
 *   node --env-file=.env scripts/seed-public-grant-finder-sources.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'seed-public-grant-finder-sources';
const AGENT_NAME = 'Seed Public Grant Finder Sources';
const DRY_RUN = process.argv.includes('--dry-run');
const NOW = new Date().toISOString();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const PUBLIC_FINDER_TARGETS = [
  {
    name: 'Gladstone Regional Council Funding Finder',
    url: 'https://www.gladstone.qld.gov.au/Community/Our-Community/Community-Investment/Grant-Funding-Finder',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-funding-finder',
    priority: 7,
    metadata: {
      platform: 'grantguru',
      region: 'Gladstone, QLD',
      roles: ['council-landing-page', 'grantguru-entrypoint'],
    },
  },
  {
    name: 'GrantGuru Gladstone Portal',
    url: 'https://grantguru.com/au/gladstonerc',
    parserHint: 'grantguru-public-portal',
    discoverySource: 'public-grantguru',
    priority: 7,
    metadata: {
      platform: 'grantguru',
      region: 'Gladstone, QLD',
      roles: ['grantguru-portal-root'],
    },
  },
  {
    name: 'Campbelltown Council Funding Finder',
    url: 'https://www.campbelltown.sa.gov.au/business/business-grants-and-sponsorships/external-grants',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-funding-finder',
    priority: 6,
    metadata: {
      platform: 'grantguru',
      region: 'Campbelltown, SA',
      roles: ['council-landing-page', 'grantguru-entrypoint'],
    },
  },
  {
    name: 'City of Stonnington Grant Funding Finder',
    url: 'https://www.stonnington.vic.gov.au/Business/Find-business-support',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-funding-finder',
    priority: 6,
    metadata: {
      platform: 'grantguru',
      region: 'Stonnington, VIC',
      roles: ['council-landing-page', 'grantguru-entrypoint'],
    },
  },
  {
    name: 'Bega Valley GrantGuru Funding Finder Reference',
    url: 'https://fsccmn.com/?p=2548',
    parserHint: 'public-funding-finder-reference',
    discoverySource: 'public-funding-finder',
    priority: 5,
    metadata: {
      platform: 'grantguru',
      region: 'Bega Valley, NSW',
      roles: ['public-reference-page', 'grantguru-entrypoint'],
    },
  },
  {
    name: 'RDA Southern Inland GrantGuru Funding Finder Reference',
    url: 'https://www.miragenews.com/finding-grant-funding-made-easy-thanks-to-grant-639733/',
    parserHint: 'public-funding-finder-reference',
    discoverySource: 'public-funding-finder',
    priority: 5,
    metadata: {
      platform: 'grantguru',
      region: 'Southern Inland NSW',
      roles: ['public-reference-page', 'grantguru-entrypoint'],
    },
  },
  {
    name: 'Funding Centre SmartySearch',
    url: 'https://explore.fundingcentre.com.au/smartysearch',
    parserHint: 'smartysearch-public-info',
    discoverySource: 'public-smartysearch',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      roles: ['smartysearch-info', 'council-portal-index'],
      public_claims: ['daily-updated grants', 'government philanthropic corporate grantmakers'],
    },
  },
  {
    name: 'Funding Centre SmartySearch Grantseeker FAQs',
    url: 'https://explore.fundingcentre.com.au/smartysearch-grantseeker-faqs',
    parserHint: 'smartysearch-public-info',
    discoverySource: 'public-smartysearch',
    priority: 6,
    metadata: {
      platform: 'smartysearch',
      roles: ['smartysearch-info', 'source-methodology'],
    },
  },
  {
    name: 'Funding Centre SmartySearch FAQs',
    url: 'https://explore.fundingcentre.com.au/smartysearch-faq',
    parserHint: 'smartysearch-public-info',
    discoverySource: 'public-smartysearch',
    priority: 6,
    metadata: {
      platform: 'smartysearch',
      roles: ['smartysearch-info', 'council-portal-index'],
    },
  },
  {
    name: 'Bundaberg Regional Council SmartySearch',
    url: 'https://www.bundaberg.qld.gov.au/Community/Grants-and-financial-assistance/SmartySearch',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Bundaberg, QLD',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'Cassowary Coast Grants Search',
    url: 'https://www.cassowarycoast.qld.gov.au/Living-Here/Grants-and-Funding/Grants-Search',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Cassowary Coast, QLD',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'Cumberland City Council Funding Centre Grants Database',
    url: 'https://www.cumberland.nsw.gov.au/funding-centre-grants-database',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Cumberland, NSW',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'City of Darebin External Grant Opportunities',
    url: 'https://www.darebin.vic.gov.au/About-council/Darebin-grants/External-grant-opportunities',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Darebin, VIC',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'Glenelg Shire SmartySearch',
    url: 'https://www.glenelg.vic.gov.au/Our-Community/Grants/SmartySearch',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Glenelg, VIC',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'City of Greater Geelong Funding',
    url: 'https://www.geelongaustralia.com.au/grants/funding/default.aspx',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Greater Geelong, VIC',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'Inner West Grant Finder',
    url: 'https://www.innerwest.nsw.gov.au/contribute/grants/grant-finder',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Inner West, NSW',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'Maribyrnong Grant Search',
    url: 'https://www.maribyrnong.vic.gov.au/Community/Grants/Grant-Search',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 7,
    metadata: {
      platform: 'smartysearch',
      region: 'Maribyrnong, VIC',
      roles: ['council-landing-page', 'smartysearch-entrypoint'],
    },
  },
  {
    name: 'Regional Arts Victoria SmartySearch',
    url: 'https://www.rav.net.au/smartysearch/',
    parserHint: 'public-funding-finder-landing',
    discoverySource: 'public-smartysearch-client',
    priority: 6,
    metadata: {
      platform: 'smartysearch',
      region: 'Victoria',
      roles: ['peak-body-landing-page', 'smartysearch-entrypoint'],
    },
  },
];

function canonicalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hash = '';
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.toString();
}

function shortHash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function domainFor(url) {
  return new URL(url).hostname.toLowerCase();
}

function buildRow(target) {
  const targetUrl = canonicalizeUrl(target.url);
  return {
    source_key: `grant-source:public-finder:${shortHash(targetUrl)}`,
    source_kind: 'grant_source_page',
    source_name: target.name,
    target_url: targetUrl,
    domain: domainFor(targetUrl),
    parser_hint: target.parserHint,
    owning_agent_id: 'grantscope-discovery',
    discovery_source: target.discoverySource,
    cadence_hours: 72,
    priority: target.priority,
    enabled: true,
    change_detection: 'html',
    confidence: 'seeded',
    next_check_at: NOW,
    failure_count: 0,
    metadata: {
      seeded_by: AGENT_ID,
      seeded_at: NOW,
      source_policy: 'public pages only; no subscriber or login-gated scraping',
      ...(target.metadata || {}),
    },
    updated_at: NOW,
  };
}

async function main() {
  const run = DRY_RUN ? { id: null } : await logStart(db, AGENT_ID, AGENT_NAME);
  try {
    const rows = PUBLIC_FINDER_TARGETS.map(buildRow);

    console.log(`Public finder source targets: ${rows.length}`);
    for (const row of rows) {
      console.log(`- ${row.source_name} | ${row.target_url}`);
    }

    if (!DRY_RUN) {
      const { error } = await db
        .from('source_frontier')
        .upsert(rows, { onConflict: 'source_key' });
      if (error) throw error;
    }

    await logComplete(db, run.id, {
      items_found: rows.length,
      items_new: DRY_RUN ? 0 : rows.length,
    });
  } catch (error) {
    await logFailed(db, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
