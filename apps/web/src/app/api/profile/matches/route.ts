import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

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

  // Vector similarity search
  const { data: matches, error: matchError } = await serviceDb
    .rpc('match_grants_for_org', {
      org_embedding: matchEmbedding,
      threshold,
      match_limit: limit,
    });

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  // Boost scores for domain/geography overlap
  const orgDomains = new Set(matchDomains.map((d: string) => d.toLowerCase()));
  const orgGeo = new Set<string>(matchGeo.map((g: string) => g.toLowerCase()));

  // Fetch all learning signals in a single RPC call
  const signalParams: { p_user_id: string; p_project_profile_id?: string } = {
    p_user_id: user.id,
  };
  if (projectProfileId) {
    signalParams.p_project_profile_id = projectProfileId;
  }
  const { data: signals } = await serviceDb.rpc('get_user_feedback_signals', signalParams);

  const feedbackSignals = signals as {
    excluded_grant_ids: string[];
    not_a_grant_ids: string[];
    penalized_providers: string[];
    penalized_categories: string[];
    penalized_geos: string[];
    boosted_providers: string[];
    boosted_categories: string[];
    boosted_geos: string[];
    total_votes: number;
    up_votes: number;
    down_votes: number;
  } | null;

  const excludedIds = new Set([
    ...(feedbackSignals?.excluded_grant_ids || []),
    ...(feedbackSignals?.not_a_grant_ids || []),
  ]);
  const penalizedProviders = new Set((feedbackSignals?.penalized_providers || []).map((p: string) => p.toLowerCase()));
  const penalizedCategories = new Set((feedbackSignals?.penalized_categories || []).map((c: string) => c.toLowerCase()));
  const penalizedGeos = new Set((feedbackSignals?.penalized_geos || []).map((g: string) => g.toLowerCase()));
  const boostedProviders = new Set((feedbackSignals?.boosted_providers || []).map((p: string) => p.toLowerCase()));
  const boostedCategories = new Set((feedbackSignals?.boosted_categories || []).map((c: string) => c.toLowerCase()));
  const boostedGeos = new Set((feedbackSignals?.boosted_geos || []).map((g: string) => g.toLowerCase()));

  type GrantMatch = {
    id: string;
    name: string;
    provider: string;
    description: string;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
    url: string | null;
    grant_type: string;
    status: string;
    focus_areas: string[];
    geography: string | null;
    similarity: number;
  };

  let grantsFiltered = 0;
  const scored = (matches || [])
    .filter((grant: GrantMatch) => {
      if (excludedIds.has(grant.id)) {
        grantsFiltered++;
        return false;
      }
      return true;
    })
    .map((grant: GrantMatch) => {
      let score = grant.similarity;

      // Domain overlap boost (up to +0.05)
      if (grant.categories?.length && orgDomains.size > 0) {
        const overlap = grant.categories.filter(c => orgDomains.has(c.toLowerCase())).length;
        score += Math.min(overlap * 0.025, 0.05);
      }

      // Focus area overlap boost (up to +0.05)
      if (grant.focus_areas?.length && orgDomains.size > 0) {
        const overlap = grant.focus_areas.filter(f => orgDomains.has(f.toLowerCase())).length;
        score += Math.min(overlap * 0.025, 0.05);
      }

      // Geographic relevance boost (+0.03 if grant geography overlaps org geo)
      if (grant.geography && orgGeo.size > 0) {
        const geoLower = grant.geography.toLowerCase();
        for (const g of orgGeo) {
          if (geoLower.includes(g) || g.includes(geoLower)) {
            score += 0.03;
            break;
          }
        }
      }

      // Penalty for grants with no amount or description (low quality)
      if (!grant.amount_max && (!grant.description || grant.description.length < 50)) {
        score -= 0.03;
      }

      // Stale grant penalty — grants closed 5+ years ago
      if (grant.closes_at) {
        const closedDate = new Date(grant.closes_at);
        const yearsAgo = (Date.now() - closedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsAgo >= 5) {
          score -= 0.20;
        } else if (yearsAgo >= 2) {
          score -= 0.10;
        }
      }

      // Stale grant penalty — year reference in name (e.g. "2016-17")
      const yearMatch = grant.name?.match(/20[12]\d/);
      if (yearMatch) {
        const grantYear = parseInt(yearMatch[0]);
        const currentYear = new Date().getFullYear();
        if (currentYear - grantYear >= 3) {
          score -= 0.15;
        }
      }

      // Feedback-based penalties and boosts
      const providerLower = grant.provider?.toLowerCase();
      if (providerLower && penalizedProviders.has(providerLower)) {
        score -= 0.15;
      }
      if (providerLower && boostedProviders.has(providerLower)) {
        score += 0.05;
      }
      if (grant.categories?.length && penalizedCategories.size > 0) {
        const penalizedOverlap = grant.categories.filter(c => penalizedCategories.has(c.toLowerCase())).length;
        if (penalizedOverlap > 0) {
          score -= Math.min(penalizedOverlap * 0.05, 0.10);
        }
      }
      if (grant.categories?.length && boostedCategories.size > 0) {
        const boostedOverlap = grant.categories.filter(c => boostedCategories.has(c.toLowerCase())).length;
        if (boostedOverlap > 0) {
          score += Math.min(boostedOverlap * 0.03, 0.06);
        }
      }
      if (grant.geography && penalizedGeos.size > 0) {
        const geoLower = grant.geography.toLowerCase();
        for (const g of penalizedGeos) {
          if (geoLower.includes(g) || g.includes(geoLower)) {
            score -= 0.08;
            break;
          }
        }
      }
      if (grant.geography && boostedGeos.size > 0) {
        const geoLower = grant.geography.toLowerCase();
        for (const g of boostedGeos) {
          if (geoLower.includes(g) || g.includes(geoLower)) {
            score += 0.04;
            break;
          }
        }
      }

      return {
        ...grant,
        fit_score: Math.max(0, Math.min(Math.round(score * 100), 100)),
      };
    });

  scored.sort((a: { fit_score: number }, b: { fit_score: number }) => b.fit_score - a.fit_score);

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
