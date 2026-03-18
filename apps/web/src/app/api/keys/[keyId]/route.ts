import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * DELETE /api/keys/[keyId] — revoke an API key
 * PATCH /api/keys/[keyId] — update key name or enabled status
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const auth = await requireModule('api');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { keyId } = await params;

  const db = getServiceSupabase();
  const { count } = await db
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', user.id);

  if (!count || count === 0) {
    return NextResponse.json(
      { error: 'API key not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const auth = await requireModule('api');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { keyId } = await params;

  const body = await request.json();
  const { name, enabled } = body;

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (enabled !== undefined) updates.enabled = enabled;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update (name or enabled)' },
      { status: 400 }
    );
  }

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('api_keys')
    .update(updates)
    .eq('id', keyId)
    .eq('user_id', user.id)
    .select('id, key_prefix, name, enabled, created_at, last_used_at, rate_limit_per_hour, expires_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'API key not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
