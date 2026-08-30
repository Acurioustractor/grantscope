import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getFundingControlPlane, reconcileFundingSystem } from '@/lib/services/funding-control-plane';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getFundingControlPlane('act'));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funding reconciliation preview failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'confirm=true is required for batch profile and Notion writes' },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await reconcileFundingSystem('act'));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funding reconciliation failed' },
      { status: 502 }
    );
  }
}
