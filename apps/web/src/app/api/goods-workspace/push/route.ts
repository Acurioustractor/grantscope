import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import {
  buildGoodsCrmPayload,
  getGoodsWorkspaceData,
  type GoodsTargetType,
} from '@/lib/goods-workspace-data';

export const dynamic = 'force-dynamic';

const DEFAULT_GOODS_SYNC_URL = 'http://localhost:3000/api/grantscope/targets';

export async function POST(request: NextRequest) {
  const auth = await requireModule('supply-chain');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const targetType = (body?.targetType || 'buyer') as GoodsTargetType;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0) : null;
  const sourceIdentityId = typeof body?.sourceIdentityId === 'string' && body.sourceIdentityId.length > 0
    ? body.sourceIdentityId
    : null;
  const focusCommunityId = typeof body?.focusCommunityId === 'string' && body.focusCommunityId.length > 0
    ? body.focusCommunityId
    : null;

  if (!['buyer', 'capital', 'partner'].includes(targetType)) {
    return NextResponse.json({ error: 'Invalid target type' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const orgContext = await getCurrentOrgProfileContext(serviceDb, user.id);
  const data = await getGoodsWorkspaceData(serviceDb, orgContext);
  const targets = buildGoodsCrmPayload(data, targetType, ids, sourceIdentityId, focusCommunityId);

  const syncUrl = process.env.GOODS_TARGET_SYNC_URL || process.env.GOODS_APP_TARGET_SYNC_URL || DEFAULT_GOODS_SYNC_URL;
  const syncSecret = process.env.GRANTSCOPE_SYNC_SECRET || '';

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(syncSecret ? { 'x-grantscope-secret': syncSecret } : {}),
      },
      body: JSON.stringify({
        source: 'civicgraph-goods-workspace',
        targetType,
        targets,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: result?.error || `Goods CRM sync failed (${response.status})`,
          syncUrl,
          totalTargets: targets.length,
          payload: targets,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      syncUrl,
      totalTargets: targets.length,
      successful: result?.successful ?? targets.length,
      failed: result?.failed ?? 0,
      opportunitiesCreated: result?.opportunitiesCreated ?? 0,
      results: result?.results ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Goods CRM sync failed.',
        syncUrl,
        totalTargets: targets.length,
        payload: targets,
      },
      { status: 502 },
    );
  }
}
