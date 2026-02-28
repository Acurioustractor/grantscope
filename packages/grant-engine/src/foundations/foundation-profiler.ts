/**
 * Foundation Profiler — Multi-Provider
 *
 * Round-robins across all available LLM providers to avoid quota limits.
 * Providers: OpenAI, Anthropic, Groq, Perplexity
 * Falls back automatically on quota/rate errors.
 */

import type { Foundation } from './types.js';
import type { ScrapedFoundationData } from './annual-report-scraper.js';

export interface EnrichedProfile {
  description: string | null;
  thematic_focus: string[];
  geographic_focus: string[];
  target_recipients: string[];
  total_giving_annual: number | null;
  avg_grant_size: number | null;
  grant_range_min: number | null;
  grant_range_max: number | null;
  giving_history: Array<{ year: number; amount: number }> | null;
  giving_ratio: number | null;
  endowment_size: number | null;
  revenue_sources: string[];
  parent_company: string | null;
  asx_code: string | null;
  open_programs: Array<{
    name: string;
    url?: string;
    amount?: number;
    deadline?: string;
    description?: string;
  }> | null;
  profile_confidence: 'low' | 'medium' | 'high';

  // Rich fields
  giving_philosophy: string | null;
  wealth_source: string | null;
  application_tips: string | null;
  notable_grants: string[] | null;
  board_members: string[] | null;
}

type ProviderName = 'openai' | 'anthropic' | 'groq' | 'perplexity' | 'minimax';

interface ProviderConfig {
  name: ProviderName;
  envKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  supportsJsonMode: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 4000,
    supportsJsonMode: true,
  },
  {
    name: 'minimax',
    envKey: 'MINIMAX_API_KEY',
    baseUrl: 'https://api.minimax.io/v1/chat/completions',
    model: 'MiniMax-M2.5',
    maxTokens: 4000,
    supportsJsonMode: false, // M2.5 reasoning model, parse JSON from response
  },
  {
    name: 'openai',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    maxTokens: 4000,
    supportsJsonMode: true,
  },
  {
    name: 'perplexity',
    envKey: 'PERPLEXITY_API_KEY',
    baseUrl: 'https://api.perplexity.ai/chat/completions',
    model: 'sonar-pro',
    maxTokens: 4000,
    supportsJsonMode: false,
  },
  {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: '', // Uses SDK
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4000,
    supportsJsonMode: false,
  },
];

interface ProfilerConfig {
  provider?: ProviderName;
  model?: string;
  maxTokens?: number;
}

export class FoundationProfiler {
  private availableProviders: ProviderConfig[];
  private callIndex = 0;
  private disabledProviders = new Set<ProviderName>();

  constructor(config: ProfilerConfig = {}) {
    if (config.provider) {
      // Single provider mode
      const p = PROVIDERS.find(p => p.name === config.provider);
      if (!p) throw new Error(`Unknown provider: ${config.provider}`);
      this.availableProviders = [{ ...p, model: config.model || p.model, maxTokens: config.maxTokens || p.maxTokens }];
    } else {
      // Auto-detect all available providers
      this.availableProviders = PROVIDERS.filter(p => process.env[p.envKey]).map(p => ({
        ...p,
        model: config.model || p.model,
        maxTokens: config.maxTokens || p.maxTokens,
      }));
    }

    if (this.availableProviders.length === 0) {
      throw new Error('No LLM API keys found. Set OPENAI_API_KEY, GROQ_API_KEY, PERPLEXITY_API_KEY, or ANTHROPIC_API_KEY');
    }

    console.log(`[profiler] Providers available: ${this.availableProviders.map(p => p.name).join(', ')}`);
  }

  private getNextProvider(): ProviderConfig | null {
    const active = this.availableProviders.filter(p => !this.disabledProviders.has(p.name));
    if (active.length === 0) return null;
    const provider = active[this.callIndex % active.length];
    this.callIndex++;
    return provider;
  }

