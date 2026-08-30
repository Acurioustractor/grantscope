import { NextResponse } from 'next/server';
import { runFundingGhlSync } from '@/lib/services/funding-ghl-sync';

export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET || process.env.API_SECRET_KEY;
  const supplied = request.headers.get('authorization');
  if (!expected || supplied !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runFundingGhlSync('cron'));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GHL funding sync failed' },
      { status: 500 }
    );
  }
}
