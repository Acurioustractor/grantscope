#!/usr/bin/env node

/**
 * Enrich Charities — Website Scraping + LLM Description
 *
 * Targets charities (from acnc_charities) that have a website but no enrichment
 * in community_orgs. Scrapes the website and uses LLM to generate a description,
 * domain focus, geographic focus, and programs.
 *
 * Creates community_orgs records linked via acnc_abn, which the v_charity_detail
 * and v_charity_explorer views join automatically.
 *
 * Usage:
 *   npx tsx scripts/enrich-charities.mjs [--limit=50] [--concurrency=3] [--dry-run]
 *   npx tsx scripts/enrich-charities.mjs --size=Large --limit=100
 *   npx tsx scripts/enrich-charities.mjs --pbi-only --limit=50
 *
 * Options:
 *   --limit=N          Max charities to process (default: 50)
 *   --concurrency=N    Parallel batch size (default: 3)
 *   --size=S           Filter by charity_size (Small, Medium, Large)
 *   --pbi-only         Only enrich PBI charities
 *   --dry-run          Preview without making changes
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { FoundationScraper } from '../packages/grant-engine/src/foundations/annual-report-scraper.ts';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const PBI_ONLY = process.argv.includes('--pbi-only');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 3;
const PREFERRED_PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] || 'minimax';

const sizeArg = process.argv.find(a => a.startsWith('--size='));
const SIZE_FILTER = sizeArg ? sizeArg.split('=')[1] : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentRunId = null;

function log(msg) {
  console.log(`[enrich-charities] ${msg}`);
}

/**
 * Multi-provider LLM call for charity profiling.
 * Same provider rotation pattern as FoundationProfiler.
 */
const PROVIDERS = [
  {
    name: 'minimax',
    envKey: 'MINIMAX_API_KEY',
    model: 'MiniMax-M2.5',
  },
  {
    name: 'gemini-grounded',
    envKey: 'GEMINI_API_KEY',
    model: 'gemini-2.5-flash',
  },
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'gemini',
    envKey: 'GEMINI_API_KEY',
    model: 'gemini-2.5-flash',
  },
  {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    model: 'claude-3-5-haiku-20241022',
  },
];

if (PREFERRED_PROVIDER !== 'minimax') {
  const idx = PROVIDERS.findIndex((provider) => provider.name === PREFERRED_PROVIDER);
  if (idx > 0) {
    const [provider] = PROVIDERS.splice(idx, 1);
    PROVIDERS.unshift(provider);
  }
}

let currentProviderIndex = 0;
const DISABLED_PROVIDERS = new Set();

