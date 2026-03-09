#!/usr/bin/env node

/**
 * Enrich Foundation Programs
 *
 * Scrapes program URLs with Cheerio and extracts eligibility criteria,
 * application process, deadline, and amount using free LLM providers.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-programs.mjs [--limit=100] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cheerio = require('../packages/grant-engine/node_modules/cheerio');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 200;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PROVIDERS = [
  { name: 'minimax', baseUrl: 'https://api.minimaxi.chat/v1/chat/completions', model: 'MiniMax-M2.5', envKey: 'MINIMAX_API_KEY', disabled: false },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY', disabled: false },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY', disabled: false },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY', disabled: false },
];

let currentProviderIndex = 0;

async function scrapeUrl(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrantScope/1.0 (program-enrichment; +https://grantscope.au)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, nav, footer, header, iframe, noscript, .cookie-banner, .sidebar, .menu, .breadcrumb').remove();

    const mainContent =
      $('main').text() ||
      $('[role="main"]').text() ||
      $('article').text() ||
      $('.content, .main-content, #content, #main-content').text() ||
      $('body').text();

    const text = mainContent.replace(/\s+/g, ' ').trim();
    if (text.length < 100) return null;
    return text.slice(0, 6000);
  } catch {
    return null;
  }
}

async function extractWithLLM(name, description, scrapedText) {
  const prompt = `Extract grant program information from this Australian foundation program page.

Program name: ${name}
${description ? `Existing description: ${description}` : ''}

Page content:
${scrapedText.slice(0, 4000)}

Return JSON only:
{
  "eligibility": "Who can apply — 1-3 sentences covering org type, location, size requirements",
  "application_process": "How to apply — 1-2 sentences covering process, key dates, what to submit",
  "deadline": "YYYY-MM-DD or null if not found or ongoing",
  "amount_min": null or number,
  "amount_max": null or number,
  "categories": ["category1", "category2"]
}

Categories should be from: arts, indigenous, health, education, community, environment, enterprise, research, justice, sport, disaster_relief, technology
If a field is unclear, use null or empty. Keep text concise.`;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(currentProviderIndex + attempt) % PROVIDERS.length];
    if (provider.disabled) continue;
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429 || response.status === 402 || /rate_limit|quota|Insufficient Balance|credit balance/.test(err)) {
          console.log(`  [${provider.name}] rate limited — disabling`);
          provider.disabled = true;
          continue;
        }
        console.log(`  [${provider.name}] error ${response.status}: ${err.slice(0, 80)}`);
        continue;
      }

      const json = await response.json();
      const text = json.choices?.[0]?.message?.content || '';
      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        eligibility: typeof parsed.eligibility === 'string' && parsed.eligibility.length > 10 ? parsed.eligibility.slice(0, 500) : null,
        application_process: typeof parsed.application_process === 'string' && parsed.application_process.length > 10 ? parsed.application_process.slice(0, 500) : null,
        deadline: typeof parsed.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline) ? parsed.deadline : null,
        amount_min: typeof parsed.amount_min === 'number' ? parsed.amount_min : null,
        amount_max: typeof parsed.amount_max === 'number' ? parsed.amount_max : null,
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      };
    } catch (err) {
      console.log(`  [${provider.name}] error: ${err.message?.slice(0, 80)}`);
      continue;
    }
  }
  return null;
}

async function main() {
  console.log('=== Enrich Foundation Programs ===');
  console.log(`  Limit: ${LIMIT}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Providers: ${PROVIDERS.filter(p => process.env[p.envKey]).map(p => p.name).join(', ')}`);

  // Fetch programs needing enrichment — have URL but no eligibility
  const { data: programs, error } = await supabase
    .from('foundation_programs')
    .select('id, name, url, description, eligibility, application_process, deadline, amount_min, amount_max, categories')
    .not('url', 'is', null)
    .or('eligibility.is.null,application_process.is.null')
    .limit(LIMIT);

  if (error) {
    console.error(`DB error: ${error.message}`);
    process.exit(1);
  }

  if (!programs?.length) {
    console.log('No programs need enrichment');
    return;
  }

  console.log(`  ${programs.length} programs to enrich\n`);

  if (DRY_RUN) {
    for (const p of programs.slice(0, 10)) {
      console.log(`  ${p.name} | ${p.url}`);
    }
    if (programs.length > 10) console.log(`  ... and ${programs.length - 10} more`);
    return;
  }

  let enriched = 0;
  let scraped = 0;
  let skipped = 0;
  let errors = 0;

  for (const prog of programs) {
    if (!prog.url) { skipped++; continue; }

    const text = await scrapeUrl(prog.url);
    if (!text) { skipped++; continue; }
    scraped++;

    const result = await extractWithLLM(prog.name, prog.description, text);
    if (!result || (!result.eligibility && !result.application_process)) {
      skipped++;
      continue;
    }

    const update = {};
    if (result.eligibility && !prog.eligibility) update.eligibility = result.eligibility;
    if (result.application_process && !prog.application_process) update.application_process = result.application_process;
    if (result.deadline && !prog.deadline) update.deadline = result.deadline;
    if (result.amount_min && !prog.amount_min) update.amount_min = result.amount_min;
    if (result.amount_max && !prog.amount_max) update.amount_max = result.amount_max;
    if (result.categories?.length > 0 && (!prog.categories || prog.categories.length === 0)) update.categories = result.categories;

    if (Object.keys(update).length === 0) { skipped++; continue; }

    const { error: updateErr } = await supabase
      .from('foundation_programs')
      .update(update)
      .eq('id', prog.id);

    if (updateErr) {
      console.log(`  Error updating "${prog.name.slice(0, 50)}": ${updateErr.message}`);
      errors++;
    } else {
      enriched++;
      if (enriched % 10 === 0 || enriched === 1) {
        console.log(`  Progress: ${enriched} enriched, ${scraped} scraped, ${skipped} skipped, ${errors} errors (${enriched + skipped + errors}/${programs.length})`);
      }
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n=== Done ===`);
  console.log(`  Enriched: ${enriched}`);
  console.log(`  Scraped: ${scraped}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
