import { NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getImpersonateSlug } from '@/lib/org-profile';

/** GET /api/portfolio — list user's portfolios with entity counts */
export async function GET() {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const db = getServiceSupabase();

  // Check impersonation — show impersonated org owner's portfolios
  const impersonateSlug = await getImpersonateSlug();
  let effectiveUserId = auth.user.id;
  if (impersonateSlug) {
    const { data: impOrg } = await db
      .from('org_profiles')
      .select('user_id')
      .eq('slug', impersonateSlug)
      .maybeSingle();
    if (impOrg?.user_id) effectiveUserId = impOrg.user_id;
  }

  const { data: portfolios, error } = await db
    .from('funder_portfolios')
    .select('id, name, description, created_at, updated_at')
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load portfolios' }, { status: 500 });
  }

  // Get entity counts for each portfolio
  const enriched = await Promise.all(
    (portfolios || []).map(async (p) => {
      const { count } = await db
        .from('funder_portfolio_entities')
        .select('id', { count: 'exact', head: true })
        .eq('portfolio_id', p.id);
      return { ...p, entity_count: count || 0 };
    })
  );

  return NextResponse.json(enriched);
}

/** POST /api/portfolio — create a new portfolio */
export async function POST(request: Request) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const body = await request.json();
  const name = body.name || 'My Grantees';
  const description = body.description || null;

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('funder_portfolios')
    .insert({ user_id: auth.user.id, name, description })
    .select('id, name, description, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
