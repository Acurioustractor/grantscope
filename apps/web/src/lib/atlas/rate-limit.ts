/**
 * In-memory rate limiter for the public API.
 *
 * 60 req/min per IP — enough to prevent casual scraping abuse, low enough to be
 * trivially satisfied by curl + a notebook. Higher tiers (per API key) will be
 * issued later; for September launch, unauthenticated public + this rate cap is
 * the contract.
 *
 * NOTE: in-memory only — resets on cold-start. For higher-volume production,
 * swap for an Upstash Redis or Vercel KV-backed implementation.
 */

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function rateLimit(ip: string, limit = DEFAULT_LIMIT): RateLimitResult {
  const now = Date.now();
  const key = ip || 'unknown';
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, limit, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return { ok: existing.count <= limit, limit, remaining, resetAt: existing.resetAt };
}

export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() ?? 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(Math.floor(r.resetAt / 1000)),
  };
}
