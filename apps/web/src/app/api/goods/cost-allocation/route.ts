import { NextRequest, NextResponse } from 'next/server';

import { requireModule } from '@/lib/api-auth';
import {
  saveGoodsCostAllocationDecision,
  type GoodsCostAllocationSaveInput,
} from '@/lib/services/goods-cost-evidence';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModule('tracker');
    if (auth.error) return auth.error;

    const body = (await request.json()) as GoodsCostAllocationSaveInput;
    if (!body.lineFingerprint || !body.xeroInvoiceId || typeof body.lineIndex !== 'number') {
      return NextResponse.json({ error: 'lineFingerprint, xeroInvoiceId, and lineIndex are required' }, { status: 400 });
    }
    if (!body.decision) {
      return NextResponse.json({ error: 'decision is required' }, { status: 400 });
    }

    const decision = await saveGoodsCostAllocationDecision({
      ...body,
      decidedBy: auth.user.email || auth.user.id,
    });

    return NextResponse.json({ decision });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to save Goods cost allocation decision',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
