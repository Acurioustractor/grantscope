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
}

type ServiceDb = ReturnType<typeof getServiceSupabase>;

export async function getCurrentOrgProfileContext(
  serviceDb: ServiceDb,
  userId: string,
): Promise<OrgProfileContext> {
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
  };
}
