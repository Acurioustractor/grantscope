import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateApiKey } from '@/lib/api-key';

export const dynamic = 'force-dynamic';

/** GET /api/agent/keys — list keys for the authenticated user */
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceDb = getServiceSupabase();

  // Get user's org
  const { data: org } = await serviceDb
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'No org profile found. Create one first.' }, { status: 404 });
  }

  // List keys (excluding hash for security)
  const { data: keys, error } = await serviceDb
    .from('api_keys')
    .select('id, name, key_prefix, rate_limit_per_min, created_at, last_used_at, revoked_at, total_requests, total_errors')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 });
  }

  return NextResponse.json({ keys: keys || [] });
}

/** POST /api/agent/keys — create a new API key */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceDb = getServiceSupabase();

  // Get user's org
  const { data: org } = await serviceDb
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'No org profile found. Create one first.' }, { status: 404 });
  }

  // Check key limit (max 5 active keys per org)
  const { count } = await serviceDb
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .is('revoked_at', null);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Maximum 5 active keys per organisation. Revoke an existing key first.' }, { status: 400 });
  }

  let body: { name?: string } = {};
  try {
    body = await request.json();
  } catch {
    // OK — name is optional
  }

  const name = body.name?.slice(0, 100) || 'Default';

  try {
    const { raw, id, prefix } = await generateApiKey(org.id, name);

    return NextResponse.json({
      id,
      name,
      key: raw,  // Shown ONCE — never stored or retrievable again
      prefix,
      message: 'Save this key now — it will not be shown again.',
    }, { status: 201 });
  } catch (err) {
    console.error('[/api/agent/keys] create error:', err);
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });
  }
}

/** DELETE /api/agent/keys — revoke a key by id (passed as query param) */
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keyId = request.nextUrl.searchParams.get('id');
  if (!keyId) {
    return NextResponse.json({ error: 'Key id required (?id=...)' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();

  // Verify ownership
  const { data: key } = await serviceDb
    .from('api_keys')
    .select('id, org_id')
    .eq('id', keyId)
    .single();

  if (!key) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  // Check the key belongs to user's org
  const { data: org } = await serviceDb
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', key.org_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Soft-revoke (don't delete — keep for audit trail)
  const { error } = await serviceDb
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ revoked: true, id: keyId });
}
