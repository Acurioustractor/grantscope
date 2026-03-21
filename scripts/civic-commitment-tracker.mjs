#!/usr/bin/env node
/**
 * civic-commitment-tracker.mjs
 *
 * Compares ministerial statements against charter commitments to detect progress.
 * Updates commitment status based on keyword matching and semantic similarity.
 *
 * Usage:
 *   node --env-file=.env scripts/civic-commitment-tracker.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// Keywords extracted from each commitment, used for matching
function extractKeywords(text) {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  // Remove common stop words
  const stops = new Set(['that', 'this', 'with', 'from', 'will', 'have', 'been',
    'their', 'they', 'them', 'than', 'more', 'each', 'also', 'into', 'over',
    'such', 'after', 'about', 'through', 'between', 'under', 'during', 'before',
    'these', 'those', 'other', 'which', 'would', 'could', 'should', 'shall',
    'ensure', 'support', 'including', 'implement', 'deliver', 'provide', 'work']);
  return [...new Set(words.filter(w => !stops.has(w)))];
}

// Score how well a statement matches a commitment (0-1)
function matchScore(commitment, statement) {
  const commitKeywords = extractKeywords(commitment.commitment_text);
  if (commitKeywords.length === 0) return 0;

  const stmtText = `${statement.headline} ${statement.body_text || ''}`.toLowerCase();
  const matches = commitKeywords.filter(kw => stmtText.includes(kw));
  const baseScore = matches.length / commitKeywords.length;

  // Bonus for minister match
  const ministerBonus = commitment.minister_name &&
    statement.minister_name?.includes(commitment.minister_name.split(' ').pop()) ? 0.15 : 0;

  // Bonus for amount mentions (suggests funding action)
  const amountBonus = (statement.mentioned_amounts?.length > 0) ? 0.1 : 0;

  return Math.min(1, baseScore + ministerBonus + amountBonus);
}

// Determine status from evidence
function determineStatus(linkedStatements, linkedFunding, linkedInterventions) {
  const hasStatements = linkedStatements.length > 0;
  const hasFunding = linkedFunding.length > 0;
  const hasPrograms = linkedInterventions.length > 0;

  if (hasFunding && hasPrograms) return 'delivered';
  if (hasFunding || hasPrograms) return 'in_progress';
  if (hasStatements) return 'in_progress';
  return 'not_started';
}

async function run() {
  log(`Starting Commitment Tracker (dry_run=${DRY_RUN})`);

  // Fetch all commitments
  const { data: commitments, error: cErr } = await db
    .from('civic_charter_commitments')
    .select('*')
    .order('minister_name');

  if (cErr || !commitments?.length) {
    log(`No commitments found: ${cErr?.message || 'empty'}`);
    return;
  }

  log(`Loaded ${commitments.length} charter commitments`);

  // Fetch all statements
  const { data: statements, error: sErr } = await db
    .from('civic_ministerial_statements')
    .select('id, headline, body_text, minister_name, mentioned_amounts, mentioned_orgs, mentioned_programs, published_at')
    .order('published_at', { ascending: false });

  if (sErr) {
    log(`Error fetching statements: ${sErr.message}`);
    return;
  }

  log(`Loaded ${statements.length} ministerial statements`);

  // Fetch QLD funding
  const { data: funding } = await db
    .from('justice_funding')
    .select('id, program_name, recipient_name, amount_dollars')
    .eq('state', 'QLD')
    .order('amount_dollars', { ascending: false })
    .limit(200);

  log(`Loaded ${funding?.length || 0} QLD funding records`);

  // Fetch QLD interventions
  const { data: interventions } = await db
    .from('alma_interventions')
    .select('id, name, evidence_level')
    .neq('verification_status', 'ai_generated')
    .not('gs_entity_id', 'is', null)
    .limit(200);

  log(`Loaded ${interventions?.length || 0} linked interventions`);

  let updated = 0;
  let statusChanges = { not_started: 0, in_progress: 0, delivered: 0 };

  for (const commitment of commitments) {
    const commitKeywords = extractKeywords(commitment.commitment_text);
    const MATCH_THRESHOLD = 0.3;

    // Find matching statements
    const matchedStatements = statements
      .map(s => ({ id: s.id, score: matchScore(commitment, s), headline: s.headline, date: s.published_at }))
      .filter(m => m.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Find matching funding
    const matchedFunding = (funding || []).filter(f => {
      const text = `${f.program_name || ''} ${f.recipient_name || ''}`.toLowerCase();
      return commitKeywords.filter(kw => text.includes(kw)).length >= 2;
    }).slice(0, 10);

    // Find matching interventions
    const matchedInterventions = (interventions || []).filter(i => {
      const text = i.name.toLowerCase();
      return commitKeywords.filter(kw => text.includes(kw)).length >= 2;
    }).slice(0, 10);

    const newStatus = determineStatus(matchedStatements, matchedFunding, matchedInterventions);
    const hasChanges = matchedStatements.length > 0 || matchedFunding.length > 0 || matchedInterventions.length > 0;

    if (!hasChanges && commitment.status === 'not_started') continue;

    // Build evidence summary
    const evidence = [];
    if (matchedStatements.length > 0) {
      evidence.push(`${matchedStatements.length} statement(s): ${matchedStatements.slice(0, 3).map(s =>
        `"${s.headline?.slice(0, 60)}" (${new Date(s.date).toLocaleDateString('en-AU')}, score:${s.score.toFixed(2)})`
      ).join('; ')}`);
    }
    if (matchedFunding.length > 0) {
      evidence.push(`${matchedFunding.length} funding record(s): ${matchedFunding.slice(0, 3).map(f =>
        `${f.program_name?.slice(0, 50)} ($${((f.amount_dollars || 0) / 1e6).toFixed(1)}M)`
      ).join('; ')}`);
    }
    if (matchedInterventions.length > 0) {
      evidence.push(`${matchedInterventions.length} program(s): ${matchedInterventions.slice(0, 3).map(i =>
        i.name.slice(0, 50)
      ).join('; ')}`);
    }

    statusChanges[newStatus] = (statusChanges[newStatus] || 0) + 1;

    if (DRY_RUN) {
      log(`  [DRY] ${commitment.minister_name}: "${commitment.commitment_text.slice(0, 60)}..." → ${newStatus} (${evidence.length} evidence)`);
      continue;
    }

    const { error: uErr } = await db
      .from('civic_charter_commitments')
      .update({
        status: newStatus,
        status_evidence: evidence.join(' | '),
        linked_statement_ids: matchedStatements.map(s => s.id),
        linked_funding_ids: matchedFunding.map(f => f.id),
        linked_intervention_ids: matchedInterventions.map(i => i.id),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commitment.id);

    if (uErr) {
      log(`  ERROR updating ${commitment.id}: ${uErr.message}`);
    } else {
      updated++;
    }
  }

  log(`\nDone. ${updated} commitments updated.`);
  log(`Status breakdown: ${JSON.stringify(statusChanges)}`);
}

run().catch(err => { console.error(err); process.exit(1); });
