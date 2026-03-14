import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { generateEmbeddings } from '@grant-engine/embeddings';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim() || '';
  const threshold = parseFloat(searchParams.get('threshold') || '0.5');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 30);

  if (!q || q.length < 3) {
    return NextResponse.json(
      { error: 'Query must be at least 3 characters' },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Semantic search not configured' },
      { status: 503 },
    );
  }

  try {
    // Generate query embedding
    const [queryEmbedding] = await generateEmbeddings([q], process.env.OPENAI_API_KEY);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const supabase = getServiceSupabase();

    // Parallel semantic search across all three tables
    const grantsPromise = (async () => {
      try {
        return await supabase.rpc('search_grants_semantic', {
          query_embedding: embeddingStr,
          match_threshold: threshold,
          match_count: limit,
        });
      } catch {
        return { data: null, error: null }; // graceful fallback if RPC doesn't exist yet
      }
    })();

    const [entitiesRes, foundationsRes, grantsRes] = await Promise.all([
      supabase.rpc('search_entities_semantic', {
        query_embedding: embeddingStr,
        match_threshold: threshold,
        match_count: limit,
      }),
      supabase.rpc('search_foundations_semantic', {
        query_embedding: embeddingStr,
        match_threshold: threshold,
        match_count: limit,
      }),
      grantsPromise,
    ]);

    const entities = (entitiesRes.data || []).map((e: Record<string, unknown>) => ({
      type: 'entity' as const,
      id: e.gs_id,
      name: e.canonical_name,
      entityType: e.entity_type,
      abn: e.abn,
      state: e.state,
      sourceCount: e.source_count,
      revenue: e.latest_revenue,
      similarity: e.similarity,
      href: `/entities/${e.gs_id}`,
    }));

    const foundations = (foundationsRes.data || []).map((f: Record<string, unknown>) => ({
      type: 'foundation' as const,
      id: f.id,
      name: f.name,
      abn: f.acnc_abn,
      totalGiving: f.total_giving_annual,
      focus: f.thematic_focus,
      similarity: f.similarity,
      href: `/foundations/${f.id}`,
    }));

    const grants = (grantsRes.data || []).map((g: Record<string, unknown>) => ({
      type: 'grant' as const,
      id: g.id,
      name: g.name,
      provider: g.provider,
      similarity: g.similarity,
      href: `/grants/${g.id}`,
    }));

    return NextResponse.json({
      entities,
      foundations,
      grants,
      method: 'semantic',
      query: q,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    console.error('[universal-search]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
