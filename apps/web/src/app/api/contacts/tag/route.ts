import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { addTagToContact, removeTagFromContact } from '@/lib/ghl';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