async function callLLM(prompt) {
  const startIdx = currentProviderIndex;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(startIdx + attempt) % PROVIDERS.length];
    if (DISABLED_PROVIDERS.has(provider.name)) continue;
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      let result;

      if (provider.name === 'minimax') {
        // MiniMax M2.5 reasoning model (OpenAI-compatible)
        const res = await fetch(MINIMAX_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) {
          if (res.status === 401) DISABLED_PROVIDERS.add(provider.name);
          if (res.status === 429 || res.status === 503) throw new Error(`Rate limited: ${res.status}`);
          throw new Error(`Minimax error ${res.status}`);
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        // M2.5 wraps answer in <answer> tags sometimes
        const answerMatch = content.match(/<answer>([\s\S]*?)<\/answer>/);
        result = answerMatch ? answerMatch[1].trim() : content;
      } else if (provider.name === 'gemini-grounded') {
        // Use Gemini native API with Google Search grounding
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          if (res.status === 401) DISABLED_PROVIDERS.add(provider.name);
          const body = await res.text();
          if (res.status === 429 || res.status === 503) throw new Error(`Rate limited: ${res.status}`);
          throw new Error(`Gemini error ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider.name === 'gemini') {
        // Gemini via OpenAI-compatible endpoint (no grounding)
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          if (res.status === 401) DISABLED_PROVIDERS.add(provider.name);
          if (res.status === 429 || res.status === 503) throw new Error(`Rate limited: ${res.status}`);
          throw new Error(`Gemini error ${res.status}`);
        }
        const data = await res.json();
        result = data.choices?.[0]?.message?.content || '';
      } else if (provider.name === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          if (res.status === 401) DISABLED_PROVIDERS.add(provider.name);
          if (res.status === 429 || res.status === 503) throw new Error(`Rate limited: ${res.status}`);
          throw new Error(`Groq error ${res.status}`);
        }
        const data = await res.json();
        result = data.choices?.[0]?.message?.content || '';
      } else if (provider.name === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          if (res.status === 401) DISABLED_PROVIDERS.add(provider.name);
          if (res.status === 429 || res.status === 529) throw new Error(`Rate limited: ${res.status}`);
          throw new Error(`Anthropic error ${res.status}`);
        }
        const data = await res.json();
        result = data.content?.[0]?.text || '';
      }

      currentProviderIndex = (startIdx + attempt + 1) % PROVIDERS.length;
      return result;
    } catch (err) {
      log(`    ${provider.name} failed: ${err.message}`);
      if (/401|400|429|529|rate limited|quota|balance|credit/i.test(String(err.message || ''))) {
        DISABLED_PROVIDERS.add(provider.name);
      }
      continue;
    }
  }

  throw new Error('All LLM providers failed');
}

function parseJSON(text) {
  // Extract JSON from markdown code blocks or raw text
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    return null;
  }
}

async function getCharitiesToEnrich() {
  // Find charities with websites that don't have a community_orgs record yet
  // Use a raw SQL query since we need a LEFT JOIN exclusion
  const { data, error } = await supabase.rpc('get_unenriched_charities', {
    p_limit: LIMIT,
    p_size: SIZE_FILTER,
    p_pbi_only: PBI_ONLY,
  });

  if (error) {
    // Fallback: use two queries if RPC doesn't exist
    log(`RPC not found, using fallback query...`);
    return await getCharitiesToEnrichFallback();
  }

  return data || [];
}

async function getCharitiesToEnrichFallback() {
  // Get ABNs already in community_orgs
  const { data: existing } = await supabase
    .from('community_orgs')
    .select('acnc_abn');

  const existingAbns = new Set((existing || []).map(r => r.acnc_abn));

  // Query acnc_charities directly (v_charity_explorer times out on 359k rows)
  let query = supabase
    .from('acnc_charities')
    .select('abn, name, website, charity_size, pbi, purposes, beneficiaries, operating_states, state')
    .not('website', 'is', null);

  if (SIZE_FILTER) {
    query = query.eq('charity_size', SIZE_FILTER);
  }
  if (PBI_ONLY) {
    query = query.eq('pbi', true);
  }

  // Order by charity size (Large first) since we can't sort by revenue without the view
  query = query.order('charity_size', { ascending: true }) // Large < Medium < Small alphabetically
    .limit(LIMIT * 3); // Fetch extra to filter out already-enriched

  const { data, error } = await query;
  if (error) {
    log(`Error fetching charities: ${error.message}`);
    return [];
  }

  // Filter out those already enriched and limit
  return (data || [])
    .filter(c => !existingAbns.has(c.abn))
    .slice(0, LIMIT);
}

async function enrichOne(charity, scraper, index, total) {
  const name = charity.name;
  const website = charity.website;

  log(`  [${index}/${total}] ${name} (${website})`);

  if (DRY_RUN) {
    log(`    Would enrich ${name}`);
    return 'enriched';
  }

  try {
    // Step 1: Scrape website
    const scraped = await scraper.scrapeFoundation(website);
    log(`    Scraped ${scraped.scrapedUrls.length} pages`);

    const webContent = [
      scraped.websiteContent,
      scraped.aboutContent,
      scraped.programsContent,
    ].filter(Boolean).join('\n\n---\n\n');

    if (!webContent || webContent.length < 50) {
      log(`    Insufficient website content (${webContent.length} chars) — skipping`);
      return 'no_content';
    }

    // Step 2: LLM profiling
    const prompt = `You are analysing an Australian charity's website content to create a profile.

CHARITY: ${name}
ABN: ${charity.abn}
STATE: ${charity.state || 'Unknown'}
SIZE: ${charity.charity_size || 'Unknown'}
PURPOSES: ${(charity.purposes || []).join(', ') || 'Unknown'}
BENEFICIARIES: ${(charity.beneficiaries || []).join(', ') || 'Unknown'}

WEBSITE CONTENT:
${webContent.slice(0, 8000)}

Based on this content, provide a JSON object with these fields:
{
  "description": "2-3 sentence description of what this charity does, who they serve, and their approach",
  "domain": ["array of focus domains like 'youth', 'health', 'education', 'environment', 'first nations', 'disability', 'homelessness', 'arts', 'community development'"],
  "geographic_focus": ["array of geographic areas they serve, e.g. 'Queensland', 'National', 'Brisbane', 'Rural NSW'"],
  "programs": [{"name": "Program Name", "description": "Brief description"}],
  "outcomes": [{"metric": "Metric name", "value": "Value or description"}]
}

Rules:
- Description should be factual and specific, not vague or promotional
- Only include domains that are clearly supported by the content
- Geographic focus should be as specific as the content allows
- Programs should be specific named programs, not generic activities
- Outcomes should be measurable where possible
- Return ONLY valid JSON, no other text`;

    const llmResult = await callLLM(prompt);
    const profile = parseJSON(llmResult);

    if (!profile || !profile.description) {
      log(`    LLM returned no usable profile`);
      return 'no_description';
    }

    log(`    "${profile.description.slice(0, 100)}..."`);

    // Step 3: Upsert into community_orgs
    const { error: upsertError } = await supabase
      .from('community_orgs')
      .upsert({
        acnc_abn: charity.abn,
        name: charity.name,
        website: charity.website,
        description: profile.description,
        domain: Array.isArray(profile.domain) ? profile.domain : [],
        geographic_focus: Array.isArray(profile.geographic_focus) ? profile.geographic_focus : [],
        programs: Array.isArray(profile.programs) ? profile.programs : null,
        outcomes: Array.isArray(profile.outcomes) ? profile.outcomes : null,
        annual_revenue: null, // Revenue comes from AIS financials, not acnc_charities
        profile_confidence: webContent.length > 2000 ? 'medium' : 'low',
        enriched_at: new Date().toISOString(),
      }, { onConflict: 'acnc_abn' });

    if (upsertError) {
      log(`    DB upsert error: ${upsertError.message}`);
      return 'error';
    }

    return 'enriched';
  } catch (err) {
    log(`    Error: ${err instanceof Error ? err.message : String(err)}`);
    return 'error';
  }
}

async function main() {
  log('Starting charity enrichment...');
  log(`  Limit: ${LIMIT}`);
  log(`  Concurrency: ${CONCURRENCY}`);
  log(`  Size filter: ${SIZE_FILTER || 'all'}`);
  log(`  PBI only: ${PBI_ONLY}`);
  log(`  Dry run: ${DRY_RUN}`);

  const charities = await getCharitiesToEnrich();
  log(`${charities.length} charities to enrich`);

  if (charities.length === 0) {
    log('Nothing to do.');
    return;
  }

  const run = await logStart(supabase, 'enrich-charities', 'Enrich Charities');
  currentRunId = run.id;

  const scraper = new FoundationScraper({ requestDelayMs: 2000, maxPagesPerFoundation: 3 });

  let enriched = 0;
  let noContent = 0;
  let noDescription = 0;
  let errors = 0;
  let processed = 0;

  // Process in parallel batches
  for (let i = 0; i < charities.length; i += CONCURRENCY) {
    const batch = charities.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((c, j) => enrichOne(c, scraper, i + j + 1, charities.length))
    );

    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled') {
        if (result.value === 'enriched') enriched++;
        else if (result.value === 'no_content') noContent++;
        else if (result.value === 'no_description') noDescription++;
        else errors++;
      } else {
        errors++;
      }
    }

    log(`  --- Batch complete: ${processed}/${charities.length} (${enriched} enriched, ${noContent} no content, ${noDescription} no desc, ${errors} errors) ---`);
  }

  await logComplete(supabase, run.id, {
    items_found: charities.length,
    items_new: enriched,
    items_updated: 0,
    status: errors > 0 ? 'partial' : 'success',
    errors: errors > 0 ? [`${errors} charity enrichment errors`] : [],
  });

  log(`\nComplete: ${enriched} enriched, ${noContent} no content, ${noDescription} no description, ${errors} errors out of ${charities.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  const message = err instanceof Error ? err.message : String(err);
  logFailed(supabase, currentRunId, message).catch(() => {});
  process.exit(1);
});
