/**
 * Foundation Profiler
 *
 * Uses Claude to synthesize scraped website data + ACNC records into
 * rich foundation profiles. Extracts:
 * - Giving philosophy and approach
 * - Focus areas with confidence levels
 * - Open programs and how to apply
 * - Source of wealth / how they make money
 * - Giving history and patterns
 * - Grant size ranges and typical recipients
 */

import Anthropic from '@anthropic-ai/sdk';
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

  // New rich fields stored in acnc_data or separate
  giving_philosophy: string | null;
  wealth_source: string | null;
  application_tips: string | null;
  notable_grants: string[] | null;
  board_members: string[] | null;
}

interface ProfilerConfig {
  model?: string;
  maxTokens?: number;
}

export class FoundationProfiler {
  private anthropic: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: ProfilerConfig = {}) {
    this.anthropic = new Anthropic();
    this.model = config.model || 'claude-sonnet-4-5-20250929';
    this.maxTokens = config.maxTokens || 4000;
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

    const prompt = `You are analyzing an Australian philanthropic foundation to build a comprehensive profile.

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

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackProfile(foundation);
      }

      const parsed = JSON.parse(jsonMatch[0]) as EnrichedProfile;
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
