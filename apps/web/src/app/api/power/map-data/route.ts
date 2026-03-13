import { NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric') || 'total_funding';

  try {
    const supabase = getServiceSupabase();

    // Uses sa2_reference (all 2,473 SA2s) joined to gs_entities + SEIFA
    // Supabase RPC defaults to 1000 row limit; fetch all via pagination
    const all: Record<string, unknown>[] = [];
    let offset = 0;
    const PAGE = 1000;
    let error: { message: string } | null = null;
    while (true) {
      const { data: page, error: pageError } = await supabase
        .rpc('get_sa2_map_data')
        .range(offset, offset + PAGE - 1);
      if (pageError) { error = pageError; break; }
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < PAGE) break;
      offset += PAGE;
    }
    const features = all;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ features: features || [], metric });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
