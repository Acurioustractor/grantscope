import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gsId: string }> }
) {
  const { gsId } = await params;
  const supabase = getServiceSupabase();

  const { data: entity } = await supabase
    .from('gs_entities')
    .select('postcode, state, canonical_name')
    .eq('gs_id', gsId)
    .single();

  if (!entity?.postcode) {
    return NextResponse.json({ error: 'Entity not found or no postcode' }, { status: 404 });
  }

  const [{ data: geo }, { data: seifa }, { count }] = await Promise.all([
    supabase
      .from('postcode_geo')
      .select('postcode, locality, state, remoteness_2021, sa2_name, sa3_name')
      .eq('postcode', entity.postcode)
      .limit(1),
    supabase
      .from('seifa_2021')
      .select('decile_national, score')
      .eq('postcode', entity.postcode)
      .eq('index_type', 'IRSD')
      .limit(1),
    supabase
      .from('gs_entities')
      .select('id', { count: 'exact', head: true })
      .eq('postcode', entity.postcode),
  ]);

  return NextResponse.json({
    postcode: entity.postcode,
    state: entity.state,
    locality: geo?.[0]?.locality || null,
    remoteness: geo?.[0]?.remoteness_2021 || null,
    sa2_name: geo?.[0]?.sa2_name || null,
    sa3_name: geo?.[0]?.sa3_name || null,
    seifa_irsd_decile: seifa?.[0]?.decile_national || null,
    seifa_irsd_score: seifa?.[0]?.score || null,
    entity_count: count || 0,
  });
}
