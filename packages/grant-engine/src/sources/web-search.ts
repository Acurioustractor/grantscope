/**
 * Web Search Source Plugin
 *
 * Uses Anthropic's web_search tool to find real, currently open grants.
 * Ported from scripts/lib/grant-sources.mjs — now configurable per-query.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

interface WebSearchConfig {
  model?: string;
  maxSearchUses?: number;
  requestDelayMs?: number;
  searchQueries?: Array<{ name: string; query: string }>;
}

const DEFAULT_AU_QUERIES = [
  { name: 'Federal Indigenous Grants', query: 'site:grants.gov.au OR site:niaa.gov.au Indigenous First Nations grants open Queensland' },
  { name: 'QLD Government Grants', query: 'site:qld.gov.au grants open applications community NFP not-for-profit' },
  { name: 'Arts Grants Australia', query: 'site:arts.qld.gov.au OR site:australiacouncil.gov.au grants open First Nations arts community' },
  { name: 'Foundation Grants', query: 'Australia foundation grants open Indigenous community social enterprise Queensland NFP' },
  { name: 'Environment & Land Grants', query: 'Australia grants open regenerative agriculture environment Indigenous land management Queensland' },
  { name: 'Social Enterprise Grants', query: 'Australia social enterprise grants circular economy community development Indigenous' },
  { name: 'Justice Innovation Grants', query: 'Australia youth justice innovation grants First Nations community-led' },
];

function buildSearchPrompt(searchQuery: string, query: DiscoveryQuery): string {
  const year = new Date().getFullYear();
  const geo = query.geography?.join(', ') || 'Australia';
  const cats = query.categories?.join(', ') || 'community, arts, indigenous, environment, social enterprise';

  return `Search for currently open grant opportunities: "${searchQuery}"

Find grants that are CURRENTLY OPEN for applications in ${year}. Focus on:
- Grants in: ${geo}
- Categories: ${cats}
${query.keywords?.length ? `- Keywords: ${query.keywords.join(', ')}` : ''}

For each grant found, extract:
- Exact name
- Provider/funder
- Amount range
- Closing date
- Application URL (MUST be a real, working URL you found)
- Brief description

Return ONLY a JSON array (no markdown, no explanation):
[{
  "name": "Grant Name",
  "provider": "Funder Name",
  "program": "Program stream if applicable",
  "amountMin": null,
  "amountMax": 50000,
  "closesAt": "2026-06-30",
  "url": "https://real-url-found-in-search.gov.au/...",
  "description": "What it funds",
  "categories": ["indigenous", "community"]
}]

Rules:
- ONLY include grants you verified are currently open via web search
- Every grant MUST have a real URL (not hallucinated)
- Use null for unknown amounts
- Return [] if no current grants found`;
}

export function createWebSearchPlugin(config: WebSearchConfig = {}): SourcePlugin {
  const anthropic = new Anthropic();
  const model = config.model || 'claude-sonnet-4-5-20250929';
  const maxUses = config.maxSearchUses || 5;
  const delayMs = config.requestDelayMs || 1000;
  let lastRequest = 0;

  async function rateLimit() {
    const elapsed = Date.now() - lastRequest;
    if (elapsed < delayMs) {
      await new Promise(r => setTimeout(r, delayMs - elapsed));
    }
    lastRequest = Date.now();
  }

  return {
    id: 'web-search',
    name: 'AI Web Search',
    type: 'ai_search',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      const searches = config.searchQueries || DEFAULT_AU_QUERIES;

      // If query has keywords, add a custom search
      const customSearches = [...searches];
      if (query.keywords?.length) {
        customSearches.push({
          name: 'Custom Search',
          query: query.keywords.join(' ') + ' grants open Australia',
        });
      }

      for (const search of customSearches) {
        await rateLimit();

        try {
          const response = await anthropic.messages.create({
            model,
            max_tokens: 4000,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses } as unknown as Anthropic.Tool],
            messages: [{
              role: 'user',
              content: buildSearchPrompt(search.query, query),
            }],
          });

          const textBlocks = response.content.filter(
            (b): b is Anthropic.TextBlock => b.type === 'text'
          );
          const text = textBlocks.map(b => b.text).join('\n');
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (!jsonMatch) continue;

          const grants = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;

          for (const g of grants) {
            if (!g.name || !g.url) continue;
            yield {
              title: g.name as string,
              provider: (g.provider as string) || search.name,
              sourceUrl: g.url as string,
              amount: {
                min: (g.amountMin as number) || undefined,
                max: (g.amountMax as number) || undefined,
              },
              deadline: (g.closesAt as string) || undefined,
              description: (g.description as string) || undefined,
              categories: (g.categories as string[]) || [],
              program: (g.program as string) || undefined,
              sourceId: 'web-search',
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[web-search] Error searching "${search.name}": ${msg}`);
        }
      }
    },
  };
}
