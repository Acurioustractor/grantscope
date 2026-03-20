#!/usr/bin/env node

/**
 * Scrape Grant Deadlines
 *
 * Visits grant opportunity source URLs and extracts current deadline + status
 * information using LLM extraction. Updates grant_opportunities with findings.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-grant-deadlines.mjs [--apply] [--limit=50] [--provider=minimax]
 *
 * Flags:
 *   --apply       Actually write updates to DB (dry-run by default)
 *   --limit=N     Max grants to process (default 50)
 *   --provider=X  Preferred LLM provider (default minimax)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

// --- Config ---

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
const PREFERRED_PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] || 'minimax';

const CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 10_000;
const LLM_TIMEOUT_MS = 60_000;
const RATE_LIMIT_DELAY_MS = 1000;
const BODY_CHAR_LIMIT = 3000;
const USER_AGENT = 'GrantScope/1.0 (https://grantscope.au; data research)';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[scrape-deadlines] ${msg}`);
}

// --- LLM Providers (round-robin with fallback) ---

const PROVIDERS = [
  { name: 'minimax', baseUrl: MINIMAX_CHAT_COMPLETIONS_URL, model: 'MiniMax-M2.7', envKey: 'MINIMAX_API_KEY', disabled: false },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY', disabled: false },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY', disabled: false },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY', disabled: false },
  { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY', disabled: false, isAnthropic: true },
];

// Move preferred provider to front
if (PREFERRED_PROVIDER !== 'minimax') {
  const idx = PROVIDERS.findIndex(p => p.name === PREFERRED_PROVIDER);
  if (idx > 0) {
    const [prov] = PROVIDERS.splice(idx, 1);
    PROVIDERS.unshift(prov);
  }
}

let currentProviderIndex = 0;

// --- URL Fetching ---

async function fetchPageText(url) {
  if (!url) return null;
  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { error: `Non-HTML content: ${contentType.split(';')[0]}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, iframe, noscript, svg').remove();

    const mainText = ($('main').text() || $('article').text() || $('body').text())
      .replace(/\s+/g, ' ')
      .trim();

    const metaDesc = $('meta[name="description"]').attr('content') || '';

    const combined = [metaDesc, mainText].filter(Boolean).join('\n\n');
    if (combined.length < 30) return { error: 'Page too short' };

    return { text: combined.slice(0, BODY_CHAR_LIMIT) };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { error: 'Timeout' };
    }
    return { error: err.message?.slice(0, 80) || String(err) };
  }
}

// --- LLM Extraction ---

async function extractWithLLM(grant, pageText) {
  const prompt = `Extract grant/funding program information from this webpage text.

Grant name: ${grant.name}
URL: ${grant.url}

Webpage content (truncated to ${BODY_CHAR_LIMIT} chars):
${pageText}

Today's date is ${new Date().toISOString().split('T')[0]}.

Respond with JSON only:
{
  "status": "open" | "closed" | "ongoing" | "unknown",
  "deadline": "YYYY-MM-DD" or null,
  "amount_min": number or null,
  "amount_max": number or null,
  "eligibility_summary": "brief summary" or null,
  "is_rolling": true or false
}

Rules:
- "ongoing" means always open / no closing date / rolling applications
- "open" means currently accepting applications with a known or implied deadline
- "closed" means applications are no longer accepted
- If you see a date that has already passed, set status to "closed"
- For deadline, only provide if a specific date is mentioned
- For amounts, extract dollar figures if mentioned (as integers, no decimals)
- For eligibility_summary, provide 1-2 sentences max`;

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
        body = JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 500,
        });
      }

      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 401 || /invalid api key|authorized_error|unauthorized/i.test(err)) {
          log(`  ${provider.name} auth failed -- disabling`);
          provider.disabled = true;
          continue;
        }
        if (response.status === 429 || response.status === 402 ||
            err.includes('rate_limit') || err.includes('quota') ||
            err.includes('Insufficient Balance') || err.includes('credit balance')) {
          log(`  ${provider.name} rate limited/quota -- disabling`);
          provider.disabled = true;
          continue;
        }
        log(`  ${provider.name} error ${response.status}: ${err.slice(0, 100)}`);
        continue;
      }

      const json = await response.json();

      // Minimax non-standard error format
      if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
        log(`  ${provider.name} API error: ${json.base_resp.status_msg || 'unknown'} -- disabling`);
        provider.disabled = true;
        continue;
      }

      const text = provider.isAnthropic
        ? (json.content?.[0]?.text || '')
        : (json.choices?.[0]?.message?.content || '');

      // Advance round-robin
      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;

      // Strip reasoning tags and markdown code blocks
      const stripped = text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/`{3,}json\s*/gi, '')
        .replace(/`{3,}\s*/g, '')
        .trim();

      // Find JSON object
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log(`  ${provider.name} no JSON found`);
        return null;
      }

      const cleaned = jsonMatch[0]
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        log(`  ${provider.name} JSON parse error: ${cleaned.slice(0, 100)}`);
        return null;
      }

      // Validate and normalize
      const validStatuses = ['open', 'closed', 'ongoing', 'unknown'];
      const status = validStatuses.includes(parsed.status) ? parsed.status : 'unknown';

      let deadline = null;
      if (parsed.deadline && /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline)) {
        deadline = parsed.deadline;
      }

      return {
        provider: provider.name,
        status,
        deadline,
        amount_min: typeof parsed.amount_min === 'number' ? Math.round(parsed.amount_min) : null,
        amount_max: typeof parsed.amount_max === 'number' ? Math.round(parsed.amount_max) : null,
        eligibility_summary: typeof parsed.eligibility_summary === 'string'
          ? parsed.eligibility_summary.slice(0, 500)
          : null,
        is_rolling: parsed.is_rolling === true,
      };
    } catch (err) {
      log(`  ${provider.name} error: ${err.message?.slice(0, 100) || String(err)}`);
      continue;
    }
  }

  throw new Error('All LLM providers exhausted');
}

// --- Main ---

async function main() {
  log(`Starting grant deadline scraper (limit=${LIMIT}, apply=${APPLY}, preferred=${PREFERRED_PROVIDER})`);

  // Fetch grants needing deadline/status enrichment
  const { data: grants, error } = await supabase
    .from('grant_opportunities')
    .select('id, name, url, status, deadline, closes_at, amount_min, amount_max')
    .not('url', 'is', null)
    .neq('url', '')
    .or('deadline.is.null,status.is.null,status.eq.unknown')
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    log(`DB error: ${error.message}`);
    process.exit(1);
  }

  log(`Found ${grants.length} grants with URLs needing deadline/status info`);

  if (grants.length === 0) {
    log('Nothing to do');
    return;
  }

  if (!APPLY) {
    log('DRY RUN -- showing first 10:');
    for (const g of grants.slice(0, 10)) {
      log(`  ${g.name?.slice(0, 60)} | ${g.url?.slice(0, 50)} | status=${g.status || 'null'} | deadline=${g.deadline || 'null'}`);
    }
    log(`\nRun with --apply to write updates to the database.`);
    return;
  }

  // Log agent run start
  const run = await logStart(supabase, 'scrape-grant-deadlines', 'Scrape Grant Deadlines');

  let totalChecked = 0;
  let successfullyScraped = 0;
  let deadlinesFound = 0;
  let statusUpdates = 0;
  let amountUpdates = 0;
  let fetchErrors = 0;
  let llmErrors = 0;
  const providerCounts = {};
  let allProvidersExhausted = false;

  async function processGrant(grant) {
    totalChecked++;

    // 1. Fetch the page
    const result = await fetchPageText(grant.url);

    if (result.error) {
      fetchErrors++;
      log(`  [${totalChecked}/${grants.length}] SKIP ${grant.name?.slice(0, 40)} -- ${result.error}`);
      return;
    }

    // 2. Extract with LLM
    let extraction;
    try {
      extraction = await extractWithLLM(grant, result.text);
    } catch (err) {
      if (err.message === 'All LLM providers exhausted') {
        allProvidersExhausted = true;
        throw err;
      }
      llmErrors++;
      log(`  [${totalChecked}/${grants.length}] LLM ERROR ${grant.name?.slice(0, 40)} -- ${err.message}`);
      return;
    }

    if (!extraction) {
      llmErrors++;
      log(`  [${totalChecked}/${grants.length}] LLM FAIL ${grant.name?.slice(0, 40)} -- no valid extraction`);
      return;
    }

    successfullyScraped++;
    providerCounts[extraction.provider] = (providerCounts[extraction.provider] || 0) + 1;

    // 3. Build update
    const update = {
      last_verified_at: new Date().toISOString(),
    };

    // Only update status if we got a non-unknown result, or existing was null/unknown
    if (extraction.status !== 'unknown' || !grant.status || grant.status === 'unknown') {
      if (extraction.status !== 'unknown') {
        update.status = extraction.status;
        statusUpdates++;
      }
    }

    if (extraction.deadline && !grant.deadline) {
      update.deadline = extraction.deadline;
      update.closes_at = extraction.deadline;
      deadlinesFound++;
    }

    if (extraction.amount_min && !grant.amount_min) {
      update.amount_min = extraction.amount_min;
      amountUpdates++;
    }

    if (extraction.amount_max && !grant.amount_max) {
      update.amount_max = extraction.amount_max;
    }

    if (extraction.eligibility_summary) {
      update.requirements_summary = extraction.eligibility_summary;
    }

    if (extraction.is_rolling) {
      update.status = 'ongoing';
    }

    // 4. Write to DB
    const { error: updateError } = await supabase
      .from('grant_opportunities')
      .update(update)
      .eq('id', grant.id);

    if (updateError) {
      log(`  [${totalChecked}/${grants.length}] DB ERROR ${grant.name?.slice(0, 40)} -- ${updateError.message}`);
      return;
    }

    const parts = [];
    if (update.status) parts.push(`status=${update.status}`);
    if (update.deadline) parts.push(`deadline=${update.deadline}`);
    if (update.amount_min) parts.push(`min=$${update.amount_min.toLocaleString()}`);
    if (update.amount_max) parts.push(`max=$${update.amount_max.toLocaleString()}`);
    if (extraction.is_rolling) parts.push('rolling=yes');

    log(`  [${totalChecked}/${grants.length}] OK ${grant.name?.slice(0, 40)} -- ${parts.join(', ') || 'verified (no new data)'}`);
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < grants.length; i += CONCURRENCY) {
    if (allProvidersExhausted) {
      log('All LLM providers exhausted -- stopping');
      break;
    }

    const batch = grants.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(g => processGrant(g)));

    // Rate limit between batches
    if (i + CONCURRENCY < grants.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }

    // Progress log every 30
    if ((i + CONCURRENCY) % 30 === 0 && i > 0) {
      log(`Progress: ${Math.min(i + CONCURRENCY, grants.length)}/${grants.length} checked`);
    }
  }

  // --- Summary ---
  log('');
  log('=== SUMMARY ===');
  log(`Total checked:        ${totalChecked}`);
  log(`Successfully scraped: ${successfullyScraped}`);
  log(`Deadlines found:      ${deadlinesFound}`);
  log(`Status updates:       ${statusUpdates}`);
  log(`Amount updates:       ${amountUpdates}`);
  log(`Fetch errors:         ${fetchErrors}`);
  log(`LLM errors:           ${llmErrors}`);
  if (Object.keys(providerCounts).length > 0) {
    log(`Providers:            ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  // Log agent run completion
  await logComplete(supabase, run.id, {
    items_found: totalChecked,
    items_new: deadlinesFound,
    items_updated: statusUpdates + deadlinesFound + amountUpdates,
  });
}

main().catch((err) => {
  console.error('[scrape-deadlines] Fatal error:', err);
  process.exit(1);
});
