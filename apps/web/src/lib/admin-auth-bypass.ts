import type { User } from '@supabase/supabase-js';
import { ADMIN_EMAILS } from '@/lib/admin';

/**
 * The local-development admin bypass.
 *
 * WHY THIS EXISTS
 *
 * /login offers "Continue locally as A Curious Tractor", and that button has never worked on an
 * admin-gated page. It calls router.push() and sets no session at all, so requireAdminPage finds
 * no user and redirects straight back to /login — an infinite loop, first hit when /clarity
 * shipped. The button promises local access; this makes the promise true.
 *
 * WHY IT IS SAFE, AND WHY THERE ARE TWO CONDITIONS RATHER THAN ONE
 *
 * A single NODE_ENV check would be the usual approach and it is not enough on its own: it is one
 * mis-set environment variable away from opening every admin page in production. So the bypass
 * requires BOTH:
 *
 *   1. NODE_ENV !== 'production'   — Next sets 'production' for `next build` / `next start`,
 *                                    which is what every deployed instance runs.
 *   2. no VERCEL env var           — Vercel sets VERCEL=1 on EVERY deployment, including preview
 *                                    and development environments. So even a deploy that somehow
 *                                    carried NODE_ENV=development stays gated.
 *
 * These fail independently. Both must be wrong at once for the bypass to open where it should
 * not, and admin-auth-bypass.test.ts fails the build if either check is removed.
 *
 * SCOPE: pages only. requireAdminApi is deliberately NOT bypassed — an open admin page in local
 * dev is a convenience, an open admin API is a different blast radius, and nothing needs it yet.
 */
export function isLocalDevBypass(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  if (env.VERCEL) return false;
  return true;
}

/**
 * The synthetic user handed to a page under the bypass. It carries a real admin email so that any
 * downstream isAdminEmail() check behaves exactly as it would for a signed-in admin, and an
 * obviously-fake id so it can never be mistaken for a real account in a log.
 */
export function localDevAdminUser(): User {
  const now = new Date().toISOString();
  return {
    id: '00000000-0000-0000-0000-00000000dev0',
    aud: 'authenticated',
    role: 'authenticated',
    email: ADMIN_EMAILS[0],
    app_metadata: { provider: 'local-dev-bypass' },
    user_metadata: { local_dev_bypass: true },
    created_at: now,
    updated_at: now,
  } as User;
}
