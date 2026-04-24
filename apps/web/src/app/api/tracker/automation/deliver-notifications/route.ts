import { NextRequest, NextResponse } from 'next/server';
import { deliverQueuedGrantNotifications } from '@/lib/grant-notifications';

function isAuthorizedAutomationRequest(request: NextRequest) {
  const expectedSecret =
    process.env.CRON_SECRET
    || process.env.API_SECRET_KEY;
  if (!expectedSecret) return false;
  return request.headers.get('authorization') === `Bearer ${expectedSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAutomationRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await deliverQueuedGrantNotifications({ limit: 50 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to deliver queued notifications.' },
      { status: 500 }
    );
  }
}
