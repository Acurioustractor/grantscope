import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** The SE/charity drawer payload, one call by ABN: the kind's own record, ACNC financial
 *  history, cross-system presence, and the people on record. */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const abn = url.searchParams.get('abn');
  const kind = url.searchParams.get('kind');
  if (!abn || !kind) return NextResponse.json({ error: 'abn and kind required' }, { status: 400 });

  const supabase = getDirectServiceSupabase();
  const [detail, ais, power, people, peopleCount] = await Promise.all([
    kind === 'se'
      ? supabase
          .from('social_enterprises')
          .select('name,abn,sector,state,city,website,description,certifications,org_type')
          .eq('abn', abn)
          .limit(1)
          .then((r) => r.data?.[0] ?? null)
      : supabase
          .from('acnc_charities')
          .select('name,abn,charity_size,state,is_foundation,purposes,beneficiaries')
          .eq('abn', abn)
          .limit(1)
          .then((r) => r.data?.[0] ?? null),
    supabase
      .from('acnc_ais')
      .select('ais_year,total_revenue,grants_donations_au,total_assets,staff_fte,staff_volunteers')
      .eq('abn', abn)
      .order('ais_year', { ascending: false })
      .limit(6)
      .then((r) => r.data ?? []),
    supabase
      .from('mv_entity_power_index')
      .select('gs_id,system_count,total_dollar_flow,procurement_dollars,recorded_grants_dollars,donation_dollars,contract_count,recorded_grants_count')
      .eq('abn', abn)
      .limit(1)
      .then((r) => r.data?.[0] ?? null),
    supabase
      .from('person_roles')
      .select('person_name,role_type')
      .eq('company_abn', abn)
      .is('cessation_date', null)
      .limit(8)
      .then((r) => r.data ?? []),
    supabase
      .from('person_roles')
      .select('id', { count: 'exact', head: true })
      .eq('company_abn', abn)
      .is('cessation_date', null)
      .then((r) => r.count ?? 0),
  ]);
  if (!detail) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ detail, ais, power, people, peopleCount });
}
