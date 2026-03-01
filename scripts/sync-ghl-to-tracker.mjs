#!/usr/bin/env node

/**
 * GHL → Grant Tracker Reverse Sync
 *
 * Fetches GHL opportunities and updates saved_grants stages to match.
 * Run every 6h via cron or manually.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-ghl-to-tracker.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://services.leadconnectorhq.com';

const GHL_TO_STAGE = {
  'application in progress': 'pursuing',
  'grant submitted': 'submitted',
  'approved': 'approved',
  'won': 'realized',
  'lost': 'lost',
};

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !locationId || !supabaseUrl || !supabaseKey) {
    console.error('Missing required env vars: GHL_API_KEY, GHL_LOCATION_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get pipelines
  const pipelinesRes = await fetch(`${BASE_URL}/opportunities/pipelines?locationId=${locationId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  const { pipelines } = await pipelinesRes.json();
  if (!pipelines?.length) {
    console.log('No pipelines found');
    return;
  }

  // Build stage ID → name map
  const stageMap = {};
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages || []) {
      stageMap[stage.id] = stage.name;
    }
  }

  // Fetch all opportunities
  const oppsRes = await fetch(
    `${BASE_URL}/opportunities/search?location_id=${locationId}&pipeline_id=${pipelines[0].id}&limit=100`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
    }
  );
  const { opportunities } = await oppsRes.json();
  if (!opportunities?.length) {
    console.log('No GHL opportunities found');
    return;
  }

  console.log(`Found ${opportunities.length} GHL opportunities`);

  // Get all saved_grants with ghl_opportunity_id
  const { data: savedGrants } = await supabase
    .from('saved_grants')
    .select('id, grant_id, stage, ghl_opportunity_id')
    .not('ghl_opportunity_id', 'is', null);

  if (!savedGrants?.length) {
    console.log('No saved grants with GHL IDs');
    return;
  }

  const ghlMap = new Map(savedGrants.map(sg => [sg.ghl_opportunity_id, sg]));
  let updated = 0;

  for (const opp of opportunities) {
    const saved = ghlMap.get(opp.id);
    if (!saved) continue;

    const ghlStageName = stageMap[opp.pipelineStageId]?.toLowerCase();
    const trackerStage = ghlStageName ? GHL_TO_STAGE[ghlStageName] : null;

    if (trackerStage && trackerStage !== saved.stage) {
      console.log(`${saved.grant_id}: ${saved.stage} → ${trackerStage} (GHL: ${stageMap[opp.pipelineStageId]})`);
      if (!dryRun) {
        await supabase
          .from('saved_grants')
          .update({ stage: trackerStage, updated_at: new Date().toISOString() })
          .eq('id', saved.id);
      }
      updated++;
    }
  }

  console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'} ${updated} saved grants from GHL`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
