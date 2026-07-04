import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { scoreGrantsForOrg } from '@grant-engine/grant-matching';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const threshold = parseFloat(searchParams.get('threshold') || '0.65');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const projectCode = searchParams.get('project'); // e.g. 'ACT-GD'

  const serviceDb = getServiceSupabase();

  // Fetch user's org profile (owner or team member)
  let orgProfileId: string | null = null;
  let profile: { embedding: string; domains: string[]; geographic_focus: string[] } | null = null;
  let profileError = null;

  const { data: ownProfile, error: ownError } = await serviceDb
    .from('org_profiles')
    .select('id, embedding, domains, geographic_focus')
    .eq('user_id', user.id)
    .maybeSingle();

  if (ownProfile) {
    orgProfileId = ownProfile.id;
    profile = ownProfile;
    profileError = ownError;
  } else {
    const { data: membership } = await serviceDb
      .from('org_members')
      .select('org_profile_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      const { data: orgProfile, error: orgError } = await serviceDb
        .from('org_profiles')
        .select('id, embedding, domains, geographic_focus')
        .eq('id', membership.org_profile_id)
        .single();
      orgProfileId = orgProfile?.id || null;
      profile = orgProfile;
      profileError = orgError;
    }
  }

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: 'No profile found. Create one first.' }, { status: 404 });
  if (!profile.embedding) return NextResponse.json({ error: 'Profile has no embedding. Save your profile to generate one.' }, { status: 400 });

  // If a project is specified, use its embedding instead of the org-level one
  let matchEmbedding = profile.embedding;
  let matchDomains = profile.domains || [];
  let matchGeo = profile.geographic_focus || [];
  let projectProfileId: string | null = null;
  let activeProject: string | null = null;

  if (projectCode && orgProfileId) {
    const { data: projectProfile } = await serviceDb
      .from('project_profiles')
      .select('id, embedding, domains, geographic_focus')
      .eq('org_profile_id', orgProfileId)
      .eq('project_code', projectCode)
      .maybeSingle();

    if (projectProfile?.embedding) {
      matchEmbedding = projectProfile.embedding;
      matchDomains = projectProfile.domains || [];
      matchGeo = projectProfile.geographic_focus || [];
      projectProfileId = projectProfile.id;
      activeProject = projectCode;
    }
  }

  // Fetch available projects for the UI dropdown
  let availableProjects: { code: string; name: string }[] = [];
  if (orgProfileId) {
    const { data: projects } = await serviceDb
      .from('project_profiles')
      .select('project_code, name')
      .eq('org_profile_id', orgProfileId)
      .order('name');
    availableProjects = (projects || []).map(p => ({ code: p.project_code, name: p.name }));
  }

  // Vector similarity search + learning boosts (shared scorer).
  let result;
  try {
    result = await scoreGrantsForOrg(serviceDb, {
      embedding: matchEmbedding,
      domains: matchDomains,
      geo: matchGeo,
      threshold,
      limit,
      userId: user.id,
      projectProfileId,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Match failed' }, { status: 500 });
  }

  const { matches: scored, grantsFiltered, feedbackSignals } = result;

  return NextResponse.json({
    matches: scored,
    count: scored.length,
    feedback_count: feedbackSignals?.total_votes || 0,
    profile_domains: matchDomains,
    profile_geo: matchGeo,
    active_project: activeProject,
    available_projects: availableProjects,
    learning: feedbackSignals ? {
      penalized_providers: feedbackSignals.penalized_providers,
      penalized_categories: feedbackSignals.penalized_categories,
      boosted_providers: feedbackSignals.boosted_providers,
      boosted_categories: feedbackSignals.boosted_categories,
      total_votes: feedbackSignals.total_votes,
      up_votes: feedbackSignals.up_votes,
      down_votes: feedbackSignals.down_votes,
      grants_filtered: grantsFiltered,
    } : null,
  });
}
