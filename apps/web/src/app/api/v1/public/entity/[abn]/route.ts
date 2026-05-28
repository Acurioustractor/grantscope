import { NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/atlas/rate-limit';

export const runtime = 'nodejs';
export const revalidate = 600;

type Params = { abn: string };

export async function GET(req: Request, { params }: { params: Promise<Params> }) {
  const rl = rateLimit(ipFromRequest(req));
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const { abn } = await params;
  const cleaned = abn.replace(/\D/g, '');
  if (cleaned.length !== 11) {
    return NextResponse.json({ error: 'invalid_abn', message: 'ABN must be 11 digits.' }, { status: 400 });
  }

  const supabase = getDirectServiceSupabase();
  const { data: entity, error } = await supabase
    .from('gs_entities')
    .select('id,gs_id,canonical_name,entity_type,abn,state,postcode,sector,lga_name,is_community_controlled,latest_revenue,latest_assets,financial_year,first_seen,last_seen')
    .eq('abn', cleaned)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'lookup_failed', message: error.message }, { status: 500 });
  }
  if (!entity) {
    return NextResponse.json({ error: 'not_found', abn: cleaned }, { status: 404 });
  }

  // Pull cross-system summary from mv_revolving_door (best-effort)
  const { data: revolving } = await supabase
    .from('mv_revolving_door')
    .select('influence_vectors,lobbies,donates,contracts,receives_funding,total_donated,total_contracts,total_funded,revolving_door_score,parties_funded')
    .eq('id', entity.id)
    .maybeSingle();

  // Pull power index row (best-effort)
  const { data: power } = await supabase
    .from('mv_entity_power_index')
    .select('system_count,power_score,total_dollar_flow,procurement_dollars,justice_dollars,donation_dollars')
    .eq('id', entity.id)
    .maybeSingle();

  return NextResponse.json(
    {
      meta: {
        source: 'gs_entities + mv_revolving_door + mv_entity_power_index',
        generated_at: new Date().toISOString(),
        license: 'CC-BY 4.0',
      },
      data: {
        entity,
        revolving_door: revolving ?? null,
        power_index: power ?? null,
      },
    },
    { headers: rateLimitHeaders(rl) }
  );
}
