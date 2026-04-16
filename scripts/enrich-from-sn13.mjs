#!/usr/bin/env node

/**
 * Enrich entities via Macrocosmos SN13 (Bittensor Data Universe)
 *
 * Queries the SN13 OnDemand API for social/web mentions of low-source entities,
 * writes results to enrichment_candidates staging table for review.
 *
 * Usage:
 *   node scripts/enrich-from-sn13.mjs [--dry-run] [--limit=50] [--source=x] [--min-source-count=1]
 *
 * Environment:
 *   MACROCOSMOS_API_KEY   — API key from macrocosmos.ai
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MACROCOSMOS_API_KEY = process.env.MACROCOSMOS_API_KEY;

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
const SOURCE = process.argv.find(a => a.startsWith('--source='))?.split('=')[1] || 'x';
const MIN_SOURCE_COUNT = parseInt(process.argv.find(a => a.startsWith('--min-source-count='))?.split('=')[1] || '1');
const ENTITY_TYPE = process.argv.find(a => a.startsWith('--type='))?.split('=')[1]; // foundation, charity, company, etc.
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [2000, 5000, 15000]; // Escalating backoff

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!MACROCOSMOS_API_KEY && !DRY_RUN) {
  console.error('Missing MACROCOSMOS_API_KEY — get one at https://macrocosmos.ai');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Macrocosmos SN13 API ─────────────────────────────────────────────────────

const SN13_BASE_URL = 'https://api.macrocosmos.ai/v1';
const RATE_LIMIT_DELAY_MS = 1000; // Be conservative — 1 req/sec

function log(msg) {
  console.log(`[sn13-enrich] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Query SN13 OnDemand API with retry logic for transient errors (429, 502, 503, 504)
 */
async function querySN13(keywords, source = 'X', limit = 20) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
      log(`  ↻ Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms...`);
      await sleep(backoff);
    }

    try {
      const response = await fetch(`${SN13_BASE_URL}/sn13/on-demand-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MACROCOSMOS_API_KEY}`,
          'Content-Type': 'application/json',
          'X-App-Name': 'grantscope-enrichment',
        },
        body: JSON.stringify({
          source,
          keywords,
          keyword_mode: 'all',
          limit,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      // Non-retryable errors — fail immediately
      if (response.status === 401 || response.status === 403) {
        const text = await response.text().catch(() => '');
        throw new Error(`SN13 API ${response.status} (auth): ${text.slice(0, 200)}`);
      }

      // Retryable errors — try again
      if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
        lastError = new Error(`SN13 API ${response.status}`);
        if (attempt === MAX_RETRIES) break;
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`SN13 API ${response.status}: ${text.slice(0, 200)}`);
      }

      return response.json();
    } catch (err) {
      // Network errors and timeouts are retryable
      if (err.name === 'TimeoutError' || err.name === 'TypeError' || err.code === 'ECONNREFUSED') {
        lastError = err;
        if (attempt === MAX_RETRIES) break;
        continue;
      }
      throw err; // Non-retryable error
    }
  }

  throw lastError || new Error('SN13 API failed after retries');
}

/**
 * Score a candidate result for auto-accept/reject
 * Returns 0.0-1.0
 */