  private buildPrompt(foundation: Foundation, content: string): string {
    return `You are analyzing an Australian philanthropic foundation to build a comprehensive profile.

## Foundation Information (from ACNC Register)
- **Name**: ${foundation.name}
- **ABN**: ${foundation.acnc_abn}
- **Type**: ${foundation.type || 'Unknown'}
- **Website**: ${foundation.website || 'None'}
- **Size**: ${foundation.total_giving_annual ? `~$${foundation.total_giving_annual.toLocaleString()}/year estimated` : 'Unknown'}
- **Geographic focus**: ${foundation.geographic_focus?.join(', ') || 'Unknown'}
- **Thematic focus from ACNC**: ${foundation.thematic_focus?.join(', ') || 'None identified'}

## Scraped Website Content
${content || 'No website content available.'}

---

Based on ALL available information, build a comprehensive foundation profile. Return ONLY a JSON object (no markdown):

{
  "description": "2-3 sentence description of who they are and what they do",
  "giving_philosophy": "How they approach giving, what they believe in, their theory of change",
  "wealth_source": "How the founder(s) made their money — industry, company, inheritance, etc.",
  "thematic_focus": ["arts", "indigenous", "health", "education", "environment", "community", "research", "human_rights", "youth", "aged_care", "disability", "rural_remote"],
  "geographic_focus": ["AU-National", "AU-QLD", "AU-NSW", "AU-VIC", etc. or "International"],
  "target_recipients": ["nfp", "individual", "research", "community_org", "school", "hospital", "university"],
  "total_giving_annual": null or number in AUD,
  "avg_grant_size": null or number in AUD,
  "grant_range_min": null or number in AUD,
  "grant_range_max": null or number in AUD,
  "giving_history": null or [{"year": 2024, "amount": 500000}],
  "giving_ratio": null or percentage (giving / total revenue),
  "endowment_size": null or number in AUD,
  "revenue_sources": ["mining", "property", "finance", "retail", "tech", "agriculture", "media", "inherited"],
  "parent_company": null or "Company Name",
  "asx_code": null or "ASX",
  "open_programs": [{"name": "Program Name", "url": "...", "amount": 50000, "deadline": "2026-06-30", "description": "What it funds"}] or null,
  "application_tips": "Practical advice for applicants based on what we learned about this foundation",
  "notable_grants": ["$X to Org for purpose", ...] or null,
  "board_members": ["Name - Role", ...] or null,
  "profile_confidence": "low" if mostly guessing, "medium" if some data, "high" if rich data
}

Rules:
- Use null for anything you can't determine from the data
- Only include thematic_focus categories that are clearly supported
- For giving amounts, use AUD
- Be specific in descriptions — don't use generic platitudes
- If no website content was scraped, work with ACNC data only and set confidence to "low"`;
  }

  /**
   * Call any OpenAI-compatible API (OpenAI, Groq, Perplexity).
   */
  private async callOpenAICompatible(prompt: string, provider: ProviderConfig): Promise<string> {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) throw new Error(`${provider.envKey} required`);

    const body: Record<string, unknown> = {
      model: provider.model,
      max_tokens: provider.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };

