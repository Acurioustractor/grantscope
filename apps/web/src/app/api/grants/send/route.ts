import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendGrantEmail } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { grantId, contactIds } = await request.json();
  if (!grantId || !Array.isArray(contactIds) || contactIds.length === 0) {
    return NextResponse.json({ error: 'grantId and contactIds[] required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();

  // Fetch grant details
  const { data: grant, error: grantErr } = await serviceDb
    .from('grants')
    .select('name, amount_min, amount_max, closes_at, description, url')
    .eq('id', grantId)
    .single();

  if (grantErr || !grant) {
    return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
  }

  // Fetch contacts
  const { data: contacts, error: contactErr } = await serviceDb
    .from('ghl_contacts')
    .select('id, email, first_name')
    .in('id', contactIds);

  if (contactErr) {
    return NextResponse.json({ error: contactErr.message }, { status: 500 });
  }

  // Format amount
  const amount = grant.amount_max && grant.amount_max !== grant.amount_min
    ? `$${(grant.amount_min || 0).toLocaleString()} – $${grant.amount_max.toLocaleString()}`
    : grant.amount_min
      ? `$${grant.amount_min.toLocaleString()}`
      : 'Not specified';

  const closes = grant.closes_at
    ? new Date(grant.closes_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Ongoing';

  const grantData = {
    name: grant.name,
    amount,
    closes,
    description: grant.description || '',
    url: grant.url || '',
  };

  const sent: string[] = [];
  const failed: string[] = [];

  for (const contact of contacts || []) {
    if (!contact.email) {
      failed.push(contact.id);
      continue;
    }
    try {
      await sendGrantEmail(contact.email, grantData);
      sent.push(contact.id);
    } catch {
      failed.push(contact.id);
    }
  }

  return NextResponse.json({ sent, failed });
}
