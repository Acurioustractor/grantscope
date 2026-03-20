import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const view = request.nextUrl.searchParams.get('view') || 'personal';

  // Check impersonation cookie — if set, override org context
  const cookieStore = await cookies();
  const impersonateSlug = cookieStore.get('cg_impersonate_org')?.value;
  let impersonateOrgId: string | null = null;

  if (impersonateSlug) {
    const { data: impOrg } = await serviceDb
      .from('org_profiles')
      .select('id')
      .eq('slug', impersonateSlug)
      .maybeSingle();
    if (impOrg) impersonateOrgId = impOrg.id;
  }

  // Auto-archive: move grants with past deadlines to 'expired' stage
  const activeStages = ['discovered', 'researching', 'pursuing'];
  const { data: expiredGrants } = await serviceDb
    .from('saved_grants')
    .select('id, grant_id, grant:grant_opportunities(closes_at)')
    .eq('user_id', user.id)
    .in('stage', activeStages);

  if (expiredGrants && expiredGrants.length > 0) {
    const now = new Date();
    const toExpire = expiredGrants.filter((g) => {
      const grant = Array.isArray(g.grant) ? g.grant[0] : g.grant;
      const closes = grant?.closes_at;
      if (!closes) return false;
      return new Date(closes) < now;
    });
    if (toExpire.length > 0) {
      await serviceDb
        .from('saved_grants')
        .update({ stage: 'expired', updated_at: now.toISOString() })
        .in('id', toExpire.map((g) => g.id));
    }
  }

  if (view === 'org' || impersonateOrgId) {
    // When impersonating, always use the impersonated org
    let orgProfileId = impersonateOrgId;

    if (!orgProfileId) {
      // Fallback: user's own org membership
      const { data: membership } = await serviceDb
        .from('org_members')
        .select('org_profile_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json([]);
      }
      orgProfileId = membership.org_profile_id;
    }

    // Auto-archive expired org grants too
    const { data: expiredOrgGrants } = await serviceDb
      .from('saved_grants')
      .select('id, grant_id, grant:grant_opportunities(closes_at)')
      .eq('org_profile_id', orgProfileId)
      .in('stage', activeStages);

    if (expiredOrgGrants && expiredOrgGrants.length > 0) {
      const nowOrg = new Date();
      const toExpireOrg = expiredOrgGrants.filter((g) => {
        const grant = Array.isArray(g.grant) ? g.grant[0] : g.grant;
        const closes = grant?.closes_at;
        if (!closes) return false;
        return new Date(closes) < nowOrg;
      });
      if (toExpireOrg.length > 0) {
        await serviceDb
          .from('saved_grants')
          .update({ stage: 'expired', updated_at: nowOrg.toISOString() })
          .in('id', toExpireOrg.map((g) => g.id));
      }
    }

    // Fetch org-shared grants from saved_grants
    const { data: savedGrants, error } = await serviceDb
      .from('saved_grants')
      .select(`
        *,
        grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories, url, application_status)
      `)
      .eq('org_profile_id', orgProfileId)
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also include org_pipeline items as tracker cards
    // Note: no FK from org_pipeline to grant_opportunities, so fetch separately
    const { data: pipelineItems } = await serviceDb
      .from('org_pipeline')
      .select('id, name, status, notes, amount_display, amount_numeric, funder, deadline, grant_opportunity_id')
      .eq('org_profile_id', orgProfileId)
      .order('updated_at', { ascending: false });

    // Fetch linked grant details if any pipeline items have grant_opportunity_id
    const grantIds = (pipelineItems ?? []).map(p => p.grant_opportunity_id).filter(Boolean) as string[];
    let grantsMap: Record<string, { id: string; name: string; provider: string; amount_min: number | null; amount_max: number | null; closes_at: string | null; categories: string[]; url: string | null; application_status: string }> = {};
    if (grantIds.length > 0) {
      const { data: grants } = await serviceDb
        .from('grant_opportunities')
        .select('id, name, provider, amount_min, amount_max, closes_at, categories, url, application_status')
        .in('id', grantIds);
      for (const g of grants ?? []) {
        grantsMap[g.id] = g;
      }
    }

    // Map pipeline items to saved_grants shape for the kanban board
    const stageMap: Record<string, string> = {
      prospect: 'discovered',
      upcoming: 'discovered',
      drafting: 'researching',
      submitted: 'submitted',
      awarded: 'awarded',
      rejected: 'rejected',
    };
    const pipelineAsSaved = (pipelineItems ?? []).map(p => {
      const linkedGrant = p.grant_opportunity_id ? grantsMap[p.grant_opportunity_id] : null;
      return {
        id: p.id,
        grant_id: p.grant_opportunity_id,
        stars: 0,
        color: null,
        stage: stageMap[p.status] || 'discovered',
        notes: p.notes,
        ghl_opportunity_id: null,
        updated_at: new Date().toISOString(),
        grant: linkedGrant || {
          id: p.grant_opportunity_id || p.id,
          name: p.name,
          provider: p.funder || '',
          amount_min: p.amount_numeric ? Number(p.amount_numeric) : null,
          amount_max: null,
          closes_at: p.deadline || null,
          categories: [],
          url: null,
          application_status: p.status,
        },
        _source: 'pipeline',
      };
    });

    // Merge: saved_grants first, then pipeline items not already in saved_grants
    const savedGrantIds = new Set((savedGrants ?? []).map((g: { grant_id: string }) => g.grant_id));
    const merged = [
      ...(savedGrants ?? []),
      ...pipelineAsSaved.filter(p => !savedGrantIds.has(p.grant_id)),
    ];

    return NextResponse.json(merged);
  }

  // Default: personal grants (backwards compatible)
  const { data, error } = await serviceDb
    .from('saved_grants')
    .select(`
      *,
      grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories, url, application_status)
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
