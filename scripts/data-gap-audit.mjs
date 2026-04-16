#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { AGENTS } from './lib/agent-registry.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error('Missing Supabase environment');
  process.exit(1);
}

const HIGH_VALUE_AGENT_IDS = [
  'discover-foundation-programs',
  'discover-foundation-programs-full-sweep',
  'sync-foundation-programs-full-sweep',
  'scrape-state-grants',
  'run-scraping-agents',
  'scrape-grant-deadlines',
  'enrich-foundations',
  'enrich-charities',
  'enrich-social-enterprises',
  'enrich-oric-corporations',
  'enrich-programs',
  'build-foundation-profiles',
  'profile-vip-foundations',
  'reprofile-low-confidence',
  'reprofile-missing-descriptions',
  'classify-acnc-social-enterprises',
  'profile-community-orgs',
  'import-acnc-financials',
  'import-social-traders',
  'import-bcorp-au',
  'import-state-se-networks',
  'import-buyability',
  'import-ndis-provider-market',
  'import-ndis-provider-register',
  'import-gov-procurement-se',
  'import-indigenous-directories',
  'import-modern-slavery',
  'import-lobbying-register',
  'import-rogs-justice',
  'import-gov-grants',
  'send-billing-reminders',
];

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const [
    { data: schedules, error: schedulesError },
    { data: runSummary, error: runsError },
    { data: foundations, error: foundationsError },
    { data: grants, error: grantsError },
    { data: socialEnterprises, error: seError },
    { data: communityOrgs, error: communityError },
  ] = await Promise.all([
    supabase.from('agent_schedules').select('agent_id, interval_hours, enabled, priority, params'),
    supabase
      .from('agent_runs')
      .select('agent_id, status, started_at, errors')
      .order('started_at', { ascending: false })
      .limit(200),
    supabase
      .from('foundations')
      .select('id, description, profile_confidence', { count: 'exact' }),
    supabase
      .from('grant_opportunities')
      .select('id, closes_at, amount_min, amount_max, description', { count: 'exact' }),
    supabase
      .from('social_enterprises')
      .select('id, description, business_model, website', { count: 'exact' }),
    supabase
      .from('community_orgs')
      .select('id, description, website', { count: 'exact' }),
  ]);

  for (const [label, error] of [
    ['agent_schedules', schedulesError],
    ['agent_runs', runsError],
    ['foundations', foundationsError],
    ['grant_opportunities', grantsError],
    ['social_enterprises', seError],
    ['community_orgs', communityError],
  ]) {
    if (error) {
      console.error(`Failed to fetch ${label}: ${error.message}`);
      process.exit(1);
    }
  }

  const scheduledIds = new Set((schedules || []).map(row => row.agent_id));
  const unscheduledHighValue = HIGH_VALUE_AGENT_IDS.filter(id => !scheduledIds.has(id));

  const latestByAgent = new Map();
  for (const run of runSummary || []) {
    if (!latestByAgent.has(run.agent_id)) latestByAgent.set(run.agent_id, run);
  }

  const failingAgents = Array.from(latestByAgent.entries())
    .filter(([, run]) => run.status !== 'success')
    .slice(0, 12);

  printHeader('Coverage');
  console.log(`Foundations described: ${foundations.filter(row => row.description).length}/${foundations.length}`);
  console.log(`Foundations high confidence: ${foundations.filter(row => row.profile_confidence === 'high').length}/${foundations.length}`);
  console.log(`Grants with deadline: ${grants.filter(row => row.closes_at).length}/${grants.length}`);
  console.log(`Grants with amount: ${grants.filter(row => row.amount_min !== null || row.amount_max !== null).length}/${grants.length}`);
  console.log(`Grants with description: ${grants.filter(row => row.description).length}/${grants.length}`);
  console.log(`Social enterprises with description: ${socialEnterprises.filter(row => row.description).length}/${socialEnterprises.length}`);
  console.log(`Social enterprises with business model: ${socialEnterprises.filter(row => row.business_model).length}/${socialEnterprises.length}`);
  console.log(`Social enterprises with website: ${socialEnterprises.filter(row => row.website).length}/${socialEnterprises.length}`);
  console.log(`Community orgs with description: ${communityOrgs.filter(row => row.description).length}/${communityOrgs.length}`);
  console.log(`Community orgs with website: ${communityOrgs.filter(row => row.website).length}/${communityOrgs.length}`);

  printHeader('Missing Schedules');
  if (!unscheduledHighValue.length) {
    console.log('None');
  } else {
    for (const agentId of unscheduledHighValue) {
      const agent = AGENTS[agentId];
      console.log(`- ${agentId} (${agent?.category || 'unknown'})`);
    }
  }

  printHeader('Latest Non-Success Agents');
  if (!failingAgents.length) {
    console.log('None');
  } else {
    for (const [agentId, run] of failingAgents) {
      const errorPreview = run.errors ? JSON.stringify(run.errors).slice(0, 180) : '';
      console.log(`- ${agentId}: ${run.status} at ${run.started_at}${errorPreview ? ` :: ${errorPreview}` : ''}`);
    }
  }

  printHeader('Recommended Next Actions');
  const recommendations = [];
  if (unscheduledHighValue.length) recommendations.push('Apply the agent schedule expansion migration');
  if (failingAgents.some(([id]) => id === 'build-entity-graph')) recommendations.push('Increase build-entity-graph timeout or lower batch scope');
  if (failingAgents.some(([id]) => id === 'build-foundation-profiles')) recommendations.push('Run build-foundation-profiles with smaller batches and MiniMax-first rotation');
  if (foundations.filter(row => row.description).length / foundations.length < 0.4) recommendations.push('Prioritise foundation enrichment and reprofile-low-confidence runs');
  if (communityOrgs.filter(row => row.description).length / communityOrgs.length < 0.25) recommendations.push('Run profile-community-orgs and enrich-charities on a daily cadence');
  if (socialEnterprises.filter(row => row.business_model).length / socialEnterprises.length < 0.75) recommendations.push('Run import + enrich-social-enterprises cadence and keep MiniMax active');
  if (grants.filter(row => row.closes_at).length / grants.length < 0.5) recommendations.push('Keep scrape-state-grants and scrape-grant-deadlines on daily cadence');

  for (const recommendation of recommendations) {
    console.log(`- ${recommendation}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
