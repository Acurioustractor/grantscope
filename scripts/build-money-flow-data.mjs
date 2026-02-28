#!/usr/bin/env tsx
/**
 * Build Money Flow Data
 *
 * Populates the money_flows table from existing GrantScope data:
 * - Foundation → grant programs → recipients (from foundation_programs + grant_opportunities)
 * - Corporate revenue → foundation → grants (from foundations where parent_company is set)
 * - Government budget → department → programs (from government_programs)
 *
 * Usage: tsx scripts/build-money-flow-data.mjs [--domain <domain>] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const dryRun = process.argv.includes('--dry-run');
const domainFilter = process.argv.includes('--domain')
  ? process.argv[process.argv.indexOf('--domain') + 1]
  : null;

let inserted = 0;

async function insertFlow(flow) {
  if (domainFilter && flow.domain !== domainFilter) return;

  if (dryRun) {
    console.log(`  [DRY RUN] ${flow.source_name} → ${flow.destination_name}: $${flow.amount?.toLocaleString() || '?'}`);
    inserted++;
    return;
  }

  const { error } = await supabase.from('money_flows').insert(flow);
  if (error) {
    console.error(`  ✗ ${flow.source_name} → ${flow.destination_name}: ${error.message}`);
  } else {
    inserted++;
  }
}

async function buildFoundationFlows() {
  console.log('\n--- Foundation Flows ---');

  // Get foundations with giving data
  const { data: foundations } = await supabase
    .from('foundations')
    .select('id, name, total_giving_annual, parent_company, asx_code, thematic_focus')
    .not('total_giving_annual', 'is', null)
    .gt('total_giving_annual', 0)
    .order('total_giving_annual', { ascending: false })
    .limit(200);

  if (!foundations?.length) {
    console.log('  No foundations with giving data found');
    return;
  }

  console.log(`  Found ${foundations.length} foundations with giving data`);

  for (const f of foundations) {
    const domain = inferDomain(f.thematic_focus || []);

    // Corporate → Foundation flow (if corporate foundation)
    if (f.parent_company) {
      await insertFlow({
        domain,
        source_type: 'corporate',
        source_name: f.parent_company,
        destination_type: 'foundation',
        destination_name: f.name,
        amount: f.total_giving_annual,
        year: 2025,
        flow_type: 'donation',
        notes: f.asx_code ? `ASX: ${f.asx_code}` : null,
      });
    }

    // Foundation → Programs flow
    const { data: programs } = await supabase
      .from('foundation_programs')
      .select('id, name, amount_max, categories')
      .eq('foundation_id', f.id)
      .limit(20);

    if (programs?.length) {
      for (const p of programs) {
        await insertFlow({
          domain: inferDomain(p.categories || []),
          source_type: 'foundation',
          source_name: f.name,
          destination_type: 'grant_program',
          destination_name: p.name,
          amount: p.amount_max,
          year: 2025,
          flow_type: 'grant',
        });
      }
    } else if (f.total_giving_annual) {
      // No specific programs — create a general flow
      await insertFlow({
        domain,
        source_type: 'foundation',
        source_name: f.name,
        destination_type: 'grant_program',
        destination_name: `${f.name} — General Grants`,
        amount: f.total_giving_annual,
        year: 2025,
        flow_type: 'grant',
      });
    }
  }
}

async function buildGovernmentFlows() {
  console.log('\n--- Government Program Flows ---');

  const { data: programs } = await supabase
    .from('government_programs')
    .select('*')
    .order('budget_annual', { ascending: false });

  if (!programs?.length) {
    console.log('  No government programs found (run ingest-youth-justice-data.mjs first)');
    return;
  }

  console.log(`  Found ${programs.length} government programs`);

  // Group by jurisdiction
  const byJurisdiction = new Map();
  for (const p of programs) {
    const key = p.jurisdiction;
    if (!byJurisdiction.has(key)) byJurisdiction.set(key, []);
    byJurisdiction.get(key).push(p);
  }

  for (const [jurisdiction, progs] of byJurisdiction) {
    const total = progs.reduce((s, p) => s + (Number(p.budget_annual) || 0), 0);
    const govName = jurisdiction === 'federal' ? 'Federal Government' :
      `${jurisdiction.toUpperCase()} Government`;

    // Taxpayer → Government
    await insertFlow({
      domain: progs[0].domain || 'general',
      source_type: 'taxpayer',
      source_name: `${jurisdiction.toUpperCase()} Taxpayers`,
      destination_type: 'government',
      destination_name: govName,
      amount: total,
      year: 2025,
      flow_type: 'budget_allocation',
    });

    // Government → Programs
    for (const p of progs) {
      await insertFlow({
        domain: p.domain || 'general',
        source_type: 'government',
        source_name: govName,
        destination_type: 'government_program',
        destination_name: p.name,
        amount: Number(p.budget_annual) || 0,
        year: 2025,
        flow_type: 'budget_allocation',
        evidence_url: p.source_url,
      });
    }
  }
}

async function buildGrantFlows() {
  console.log('\n--- Grant Opportunity Flows ---');

  const { data: grants } = await supabase
    .from('grant_opportunities')
    .select('id, name, provider, amount_max, categories, url')
    .not('amount_max', 'is', null)
    .gt('amount_max', 0)
    .order('amount_max', { ascending: false })
    .limit(100);

  if (!grants?.length) {
    console.log('  No grants with amounts found');
    return;
  }

  console.log(`  Found ${grants.length} grants with amount data`);

  for (const g of grants) {
    const domain = inferDomain(g.categories || []);
    await insertFlow({
      domain,
      source_type: 'government',
      source_name: g.provider || 'Australian Government',
      destination_type: 'grant_program',
      destination_name: g.name,
      amount: g.amount_max,
      year: 2025,
      flow_type: 'grant',
      evidence_url: g.url,
    });
  }
}

function inferDomain(categories) {
  if (!Array.isArray(categories)) return 'general';
  const cats = categories.map(c => c.toLowerCase());
  if (cats.includes('justice') || cats.includes('youth_justice')) return 'youth_justice';
  if (cats.includes('indigenous')) return 'indigenous';
  if (cats.includes('health')) return 'health';
  if (cats.includes('education')) return 'education';
  if (cats.includes('arts')) return 'arts';
  if (cats.includes('environment') || cats.includes('regenerative')) return 'environment';
  if (cats.includes('community')) return 'community';
  return 'general';
}

async function main() {
  console.log('=== Build Money Flow Data ===');
  if (dryRun) console.log('(DRY RUN — no data will be written)');
  if (domainFilter) console.log(`(Filtered to domain: ${domainFilter})`);

  await buildGovernmentFlows();
  await buildFoundationFlows();
  await buildGrantFlows();

  console.log(`\n✓ Total flows ${dryRun ? 'found' : 'inserted'}: ${inserted}`);

  // Summary by domain
  if (!dryRun) {
    const { data: summary } = await supabase
      .from('money_flows')
      .select('domain')
      .order('domain');

    if (summary) {
      const counts = {};
      for (const s of summary) counts[s.domain] = (counts[s.domain] || 0) + 1;
      console.log('\nFlows by domain:');
      for (const [domain, count] of Object.entries(counts)) {
        console.log(`  ${domain}: ${count}`);
      }
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
