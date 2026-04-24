import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { deliverQueuedGrantNotifications } from '@/lib/grant-notifications';

export async function POST(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const requestedLimit = typeof body?.limit === 'number' ? body.limit : 25;
  const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 50);

  try {
    const result = await deliverQueuedGrantNotifications({
      userId: user.id,
      limit,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to deliver queued notifications.' },
      { status: 500 }
    );
  }
}