function scoreCandidate(entityName, result) {
  let score = 0.3; // Base: we got a result

  const text = (result.text || result.content || '').toLowerCase();
  const entityLower = entityName.toLowerCase();

  // Entity name appears in the text
  if (text.includes(entityLower)) score += 0.3;

  // Partial name match (first word)
  const firstWord = entityLower.split(/\s+/)[0];
  if (firstWord.length > 3 && text.includes(firstWord)) score += 0.1;

  // Has a URL
  if (result.url || result.link) score += 0.1;

  // Has engagement (likes, retweets, etc.)
  const engagement = (result.likes || 0) + (result.retweets || 0) + (result.replies || 0);
  if (engagement > 10) score += 0.1;
  if (engagement > 100) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Extract useful fields from a raw SN13 result
 */
function extractFields(result) {
  return {
    text: result.text || result.content || null,
    url: result.url || result.link || null,
    author: result.username || result.author || null,
    author_url: result.user_url || null,
    published_at: result.created_at || result.timestamp || null,
    engagement: {
      likes: result.likes || 0,
      retweets: result.retweets || 0,
      replies: result.replies || 0,
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(supabase, 'enrich-from-sn13', 'Enrich from SN13 (Macrocosmos)');

  try {
    // Fetch low-source entities that haven't been SN13-queried yet
    let query = supabase
      .from('gs_entities')
      .select('id, canonical_name, entity_type, source_count, website')
      .lte('source_count', MIN_SOURCE_COUNT)
      .not('canonical_name', 'is', null)
      .order('source_count', { ascending: true })
      .limit(LIMIT);

    if (ENTITY_TYPE) {
      query = query.eq('entity_type', ENTITY_TYPE);
    }

    // Exclude entities we've already queried via SN13
    const { data: alreadyQueried } = await supabase
      .from('enrichment_candidates')
      .select('entity_id')
      .eq('source', 'sn13_ondemand');

    const excludeIds = new Set((alreadyQueried || []).map(r => r.entity_id));

    const { data: entities, error: fetchError } = await query;

    if (fetchError) throw new Error(`Failed to fetch entities: ${fetchError.message}`);
    if (!entities?.length) {
      log('No entities to enrich');
      await logComplete(supabase, run.id, { items_found: 0 });
      return;
    }

    // Filter out already-queried entities
    const toEnrich = entities.filter(e => !excludeIds.has(e.id));
    log(`Found ${entities.length} low-source entities, ${toEnrich.length} not yet queried via SN13`);

    if (DRY_RUN) {
      log('[DRY RUN] Would query SN13 for:');
      toEnrich.slice(0, 10).forEach(e => log(`  - ${e.canonical_name} (${e.entity_type}, source_count=${e.source_count})`));
      await logComplete(supabase, run.id, { items_found: toEnrich.length, status: 'dry_run' });
      return;
    }

    let queried = 0;
    let skipped = 0;
    let candidates = 0;
    let errors = 0;
    let consecutiveErrors = 0;
    const errorList = [];

    for (const entity of toEnrich) {
      try {
        const keywords = [entity.canonical_name];
        queried++;

        log(`[${queried}/${toEnrich.length}] Querying SN13 for "${entity.canonical_name}" on ${SOURCE}...`);

        const response = await querySN13(keywords, SOURCE, 20);
        const results = response?.data || response?.results || [];

        log(`  → ${results.length} results`);
        consecutiveErrors = 0; // Reset on success

        if (results.length > 0) {
          const rows = results.map(result => ({
            entity_id: entity.id,
            source: 'sn13_ondemand',
            source_query: {
              keywords,
              platform: SOURCE,
              limit: 20,
              keyword_mode: 'all',
            },
            platform: SOURCE.toLowerCase(),
            raw_data: result,
            extracted_fields: extractFields(result),
            confidence: scoreCandidate(entity.canonical_name, result),
            status: 'pending',
            provenance: {
              retrieved_at: new Date().toISOString(),
              api: 'macrocosmos_sn13_ondemand',
              api_version: 'v1',
              entity_source_count_at_query: entity.source_count,
            },
          }));

          const { error: insertError } = await supabase
            .from('enrichment_candidates')
            .insert(rows);

          if (insertError) {
            log(`  ✗ Insert failed: ${insertError.message}`);
            errors++;
            errorList.push({ entity: entity.canonical_name, error: insertError.message });
          } else {
            candidates += rows.length;
            log(`  ✓ Stored ${rows.length} candidates (best confidence: ${Math.max(...rows.map(r => r.confidence)).toFixed(2)})`);
          }
        } else {
          skipped++;
          log(`  – No results, skipping`);
        }

        // Rate limit between successful requests
        await sleep(RATE_LIMIT_DELAY_MS);
      } catch (err) {
        const msg = err.message || String(err);
        log(`  ✗ Error for "${entity.canonical_name}": ${msg}`);
        errors++;
        consecutiveErrors++;
        errorList.push({ entity: entity.canonical_name, error: msg });

        // Auth error — stop immediately
        if (msg.includes('(auth)')) {
          log('Auth error — stopping. Check MACROCOSMOS_API_KEY.');
          break;
        }

        // 5 consecutive errors means the API is down — stop wasting time
        if (consecutiveErrors >= 5) {
          log(`${consecutiveErrors} consecutive errors — API appears down. Stopping.`);
          break;
        }
      }
    }

    const stats = {
      items_found: toEnrich.length,
      items_queried: queried,
      items_new: candidates,
      items_skipped: skipped,
      errors,
      error_details: errorList.slice(0, 10),
      source: SOURCE,
      status: errors === 0 ? 'success' : errors >= queried ? 'failed' : 'partial',
    };

    log(`Done: ${queried} queried, ${candidates} candidates, ${skipped} no results, ${errors} errors`);
    await logComplete(supabase, run.id, stats);

    // Print stats as JSON for orchestrator
    console.log(JSON.stringify(stats));
  } catch (err) {
    log(`Fatal: ${err.message}`);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();
