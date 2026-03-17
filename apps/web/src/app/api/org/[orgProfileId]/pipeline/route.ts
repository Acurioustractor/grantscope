import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess } from '../../_lib/auth';

type Params = { params: Promise<{ orgProfileId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.serviceDb
    .from('org_pipeline')
    .select('*')
    .eq('org_profile_id', orgProfileId)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { data, error } = await auth.serviceDb
    .from('org_pipeline')
    .insert({ ...body, org_profile_id: orgProfileId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data, error } = await auth.serviceDb
    .from('org_pipeline')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_profile_id', orgProfileId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await auth.serviceDb
    .from('org_pipeline')
    .delete()
    .eq('id', id)
    .eq('org_profile_id', orgProfileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
