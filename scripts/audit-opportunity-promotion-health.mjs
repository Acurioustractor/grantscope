#!/usr/bin/env node

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { normaliseIdentityText } from './lib/opportunity-promotion.mjs';

const OUTPUT = 'outputs/funding-research/opportunity-promotion-health-2026-08-12.json';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function all(table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function duplicates(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    map.set(key, [...(map.get(key) || []), row]);
  }
  return [...map.entries()].filter(([, values]) => values.length > 1).map(([key, values]) => ({ key, values }));
}

async function main() {
  const [ghl, pipeline, grants, promotions] = await Promise.all([
    all('ghl_opportunities', 'ghl_id,name,pipeline_name,stage_name,status,project_code,custom_fields,last_synced_at'),
    all('org_pipeline', 'id,name,source_type,source_ref,project_code,ghl_opportunity_id,owner_name,next_action,next_action_at,status'),
    all('grant_opportunities', 'id,name,ghl_opportunity_id,last_verified_at,goods_relevance_score,pipeline_stage,status', query => query.not('ghl_opportunity_id', 'is', null)),
    all('opportunity_promotions', 'id,source_type,source_ref,project_code,target_system,target_record_id,status,gate_snapshot,promoted_at'),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    counts: { ghl: ghl.length, pipeline: pipeline.length, linkedGrants: grants.length, promotions: promotions.length },
    duplicateGhlNames: duplicates(ghl.filter(row => row.status === 'open'), row => `${row.pipeline_name}|${normaliseIdentityText(row.name)}`),
    duplicatePipelineSources: duplicates(pipeline, row => row.source_type && row.source_ref ? `${row.project_code}|${row.source_type}|${row.source_ref}` : null),
    duplicatePipelineGhlIds: duplicates(pipeline.filter(row => row.ghl_opportunity_id), row => row.ghl_opportunity_id),
    grantGhlMissingMirror: grants.filter(grant => !ghl.some(row => row.ghl_id === grant.ghl_opportunity_id)),
    ghlWithoutPromotionLedger: pipeline.filter(row => row.ghl_opportunity_id && !promotions.some(p => p.target_system === 'ghl' && p.target_record_id === row.ghl_opportunity_id)),
    activeWithoutOwnedAction: pipeline.filter(row => ['pursuing', 'submitted', 'researching'].includes(row.status) && (!row.owner_name || !row.next_action || !row.next_action_at)),
    staleLinkedGrantEvidence: grants.filter(row => !row.last_verified_at || Date.now() - new Date(row.last_verified_at).getTime() > 30 * 86400000),
  };
  await mkdir('outputs/funding-research', { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    counts: report.counts,
    duplicateGhlNames: report.duplicateGhlNames.length,
    duplicatePipelineSources: report.duplicatePipelineSources.length,
    duplicatePipelineGhlIds: report.duplicatePipelineGhlIds.length,
    grantGhlMissingMirror: report.grantGhlMissingMirror.length,
    ghlWithoutPromotionLedger: report.ghlWithoutPromotionLedger.length,
    activeWithoutOwnedAction: report.activeWithoutOwnedAction.length,
    staleLinkedGrantEvidence: report.staleLinkedGrantEvidence.length,
    report: OUTPUT,
  }, null, 2));
}

main().catch(error => { console.error(`FAILED: ${error.message}`); process.exitCode = 1; });