    if (provider.supportsJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(provider.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      // Check for quota/rate limit errors
      if (response.status === 429 || err.includes('insufficient_quota') || err.includes('rate_limit') || err.includes('insufficient_balance')) {
        throw new Error(`QUOTA:${provider.name}:${response.status}: ${err.slice(0, 200)}`);
      }
      throw new Error(`${provider.name} API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    let content = data.choices[0]?.message?.content || '';

    // Strip <think> blocks from reasoning models (Minimax M2.5, DeepSeek, etc.)
    content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();

    return content;
  }

  private async callAnthropic(prompt: string, provider: ProviderConfig): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: provider.model,
      max_tokens: provider.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n');
  }

  /**
   * Call an LLM with automatic provider rotation and fallback.
   */
  private async callLLM(prompt: string): Promise<string> {
    const triedProviders: string[] = [];

    for (let attempt = 0; attempt < this.availableProviders.length; attempt++) {
      const provider = this.getNextProvider();
      if (!provider) break;

      triedProviders.push(provider.name);

      try {
        if (provider.name === 'anthropic') {
          return await this.callAnthropic(prompt, provider);
        } else {
          return await this.callOpenAICompatible(prompt, provider);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.startsWith('QUOTA:')) {
          // Disable this provider for the rest of the session
          console.log(`[profiler]     ${provider.name} quota exceeded — disabling, trying next provider`);
          this.disabledProviders.add(provider.name);
          continue;
        }

        // For other errors, try next provider
        console.log(`[profiler]     ${provider.name} error: ${msg.slice(0, 100)} — trying next`);
        continue;
      }
    }

    throw new Error(`All providers failed (tried: ${triedProviders.join(', ')})`);
  }

  /**
   * Build a rich profile from ACNC data + scraped website content.
   */
  async profileFoundation(
    foundation: Foundation,
    scraped: ScrapedFoundationData,
  ): Promise<EnrichedProfile> {
    const allContent = [
      scraped.websiteContent,
      scraped.aboutContent,
      scraped.programsContent,
      scraped.annualReportContent,
    ].filter(Boolean).join('\n\n---\n\n');

    // Truncate to ~50K chars to fit in context
    const content = allContent.slice(0, 50000);
    const prompt = this.buildPrompt(foundation, content);

    try {
      const text = await this.callLLM(prompt);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackProfile(foundation);
      }

      let jsonStr = jsonMatch[0];
      // Fix common JSON issues from LLMs
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'); // trailing commas
      jsonStr = jsonStr.replace(/[\x00-\x1f]/g, ' '); // control characters
      // Fix unescaped newlines inside strings
      jsonStr = jsonStr.replace(/(?<="[^"]*)\n(?=[^"]*")/g, '\\n');
      // Fix single-quoted strings (convert to double)
      jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');

      let parsed: EnrichedProfile;
      try {
        parsed = JSON.parse(jsonStr) as EnrichedProfile;
      } catch {
        // Try to extract just the first complete JSON object, respecting strings
        let depth = 0;
        let end = -1;
        let inString = false;
        let escaped = false;
        for (let i = 0; i < jsonStr.length; i++) {
          const ch = jsonStr[i];
          if (escaped) { escaped = false; continue; }
          if (ch === '\\') { escaped = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end > 0) {
          let extracted = jsonStr.slice(0, end + 1);
          // One more cleanup pass
          extracted = extracted.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          try {
            parsed = JSON.parse(extracted) as EnrichedProfile;
          } catch {
            // Last resort: try to fix common issues and parse again
            extracted = extracted.replace(/"\s*\n\s*"/g, '", "'); // newlines between array elements
            parsed = JSON.parse(extracted) as EnrichedProfile;
          }
        } else {
          return this.fallbackProfile(foundation);
        }
      }
      return {
        description: parsed.description || null,
        thematic_focus: parsed.thematic_focus || foundation.thematic_focus || [],
        geographic_focus: parsed.geographic_focus || foundation.geographic_focus || [],
        target_recipients: parsed.target_recipients || [],
        total_giving_annual: parsed.total_giving_annual || foundation.total_giving_annual,
        avg_grant_size: parsed.avg_grant_size || null,
        grant_range_min: parsed.grant_range_min || foundation.grant_range_min,
        grant_range_max: parsed.grant_range_max || foundation.grant_range_max,
        giving_history: parsed.giving_history || null,
        giving_ratio: parsed.giving_ratio || null,
        endowment_size: parsed.endowment_size || null,
        revenue_sources: parsed.revenue_sources || [],
        parent_company: parsed.parent_company || null,
        asx_code: parsed.asx_code || null,
        open_programs: parsed.open_programs || null,
        profile_confidence: parsed.profile_confidence || 'medium',
        giving_philosophy: parsed.giving_philosophy || null,
        wealth_source: parsed.wealth_source || null,
        application_tips: parsed.application_tips || null,
        notable_grants: parsed.notable_grants || null,
        board_members: parsed.board_members || null,
      };
    } catch (err) {
      console.error(`[profiler] Error profiling ${foundation.name}: ${err instanceof Error ? err.message : String(err)}`);
      return this.fallbackProfile(foundation);
    }
  }

  private fallbackProfile(foundation: Foundation): EnrichedProfile {
    return {
      description: null,
      thematic_focus: foundation.thematic_focus || [],
      geographic_focus: foundation.geographic_focus || [],
      target_recipients: foundation.target_recipients || [],
      total_giving_annual: foundation.total_giving_annual,
      avg_grant_size: null,
      grant_range_min: foundation.grant_range_min,
      grant_range_max: foundation.grant_range_max,
      giving_history: null,
      giving_ratio: null,
      endowment_size: null,
      revenue_sources: [],
      parent_company: null,
      asx_code: null,
      open_programs: null,
      profile_confidence: 'low',
      giving_philosophy: null,
      wealth_source: null,
      application_tips: null,
      notable_grants: null,
      board_members: null,
    };
  }
}
