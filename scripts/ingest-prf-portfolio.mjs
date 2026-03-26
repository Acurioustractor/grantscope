#!/usr/bin/env node
/**
 * Ingest PRF Justice Reinvestment Portfolio Review (July 2025)
 * Source: JR-Portfolio-Review.pdf — Appendix A (15 grants, $53.1M total, 2021-2025)
 *
 * No per-partner dollar amounts in the PDF, so we record each grant with:
 * - amount_dollars = $53.1M / 15 = $3.54M average (noted as estimate in project_description)
 * - Actual total confirmed: $53.1M across 15 partnerships
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete } from './lib/log-agent-run.mjs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PRF_SOURCE = 'prf-jr-portfolio-review-2025';
const PRF_SOURCE_URL = 'https://www.paulramsayfoundation.org.au/justice-reinvestment';
const TOTAL_INVESTMENT = 53_100_000;
const PROGRAM_NAME = 'PRF Justice Reinvestment Portfolio';

// 15 grants from Appendix A
const grants = [
  {
    recipient_name: 'Aboriginal Legal Services (NSW/ACT)',
    type: 'Site-Level/Enabling',
    locations: ['Bourke, NSW', 'Kempsey, NSW', 'Moree, NSW', 'Mount Druitt, NSW', 'Nowra, NSW'],
    state: 'NSW',
    sector: 'legal-services',
    topics: ['youth-justice', 'indigenous', 'legal-services', 'diversion'],
  },
  {
    recipient_name: 'Anindilyakwa Royalties Aboriginal Corporation',
    type: 'Site-Level',
    locations: ['Groote Eylandt, NT'],
    state: 'NT',
    sector: 'indigenous',
    topics: ['youth-justice', 'indigenous', 'community-led'],
  },
  {
    recipient_name: 'Change the Record',
    type: 'Site-Level',
    locations: ['National'],
    state: null,
    sector: 'advocacy',
    topics: ['youth-justice', 'indigenous', 'prevention'],
  },
  {
    recipient_name: 'Human Rights Law Centre',
    type: 'Site-Level',
    locations: ['National'],
    state: null,
    sector: 'legal-services',
    topics: ['youth-justice', 'legal-services', 'diversion'],
  },
  {
    recipient_name: 'Justice and Equity Centre',
    type: 'Site-Level',
    locations: ['NSW'],
    state: 'NSW',
    sector: 'research',
    topics: ['youth-justice', 'prevention'],
  },
  {
    recipient_name: 'Justice Reform Initiative',
    type: 'Site-Level',
    locations: ['National'],
    state: null,
    sector: 'advocacy',
    topics: ['youth-justice', 'diversion', 'prevention'],
  },
  {
    recipient_name: 'Justice Reinvestment Network Australia',
    type: 'Advocacy',
    locations: ['National'],
    state: null,
    sector: 'advocacy',
    topics: ['youth-justice', 'indigenous', 'community-led'],
  },
  {
    recipient_name: 'Just Reinvest NSW',
    type: 'Site-Level/Enabling',
    locations: ['Kempsey, NSW', 'Moree, NSW', 'Mount Druitt, NSW', 'Nowra, NSW'],
    state: 'NSW',
    sector: 'community',
    topics: ['youth-justice', 'indigenous', 'community-led', 'diversion', 'prevention'],
  },
  {
    recipient_name: 'Maranguka',
    type: 'Site-Level',
    locations: ['Bourke, NSW'],
    state: 'NSW',
    sector: 'indigenous',
    topics: ['youth-justice', 'indigenous', 'community-led', 'prevention'],
  },
  {
    recipient_name: 'NTCOSS',
    type: 'Enabling',
    locations: ['NT'],
    state: 'NT',
    sector: 'peak-body',
    topics: ['youth-justice', 'indigenous'],
  },
  {
    recipient_name: 'Olabud Doogethu',
    type: 'Site-Level',
    locations: ['Kimberley, WA'],
    state: 'WA',
    sector: 'indigenous',
    topics: ['youth-justice', 'indigenous', 'community-led', 'diversion'],
  },
  {
    recipient_name: 'Social Reinvestment WA',
    type: 'Site-Level/Enabling',
    locations: ['Several developing community sites across WA'],
    state: 'WA',
    sector: 'community',
    topics: ['youth-justice', 'indigenous', 'community-led'],
  },
  {
    recipient_name: 'Tiraapendi Wodli / Australian Red Cross',
    type: 'Site-Level',
    locations: ['Port Adelaide, SA'],
    state: 'SA',
    sector: 'community',
    topics: ['youth-justice', 'indigenous', 'community-led', 'wraparound'],
  },
  {
    recipient_name: 'WEstjustice / CMY (Target Zero)',
    type: 'Site-Level',
    locations: ['West Melbourne, Victoria'],
    state: 'VIC',
    sector: 'legal-services',
    topics: ['youth-justice', 'diversion', 'prevention', 'community-led'],
  },
  {
    recipient_name: 'Yuwaya Ngarra-li / UNSW',
    type: 'Site-Level',
    locations: ['Walgett, NSW'],
    state: 'NSW',
    sector: 'research',
    topics: ['youth-justice', 'indigenous', 'community-led'],
  },
];

const dryRun = !process.argv.includes('--live');

async function main() {
  const startTime = Date.now();
  console.log(`PRF Portfolio Ingest — ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${grants.length} grants, $${(TOTAL_INVESTMENT / 1e6).toFixed(1)}M total\n`);

  // Check for existing PRF portfolio records
  const { data: existing } = await supabase
    .from('justice_funding')
    .select('id, recipient_name')
    .eq('source', PRF_SOURCE);

  if (existing && existing.length > 0) {
    console.log(`⚠ ${existing.length} records already exist with source='${PRF_SOURCE}'`);
    if (!process.argv.includes('--force')) {
      console.log('Use --force to delete and re-insert');
      return;
    }
    if (!dryRun) {
      const { error } = await supabase
        .from('justice_funding')
        .delete()
        .eq('source', PRF_SOURCE);
      if (error) throw error;
      console.log(`Deleted ${existing.length} existing records`);
    }
  }

  const avgAmount = Math.round(TOTAL_INVESTMENT / grants.length);
  let inserted = 0;
  let linked = 0;

  for (const grant of grants) {
    // Try to find matching entity by name
    // ABN overrides for tricky names; null = skip entity linking
    const abnOverrides = {
      'Aboriginal Legal Services (NSW/ACT)': '93118431066',
      'NTCOSS': '19556236404',
      'Yuwaya Ngarra-li / UNSW': null,
    };

    let entity = null;
    if (grant.recipient_name in abnOverrides) {
      const abn = abnOverrides[grant.recipient_name];
      if (abn) {
        const { data: entities } = await supabase
          .from('gs_entities')
          .select('id, gs_id, canonical_name, abn')
          .eq('abn', abn)
          .limit(1);
        entity = entities?.[0] || null;
      }
    } else {
      const searchTerm = grant.recipient_name.split('/')[0].trim().slice(0, 25);
      const { data: entities } = await supabase
        .from('gs_entities')
        .select('id, gs_id, canonical_name, abn')
        .ilike('canonical_name', `%${searchTerm}%`)
        .limit(5);
      entity = entities?.[0] || null;
    }
    const location = grant.locations.join(' | ');

    const row = {
      source: PRF_SOURCE,
      source_url: PRF_SOURCE_URL,
      recipient_name: grant.recipient_name,
      recipient_abn: entity?.abn || null,
      program_name: PROGRAM_NAME,
      program_round: grant.type,
      amount_dollars: avgAmount,
      state: grant.state,
      location,
      funding_type: 'grant',
      sector: grant.sector,
      project_description: `PRF JR portfolio grant (2021-2025). Type: ${grant.type}. Total portfolio: $53.1M across 15 partnerships. Per-partner amount is estimated average ($${(avgAmount / 1e6).toFixed(1)}M).`,
      financial_year: '2021-25',
      gs_entity_id: entity?.id || null,
      topics: grant.topics,
    };

    if (entity) {
      console.log(`✓ ${grant.recipient_name} → ${entity.canonical_name} (${entity.gs_id})`);
      linked++;
    } else {
      console.log(`○ ${grant.recipient_name} — no entity match`);
    }

    if (!dryRun) {
      const { error } = await supabase.from('justice_funding').insert(row);
      if (error) {
        console.error(`  ERROR: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }

  console.log(`\n${dryRun ? 'Would insert' : 'Inserted'}: ${dryRun ? grants.length : inserted}`);
  console.log(`Entity-linked: ${linked}/${grants.length} (${Math.round(linked / grants.length * 100)}%)`);

  if (!dryRun) {
    const runId = await logStart(supabase, 'ingest-prf-portfolio', 'PRF Portfolio Ingest');
    if (runId) {
      await logComplete(supabase, runId, {
        items_found: grants.length,
        items_new: inserted,
        metadata: { total_investment: TOTAL_INVESTMENT, linked },
      });
    }
  }
}

main().catch(console.error);
