import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import crypto from 'crypto';

/**
 * GET /api/keys — list user's API keys
 * POST /api/keys — generate new API key
 */

export async function GET() {
  const auth = await requireModule('api');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const { data, error } = await serviceDb
    .from('api_keys')
    .select('id, key_prefix, name, permissions, rate_limit_per_hour, enabled, last_used_at, expires_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('api');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const { name, permissions, rate_limit_per_hour } = body;

  // Validate name is required
  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { error: 'name is required and must be a string' },
      { status: 400 }
    );
  }

  // Generate a secure API key
  const rawKey = `cg_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 11); // "cg_" + 8 chars

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('api_keys')
    .insert({
      user_id: user.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
      permissions: permissions || ['read'],
      rate_limit_per_hour: rate_limit_per_hour || 1000,
      enabled: true,
    })
    .select('id, key_prefix, name, enabled, created_at, rate_limit_per_hour')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the raw key ONCE — it cannot be retrieved again
  return NextResponse.json({
    ...data,
    key: rawKey,
  }, { status: 201 });
}
