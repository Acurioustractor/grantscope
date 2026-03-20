import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { getGoodsWorkspaceData } from '@/lib/goods-workspace-data';

export const dynamic = 'force-dynamic';

const SYNC_SECRET =
  process.env.GRANTSCOPE_SYNC_SECRET ||
  process.env.GOODS_GRANTSCOPE_SYNC_SECRET ||
  '';

// Hardcoded Goods org user ID for service-to-service calls
const GOODS_SERVICE_USER_ID = process.env.GOODS_SERVICE_USER_ID || '';

/**
 * GET /api/goods-workspace/data
 *
 * Returns the full Goods workspace dataset — communities, buyers, capital targets,
 * partner targets, lifecycle data, NT sweep, and top moves.
 *
 * Auth: shared secret via x-grantscope-secret header.
 * Query params:
 *   section: 'all' | 'communities' | 'buyers' | 'capital' | 'partners' | 'lifecycle' | 'nt-sweep' | 'summary'
 *   states: comma-separated state filter (e.g. 'NT,QLD')
 *   limit: max results per section
 */
export async function GET(request: NextRequest) {
  // Authenticate
  if (SYNC_SECRET) {
    const provided = request.headers.get('x-grantscope-secret') || '';
    if (!provided || provided !== SYNC_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const section = request.nextUrl.searchParams.get('section') || 'all';
  const statesParam = request.nextUrl.searchParams.get('states');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const states = statesParam ? statesParam.split(',').map(s => s.trim().toUpperCase()) : null;
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    const serviceDb = getServiceSupabase();

    // For service-to-service calls, we need an org context.
    // Use the Goods service user if configured, otherwise build a minimal context.
    let orgContext: Awaited<ReturnType<typeof getCurrentOrgProfileContext>>;
    if (GOODS_SERVICE_USER_ID) {
      orgContext = await getCurrentOrgProfileContext(serviceDb, GOODS_SERVICE_USER_ID);
    } else {
      // Minimal fallback context for Goods — matches OrgProfileContext shape
      orgContext = {
        orgProfileId: null,
        currentUserRole: null,
        profile: {
          id: 'goods-service',
          name: 'Goods on Country',
          abn: '50001350152',
          subscription_plan: null,
          org_type: null,
          geographic_focus: ['NT', 'QLD', 'WA', 'SA'],
        },
        isImpersonating: false,
      };
    }

    const data = await getGoodsWorkspaceData(serviceDb, orgContext);

    // Apply state filter if provided
    const filterByState = <T extends { state?: string | null }>(items: T[]) => {
      if (!states) return items;
      return items.filter(item => item.state && states.includes(item.state.toUpperCase()));
    };

    const applyLimit = <T>(items: T[]) => {
      if (!limit || limit <= 0) return items;
      return items.slice(0, limit);
    };

    // Build response based on requested section
    if (section === 'summary') {
      return NextResponse.json({
        orgName: data.orgName,
        workspaceTitle: data.workspaceTitle,
        thesis: data.thesis,
        topMoves: data.topMoves,
        communityCount: data.communities.length,
        buyerCount: data.buyerTargets.length,
        capitalCount: data.capitalTargets.length,
        partnerCount: data.partnerTargets.length,
      });
    }

    if (section === 'communities' || section === 'deployment') {
      return NextResponse.json({
        communities: applyLimit(filterByState(data.communities.map(c => ({ ...c, state: c.state })))),
        count: data.communities.length,
      });
    }

    if (section === 'buyers') {
      return NextResponse.json({
        buyers: applyLimit(filterByState(data.buyerTargets)),
        count: data.buyerTargets.length,
      });
    }

    if (section === 'capital') {
      return NextResponse.json({
        capital: applyLimit(data.capitalTargets),
        pathways: data.capitalPathways,
        count: data.capitalTargets.length,
      });
    }

    if (section === 'partners') {
      return NextResponse.json({
        partners: applyLimit(filterByState(data.partnerTargets)),
        count: data.partnerTargets.length,
      });
    }

    if (section === 'lifecycle') {
      return NextResponse.json({
        lifecycle: data.lifecycle,
      });
    }

    if (section === 'nt-sweep') {
      return NextResponse.json({
        ntSweep: data.ntSweep,
      });
    }

    // Default: return everything
    return NextResponse.json({
      orgName: data.orgName,
      workspaceTitle: data.workspaceTitle,
      thesis: data.thesis,
      topMoves: data.topMoves,
      communities: applyLimit(filterByState(data.communities.map(c => ({ ...c, state: c.state })))),
      buyerTargets: applyLimit(filterByState(data.buyerTargets)),
      capitalTargets: applyLimit(data.capitalTargets),
      partnerTargets: applyLimit(filterByState(data.partnerTargets)),
      capitalPathways: data.capitalPathways,
      lifecycle: data.lifecycle,
      ntSweep: data.ntSweep,
    });
  } catch (error) {
    console.error('[goods-workspace/data] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Goods workspace data' },
      { status: 500 },
    );
  }
}
