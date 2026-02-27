/**
 * LLM Knowledge Source Plugin
 *
 * Uses Claude's training knowledge to surface grants from portals
 * that block web search. No verified URLs — confidence: 'llm_knowledge'.
 * Ported from scripts/lib/grant-sources.mjs.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

export interface LLMSource {
  name: string;
  url: string;
  categories: string[];
  keywords: string[];
}

interface LLMKnowledgeConfig {
  model?: string;
  maxTokens?: number;
  requestDelayMs?: number;
  sources?: LLMSource[];
}

const DEFAULT_AU_SOURCES: LLMSource[] = [
  {
    name: 'GrantConnect',
    url: 'https://www.grants.gov.au/',
    categories: ['justice', 'indigenous', 'community', 'health', 'enterprise'],
    keywords: ['youth justice', 'Indigenous', 'community development', 'social enterprise', 'NFP', 'capacity building'],
  },
  {
    name: 'Philanthropy Australia',
    url: 'https://www.philanthropy.org.au/',
    categories: ['community', 'indigenous', 'arts', 'enterprise'],
    keywords: ['foundation grants', 'philanthropic funding', 'social impact', 'community', 'Indigenous', 'arts culture'],
  },
];

export function createLLMKnowledgePlugin(config: LLMKnowledgeConfig = {}): SourcePlugin {
  const anthropic = new Anthropic();
  const model = config.model || 'claude-3-5-haiku-20241022';
  const maxTokens = config.maxTokens || 2000;
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
    id: 'llm-knowledge',
    name: 'LLM Knowledge',
    type: 'llm_knowledge',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      const sources = config.sources || DEFAULT_AU_SOURCES;
      const year = new Date().getFullYear();

      for (const source of sources) {
        await rateLimit();

        const categories = query.categories?.length
          ? query.categories
          : source.categories;
        const keywords = query.keywords?.length
          ? query.keywords
          : source.keywords;

        const prompt = `You are a grants research assistant. Search your knowledge for currently open or upcoming grant opportunities from ${source.name} (${source.url}).

Focus on grants relevant to these categories: ${categories.join(', ')}
Keywords: ${keywords.join(', ')}
${query.geography?.length ? `Geography: ${query.geography.join(', ')}` : ''}

For each grant found, provide structured JSON. Return ONLY a JSON array (no markdown):
[{
  "name": "Grant Program Name",
  "provider": "${source.name}",
  "program": "Specific program/stream name",
  "amountMin": 10000,
  "amountMax": 50000,
  "closesAt": "${year}-06-30",
  "url": null,
  "description": "Brief description of what it funds",
  "categories": ["indigenous", "arts"]
}]

Rules:
- Only include grants that are likely OPEN or UPCOMING in ${year}
- Use null for unknown amounts or dates
- Return [] if you don't know of any current grants from this source
- Set url to null — do NOT make up URLs`;

        try {
          const response = await anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          });

          const text = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map(b => b.text)
            .join('\n');

          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (!jsonMatch) continue;

          const grants = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;

          for (const g of grants) {
            if (!g.name || !g.provider) continue;
            yield {
              title: g.name as string,
              provider: (g.provider as string) || source.name,
              sourceUrl: (g.url as string) || undefined,
              amount: {
                min: (g.amountMin as number) || undefined,
                max: (g.amountMax as number) || undefined,
              },
              deadline: (g.closesAt as string) || undefined,
              description: (g.description as string) || undefined,
              categories: (g.categories as string[]) || [],
              program: (g.program as string) || undefined,
              sourceId: 'llm-knowledge',
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[llm-knowledge] Error searching ${source.name}: ${msg}`);
        }
      }
    },
  };
}
