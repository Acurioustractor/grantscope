#!/usr/bin/env node
/**
 * enrich-entities-local.mjs — NEW agent
 *
 * Enriches gs_entities with missing descriptions using local Gemma 4.
 * Prioritises entities with the most relationships (highest value for the graph).
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-entities-local.mjs
 *   node --env-file=.env scripts/enrich-entities-local.mjs --limit=500
 *   node --env-file=.env scripts/enrich-entities-local.mjs --entity-type=social_enterprise
 *   node --env-file=.env scripts/enrich-entities-local.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { isLocalLLMAvailable, callLocalLLM, LOCAL_LLM_URL, LOCAL_LLM_MODEL } from './lib/local-llm.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');
const TYPE_FILTER = process.argv.find(a => a.startsWith('--entity-type='))?.split('=')[1] || null;
const RATE_LIMIT_MS = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] [enrich-entities] ${msg}`); }

function buildEntityPrompt(entity) {
  const parts = [
    `Entity Name: ${entity.canonical_name}`,
    `Type: ${entity.entity_type}`,
    entity.abn ? `ABN: ${entity.abn}` : null,
    entity.state ? `State: ${entity.state}` : null,
    entity.lga_name ? `LGA: ${entity.lga_name}` : null,
    entity.sector ? `Sector: ${entity.sector}` : null,
    entity.sub_sector ? `Sub-sector: ${entity.sub_sector}` : null,
    entity.remoteness ? `Remoteness: ${entity.remoteness}` : null,
    entity.is_community_controlled ? 'Community Controlled: Yes' : null,
    entity.source_count ? `Appears in ${entity.source_count} datasets: ${(entity.source_datasets || []).join(', ')}` : null,
    entity.latest_revenue ? `Revenue: $${Number(entity.latest_revenue).toLocaleString()}` : null,
    entity.seifa_irsd_decile ? `SEIFA Disadvantage Decile: ${entity.seifa_irsd_decile}/10` : null,
  ].filter(Boolean);

  return `You are describing an Australian organisation for a funding transparency database.

${parts.join('\n')}

Return ONLY JSON — no markdown, no explanation:
{
  "description": "2-3 sentences describing what this organisation likely does, its sector, and who it serves. Be specific to the Australian context. If community-controlled or Indigenous, note this.",
  "sector_tags": ["tag1", "tag2"],
  "key_activities": ["activity1", "activity2"]
}

Standard sector tags: health, education, housing, employment, community-services, indigenous, disability, aged-care, environment, legal-aid, mental-health, youth, family-services, arts, sport, research, social-enterprise, advocacy.

Base your answer on the entity type, sector, datasets it appears in, and location. Don't fabricate specifics.`;
}

function parseResult(text) {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
  } catch {
    return null;
  }
}

async function main() {
  const available = await isLocalLLMAvailable();
  if (!available) {
    console.error(`Local LLM not running at ${LOCAL_LLM_URL}`);
    console.error('Start with: llama-server -m <gemma4.gguf> --jinja -fa -c 131072 -ngl 99');
    process.exit(1);
  }
  log(`Local LLM ready (${LOCAL_LLM_MODEL})`);

  const run = await logStart(supabase, 'enrich-entities-local', 'Enrich Entities (Local)');

  // Build query — prioritise by relationship count, exclude persons
  let query = supabase
    .from('gs_entities')
    .select('id, canonical_name, entity_type, abn, state, sector, sub_sector, source_datasets, source_count, latest_revenue, seifa_irsd_decile, remoteness, lga_name, is_community_controlled')
    .not('entity_type', 'in', '("person","individual")')
    .or('description.is.null,description.eq.')
    .order('source_count', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (TYPE_FILTER) query = query.eq('entity_type', TYPE_FILTER);

  const { data: entities, error } = await query;
  if (error) { log(`DB error: ${error.message}`); await logFailed(supabase, run.id, error.message); process.exit(1); }
  log(`Found ${entities.length} entities to enrich${TYPE_FILTER ? ` (type=${TYPE_FILTER})` : ''}`);

  if (DRY_RUN) {
    entities.slice(0, 10).forEach(e => log(`  [${e.entity_type}] ${e.canonical_name} (${e.source_count} datasets)`));
    return;
  }

  let enriched = 0, errors = 0;
  let totalTps = 0;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    try {
      const prompt = buildEntityPrompt(entity);
      const { text, tokensPerSec } = await callLocalLLM({ messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 600 });
      totalTps += tokensPerSec;

      const parsed = parseResult(text);
      if (!parsed?.description) { log(`  No result for "${entity.canonical_name}"`); continue; }

      await supabase.from('gs_entities').update({
        description: parsed.description.slice(0, 1000),
        tags: parsed.sector_tags?.slice(0, 10) || [],
        updated_at: new Date().toISOString(),
      }).eq('id', entity.id);

      enriched++;
      if ((i + 1) % 25 === 0 || i === entities.length - 1) {
        log(`Progress: ${i + 1}/${entities.length} enriched=${enriched} errors=${errors} avg=${Math.round(totalTps / (i + 1))}tok/s`);
      }
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      errors++;
      log(`Error on "${entity.canonical_name}": ${err.message?.slice(0, 80)}`);
    }
  }

  log(`Complete: ${enriched} enriched, ${errors} errors, avg ${Math.round(totalTps / Math.max(enriched, 1))} tok/s`);
  await logComplete(supabase, run.id, { items_found: entities.length, items_new: enriched, items_updated: 0, status: errors > 0 ? 'partial' : 'success', errors: errors > 0 ? [`${errors} errors`] : [] });
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
