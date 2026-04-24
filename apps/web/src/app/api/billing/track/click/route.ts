import { NextRequest, NextResponse } from 'next/server';
import { recordProductEvents } from '@/lib/product-events';
import { resolveBillingReminderRedirect } from '@/lib/billing-link-tracking';
import { getServiceSupabase } from '@/lib/supabase';

type TrackingContext = {
  userId: string | null;
  orgProfileId: string | null;
};

async function resolveTrackingContext(request: NextRequest): Promise<TrackingContext> {
  const orgProfileId = request.nextUrl.searchParams.get('orgProfileId');
  const fallbackUserId = request.nextUrl.searchParams.get('userId');
  const db = getServiceSupabase();

  if (orgProfileId) {
    const { data } = await db
      .from('org_profiles')
      .select('user_id')
      .eq('id', orgProfileId)
      .maybeSingle();

    if (data?.user_id) {
      return {
        userId: data.user_id,
        orgProfileId,
      };
    }
  }

  return {
    userId: fallbackUserId,
    orgProfileId,
  };
}

export async function GET(request: NextRequest) {
  const reminderType = request.nextUrl.searchParams.get('reminderType') || 'unknown';
  const targetPath = request.nextUrl.searchParams.get('target');
  const { userId, orgProfileId } = await resolveTrackingContext(request);

  if (userId) {
    await recordProductEvents([
      {
        userId,
        orgProfileId,
        eventType: 'billing_reminder_clicked',
        metadata: {
          source: 'billing_reminder_email',
          reminder_type: reminderType,
          target_path: targetPath || '/profile',
        },
      },
    ]);
  }

  return NextResponse.redirect(resolveBillingReminderRedirect(targetPath), { status: 307 });
}
