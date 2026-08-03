#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const VERSION = 'act-opportunity-v1';
const TARGET = 100;
const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function rowFromDecision(decision) {
  const opportunity = decision.opportunity;
  return {
    benchmark_version: VERSION,
    project_code: decision.project_code,
    opportunity_id: decision.opportunity_id,
    name: opportunity.name,
    funder_name: opportunity.funder_name,
    source_url: opportunity.source_url,
    deadline: opportunity.deadline,
    expected_label: decision.decision === 'watching' ? 'relevant' : 'not_relevant',
    label_source: 'human_decision',
    review_status: 'confirmed',
    rationale: decision.notes || `Imported from ACT decision: ${decision.decision}.`,
    evidence: {
      decision_id: decision.id,
      decision: decision.decision,
      decided_at: decision.decided_at,
      verification_status: opportunity.verification_status,
      opportunity_type: opportunity.opportunity_type,
    },
    reviewed_by: decision.decided_by,
    reviewed_at: decision.decided_at,
  };
}

function rowFromCandidate(opportunity, projectCode, rationale) {
  return {
    benchmark_version: VERSION,
    project_code: projectCode,
    opportunity_id: opportunity.id,
    name: opportunity.name,
    funder_name: opportunity.funder_name,
    source_url: opportunity.source_url,
    deadline: opportunity.deadline,
    expected_label: null,
    label_source: 'curated_verification',
    review_status: 'pending',
    rationale,
    evidence: {
      verification_status: opportunity.verification_status,
      opportunity_type: opportunity.opportunity_type,
      verification_notes: opportunity.verification_notes,
      focus_areas: opportunity.focus_areas,
      eligible_org_types: opportunity.eligible_org_types,
    },
  };
}

const { data: decisions, error: decisionsError } = await db
  .from('act_grant_recommendation_decisions')
  .select(`
    id, project_code, opportunity_id, decision, notes, decided_by, decided_at,
    opportunity:alma_funding_opportunities(
      id, name, funder_name, source_url, deadline, verification_status, opportunity_type
    )
  `)
  .in('decision', ['passed', 'watching']);
if (decisionsError) throw new Error(decisionsError.message);

const confirmedRows = (decisions ?? []).filter((row) => row.opportunity).map(rowFromDecision);
const confirmedKeys = new Set(confirmedRows.map((row) => row.opportunity_id));
const needed = Math.max(0, TARGET - confirmedRows.length);
const positiveTarget = Math.ceil(needed / 2);
const negativeTarget = needed - positiveTarget;

const [{ data: verified }, { data: controls }] = await Promise.all([
  db.from('alma_funding_opportunities')
    .select('id, name, funder_name, source_url, deadline, verification_status, opportunity_type, verification_notes, focus_areas, eligible_org_types')
    .eq('opportunity_type', 'open_grant')
    .eq('verification_status', 'verified')
    .order('verified_at', { ascending: false, nullsFirst: false })
    .limit(positiveTarget * 3),
  db.from('alma_funding_opportunities')
    .select('id, name, funder_name, source_url, deadline, verification_status, opportunity_type, verification_notes, focus_areas, eligible_org_types')
    .in('opportunity_type', ['award', 'invitation_only', 'partnership', 'policy_framework', 'placeholder'])
    .eq('verification_status', 'placeholder')
    .order('updated_at', { ascending: false })
    .limit(negativeTarget * 3),
]);

const projectCodes = ['ACT-GD', 'ACT-HV', 'ACT-JH', 'ACT-EL', 'ACT-CORE', 'ACT-FM'];
const positives = (verified ?? [])
  .filter((row) => !confirmedKeys.has(row.id))
  .slice(0, positiveTarget)
  .map((row, index) => rowFromCandidate(
    row,
    projectCodes[index % projectCodes.length],
    'Candidate previously classified as a verified open grant. Confirm that it is still open and relevant to the assigned ACT project.',
  ));
const negatives = (controls ?? [])
  .filter((row) => !confirmedKeys.has(row.id))
  .slice(0, negativeTarget)
  .map((row, index) => rowFromCandidate(
    row,
    projectCodes[index % projectCodes.length],
    `Control candidate: classified ${row.opportunity_type}. Human must confirm it should not be recommended.`,
  ));

const rows = [...confirmedRows, ...positives, ...negatives].slice(0, TARGET);
console.log(JSON.stringify({
  benchmark_version: VERSION,
  target: TARGET,
  confirmed_human_labels: confirmedRows.length,
  pending_positive_candidates: positives.length,
  pending_control_candidates: negatives.length,
  total: rows.length,
  dry_run: DRY_RUN,
}, null, 2));

if (!DRY_RUN && rows.length) {
  const { error } = await db
    .from('act_opportunity_benchmark_cases')
    .upsert(rows, { onConflict: 'benchmark_version,project_code,opportunity_id' });
  if (error) throw new Error(error.message);
}
