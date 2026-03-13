/**
 * API route auth + tier enforcement.
 *
 * Usage:
 *   const auth = await requireModule('procurement');
 *   if (auth.error) return auth.error;
 *   const { user, tier } = auth;
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import crypto from 'crypto';
import {
  type Module,
  type Tier,
  hasModule,
  resolveSubscriptionTier,
  minimumTier,
  TIER_LABELS,
  MODULE_LABELS,
} from '@/lib/subscription';
import type { User } from '@supabase/supabase-js';

interface AuthSuccess {
  user: User;
  tier: Tier;
  error?: undefined;
}

interface AuthFailure {
  user?: undefined;
  tier?: undefined;
  error: NextResponse;
}

type AuthResult = AuthSuccess | AuthFailure;

/**
 * Authenticate the request and resolve the user's subscription tier.
 * Returns 401 if not authenticated.
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const serviceDb = getServiceSupabase();
  const { data: profile } = await serviceDb
    .from('org_profiles')
    .select('subscription_plan')
    .eq('user_id', user.id)
    .maybeSingle();

  const tier = resolveSubscriptionTier(profile?.subscription_plan);

  return { user, tier };
}

/**
 * Authenticate and verify the user has access to a specific module.
 * Returns 401 if not authenticated, 403 if tier insufficient.
 */
export async function requireModule(module: Module): Promise<AuthResult> {
  const auth = await requireAuth();
  if (auth.error) return auth;

  if (!hasModule(auth.tier, module)) {
    const required = minimumTier(module);
    return {
      error: NextResponse.json(
        {
          error: 'Upgrade required',
          module,
          module_label: MODULE_LABELS[module],
          current_tier: auth.tier,
          required_tier: required,
          required_tier_label: TIER_LABELS[required],
          upgrade_url: '/pricing',
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}

interface ApiKeyAuthSuccess {
  userId: string;
  keyId: string;
  permissions: string[];
  tier: Tier;
  error?: undefined;
}

interface ApiKeyAuthFailure {
  userId?: undefined;
  keyId?: undefined;
  permissions?: undefined;
  tier?: undefined;
  error: NextResponse;
}

type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthFailure;

/**
 * Authenticate a request using a Bearer API key (cg_xxx).
 * Validates against api_keys table via SHA-256 hash lookup.
 * Updates last_used_at on successful auth.
 */
export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyAuthResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer cg_')) {
    return {
      error: NextResponse.json(
        { error: 'API key required. Pass Bearer cg_xxx in Authorization header.' },
        { status: 401 }
      ),
    };
  }

  const rawKey = authHeader.slice(7); // Remove "Bearer "
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const db = getServiceSupabase();
  const { data: key } = await db
    .from('api_keys')
    .select('id, user_id, permissions, rate_limit_per_hour, enabled, expires_at')
    .eq('key_hash', keyHash)
    .single();

  if (!key) {
    return {
      error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    };
  }

  if (!key.enabled) {
    return {
      error: NextResponse.json({ error: 'API key is disabled' }, { status: 403 }),
    };
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return {
      error: NextResponse.json({ error: 'API key has expired' }, { status: 403 }),
    };
  }

  // Resolve tier from user's org profile
  const { data: profile } = await db
    .from('org_profiles')
    .select('subscription_plan')
    .eq('user_id', key.user_id)
    .maybeSingle();

  const tier = resolveSubscriptionTier(profile?.subscription_plan);

  // Update last_used_at (fire and forget)
  db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then();

  return {
    userId: key.user_id,
    keyId: key.id,
    permissions: key.permissions || ['read'],
    tier,
  };
}
