import { NextRequest, NextResponse } from 'next/server';
import { promoteGoodsGrantToNotion } from '@/lib/services/goods-grant-notion';
import { getGoodsGrantWriteContext } from '@/lib/services/goods-grant-write-context';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const context = await getGoodsGrantWriteContext();
  if (context.error) return context.error;
  const body = await request.json().catch(() => ({})) as { grantId?: string; projectCode?: string; fundingBlockIds?: string[] };
  if (!body.grantId) return NextResponse.json({ error: 'grantId is required' }, { status: 400 });
  try {
    return NextResponse.json(await promoteGoodsGrantToNotion({
      grantId: body.grantId,
      reviewerId: context.userId,
      orgProfileId: context.orgProfileId,
      projectCode: body.projectCode,
      fundingBlockIds: body.fundingBlockIds,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Notion promotion failed' }, { status: 422 });
  }
}
