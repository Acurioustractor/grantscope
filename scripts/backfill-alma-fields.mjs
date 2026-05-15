#!/usr/bin/env node
/**
 * LLM-based field backfill for verified open_grant rows in alma_funding_opportunities.
 *
 * Extracts missing structured fields from existing name + description + funder + focus_areas
 * so the scoring MV gets proper eligibility/timing/geo data.
 *
 * Fields backfilled (only when currently NULL):
 *   - eligible_org_types  (text[])
 *   - jurisdictions       (text[])
 *   - is_national         (boolean)
 *   - min_grant_amount    (numeric)
 *   - max_grant_amount    (numeric)
 *   - deadline            (timestamptz)
 *   - requires_deductible_gift_recipient (boolean)
 *
 * NEVER overwrites non-null values. Tracks provenance via fields_backfilled_at/by/reason.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-alma-fields.mjs [--dry-run] [--limit=100] [--min-confidence=0.6]
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 400;
const CONF_ARG = process.argv.find((a) => a.startsWith('--min-confidence='));
const MIN_CONFIDENCE = CONF_ARG ? parseFloat(CONF_ARG.split('=')[1]) : 0.6;

const BATCH_SIZE = 15;
const MODEL = 'claude-haiku-4-5-20251001';
const AGENT_ID = 'backfill-alma-fields';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RUBRIC = `You are extracting structured grant metadata from Australian grant descriptions.

For each grant, return JSON with these fields ONLY IF the input clearly states them. Leave fields out if unclear — partial extraction is fine, never guess.

Schema (per item):
{
  "id": "<row id from input>",
  "eligible_org_types": [<from CANONICAL set below>] | null,
  "jurisdictions": ["AU-QLD","AU-NSW","AU-VIC","AU-WA","AU-SA","AU-TAS","AU-NT","AU-ACT"] | null,
  "is_national": true | false | null,
  "min_grant_amount": <number> | null,
  "max_grant_amount": <number> | null,
  "deadline": "YYYY-MM-DD" | null,
  "requires_dgr": true | false | null,
  "confidence": 0.0-1.0,
  "reason": "<one short sentence>"
}

CANONICAL eligible_org_types values:
  charity, community_organisation, community_org, aboriginal_corporation,
  indigenous_charity, indigenous_org, social_enterprise, collective,
  arts_organisation, company, school, government, individual

Rules:
- If grant says "open to charities and not-for-profits" → ["charity","community_organisation"]
- If grant says "Aboriginal Community Controlled Organisation" / "ACCO" / "Indigenous-led" → include "aboriginal_corporation" and "indigenous_charity"
- If grant says "for individuals" → ["individual"]
- If grant is for a single state, jurisdictions = ["AU-XXX"]; if national, is_national=true and jurisdictions=null
- min_grant_amount: smallest amount in $; max_grant_amount: largest amount in $. e.g. "$5,000 to $25,000" → min=5000 max=25000. "Up to $10,000" → max=10000. "Approximately $50K" → min=null max=50000.
- deadline: ISO date YYYY-MM-DD. e.g. "closes 30 June 2026" → "2026-06-30". If rolling/no deadline → null. Date FORMAT must be valid YYYY-MM-DD.
- requires_dgr: true only if explicitly says "DGR required" or "Deductible Gift Recipient required". Default null.

Confidence:
- 0.8+ when fields are explicitly stated in description
- 0.6-0.79 when fields can be reasonably inferred from context (e.g., "for community groups in NSW")
- <0.6 when guessing — leave fields out instead

Return STRICT JSON:
{"items":[ ... ]}`;

async function loadTargets() {
  // Verified open_grants with at least one missing key field, not already backfilled
  const { data, error } = await supabase
    .from('alma_funding_opportunities')
    .select('id, name, description, funder_name, focus_areas, eligible_org_types, jurisdictions, is_national, min_grant_amount, max_grant_amount, deadline, requires_deductible_gift_recipient, fields_backfilled_at')
    .eq('opportunity_type', 'open_grant')
    .eq('verification_status', 'verified')
    .is('fields_backfilled_at', null)
    .order('updated_at', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  return data ?? [];
}

function formatRow(row) {
  const lines = [];
  lines.push(`id: ${row.id}`);
  lines.push(`name: ${row.name ?? ''}`);
  if (row.funder_name) lines.push(`funder: ${row.funder_name}`);
  if (row.description) {
    const desc = String(row.description).replace(/\s+/g, ' ').slice(0, 600);
    lines.push(`desc: ${desc}`);
  }
  const focus = (row.focus_areas ?? []).slice(0, 8).join(', ');
  if (focus) lines.push(`focus: ${focus}`);
  return lines.join(' | ');
}

async function extractBatch(rows) {
  const rowsText = rows.map(formatRow).join('\n\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: RUBRIC,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Extract structured fields from these ${rows.length} grants. Return JSON only.\n\n${rowsText}`,
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  if (!textBlock) throw new Error('No text in LLM response');

  let raw = textBlock.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
  }

  const parsed = JSON.parse(raw);
  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error(`Unexpected response shape: ${raw.slice(0, 200)}`);
  }
  return {
    items: parsed.items,
    usage: response.usage,
  };
}

function pickUpdates(row, extracted) {
  const updates = {};
  const filled = [];
  const skipped = [];

  // Only set fields that are currently NULL/empty in DB
  if ((!row.eligible_org_types || row.eligible_org_types.length === 0) && Array.isArray(extracted.eligible_org_types) && extracted.eligible_org_types.length > 0) {
    updates.eligible_org_types = extracted.eligible_org_types;
    filled.push('eligibility');
  }
  if ((!row.jurisdictions || row.jurisdictions.length === 0) && Array.isArray(extracted.jurisdictions) && extracted.jurisdictions.length > 0) {
    updates.jurisdictions = extracted.jurisdictions;
    filled.push('jurisdictions');
  }
  if (row.is_national == null && typeof extracted.is_national === 'boolean') {
    updates.is_national = extracted.is_national;
    filled.push('is_national');
  }
  if (row.min_grant_amount == null && typeof extracted.min_grant_amount === 'number' && extracted.min_grant_amount > 0) {
    updates.min_grant_amount = extracted.min_grant_amount;
    filled.push('min_amount');
  }
  if (row.max_grant_amount == null && typeof extracted.max_grant_amount === 'number' && extracted.max_grant_amount > 0) {
    updates.max_grant_amount = extracted.max_grant_amount;
    filled.push('max_amount');
  }
  if (row.deadline == null && extracted.deadline && /^\d{4}-\d{2}-\d{2}$/.test(extracted.deadline)) {
    const dt = new Date(extracted.deadline);
    if (!isNaN(dt.getTime()) && dt > new Date('2024-01-01')) {
      updates.deadline = dt.toISOString();
      filled.push('deadline');
    } else {
      skipped.push(`bad-deadline:${extracted.deadline}`);
    }
  }
  if (row.requires_deductible_gift_recipient == null && typeof extracted.requires_dgr === 'boolean') {
    updates.requires_deductible_gift_recipient = extracted.requires_dgr;
    filled.push('dgr');
  }

  // Enforce min <= max
  const newMin = updates.min_grant_amount ?? row.min_grant_amount;
  const newMax = updates.max_grant_amount ?? row.max_grant_amount;
  if (newMin != null && newMax != null && newMin > newMax) {
    delete updates.min_grant_amount;
    delete updates.max_grant_amount;
    skipped.push('min>max');
    const idxMin = filled.indexOf('min_amount');
    if (idxMin >= 0) filled.splice(idxMin, 1);
    const idxMax = filled.indexOf('max_amount');
    if (idxMax >= 0) filled.splice(idxMax, 1);
  }

  return { updates, filled, skipped };
}

async function run() {
  const runRow = await logStart(supabase, AGENT_ID, 'LLM backfill missing fields on verified open_grants');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  try {
    const rows = await loadTargets();
    console.log(`Loaded ${rows.length} targets (limit=${LIMIT})`);

    if (rows.length === 0) {
      console.log('Nothing to backfill.');
      if (runId) await logComplete(supabase, runId, { items_found: 0, items_new: 0, items_updated: 0 });
      return;
    }

    let totalInput = 0,
      totalOutput = 0,
      totalCacheRead = 0,
      totalCacheWrite = 0;
    let processed = 0,
      updated = 0,
      noChange = 0,
      lowConfidence = 0,
      errors = 0;

    const fieldCounts = {};
    const samples = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = i / BATCH_SIZE + 1;
      console.log(`Batch ${batchNum}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} rows)...`);

      let items;
      try {
        const result = await extractBatch(batch);
        items = result.items;
        totalInput += result.usage.input_tokens ?? 0;
        totalOutput += result.usage.output_tokens ?? 0;
        totalCacheRead += result.usage.cache_read_input_tokens ?? 0;
        totalCacheWrite += result.usage.cache_creation_input_tokens ?? 0;
      } catch (err) {
        console.error(`  Batch ${batchNum} failed: ${err.message}`);
        errors += batch.length;
        continue;
      }

      const byId = new Map(items.map((it) => [it.id, it]));

      for (const row of batch) {
        const extracted = byId.get(row.id);
        if (!extracted) {
          errors++;
          continue;
        }
        processed++;
        if ((extracted.confidence ?? 0) < MIN_CONFIDENCE) {
          lowConfidence++;
          continue;
        }
        const { updates, filled } = pickUpdates(row, extracted);
        if (filled.length === 0) {
          noChange++;
          continue;
        }
        for (const f of filled) fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;

        if (samples.length < 8) {
          samples.push(
            `  [${(extracted.confidence ?? 0).toFixed(2)}] filled ${filled.join(',').padEnd(40)} ${row.name?.slice(0, 50)}`
          );
        }

        if (DRY_RUN) continue;

        updates.fields_backfilled_at = new Date().toISOString();
        updates.fields_backfilled_by = `llm:${MODEL}`;
        updates.fields_backfilled_reason = `conf=${(extracted.confidence ?? 0).toFixed(2)} ${extracted.reason ?? ''}`.slice(0, 500);
        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from('alma_funding_opportunities')
          .update(updates)
          .eq('id', row.id);
        if (error) {
          console.error(`  Update failed for ${row.id}: ${error.message}`);
          errors++;
        } else {
          updated++;
        }
      }
    }

    const elapsed = (Date.now() - startedAt) / 1000;

    console.log('\n=== Summary ===');
    console.log(`Processed: ${processed}  Updated: ${updated}  No-change: ${noChange}  Low-confidence: ${lowConfidence}  Errors: ${errors}`);
    console.log('Fields filled (count of rows):');
    for (const [k, v] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(20)} ${v}`);
    }
    console.log('\nSample fills:');
    for (const s of samples) console.log(s);
    console.log(`\nTokens — input: ${totalInput}  output: ${totalOutput}  cached read: ${totalCacheRead}  cached write: ${totalCacheWrite}`);
    const cost =
      (totalInput * 1) / 1_000_000 +
      (totalOutput * 5) / 1_000_000 +
      (totalCacheWrite * 1.25) / 1_000_000 +
      (totalCacheRead * 0.1) / 1_000_000;
    console.log(`Approx cost: $${cost.toFixed(4)} (elapsed ${elapsed.toFixed(1)}s)`);

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: rows.length,
        items_new: updated,
        items_updated: processed,
      });
    }
  } catch (err) {
    console.error('backfill-alma-fields failed:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

run();
