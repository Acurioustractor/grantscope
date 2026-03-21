#!/usr/bin/env node

/**
 * Enrich Government Bodies — LLM Classification
 *
 * Uses MiniMax M2.7 to classify government body entities:
 * - description: what the body does
 * - sector: policy domain (justice, health, education, infrastructure, etc.)
 * - sub_sector: specific function
 * - state: jurisdiction (federal, NSW, VIC, QLD, etc.)
 * - tags: relevant tags
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-gov-bodies.mjs [--limit=50] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { callMiniMax } from './lib/minimax.mjs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const CONCURRENCY = 5;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, enriched: 0, skipped: 0, errors: 0 };

function log(msg) {
  console.log(`[enrich-gov] ${msg}`);
}

const SYSTEM_PROMPT = `You are an Australian government structure expert. Given the name of a government body, department, or division, provide a JSON classification.

Respond ONLY with valid JSON, no markdown fences:
{
  "description": "1-2 sentence description of what this body does",
  "sector": "primary policy domain (one of: justice, health, education, infrastructure, environment, finance, social-services, defence, agriculture, science, arts-culture, trade, indigenous-affairs, housing, emergency, transport, local-government, public-admin)",
  "sub_sector": "specific function within the sector",
  "jurisdiction": "one of: federal, NSW, VIC, QLD, SA, WA, TAS, NT, ACT",
  "tags": ["up to 5 relevant tags"]
}

If the name is clearly not a government body (e.g. a private company), set description to null.`;

async function classifyEntity(entity) {
  const { text } = await callMiniMax({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: entity.canonical_name },
    ],
    max_tokens: 1024,
    temperature: 0.1,
  });

  try {
    return JSON.parse(text);
  } catch {
    // Try extracting JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Failed to parse JSON: ${text.slice(0, 200)}`);
  }
}

async function enrichBatch(batch) {
  return Promise.allSettled(batch.map(async (entity) => {
    try {
      const result = await classifyEntity(entity);

      if (!result.description) {
        stats.skipped++;
        log(`  SKIP ${entity.canonical_name} (not a gov body)`);
        // Reclassify as company so we don't re-process
        if (!DRY_RUN) {
          await supabase.from('gs_entities').update({
            entity_type: 'company',
            description: 'Reclassified: not a government body',
            updated_at: new Date().toISOString(),
          }).eq('id', entity.id);
        }
        return;
      }

      if (DRY_RUN) {
        log(`  DRY ${entity.canonical_name} → ${result.sector} / ${result.sub_sector}`);
        stats.enriched++;
        return;
      }

      const updates = {
        description: result.description,
        sector: result.sector,
        sub_sector: result.sub_sector,
        tags: result.tags || [],
        updated_at: new Date().toISOString(),
      };

      // Set state/jurisdiction if not already set
      if (!entity.state && result.jurisdiction) {
        updates.state = result.jurisdiction === 'federal' ? null : result.jurisdiction;
      }

      const { error } = await supabase
        .from('gs_entities')
        .update(updates)
        .eq('id', entity.id);

      if (error) throw error;

      stats.enriched++;
      log(`  OK ${entity.canonical_name} → ${result.sector}/${result.sub_sector}`);
    } catch (err) {
      stats.errors++;
      log(`  ERR ${entity.canonical_name}: ${err.message}`);
    }
  }));
}

async function main() {
  log(`Starting government body enrichment (limit=${LIMIT}, dry-run=${DRY_RUN})`);

  const run = DRY_RUN ? null : await logStart(supabase, 'enrich-gov-bodies', 'Enrich Government Bodies');
  const runId = run?.id;

  try {
    // Fetch unenriched government bodies
    const { data: entities, error } = await supabase
      .from('gs_entities')
      .select('id, canonical_name, state')
      .eq('entity_type', 'government_body')
      .is('description', null)
      .limit(LIMIT);

    if (error) throw error;

    stats.total = entities.length;
    log(`Found ${stats.total} unenriched government bodies`);

    // Process in batches
    for (let i = 0; i < entities.length; i += CONCURRENCY) {
      const batch = entities.slice(i, i + CONCURRENCY);
      log(`Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(entities.length / CONCURRENCY)} (${batch.length} entities)`);
      await enrichBatch(batch);
    }

    log(`Done: ${stats.enriched} enriched, ${stats.skipped} skipped, ${stats.errors} errors out of ${stats.total}`);

    if (runId) {
      await logComplete(supabase, runId, { items_found: stats.total, items_new: stats.enriched });
    }
  } catch (err) {
    log(`Fatal: ${err.message}`);
    if (runId) await logFailed(supabase, runId, err.message);
    process.exit(1);
  }
}

main();
