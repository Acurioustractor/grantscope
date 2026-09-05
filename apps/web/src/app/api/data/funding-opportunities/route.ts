import { NextResponse, type NextRequest } from 'next/server';
import { fundingOpportunityCounts, listFundingOpportunities, type FundingQuery } from '@/lib/funding/opportunities';

export const dynamic = 'force-dynamic';

/**
 * GET /api/data/funding-opportunities?open=1&q=youth&origin=grant_opportunities&limit=50
 *
 * The one read path for a fundable thing, for this app and for JusticeHub, Empathy Ledger and act-global, so they stop
 * writing their own SQL against grant_opportunities and alma_funding_opportunities. Unranked by design: see
 * lib/funding/opportunities.ts.
 */
const ORIGINS = ['grant_opportunities', 'foundation_programs', 'alma_funding_opportunities'] as const;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const originParam = sp.get('origin');
  const query: FundingQuery = {
    openOnly: sp.get('open') === '1' || sp.get('open') === 'true',
    search: sp.get('q')?.trim() || undefined,
    origin: (ORIGINS as readonly string[]).includes(originParam ?? '')
      ? (originParam as FundingQuery['origin'])
      : undefined,
    closesBefore: sp.get('closes_before') || undefined,
    minAmount: sp.get('min_amount') ? Number(sp.get('min_amount')) : undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
  };

  try {
    const [opportunities, counts] = await Promise.all([
      listFundingOpportunities(query),
      sp.get('counts') === '1' ? fundingOpportunityCounts() : Promise.resolve(undefined),
    ]);
    return NextResponse.json(
      { opportunities, counts, query },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
