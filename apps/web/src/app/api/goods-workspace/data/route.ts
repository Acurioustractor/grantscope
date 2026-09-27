import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import {
  GOODS_FEED_SECTIONS,
  type GoodsFeedSection,
  getVerifiedCommunities,
  getWaSellerSweep,
  goodsFeedSecret,
  isGoodsFeedAuthorised,
} from '@/lib/services/goods-workspace-feed';

export const dynamic = 'force-dynamic';

// Secret-gated per-caller data: never let a CDN or browser keep a copy.
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/goods-workspace/data?section=communities|wa-sweep[&states=WA,NT][&limit=n]
 * Auth: x-grantscope-secret must equal GRANTSCOPE_SYNC_SECRET. Unset secret = 503, never open.
 * Read-only feed for Goods on Country; see lib/services/goods-workspace-feed.ts for what it
 * deliberately does not send (modelled demand, unsourced buyers, dollar totals).
 */
export async function GET(request: NextRequest) {
  const secret = goodsFeedSecret();
  if (!secret) return NextResponse.json({ error: 'Feed not configured' }, { status: 503 });
  if (!isGoodsFeedAuthorised(request.headers.get('x-grantscope-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const section = request.nextUrl.searchParams.get('section') ?? '';
  if (!GOODS_FEED_SECTIONS.includes(section as GoodsFeedSection)) {
    return NextResponse.json({ error: `section must be one of: ${GOODS_FEED_SECTIONS.join(', ')}` }, { status: 400 });
  }
  const states = request.nextUrl.searchParams.get('states')?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) ?? null;
  const limit = Number(request.nextUrl.searchParams.get('limit')) || undefined;

  try {
    const db = getServiceSupabase();
    if (section === 'communities') {
      const communities = await getVerifiedCommunities(db, { states, limit });
      return NextResponse.json({ communities, count: communities.length, demandProvided: false }, { headers: NO_STORE });
    }
    const sellers = await getWaSellerSweep(db, { limit });
    return NextResponse.json({ waSweep: { sellers, count: sellers.length, basis: 'wa_transition_candidates, supplier_is_community_controlled, resolver v2 exact identity' } }, { headers: NO_STORE });
  } catch (error) {
    console.error('[goods-workspace/data]', error);
    return NextResponse.json({ error: 'Failed to load Goods feed' }, { status: 500 });
  }
}
