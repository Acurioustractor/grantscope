/**
 * Grant Description Enrichment — Free Tier
 *
 * Scrapes grant URLs with Cheerio (static HTML) and extracts structured
 * information using Groq's free API (Llama 3.3 70B, 14,400 req/day).
 *
 * Two strategies:
 * 1. ARC grants: Hit the ARC JSON:API directly (faster, no scraping needed)
 * 2. All others: Cheerio scrape URL → Groq extraction
 *
 * Cost: $0 (Groq free tier + Cheerio)
 */

import * as cheerio from 'cheerio';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MINIMAX_CHAT_COMPLETIONS_URL, stripThinkTags } from './minimax.ts';

const RATE_LIMIT_DELAY_MS = 1500;
const SCRAPE_TIMEOUT_MS = 10000;

interface LLMProvider {
  name: string;
  baseUrl: string;
  model: string;
  envKey: string;
  disabled?: boolean;
}

const PROVIDERS: LLMProvider[] = [
  { name: 'minimax', baseUrl: MINIMAX_CHAT_COMPLETIONS_URL, model: 'MiniMax-M2.7', envKey: 'MINIMAX_API_KEY' },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY' },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY' },
];

let currentProviderIndex = 0;

interface GrantEnrichmentResult {
  description: string | null;
  eligibility_criteria: string[];
  target_recipients: string[];
  deadline: string | null;
  amount_min: number | null;
  amount_max: number | null;
}

/**
 * Scrape a URL with Cheerio and extract the main text content.
 * Returns null if the page is JS-rendered or unreachable.
 */
async function scrapeUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrantScope/1.0 (grant-enrichment; +https://grantscope.au)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, footer, header, iframe, noscript, .cookie-banner, .sidebar, .menu, .breadcrumb').remove();

    // Try to find main content area
    const mainContent =
      $('main').text() ||
      $('[role="main"]').text() ||
      $('article').text() ||
      $('.content, .main-content, #content, #main-content').text() ||
      $('body').text();

    const text = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Skip if too short (likely JS-rendered) or too long (trim it)
    if (text.length < 100) return null;
    return text.slice(0, 6000);
  } catch {
    return null;
  }
}

/**
 * Call an LLM to extract structured grant information from scraped text.
 * Round-robins across free providers, auto-disables on rate limit.
 */
async function extractWithLLM(
  name: string,
  scrapedText: string,
  log: (msg: string) => void = console.log,
): Promise<GrantEnrichmentResult> {
  const prompt = `Extract grant information from this Australian grant page.

Grant name: ${name}

Page content:
${scrapedText.slice(0, 4000)}

Return JSON only, no explanation:
{
  "description": "2-4 sentence description of what this grant funds and its purpose",
  "eligibility_criteria": ["who can apply - criterion 1", "criterion 2"],
  "target_recipients": ["type of org or person that can apply"],
  "deadline": "YYYY-MM-DD or null if not found",
  "amount_min": null or number,
  "amount_max": null or number
}

If a field is unclear, use null or empty array. Keep description under 500 chars.`;

  // Try each provider starting from current index
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
          temperature: 0.1,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 401 || /invalid api key|authorized_error|unauthorized/i.test(err)) {
          log(`[enrich-free] ${provider.name} auth failed — disabling`);
          provider.disabled = true;
          continue;
        }
        if (response.status === 429 || response.status === 402 ||
            err.includes('rate_limit') || err.includes('quota') ||
            err.includes('Insufficient Balance') || err.includes('credit balance')) {
          log(`[enrich-free] ${provider.name} rate limited/quota exceeded — disabling`);
          provider.disabled = true;
          continue;
        }
        log(`[enrich-free] ${provider.name} error: ${provider.name} API error ${response.status}: ${err.slice(0, 100)}`);
        continue;
      }

      const json = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawText = json.choices?.[0]?.message?.content || '';
      const text = stripThinkTags(rawText); // M2.7+ wraps reasoning in <think> tags

      // Advance provider index for round-robin
      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return emptyResult();

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        description: typeof parsed.description === 'string' ? parsed.description.slice(0, 1000) : null,
        eligibility_criteria: Array.isArray(parsed.eligibility_criteria) ? parsed.eligibility_criteria : [],
        target_recipients: Array.isArray(parsed.target_recipients) ? parsed.target_recipients : [],
        deadline: typeof parsed.deadline === 'string' ? parsed.deadline : null,
        amount_min: typeof parsed.amount_min === 'number' ? parsed.amount_min : null,
        amount_max: typeof parsed.amount_max === 'number' ? parsed.amount_max : null,
      };
    } catch (err) {
      if (err instanceof Error && !err.message.includes('API error')) {
        // Parse error, not provider error — don't switch provider
        return emptyResult();
      }
      log(`[enrich-free] ${provider.name} error: ${err instanceof Error ? err.message.slice(0, 100) : String(err)}`);
      continue;
    }
  }

  throw new Error('All LLM providers exhausted');
}

