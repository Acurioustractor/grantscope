import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import {
  getFundingGhlAlignmentStatus,
  runFundingGhlAlignment,
} from '@/lib/services/funding-ghl-alignment';
import { runFundingGhlSync } from '@/lib/services/funding-ghl-sync';

export const maxDuration = 300;

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  return NextResponse.json(await getFundingGhlAlignmentStatus());
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
    return NextResponse.json({ error: 'confirm=true is required for cross-system writes' }, { status: 400 });
  }
  try {
    const sync = await runFundingGhlSync('manual');
    const alignment = sync.status === 'succeeded'
      ? await runFundingGhlAlignment('manual', { createInbox: true, applySafe: true })
      : null;
    return NextResponse.json({ sync, alignment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funding alignment failed' },
      { status: 502 }
    );
  }
}
