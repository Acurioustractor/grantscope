import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { embedQuery } from '@grant-engine/embeddings';
import { getEffectiveOrgId } from '@/lib/org-profile';

export async function GET(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const db = getServiceSupabase();
  const orgId = await getEffectiveOrgId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');

  let query = db
    .from('grant_answer_bank')
    .select('id, question, answer, category, tags, source_application, use_count, last_used_at, created_at, updated_at')
    .eq('org_profile_id', orgId)
    .order('updated_at', { ascending: false });

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ answers: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const db = getServiceSupabase();
  const orgId = await getEffectiveOrgId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const body = await request.json();
  const { question, answer, category, tags, source_application } = body;

  if (!question || !answer) {
    return NextResponse.json({ error: 'question and answer are required' }, { status: 400 });
  }

  // Generate embedding for the Q&A pair
  let embedding = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      embedding = await embedQuery(`${question}\n${answer}`, process.env.OPENAI_API_KEY);
    } catch (err) {
      console.error('[answers] Embedding generation failed:', err);
    }
  }

  const { data, error } = await db
    .from('grant_answer_bank')
    .insert({
      org_profile_id: orgId,
      question,
      answer,
      category: category || null,
      tags: tags || [],
      source_application: source_application || null,
      embedding: embedding ? JSON.stringify(embedding) : null,
    })
    .select('id, question, answer, category, tags, source_application, use_count, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ answer: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const db = getServiceSupabase();
  const orgId = await getEffectiveOrgId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const body = await request.json();
  const { id, question, answer, category, tags } = body;

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (question !== undefined) updates.question = question;
  if (answer !== undefined) updates.answer = answer;
  if (category !== undefined) updates.category = category;
  if (tags !== undefined) updates.tags = tags;

  // Re-generate embedding if question or answer changed
  if ((question || answer) && process.env.OPENAI_API_KEY) {
    try {
      const { data: existing } = await db
        .from('grant_answer_bank')
        .select('question, answer')
        .eq('id', id)
        .eq('org_profile_id', orgId)
        .single();

      if (existing) {
        const q = question || existing.question;
        const a = answer || existing.answer;
        const emb = await embedQuery(`${q}\n${a}`, process.env.OPENAI_API_KEY);
        updates.embedding = JSON.stringify(emb);
      }
    } catch (err) {
      console.error('[answers] Embedding update failed:', err);
    }
  }

  const { data, error } = await db
    .from('grant_answer_bank')
    .update(updates)
    .eq('id', id)
    .eq('org_profile_id', orgId)
    .select('id, question, answer, category, tags, use_count, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ answer: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const db = getServiceSupabase();
  const orgId = await getEffectiveOrgId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await db
    .from('grant_answer_bank')
    .delete()
    .eq('id', id)
    .eq('org_profile_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
