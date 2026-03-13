import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  getProcurementNotificationChannels,
  upsertProcurementNotificationChannel,
} from '../../_lib/procurement-workspace';

export async function GET() {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const serviceDb = getServiceSupabase();
    const result = await getProcurementNotificationChannels(serviceDb, user.id);
    return NextResponse.json({ channels: result.channels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load notification channels' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const channelName = typeof body?.channelName === 'string' ? body.channelName : '';
  const endpointUrl = typeof body?.endpointUrl === 'string' ? body.endpointUrl : '';
  const eventTypes = Array.isArray(body?.eventTypes) ? body.eventTypes.filter((value: unknown): value is string => typeof value === 'string') : [];

  try {
    const serviceDb = getServiceSupabase();
    const result = await upsertProcurementNotificationChannel(serviceDb, user.id, {
      channelName,
      endpointUrl,
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : true,
      eventTypes,
      signingSecret: typeof body?.signingSecret === 'string' ? body.signingSecret : null,
    });
    return NextResponse.json({ channel: result.channel }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create notification channel' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const channelId = typeof body?.channelId === 'string' ? body.channelId : null;
  const channelName = typeof body?.channelName === 'string' ? body.channelName : '';
  const endpointUrl = typeof body?.endpointUrl === 'string' ? body.endpointUrl : '';
  const eventTypes = Array.isArray(body?.eventTypes) ? body.eventTypes.filter((value: unknown): value is string => typeof value === 'string') : [];

  if (!channelId) {
    return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
  }

  try {
    const serviceDb = getServiceSupabase();
    const result = await upsertProcurementNotificationChannel(serviceDb, user.id, {
      channelId,
      channelName,
      endpointUrl,
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : true,
      eventTypes,
      signingSecret: typeof body?.signingSecret === 'string' ? body.signingSecret : null,
    });
    return NextResponse.json({ channel: result.channel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update notification channel' },
      { status: 500 },
    );
  }
}
