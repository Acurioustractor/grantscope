#!/usr/bin/env node

/**
 * Enrich Social Enterprises — Website Scraping + LLM Description
 *
 * Same pattern as enrich-charities.mjs: scrapes website via Jina Reader,
 * then uses multi-provider LLM rotation to extract description, sector,
 * programs, and impact areas.
 *
 * Usage:
 *   node scripts/enrich-social-enterprises.mjs [--limit=50] [--concurrency=3] [--dry-run]
 *   node scripts/enrich-social-enterprises.mjs --org-type=b_corp
 *   node scripts/enrich-social-enterprises.mjs --state=VIC
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 3;

const typeArg = process.argv.find(a => a.startsWith('--org-type='));
const TYPE_FILTER = typeArg ? typeArg.split('=')[1] : null;

const stateArg = process.argv.find(a => a.startsWith('--state='));
const STATE_FILTER = stateArg ? stateArg.split('=')[1] : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, enriched: 0, skipped: 0, errors: 0 };

function log(msg) {
  console.log(`[enrich-se] ${msg}`);
}

// ─── Multi-provider LLM ─────────────────────────────────────

const PROVIDERS = [
  { name: 'minimax', envKey: 'MINIMAX_API_KEY', model: 'MiniMax-M2.5', baseUrl: 'https://api.minimaxi.chat/v1/chat/completions' },
  { name: 'groq', envKey: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  { name: 'gemini', envKey: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
  { name: 'anthropic', envKey: 'ANTHROPIC_API_KEY', model: 'claude-3-5-haiku-20241022' },
];

let currentProviderIndex = 0;

async function callLLM(prompt) {
  const startIdx = currentProviderIndex;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(startIdx + attempt) % PROVIDERS.length];
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      let result;

      if (provider.name === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1500 }),
        });
        if (!res.ok) throw new Error(`Groq ${res.status}`);
        const data = await res.json();
        result = data.choices?.[0]?.message?.content;
      } else if (provider.name === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1500 } }),
        });
        if (!res.ok) throw new Error(`Gemini ${res.status}`);
        const data = await res.json();
        result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      } else if (provider.name === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: provider.model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
        });
        if (!res.ok) throw new Error(`Anthropic ${res.status}`);
        const data = await res.json();
        result = data.content?.[0]?.text;
      }

      if (result) {
        currentProviderIndex = (startIdx + attempt) % PROVIDERS.length;
        return result;
      }
    } catch (err) {
      log(`  ${provider.name} failed: ${err.message}`);
    }
  }

  return null;
}

// ─── Jina Reader ────────────────────────────────────────────

async function scrapeWebsite(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      headers: {
        'User-Agent': 'GrantScope/1.0 (research; contact@act.place)',
        'Accept': 'text/plain',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Truncate to ~4000 chars for LLM context
    return text.slice(0, 4000);
  } catch {
    return null;
  }
}

// ─── Enrichment ─────────────────────────────────────────────

async function enrichOne(se) {
  stats.total++;

  // Scrape website if available
  let websiteContent = null;
  if (se.website) {
    websiteContent = await scrapeWebsite(se.website);
  }

  if (!websiteContent && !se.description) {
    stats.skipped++;
    return;
  }

  const prompt = `You are analysing an Australian social enterprise. Based on the information below, provide a JSON response with these fields:
- description: 2-3 sentence description of what this organisation does and its social impact
- sectors: array of sector keywords from [food, employment, housing, environment, arts, health, education, technology, consulting, manufacturing, facilities, indigenous, tourism, retail, finance, community, justice]
- programs: array of {name, description} for key programs/services (max 5)
- impact_areas: array of strings describing social impact (max 5)
- confidence: "low", "medium", or "high" based on data quality

Organisation: ${se.name}
Type: ${se.org_type}
State: ${se.state || 'Unknown'}
Existing description: ${se.description || 'None'}
${websiteContent ? `\nWebsite content:\n${websiteContent}` : ''}

Respond with valid JSON only, no markdown.`;

  const llmResult = await callLLM(prompt);
  if (!llmResult) {
    stats.errors++;
    return;
  }

  try {
    // Extract JSON from response
    const jsonMatch = llmResult.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      stats.errors++;
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (DRY_RUN) {
      log(`  [DRY RUN] ${se.name}: ${parsed.description?.slice(0, 80)}...`);
      stats.enriched++;
      return;
    }

    const { error } = await supabase
      .from('social_enterprises')
      .update({
        description: parsed.description || se.description,
        sector: parsed.sectors || se.sector,
        enriched_at: new Date().toISOString(),
        profile_confidence: parsed.confidence || 'medium',
      })
      .eq('id', se.id);

    if (error) {
      log(`  Error updating ${se.name}: ${error.message}`);
      stats.errors++;
    } else {
      stats.enriched++;
    }
  } catch (err) {
    log(`  Parse error for ${se.name}: ${err.message}`);
    stats.errors++;
  }
}

async function run() {
  log(`Starting SE enrichment (limit=${LIMIT}, concurrency=${CONCURRENCY})...`);

  // Fetch unenriched SEs, prioritising those with websites
  let query = supabase
    .from('social_enterprises')
    .select('id, name, website, description, org_type, state, sector')
    .is('enriched_at', null)
    .order('website', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (TYPE_FILTER) query = query.eq('org_type', TYPE_FILTER);
  if (STATE_FILTER) query = query.eq('state', STATE_FILTER);

  const { data: ses, error } = await query;

  if (error) {
    log(`Error fetching SEs: ${error.message}`);
    process.exit(1);
  }

  log(`Found ${ses.length} SEs to enrich`);

  // Process in batches
  for (let i = 0; i < ses.length; i += CONCURRENCY) {
    const batch = ses.slice(i, i + CONCURRENCY);
    log(`Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(ses.length / CONCURRENCY)}:`);

    await Promise.all(batch.map(se => {
      log(`  Processing: ${se.name}`);
      return enrichOne(se);
    }));

    // Rate limit between batches
    if (i + CONCURRENCY < ses.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  log(`\nDone! Total: ${stats.total}, Enriched: ${stats.enriched}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
}

run().catch(err => {
  console.error('[enrich-se] Fatal:', err);
  process.exit(1);
});
