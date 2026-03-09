import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('v_data_health')
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const health = data as Record<string, number>;
    const postcodeCoverage = health.entities_with_postcode / health.total_entities * 100;
    const sa2Coverage = health.entities_with_sa2 / health.total_entities * 100;
    const mapCoverage = health.sa2_regions_with_data / health.sa2_regions_total * 100;

    return NextResponse.json({
      ...health,
      postcode_coverage_pct: Math.round(postcodeCoverage * 10) / 10,
      sa2_coverage_pct: Math.round(sa2Coverage * 10) / 10,
      map_coverage_pct: Math.round(mapCoverage * 10) / 10,
      gaps: {
        entities_no_postcode: health.entities_no_postcode,
        entities_postcode_no_sa2: health.entities_postcode_no_sa2,
        postcodes_missing_sa2: health.postcodes_total - health.postcodes_with_sa2,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
