import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getFundingGhlSyncStatus, runFundingGhlSync } from '@/lib/services/funding-ghl-sync';

export const maxDuration = 60;

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getFundingGhlSyncStatus());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GHL funding sync status failed' },
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
    return NextResponse.json({ error: 'confirm=true is required to run the GHL funding sync' }, { status: 400 });
  }
  try {
    return NextResponse.json(await runFundingGhlSync('manual'));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GHL funding sync failed' },
      { status: 500 }
    );
  }
}
