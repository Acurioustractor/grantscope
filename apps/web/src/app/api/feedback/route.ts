import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

const GHL_API_URL = 'https://services.leadconnectorhq.com';

const TYPE_TAGS: Record<string, string> = {
  issue: 'GS-Feedback-Issue',
  data_source: 'GS-Feedback-DataSource',
  idea: 'GS-Feedback-Idea',
  other: 'GS-Feedback-Other',
};

async function pushToGHL(type: string, name: string | null, email: string | null, message: string) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return;

  try {
    const [firstName, ...rest] = (name || 'GrantScope User').split(' ');
    const lastName = rest.join(' ') || undefined;

    const contactEmail = email || `grantscope-${Date.now()}@feedback.local`;

    // Upsert contact
    const res = await fetch(`${GHL_API_URL}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        locationId,
        email: contactEmail,
        firstName,
        lastName,
        tags: ['GrantScope', TYPE_TAGS[type] || 'GS-Feedback'],
        source: 'GrantScope Process Page',
      }),
    });

    if (!res.ok) {
      console.error('[feedback-ghl] Contact upsert failed:', res.status);
      return;
    }

    const data = await res.json();
    const contactId = data?.contact?.id;
    if (!contactId) return;

    // Create an inbound conversation message (shows in GHL Messages tab)
    const typeLabel = TYPE_TAGS[type]?.replace('GS-Feedback-', '') || type;
    await fetch(`${GHL_API_URL}/conversations/messages/inbound`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        type: 'Custom',
        contactId,
        message: `[GrantScope ${typeLabel}]\n\n${message}`,
      }),
    });
  } catch (err) {
    console.error('[feedback-ghl] Error:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, email, message } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const validTypes = ['issue', 'data_source', 'idea', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 });
    }

    const trimmedName = name?.trim() || null;
    const trimmedEmail = email?.trim() || null;
    const trimmedMessage = message.trim();

    // Save to Supabase + push to GHL in parallel
    const [supaResult] = await Promise.all([
      getServiceSupabase().from('community_feedback').insert({
        type,
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
      }),
      pushToGHL(type, trimmedName, trimmedEmail, trimmedMessage),
    ]);

    if (supaResult.error) {
      console.error('[feedback]', supaResult.error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
