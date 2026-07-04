import { NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getEffectiveOrgId } from '@/lib/org-profile';
import { scoreGrantsForOrg } from '@grant-engine/grant-matching';

/**
 * GET /api/grants/match — AI-scored grant matches for the authenticated user's org profile.
 *
 * Ranks grants via pgvector similarity between the org embedding and grant
 * embeddings, then applies learning-signal boosts — the same shared scorer as
 * `/api/profile/matches`. Falls back to keyword heuristics only when the org
 * has no embedding yet.
 */

export async function GET() {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  // Get user's org profile (respects impersonation)
  const serviceDb = getServiceSupabase();
  const orgId = await getEffectiveOrgId(serviceDb, user.id);

  const { data: profile } = orgId
    ? await serviceDb
        .from('org_profiles')
        .select('id, name, abn, domains, geographic_focus, org_type, annual_revenue, embedding, mission')
        .eq('id', orgId)
        .single()
    : { data: null };

  if (!profile) {
    return NextResponse.json({
      error: 'No org profile found. Create a profile first.',
      matches: [],
    }, { status: 200 });
  }

  let result;
  try {
    result = await scoreGrantsForOrg(serviceDb, {
      embedding: profile.embedding ?? null,
      domains: profile.domains,
      geo: profile.geographic_focus,
      orgType: profile.org_type,
      annualRevenue: profile.annual_revenue,
      mission: profile.mission,
      userId: user.id,
      limit: 200,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Match failed' }, { status: 500 });
  }

  if (result.usedFallback) {
    console.warn(`[grants/match] org ${profile.id} has no embedding — used keyword fallback`);
  }

  // Preserve the response contract: match_score (0-100) + match_signals.
  const matches = result.matches.slice(0, 50).map((g) => ({
    ...g,
    match_score: g.fit_score,
  }));

  return NextResponse.json({
    matches,
    total: result.matches.length,
    profile_name: profile.name,
    used_fallback: result.usedFallback,
  });
}
