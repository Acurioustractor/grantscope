import { NextRequest, NextResponse } from 'next/server';
import { recordAlertEvents, type AlertEventType } from '@/lib/alert-events';
import { getServiceSupabase } from '@/lib/supabase';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

type TrackingContext = {
  userId: string | null;
  alertPreferenceId: number | null;
  notificationId: string | null;
  grantId: string | null;
};

async function resolveTrackingContext(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source');
  const notificationId = request.nextUrl.searchParams.get('notificationId');
  const alertIdParam = request.nextUrl.searchParams.get('alertId');
  const grantId = request.nextUrl.searchParams.get('grantId');
  const fallbackUserId = request.nextUrl.searchParams.get('userId');
  const alertPreferenceId = alertIdParam ? Number(alertIdParam) : null;
  const db = getServiceSupabase();

  if (source === 'notification' && notificationId) {
    const { data } = await db
      .from('grant_notification_outbox')
      .select('user_id, alert_preference_id, grant_id')
      .eq('id', notificationId)
      .maybeSingle();

    if (data?.user_id) {
      return {
        source,
        context: {
          userId: data.user_id,
          alertPreferenceId: data.alert_preference_id ?? alertPreferenceId,
          notificationId,
          grantId: data.grant_id ?? grantId,
        } satisfies TrackingContext,
      };
    }
  }

  if (source === 'digest' && alertPreferenceId != null) {
    const { data } = await db
      .from('alert_preferences')
      .select('user_id')
      .eq('id', alertPreferenceId)
      .maybeSingle();

    if (data?.user_id) {
      return {
        source,
        context: {
          userId: data.user_id,
          alertPreferenceId,
          notificationId: notificationId || null,
          grantId: grantId || null,
        } satisfies TrackingContext,
      };
    }
  }

  return {
    source,
    context: {
      userId: fallbackUserId,
      alertPreferenceId,
      notificationId: notificationId || null,
      grantId: grantId || null,
    } satisfies TrackingContext,
  };
}

export async function GET(request: NextRequest) {
  const { source, context } = await resolveTrackingContext(request);
  const eventType: AlertEventType | null =
    source === 'notification'
      ? 'notification_opened'
      : source === 'digest'
        ? 'digest_opened'
        : null;

  if (eventType && context.userId) {
    await recordAlertEvents([
      {
        userId: context.userId,
        alertPreferenceId: context.alertPreferenceId,
        notificationId: context.notificationId,
        grantId: context.grantId,
        eventType,
        metadata: { source },
      },
    ]);
  }

  return new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_GIF.byteLength),
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
