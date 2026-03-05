#!/usr/bin/env node

/**
 * Discover Foundation Programs
 *
 * Targets foundations with websites + descriptions but few/no programs.
 * Scrapes their website looking specifically for grants, fellowships,
 * scholarships, and funding programs — then extracts structured program data.
 *
 * This is different from the profiler (which asks about programs as an afterthought).
 * This script's ENTIRE focus is finding programs.
 *
 * Usage:
 *   npx tsx scripts/discover-foundation-programs.mjs [--limit=50] [--concurrency=2] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { FoundationScraper } from '../packages/grant-engine/src/foundations/annual-report-scraper.ts';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 2;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[discover-programs] ${msg}`);
}

// --- Multi-provider LLM (program-focused prompt) ---

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

let currentProviderIndex = 0;

async function callLLM(prompt) {
  const startIdx = currentProviderIndex;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(startIdx + attempt) % PROVIDERS.length];
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      let result;

      if (provider.name === 'minimax') {
        const res = await fetch('https://api.minimax.io/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4000,
            temperature: 0.1,
          }),
        });
        if (!res.ok) {
          if (res.status === 429 || res.status === 503) throw new Error(`Rate limited: ${res.status}`);
          throw new Error(`Minimax error ${res.status}`);
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        const answerMatch = content.match(/<answer>([\s\S]*?)<\/answer>/);
        result = answerMatch ? answerMatch[1].trim() : content;
      } else if (provider.name === 'gemini-grounded') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: 4000, temperature: 0.1 },
          }),
        });
        if (!res.ok) {
          if (res.status === 429 || res.status === 503) throw new Error(`Rate limited: ${res.status}`);
          throw new Error(`Gemini error ${res.status}`);
        }
        const data = await res.json();
        result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider.name === 'gemini') {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4000,
            temperature: 0.1,
          }),
        });
        if (!res.ok) {
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
            max_tokens: 4000,
            temperature: 0.1,
          }),
        });
        if (!res.ok) {
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
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!res.ok) {
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
      continue;
    }
  }

  throw new Error('All LLM providers failed');
}

function parseJSON(text) {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    return null;
  }
}

async function getFoundationsToScan() {
  // Get foundation IDs that already have programs
  const { data: withPrograms } = await supabase
    .from('foundation_programs')
    .select('foundation_id');

  const hasPrograms = new Set((withPrograms || []).map(r => r.foundation_id));

  // Get foundations that are likely grantmakers (mention grants/fund/fellowship in description)
  // with websites + descriptions but no programs yet
  // Ordered by total_giving_annual (biggest funders first)
  const { data, error } = await supabase
    .from('foundations')
    .select('id, name, website, description, thematic_focus, geographic_focus, total_giving_annual')
    .not('website', 'is', null)
    .not('description', 'is', null)
    .or('description.ilike.%grant%,description.ilike.%fellowship%,description.ilike.%scholarship%,description.ilike.%philanthrop%,description.ilike.%fund%program%')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(LIMIT * 2); // fetch extra to filter

  if (error) {
    log(`Error fetching foundations: ${error.message}`);
    return [];
  }

  // Prioritise foundations without programs
  return (data || [])
    .filter(f => !hasPrograms.has(f.id))
    .slice(0, LIMIT);
}

/**
 * Call Gemini with Google Search grounding — no website scraping needed.
 * The LLM searches the web itself to find programs.
 */
