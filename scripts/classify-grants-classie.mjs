#!/usr/bin/env node
/**
 * Classify grants against the CLASSIE taxonomy (subject / population / SDG).
 *
 * Two-tier, cost-aware:
 *   1. Deterministic — map each grant's existing `categories` to CLASSIE codes
 *      (zero cost, no LLM). Handles the bulk of the corpus.
 *   2. LLM (opt-in, --llm) — only for grants whose categories map to nothing,
 *      constrained to the controlled CLASSIE vocabulary and sanitised.
 *
 * Writes: classie_subjects[], classie_populations[], sdg_codes[],
 *         classie_method ('category_map' | 'llm'), classie_classified_at.
 *
 * Run under tsx (imports the shared TS taxonomy module).
 *
 * Usage:
 *   npx tsx scripts/classify-grants-classie.mjs [--dry-run] [--limit=500] [--llm] [--reclassify]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import {
  mapCategoriesToClassie,
  hasAnyClassie,
  buildClassiePrompt,
  sanitizeClassie,
} from '../packages/grant-engine/src/classie.ts';

const DRY_RUN = process.argv.includes('--dry-run');
const USE_LLM = process.argv.includes('--llm');
const RECLASSIFY = process.argv.includes('--reclassify');
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 500);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function llmClassify(grant) {
  // Lazy import so the deterministic path never requires the SDK / API key.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: buildClassiePrompt(grant) }],
  });
  const text = res.content.find((c) => c.type === 'text')?.text ?? '{}';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return sanitizeClassie(JSON.parse(json));
}

async function main() {
  const run = DRY_RUN ? null : await logStart(supabase, 'classify-grants-classie', 'Classify Grants (CLASSIE)');

  try {
    let query = supabase
      .from('grant_opportunities')
      .select('id, name, description, provider, categories')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (!RECLASSIFY) query = query.is('classie_classified_at', null);

    const { data: grants, error } = await query;
    if (error) throw error;
    console.log(`Loaded ${grants?.length ?? 0} grants to classify (llm=${USE_LLM}, reclassify=${RECLASSIFY})`);

    let byCategory = 0;
    let byLlm = 0;
    let skipped = 0;
    const updates = [];

    for (const g of grants ?? []) {
      let classie = mapCategoriesToClassie(g.categories || []);
      let method = 'category_map';

      if (!hasAnyClassie(classie)) {
        if (USE_LLM && process.env.ANTHROPIC_API_KEY) {
          try {
            classie = await llmClassify(g);
            method = 'llm';
          } catch (err) {
            console.error(`  LLM classify failed for ${g.id}: ${err.message}`);
          }
        }
        if (!hasAnyClassie(classie)) {
          skipped++;
          continue;
        }
      }

      if (method === 'llm') byLlm++;
      else byCategory++;

      updates.push({
        id: g.id,
        classie_subjects: classie.subjects,
        classie_populations: classie.populations,
        sdg_codes: classie.sdgs,
        classie_method: method,
        classie_classified_at: new Date().toISOString(),
      });
    }

    console.log(`Classified: ${byCategory} via category map, ${byLlm} via LLM, ${skipped} skipped (no signal)`);

    if (DRY_RUN) {
      for (const u of updates.slice(0, 10)) {
        console.log(`  ${u.id} → subjects=[${u.classie_subjects}] pops=[${u.classie_populations}] sdgs=[${u.sdg_codes}] (${u.classie_method})`);
      }
      console.log('(DRY RUN — no writes)');
      return;
    }

    let written = 0;
    const BATCH = 100;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      const { error: upErr } = await supabase
        .from('grant_opportunities')
        .upsert(batch, { onConflict: 'id' });
      if (upErr) console.error(`  Batch write error: ${upErr.message}`);
      else written += batch.length;
    }
    console.log(`Wrote ${written} classifications.`);

    if (run) await logComplete(supabase, run.id, { items_found: grants?.length ?? 0, items_updated: written });
  } catch (err) {
    console.error('Fatal:', err);
    if (run) await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();
