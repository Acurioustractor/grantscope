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

  const serviceDb = getServiceSupabase();

  // Fetch user's org profile with embedding (owner or team member)
  let profile = null;
  let profileError = null;

  // First check if user owns a profile
  const { data: ownProfile, error: ownError } = await serviceDb
    .from('org_profiles')
    .select('embedding, domains, geographic_focus')
    .eq('user_id', user.id)
    .maybeSingle();

  if (ownProfile) {
    profile = ownProfile;
    profileError = ownError;
  } else {
    // Check if user is a team member of another org
    const { data: membership } = await serviceDb
      .from('org_members')
      .select('org_profile_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      const { data: orgProfile, error: orgError } = await serviceDb
        .from('org_profiles')
        .select('embedding, domains, geographic_focus')
        .eq('id', membership.org_profile_id)
        .single();
      profile = orgProfile;
      profileError = orgError;
    }
  }

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: 'No profile found. Create one first.' }, { status: 404 });
  if (!profile.embedding) return NextResponse.json({ error: 'Profile has no embedding. Save your profile to generate one.' }, { status: 400 });

  // Vector similarity search via the match function
  const { data: matches, error: matchError } = await serviceDb
    .rpc('match_grants_for_org', {
      org_embedding: profile.embedding,
      threshold,
      match_limit: limit,
    });

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  // Boost scores for domain/geography overlap
  const orgDomains = new Set((profile.domains || []).map((d: string) => d.toLowerCase()));
  const orgGeo = new Set<string>((profile.geographic_focus || []).map((g: string) => g.toLowerCase()));

  // Get user's feedback count for learning stats
  const { count: feedbackCount } = await serviceDb
    .from('grant_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const scored = (matches || []).map((grant: {
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
  }) => {
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

    return {
      ...grant,
      fit_score: Math.min(Math.round(score * 100), 100),
    };
  });

  // Apply feedback adjustments if user has given feedback
  if (feedbackCount && feedbackCount > 0) {
    for (const grant of scored) {
      const { data: adjusted } = await serviceDb.rpc('get_feedback_adjusted_score', {
        p_user_id: user.id,
        p_grant_id: grant.id,
        p_base_score: grant.fit_score,
      });
      if (adjusted !== null && adjusted !== undefined) {
        grant.fit_score = Math.round(adjusted as number);
      }
    }
  }

  scored.sort((a: { fit_score: number }, b: { fit_score: number }) => b.fit_score - a.fit_score);

  return NextResponse.json({
    matches: scored,
    count: scored.length,
    feedback_count: feedbackCount || 0,
    profile_domains: profile.domains,
    profile_geo: profile.geographic_focus,
  });
}
