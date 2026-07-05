import 'server-only';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { resolveSubscriptionTier, type Tier } from '@/lib/subscription';

/**
 * Resolve the effective subscription tier for the current request, best-effort.
 * Server components only. Returns 'community' (free) on any failure — a missing
 * session, unconfigured auth env, or DB hiccup must never hard-fail a page; it just
 * means the visitor sees the free experience.
 */
export async function getCurrentTier(): Promise<Tier> {
  try {
    const supabaseAuth = await createSupabaseServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return 'community';

    const service = getServiceSupabase();
    const ctx = await getCurrentOrgProfileContext(service, user.id);
    return resolveSubscriptionTier(ctx?.profile?.subscription_plan);
  } catch {
    return 'community';
  }
}
