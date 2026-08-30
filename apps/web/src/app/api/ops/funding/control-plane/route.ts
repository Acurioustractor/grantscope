import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getFundingControlPlane } from '@/lib/services/funding-control-plane';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getFundingControlPlane('act'));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funding control plane failed' },
      { status: 500 }
    );
  }
}
