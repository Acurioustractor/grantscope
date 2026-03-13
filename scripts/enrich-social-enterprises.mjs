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
 *   node scripts/enrich-social-enterprises.mjs --provider=minimax
 *   node scripts/enrich-social-enterprises.mjs --source=oric
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

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

const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SOURCE_FILTER = sourceArg ? sourceArg.split('=')[1] : null;

const providerArg = process.argv.find(a => a.startsWith('--provider='));
const PREFERRED_PROVIDER = providerArg ? providerArg.split('=')[1] : 'minimax';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, enriched: 0, skipped: 0, errors: 0 };

function log(msg) {
  console.log(`[enrich-se] ${msg}`);
}

function noteProviderFailure(provider, message) {
  const text = String(message || '');
  if (/400|401|429/.test(text)) {
    provider.disabled = true;
    return;
  }
  if (/503|timeout|aborted/i.test(text)) {
    provider.transientFailures = (provider.transientFailures || 0) + 1;
    if (provider.transientFailures >= 2) {
      provider.disabled = true;
    }
  }
}

// ─── Multi-provider LLM ─────────────────────────────────────

const PROVIDERS = [
  { name: 'minimax', envKey: 'MINIMAX_API_KEY', model: 'MiniMax-M2.5' },
  { name: 'gemini', envKey: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
  { name: 'anthropic', envKey: 'ANTHROPIC_API_KEY', model: 'claude-3-5-haiku-20241022' },
  { name: 'groq', envKey: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
];

if (PREFERRED_PROVIDER !== 'minimax') {
  const idx = PROVIDERS.findIndex((provider) => provider.name === PREFERRED_PROVIDER);
  if (idx > 0) {
    const [provider] = PROVIDERS.splice(idx, 1);
    PROVIDERS.unshift(provider);
  }
}

let currentProviderIndex = 0;
let currentRunId = null;

async function callLLM(prompt) {
  const startIdx = currentProviderIndex;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(startIdx + attempt) % PROVIDERS.length];
    if (provider.disabled) continue;
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      let result;

      if (provider.name === 'minimax') {
        const res = await fetch(MINIMAX_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 1200,
            response_format: { type: 'json_object' },
            extra_body: { reasoning_split: true },
          }),
          signal: AbortSignal.timeout(75000),
        });
        if (!res.ok) {
          noteProviderFailure(provider, `MiniMax ${res.status}`);
          throw new Error(`MiniMax ${res.status}`);
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        const answerMatch = content.match(/<answer>([\s\S]*?)<\/answer>/);
        result = answerMatch ? answerMatch[1].trim() : content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
      } else if (provider.name === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1500 }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          noteProviderFailure(provider, `Groq ${res.status}`);
          throw new Error(`Groq ${res.status}`);
        }
        const data = await res.json();
        result = data.choices?.[0]?.message?.content;
      } else if (provider.name === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1500 } }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          noteProviderFailure(provider, `Gemini ${res.status}`);
          throw new Error(`Gemini ${res.status}`);
        }
        const data = await res.json();
        result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      } else if (provider.name === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: provider.model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          noteProviderFailure(provider, `Anthropic ${res.status}`);
          throw new Error(`Anthropic ${res.status}`);
        }
        const data = await res.json();
        result = data.content?.[0]?.text;
      }

      if (result) {
        currentProviderIndex = (startIdx + attempt + 1) % PROVIDERS.length;
        return result;
      }
    } catch (err) {
      log(`  ${provider.name} failed: ${err.message}`);
      noteProviderFailure(provider, err.message);
      if (/parse|json|unexpected token/i.test(String(err.message || ''))) {
        provider.badJsonCount = (provider.badJsonCount || 0) + 1;
        if (provider.badJsonCount >= 3) {
          provider.disabled = true;
        }
      }
    }
  }

  return null;
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<answer>/gi, '')
    .replace(/<\/answer>/gi, '')
    .replace(/```json/gi, '```')
    .trim();

  const match = cleaned.match(/(\{[\s\S]*\})/);
  if (!match) return null;

  const candidate = match[1]
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/\u0000/g, '');

  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(
        candidate
          .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
          .replace(/:\s*'([^']*)'/g, ': "$1"')
      );
    } catch {
      return null;
    }
  }
}

function normalizeStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((v) => v.toLowerCase() === item.toLowerCase()) === index);
  return cleaned.length > 0 ? cleaned.slice(0, 8) : fallback;
}

