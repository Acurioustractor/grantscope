import { NextResponse } from 'next/server';
import { getGoodsReadinessSnapshot } from '@/lib/goods-readiness-snapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getGoodsReadinessSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to build Goods readiness snapshot',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