async function searchWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    if (res.status === 429 || res.status === 503) throw new Error(`Gemini rate limited: ${res.status}`);
    throw new Error(`Gemini error ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function discoverPrograms(foundation, scraper, index, total) {
  const { name, website, description } = foundation;
  log(`  [${index}/${total}] ${name} (${website})`);

  if (DRY_RUN) {
    log(`    Would scan ${name}`);
    return { found: 0 };
  }

  try {
    // Stage 1: Try scraping the website for program content
    let webContent = '';
    try {
      const scraped = await scraper.scrapeFoundation(website);
      log(`    Scraped ${scraped.scrapedUrls.length} pages`);
      webContent = [
        scraped.websiteContent,
        scraped.aboutContent,
        scraped.programsContent,
      ].filter(Boolean).join('\n\n---\n\n');
    } catch (err) {
      log(`    Scrape failed: ${err.message}`);
    }

    // Stage 2: Build prompt — if website content is thin, rely on Gemini Google Search
    const useSearch = !webContent || webContent.length < 300;

    if (useSearch) {
      log(`    Using Google Search (website content insufficient)`);
    }

    const websiteSection = webContent && webContent.length >= 300
      ? `\nWEBSITE CONTENT:\n${webContent.slice(0, 10000)}`
      : '';

    const searchInstruction = useSearch
      ? `\nIMPORTANT: Search the web for "${name} grants programs fellowships scholarships" to find their funding opportunities. Check their website ${website} and any annual reports or media coverage.`
      : '';

    const prompt = `You are an expert at finding grants, fellowships, scholarships, and funding programs run by Australian foundations and organisations.

FOUNDATION: ${name}
WEBSITE: ${website}
DESCRIPTION: ${description?.slice(0, 500) || 'Unknown'}
THEMATIC FOCUS: ${(foundation.thematic_focus || []).join(', ') || 'Unknown'}
GEOGRAPHIC FOCUS: ${(foundation.geographic_focus || []).join(', ') || 'Unknown'}
${searchInstruction}${websiteSection}

Identify ALL grants, fellowships, scholarships, awards, programs, or funding opportunities that this foundation offers or administers.

For EACH program found, extract:
- name: The official program name
- url: Direct URL to the program page (must be from this website, or null)
- description: 1-2 sentences about what it funds and who can apply
- amount_min: Minimum grant amount in AUD (number or null)
- amount_max: Maximum grant amount in AUD (number or null)
- deadline: Next deadline as YYYY-MM-DD (or null if ongoing/unknown)
- type: One of "grant", "fellowship", "scholarship", "award", "program"
- categories: Array from [arts, indigenous, health, education, community, environment, enterprise, research, justice, sport, technology, disability, youth, aged_care]

Return a JSON array of programs. If NO programs are found, return an empty array [].

IMPORTANT RULES:
- Only include programs this foundation actually runs or funds — not programs they received funding from
- Include programs even if applications are currently closed — they may reopen
- Include ongoing/rolling programs without fixed deadlines
- Be specific with amounts — "$50,000" not "varies"
- Include both competitive grants AND named fellowships/scholarships
- Return ONLY valid JSON array, no other text`;

    // Prefer Gemini-grounded (has Google Search) for program discovery
    let llmResult;
    try {
      llmResult = await searchWithGemini(prompt);
      log(`    Used Gemini (Google Search grounded)`);
    } catch (err) {
      log(`    Gemini search failed: ${err.message}, falling back to other providers`);
      llmResult = await callLLM(prompt);
    }
    let programs = parseJSON(llmResult);

    // Handle both array and object responses
    if (programs && !Array.isArray(programs)) {
      if (programs.programs && Array.isArray(programs.programs)) {
        programs = programs.programs;
      } else {
        programs = [programs];
      }
    }

    if (!programs || programs.length === 0) {
      log(`    No programs found`);
      return { found: 0 };
    }

    // Filter out invalid entries
    programs = programs.filter(p => p.name && typeof p.name === 'string' && p.name.length > 3);

    log(`    Found ${programs.length} programs`);

    // Insert into foundation_programs
    let inserted = 0;
    for (const prog of programs) {
      const record = {
        foundation_id: foundation.id,
        name: prog.name.slice(0, 500),
        url: typeof prog.url === 'string' && prog.url.startsWith('http') ? prog.url : null,
        description: typeof prog.description === 'string' ? prog.description.slice(0, 2000) : null,
        amount_min: typeof prog.amount_min === 'number' ? prog.amount_min : null,
        amount_max: typeof prog.amount_max === 'number' ? prog.amount_max : null,
        deadline: typeof prog.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prog.deadline) ? prog.deadline : null,
        status: 'open',
        categories: Array.isArray(prog.categories) ? prog.categories : [],
      };

      const { error: insertError } = await supabase
        .from('foundation_programs')
        .upsert(record, { onConflict: 'foundation_id,name' });

      if (insertError) {
        if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
          // Already exists — skip
        } else {
          log(`    Insert error for "${prog.name}": ${insertError.message}`);
        }
      } else {
        inserted++;
      }
    }

    if (inserted > 0) {
      for (const prog of programs.slice(0, 3)) {
        const type = prog.type || 'program';
        const amount = prog.amount_max ? ` ($${prog.amount_max.toLocaleString()})` : '';
        log(`      ${type}: ${prog.name}${amount}`);
      }
      if (programs.length > 3) log(`      ... and ${programs.length - 3} more`);
    }

    return { found: inserted };
  } catch (err) {
    log(`    Error: ${err instanceof Error ? err.message : String(err)}`);
    return { found: 0, error: true };
  }
}

async function main() {
  log('Starting foundation program discovery...');
  log(`  Limit: ${LIMIT}`);
  log(`  Concurrency: ${CONCURRENCY}`);
  log(`  Dry run: ${DRY_RUN}`);

  const foundations = await getFoundationsToScan();
  log(`${foundations.length} foundations to scan for programs`);

  if (foundations.length === 0) {
    log('Nothing to do.');
    return;
  }

  const run = await logStart(supabase, 'discover-programs', 'Discover Foundation Programs');

  const scraper = new FoundationScraper({ requestDelayMs: 2000, maxPagesPerFoundation: 5 });

  let totalFound = 0;
  let scanned = 0;
  let withPrograms = 0;
  let errors = 0;

  for (let i = 0; i < foundations.length; i += CONCURRENCY) {
    const batch = foundations.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((f, j) => discoverPrograms(f, scraper, i + j + 1, foundations.length))
    );

    for (const result of results) {
      scanned++;
      if (result.status === 'fulfilled') {
        totalFound += result.value.found;
        if (result.value.found > 0) withPrograms++;
        if (result.value.error) errors++;
      } else {
        errors++;
      }
    }

    log(`  --- Batch: ${scanned}/${foundations.length} (${totalFound} programs from ${withPrograms} foundations, ${errors} errors) ---`);
  }

  await logComplete(supabase, run.id, {
    items_found: foundations.length,
    items_new: totalFound,
    items_updated: 0,
  });

  log(`\nComplete: ${totalFound} programs discovered from ${withPrograms}/${scanned} foundations (${errors} errors)`);
  log(`Run scripts/sync-foundation-programs.mjs to sync new programs to grants search.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
