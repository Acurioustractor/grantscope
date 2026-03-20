import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { embedQuery } from '@grant-engine/embeddings';

/** If admin is impersonating an org, return that org's slug (otherwise null) */
async function getImpersonatedSlug(userEmail: string | undefined): Promise<string | null> {
  if (!userEmail || !isAdminEmail(userEmail)) return null;
  const cookieStore = await cookies();
  return cookieStore.get('cg_impersonate_org')?.value ?? null;
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceDb = getServiceSupabase();
  const impersonateSlug = await getImpersonatedSlug(user.email);

  const query = impersonateSlug
    ? serviceDb.from('org_profiles').select('*').eq('slug', impersonateSlug).maybeSingle()
    : serviceDb.from('org_profiles').select('*').eq('user_id', user.id).maybeSingle();

  const { data, error } = await query;

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
    org_status, auspice_org_name,
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
  const impersonateSlug = await getImpersonatedSlug(user.email);

  // When impersonating, resolve the target org's user_id
  let targetUserId = user.id;
  if (impersonateSlug) {
    const { data: targetOrg } = await serviceDb
      .from('org_profiles')
      .select('user_id')
      .eq('slug', impersonateSlug)
      .maybeSingle();
    if (targetOrg?.user_id) targetUserId = targetOrg.user_id;
  }

  const { data, error } = await serviceDb
    .from('org_profiles')
    .upsert(
      {
        user_id: targetUserId,
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
        org_status: org_status || null,
        auspice_org_name: auspice_org_name || null,
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
