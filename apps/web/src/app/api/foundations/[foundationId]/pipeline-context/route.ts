import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';

type RouteContext = { params: Promise<{ foundationId: string }> };

interface PipelineContextResponse {
  orgName: string;
  orgSlug: string | null;
  items: Array<{ name: string; status: string; amount_display: string | null; deadline: string | null }>;
}

/**
 * Per-user, never cached at the route level — this is what foundations/[id]/page.tsx
 * used to compute server-side, which made the whole page un-cacheable (it would have
 * baked one org's private pipeline into the shared ISR HTML). Fetched client-side
 * instead so the page itself can be ISR-cached and stay anonymous.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { foundationId } = await context.params;

  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json<{ pipelineContext: null }>({ pipelineContext: null });
  }

  const serviceDb = getServiceSupabase();

  const ctx = await getCurrentOrgProfileContext(serviceDb, user.id);
  if (!ctx.orgProfileId || !ctx.profile) {
    return NextResponse.json<{ pipelineContext: null }>({ pipelineContext: null });
  }

  const { data: foundation } = await serviceDb
    .from('foundations')
    .select('acnc_abn')
    .eq('id', foundationId)
    .maybeSingle();

  if (!foundation?.acnc_abn) {
    return NextResponse.json<{ pipelineContext: null }>({ pipelineContext: null });
  }

  const { data: entity } = await serviceDb
    .from('gs_entities')
    .select('id')
    .eq('abn', foundation.acnc_abn)
    .maybeSingle();

  if (!entity) {
    return NextResponse.json<{ pipelineContext: null }>({ pipelineContext: null });
  }

  const { data: pipelineItems } = await serviceDb
    .from('org_pipeline')
    .select('name, status, amount_display, deadline')
    .eq('org_profile_id', ctx.orgProfileId)
    .eq('funder_entity_id', entity.id)
    .order('created_at', { ascending: false });

  if (!pipelineItems || pipelineItems.length === 0) {
    return NextResponse.json<{ pipelineContext: null }>({ pipelineContext: null });
  }

  const { data: orgProfile } = await serviceDb
    .from('org_profiles')
    .select('slug')
    .eq('id', ctx.orgProfileId)
    .maybeSingle();

  const pipelineContext: PipelineContextResponse = {
    orgName: ctx.profile.name,
    orgSlug: orgProfile?.slug ?? null,
    items: pipelineItems,
  };

  return NextResponse.json({ pipelineContext });
}
