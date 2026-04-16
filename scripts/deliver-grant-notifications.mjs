#!/usr/bin/env node
/**
 * Grant Notification Delivery
 *
 * Processes queued grant notifications from grant_notification_outbox
 * and delivers via email using Gmail sender.
 *
 * Designed to be called from a cron API endpoint.
 *
 * Usage:
 *   node --env-file=.env scripts/deliver-grant-notifications.mjs [--limit=50] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const GOOGLE_DELEGATED_USER = process.env.GOOGLE_DELEGATED_USER;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '50', 10);
const MAX_ATTEMPTS = 5;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Gmail Send (lightweight, no Next.js dependency) ─────────────────────

import crypto from 'crypto';

async function getGoogleAccessToken(credentials, subject, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    sub: subject,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(credentials.private_key, 'base64url');
  const jwt = `${signInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) throw new Error(`Google auth error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function sendEmail({ to, subject, body }) {
  if (!GOOGLE_SERVICE_ACCOUNT_KEY || !GOOGLE_DELEGATED_USER) {
    throw new Error('Gmail not configured');
  }

  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const accessToken = await getGoogleAccessToken(credentials, GOOGLE_DELEGATED_USER, [
    'https://www.googleapis.com/auth/gmail.send',
  ]);

  const message = [
    `From: CivicGraph Grants <${GOOGLE_DELEGATED_USER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body,
  ].join('\r\n');

  const encodedMessage = Buffer.from(message).toString('base64url');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  return { id: data?.id || null };
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(db, 'deliver-grant-notifications', 'Deliver Grant Notifications');

  try {
    console.log('=== Deliver Grant Notifications ===');
    console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`  Limit: ${LIMIT}`);
    console.log();

    // Fetch queued notifications
    const { data: queued, error } = await db
      .from('grant_notification_outbox')
      .select('id, user_id, grant_id, alert_preference_id, subject, body, match_score, match_signals, attempt_count')
      .eq('status', 'queued')
      .lt('attempt_count', MAX_ATTEMPTS)
      .order('queued_at', { ascending: true })
      .limit(LIMIT);

    if (error) throw error;
    if (!queued?.length) {
      console.log('No queued notifications.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`${queued.length} notifications to deliver`);

    // Get recipient emails
    const userIds = [...new Set(queued.map(n => n.user_id))];
    const emailMap = new Map();

    for (const userId of userIds) {
      const { data } = await db.auth.admin.getUserById(userId);
      if (data?.user?.email) {
        emailMap.set(userId, data.user.email);
      }
    }

    let sent = 0;
    let failed = 0;
    let cancelled = 0;
    const eventRows = [];

    for (const notification of queued) {
      const email = emailMap.get(notification.user_id);
      const attemptCount = (notification.attempt_count || 0) + 1;
      const attemptedAt = new Date().toISOString();

      if (!email) {
        await db
          .from('grant_notification_outbox')
          .update({
            status: 'cancelled',
            attempt_count: attemptCount,
            last_attempted_at: attemptedAt,
            last_error: 'No recipient email found',
          })
          .eq('id', notification.id);
        cancelled++;
        eventRows.push({
          user_id: notification.user_id,
          alert_preference_id: notification.alert_preference_id || null,
          notification_id: notification.id,
          grant_id: notification.grant_id,
          event_type: 'notification_cancelled',
          metadata: { reason: 'missing_email' },
        });
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] Would send to ${email}: ${notification.subject}`);
        sent++;
        continue;
      }

      try {
        const result = await sendEmail({
          to: email,
          subject: `[CivicGraph] ${notification.subject}`,
          body: notification.body || `You have a new grant match (${notification.match_score}% match).`,
        });

        await db
          .from('grant_notification_outbox')
          .update({
            status: 'sent',
            sent_at: attemptedAt,
            attempt_count: attemptCount,
            last_attempted_at: attemptedAt,
            last_error: null,
            external_message_id: result.id,
          })
          .eq('id', notification.id);

        if (notification.alert_preference_id) {
          await db
            .from('alert_preferences')
            .update({
              last_sent_at: attemptedAt,
              updated_at: attemptedAt,
            })
            .eq('id', notification.alert_preference_id);
        }

        sent++;
        eventRows.push({
          user_id: notification.user_id,
          alert_preference_id: notification.alert_preference_id || null,
          notification_id: notification.id,
          grant_id: notification.grant_id,
          event_type: 'notification_sent',
          metadata: { attempt_count: attemptCount, source: 'scheduled_delivery' },
        });
      } catch (err) {
        await db
          .from('grant_notification_outbox')
          .update({
            status: attemptCount >= MAX_ATTEMPTS ? 'failed' : 'queued',
            attempt_count: attemptCount,
            last_attempted_at: attemptedAt,
            last_error: err.message,
          })
          .eq('id', notification.id);

        failed++;
        console.error(`  Failed ${notification.id}: ${err.message}`);
        eventRows.push({
          user_id: notification.user_id,
          alert_preference_id: notification.alert_preference_id || null,
          notification_id: notification.id,
          grant_id: notification.grant_id,
          event_type: 'notification_failed',
          metadata: { attempt_count: attemptCount, error: err.message, source: 'scheduled_delivery' },
        });
      }
    }

    if (!DRY_RUN && eventRows.length > 0) {
      await db.from('alert_events').insert(eventRows);
      const deliveryRunEvents = [...new Set(queued.map((notification) => notification.user_id))].map((recipientUserId) => ({
        user_id: recipientUserId,
        alert_preference_id: null,
        notification_id: null,
        grant_id: null,
        event_type: 'delivery_run',
        metadata: {
          scoped_user: null,
          queued: queued.filter((notification) => notification.user_id === recipientUserId).length,
          sent: eventRows.filter((event) => event.user_id === recipientUserId && event.event_type === 'notification_sent').length,
          failed: eventRows.filter((event) => event.user_id === recipientUserId && event.event_type === 'notification_failed').length,
          cancelled: eventRows.filter((event) => event.user_id === recipientUserId && event.event_type === 'notification_cancelled').length,
        },
      }));
      await db.from('alert_events').insert(deliveryRunEvents);
    }

    console.log(`\n=== Summary ===`);
    console.log(`Sent: ${sent}, Failed: ${failed}, Cancelled: ${cancelled}`);

    await logComplete(db, run.id, {
      items_found: queued.length,
      items_new: sent,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
