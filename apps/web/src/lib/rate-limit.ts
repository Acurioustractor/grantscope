/**
 * Simple in-memory sliding-window rate limiter for API routes.
 *
 * Usage in a route handler:
 *   import { rateLimit } from '@/lib/rate-limit';
 *   const limiter = rateLimit({ windowMs: 60_000, max: 30 });
 *
 *   export async function GET(req: NextRequest) {
 *     const limited = limiter(req);
 *     if (limited) return limited; // 429 response
 *     ...
 *   }
 */

import { NextResponse } from 'next/server';

interface RateLimitOptions {
  /** Time window in milliseconds (default: 60s) */
  windowMs?: number;
  /** Max requests per window per IP (default: 30) */
  max?: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

export function rateLimit({ windowMs = 60_000, max = 30 }: RateLimitOptions = {}) {
  const store = new Map<string, Entry>();

  // Cleanup stale entries every 5 minutes
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  };
  setInterval(cleanup, 300_000).unref();

  return function check(req: Request): NextResponse | null {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return null;
    }

    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(entry.resetAt),
          },
        },
      );
    }

    return null;
  };
}
