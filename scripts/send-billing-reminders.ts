#!/usr/bin/env -S npx tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { buildBillingReminderClickUrl } from '../apps/web/src/lib/billing-link-tracking';
import { sendEmail } from '../apps/web/src/lib/gmail';
import { logComplete, logFailed, logStart } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_USER = process.argv.find((arg) => arg.startsWith('--user-id='))?.split('=')[1] || null;
const REMINDER_LOOKBACK_DAYS = 5;
const TRIAL_WINDOW_DAYS = 7;
const CANCEL_WINDOW_DAYS = 7;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';

type OrgProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_trial_end: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
};

type ProductEventRow = {
  user_id: string;
  metadata: {
    reminder_type?: string | null;
    target_date?: string | null;
  } | null;
};

type ReminderCandidate = {
  profile: OrgProfileRow;
  reminderType: 'trial_ending_soon' | 'payment_action_required' | 'cancellation_ending_soon';
  targetDate: string | null;
  daysRemaining: number | null;
  subject: string;
  body: string;
  html: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function daysUntil(value: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(value: string | null) {
  if (!value) return 'soon';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildReminder(profile: OrgProfileRow): ReminderCandidate | null {
  const status = (profile.subscription_status || '').toLowerCase();
  const plan = (profile.subscription_plan || 'community').toUpperCase();
  const workspaceName = profile.name || 'your CivicGraph workspace';
  const trialDaysRemaining = daysUntil(profile.subscription_trial_end);
  const periodDaysRemaining = daysUntil(profile.subscription_current_period_end);
  const billingUrl = buildBillingReminderClickUrl({
    userId: profile.user_id,
    orgProfileId: profile.id,
    reminderType: 'trial_ending_soon',
    targetPath: '/profile?billing_source=billing_reminder_trial_ending_soon',
  });
  const pricingUrl = buildBillingReminderClickUrl({
    userId: profile.user_id,
    orgProfileId: profile.id,
    reminderType: 'trial_ending_soon',
    targetPath: '/pricing?billing_source=billing_reminder_trial_ending_soon',
  });

  if (status === 'trialing' && trialDaysRemaining !== null && trialDaysRemaining <= TRIAL_WINDOW_DAYS) {
    const targetDate = profile.subscription_trial_end;
    const subject = `[CivicGraph] ${plan} trial ends ${formatDate(targetDate)}`;
    const body = [
      `Hi,`,
      '',
      `${workspaceName} is currently on a ${plan} trial that ends ${formatDate(targetDate)}.`,
      'Update billing before the trial ends to keep grant alerts, weekly digests, and shared pipeline workflow running without interruption.',
      '',
      `Open billing in CivicGraph: ${billingUrl}`,
      `Compare plans: ${pricingUrl}`,
      '',
      'CivicGraph',
    ].join('\n');
    const html = `
      <div style="max-width:640px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#141414;">
        <div style="background:#141414;padding:16px 20px;margin-bottom:24px;">
          <div style="color:#f2ce1e;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">CivicGraph Billing Reminder</div>
        </div>
        <div style="padding:0 20px 24px;">
          <div style="font-weight:900;font-size:18px;line-height:1.3;">${plan} trial ends ${formatDate(targetDate)}</div>
          <div style="font-size:13px;color:#6b6b6b;margin-top:8px;">${workspaceName} will keep full access if billing is confirmed before the trial ends.</div>
          <div style="margin-top:20px;">
            <a href="${billingUrl}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">Manage Billing</a>
          </div>
          <div style="margin-top:12px;font-size:11px;color:#6b6b6b;">
            Or compare plans at <a href="${pricingUrl}" style="color:#1c47d1;">${APP_URL}/pricing</a>
          </div>
        </div>
      </div>
    `;

    return {
      profile,
      reminderType: 'trial_ending_soon',
      targetDate,
      daysRemaining: trialDaysRemaining,
      subject,
      body,
      html,
    };
  }

  if (status === 'past_due' || status === 'unpaid') {
    const targetDate = profile.subscription_current_period_end;
    const billingUrl = buildBillingReminderClickUrl({
      userId: profile.user_id,
      orgProfileId: profile.id,
      reminderType: 'payment_action_required',
      targetPath: '/profile?billing_source=billing_reminder_payment_action_required',
    });

    const subject = `[CivicGraph] Billing action required for ${workspaceName}`;
    const body = [
      `Hi,`,
      '',
      `CivicGraph could not confirm payment for ${workspaceName}.`,
      'Please update billing details to keep alerts, digests, and your funding pipeline available without interruption.',
      targetDate ? `Current billing period ends ${formatDate(targetDate)}.` : null,
      '',
      `Open billing in CivicGraph: ${billingUrl}`,
      '',
      'CivicGraph',
    ].filter(Boolean).join('\n');
    const html = `
      <div style="max-width:640px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#141414;">
        <div style="background:#141414;padding:16px 20px;margin-bottom:24px;">
          <div style="color:#f2ce1e;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">CivicGraph Billing Reminder</div>
        </div>
        <div style="padding:0 20px 24px;">
          <div style="font-weight:900;font-size:18px;line-height:1.3;">Billing action required</div>
          <div style="font-size:13px;color:#6b6b6b;margin-top:8px;">Please update payment details for ${workspaceName} to keep access uninterrupted.</div>
          <div style="margin-top:20px;">
            <a href="${billingUrl}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">Update Billing</a>
          </div>
        </div>
      </div>
    `;

    return {
      profile,
      reminderType: 'payment_action_required',
      targetDate,
      daysRemaining: periodDaysRemaining,
      subject,
      body,
      html,
    };
  }

  if (profile.subscription_cancel_at_period_end && periodDaysRemaining !== null && periodDaysRemaining <= CANCEL_WINDOW_DAYS) {
    const targetDate = profile.subscription_current_period_end;
    const billingUrl = buildBillingReminderClickUrl({
      userId: profile.user_id,
      orgProfileId: profile.id,
      reminderType: 'cancellation_ending_soon',
      targetPath: '/profile?billing_source=billing_reminder_cancellation_ending_soon',
    });

    const subject = `[CivicGraph] ${plan} access ends ${formatDate(targetDate)}`;
    const body = [
      `Hi,`,
      '',
      `${workspaceName} is set to cancel at period end on ${formatDate(targetDate)}.`,
      'If you want to keep your paid features active, reopen billing before that date.',
      '',
      `Open billing in CivicGraph: ${billingUrl}`,
      '',
      'CivicGraph',
    ].join('\n');
    const html = `
      <div style="max-width:640px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#141414;">
        <div style="background:#141414;padding:16px 20px;margin-bottom:24px;">
          <div style="color:#f2ce1e;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">CivicGraph Billing Reminder</div>
        </div>
        <div style="padding:0 20px 24px;">
          <div style="font-weight:900;font-size:18px;line-height:1.3;">Access ends ${formatDate(targetDate)}</div>
          <div style="font-size:13px;color:#6b6b6b;margin-top:8px;">${workspaceName} is set to cancel at period end. Reopen billing if you want to keep paid access.</div>
          <div style="margin-top:20px;">
            <a href="${billingUrl}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">Manage Billing</a>
          </div>
        </div>
      </div>
    `;

    return {
      profile,
      reminderType: 'cancellation_ending_soon',
      targetDate,
      daysRemaining: periodDaysRemaining,
      subject,
      body,
      html,
    };
  }

  return null;
}

function reminderKey(reminder: Pick<ReminderCandidate, 'profile' | 'reminderType' | 'targetDate'>) {
  return `${reminder.profile.user_id}:${reminder.reminderType}:${reminder.targetDate || 'none'}`;
}

async function main() {
  const run = await logStart(supabase, 'send-billing-reminders', 'Send Billing Reminders');

  try {
    let profileQuery = supabase
      .from('org_profiles')
      .select('id, user_id, name, subscription_plan, subscription_status, subscription_trial_end, subscription_current_period_end, subscription_cancel_at_period_end')
      .neq('subscription_plan', 'community');

    if (SPECIFIC_USER) {
      profileQuery = profileQuery.eq('user_id', SPECIFIC_USER);
    }

    const { data: profiles, error: profilesError } = await profileQuery;
    if (profilesError) throw new Error(profilesError.message);

    const candidates = ((profiles || []) as OrgProfileRow[])
      .map(buildReminder)
      .filter((value): value is ReminderCandidate => value !== null);

    const reminderSince = new Date(Date.now() - REMINDER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const targetUserIds = [...new Set(candidates.map((item) => item.profile.user_id))];

    const { data: recentReminderEvents, error: remindersError } = targetUserIds.length > 0
      ? await supabase
        .from('product_events')
        .select('user_id, metadata')
        .eq('event_type', 'billing_reminder_sent')
        .in('user_id', targetUserIds)
        .gte('created_at', reminderSince)
      : { data: [], error: null };

    if (remindersError) throw new Error(remindersError.message);

    const existingReminderKeys = new Set(
      ((recentReminderEvents || []) as ProductEventRow[]).map((event) => {
        const reminderType = event.metadata?.reminder_type || 'unknown';
        const targetDate = event.metadata?.target_date || 'none';
        return `${event.user_id}:${reminderType}:${targetDate}`;
      }),
    );

    const pending = candidates.filter((candidate) => !existingReminderKeys.has(reminderKey(candidate)));
    const userIds = [...new Set(pending.map((item) => item.profile.user_id))];
    const emailMap = new Map<string, string>();

    for (const userId of userIds) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) throw new Error(error.message);
      if (data.user?.email) emailMap.set(userId, data.user.email);
    }

    let sent = 0;
    let skipped = 0;
    const eventRows: Array<{
      user_id: string;
      org_profile_id: string;
      event_type: 'billing_reminder_sent';
      metadata: Record<string, unknown>;
      created_at: string;
    }> = [];

    for (const reminder of pending) {
      const email = emailMap.get(reminder.profile.user_id);
      if (!email) {
        skipped += 1;
        continue;
      }

      if (!DRY_RUN) {
        const result = await sendEmail({
          to: email,
          subject: reminder.subject,
          body: reminder.body,
          html: reminder.html,
          senderName: 'CivicGraph Billing',
        });

        eventRows.push({
          user_id: reminder.profile.user_id,
          org_profile_id: reminder.profile.id,
          event_type: 'billing_reminder_sent',
          metadata: {
            source: 'billing_reminder_agent',
            reminder_type: reminder.reminderType,
            subscription_plan: reminder.profile.subscription_plan,
            subscription_status: reminder.profile.subscription_status,
            target_date: reminder.targetDate,
            days_remaining: reminder.daysRemaining,
            external_message_id: result.id,
          },
          created_at: new Date().toISOString(),
        });
      }

      sent += 1;
    }

    if (!DRY_RUN && eventRows.length > 0) {
      const { error } = await supabase.from('product_events').insert(eventRows);
      if (error) throw new Error(error.message);
    }

    const result = {
      dryRun: DRY_RUN,
      profilesChecked: (profiles || []).length,
      remindersEligible: candidates.length,
      remindersPending: pending.length,
      remindersSent: sent,
      remindersSkipped: skipped,
      reminderTypes: pending.reduce<Record<string, number>>((acc, reminder) => {
        acc[reminder.reminderType] = (acc[reminder.reminderType] || 0) + 1;
        return acc;
      }, {}),
    };

    console.log(JSON.stringify(result, null, 2));

    await logComplete(supabase, run.id, {
      items_found: result.remindersEligible,
      items_new: result.remindersSent,
      items_updated: result.remindersSkipped,
    });
  } catch (error) {
    await logFailed(supabase, run.id, error as Error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
