import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';

/** Shared result shape for Goods write server-actions. */
export interface ActionResult { ok: boolean; error?: string }

/**
 * Gate write access to the Goods registry. Goods server-actions mutate shared
 * data with the service-role client, so they must verify the caller first. In
 * production an authenticated super-admin (`ADMIN_EMAILS`) is required; in
 * local/dev fast-local-org mode writes are allowed without auth to keep the dev
 * loop frictionless — mirrors the org layout's own fast-local bypass.
 * Returns a failure `ActionResult` when not permitted, or `null` to proceed.
 *
 * Canonical guard — imported by every Goods actions.ts (engagement, foundations…).
 */
export async function requireWriteAccess(): Promise<ActionResult | null> {
  if (shouldUseFastLocalOrg()) return null; // dev/local bypass (NODE_ENV !== 'production')
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in to make changes.' };
  if (!isAdminEmail(user.email)) return { ok: false, error: 'You do not have permission to make changes.' };
  return null;
}
