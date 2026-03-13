import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { embedQuery } from '@grant-engine/embeddings';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceDb = getServiceSupabase();
  const { data, error } = await serviceDb
    .from('org_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, description, mission, abn, website,
    domains, geographic_focus, org_type,
    annual_revenue, team_size, projects,
    notify_email, notify_threshold,
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Build embedding text from profile fields
  const embeddingParts = [
    name,
    mission,
    description,
    domains?.length ? `Focus areas: ${domains.join(', ')}` : null,
    geographic_focus?.length ? `Geography: ${geographic_focus.join(', ')}` : null,
    org_type ? `Organisation type: ${org_type}` : null,
    projects?.length
      ? `Projects: ${projects.map((p: { name: string; description?: string }) => `${p.name}${p.description ? ': ' + p.description : ''}`).join('. ')}`
      : null,
  ].filter(Boolean).join('\n');

  // Generate embedding
  let embedding: number[] | null = null;
  if (process.env.OPENAI_API_KEY && embeddingParts.length > 0) {
    try {
      embedding = await embedQuery(embeddingParts, process.env.OPENAI_API_KEY);
    } catch (err) {
      console.error('[profile] Embedding generation failed:', err);
    }
  }

  const serviceDb = getServiceSupabase();
  const { data, error } = await serviceDb
    .from('org_profiles')
    .upsert(
      {
        user_id: user.id,
        name,
        description: description || null,
        mission: mission || null,
        abn: abn || null,
        website: website || null,
        domains: domains || [],
        geographic_focus: geographic_focus || [],
        org_type: org_type || null,
        annual_revenue: annual_revenue || null,
        team_size: team_size || null,
        projects: projects || null,
        embedding: embedding ? JSON.stringify(embedding) : null,
        embedding_text: embeddingParts || null,
        notify_email: notify_email ?? true,
        notify_threshold: notify_threshold ?? 0.75,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
