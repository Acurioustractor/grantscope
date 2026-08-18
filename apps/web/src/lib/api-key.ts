/**
 * API Key validation + usage tracking for the Agent API.
 *
 * Key format: cg_live_<32 hex chars>  (e.g. cg_live_a1b2c3d4e5f6...)
 * Storage: SHA-256 hash in DB, raw key shown once on creation.
 *
 * Usage:
 *   const key = await validateApiKey(request);
 *   // key is null for anonymous requests
 *   // key has { id, orgId, name, rateLimitPerMin } for authenticated
 *   ...
 *   await logUsage(key?.id ?? null, action, responseMs, statusCode, ip);
 */

import { getServiceSupabase } from './supabase';

const KEY_PREFIX = 'cg_live_';

export interface ApiKeyInfo {
  id: string;
  orgId: string | null;
  name: string;
  rateLimitPerMin: number;
}

/** Extract raw key from request headers */
function extractKey(req: Request): string | null {
  // Check Authorization: Bearer <key>
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith(KEY_PREFIX)) return token;
  }

  // Check x-api-key header
  const xKey = req.headers.get('x-api-key');
  if (xKey?.startsWith(KEY_PREFIX)) return xKey;

  return null;
}

/** SHA-256 hash a key (Web Crypto API — works in Edge Runtime) */
async function hashKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function validateApiKey(req: Request): Promise<ApiKeyInfo | null> {
  const raw = extractKey(req);
  if (!raw) return null; // Anonymous request — allowed

  const keyHash = await hashKey(raw);

  // Check cache first
  const cached = keyCache.get(keyHash);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.info;
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, org_id, name, rate_limit_per_min')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single();

  if (error || !data) {
    throw new InvalidApiKeyError();
  }

  const info: ApiKeyInfo = {
    id: data.id,
    orgId: data.org_id,
    name: data.name,
    rateLimitPerMin: data.rate_limit_per_min,
  };

  keyCache.set(keyHash, { info, expiresAt: Date.now() + CACHE_TTL });
  return info;
}

/** Log API usage (fire-and-forget — don't block response) */
export function logUsage(
  keyId: string | null,
  action: string,
  responseMs: number,
  statusCode: number,
  ip: string,
): void {
  const supabase = getServiceSupabase();
  supabase
    .from('api_usage')
    .insert({ key_id: keyId, action, response_ms: responseMs, status_code: statusCode, ip_address: ip })
    .then(({ error }) => {
      if (error) console.error('[api-usage] log error:', error.message);
    });
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super('Invalid or revoked API key');
    this.name = 'InvalidApiKeyError';
  }
}
