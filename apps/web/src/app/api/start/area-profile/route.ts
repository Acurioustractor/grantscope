import { NextRequest, NextResponse } from 'next/server';
import { getAreaProfile } from '@/lib/services/intake-intelligence';

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get('postcode');
  if (!postcode) return NextResponse.json({ error: 'postcode required' }, { status: 400 });

  const profile = await getAreaProfile(postcode);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(profile, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
