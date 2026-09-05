import { NextResponse, type NextRequest } from 'next/server';
import { parseSearchQuery, searchIndex } from '@/lib/search/search-index';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search/index?q=…&kinds=charity,foundation&state=NT&limit=20
 * Lexical search over the whole spine (mv_search_index via search_index_query). Public civic data only; the
 * matview excludes every private object by construction. Cached at the edge for five minutes: the index is nightly.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = parseSearchQuery({ q: sp.get('q'), kinds: sp.get('kinds'), state: sp.get('state'), limit: sp.get('limit') });
  if (!query) return NextResponse.json({ hits: [], query: null }, { status: 200 });
  try {
    const hits = await searchIndex(query);
    return NextResponse.json(
      { hits, query },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
