import { NextResponse } from 'next/server';
import { runFundingGhlAlignment } from '@/lib/services/funding-ghl-alignment';
import { runFundingGhlSync } from '@/lib/services/funding-ghl-sync';

export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET || process.env.API_SECRET_KEY;
  const supplied = request.headers.get('authorization');
  if (!expected || supplied !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const sync = await runFundingGhlSync('cron');
    const alignment = sync.status === 'succeeded'
      ? await runFundingGhlAlignment('cron', { createInbox: true, applySafe: true })
      : null;
    return NextResponse.json({ sync, alignment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funding reconciliation failed' },
      { status: 500 }
    );
  }
}
