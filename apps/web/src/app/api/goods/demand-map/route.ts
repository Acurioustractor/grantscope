import { NextRequest, NextResponse } from 'next/server';
import { getGoodsDemandMap } from '@/lib/services/goods-demand-map';

export const dynamic = 'force-dynamic';

// The demand map for the Goods app (Goods Asset Register v2), so it reads one vetted list instead of
// keeping its own procurement-buyers.json. Server to server, same header and secret as the Goods
// app's /api/grantscope/targets. Fails closed: with no secret configured, nobody reads it.
export async function GET(request: NextRequest) {
  const expected = (process.env.GOODS_GRANTSCOPE_SYNC_SECRET || '').trim();
  const provided = (request.headers.get('x-grantscope-secret') || '').trim();
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'A valid x-grantscope-secret is required.' }, { status: 401 });
  }
  const map = await getGoodsDemandMap();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    rules: 'Titles classified by classifyPurchase (apps/web/src/lib/services/goods-demand-map.ts). Custodial buyers are listed apart and are not a decision to sell to them. Places: exact ids only; status says whether Ben confirmed the link.',
    ...map,
  });
}
