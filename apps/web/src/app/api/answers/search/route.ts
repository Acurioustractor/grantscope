import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { embedQuery } from '@grant-engine/embeddings';

export async function POST(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const db = getServiceSupabase();

  // Get org profile
  const { data: own } = await db
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  let orgId = own?.id;
  if (!orgId) {
    const { data: member } = await db
      .from('org_members')
      .select('org_profile_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    orgId = member?.org_profile_id;
  }

  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const body = await request.json();
  const { query, limit = 5 } = body;

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'query must be at least 3 characters' }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    // Fallback to text search
    const { data, error } = await db
      .from('grant_answer_bank')
      .select('id, question, answer, category, tags, use_count')
      .eq('org_profile_id', orgId)
      .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: (data || []).map(d => ({ ...d, similarity: null })) });
  }

  const queryEmbedding = await embedQuery(query, process.env.OPENAI_API_KEY);

  // Vector similarity search — use raw SQL since supabase-js doesn't have a built-in cosine similarity operator for custom tables
  const { data, error } = await db.rpc('match_answer_bank', {
    p_org_profile_id: orgId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_count: Math.min(limit, 20),
    p_match_threshold: 0.5,
  });

  if (error) {
    // Fallback to text search if RPC doesn't exist yet
    if (error.message.includes('match_answer_bank')) {
      const { data: textData, error: textError } = await db
        .from('grant_answer_bank')
        .select('id, question, answer, category, tags, use_count')
        .eq('org_profile_id', orgId)
        .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
        .limit(limit);

      if (textError) return NextResponse.json({ error: textError.message }, { status: 500 });
      return NextResponse.json({ results: (textData || []).map(d => ({ ...d, similarity: null })) });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data || [] });
}
