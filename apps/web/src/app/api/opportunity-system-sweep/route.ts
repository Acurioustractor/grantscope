import { NextResponse } from 'next/server';
import { getOpportunitySystemSweep } from '@/lib/opportunity-system-sweep';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sweep = await getOpportunitySystemSweep();
    return NextResponse.json(sweep);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to build opportunity system sweep',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
