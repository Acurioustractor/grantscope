import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/gmail';

const MAX_ATTEMPTS = 5;

function isAuthorizedAutomationRequest(request: NextRequest) {
  const expectedSecret =
    process.env.CRON_SECRET
    || process.env.API_SECRET_KEY;
  if (!expectedSecret) return false;
  return request.headers.get('authorization') === `Bearer ${expectedSecret}`;
}

type OutboxRow = {
  id: string;
  user_id: string;
  org_profile_id: string | null;
  grant_id: string;
  subject: string;
  body: string | null;
  match_score: number | null;
  match_signals: string[] | null;
  attempt_count: number;
};

export async function GET(request: NextRequest) {
  if (!isAuthorizedAutomationRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceDb = getServiceSupabase();

  // Fetch queued grant notifications
  const { data: queued, error } = await serviceDb
    .from('grant_notification_outbox')
    .select('id, user_id, org_profile_id, grant_id, subject, body, match_score, match_signals, attempt_count')
    .eq('status', 'queued')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (queued || []) as OutboxRow[];
  if (rows.length === 0) {
    return NextResponse.json({ queued: 0, sent: 0, failed: 0 });
  }

  // Get recipient emails
  const userIds = [...new Set(rows.map(r => r.user_id))];
  const emailMap = new Map<string, string>();

  for (const userId of userIds) {
    const { data } = await serviceDb.auth.admin.getUserById(userId);
    if (data?.user?.email) {
      emailMap.set(userId, data.user.email);
    }
  }

  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  for (const row of rows) {
    const email = emailMap.get(row.user_id);
    const attemptCount = (row.attempt_count || 0) + 1;
    const attemptedAt = new Date().toISOString();

    if (!email) {
      await serviceDb
        .from('grant_notification_outbox')
        .update({
          status: 'cancelled',
          attempt_count: attemptCount,
          last_attempted_at: attemptedAt,
          last_error: 'No recipient email found',
        })
        .eq('id', row.id);
      cancelled++;
      continue;
    }

    try {
      const result = await sendEmail({
        to: email,
        subject: `[CivicGraph] ${row.subject}`,
        body: row.body || `You have a new grant match (${row.match_score}% match).`,
        senderName: 'CivicGraph Grants',
      });

      await serviceDb
        .from('grant_notification_outbox')
        .update({
          status: 'sent',
          sent_at: attemptedAt,
          attempt_count: attemptCount,
          last_attempted_at: attemptedAt,
          last_error: null,
          external_message_id: result.id,
        })
        .eq('id', row.id);
      sent++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delivery failed';
      await serviceDb
        .from('grant_notification_outbox')
        .update({
          status: attemptCount >= MAX_ATTEMPTS ? 'failed' : 'queued',
          attempt_count: attemptCount,
          last_attempted_at: attemptedAt,
          last_error: errorMessage,
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return NextResponse.json({ queued: rows.length, sent, failed, cancelled });
}
