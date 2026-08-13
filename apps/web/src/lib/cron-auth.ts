import { NextRequest, NextResponse } from 'next/server';

export function requireCronBearer(request: Request | NextRequest): NextResponse | null {
  const expectedSecret = process.env.CRON_SECRET || process.env.API_SECRET_KEY;
  const supplied = request.headers.get('authorization');

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 503 });
  }

  if (supplied !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
