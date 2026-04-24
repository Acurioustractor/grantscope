import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ContinuePage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=%2Fcontinue');
  }

  const db = getServiceSupabase();
  const [
    { data: profile },
    { count: savedGrantCount },
    { count: savedFoundationCount },
    { count: progressedGrantCount },
  ] = await Promise.all([
    db
      .from('org_profiles')
      .select('name, domains, geographic_focus')
      .eq('user_id', user.id)
      .maybeSingle(),
    db
      .from('saved_grants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    db
      .from('saved_foundations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    db
      .from('saved_grants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('stage', 'discovered'),
  ]);

  const hasProfile = !!profile?.name;
  const hasDomains = Array.isArray(profile?.domains) && profile.domains.length > 0;
  const hasGeography = Array.isArray(profile?.geographic_focus) && profile.geographic_focus.length > 0;
  const hasPipeline = (savedGrantCount || 0) > 0 || (savedFoundationCount || 0) > 0;
  const hasShortlistedGrants = (savedGrantCount || 0) > 0;
  const hasWorkedGrantPipeline = (progressedGrantCount || 0) > 0;

  if (!hasProfile || !hasDomains || !hasGeography) {
    redirect('/profile');
  }

  if (!hasPipeline) {
    redirect('/profile/matches');
  }

  if (hasShortlistedGrants && !hasWorkedGrantPipeline) {
    redirect('/tracker?onboarding=1');
  }

  redirect('/home');
}
