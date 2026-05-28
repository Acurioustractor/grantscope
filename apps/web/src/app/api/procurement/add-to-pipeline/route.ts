import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * POST /api/procurement/add-to-pipeline
 *
 * Adds a procurement buyer prospect to org_pipeline as opportunity_type='procurement'.
 * Used by the Today / procurement surfaces to convert a buyer prospect into an
 * actionable pipeline card.
 *
 * Body: {
 *   buyer_name: string,
 *   project_code: string,
 *   pathway?: string,
 *   recommended_role?: 'lead' | 'partner' | 'contractor' | 'monitor',
 *   notes?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    buyer_name?: string;
    project_code?: string;
    pathway?: string;
    recommended_role?: string;
    notes?: string;
    org_profile_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const buyer_name = typeof body.buyer_name === 'string' ? body.buyer_name.trim() : '';
  const project_code = typeof body.project_code === 'string' ? body.project_code.trim() : '';
  if (!buyer_name || !project_code) {
    return NextResponse.json({ error: 'buyer_name and project_code required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify project_code exists (catch typos before write)
  const { data: project, error: projectErr } = await supabase
    .from('act_grant_recommendation_projects')
    .select('project_code')
    .eq('project_code', project_code)
    .maybeSingle();

  if (projectErr) {
    return NextResponse.json({ error: projectErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: `Unknown project_code: ${project_code}` }, { status: 400 });
  }

  // Dedupe: if a pipeline row already exists for this buyer + project, return it
  const { data: existing } = await supabase
    .from('org_pipeline')
    .select('id, status, qbe_stage')
    .eq('funder', buyer_name)
    .eq('project_code', project_code)
    .eq('opportunity_type', 'procurement')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      pipeline_id: existing.id,
      created: false,
      message: 'Already in pipeline for this project',
      status: existing.status,
      qbe_stage: existing.qbe_stage,
    });
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from('org_pipeline')
    .insert({
      name: `${buyer_name} — procurement prospect`,
      funder: buyer_name,
      funder_type: 'government',
      project_code,
      opportunity_type: 'procurement',
      status: 'prospect',
      qbe_stage: 'qualifying',
      qbe_qualified_at: now,
      pathway: body.pathway ?? 'procurement',
      recommended_role: body.recommended_role ?? 'lead',
      source_type: 'austender_buyer_surface',
      notes: [
        `[added from Today buyer surface · ${now.slice(0, 10)} · by ${auth.user.email ?? 'admin'}]`,
        body.notes ?? null,
      ].filter(Boolean).join('\n'),
      created_at: now,
      updated_at: now,
    })
    .select('id, qbe_stage, status')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    pipeline_id: inserted.id,
    created: true,
    status: inserted.status,
    qbe_stage: inserted.qbe_stage,
  });
}
