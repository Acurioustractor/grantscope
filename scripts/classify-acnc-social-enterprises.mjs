#!/usr/bin/env node

/**
 * Classify ACNC Charities as Social Enterprises
 *
 * Uses multi-provider LLM round-robin to classify ACNC charities that are
 * not already in the social_enterprises table. Analyses stated purposes,
 * beneficiaries, charity size, and name to determine if an org operates
 * as a social enterprise (trades goods/services to fulfil its mission).
 *
 * Usage:
 *   node --env-file=.env scripts/classify-acnc-social-enterprises.mjs [--apply] [--limit=100] [--min-confidence=0.7]
 *
 * Flags:
 *   --apply            Actually insert into social_enterprises (dry-run by default)
 *   --limit=N          Number of charities to classify (default 100)
 *   --min-confidence=N Minimum confidence to insert (default 0.7)
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');
const MIN_CONFIDENCE = parseFloat(process.argv.find(a => a.startsWith('--min-confidence='))?.split('=')[1] || '0.7');
const CONCURRENCY = 5;
const RATE_LIMIT_DELAY_MS = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[classify-se] ${msg}`);
}

// ---------------------------------------------------------------------------
// LLM Providers — round-robin with fallback
// ---------------------------------------------------------------------------
const PROVIDERS = [
  { name: 'minimax', baseUrl: MINIMAX_CHAT_COMPLETIONS_URL, model: 'MiniMax-M2.5', envKey: 'MINIMAX_API_KEY', disabled: false },
  { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY', disabled: false, isAnthropic: true },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY', disabled: false },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY', disabled: false },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY', disabled: false },
];

let currentProviderIndex = 0;

// ---------------------------------------------------------------------------
// LLM classification
// ---------------------------------------------------------------------------
function buildPrompt(charity) {
  return `You are classifying Australian charities as social enterprises. A social enterprise is an organisation that:
- Trades goods/services to fulfil its mission (not just fundraising)
- Has a primary social, cultural, or environmental purpose
- Reinvests majority of profit into its mission

Based on this charity's information, classify it:

Name: ${charity.name}
Purposes: ${charity.purposes || 'Not specified'}
Beneficiaries: ${charity.beneficiaries || 'Not specified'}
Size: ${charity.charity_size || 'Unknown'}
State: ${charity.state || 'Unknown'}
Postcode: ${charity.postcode || 'Unknown'}

Respond with JSON only:
{
  "is_social_enterprise": true or false,
  "confidence": 0.0 to 1.0,
  "sector": ["one or more of: employment, housing, disability, environment, education, health, arts, food, indigenous, community-development, aged-care, youth, other"],
  "business_model": "brief description of how they trade/operate commercially, or null if not a social enterprise"
}

Keep the JSON answer under 80 tokens and do not include commentary outside the JSON object.`;
}

async function classifyWithLLM(charity) {
  const prompt = buildPrompt(charity);
  let lastError = null;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(currentProviderIndex + attempt) % PROVIDERS.length];
    if (provider.disabled) continue;

    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      const headers = { 'Content-Type': 'application/json' };
      let body;

      if (provider.isAnthropic) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 500,
        });
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        const requestBody = {
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: provider.name === 'minimax' ? 1200 : 500,
          response_format: { type: 'json_object' },
        };

        if (provider.name === 'minimax') {
          requestBody.extra_body = { reasoning_split: true };
        }

        body = JSON.stringify(requestBody);
      }

      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(provider.name === 'minimax' ? 45000 : 30000),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 401 || /invalid api key|authorized_error|unauthorized/i.test(err)) {
          log(`${provider.name} auth failed -- disabling`);
          provider.disabled = true;
          continue;
        }
        if (response.status === 429 || response.status === 402 ||
            err.includes('rate_limit') || err.includes('quota') ||
            err.includes('Insufficient Balance') || err.includes('credit balance')) {
          log(`${provider.name} rate limited/quota -- disabling`);
          provider.disabled = true;
          continue;
        }
        log(`${provider.name} error ${response.status}: ${err.slice(0, 100)}`);
        continue;
      }

      const json = await response.json();

      // Minimax non-standard error format
      if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
        log(`${provider.name} API error: ${json.base_resp.status_msg || 'unknown'} -- disabling`);
        provider.disabled = true;
        continue;
      }

      // Extract text from response
      const text = provider.isAnthropic
        ? (json.content?.[0]?.text || '')
        : (json.choices?.[0]?.message?.content || '');

      // Strip reasoning tags and markdown code blocks
      const stripped = text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<answer>/gi, '')
        .replace(/<\/answer>/gi, '')
        .replace(/`{3,}json\s*/gi, '')
        .replace(/`{3,}\s*/g, '')
        .trim();
      const preferredText = text.includes('</think>')
        ? text.split('</think>').pop().trim()
        : stripped;

      // Find JSON object
      let jsonStr = preferredText || stripped;
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace >= 0) jsonStr = jsonStr.slice(firstBrace);
      else jsonStr = '';

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log(`${provider.name} no JSON found for ${charity.name}`);
        lastError = `${provider.name}: no JSON found`;
        provider.badJsonCount = (provider.badJsonCount || 0) + 1;
        if (provider.badJsonCount >= 3) {
          log(`${provider.name} bad JSON threshold reached -- disabling`);
          provider.disabled = true;
        }
        continue;
      }

      const cleaned = jsonMatch[0]
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        log(`${provider.name} JSON parse error for ${charity.name}`);
        lastError = `${provider.name}: JSON parse error`;
        provider.badJsonCount = (provider.badJsonCount || 0) + 1;
        if (provider.badJsonCount >= 3) {
          log(`${provider.name} bad JSON threshold reached -- disabling`);
          provider.disabled = true;
        }
        continue;
      }

      // Advance round-robin only on a valid structured response.
      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;

      return {
        provider: provider.name,
        is_social_enterprise: !!parsed.is_social_enterprise,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        sector: Array.isArray(parsed.sector)
          ? parsed.sector
          : typeof parsed.sector === 'string' && parsed.sector.trim().length > 0
            ? [parsed.sector.trim()]
            : [],
        business_model: typeof parsed.business_model === 'string' ? parsed.business_model : null,
      };

    } catch (err) {
      log(`${provider.name} error: ${err.message?.slice(0, 100) || String(err)}`);
      lastError = `${provider.name}: ${err.message?.slice(0, 160) || String(err)}`;
      continue;
    }
  }

  throw new Error(lastError || 'All LLM providers exhausted');
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------
async function processInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length && RATE_LIMIT_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(`Starting ACNC social enterprise classification`);
  log(`  limit=${LIMIT}, min-confidence=${MIN_CONFIDENCE}, apply=${APPLY}, concurrency=${CONCURRENCY}`);

  const run = await logStart(supabase, 'classify-acnc-social-enterprises', 'Classify ACNC Social Enterprises');

  try {
    // Fetch charities not already in social_enterprises
    const { data: charities, error: fetchErr } = await supabase
      .rpc('execute_sql', {
        query: `
          SELECT c.abn, c.name, c.purposes, c.beneficiaries, c.charity_size, c.state, c.postcode
          FROM acnc_charities c
          LEFT JOIN social_enterprises se ON se.abn = c.abn
          WHERE se.id IS NULL
            AND c.purposes IS NOT NULL
          ORDER BY CASE
            WHEN c.charity_size = 'Large' THEN 1
            WHEN c.charity_size = 'Medium' THEN 2
            WHEN c.charity_size = 'Small' THEN 3
            ELSE 4
          END
          LIMIT ${LIMIT}
        `,
      });

    // Fallback: if execute_sql RPC doesn't exist, use supabase-js query
    let rows;
    if (fetchErr || !charities) {
      log(`RPC not available (${fetchErr?.message || 'no data'}), using supabase-js query`);
      // Two-step: get ABNs in social_enterprises, then exclude
      const { data: seAbns } = await supabase
        .from('social_enterprises')
        .select('abn')
        .not('abn', 'is', null);

      const existingAbns = new Set((seAbns || []).map(r => r.abn));

      const { data: allCharities, error: qErr } = await supabase
        .from('acnc_charities')
        .select('abn, name, purposes, beneficiaries, charity_size, state, postcode')
        .not('purposes', 'is', null)
        .order('charity_size', { ascending: true })
        .limit(LIMIT * 3); // Over-fetch to account for filtering

      if (qErr) {
        throw new Error(`DB error: ${qErr.message}`);
      }

      rows = (allCharities || [])
        .filter(c => c.abn && !existingAbns.has(c.abn))
        .slice(0, LIMIT);
    } else {
      rows = Array.isArray(charities) ? charities : [];
    }

    log(`Found ${rows.length} charities to classify`);

    if (rows.length === 0) {
      log('Nothing to classify');
      await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    // Process in batches of CONCURRENCY
    let totalChecked = 0;
    let classifiedAsSE = 0;
    let inserted = 0;
    let errors = 0;
    const runErrors = [];
    const sectorCounts = {};
    const providerCounts = {};
    const classifications = []; // for dry-run display

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (charity) => {
          const result = await classifyWithLLM(charity);
          // Small delay between calls to avoid bursts
          await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
          return { charity, result };
        })
      );

      for (const res of results) {
        totalChecked++;

        if (res.status === 'rejected') {
          errors++;
          if (runErrors.length < 25) runErrors.push(res.reason?.message || res.reason);
          log(`Error: ${res.reason?.message || res.reason}`);
          if (String(res.reason).includes('All LLM providers exhausted')) {
            log('All providers exhausted -- stopping');
            await logComplete(supabase, run.id, {
              items_found: totalChecked,
              items_new: inserted,
              status: errors > 0 ? 'partial' : 'success',
              errors: runErrors,
            });
            printSummary(totalChecked, classifiedAsSE, inserted, errors, sectorCounts, providerCounts);
            return;
          }
          continue;
        }

        const { charity, result } = res.value;
        if (!result) {
          errors++;
          continue;
        }

        providerCounts[result.provider] = (providerCounts[result.provider] || 0) + 1;

        if (result.is_social_enterprise && result.confidence >= MIN_CONFIDENCE) {
          classifiedAsSE++;

          for (const s of result.sector) {
            sectorCounts[s] = (sectorCounts[s] || 0) + 1;
          }

          classifications.push({
            name: charity.name,
            abn: charity.abn,
            confidence: result.confidence,
            sector: result.sector,
            business_model: result.business_model,
            state: charity.state,
            postcode: charity.postcode,
          });

          if (APPLY) {
            const payload = {
              name: charity.name,
              abn: charity.abn,
              source_primary: 'acnc-classified',
              sources: { llm_classification: { confidence: result.confidence, business_model: result.business_model } },
              postcode: charity.postcode || null,
              state: charity.state || null,
              sector: result.sector,
              business_model: result.business_model,
            };

            const { error: insertErr } = await supabase
              .from('social_enterprises')
              .insert(payload);

            if (insertErr) {
              if (/duplicate key value/i.test(insertErr.message)) {
                log(`Duplicate social enterprise skipped for ${charity.name}`);
              } else {
                log(`Insert error for ${charity.name}: ${insertErr.message}`);
                errors++;
                if (runErrors.length < 25) runErrors.push(`Insert error for ${charity.name}: ${insertErr.message}`);
              }
            } else {
              inserted++;
            }
          }
        }
      }

      // Progress logging every 25 items
      if (totalChecked % 25 === 0 || totalChecked === rows.length) {
        log(`Progress: ${totalChecked}/${rows.length} checked, ${classifiedAsSE} classified as SE, ${errors} errors`);
        log(`  Providers: ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
    }

    // Final summary
    printSummary(totalChecked, classifiedAsSE, inserted, errors, sectorCounts, providerCounts);

    // In dry-run mode, show classifications
    if (!APPLY && classifications.length > 0) {
      log('\n--- DRY RUN: Classifications (would insert) ---');
      for (const c of classifications) {
        log(`  ${c.name} (ABN: ${c.abn})`);
        log(`    Confidence: ${c.confidence}, Sector: ${c.sector.join(', ')}`);
        log(`    Business model: ${c.business_model || 'N/A'}`);
        log(`    Location: ${c.state || '?'} ${c.postcode || ''}`);
      }
      log('\nRe-run with --apply to insert these records.');
    }

    await logComplete(supabase, run.id, {
      items_found: totalChecked,
      items_new: inserted,
      items_updated: classifiedAsSE,
      status: errors > 0 ? 'partial' : 'success',
      errors: runErrors,
    });

  } catch (err) {
    log(`Fatal error: ${err.message}`);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

function printSummary(totalChecked, classifiedAsSE, inserted, errors, sectorCounts, providerCounts) {
  log('\n========== SUMMARY ==========');
  log(`Total checked:       ${totalChecked}`);
  log(`Classified as SE:    ${classifiedAsSE}`);
  log(`Inserted:            ${inserted}`);
  log(`Errors:              ${errors}`);
  log(`Classification rate: ${totalChecked > 0 ? ((classifiedAsSE / totalChecked) * 100).toFixed(1) : 0}%`);
  log('');
  log('Sector breakdown:');
  const sorted = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);
  for (const [sector, count] of sorted) {
    log(`  ${sector}: ${count}`);
  }
  log('');
  log('Provider usage:');
  for (const [provider, count] of Object.entries(providerCounts)) {
    log(`  ${provider}: ${count}`);
  }
  log('=============================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