function emptyResult(): GrantEnrichmentResult {
  return {
    description: null,
    eligibility_criteria: [],
    target_recipients: [],
    deadline: null,
    amount_min: null,
    amount_max: null,
  };
}

/**
 * Enrich a single grant by scraping its URL and extracting with Groq.
 */
export async function enrichGrantFree(
  grant: { name: string; url: string; source: string },
  log: (msg: string) => void = console.log,
): Promise<GrantEnrichmentResult> {
  // Strategy 1: ARC grants — name field already contains truncated summary,
  // and the web pages are JS-rendered (Cheerio can't scrape them).
  // Just use the name as description rather than wasting API calls.
  if (grant.source === 'arc-grants') {
    return {
      description: grant.name.length > 50 ? grant.name : null,
      eligibility_criteria: [],
      target_recipients: ['researchers', 'universities'],
      deadline: null,
      amount_min: null,
      amount_max: null,
    };
  }

  // Strategy 2: Scrape URL with Cheerio
  const scraped = await scrapeUrl(grant.url);
  if (!scraped) {
    return emptyResult();
  }

  // Strategy 3: Extract with LLM (Groq → Gemini → DeepSeek)
  return extractWithLLM(grant.name, scraped, log);
}

/**
 * Batch-enrich grants that have URLs but no descriptions.
 * Prioritizes government grants over ARC (ARC has summaries in name already).
 */
export async function batchEnrichFree(
  supabase: SupabaseClient,
  options: {
    limit?: number;
    source?: string;
    onProgress?: (message: string) => void;
  } = {},
): Promise<{ enriched: number; scraped: number; errors: number; skipped: number }> {
  const log = options.onProgress || console.log;
  const limit = options.limit || 500;

  // Check at least one LLM provider is available
  const hasProvider = PROVIDERS.some(p => process.env[p.envKey]);
  if (!hasProvider) {
    throw new Error('At least one LLM API key required (GROQ_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY)');
  }

  log(`[enrich-free] Providers available: ${PROVIDERS.filter(p => process.env[p.envKey]).map(p => p.name).join(', ')}`);

  // Fetch grants needing enrichment — prioritize non-ARC (they need it more)
  let query = supabase
    .from('grant_opportunities')
    .select('id, name, url, source, description')
    .not('url', 'is', null)
    .is('enriched_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Optional source filter
  if (options.source) {
    query = query.eq('source', options.source);
  }

  const { data: grants, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch grants for enrichment: ${error.message}`);
  }

  if (!grants || grants.length === 0) {
    log('[enrich-free] No grants need enrichment');
    return { enriched: 0, scraped: 0, errors: 0, skipped: 0 };
  }

  // Sort: grants with no description first, then short descriptions
  const sorted = grants.sort((a, b) => {
    const aLen = (a.description || '').length;
    const bLen = (b.description || '').length;
    return aLen - bLen;
  });

  log(`[enrich-free] ${sorted.length} grants to process`);

  let enriched = 0;
  let scraped = 0;
  let errors = 0;
  let skipped = 0;

  for (const grant of sorted) {
    if (!grant.url) {
      skipped++;
      continue;
    }

    try {
      const result = await enrichGrantFree(
        { name: grant.name, url: grant.url, source: grant.source },
        log,
      );

      if (!result.description && result.eligibility_criteria.length === 0) {
        // Nothing extracted — still mark as attempted so we don't retry
        await supabase
          .from('grant_opportunities')
          .update({ enriched_at: new Date().toISOString() })
          .eq('id', grant.id);
        skipped++;
        continue;
      }

      scraped++;

      // Build update object — only set fields that have values
      const update: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      };

      if (result.description && (!grant.description || grant.description.length < result.description.length)) {
        update.description = result.description;
      }
      if (result.eligibility_criteria.length > 0) {
        update.eligibility_criteria = result.eligibility_criteria;
      }
      if (result.target_recipients.length > 0) {
        update.target_recipients = result.target_recipients;
      }
      // Only update deadline/amounts if the grant doesn't already have them
      if (result.deadline) {
        update.closes_at = result.deadline;
      }
      if (result.amount_min) {
        update.amount_min = result.amount_min;
      }
      if (result.amount_max) {
        update.amount_max = result.amount_max;
      }

      const { error: updateError } = await supabase
        .from('grant_opportunities')
        .update(update)
        .eq('id', grant.id);

      if (updateError) {
        log(`[enrich-free] DB error for "${grant.name.slice(0, 60)}": ${updateError.message}`);
        errors++;
      } else {
        enriched++;
        if (enriched % 10 === 0 || enriched === 1) {
          log(`[enrich-free] Progress: ${enriched} enriched, ${scraped} scraped, ${skipped} skipped, ${errors} errors (${enriched + skipped + errors}/${sorted.length})`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[enrich-free] Error: "${grant.name.slice(0, 60)}": ${msg}`);
      errors++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }

  log(`[enrich-free] Complete: ${enriched} enriched, ${scraped} scraped, ${skipped} skipped, ${errors} errors`);
  return { enriched, scraped, errors, skipped };
}
