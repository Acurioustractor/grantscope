#!/usr/bin/env node
/**
 * dedup-entities-local.mjs — NEW agent
 *
 * Uses local Gemma 4 to classify entity duplicate clusters flagged in discoveries.
 * Writes recommendations to dedup_recommendations table for human review.
 *
 * Usage:
 *   node --env-file=.env scripts/dedup-entities-local.mjs --dry-run
 *   node --env-file=.env scripts/dedup-entities-local.mjs --limit=50 --min-confidence=0.8 --apply
 *
 * Run the SQL in dedup-schema.sql first to create the dedup_recommendations table.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { isLocalLLMAvailable, callLocalLLM, LOCAL_LLM_URL, LOCAL_LLM_MODEL } from './lib/local-llm.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
const MIN_CONFIDENCE = parseFloat(process.argv.find(a => a.startsWith('--min-confidence='))?.split('=')[1] || '0.7');
const RATE_LIMIT_MS = 600;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] [dedup-local] ${msg}`); }

// Parse entity count from discovery title e.g. '"BROAD CONSTRUCTION PTY LTD" appears 141 times'
function parseClusterSize(title) {
  const m = title?.match(/appears (\d+) times/);
  return m ? parseInt(m[1]) : 0;
}

// Extract cluster name from title
function parseClusterName(title) {
  const m = title?.match(/"([^"]+)"/);
  return m ? m[1] : title?.slice(0, 80) || 'Unknown';
}

// Extract a sample of ABNs from the description (first 10)
function extractSampleAbns(description) {
  const m = description?.match(/ABNs?:\s*\{([^}]+)\}/);
  if (!m) return [];
  return m[1].split(',').slice(0, 10).map(a => a.trim());
}

// Extract entity types from description
function extractEntityTypes(description) {
  const m = description?.match(/Types?:\s*\{([^}]+)\}/);
  if (!m) return [];
  return m[1].split(',').map(t => t.trim());
}

function buildDedupPrompt(discovery) {
  const clusterName = parseClusterName(discovery.title);
  const clusterSize = parseClusterSize(discovery.title);
  const sampleAbns = extractSampleAbns(discovery.description);
  const entityTypes = extractEntityTypes(discovery.description);

  return `You are classifying entity records in an Australian funding transparency database.

A data quality check found ${clusterSize} entities all named "${clusterName}" with different ABNs.
Entity types in cluster: ${entityTypes.join(', ') || 'unknown'}
Sample ABNs (first 10 of ${clusterSize}): ${sampleAbns.join(', ')}

In Australia, entities can have similar names because:
1. TRUE DUPLICATES: Data was imported from multiple sources and the same entity appears multiple times. 
   Signs: very similar or identical names, same ABN appearing multiple times, small cluster size (2-5).
2. RELATED ENTITIES: Legitimate separate legal entities — state branches, subsidiaries, dioceses, 
   franchise locations, holding companies. Signs: different ABNs, large cluster size (10+), 
   the name suggests a multi-state or franchise structure (e.g., "Diocese", "Holdings", 
   "Construction", national brand names).
3. UNRELATED COINCIDENCES: Common names shared by completely different organisations.
   Signs: different entity types, wildly different ABN numbers, name is a common word.

Classify this cluster and return ONLY JSON:
{
  "recommendation": "merge" | "relate" | "ignore",
  "confidence": 0.0-1.0,
  "reasoning": "1-2 sentences explaining why",
  "suggested_relationship": "subsidiary_of" | "member_of" | "affiliated_with" | null
}

Rules:
- If cluster has 20+ entities with different ABNs → almost certainly "relate" (legitimate separate entities)
- Dioceses, councils, hospitals with state-level branches → "relate"  
- National brands or franchise names → "relate"
- Cluster of 2-4 identical ABNs → "merge"
- When uncertain → "ignore" with low confidence`;
}

function parseRecommendation(text) {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0].replace(/,\s*}/g, '}'));
    if (!['merge', 'relate', 'ignore'].includes(obj.recommendation)) return null;
    return obj;
  } catch {
    // Try to extract recommendation at minimum
    const recMatch = stripped.match(/"recommendation"\s*:\s*"(merge|relate|ignore)"/);
    const confMatch = stripped.match(/"confidence"\s*:\s*([\d.]+)/);
    if (recMatch) {
      return {
        recommendation: recMatch[1],
        confidence: confMatch ? parseFloat(confMatch[1]) : 0.5,
        reasoning: 'Parsed from partial response',
        suggested_relationship: null,
      };
    }
    return null;
  }
}

async function ensureTable() {
  // Create the table if it doesn't exist
  const { error } = await supabase.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS dedup_recommendations (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      discovery_id uuid,
      cluster_name text,
      entity_count int,
      recommendation text CHECK (recommendation IN ('merge', 'relate', 'ignore')),
      confidence float,
      reasoning text,
      suggested_relationship text,
      reviewed_by text,
      reviewed_at timestamptz,
      applied_at timestamptz,
      created_at timestamptz DEFAULT now()
    );`
  });
  // Ignore error — table may already exist or RPC may not be available
  // The apply_migration path is preferred; this is a safety fallback
}

async function main() {
  const available = await isLocalLLMAvailable();
  if (!available) {
    console.error(`Local LLM not running at ${LOCAL_LLM_URL}`);
    console.error('Start with: llama-server -m <gemma4.gguf> --jinja -fa -c 131072 -ngl 99');
    process.exit(1);
  }
  log(`Local LLM ready (${LOCAL_LLM_MODEL})`);

  const run = await logStart(supabase, 'dedup-entities-local', 'Entity Dedup Classifier (Local)');

  // Fetch unresolved data quality duplicates
  const { data: discoveries, error } = await supabase
    .from('discoveries')
    .select('id, title, description, severity, created_at')
    .eq('discovery_type', 'data_quality')
    .ilike('title', '%appears%times%')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) { log(`DB error: ${error.message}`); await logFailed(supabase, run.id, error.message); process.exit(1); }
  log(`Found ${discoveries.length} duplicate clusters to classify`);

  if (DRY_RUN) {
    discoveries.slice(0, 10).forEach(d => {
      const size = parseClusterSize(d.title);
      log(`  [${d.severity}] ${parseClusterName(d.title)} — ${size} entities`);
    });
    return;
  }

  let classified = 0, skipped = 0, errors = 0;
  const recommendations = { merge: 0, relate: 0, ignore: 0 };

  for (let i = 0; i < discoveries.length; i++) {
    const discovery = discoveries[i];
    const clusterName = parseClusterName(discovery.title);
    const clusterSize = parseClusterSize(discovery.title);

    try {
      const prompt = buildDedupPrompt(discovery);
      const { text, tokensPerSec } = await callLocalLLM({ messages: [{ role: 'user', content: prompt }], temperature: 0.15, max_tokens: 400 });

      const result = parseRecommendation(text);
      if (!result) { log(`  No result for "${clusterName}"`); skipped++; continue; }
      if (result.confidence < MIN_CONFIDENCE) {
        log(`  Low confidence (${result.confidence.toFixed(2)}) for "${clusterName}" — skipping`);
        skipped++;
        continue;
      }

      recommendations[result.recommendation]++;
      log(`  [${result.recommendation.toUpperCase()} ${(result.confidence * 100).toFixed(0)}%] "${clusterName}" (${clusterSize} entities) — ${result.reasoning?.slice(0, 80)}`);

      if (APPLY) {
        await supabase.from('dedup_recommendations').insert({
          discovery_id: discovery.id,
          cluster_name: clusterName,
          entity_count: clusterSize,
          recommendation: result.recommendation,
          confidence: result.confidence,
          reasoning: result.reasoning,
          suggested_relationship: result.suggested_relationship || null,
        });
        classified++;
      } else {
        classified++;
      }

      if ((i + 1) % 10 === 0) {
        log(`Progress: ${i + 1}/${discoveries.length} | merge=${recommendations.merge} relate=${recommendations.relate} ignore=${recommendations.ignore}`);
      }

      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      errors++;
      log(`Error on "${clusterName}": ${err.message?.slice(0, 80)}`);
    }
  }

  log(`\nComplete: ${classified} classified, ${skipped} skipped (low confidence), ${errors} errors`);
  log(`Recommendations: merge=${recommendations.merge}, relate=${recommendations.relate}, ignore=${recommendations.ignore}`);
  if (!APPLY && classified > 0) log('Run with --apply to write recommendations to database');

  await logComplete(supabase, run.id, {
    items_found: discoveries.length,
    items_new: classified,
    status: errors > 0 ? 'partial' : 'success',
    errors: errors > 0 ? [`${errors} errors`] : [],
  });
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
