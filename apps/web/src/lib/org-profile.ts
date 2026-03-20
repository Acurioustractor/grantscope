import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase';

export interface OrgProfileSummary {
  id: string;
  name: string;
  abn: string | null;
  subscription_plan: string | null;
  org_type: string | null;
  geographic_focus: string[] | null;
}

export interface OrgProfileContext {
  orgProfileId: string | null;
  currentUserRole: string | null;
  profile: OrgProfileSummary | null;
  isImpersonating: boolean;
}

type ServiceDb = ReturnType<typeof getServiceSupabase>;

/**
 * Get the impersonated org slug from the cookie, if set.
 */
export async function getImpersonateSlug(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('cg_impersonate_org')?.value ?? null;
}

/**
 * Get the effective org profile ID — checks impersonation cookie first,
 * then falls back to user's own org. Use this in API routes that filter by org.
 */
export async function getEffectiveOrgId(
  serviceDb: ServiceDb,
  userId: string,
): Promise<string | null> {
  const impersonateSlug = await getImpersonateSlug();

  if (impersonateSlug) {
    const { data: impOrg } = await serviceDb
      .from('org_profiles')
      .select('id')
      .eq('slug', impersonateSlug)
      .maybeSingle();
    if (impOrg) return impOrg.id;
  }

  // Fall back to user's own org
  const ctx = await getCurrentOrgProfileContext(serviceDb, userId);
  return ctx.orgProfileId;
}

export async function getCurrentOrgProfileContext(
  serviceDb: ServiceDb,
  userId: string,
): Promise<OrgProfileContext> {
  // Check impersonation first
  const impersonateSlug = await getImpersonateSlug();

  if (impersonateSlug) {
    const { data: impOrg } = await serviceDb
      .from('org_profiles')
      .select('id, name, abn, subscription_plan, org_type, geographic_focus')
      .eq('slug', impersonateSlug)
      .maybeSingle();

    if (impOrg) {
      return {
        orgProfileId: impOrg.id,
        currentUserRole: 'admin',
        profile: impOrg,
        isImpersonating: true,
      };
    }
  }

  const { data: ownedProfile } = await serviceDb
    .from('org_profiles')
    .select('id, name, abn, subscription_plan, org_type, geographic_focus')
    .eq('user_id', userId)
    .maybeSingle();

  if (ownedProfile) {
    return {
      orgProfileId: ownedProfile.id,
      currentUserRole: 'admin',
      profile: ownedProfile,
      isImpersonating: false,
    };
  }

  const { data: membership } = await serviceDb
    .from('org_members')
    .select(`
      role,
      org_profile:org_profile_id(
        id,
        name,
        abn,
        subscription_plan,
        org_type,
        geographic_focus
      )
    `)
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const profile = Array.isArray(membership?.org_profile)
    ? membership?.org_profile[0]
    : membership?.org_profile;

  return {
    orgProfileId: profile?.id ?? null,
    currentUserRole: membership?.role ?? null,
    profile: profile ?? null,
    isImpersonating: false,
  };
}
