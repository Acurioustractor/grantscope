#!/usr/bin/env node
/**
 * Pull-back sync: GoHighLevel → goods_procurement_entities
 *
 * For every opportunity in the Goods — Buyer Pipeline that we created from
 * the app (identified by ghl_opportunity_id stored locally), refresh:
 *   - ghl_stage_id, ghl_stage_name (where is it now?)
 *   - ghl_last_synced_at
 *
 * Also picks up stage names by joining the pipeline's stages list, so
 * "Outreach Queued" stays accurate if GHL renames stages.
 *
 * Run: node --env-file=.env --env-file=apps/web/.env.local scripts/sync-ghl-goods-buyers.mjs
 *
 * The agent uses the SAME GHL token + Supabase service role as the push API.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const GHL_API_URL = 'https://services.leadconnectorhq.com';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const PIPELINE_ID = process.env.GHL_GOODS_PIPELINE_ID;

async function ghlFetch(path) {
  const res = await fetch(`${GHL_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GHL ${path}: ${res.status} ${detail.slice(0, 160)}`);
  }
  return res.json();
}

async function fetchStageMap(pipelineId) {
  // Build a Map<stageId, stageName> for the pipeline. Some GHL accounts let
  // /pipelines list be called, some don't. We try and fall back to "unknown".
  try {
    const data = await ghlFetch(`/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`);
    const pipeline = (data.pipelines || []).find(p => p.id === pipelineId);
    if (!pipeline) return new Map();
    return new Map((pipeline.stages || []).map(s => [s.id, s.name]));
  } catch (err) {
    console.warn('[sync-ghl-goods-buyers] could not list pipelines:', err.message);
    return new Map();
  }
}

async function fetchOpportunities(pipelineId) {
  // GHL /opportunities/search supports pagination. We pull everything for this
  // pipeline; at ACT's scale (hundreds of buyer rows max) this is cheap.
  const out = [];
  let page = 1;
  for (let i = 0; i < 20; i++) {
    const data = await ghlFetch(
      `/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${pipelineId}&limit=100&page=${page}`,
    );
    const opps = data.opportunities || [];
    out.push(...opps);
    if (opps.length < 100) break;
    page++;
  }
  return out;
}

async function main() {
  const startedAt = Date.now();
  console.log('=== Sync GHL Goods Buyers (pull-back) ===');

  if (!GHL_API_KEY || !GHL_LOCATION_ID || !PIPELINE_ID) {
    throw new Error('Missing GHL_API_KEY, GHL_LOCATION_ID, or GHL_GOODS_PIPELINE_ID');
  }

  const [stageMap, opps] = await Promise.all([
    fetchStageMap(PIPELINE_ID),
    fetchOpportunities(PIPELINE_ID),
  ]);
  console.log(`Fetched ${opps.length} opportunities · ${stageMap.size} stages mapped`);

  // Build oppId → { stageId, stageName, status, updatedAt } map
  const byOppId = new Map();
  for (const o of opps) {
    byOppId.set(o.id, {
      stageId: o.pipelineStageId || o.stage_id || null,
      stageName: (o.pipelineStageId && stageMap.get(o.pipelineStageId)) || o.stageName || null,
      status: o.status || null,
      updatedAt: o.updatedAt || o.dateUpdated || o.lastStatusChangeAt || null,
    });
  }

  // Fetch all locally-tracked buyer rows that have an opp ID
  const { data: trackedRows, error: trackedErr } = await supabase
    .from('goods_procurement_entities')
    .select('id, entity_name, ghl_opportunity_id, ghl_stage_id, ghl_stage_name')
    .not('ghl_opportunity_id', 'is', null);
  if (trackedErr) throw new Error(`tracked rows: ${trackedErr.message}`);

  console.log(`Local rows with ghl_opportunity_id: ${trackedRows.length}`);

  let updated = 0;
  let stageChanged = 0;
  let missing = 0;
  const nowIso = new Date().toISOString();

  for (const row of trackedRows) {
    const opp = byOppId.get(row.ghl_opportunity_id);
    if (!opp) {
      missing++;
      // Opp was deleted in GHL — flag by clearing IDs? Keep historical for now.
      continue;
    }
    const patch = {
      ghl_stage_id: opp.stageId,
      ghl_stage_name: opp.stageName,
      ghl_last_synced_at: nowIso,
    };
    if (row.ghl_stage_id !== opp.stageId || row.ghl_stage_name !== opp.stageName) {
      stageChanged++;
    }
    const { error } = await supabase
      .from('goods_procurement_entities')
      .update(patch)
      .eq('id', row.id);
    if (error) console.error(`  update ${row.id}: ${error.message.slice(0, 80)}`);
    else updated++;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Updated:        ${updated}`);
  console.log(`Stage changed:  ${stageChanged}`);
  console.log(`Missing in GHL: ${missing}`);
  console.log(`Elapsed:        ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  return { items_found: trackedRows.length, items_updated: updated, items_new: stageChanged };
}

let runId;
(async () => {
  const run = await logStart(supabase, 'sync-ghl-goods-buyers', 'Sync GHL Goods Buyers');
  runId = run?.id || null;
  const result = await main();
  if (runId) await logComplete(supabase, runId, result);
})().catch(async (err) => {
  console.error('FATAL:', err);
  if (runId) try { await logFailed(supabase, runId, err); } catch {}
  process.exit(1);
});
