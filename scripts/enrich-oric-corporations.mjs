#!/usr/bin/env node

/**
 * Enrich ORIC Corporations with Minimax LLM
 *
 * For each un-enriched ORIC corporation, uses Minimax (MiniMax-Text-01)
 * to generate a description, focus areas, and community served analysis.
 * Falls back to other providers if Minimax is unavailable.
 *
 * Also scrapes ORIC public register URLs for additional context.
 *
 * Usage: node scripts/enrich-oric-corporations.mjs [--dry-run] [--limit=100] [--provider=minimax]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');
const PREFERRED_PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] || 'minimax';
const RE_ENRICH = process.argv.includes('--re-enrich');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[oric-enrich] ${msg}`);
}

// LLM Providers — Minimax first (user preference), then fallbacks
const PROVIDERS = [
  { name: 'minimax', baseUrl: 'https://api.minimaxi.chat/v1/chat/completions', model: 'MiniMax-M2.5', envKey: 'MINIMAX_API_KEY', disabled: false },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY', disabled: false },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY', disabled: false },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY', disabled: true },
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

const RATE_LIMIT_DELAY_MS = 1500;
const SCRAPE_TIMEOUT_MS = 10000;

async function scrapeOricPage(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrantScope/1.0 (oric-enrichment; +https://grantscope.au)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, iframe, noscript').remove();
    const text = ($('main').text() || $('body').text())
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 50 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

async function enrichWithLLM(corp, scrapedText) {
  const contextParts = [
    `Corporation: ${corp.name}`,
    `ICN: ${corp.icn}`,
    `ABN: ${corp.abn || 'N/A'}`,
    `State: ${corp.state || 'Unknown'}`,
    `Size: ${corp.corporation_size || 'Unknown'}`,
    `Status: ${corp.status}`,
    `Registered: ${corp.registered_on || 'Unknown'}`,
    `ACNC Registered: ${corp.registered_with_acnc ? 'Yes' : 'No'}`,
    `Industries: ${(corp.industry_sectors || []).join(', ') || 'Not specified'}`,
    `Income (2024): ${corp.income_year2 || 'Not reported'}`,
    `Assets (2024): ${corp.assets_year2 || 'Not reported'}`,
    `Employees (2024): ${corp.employees_year2 || 'Not reported'}`,
  ];

  if (scrapedText) {
    contextParts.push(`\nORIC Register Page:\n${scrapedText}`);
  }

  const prompt = `You are analysing an Aboriginal and Torres Strait Islander corporation registered with ORIC (Australia).

${contextParts.join('\n')}

Based on the corporation name, industry sectors, location, and any available information, provide a research analysis.

Return JSON only, no explanation:
{
  "description": "2-4 sentence description of what this corporation likely does, its role in community, and significance. Be specific about the community and region it serves.",
  "focus_areas": ["area1", "area2"],
  "community_served": "Description of the community this corporation serves — be specific about the region, language group, or community if inferable from the name or location.",
  "power_analysis": "1-2 sentences on the role this corporation plays in self-determination and community governance."
}

If information is limited, make reasonable inferences from the name (many Indigenous corporation names include language words or community names) and industry sectors. Never fabricate specific claims.`;

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
          temperature: 0.2,
          max_tokens: 1200,
        });
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1200,
        });
      }

      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429 || response.status === 402 ||
            err.includes('rate_limit') || err.includes('quota') ||
            err.includes('Insufficient Balance') || err.includes('credit balance')) {
          log(`${provider.name} rate limited/quota — disabling`);
          provider.disabled = true;
          continue;
        }
        log(`${provider.name} error ${response.status}: ${err.slice(0, 100)}`);
        continue;
      }

      const json = await response.json();

      // Minimax non-standard error format
      if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
        log(`${provider.name} API error: ${json.base_resp.status_msg || 'unknown'} — disabling`);
        provider.disabled = true;
        continue;
      }

      // Anthropic returns content[0].text, OpenAI-compat returns choices[0].message.content
      const text = provider.isAnthropic
        ? (json.content?.[0]?.text || '')
        : (json.choices?.[0]?.message?.content || '');

      // Advance round-robin
      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;

      // Strip reasoning tags (Minimax M2.5) and markdown code blocks (Gemini)
      const stripped = text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/`{3,}json\s*/gi, '')
        .replace(/`{3,}\s*/g, '')
        .trim();

      // Find JSON object — handle truncated responses by adding closing braces
      let jsonStr = stripped;
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace >= 0) jsonStr = jsonStr.slice(firstBrace);
      else jsonStr = '';

      // Try to find complete JSON first
      let jsonMatch = jsonStr.match(/\{[\s\S]*\}/);

      // If no match, the response may be truncated — try closing it
      if (!jsonMatch && jsonStr.startsWith('{')) {
        const fixed = jsonStr + '"}';
        jsonMatch = fixed.match(/\{[\s\S]*\}/);
      }
      if (!jsonMatch) {
        log(`${provider.name} no JSON found in response (${text.length} chars). First 200: ${text.slice(0, 200)}`);
        return { provider: provider.name, ...emptyResult() };
      }

      // Clean common JSON issues (trailing commas, etc.)
      let cleaned = jsonMatch[0]
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        // Try to salvage description from truncated JSON
        const descMatch = cleaned.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (descMatch) {
          log(`${provider.name} JSON truncated — salvaged description (${descMatch[1].length} chars)`);
          const salvaged = { description: descMatch[1] };
          for (const field of ['focus_areas']) {
            const arrMatch = cleaned.match(new RegExp(`"${field}"\\s*:\\s*(\\[[^\\]]*\\])`));
            if (arrMatch) try { salvaged[field] = JSON.parse(arrMatch[1]); } catch {}
          }
          const csMatch = cleaned.match(/"community_served"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (csMatch) salvaged.community_served = csMatch[1];
          parsed = salvaged;
        } else {
          log(`${provider.name} JSON parse error. Raw: ${cleaned.slice(0, 200)}`);
          return { provider: provider.name, ...emptyResult() };
        }
      }
      return {
        provider: provider.name,
        description: typeof parsed.description === 'string' ? parsed.description.slice(0, 1000) : null,
        focus_areas: Array.isArray(parsed.focus_areas) ? parsed.focus_areas : [],
        community_served: typeof parsed.community_served === 'string' ? parsed.community_served : null,
      };
    } catch (err) {
      log(`${provider.name} error: ${err.message?.slice(0, 100) || String(err)}`);
      continue;
    }
  }

  throw new Error('All LLM providers exhausted');
}

function emptyResult() {
  return { description: null, focus_areas: [], community_served: null };
}

async function main() {
  log(`Starting ORIC enrichment (limit=${LIMIT}, preferred=${PREFERRED_PROVIDER}, dry-run=${DRY_RUN}${RE_ENRICH ? ', re-enrich=true' : ''})`);

  // Fetch corporations to enrich
  let query = supabase
    .from('oric_corporations')
    .select('*')
    .eq('status', 'Registered')
    .order('corporation_size', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (RE_ENRICH) {
    // Re-enrich: previously enriched but got no description (truncated JSON)
    query = query.not('enriched_at', 'is', null)
      .or('enriched_description.is.null,enriched_description.eq.');
  } else {
    query = query.is('enriched_at', null);
  }

  const { data: corps, error } = await query;

  if (error) {
    log(`DB error: ${error.message}`);
    process.exit(1);
  }

  log(`Found ${corps.length} ${RE_ENRICH ? 're-enrichable (enriched but no desc)' : 'un-enriched'} registered corporations`);

  if (DRY_RUN) {
    log('DRY RUN — showing first 5:');
    for (const c of corps.slice(0, 5)) {
      log(`  ICN ${c.icn} | ${c.name} | ${c.state} | ${c.corporation_size}`);
    }
    return;
  }

  let enriched = 0;
  let scraped = 0;
  let errors = 0;
  const providerCounts = {};

  for (let i = 0; i < corps.length; i++) {
    const corp = corps[i];

    try {
      // Scrape ORIC page for additional context
      const scrapedText = await scrapeOricPage(corp.oric_url);
      if (scrapedText) scraped++;

      // Enrich with LLM
      const result = await enrichWithLLM(corp, scrapedText);

      // Update DB
      await supabase
        .from('oric_corporations')
        .update({
          enriched_description: result.description,
          enriched_focus_areas: result.focus_areas,
          enriched_community_served: result.community_served,
          enriched_at: new Date().toISOString(),
          enrichment_provider: result.provider,
        })
        .eq('icn', corp.icn);

      enriched++;
      providerCounts[result.provider] = (providerCounts[result.provider] || 0) + 1;

      if ((i + 1) % 50 === 0 || i === corps.length - 1) {
        log(`Progress: ${i + 1}/${corps.length} (enriched=${enriched}, scraped=${scraped}, errors=${errors})`);
        log(`  Providers: ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));

    } catch (err) {
      errors++;
      log(`Error on ICN ${corp.icn} (${corp.name}): ${err.message}`);
      if (err.message === 'All LLM providers exhausted') {
        log('All providers exhausted — stopping');
        break;
      }
    }
  }

  log(`\nComplete: ${enriched} enriched, ${scraped} scraped, ${errors} errors`);
  log(`Providers: ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
