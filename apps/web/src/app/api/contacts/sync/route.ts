import { NextRequest, NextResponse } from 'next/server';
import { upsertContact } from '@/lib/ghl';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  try {
    const { id } = await upsertContact({
      email,
      tags: ['grantscope-user'],
      source: 'grantscope-signup',
    });
    return NextResponse.json({ ok: true, contactId: id });
  } catch (e) {
    console.error('GHL contact sync failed:', e);
    return NextResponse.json({ ok: false, error: 'sync failed' }, { status: 500 });
  }
}
