import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { searchGrantsSemantic } from '@grant-engine/embeddings';

export async function GET(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || undefined;
  const grantType = searchParams.get('type') || undefined;
  const threshold = parseFloat(searchParams.get('threshold') || '0.7');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

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
    const supabase = getServiceSupabase();
    const results = await searchGrantsSemantic(supabase, q, {
      apiKey: process.env.OPENAI_API_KEY,
      matchThreshold: threshold,
      matchCount: limit,
      category,
      grantType,
    });

    return NextResponse.json({
      results,
      count: results.length,
      method: 'semantic',
      query: q,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    console.error('[semantic-search]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
