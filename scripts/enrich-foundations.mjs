#!/usr/bin/env node

/**
 * Enrich Foundations with multi-provider LLM
 *
 * For each un-enriched foundation (prioritising those with websites),
 * scrapes the website and uses LLM to generate description, thematic focus,
 * geographic focus, giving philosophy, and other metadata.
 *
 * Usage: node scripts/enrich-foundations.mjs [--dry-run] [--limit=500] [--provider=groq] [--no-website]
 *
 * --no-website: Also enrich foundations without websites (name + ACNC data only)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const NO_WEBSITE = process.argv.includes('--no-website');
const RE_ENRICH = process.argv.includes('--re-enrich'); // Re-enrich those with enriched_at but no description
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');
const PREFERRED_PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] || 'groq';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[foundation-enrich] ${msg}`);
}

// LLM Providers — round-robin with fallback
const PROVIDERS = [
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY', disabled: false },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY', disabled: false },
  { name: 'minimax', baseUrl: 'https://api.minimaxi.chat/v1/chat/completions', model: 'MiniMax-M2.5', envKey: 'MINIMAX_API_KEY', disabled: false },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY', disabled: false },
];

// Move preferred provider to front
if (PREFERRED_PROVIDER !== 'groq') {
  const idx = PROVIDERS.findIndex(p => p.name === PREFERRED_PROVIDER);
  if (idx > 0) {
    const [prov] = PROVIDERS.splice(idx, 1);
    PROVIDERS.unshift(prov);
  }
}

let currentProviderIndex = 0;

const RATE_LIMIT_DELAY_MS = 1500;
const SCRAPE_TIMEOUT_MS = 15000;

async function scrapeWebsite(url) {
  if (!url) return null;
  try {
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'GrantScope/1.0 (foundation-enrichment; +https://grantscope.au)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, iframe, noscript, svg').remove();

    // Try to get about/mission page content from main page
    const mainText = ($('main').text() || $('article').text() || $('body').text())
      .replace(/\s+/g, ' ')
      .trim();

    // Also grab meta description
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';

    const combined = [metaDesc, ogDesc, mainText].filter(Boolean).join('\n\n');
    return combined.length > 50 ? combined.slice(0, 6000) : null;
  } catch {
    return null;
  }
}

async function enrichWithLLM(foundation, scrapedText) {
  const acncData = foundation.acnc_data || {};

  const contextParts = [
    `Foundation Name: ${foundation.name}`,
    `Type: ${foundation.type || 'Unknown'}`,
    `ABN: ${foundation.acnc_abn || 'N/A'}`,
    `Website: ${foundation.website || 'None'}`,
    foundation.total_giving_annual ? `Annual Giving: $${Number(foundation.total_giving_annual).toLocaleString()}` : null,
    foundation.avg_grant_size ? `Average Grant Size: $${Number(foundation.avg_grant_size).toLocaleString()}` : null,
    foundation.parent_company ? `Parent Company: ${foundation.parent_company}` : null,
    foundation.asx_code ? `ASX Code: ${foundation.asx_code}` : null,
    acncData.charity_size ? `Charity Size: ${acncData.charity_size}` : null,
    acncData.activities ? `ACNC Activities: ${acncData.activities}` : null,
    acncData.beneficiaries ? `ACNC Beneficiaries: ${JSON.stringify(acncData.beneficiaries)}` : null,
    acncData.countries ? `Countries: ${JSON.stringify(acncData.countries)}` : null,
  ].filter(Boolean);

  if (scrapedText) {
    contextParts.push(`\nWebsite Content:\n${scrapedText}`);
  }

  const prompt = `You are analysing an Australian philanthropic foundation or grant-making organisation.

${contextParts.join('\n')}

Based on all available information, provide a comprehensive profile.

Return JSON only, no explanation:
{
  "description": "2-4 sentence description of what this foundation does, its mission, and who it supports. Be specific about sectors and geography.",
  "thematic_focus": ["area1", "area2"],
  "geographic_focus": ["AU-National" or "AU-NSW" etc — use ISO 3166-2:AU codes],
  "target_recipients": ["type1", "type2"],
  "giving_philosophy": "1-3 sentences on how this foundation approaches its giving — what it values, how it selects recipients.",
  "wealth_source": "Brief description of where the foundation's wealth comes from (corporate, family, community, government, etc.)",
  "application_tips": "1-2 practical sentences about how to approach this funder — based on their stated priorities and giving patterns."
}

Use these standard values for thematic_focus: health, education, environment, arts, community, indigenous, disability, housing, research, youth, aged-care, sport, religion, animals, international, emergency, legal, employment, technology, social-enterprise.

For geographic_focus use: AU-National, AU-NSW, AU-VIC, AU-QLD, AU-SA, AU-WA, AU-TAS, AU-NT, AU-ACT, or specific region names.

If information is very limited, make reasonable inferences from the name. Never fabricate specific dollar amounts or people's names.`;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(currentProviderIndex + attempt) % PROVIDERS.length];
    if (provider.disabled) continue;

    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1500,
        }),
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

      const text = json.choices?.[0]?.message?.content || '';

      // Advance round-robin
      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;

      // Strip reasoning tags and markdown code blocks
      const stripped = text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/`{3,}json\s*/gi, '')
        .replace(/`{3,}\s*/g, '')
        .trim();

      // Find JSON object
      let jsonStr = stripped;
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace >= 0) jsonStr = jsonStr.slice(firstBrace);
      else jsonStr = '';

      let jsonMatch = jsonStr.match(/\{[\s\S]*\}/);

      // Handle truncated responses
      if (!jsonMatch && jsonStr.startsWith('{')) {
        const fixed = jsonStr + '"}';
        jsonMatch = fixed.match(/\{[\s\S]*\}/);
      }
      if (!jsonMatch) {
        log(`${provider.name} no JSON found (${text.length} chars)`);
        return { provider: provider.name, ...emptyResult() };
      }

      let cleaned = jsonMatch[0]
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        log(`${provider.name} JSON parse error. Raw: ${cleaned.slice(0, 200)}`);
        return { provider: provider.name, ...emptyResult() };
      }

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
      log(`${provider.name} error: ${err.message?.slice(0, 100) || String(err)}`);
      continue;
    }
  }

  throw new Error('All LLM providers exhausted');
}

function emptyResult() {
  return {
    description: null,
    thematic_focus: [],
    geographic_focus: [],
    target_recipients: [],
    giving_philosophy: null,
    wealth_source: null,
    application_tips: null,
  };
}

async function main() {
  log(`Starting foundation enrichment (limit=${LIMIT}, preferred=${PREFERRED_PROVIDER}, dry-run=${DRY_RUN}, no-website=${NO_WEBSITE}, re-enrich=${RE_ENRICH})`);

  // Fetch foundations to enrich
  let query;
  if (RE_ENRICH) {
    // Re-enrich: those previously enriched but got no description
    query = supabase
      .from('foundations')
      .select('*')
      .not('enriched_at', 'is', null)
      .or('description.is.null,description.eq.')
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(LIMIT);
  } else {
    // Normal: un-enriched foundations, prioritise those WITH websites
    query = supabase
      .from('foundations')
      .select('*')
      .is('enriched_at', null)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(LIMIT);
  }

  if (!NO_WEBSITE && !RE_ENRICH) {
    query = query.not('website', 'is', null).neq('website', '');
  }

  const { data: foundations, error } = await query;

  if (error) {
    log(`DB error: ${error.message}`);
    process.exit(1);
  }

  log(`Found ${foundations.length} un-enriched foundations${NO_WEBSITE ? '' : ' (with websites)'}`);

  if (DRY_RUN) {
    log('DRY RUN — showing first 10:');
    for (const f of foundations.slice(0, 10)) {
      log(`  ${f.name} | ${f.website || 'no website'} | $${Number(f.total_giving_annual || 0).toLocaleString()}/yr`);
    }
    return;
  }

  let enriched = 0;
  let scraped = 0;
  let errors = 0;
  const providerCounts = {};

  for (let i = 0; i < foundations.length; i++) {
    const f = foundations[i];

    try {
      // Scrape website
      const scrapedText = await scrapeWebsite(f.website);
      if (scrapedText) scraped++;

      // Enrich with LLM
      const result = await enrichWithLLM(f, scrapedText);

      // Build update object — only set non-null fields
      const update = {
        enriched_at: new Date().toISOString(),
        enrichment_source: scrapedText ? 'scrape+llm' : 'llm-only',
      };

      if (result.description) update.description = result.description;
      if (result.thematic_focus.length > 0) update.thematic_focus = result.thematic_focus;
      if (result.geographic_focus.length > 0) update.geographic_focus = result.geographic_focus;
      if (result.target_recipients.length > 0) update.target_recipients = result.target_recipients;
      if (result.giving_philosophy) update.giving_philosophy = result.giving_philosophy;
      if (result.wealth_source) update.wealth_source = result.wealth_source;
      if (result.application_tips) update.application_tips = result.application_tips;

      await supabase
        .from('foundations')
        .update(update)
        .eq('id', f.id);

      enriched++;
      providerCounts[result.provider] = (providerCounts[result.provider] || 0) + 1;

      if ((i + 1) % 50 === 0 || i === foundations.length - 1) {
        log(`Progress: ${i + 1}/${foundations.length} (enriched=${enriched}, scraped=${scraped}, errors=${errors})`);
        log(`  Providers: ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));

    } catch (err) {
      errors++;
      log(`Error on ${f.name}: ${err.message}`);
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
