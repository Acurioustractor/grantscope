import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { processDueTaskReminders } from '../../_lib/procurement-workspace';
import { rerunProcurementShortlist } from '../../_lib/shortlist-rerun';

function isAuthorizedAutomationRequest(request: NextRequest) {
  const expectedSecret =
    process.env.CRON_SECRET
    || process.env.TENDER_INTELLIGENCE_CRON_SECRET
    || process.env.API_SECRET_KEY;
  if (!expectedSecret) return false;
  return request.headers.get('authorization') === `Bearer ${expectedSecret}`;
}

async function runDueAutomation(request: NextRequest) {
  const serviceDb = getServiceSupabase();
  const isAutomationTrigger = isAuthorizedAutomationRequest(request);

  let userId: string | null = null;
  let orgProfileId: string | null = null;

  if (!isAutomationTrigger) {
    const auth = await requireModule('procurement');
    if (auth.error) return auth.error;
    userId = auth.user.id;
    const orgContext = await getCurrentOrgProfileContext(serviceDb, auth.user.id);
    orgProfileId = orgContext.orgProfileId;
    if (!orgProfileId) {
      return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
    }
  }

  const nowIso = new Date().toISOString();
  const dueWatchQuery = serviceDb
    .from('procurement_shortlist_watches')
    .select('id, org_profile_id, shortlist_id, enabled, interval_hours, next_run_at, created_by, updated_by')
    .eq('enabled', true)
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .limit(25);

  const { data: dueWatches, error } = orgProfileId
    ? await dueWatchQuery.eq('org_profile_id', orgProfileId)
    : await dueWatchQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    shortlistId: string;
    status: 'completed' | 'failed' | 'skipped';
    alertsCreated?: number;
    tasksCreated?: number;
    totalFound?: number;
    error?: string;
  }> = [];

  for (const watch of dueWatches || []) {
    const actorUserId = userId || watch.updated_by || watch.created_by;
    if (!actorUserId) {
      results.push({
        shortlistId: watch.shortlist_id,
        status: 'skipped',
        error: 'No user available to attribute the rerun.',
      });
      continue;
    }

    try {
      const rerun = await rerunProcurementShortlist(serviceDb, {
        shortlistId: watch.shortlist_id,
        userId: actorUserId,
        trigger: 'automation',
      });
      results.push({
        shortlistId: watch.shortlist_id,
        status: 'completed',
        alertsCreated: rerun.delta.alerts_created,
        tasksCreated: rerun.delta.tasks_created,
        totalFound: rerun.discovery.summary.total_found,
      });
    } catch (rerunError) {
      results.push({
        shortlistId: watch.shortlist_id,
        status: 'failed',
        error: rerunError instanceof Error ? rerunError.message : 'Unable to rerun shortlist watch',
      });
    }
  }

  let orgReminderAlertsCreated = 0;
  let orgEscalationAlertsCreated = 0;
  if (orgProfileId) {
    const reminders = await processDueTaskReminders(serviceDb, {
      orgProfileId,
    });
    orgReminderAlertsCreated = reminders.alertsCreated;
    orgEscalationAlertsCreated = reminders.escalationAlertsCreated;
  } else if (!orgProfileId && dueWatches && dueWatches.length > 0) {
    const orgIds = [...new Set(dueWatches.map((watch) => watch.org_profile_id).filter(Boolean))];
    for (const dueOrgId of orgIds) {
      const reminders = await processDueTaskReminders(serviceDb, {
        orgProfileId: dueOrgId,
      });
      orgReminderAlertsCreated += reminders.alertsCreated;
      orgEscalationAlertsCreated += reminders.escalationAlertsCreated;
    }
  }

  return NextResponse.json({
    triggeredAt: nowIso,
    automation: isAutomationTrigger,
    dueCount: (dueWatches || []).length,
    completedCount: results.filter((result) => result.status === 'completed').length,
    failedCount: results.filter((result) => result.status === 'failed').length,
    skippedCount: results.filter((result) => result.status === 'skipped').length,
    reminderAlertsCreated: orgReminderAlertsCreated,
    escalationAlertsCreated: orgEscalationAlertsCreated,
    results,
  });
}

export async function GET(request: NextRequest) {
  return runDueAutomation(request);
}

export async function POST(request: NextRequest) {
  return runDueAutomation(request);
}
