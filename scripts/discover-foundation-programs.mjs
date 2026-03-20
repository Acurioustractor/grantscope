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
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 2;
const PREFERRED_PROVIDER = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] || 'minimax';
const DISCOVERY_MODE = process.argv.find(a => a.startsWith('--mode='))?.split('=')[1] || 'strict-public';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentRunId = null;

function log(msg) {
  console.log(`[discover-programs] ${msg}`);
}

// --- Multi-provider LLM (program-focused prompt) ---

const PROVIDERS = [
  {
    name: 'minimax',
    envKey: 'MINIMAX_API_KEY',
    model: 'MiniMax-M2.7',
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
        const res = await fetch(MINIMAX_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4000,
            temperature: 0.1,
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
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          if (res.status === 401) DISABLED_PROVIDERS.add(provider.name);
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
            max_tokens: 4000,
            temperature: 0.1,
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
            max_tokens: 4000,
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
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    return null;
  }
}

function looksGrantLikeProgramRecord(program) {
  const combined = `${program?.name || ''} ${program?.description || ''} ${program?.application_process || ''} ${program?.eligibility || ''} ${program?.url || ''} ${program?.program_type || ''}`;
  const hasGrantLanguage = /(grant|grant round|community giving|fellowship|scholarship|award|bursary|funding round|apply now|how to apply|applications? open|grant guidelines|expression of interest|eoi)/i.test(combined);
  const hasGrantPath = /(\/grants?\/|\/grant-programs?\/|\/funding\/|\/apply\/|\/applications?\/|\/community-giving\/|\/fellowships?\/|\/scholarships?\/)/i.test(String(program?.url || '').toLowerCase());
  const looksNonGrant = /(appeal|donation|donate|sponsorship|sponsor a child|child sponsorship|orphan sponsorship|water project|food packs?|relief fund|crisis relief|family support|support program|housing support|clean water|fiscal sponsorship|disaster relief|donations program|community support|direct sponsorship)/i.test(combined);
  const hasStructuredSignal = Boolean(program?.amount_min || program?.amount_max || program?.deadline);
  if (looksNonGrant && !hasGrantLanguage && !hasGrantPath) return false;
  return hasGrantLanguage || hasGrantPath || hasStructuredSignal;
}

async function getFoundationsToScan() {
  // Get foundation IDs that already have grant-like public programs.
  // Invalid appeal/support rows should not block a rescan.
  const { data: withPrograms } = await supabase
    .from('foundation_programs')
    .select('foundation_id, name, description, url, application_process, eligibility, amount_min, amount_max, deadline, program_type');

  const hasPrograms = new Set(
    (withPrograms || [])
      .filter(looksGrantLikeProgramRecord)
      .map(r => r.foundation_id)
  );

  // Get foundations that are likely grantmakers with websites + descriptions but no programs yet.
  // Prioritise actual funder language and avoid obvious operating charities / school / event pages.
  const { data, error } = await supabase
    .from('foundations')
    .select('id, name, type, website, description, thematic_focus, geographic_focus, total_giving_annual, giving_philosophy, application_tips, open_programs, profile_confidence')
    .not('website', 'is', null)
    .not('description', 'is', null)
    .or([
      'name.ilike.%foundation%',
      'name.ilike.%trust%',
      'name.ilike.%fund%',
      'description.ilike.%grant%',
      'description.ilike.%fellowship%',
      'description.ilike.%scholarship%',
      'description.ilike.%philanthrop%',
      'description.ilike.%funding%',
      'description.ilike.%applications%'
    ].join(','))
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(LIMIT * 4); // fetch extra to filter

  if (error) {
    log(`Error fetching foundations: ${error.message}`);
    return [];
  }

  const grantmakerSignals = /(grant|grants|fellowship|scholarship|philanthrop|funding|applications|awards?|EOI|apply now|grant round|community giving|open for applications|grant program)/i;
  const operatorSignals = /(school|schools office|college|grammar|church|parish|diocese|catholic|christian brothers|hospital|medical centre|racing|showground|primary health network|phn|legal aid|university|institute|society|council|commission|australia for|care australia|world vision|red cross|donations fund|relief fund|barnardos|caritas|compassion|flying doctor|medecins sans frontieres|msf|health network|healthcare network)/i;
  const corporateCommunitySignals = /(community|sustainability|social impact|our impact|responsibility)/i;
  const antiGrantmakerSignals = /(not a traditional grant-?maker|operating (school|foundation|organisation)|direct service provider|does not offer grants|engage .* as a partner rather than as a traditional funder|families should contact|enrolment or community partnerships|direct program delivery|fundraising campaigns for specific projects|beneficiaries should review)/i;
  const directServiceSignals = /(childfund|children'?s fund|welfare|relief|refugee|aged care|aged masons widows|orphans|health service|hospital|community health|aid fund|community services|service delivery|service provider|donations fund|benevolence)/i;
  const hardRejectFundNames = /(childfund|welfare fund|relief fund|donations fund|aid fund)/i;
  const explicitProgramsPathSignals = /(\/grants?\/|\/grant-programs?\/|\/funding\/|\/apply\/|\/applications?\/|\/community-giving\/|\/fellowships?\/|\/scholarships?\/)/i;
  const grantLikeProgramSignals = /(grant|grant round|community giving|fellowship|scholarship|award|application|eoi|funding round)/i;

  // Prioritise likely grantmakers without programs
  const candidates = (data || [])
    .filter(f => !hasPrograms.has(f.id))
    .filter((foundation) => {
      const website = String(foundation.website || '').toLowerCase();
      if (!website || website.includes('facebook.com') || website.includes('instagram.com')) return false;

      const name = String(foundation.name || '');
      const description = String(foundation.description || '');
      const baseJoined = `${name} ${description} ${foundation.giving_philosophy || ''}`;
      const applicationTipsText = String(foundation.application_tips || '');
      const joined = `${baseJoined} ${applicationTipsText}`;

      const type = String(foundation.type || '').toLowerCase();
      const openPrograms = Array.isArray(foundation.open_programs) ? foundation.open_programs : [];
      const hasOpenPrograms = openPrograms.length > 0;
      const hasGrantLikeOpenPrograms = openPrograms.some((program) => {
        const combined = `${program?.name || ''} ${program?.description || ''} ${program?.url || ''}`;
        return grantLikeProgramSignals.test(combined);
      });
      const applicationTipsSignal = /grant round|community giving|open for applications|apply now|scholarship|fellowship|grant program|grant guidelines|how to apply|eligibility/i.test(applicationTipsText);
      const hasApplicationSurface = hasGrantLikeOpenPrograms || /grant round|community giving|open for applications|apply now|grant guidelines|eligibility|EOI/i.test(baseJoined);
      const websiteHasExplicitProgramsPath = explicitProgramsPathSignals.test(website);
      const explicitPublicFundingSurface =
        hasGrantLikeOpenPrograms ||
        websiteHasExplicitProgramsPath ||
        /grant round|community giving|open for applications|fellowship|scholarship|apply now|applications are open|how to apply|grant program/i.test(baseJoined);
      const nameHasFunderShape = /foundation|trust|fund/i.test(name);
      const websiteHasFunderShape = /foundation|trust|fund|grants?/i.test(website);
      const isPreferredType = ['corporate_foundation', 'private_ancillary_fund', 'public_ancillary_fund', 'trust'].includes(type);
      const isBroadGrantmaker = type === 'grantmaker';
      const isCorporateCommunityPage = type === 'corporate_foundation' && corporateCommunitySignals.test(website) && !hasOpenPrograms && !websiteHasExplicitProgramsPath;
      const looksLikeGrantmaker =
        grantmakerSignals.test(joined) ||
        (isPreferredType && (nameHasFunderShape || websiteHasFunderShape)) ||
        (isBroadGrantmaker && (nameHasFunderShape || websiteHasFunderShape) && (grantmakerSignals.test(joined) || hasApplicationSurface)) ||
        foundation.total_giving_annual >= 1000000;

      const looksLikeOperator = operatorSignals.test(baseJoined) && !grantmakerSignals.test(baseJoined);
      const looksLikeDirectService = directServiceSignals.test(joined) && !explicitPublicFundingSurface;
      const explicitlyNotGrantmaker = antiGrantmakerSignals.test(joined);
      const institutionalOperator = operatorSignals.test(name) && !nameHasFunderShape && !websiteHasFunderShape;
      const corporateAllowed =
        type !== 'corporate_foundation' ||
        hasGrantLikeOpenPrograms ||
        explicitPublicFundingSurface;
      const allowedByType =
        ((type === 'private_ancillary_fund' || type === 'public_ancillary_fund') &&
          (explicitPublicFundingSurface || (foundation.profile_confidence !== 'low' && foundation.total_giving_annual >= 1000000 && (nameHasFunderShape || websiteHasFunderShape)))) ||
        (type === 'trust' &&
          (explicitPublicFundingSurface || (foundation.profile_confidence === 'high' && foundation.total_giving_annual >= 1000000 && (nameHasFunderShape || websiteHasFunderShape)))) ||
        (type === 'corporate_foundation' && corporateAllowed && explicitPublicFundingSurface) ||
        (isBroadGrantmaker &&
          (nameHasFunderShape || websiteHasFunderShape) &&
          (explicitPublicFundingSurface || (foundation.profile_confidence === 'high' && foundation.total_giving_annual >= 5000000))) ||
        ((nameHasFunderShape || websiteHasFunderShape) && explicitPublicFundingSurface);
      const strictPublicMode = DISCOVERY_MODE === 'strict-public';
      if (explicitlyNotGrantmaker && !hasGrantLikeOpenPrograms) return false;
      if (strictPublicMode && hardRejectFundNames.test(name) && !explicitPublicFundingSurface) return false;
      if (strictPublicMode && institutionalOperator && !explicitPublicFundingSurface) return false;
      if (foundation.profile_confidence === 'low' && !hasOpenPrograms && !websiteHasExplicitProgramsPath && !/grant|fellowship|scholarship/.test(joined)) return false;
      if (strictPublicMode && !explicitPublicFundingSurface && type !== 'private_ancillary_fund' && type !== 'public_ancillary_fund') return false;
      return looksLikeGrantmaker && !looksLikeOperator && !looksLikeDirectService && !isCorporateCommunityPage && allowedByType;
    })
    .filter((foundation, index, arr) => {
      const dedupeKey = `${String(foundation.name || '').trim().toLowerCase()}|${String(foundation.website || '').trim().toLowerCase()}`;
      return arr.findIndex((other) => `${String(other.name || '').trim().toLowerCase()}|${String(other.website || '').trim().toLowerCase()}` === dedupeKey) === index;
    });

  return candidates
    .sort((a, b) => {
      const score = (foundation) => {
        let total = 0;
        const type = String(foundation.type || '').toLowerCase();
        const joined = `${foundation.name || ''} ${foundation.description || ''} ${foundation.giving_philosophy || ''} ${foundation.application_tips || ''}`;
        const openPrograms = Array.isArray(foundation.open_programs) ? foundation.open_programs : [];
        const hasOpenPrograms = openPrograms.length > 0;
        const hasGrantLikeOpenPrograms = openPrograms.some((program) => {
          const combined = `${program?.name || ''} ${program?.description || ''} ${program?.url || ''}`;
          return grantLikeProgramSignals.test(combined);
        });
        const hasApplicationSurface = Boolean(foundation.application_tips) || hasGrantLikeOpenPrograms || /apply|application|guidelines|eligibility|grant round|EOI/i.test(joined);
        const website = String(foundation.website || '').toLowerCase();

        if (type === 'private_ancillary_fund' || type === 'public_ancillary_fund') total += 6;
        else if (type === 'trust') total += 5;
        else if (type === 'grantmaker') total += 4;
        else if (type === 'corporate_foundation') total += 2;
        if (foundation.profile_confidence === 'high') total += 4;
        else if (foundation.profile_confidence === 'medium') total += 2;
        if (foundation.giving_philosophy) total += 2;
        if (foundation.application_tips && (hasGrantLikeOpenPrograms || explicitProgramsPathSignals.test(website) || /grant round|community giving|fellowship|scholarship|grant program/i.test(joined))) total += 2;
        if (hasGrantLikeOpenPrograms) total += 4;
        else if (hasOpenPrograms) total -= 3;
        if (hasApplicationSurface) total += 3;
        if (explicitProgramsPathSignals.test(website)) total += 4;
        if (foundation.total_giving_annual >= 1000000) total += 4;
        else if (foundation.total_giving_annual >= 250000) total += 2;
        if (/grant|fellowship|scholarship|funding|applications?/i.test(`${foundation.name} ${foundation.description}`)) total += 3;
        if (type === 'corporate_foundation' && corporateCommunitySignals.test(website) && !hasApplicationSurface) total -= 6;
        if (/diocese|catholic|christian brothers|donations fund|relief fund/i.test(joined)) total -= 8;
        if (directServiceSignals.test(joined) && !hasApplicationSurface) total -= 8;
        if (operatorSignals.test(String(foundation.name || '')) && !/foundation|trust|fund/i.test(String(foundation.name || '')) && !hasApplicationSurface) total -= 10;
        if (antiGrantmakerSignals.test(joined)) total -= 12;
        if (foundation.profile_confidence === 'low' && !hasOpenPrograms && !/grant|fellowship|scholarship/.test(joined)) total -= 6;
        return total;
      };
      return score(b) - score(a);
    })
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
  log(`  Mode: ${DISCOVERY_MODE}`);
  log(`  Dry run: ${DRY_RUN}`);

  const foundations = await getFoundationsToScan();
  log(`${foundations.length} foundations to scan for programs`);

  if (foundations.length === 0) {
    log('Nothing to do.');
    return;
  }

  const run = await logStart(supabase, 'discover-foundation-programs', 'Discover Foundation Programs');
  currentRunId = run.id;

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
    status: errors > 0 ? 'partial' : 'success',
    errors: errors > 0 ? [`${errors} foundation program discovery errors`] : [],
  });

  log(`\nComplete: ${totalFound} programs discovered from ${withPrograms}/${scanned} foundations (${errors} errors)`);
  log(`Run scripts/sync-foundation-programs.mjs to sync new programs to grants search.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  const message = err instanceof Error ? err.message : String(err);
  logFailed(supabase, currentRunId, message).catch(() => {});
  process.exit(1);
});
