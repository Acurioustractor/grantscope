import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { addTagToContact, removeTagFromContact } from '@/lib/ghl';

export async function POST(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;

  const { contactId, tag } = await request.json();
  if (!contactId || !tag) {
    return NextResponse.json({ error: 'contactId and tag required' }, { status: 400 });
  }

  try {
    await addTagToContact(contactId, tag);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;

  const { contactId, tag } = await request.json();
  if (!contactId || !tag) {
    return NextResponse.json({ error: 'contactId and tag required' }, { status: 400 });
  }

  try {
    await removeTagFromContact(contactId, tag);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
