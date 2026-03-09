import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric') || 'total_funding';

  try {
    const supabase = getServiceSupabase();

    // Use the get_sa2_map_data() RPC which joins mv_funding_by_postcode
    // with postcode_geo and aggregates by SA2 — returns all ~710 SA2s
    const { data: features, error } = await supabase.rpc('get_sa2_map_data');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ features: features || [], metric });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
