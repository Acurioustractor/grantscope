import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric') || 'total_funding';

  try {
    const supabase = getServiceSupabase();

    // Read from materialized view (fast) instead of computing on the fly
    const all: Record<string, unknown>[] = [];
    let offset = 0;
    const PAGE = 1000;
    let error: { message: string } | null = null;
    while (true) {
      const { data: page, error: pageError } = await supabase
        .from('mv_sa2_map_data')
        .select('*')
        .range(offset, offset + PAGE - 1);
      if (pageError) { error = pageError; break; }
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ features: all, metric });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
