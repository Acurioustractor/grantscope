import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Everything the foundation drawer needs in one call: the record, six years of ACNC financials
 *  (revenue, actually-granted, assets), top grantees, board paths, regranting chains, links. */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = getDirectServiceSupabase();
  const { data: fs, error } = await supabase
    .from('foundations')
    .select('id,name,acnc_abn,type,total_giving_annual,avg_grant_size,thematic_focus,geographic_focus,website')
    .eq('id', id)
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!fs?.length) return NextResponse.json({ error: 'no such foundation' }, { status: 404 });
  const f = fs[0];

  const [ais, grantees, granteeCount, board, regrant, entity] = await Promise.all([
    f.acnc_abn
      ? supabase
          .from('acnc_ais')
          .select('ais_year,total_revenue,grants_donations_au,total_assets,net_assets_liabilities')
          .eq('abn', f.acnc_abn)
          .order('ais_year', { ascending: false })
          .limit(6)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    supabase
      .from('mv_foundation_grantees')
      .select('grantee_gs_id,grantee_name,grantee_type,grantee_state,grantee_community_controlled,grant_year')
      .eq('foundation_id', id)
      .order('grant_year', { ascending: false })
      .limit(12)
      .then((r) => r.data ?? []),
    supabase
      .from('mv_foundation_grantees')
      .select('foundation_id', { count: 'exact', head: true })
      .eq('foundation_id', id)
      .then((r) => r.count ?? 0),
    supabase
      .from('funder_board_paths')
      .select('person_name,role_at_funder,connected_entity_name,identity_confidence,collision_risk')
      .eq('foundation_id', id)
      .limit(10)
      .then((r) => r.data ?? []),
    f.acnc_abn
      ? supabase
          .from('mv_foundation_regranting')
          .select('regranter_name,ultimate_grantee,downstream_amount,downstream_year')
          .eq('source_abn', f.acnc_abn)
          .limit(6)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    f.acnc_abn
      ? supabase.from('gs_entities').select('gs_id').eq('abn', f.acnc_abn).limit(1).then((r) => r.data?.[0]?.gs_id ?? null)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ foundation: f, ais, grantees, granteeCount, board, regrant, gsId: entity });
}
