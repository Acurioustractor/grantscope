import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

function validateSignature(rawBody: string, providedSignature: string | null, signingSecret: string | null) {
  if (!signingSecret) return null;
  if (!providedSignature) return false;

  const expected = createHmac('sha256', signingSecret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const serviceDb = getServiceSupabase();
  const { data: channel, error } = await serviceDb
    .from('procurement_notification_channels')
    .select('channel_name, enabled')
    .eq('verification_token', token)
    .maybeSingle();

  if (error || !channel) {
    return NextResponse.json({ error: 'Inspector endpoint not found.' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    channelName: channel.channel_name,
    enabled: channel.enabled,
    message: 'CivicGraph webhook inspector is ready to receive test deliveries.',
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const serviceDb = getServiceSupabase();
  const { data: channel, error } = await serviceDb
    .from('procurement_notification_channels')
    .select('id, org_profile_id, channel_name, signing_secret')
    .eq('verification_token', token)
    .maybeSingle();

  if (error || !channel) {
    return NextResponse.json({ error: 'Inspector endpoint not found.' }, { status: 404 });
  }

  const rawBody = await request.text();
  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
  } catch {
    parsedPayload = { raw_body: rawBody };
  }

  const headers = Object.fromEntries(request.headers.entries());
  const signatureValid = validateSignature(rawBody, request.headers.get('x-civicgraph-signature'), channel.signing_secret || null);
  const eventType = request.headers.get('x-civicgraph-event')
    || (typeof parsedPayload.event_type === 'string' ? parsedPayload.event_type : null);

  const receivedAt = new Date().toISOString();
  const { error: receiptError } = await serviceDb
    .from('procurement_webhook_receipts')
    .insert({
      org_profile_id: channel.org_profile_id,
      channel_id: channel.id,
      source: 'procurement_webhook_inspector',
      event_type: eventType,
      signature_valid: signatureValid,
      request_headers: headers,
      payload: parsedPayload,
      received_at: receivedAt,
    });

  if (receiptError) {
    return NextResponse.json({ error: receiptError.message }, { status: 500 });
  }

  await serviceDb
    .from('procurement_notification_channels')
    .update({
      verification_status: signatureValid === false ? 'failed' : 'passed',
      last_tested_at: receivedAt,
      last_test_error: signatureValid === false ? 'Signature check failed on inspector receipt' : null,
    })
    .eq('id', channel.id);

  return NextResponse.json({
    ok: true,
    channelName: channel.channel_name,
    eventType,
    signatureValid,
    receivedAt,
  });
}
