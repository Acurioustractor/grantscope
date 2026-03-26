#!/usr/bin/env node
/**
 * Seed Governed Proof tasks for PRF Justice Reinvestment Portfolio partners
 *
 * Creates 'discover_gap' tasks for each of the 15 PRF partner orgs,
 * triggering the outcomes collection pipeline.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-prf-outcomes-tasks.mjs
 *   node --env-file=.env scripts/seed-prf-outcomes-tasks.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function main() {
  log('═══ PRF Outcomes Task Seeder ═══');
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  // Get PRF portfolio partners with their current status
  const { data: partners, error: pErr } = await db.rpc('exec_sql', {
    query: `
      SELECT
        jf.recipient_name,
        jf.recipient_abn,
        jf.gs_entity_id,
        ge.gs_id,
        ge.canonical_name,
        jf.amount_dollars,
        (SELECT COUNT(*) FROM outcome_submissions os WHERE os.gs_entity_id = ge.gs_id) as existing_submissions,
        (SELECT COUNT(*) FROM alma_interventions ai WHERE ai.gs_entity_id = jf.gs_entity_id) as alma_count,
        (SELECT COUNT(*) FROM governed_proof_tasks gpt WHERE gpt.target_id = ge.gs_id AND gpt.status != 'completed') as pending_tasks
      FROM justice_funding jf
      LEFT JOIN gs_entities ge ON ge.id = jf.gs_entity_id
      WHERE jf.program_name = 'PRF Justice Reinvestment Portfolio'
        AND jf.gs_entity_id IS NOT NULL
      ORDER BY jf.recipient_name
    `
  });

  if (pErr) {
    log(`Error fetching partners: ${pErr.message}`);
    return;
  }

  log(`PRF partners found: ${partners.length}`);

  let created = 0;
  let skipped = 0;

  for (const p of partners) {
    // Skip if already has pending tasks
    if (p.pending_tasks > 0) {
      log(`  ⊘ ${p.canonical_name} — ${p.pending_tasks} pending tasks already`);
      skipped++;
      continue;
    }

    // Determine priority based on existing evidence
    const hasAlma = p.alma_count > 0;
    const hasSubmissions = p.existing_submissions > 0;
    const priority = hasSubmissions ? 'low' : hasAlma ? 'medium' : 'high';
    const lane = hasAlma ? 'core' : 'hot';

    // Calculate value score: higher for orgs with more funding and less evidence
    const fundingWeight = Math.min(p.amount_dollars / 1000000, 5); // cap at 5
    const evidenceGap = hasSubmissions ? 0.2 : hasAlma ? 0.5 : 1.0;
    const valueScore = Math.round((fundingWeight * evidenceGap) * 100) / 100;

    log(`  ${hasSubmissions ? '✓' : hasAlma ? '◐' : '○'} ${p.canonical_name}`);
    log(`    Funding: $${(p.amount_dollars / 1000000).toFixed(1)}M | ALMA: ${p.alma_count} | Submissions: ${p.existing_submissions} | Priority: ${priority}`);

    if (APPLY) {
      // Task 1: Discover outcomes gap
      const { error: t1Err } = await db
        .from('governed_proof_tasks')
        .insert({
          task_type: 'discover_gap',
          status: 'queued',
          queue_lane: lane,
          priority,
          owner_system: 'GS',
          system_scope: ['GS', 'JH'],
          target_type: 'organization',
          target_id: p.gs_id,
          value_score: valueScore,
          confidence_required: 0.6,
          input_payload: {
            entity_name: p.canonical_name,
            entity_abn: p.recipient_abn,
            funding_amount: p.amount_dollars,
            funding_program: 'PRF Justice Reinvestment Portfolio',
            existing_alma: p.alma_count,
            existing_submissions: p.existing_submissions,
            action: 'collect_outcomes',
            description: `Collect program outcomes for ${p.canonical_name} — PRF JR portfolio partner ($${(p.amount_dollars / 1000000).toFixed(1)}M). ${hasAlma ? `Has ${p.alma_count} ALMA interventions as starting evidence.` : 'No existing evidence — priority collection target.'}`,
          },
          acceptance_checks: [
            'has_quantitative_outcomes',
            'has_reporting_period',
            'linked_to_entity',
          ],
          review_status: 'not_required',
          promotion_status: 'internal',
        });

      if (t1Err) {
        log(`    ✗ Error: ${t1Err.message}`);
      } else {
        created++;
        log(`    ✓ Created discover_gap task`);
      }

      // Task 2: Assemble proof bundle (depends on gap discovery)
      const { error: t2Err } = await db
        .from('governed_proof_tasks')
        .insert({
          task_type: 'assemble_proof',
          status: 'queued',
          queue_lane: 'core',
          priority: 'medium',
          owner_system: 'GS',
          system_scope: ['GS', 'JH'],
          target_type: 'organization',
          target_id: p.gs_id,
          value_score: valueScore * 0.8,
          confidence_required: 0.5,
          input_payload: {
            entity_name: p.canonical_name,
            entity_abn: p.recipient_abn,
            bundle_type: 'prf_portfolio_outcomes',
            description: `Assemble Governed Proof bundle for ${p.canonical_name} combining funding records, ALMA evidence, and outcome submissions.`,
          },
          acceptance_checks: [
            'has_funding_records',
            'has_evidence_or_outcomes',
            'confidence_above_threshold',
          ],
          review_status: 'pending',
          promotion_status: 'draft',
        });

      if (t2Err) {
        log(`    ✗ Bundle task error: ${t2Err.message}`);
      } else {
        log(`    ✓ Created assemble_proof task`);
      }
    } else {
      log(`    [DRY RUN] Would create discover_gap + assemble_proof tasks`);
    }
  }

  log(`\n═══ SUMMARY ═══`);
  log(`  Partners: ${partners.length}`);
  log(`  Tasks created: ${created} discover_gap + ${created} assemble_proof`);
  log(`  Skipped (existing tasks): ${skipped}`);

  // Show portfolio status
  log(`\n═══ PORTFOLIO STATUS ═══`);
  const proven = partners.filter(p => p.existing_submissions > 0).length;
  const evidenced = partners.filter(p => p.alma_count > 0 && p.existing_submissions === 0).length;
  const gaps = partners.filter(p => p.alma_count === 0 && p.existing_submissions === 0).length;
  log(`  Proven (submissions): ${proven}/15`);
  log(`  Evidence exists (ALMA): ${evidenced}/15`);
  log(`  Gaps (no evidence): ${gaps}/15`);
  log(`  Total funding: $${(partners.reduce((s, p) => s + p.amount_dollars, 0) / 1000000).toFixed(1)}M`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
