import { NextResponse } from 'next/server';
import { getActOpportunityContextStatus } from '@/lib/services/act-opportunity-context';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getServiceSupabase } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{ orgProfileId: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveOrgProfileId(identifier: string): Promise<string | null> {
  if (!UUID_RE.test(identifier)) {
    const profile = await getOrgProfileBySlug(identifier);
    return profile?.id ?? null;
  }

  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('org_profiles')
    .select('id')
    .eq('id', identifier)
    .maybeSingle();

  return data?.id ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const resolvedOrgProfileId = await resolveOrgProfileId(orgProfileId);

  if (!resolvedOrgProfileId) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
  }

  const status = await getActOpportunityContextStatus(resolvedOrgProfileId);
  return NextResponse.json(status);
}
