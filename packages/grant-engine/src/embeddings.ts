/**
 * Grant Embedding Service
 *
 * Generates vector embeddings for grants using OpenAI text-embedding-3-small.
 * One vector per grant — descriptions are short enough that no chunking is needed.
 *
 * Cost: ~$0.02 for 500 grants ($0.02/1M tokens)
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 2000;

interface GrantForEmbedding {
  id: string;
  name: string;
  provider: string;
  program: string | null;
  description: string | null;
  categories: string[];
}

/**
 * Build composite text for embedding from grant fields.
 * Concatenates name + provider + program + description + categories.
 */
export function buildEmbeddingText(grant: GrantForEmbedding): string {
  const parts = [
    grant.name,
    grant.provider,
    grant.program,
    grant.description,
    grant.categories?.length ? `Categories: ${grant.categories.join(', ')}` : null,
  ].filter(Boolean);

  return parts.join('\n').slice(0, 8000); // Stay well within token limits
}

/**
 * Generate embeddings for an array of texts using OpenAI.
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey?: string,
): Promise<number[][]> {
  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data.map(d => d.embedding);
}

/**
 * Embed a single query string for semantic search.
 */
export async function embedQuery(
  query: string,
  apiKey?: string,
): Promise<number[]> {
  const embeddings = await generateEmbeddings([query], apiKey);
  return embeddings[0];
}

/**
 * Backfill embeddings for all grants that don't have one yet.
 * Processes in batches of 100 with delays between batches.
 */
export async function backfillEmbeddings(
  supabase: SupabaseClient,
  options: {
    apiKey?: string;
    batchSize?: number;
    onProgress?: (message: string) => void;
  } = {},
): Promise<{ embedded: number; errors: number }> {
  const batchSize = options.batchSize || BATCH_SIZE;
  const log = options.onProgress || console.log;

  // Fetch grants without embeddings (paginate past Supabase 1000-row default)
  const allGrants: GrantForEmbedding[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data: page, error } = await supabase
      .from('grant_opportunities')
      .select('id, name, provider, program, description, categories')
      .is('embedding', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch grants for embedding: ${error.message}`);
    }

    if (!page || page.length === 0) break;
    allGrants.push(...(page as GrantForEmbedding[]));
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  const grants = allGrants;

  if (grants.length === 0) {
    log('[embeddings] All grants already have embeddings');
    return { embedded: 0, errors: 0 };
  }

  log(`[embeddings] ${grants.length} grants need embeddings`);

  let embedded = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < grants.length; i += batchSize) {
    const batch = grants.slice(i, i + batchSize) as GrantForEmbedding[];
    const texts = batch.map(buildEmbeddingText);

    try {
      const embeddings = await generateEmbeddings(texts, options.apiKey);

      // Update each grant with its embedding
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabase
          .from('grant_opportunities')
          .update({
            embedding: JSON.stringify(embeddings[j]),
            embedding_model: EMBEDDING_MODEL,
            embedded_at: new Date().toISOString(),
          })
          .eq('id', batch[j].id);

        if (updateError) {
          log(`[embeddings] Error updating ${batch[j].name}: ${updateError.message}`);
          errors++;
        } else {
          embedded++;
        }
      }

      log(`[embeddings] Batch ${Math.floor(i / batchSize) + 1}: embedded ${batch.length} grants (${embedded}/${grants.length})`);

      // Delay between batches to respect rate limits
      if (i + batchSize < grants.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[embeddings] Batch error: ${msg}`);
      errors += batch.length;
    }
  }

  log(`[embeddings] Complete: ${embedded} embedded, ${errors} errors`);
  return { embedded, errors };
}

/**
 * Search grants using vector similarity.
 * Calls the search_grants_semantic Postgres function.
 */
export async function searchGrantsSemantic(
  supabase: SupabaseClient,
  query: string,
  options: {
    apiKey?: string;
    matchThreshold?: number;
    matchCount?: number;
    category?: string;
    grantType?: string;
  } = {},
): Promise<Array<{
  id: string;
  name: string;
  provider: string;
  description: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  categories: string[];
  grant_type: string;
  similarity: number;
}>> {
  const queryEmbedding = await embedQuery(query, options.apiKey);

  const { data, error } = await supabase.rpc('search_grants_semantic', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: options.matchThreshold ?? 0.7,
    match_count: options.matchCount ?? 20,
  });

  if (error) {
    throw new Error(`Semantic search failed: ${error.message}`);
  }

  let results = data || [];

  // Apply post-filters
  if (options.category) {
    results = results.filter((r: { categories: string[] }) =>
      r.categories?.includes(options.category!)
    );
  }

  if (options.grantType && options.grantType !== 'all') {
    results = results.filter((r: { grant_type: string }) =>
      r.grant_type === options.grantType
    );
  }

  return results;
}
