import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import crypto from 'crypto';

/**
 * GET /api/keys — list user's API keys
 * POST /api/keys — generate new API key
 */

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, key_prefix, name, permissions, rate_limit_per_hour, enabled, last_used_at, expires_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const body = await request.json();
  const { name, permissions, rate_limit_per_hour } = body;

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
      name: name || 'Default',
      permissions: permissions || ['read'],
      rate_limit_per_hour: rate_limit_per_hour || 100,
    })
    .select('id, key_prefix, name, permissions, rate_limit_per_hour, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the raw key ONCE — it can never be retrieved again
  return NextResponse.json({
    key: { ...data, raw_key: rawKey },
    warning: 'Save this key now. It cannot be retrieved again.',
  }, { status: 201 });
}
