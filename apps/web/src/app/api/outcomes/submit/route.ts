import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * POST /api/outcomes/submit — Submit program outcomes for Governed Proof validation.
 * GET /api/outcomes/submit — List submissions for the current user.
 */

interface OutcomeEntry {
  metric: string;
  value: number;
  unit: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Allow unauthenticated submissions (partner orgs may not have accounts)
  const body = await request.json();
  const {
    org_name,
    org_abn,
    gs_entity_id,
    contact_email,
    program_name,
    reporting_period,
    outcomes,
    narrative,
    evidence_urls,
    methodology,
    postcode,
    lga_name,
    state,
    status,
  } = body;

  if (!org_name || !program_name || !reporting_period) {
    return NextResponse.json(
      { error: 'org_name, program_name, and reporting_period are required' },
      { status: 400 },
    );
  }

  if (!outcomes || !Array.isArray(outcomes) || outcomes.length === 0) {
    return NextResponse.json(
      { error: 'outcomes must be a non-empty array of { metric, value, unit }' },
      { status: 400 },
    );
  }

  // Validate outcome entries
  for (const o of outcomes as OutcomeEntry[]) {
    if (!o.metric || o.value == null || !o.unit) {
      return NextResponse.json(
        { error: 'Each outcome must have metric, value, and unit' },
        { status: 400 },
      );
    }
  }

  // Auto-resolve entity if ABN provided
  let resolvedEntityId = gs_entity_id || null;
  if (!resolvedEntityId && org_abn) {
    const db = getServiceSupabase();
    const { data: entity } = await db
      .from('gs_entities')
      .select('gs_id')
      .eq('abn', org_abn.replace(/\s/g, ''))
      .limit(1)
      .single();
    if (entity) resolvedEntityId = entity.gs_id;
  }

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('outcome_submissions')
    .insert({
      submitted_by: user?.id || null,
      org_name,
      org_abn: org_abn || null,
      gs_entity_id: resolvedEntityId,
      contact_email: contact_email || user?.email || null,
      program_name,
      reporting_period,
      outcomes,
      narrative: narrative || null,
      evidence_urls: evidence_urls || null,
      methodology: methodology || null,
      postcode: postcode || null,
      lga_name: lga_name || null,
      state: state || null,
      status: status === 'draft' ? 'draft' : 'submitted',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submission: data }, { status: 201 });
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('outcome_submissions')
    .select('*')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submissions: data });
}
