#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const VERSION = 'act-opportunity-v1';
const TARGET_PER_PROJECT = 20;
const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function words(value) {
  return new Set(String(value || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}

function profileTerms(profile) {
  const purpose = profile?.purpose || {};
  const identity = profile?.identity || {};
  return words([
    purpose.publicSummary,
    identity.category,
    ...(profile?.themes || []),
    ...(profile?.geographies || []),
    ...(purpose.outcomes || []),
  ].join(' '));
}

function opportunityTerms(opportunity) {
  return words([
    opportunity.name,
    opportunity.description,
    ...(opportunity.focus_areas || []),
    ...(opportunity.keywords || []),
    ...(opportunity.eligible_org_types || []),
  ].join(' '));
}

function overlapScore(left, right) {
  let score = 0;
  for (const term of left) if (right.has(term)) score += 1;
  return score;
}

function candidateRow(project, opportunity, role, score) {
  return {
    benchmark_version: VERSION,
    project_code: project.code,
    opportunity_id: opportunity.id,
    name: opportunity.name,
    funder_name: opportunity.funder_name,
    source_url: opportunity.source_url,
    deadline: opportunity.deadline,
    expected_label: null,
    label_source: 'curated_verification',
    review_status: 'pending',
    rationale: role === 'plausible'
      ? `Human review candidate for ${project.name}; selected from evidence-safe opportunities with ${score} structured term overlaps.`
      : `Control case for ${project.name}; test whether the hard gate correctly rejects a non-current or unsupported opportunity.`,
    evidence: {
      candidate_role: role,
      selection_method: 'project-funding-benchmark-v2',
      lexical_overlap: score,
      feed_status: opportunity.feed_status,
      verification_status: opportunity.verification_status,
      opportunity_type: opportunity.opportunity_type,
      generated_at: new Date().toISOString(),
    },
  };
}

const [projectsResult, profilesResult, casesResult, statusesResult, opportunitiesResult] = await Promise.all([
  db.from('org_projects').select('id, code, name').eq('status', 'active').order('sort_order'),
  db.from('project_funding_profiles').select('org_project_id, profile').eq('is_current', true),
  db.from('act_opportunity_benchmark_cases').select('project_code, opportunity_id, review_status, expected_label, evidence').eq('benchmark_version', VERSION),
  db.from('act_funding_opportunity_current_status').select('opportunity_id, feed_status'),
  db.from('alma_funding_opportunities').select('id, name, description, funder_name, source_url, application_url, deadline, focus_areas, keywords, eligible_org_types, verification_status, opportunity_type').limit(5000),
]);

for (const result of [projectsResult, profilesResult, casesResult, statusesResult, opportunitiesResult]) {
  if (result.error) throw new Error(result.error.message);
}

const profileByProject = new Map((profilesResult.data || []).map((row) => [row.org_project_id, row.profile]));
const statusByOpportunity = new Map((statusesResult.data || []).map((row) => [row.opportunity_id, row.feed_status]));
const opportunities = (opportunitiesResult.data || []).map((row) => ({ ...row, feed_status: statusByOpportunity.get(row.id) || 'unknown' }));
const plausible = opportunities.filter((row) => row.feed_status === 'apply_now' && row.source_url && row.application_url);
const controls = opportunities.filter((row) => row.feed_status !== 'apply_now' || !row.source_url || !row.application_url);
const existing = casesResult.data || [];
const rows = [];
const report = [];

for (const project of projectsResult.data || []) {
  const projectCases = existing.filter((row) => row.project_code === project.code);
  const existingIds = new Set(projectCases.map((row) => row.opportunity_id).filter(Boolean));
  const needed = Math.max(0, TARGET_PER_PROJECT - projectCases.length);
  const plausibleNeeded = Math.ceil(needed / 2);
  const controlNeeded = needed - plausibleNeeded;
  const terms = profileTerms(profileByProject.get(project.id));
  const rankedPlausible = plausible
    .filter((row) => !existingIds.has(row.id))
    .map((row) => ({ row, score: overlapScore(terms, opportunityTerms(row)) }))
    .sort((a, b) => b.score - a.score || String(a.row.deadline || '').localeCompare(String(b.row.deadline || '')))
    .slice(0, plausibleNeeded);
  const selectedIds = new Set(rankedPlausible.map((item) => item.row.id));
  const rankedControls = controls
    .filter((row) => !existingIds.has(row.id) && !selectedIds.has(row.id))
    .map((row) => ({ row, score: overlapScore(terms, opportunityTerms(row)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, controlNeeded);
  rows.push(
    ...rankedPlausible.map((item) => candidateRow(project, item.row, 'plausible', item.score)),
    ...rankedControls.map((item) => candidateRow(project, item.row, 'control', item.score)),
  );
  report.push({
    project_code: project.code,
    project_name: project.name,
    existing: projectCases.length,
    confirmed: projectCases.filter((row) => row.review_status === 'confirmed').length,
    added_plausible: rankedPlausible.length,
    added_controls: rankedControls.length,
    total_after: projectCases.length + rankedPlausible.length + rankedControls.length,
  });
}

console.log(JSON.stringify({ benchmark_version: VERSION, target_per_project: TARGET_PER_PROJECT, projects: report, candidates_to_add: rows.length, dry_run: DRY_RUN }, null, 2));

if (!DRY_RUN && rows.length) {
  const { error } = await db.from('act_opportunity_benchmark_cases').upsert(rows, { onConflict: 'benchmark_version,project_code,opportunity_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
