#!/usr/bin/env node
/**
 * enrich-foundations-local.mjs
 *
 * Drop-in replacement for enrich-foundations.mjs that puts the local
 * Gemma 4 model first in the provider round-robin.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-foundations-local.mjs
 *   node --env-file=.env scripts/enrich-foundations-local.mjs --local-only --limit=5950
 *   node --env-file=.env scripts/enrich-foundations-local.mjs --no-website --limit=200
 *   node --env-file=.env scripts/enrich-foundations-local.mjs --dry-run
 *   node --env-file=.env scripts/enrich-foundations-local.mjs --re-enrich --limit=100
 *
 * --local-only    Use only the local LLM. Exit if not available.
 * --no-website    Also enrich foundations without websites (ACNC data only)
 * --re-enrich     Re-enrich foundations that were enriched but got no description
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';
import { LOCAL_PROVIDER, isLocalLLMAvailable, LOCAL_LLM_URL, LOCAL_LLM_MODEL } from './lib/local-llm.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const NO_WEBSITE = process.argv.includes('--no-website');
const RE_ENRICH = process.argv.includes('--re-enrich');
const LOCAL_ONLY = process.argv.includes('--local-only');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || (LOCAL_ONLY ? '50' : '500'));
const PREFERRED_PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] || 'local-gemma4';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] [foundation-enrich-local] ${msg}`); }

// ─── Provider list — local first ─────────────────────────────────────────────

const PROVIDERS = [
  { ...LOCAL_PROVIDER },
  { name: 'minimax', baseUrl: MINIMAX_CHAT_COMPLETIONS_URL, model: 'MiniMax-M2.7', envKey: 'MINIMAX_API_KEY', disabled: false },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY', disabled: false },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY', disabled: false },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY', disabled: false },
  { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY', disabled: false, isAnthropic: true },
];

// If local-only, disable all external providers
if (LOCAL_ONLY) {
  for (const p of PROVIDERS) {
    if (!p.isLocal) p.disabled = true;
  }
}

let currentProviderIndex = 0;
let anthropicTokens = { input: 0, output: 0 };
let localStats = { calls: 0, totalTokPerSec: 0 };
let currentRunId = null;

const RATE_LIMIT_LOCAL_MS = 500;
const RATE_LIMIT_API_MS = 1500;
const SCRAPE_TIMEOUT_MS = 15000;

// ─── Website scraper ─────────────────────────────────────────────────────────

async function scrapeWebsite(url) {
  if (!url) return null;
  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;
    const response = await fetch(normalizedUrl, {
      headers: { 'User-Agent': 'CivicGraph/1.0 (+https://grantscope.au)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, iframe, noscript, svg').remove();
    const mainText = ($('main').text() || $('article').text() || $('body').text())
      .replace(/\s+/g, ' ').trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const combined = [metaDesc, ogDesc, mainText].filter(Boolean).join('\n\n');
    return combined.length > 50 ? combined.slice(0, 3000) : null;
  } catch {
    return null;
  }
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(foundation, scrapedText) {
  const acncData = foundation.acnc_data || {};
  const beneficiaryMap = {
    'Youth': 'Youth', 'Children': 'Children', 'Adults': 'Adults',
    'Aged_Persons': 'Aged persons', 'Families': 'Families',
    'Aboriginal_or_TSI': 'Aboriginal & Torres Strait Islander peoples',
    'People_with_Disabilities': 'People with disabilities',
    'Financially_Disadvantaged': 'Financially disadvantaged',
    'People_at_risk_of_homelessness': 'People at risk of homelessness',
    'Rural_Regional_Remote_Communities': 'Rural/regional/remote communities',
    'Migrants_Refugees_or_Asylum_Seekers': 'Migrants, refugees & asylum seekers',
    'General_Community_in_Australia': 'General community',
  };
  const purposeMap = {
    'Advancing_Health': 'Health', 'Advancing_Education': 'Education',
    'Advancing_Culture': 'Culture', 'Advancing_Religion': 'Religion',
    'Advancing_natual_environment': 'Environment',
    'Advancing_social_or_public_welfare': 'Social welfare',
    'Promoting_or_protecting_human_rights': 'Human rights',
    'Promoting_reconciliation__mutual_respect_and_tolerance': 'Reconciliation',
  };
  const beneficiaries = Object.entries(beneficiaryMap).filter(([k]) => acncData[k] === 'Y').map(([, v]) => v);
  const purposes = Object.entries(purposeMap).filter(([k]) => acncData[k] === 'Y').map(([, v]) => v);
  const states = ['NSW','VIC','QLD','SA','WA','TAS','NT','ACT'].filter(s => acncData[`Operates_in_${s}`] === 'Y');

  const contextParts = [
    `Foundation Name: ${foundation.name}`,
    `ABN: ${foundation.acnc_abn || 'N/A'}`,
    `Website: ${foundation.website || 'None'}`,
    foundation.total_giving_annual ? `Annual Giving: $${Number(foundation.total_giving_annual).toLocaleString()}` : null,
    foundation.avg_grant_size ? `Average Grant Size: $${Number(foundation.avg_grant_size).toLocaleString()}` : null,
    acncData.Charity_Size ? `Size: ${acncData.Charity_Size}` : null,
    acncData.Town_City ? `Location: ${acncData.Town_City}, ${acncData.State}` : (acncData.State ? `State: ${acncData.State}` : null),
    purposes.length ? `Purposes: ${purposes.join(', ')}` : null,
    beneficiaries.length ? `Beneficiaries: ${beneficiaries.join(', ')}` : null,
    states.length ? `Operates in: ${states.join(', ')}` : null,
    scrapedText ? `\nWebsite Content:\n${scrapedText}` : null,
  ].filter(Boolean);

  return `You are analysing an Australian philanthropic foundation. Return ONLY compact JSON — no explanation, no markdown fences.

${contextParts.join('\n')}

Return this JSON structure (keep all text under 300 chars):
{
  "description": "2-4 sentences on what this foundation does, its mission, and who it supports.",
  "thematic_focus": ["area1", "area2"],
  "geographic_focus": ["AU-National" or state codes like "AU-QLD"],
  "target_recipients": ["type1", "type2"],
  "giving_philosophy": "1-2 sentences on how they approach giving.",
  "wealth_source": "Brief: where does the foundation's money come from?",
  "application_tips": "1-2 practical tips for approaching this funder."
}

Standard thematic values: health, education, environment, arts, community, indigenous, disability, housing, research, youth, aged-care, social-enterprise, employment, legal, international.
Never fabricate specific dollar amounts or names not in the data.`;
}

// ─── LLM caller ──────────────────────────────────────────────────────────────

function emptyResult() {
  return { description: null, thematic_focus: [], geographic_focus: [], target_recipients: [], giving_philosophy: null, wealth_source: null, application_tips: null };
}

function parseJsonFromText(text, providerName) {
  const stripped = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let jsonStr = stripped;
  const firstBrace = jsonStr.indexOf('{');
  if (firstBrace >= 0) jsonStr = jsonStr.slice(firstBrace);
  else return null;

  // Balance braces
  let depth = 0, inString = false, escaped = false, jsonEnd = -1;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
  }

  const candidate = jsonEnd > 0 ? jsonStr.slice(0, jsonEnd) : jsonStr;
  const cleaned = candidate.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  try {
    return JSON.parse(cleaned);
  } catch {
    // Salvage key fields
    const s = {};
    for (const f of ['description', 'giving_philosophy', 'wealth_source', 'application_tips']) {
      const m = cleaned.match(new RegExp(`"${f}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (m) s[f] = m[1].replace(/\\n/g, ' ');
    }
    for (const f of ['thematic_focus', 'geographic_focus', 'target_recipients']) {
      const m = cleaned.match(new RegExp(`"${f}"\\s*:\\s*(\\[[^\\]]*\\])`));
      if (m) try { s[f] = JSON.parse(m[1]); } catch {}
    }
    return Object.keys(s).length >= 2 ? s : null;
  }
}

async function enrichWithLLM(foundation, scrapedText) {
  const prompt = buildPrompt(foundation, scrapedText);

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(currentProviderIndex + attempt) % PROVIDERS.length];
    if (provider.disabled) continue;

    // Check API key for non-local providers
    if (!provider.isLocal) {
      const apiKey = process.env[provider.envKey];
      if (!apiKey) continue;
    }

    try {
      const t0 = Date.now();
      const headers = { 'Content-Type': 'application/json' };
      let body;

      if (provider.isLocal) {
        body = JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1500, stream: false });
      } else if (provider.isAnthropic) {
        headers['x-api-key'] = process.env[provider.envKey];
        headers['anthropic-version'] = '2023-06-01';
        body = JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1500 });
      } else {
        headers['Authorization'] = `Bearer ${process.env[provider.envKey]}`;
        body = JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1500 });
      }

      const response = await fetch(provider.isLocal ? LOCAL_LLM_URL : provider.baseUrl, {
        method: 'POST', headers, body,
        signal: AbortSignal.timeout(provider.isLocal ? 120_000 : 60_000),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 401 || /invalid api key|unauthorized/i.test(err)) { provider.disabled = true; continue; }
        if (response.status === 429 || response.status === 402 || /rate_limit|quota|balance/i.test(err)) { provider.disabled = true; continue; }
        log(`${provider.name} error ${response.status}`);
        continue;
      }

      const json = await response.json();
      const text = provider.isAnthropic
        ? (json.content?.[0]?.text || '')
        : (json.choices?.[0]?.message?.content || '');

      if (provider.isAnthropic && json.usage) {
        anthropicTokens.input += json.usage.input_tokens || 0;
        anthropicTokens.output += json.usage.output_tokens || 0;
      }

      if (provider.isLocal) {
        const elapsed = (Date.now() - t0) / 1000;
        const toks = json.usage?.completion_tokens || text.split(/\s+/).length;
        const tps = Math.round(toks / elapsed);
        localStats.calls++;
        localStats.totalTokPerSec += tps;
        // log(`  local: ${tps} tok/s`);
      }

      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;
      const parsed = parseJsonFromText(text, provider.name);
      if (!parsed) { log(`${provider.name} returned no parseable JSON`); return { provider: provider.name, ...emptyResult() }; }

      return {
        provider: provider.name,
        description: typeof parsed.description === 'string' ? parsed.description.slice(0, 1500) : null,
        thematic_focus: Array.isArray(parsed.thematic_focus) ? parsed.thematic_focus : [],
        geographic_focus: Array.isArray(parsed.geographic_focus) ? parsed.geographic_focus : [],
        target_recipients: Array.isArray(parsed.target_recipients) ? parsed.target_recipients : [],
        giving_philosophy: typeof parsed.giving_philosophy === 'string' ? parsed.giving_philosophy.slice(0, 1500) : null,
        wealth_source: typeof parsed.wealth_source === 'string' ? parsed.wealth_source.slice(0, 500) : null,
        application_tips: typeof parsed.application_tips === 'string' ? parsed.application_tips.slice(0, 500) : null,
      };
    } catch (err) {
      if (err.message?.includes('Local LLM not running')) { provider.disabled = true; log('Local LLM not available — falling back to APIs'); }
      else log(`${provider.name} error: ${err.message?.slice(0, 80)}`);
      continue;
    }
  }
  throw new Error('All LLM providers exhausted');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Check local availability upfront
  const localAvailable = await isLocalLLMAvailable();
  if (LOCAL_ONLY && !localAvailable) {
    console.error(`Local LLM not running at ${LOCAL_LLM_URL}`);
    console.error('Start with: llama-server -m <gemma4.gguf> --jinja -fa -c 131072 -ngl 99');
    process.exit(1);
  }
  if (!localAvailable) {
    log('Local LLM not available — using API providers only');
    PROVIDERS[0].disabled = true;
  } else {
    log(`Local LLM available at ${LOCAL_LLM_URL} (model: ${LOCAL_LLM_MODEL})`);
  }

  log(`Starting (limit=${LIMIT}, local-only=${LOCAL_ONLY}, no-website=${NO_WEBSITE}, dry-run=${DRY_RUN})`);
  const run = await logStart(supabase, 'enrich-foundations-local', 'Enrich Foundations (Local)');
  currentRunId = run.id;

  let query = supabase.from('foundations').select('*')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (RE_ENRICH) {
    query = query.not('enriched_at', 'is', null).or('description.is.null,description.eq.');
  } else {
    query = query.is('enriched_at', null);
    if (!NO_WEBSITE) query = query.not('website', 'is', null).neq('website', '');
  }

  const { data: foundations, error } = await query;
  if (error) { log(`DB error: ${error.message}`); await logFailed(supabase, run.id, error.message); process.exit(1); }
  log(`Found ${foundations.length} foundations to enrich`);

  if (DRY_RUN) {
    log('DRY RUN — first 10:');
    foundations.slice(0, 10).forEach(f => log(`  ${f.name} | $${Number(f.total_giving_annual || 0).toLocaleString()}/yr`));
    return;
  }

  let enriched = 0, scraped = 0, errors = 0;
  const providerCounts = {};

  for (let i = 0; i < foundations.length; i++) {
    const f = foundations[i];
    const usedLocal = !PROVIDERS[0].disabled;
    try {
      const scrapedText = f.website && !LOCAL_ONLY ? await scrapeWebsite(f.website) : null;
      if (scrapedText) scraped++;

      const result = await enrichWithLLM(f, scrapedText);
      const update = { enriched_at: new Date().toISOString(), enrichment_source: scrapedText ? 'scrape+local-llm' : 'local-llm' };
      if (result.description) update.description = result.description;
      if (result.thematic_focus?.length) update.thematic_focus = result.thematic_focus;
      if (result.geographic_focus?.length) update.geographic_focus = result.geographic_focus;
      if (result.target_recipients?.length) update.target_recipients = result.target_recipients;
      if (result.giving_philosophy) update.giving_philosophy = result.giving_philosophy;
      if (result.wealth_source) update.wealth_source = result.wealth_source;
      if (result.application_tips) update.application_tips = result.application_tips;

      await supabase.from('foundations').update(update).eq('id', f.id);
      enriched++;
      providerCounts[result.provider] = (providerCounts[result.provider] || 0) + 1;

      if ((i + 1) % 25 === 0 || i === foundations.length - 1) {
        const avgTps = localStats.calls > 0 ? Math.round(localStats.totalTokPerSec / localStats.calls) : 0;
        log(`Progress: ${i + 1}/${foundations.length} enriched=${enriched} errors=${errors} providers=${JSON.stringify(providerCounts)}${avgTps ? ` local-avg=${avgTps}tok/s` : ''}`);
      }

      await new Promise(r => setTimeout(r, usedLocal ? RATE_LIMIT_LOCAL_MS : RATE_LIMIT_API_MS));
    } catch (err) {
      errors++;
      log(`Error on "${f.name}": ${err.message}`);
      if (err.message === 'All LLM providers exhausted') { log('All providers exhausted — stopping'); break; }
    }
  }

  const avgTps = localStats.calls > 0 ? Math.round(localStats.totalTokPerSec / localStats.calls) : 0;
  log(`\nComplete: ${enriched} enriched, ${scraped} scraped, ${errors} errors`);
  log(`Providers: ${JSON.stringify(providerCounts)}`);
  if (avgTps) log(`Local LLM average: ${avgTps} tok/s across ${localStats.calls} calls`);

  await logComplete(supabase, run.id, {
    items_found: foundations.length,
    items_new: enriched,
    items_updated: 0,
    status: errors > 0 ? 'partial' : 'success',
    errors: errors > 0 ? [`${errors} enrichment errors`] : [],
  });
}

let _runId = null;
main().catch(err => {
  console.error('Fatal:', err.message);
  logFailed(supabase, _runId, err.message).catch(() => {});
  process.exit(1);
});
