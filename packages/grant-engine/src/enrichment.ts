/**
 * Grant Enrichment Service
 *
 * Uses Claude Haiku to extract structured eligibility criteria and
 * target recipients from grant descriptions. Runs async post-discovery
 * so it doesn't slow down the import pipeline.
 *
 * Cost: ~$0.001/grant with Haiku
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const ENRICHMENT_MODEL = 'claude-haiku-4-5-20251001';
const RATE_LIMIT_DELAY_MS = 1000;

interface EnrichmentResult {
  eligibility_criteria: string[];
  target_recipients: string[];
}

/**
 * Extract eligibility criteria and target recipients from a grant description
 * using Claude Haiku.
 */
export async function enrichGrant(
  name: string,
  description: string,
  apiKey?: string,
): Promise<EnrichmentResult> {
  const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: ENRICHMENT_MODEL,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Extract eligibility criteria and target recipients from this Australian grant.

Grant: ${name}
Description: ${description}

Return JSON only, no explanation:
{
  "eligibility_criteria": ["criterion 1", "criterion 2"],
  "target_recipients": ["recipient type 1", "recipient type 2"]
}

If unclear, return empty arrays. Keep each item concise (under 100 chars).`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { eligibility_criteria: [], target_recipients: [] };

    const parsed = JSON.parse(jsonMatch[0]) as EnrichmentResult;
    return {
      eligibility_criteria: Array.isArray(parsed.eligibility_criteria) ? parsed.eligibility_criteria : [],
      target_recipients: Array.isArray(parsed.target_recipients) ? parsed.target_recipients : [],
    };
  } catch {
    return { eligibility_criteria: [], target_recipients: [] };
  }
}

/**
 * Batch-enrich grants that haven't been enriched yet.
 */
export async function batchEnrich(
  supabase: SupabaseClient,
  options: {
    apiKey?: string;
    limit?: number;
    onProgress?: (message: string) => void;
  } = {},
): Promise<{ enriched: number; errors: number }> {
  const log = options.onProgress || console.log;
  const limit = options.limit || 500;

  // Fetch grants that need enrichment
  const { data: grants, error } = await supabase
    .from('grant_opportunities')
    .select('id, name, description')
    .is('enriched_at', null)
    .not('description', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch grants for enrichment: ${error.message}`);
  }

  if (!grants || grants.length === 0) {
    log('[enrichment] All grants already enriched');
    return { enriched: 0, errors: 0 };
  }

  log(`[enrichment] ${grants.length} grants need enrichment`);

  let enriched = 0;
  let errors = 0;

  for (const grant of grants) {
    try {
      const result = await enrichGrant(grant.name, grant.description || '', options.apiKey);

      const { error: updateError } = await supabase
        .from('grant_opportunities')
        .update({
          eligibility_criteria: result.eligibility_criteria,
          target_recipients: result.target_recipients,
          enriched_at: new Date().toISOString(),
        })
        .eq('id', grant.id);

      if (updateError) {
        log(`[enrichment] Update error for "${grant.name}": ${updateError.message}`);
        errors++;
      } else {
        enriched++;
        if (enriched % 10 === 0) {
          log(`[enrichment] Progress: ${enriched}/${grants.length}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[enrichment] Error enriching "${grant.name}": ${msg}`);
      errors++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }

  log(`[enrichment] Complete: ${enriched} enriched, ${errors} errors`);
  return { enriched, errors };
}