function isJunkSocialEnterprise(se) {
  const name = String(se.name || '').trim().toLowerCase();
  const website = String(se.website || '').trim().toLowerCase();
  const source = String(se.source_primary || '').trim().toLowerCase();
  if (!name) return true;
  if (/test/.test(name)) return true;
  if (/^stage\s*\d+\b/.test(name)) return true;
  if (/^(funding|validation|growth)$/.test(name)) return true;
  if (/award|awards|resource library|resources/.test(name)) return true;
  if (['qsec', 'sasec', 'wasec'].includes(source)) return true;
  if (website.includes('/resource-library/')) return true;
  if (website.includes('/resources/')) return true;
  if (website.includes('/blog/')) return true;
  return false;
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
    return text.slice(0, 2500);
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
- business_model: one short sentence on how the enterprise earns revenue while delivering social value
- sectors: array of sector keywords from [food, employment, housing, environment, arts, health, education, technology, consulting, manufacturing, facilities, indigenous, tourism, retail, finance, community, justice]
- target_beneficiaries: array of beneficiary groups served (max 6)
- geographic_focus: array of Australian states, regions, or "National" (max 6)
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
    const parsed = extractJsonPayload(llmResult);
    if (!parsed) {
      stats.errors++;
      return;
    }

    if (DRY_RUN) {
      log(`  [DRY RUN] ${se.name}: ${parsed.description?.slice(0, 80)}...`);
      stats.enriched++;
      return;
    }

    const { error } = await supabase
      .from('social_enterprises')
      .update({
        description: parsed.description || se.description,
        business_model: parsed.business_model || se.business_model || null,
        sector: parsed.sectors || se.sector,
        target_beneficiaries: normalizeStringArray(parsed.target_beneficiaries, se.target_beneficiaries || []),
        geographic_focus: normalizeStringArray(parsed.geographic_focus, se.geographic_focus || []),
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
  log(`Starting SE enrichment (limit=${LIMIT}, concurrency=${CONCURRENCY}, provider=${PREFERRED_PROVIDER})...`);
  const run = await logStart(supabase, 'enrich-social-enterprises', 'Enrich Social Enterprises');
  currentRunId = run.id;

  // Fetch unenriched SEs, prioritising those with websites
  let query = supabase
    .from('social_enterprises')
    .select('id, name, website, description, org_type, state, sector, business_model, target_beneficiaries, geographic_focus, source_primary, enriched_at')
    .not('website', 'is', null)
    .or('enriched_at.is.null,description.is.null,business_model.is.null,target_beneficiaries.is.null,geographic_focus.is.null')
    .limit(Math.max(LIMIT * 20, 1000));

if (TYPE_FILTER) query = query.eq('org_type', TYPE_FILTER);
if (STATE_FILTER) query = query.eq('state', STATE_FILTER);
  if (SOURCE_FILTER) query = query.eq('source_primary', SOURCE_FILTER);

  const { data: ses, error } = await query;

  if (error) {
    log(`Error fetching SEs: ${error.message}`);
    await logFailed(supabase, run.id, error.message);
    process.exit(1);
  }

  const prioritized = (ses || [])
    .filter((se) => !isJunkSocialEnterprise(se))
    .filter((se) =>
      !se.enriched_at ||
      !se.description ||
      !se.business_model ||
      !Array.isArray(se.target_beneficiaries) ||
      se.target_beneficiaries.length === 0 ||
      !Array.isArray(se.geographic_focus) ||
      se.geographic_focus.length === 0
    )
    .sort((a, b) => {
      const score = (se) => {
        let total = 0;
        if (se.website) total += 4;
        if (!se.description) total += 5;
        if (!se.business_model) total += 4;
        if (!Array.isArray(se.target_beneficiaries) || se.target_beneficiaries.length === 0) total += 4;
        if (!Array.isArray(se.geographic_focus) || se.geographic_focus.length === 0) total += 4;
        if (!se.enriched_at) total += 3;
        if (se.source_primary === 'oric') total += 5;
        if (se.source_primary === 'social-traders') total += 3;
        if (se.source_primary === 'acnc-classified') total += 2;
        return total;
      };
      return score(b) - score(a);
    })
    .slice(0, LIMIT);

  log(`Found ${prioritized.length} SEs to enrich`);

  // Process in batches
  for (let i = 0; i < prioritized.length; i += CONCURRENCY) {
    const batch = prioritized.slice(i, i + CONCURRENCY);
    log(`Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(prioritized.length / CONCURRENCY)}:`);

    await Promise.all(batch.map(se => {
      log(`  Processing: ${se.name}`);
      return enrichOne(se);
    }));

    // Rate limit between batches
    if (i + CONCURRENCY < prioritized.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  log(`\nDone! Total: ${stats.total}, Enriched: ${stats.enriched}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
  await logComplete(supabase, run.id, {
    items_found: stats.total,
    items_new: stats.enriched,
    items_updated: 0,
    status: stats.errors > 0 ? 'partial' : 'success',
    errors: stats.errors > 0 ? [`${stats.errors} social enterprise enrichment errors`] : [],
  });
}

run().catch(err => {
  console.error('[enrich-se] Fatal:', err);
  const message = err instanceof Error ? err.message : String(err);
  logFailed(supabase, currentRunId, message).catch(() => {});
  process.exit(1);
});
