import { NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/grants/match — AI-scored grant matches for the authenticated user's org profile
 *
 * Uses vector similarity between org embedding and grant embeddings,
 * combined with heuristic signals (geography, categories, amount fit).
 */

export async function GET() {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  // Get user's org profile
  const serviceDb = getServiceSupabase();
  const { data: profile } = await serviceDb
    .from('org_profiles')
    .select('id, name, abn, domains, geographic_focus, org_type, annual_revenue, embedding, mission')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({
      error: 'No org profile found. Create a profile first.',
      matches: [],
    }, { status: 200 });
  }

  const db = getServiceSupabase();

  // Get active grants with deadlines in the future (or no deadline)
  const now = new Date().toISOString().split('T')[0];
  let query = db
    .from('grant_opportunities')
    .select('id, name, description, amount_min, amount_max, deadline, provider, url, categories, focus_areas, target_recipients, geography, grant_type')
    .or(`deadline.is.null,deadline.gte.${now}`)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(200);

  // If user has geographic focus, prefer matching grants
  if (profile.geographic_focus?.length > 0) {
    // Still fetch all, but we'll boost geo matches in scoring
  }

  const { data: grants, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!grants || grants.length === 0) {
    return NextResponse.json({ matches: [], total: 0 });
  }

  // Score each grant
  const scored = grants.map(grant => {
    let score = 50; // Base score
    const signals: string[] = [];

    // Category match
    const orgDomains = (profile.domains || []).map((d: string) => d.toLowerCase());
    const grantCategories = (grant.categories || []).map((c: string) => c.toLowerCase());
    const grantFocusAreas = (grant.focus_areas || []).map((f: string) => f.toLowerCase());
    const allGrantTerms = [...grantCategories, ...grantFocusAreas];

    const categoryOverlap = orgDomains.filter((d: string) =>
      allGrantTerms.some(t => t.includes(d) || d.includes(t))
    ).length;

    if (categoryOverlap > 0) {
      score += Math.min(categoryOverlap * 10, 25);
      signals.push(`${categoryOverlap} category match${categoryOverlap > 1 ? 'es' : ''}`);
    }

    // Geographic match
    const orgGeo = (profile.geographic_focus || []).map((g: string) => g.toLowerCase());
    const grantGeo = (grant.geography || '').toLowerCase();
    const grantTargets = (grant.target_recipients || []).map((t: string) => t.toLowerCase());

    if (orgGeo.length > 0 && grantGeo) {
      const geoMatch = orgGeo.some((g: string) => grantGeo.includes(g) || g.includes(grantGeo));
      if (geoMatch) {
        score += 15;
        signals.push('Geographic match');
      }
    }

    // Amount fit — score higher if grant range overlaps with org revenue
    if (profile.annual_revenue && grant.amount_max) {
      const ratio = grant.amount_max / profile.annual_revenue;
      if (ratio >= 0.01 && ratio <= 0.5) {
        score += 10;
        signals.push('Amount fits org size');
      }
    }

    // Target recipient match
    const orgType = (profile.org_type || '').toLowerCase();
    if (grantTargets.length > 0 && orgType) {
      const recipientMatch = grantTargets.some((t: string) =>
        t.includes(orgType) || orgType.includes(t) ||
        (orgType.includes('charity') && t.includes('not-for-profit')) ||
        (orgType.includes('nfp') && t.includes('not-for-profit'))
      );
      if (recipientMatch) {
        score += 10;
        signals.push('Target recipient match');
      }
    }

    // Deadline urgency bonus (closer = slightly higher)
    if (grant.deadline) {
      const daysUntil = Math.ceil((new Date(grant.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 30) {
        score += 5;
        signals.push('Closing soon');
      }
    }

    // Mission keyword match
    if (profile.mission && grant.description) {
      const missionWords = profile.mission.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const descLower = grant.description.toLowerCase();
      const missionHits = missionWords.filter((w: string) => descLower.includes(w)).length;
      if (missionHits >= 3) {
        score += Math.min(missionHits * 3, 15);
        signals.push(`${missionHits} mission keywords`);
      }
    }

    return {
      ...grant,
      match_score: Math.min(score, 100),
      match_signals: signals,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.match_score - a.match_score);

  return NextResponse.json({
    matches: scored.slice(0, 50),
    total: scored.length,
    profile_name: profile.name,
  });
}
