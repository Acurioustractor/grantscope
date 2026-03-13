import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  getProcurementContext,
  getProcurementTeamMembers,
  getShortlistComments,
  normalizeReviewChecklist,
} from '../_lib/procurement-workspace';

function buildDecisionCounts(items: Array<{ decision_tag: string | null }>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item.decision_tag || 'untriaged';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function inferMatchReason(gsId: string | null, supplierAbn: string | null) {
  if (gsId?.startsWith('AU-ABN-')) return 'ABN-backed entity match';
  if (gsId) return 'Matched to GrantScope entity graph';
  if (supplierAbn) return 'Saved against supplier ABN';
  return 'Saved from procurement workflow';
}

export async function GET(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const shortlistId = request.nextUrl.searchParams.get('shortlistId');
  const context = await getProcurementContext(serviceDb, user.id, { shortlistId });

  const workflowQuery = serviceDb
    .from('procurement_workflow_runs')
    .select('id, workflow_type, workflow_status, output_summary, records_scanned, records_changed, error_count, started_at, completed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: workflowRuns, error: workflowError } = context.shortlist
    ? await workflowQuery.eq('shortlist_id', context.shortlist.id)
    : context.orgProfileId
      ? await workflowQuery.eq('org_profile_id', context.orgProfileId)
      : await workflowQuery.eq('user_id', user.id);

  if (workflowError) {
    return NextResponse.json({ error: workflowError.message }, { status: 500 });
  }

  if (!context.orgProfileId) {
    return NextResponse.json({
      canUseWorkspace: false,
      needsProfile: true,
      currentUserId: user.id,
      orgProfile: context.profile,
      currentUserRole: context.currentUserRole,
      currentUserPermissions: context.currentUserPermissions,
      shortlists: [],
      shortlist: null,
      shortlistItems: [],
      workflowRuns: workflowRuns || [],
      recentEvents: [],
      watch: null,
      alerts: [],
      tasks: [],
      myTasks: [],
      myApprovals: [],
      myNotifications: [],
      packExports: [],
      notifications: [],
      notificationChannels: [],
      deliveryLogs: [],
      inspectorReceipts: [],
      channelHealth: [],
      outboundMetrics: {
        queued: 0,
        needsAttention: 0,
        sentRecently: 0,
        webhookFailures: 0,
      },
      pendingInvites: [],
      comments: [],
      teamMembers: [],
    });
  }

  const shortlistIds = context.shortlists.map((shortlist) => shortlist.id);
  const { data: shortlistItemStats, error: shortlistItemStatsError } = shortlistIds.length > 0
    ? await serviceDb
        .from('procurement_shortlist_items')
        .select('id, shortlist_id, decision_tag')
        .in('shortlist_id', shortlistIds)
    : { data: [], error: null };

  if (shortlistItemStatsError) {
    return NextResponse.json({ error: shortlistItemStatsError.message }, { status: 500 });
  }

  const summaryByShortlist = (shortlistItemStats || []).reduce<Record<string, { item_count: number; decision_counts: Record<string, number> }>>((acc, item) => {
    if (!acc[item.shortlist_id]) {
      acc[item.shortlist_id] = { item_count: 0, decision_counts: {} };
    }
    acc[item.shortlist_id].item_count += 1;
    const key = item.decision_tag || 'untriaged';
    acc[item.shortlist_id].decision_counts[key] = (acc[item.shortlist_id].decision_counts[key] || 0) + 1;
    return acc;
  }, {});

  const shortlists = context.shortlists.map((shortlist) => ({
    ...shortlist,
    item_count: summaryByShortlist[shortlist.id]?.item_count || 0,
    decision_counts: summaryByShortlist[shortlist.id]?.decision_counts || {},
  }));

  const activeShortlist = context.shortlist
    ? shortlists.find((shortlist) => shortlist.id === context.shortlist?.id) || null
    : null;

  const myApprovals = shortlists
    .filter((shortlist) => {
      if (shortlist.approval_status !== 'submitted') return false;
      if (shortlist.approver_user_id) {
        return shortlist.approver_user_id === user.id;
      }
      if (context.currentUserPermissions.can_manage_team) {
        return true;
      }
      return shortlist.owner_user_id === user.id;
    })
    .map((shortlist) => ({
      id: shortlist.id,
      name: shortlist.name,
      owner_name: shortlist.owner_name,
      decision_due_at: shortlist.decision_due_at,
      approval_status: shortlist.approval_status,
      last_pack_export_id: shortlist.last_pack_export_id,
      updated_at: shortlist.updated_at,
    }));

  if (!activeShortlist) {
    return NextResponse.json({
      canUseWorkspace: true,
      needsProfile: false,
      currentUserId: user.id,
      orgProfile: context.profile,
      currentUserRole: context.currentUserRole,
      currentUserPermissions: context.currentUserPermissions,
      shortlists,
      shortlist: null,
      shortlistItems: [],
      workflowRuns: workflowRuns || [],
      recentEvents: [],
      watch: null,
      alerts: [],
      tasks: [],
      myTasks: [],
      myApprovals,
      myNotifications: [],
      packExports: [],
      notifications: [],
      notificationChannels: [],
      deliveryLogs: [],
      inspectorReceipts: [],
      channelHealth: [],
      outboundMetrics: {
        queued: 0,
        needsAttention: 0,
        sentRecently: 0,
        webhookFailures: 0,
      },
      pendingInvites: [],
      comments: [],
      teamMembers: [],
    });
  }

  const { data: shortlistItemsRaw, error: itemError } = await serviceDb
    .from('procurement_shortlist_items')
    .select('*')
    .eq('shortlist_id', activeShortlist.id)
    .order('updated_at', { ascending: false });

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  const entityIds = (shortlistItemsRaw || [])
    .map((item) => item.gs_id)
    .filter((value): value is string => !!value);

  const { data: entityRows, error: entityError } = entityIds.length > 0
    ? await serviceDb
        .from('gs_entities')
        .select('gs_id, source_datasets, source_count, confidence, financial_year, last_seen, updated_at')
        .in('gs_id', entityIds)
    : { data: [], error: null };

  if (entityError) {
    return NextResponse.json({ error: entityError.message }, { status: 500 });
  }

  const entityByGsId = new Map((entityRows || []).map((entity) => [entity.gs_id, entity]));

  const shortlistItems = (shortlistItemsRaw || []).map((item) => {
    const entity = item.gs_id ? entityByGsId.get(item.gs_id) : null;
    const evidenceSnapshot = typeof item.evidence_snapshot === 'object' && item.evidence_snapshot ? item.evidence_snapshot : {};
    return {
      ...item,
      review_checklist: normalizeReviewChecklist(item.review_checklist),
      evidence_snapshot: evidenceSnapshot,
      provenance: entity ? {
        source_datasets: entity.source_datasets || [],
        source_count: entity.source_count || 0,
        confidence: entity.confidence || null,
        financial_year: entity.financial_year || null,
        last_seen: entity.last_seen || null,
        entity_updated_at: entity.updated_at || null,
        match_reason: inferMatchReason(item.gs_id, item.supplier_abn),
      } : {
        source_datasets: [],
        source_count: 0,
        confidence: null,
        financial_year: null,
        last_seen: null,
        entity_updated_at: null,
        match_reason: inferMatchReason(item.gs_id, item.supplier_abn),
      },
    };
  });

  const { data: recentEvents, error: recentEventsError } = await serviceDb
    .from('procurement_shortlist_events')
    .select('id, shortlist_id, shortlist_item_id, event_type, event_summary, payload, created_at')
    .eq('org_profile_id', context.orgProfileId)
    .eq('shortlist_id', activeShortlist.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentEventsError) {
    return NextResponse.json({ error: recentEventsError.message }, { status: 500 });
  }

  const { members: teamMembers } = await getProcurementTeamMembers(serviceDb, user.id);
  const { comments } = await getShortlistComments(serviceDb, user.id, {
    shortlistId: activeShortlist.id,
    includeSupplierComments: true,
    limit: 48,
  });
  const { data: pendingMembers, error: pendingMembersError } = await serviceDb
    .from('org_members')
    .select('id, invited_email, role, invited_at')
    .eq('org_profile_id', context.orgProfileId)
    .is('user_id', null)
    .order('invited_at', { ascending: false });

  if (pendingMembersError) {
    return NextResponse.json({ error: pendingMembersError.message }, { status: 500 });
  }

  const pendingEmails = [...new Set((pendingMembers || []).map((member) => member.invited_email).filter((value): value is string => !!value))];
  const { data: pendingInviteSettings, error: pendingInviteSettingsError } = pendingEmails.length > 0
    ? await serviceDb
        .from('procurement_pending_team_invites')
        .select('invited_email, procurement_role, notification_mode, permission_overrides')
        .eq('org_profile_id', context.orgProfileId)
        .in('invited_email', pendingEmails)
    : { data: [], error: null };

  if (pendingInviteSettingsError) {
    return NextResponse.json({ error: pendingInviteSettingsError.message }, { status: 500 });
  }

  const pendingSettingByEmail = new Map(
    (pendingInviteSettings || []).map((setting) => [
      String(setting.invited_email).toLowerCase(),
      setting,
    ]),
  );
  const pendingInvites = (pendingMembers || []).map((member) => {
    const setting = member.invited_email ? pendingSettingByEmail.get(String(member.invited_email).toLowerCase()) : null;
    return {
      id: member.id,
      invited_email: member.invited_email,
      role: member.role,
      invited_at: member.invited_at,
      procurement_role: setting?.procurement_role || 'reviewer',
      notification_mode: setting?.notification_mode || 'immediate',
      permission_overrides: setting?.permission_overrides || {},
    };
  });

  const [
    { data: myTasks, error: myTasksError },
    { data: myNotifications, error: myNotificationsError },
    { data: watch, error: watchError },
    { data: alerts, error: alertsError },
    { data: tasks, error: tasksError },
    { data: packExports, error: packExportsError },
    { data: notifications, error: notificationsError },
    { data: notificationChannels, error: notificationChannelsError },
  ] = await Promise.all([
    serviceDb
      .from('procurement_tasks')
      .select('id, shortlist_id, shortlist_item_id, alert_id, task_key, task_type, title, description, priority, status, due_at, assignee_label, assignee_user_id, last_reminded_at, reminder_count, completion_outcome, completion_note, completed_at, completed_by, metadata, created_at, updated_at')
      .eq('org_profile_id', context.orgProfileId)
      .eq('assignee_user_id', user.id)
      .neq('status', 'done')
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(8),
    serviceDb
      .from('procurement_notification_outbox')
      .select('id, shortlist_id, pack_export_id, task_id, alert_id, recipient_user_id, recipient_label, notification_type, delivery_mode, status, subject, body, payload, queued_at, sent_at, attempt_count, last_attempted_at, last_error, external_message_id, created_at, updated_at')
      .eq('org_profile_id', context.orgProfileId)
      .eq('recipient_user_id', user.id)
      .order('queued_at', { ascending: false })
      .limit(8),
    serviceDb
      .from('procurement_shortlist_watches')
      .select('*')
      .eq('shortlist_id', activeShortlist.id)
      .maybeSingle(),
    serviceDb
      .from('procurement_alerts')
      .select('id, shortlist_id, shortlist_item_id, alert_type, severity, status, title, body, payload, created_at, updated_at')
      .eq('org_profile_id', context.orgProfileId)
      .eq('shortlist_id', activeShortlist.id)
      .order('created_at', { ascending: false })
      .limit(12),
    serviceDb
      .from('procurement_tasks')
      .select('id, shortlist_id, shortlist_item_id, alert_id, task_key, task_type, title, description, priority, status, due_at, assignee_label, assignee_user_id, last_reminded_at, reminder_count, completion_outcome, completion_note, completed_at, completed_by, metadata, created_at, updated_at')
      .eq('org_profile_id', context.orgProfileId)
      .eq('shortlist_id', activeShortlist.id)
      .order('created_at', { ascending: false })
      .limit(20),
    serviceDb
      .from('procurement_pack_exports')
      .select('id, shortlist_id, title, version_number, export_summary, source_shortlist_updated_at, superseded_at, created_at, updated_at')
      .eq('org_profile_id', context.orgProfileId)
      .eq('shortlist_id', activeShortlist.id)
      .order('created_at', { ascending: false })
      .limit(6),
    serviceDb
      .from('procurement_notification_outbox')
      .select('id, shortlist_id, pack_export_id, task_id, alert_id, recipient_user_id, recipient_label, notification_type, delivery_mode, status, subject, body, payload, queued_at, sent_at, attempt_count, last_attempted_at, last_error, external_message_id, created_at, updated_at')
      .eq('org_profile_id', context.orgProfileId)
      .or(`shortlist_id.eq.${activeShortlist.id},shortlist_id.is.null`)
      .order('queued_at', { ascending: false })
      .limit(12),
    serviceDb
      .from('procurement_notification_channels')
      .select('id, org_profile_id, channel_name, channel_type, endpoint_url, signing_secret, enabled, event_types, verification_token, verification_status, last_tested_at, last_test_error, created_at, updated_at')
      .eq('org_profile_id', context.orgProfileId)
      .order('updated_at', { ascending: false }),
  ]);

  if (myTasksError) {
    return NextResponse.json({ error: myTasksError.message }, { status: 500 });
  }

  if (myNotificationsError) {
    return NextResponse.json({ error: myNotificationsError.message }, { status: 500 });
  }

  if (watchError) {
    return NextResponse.json({ error: watchError.message }, { status: 500 });
  }

  if (alertsError) {
    return NextResponse.json({ error: alertsError.message }, { status: 500 });
  }

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  if (packExportsError) {
    return NextResponse.json({ error: packExportsError.message }, { status: 500 });
  }

  if (notificationsError) {
    return NextResponse.json({ error: notificationsError.message }, { status: 500 });
  }

  if (notificationChannelsError) {
    return NextResponse.json({ error: notificationChannelsError.message }, { status: 500 });
  }

  const shortlistNameById = new Map(shortlists.map((shortlist) => [shortlist.id, shortlist.name]));
  const myTasksWithShortlistName = (myTasks || []).map((task) => ({
    ...task,
    shortlist_name: shortlistNameById.get(task.shortlist_id) || 'Unknown shortlist',
  }));
  const channelIdToName = new Map((notificationChannels || []).map((channel) => [channel.id, channel.channel_name]));
  const channelIds = [...channelIdToName.keys()];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deliveryLogs, error: deliveryLogsError } = channelIds.length > 0
    ? await serviceDb
        .from('webhook_delivery_log')
        .select('id, source, webhook_id, event_type, status, error_message, processed_at, created_at, received_at')
        .in('webhook_id', channelIds)
        .order('processed_at', { ascending: false })
        .limit(16)
    : { data: [], error: null };

  if (deliveryLogsError) {
    return NextResponse.json({ error: deliveryLogsError.message }, { status: 500 });
  }

  const recentDeliveryLogs = (deliveryLogs || []).map((entry) => ({
    ...entry,
    channel_name: channelIdToName.get(String(entry.webhook_id)) || 'Unknown webhook',
  }));
  const { data: inspectorReceipts, error: inspectorReceiptsError } = channelIds.length > 0
    ? await serviceDb
        .from('procurement_webhook_receipts')
        .select('id, channel_id, source, event_type, signature_valid, received_at, created_at')
        .in('channel_id', channelIds)
        .order('received_at', { ascending: false })
        .limit(16)
    : { data: [], error: null };

  if (inspectorReceiptsError) {
    return NextResponse.json({ error: inspectorReceiptsError.message }, { status: 500 });
  }

  const recentInspectorReceipts = (inspectorReceipts || []).map((entry) => ({
    ...entry,
    channel_name: channelIdToName.get(String(entry.channel_id)) || 'Unknown webhook',
  }));

  const [
    { count: queuedCount, error: queuedCountError },
    { count: queuedAttentionCount, error: queuedAttentionError },
    { count: cancelledCount, error: cancelledCountError },
    { count: sentRecentCount, error: sentRecentCountError },
    { count: webhookFailureCount, error: webhookFailureCountError },
  ] = await Promise.all([
    serviceDb
      .from('procurement_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('org_profile_id', context.orgProfileId)
      .eq('status', 'queued'),
    serviceDb
      .from('procurement_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('org_profile_id', context.orgProfileId)
      .eq('status', 'queued')
      .not('last_error', 'is', null),
    serviceDb
      .from('procurement_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('org_profile_id', context.orgProfileId)
      .eq('status', 'cancelled'),
    serviceDb
      .from('procurement_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('org_profile_id', context.orgProfileId)
      .eq('status', 'sent')
      .gte('sent_at', sevenDaysAgo),
    channelIds.length > 0
      ? serviceDb
          .from('webhook_delivery_log')
          .select('id', { count: 'exact', head: true })
          .in('webhook_id', channelIds)
          .eq('status', 'failed')
          .gte('processed_at', sevenDaysAgo)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (queuedCountError || queuedAttentionError || cancelledCountError || sentRecentCountError || webhookFailureCountError) {
    return NextResponse.json({
      error: queuedCountError?.message
        || queuedAttentionError?.message
        || cancelledCountError?.message
        || sentRecentCountError?.message
        || webhookFailureCountError?.message
        || 'Unable to load outbound metrics',
    }, { status: 500 });
  }

  const channelHealth = (notificationChannels || []).map((channel) => {
    const channelLogs = recentDeliveryLogs.filter((log) => log.webhook_id === channel.id);
    const lastProcessed = channelLogs.find((log) => log.status === 'processed') || null;
    const lastFailed = channelLogs.find((log) => log.status === 'failed') || null;
    return {
      id: channel.id,
      channel_name: channel.channel_name,
      enabled: channel.enabled,
      verification_status: channel.verification_status,
      verification_token: channel.verification_token,
      last_tested_at: channel.last_tested_at,
      last_receipt_at: recentInspectorReceipts.find((receipt) => receipt.channel_id === channel.id)?.received_at || null,
      success_count: channelLogs.filter((log) => log.status === 'processed').length,
      failure_count: channelLogs.filter((log) => log.status === 'failed').length,
      last_processed_at: lastProcessed?.processed_at || null,
      last_failed_at: lastFailed?.processed_at || null,
      last_error_message: channel.last_test_error || lastFailed?.error_message || null,
    };
  });

  return NextResponse.json({
    canUseWorkspace: true,
    needsProfile: false,
    currentUserId: user.id,
    orgProfile: context.profile,
    currentUserRole: context.currentUserRole,
    currentUserPermissions: context.currentUserPermissions,
    shortlists,
    shortlist: {
      ...activeShortlist,
      item_count: shortlistItems.length,
      decision_counts: buildDecisionCounts(shortlistItems),
    },
    shortlistItems,
    workflowRuns: workflowRuns || [],
    recentEvents: recentEvents || [],
    watch: watch || null,
    alerts: alerts || [],
    tasks: tasks || [],
    myTasks: myTasksWithShortlistName,
    myApprovals,
    myNotifications: myNotifications || [],
    packExports: packExports || [],
    notifications: notifications || [],
    notificationChannels: notificationChannels || [],
    deliveryLogs: recentDeliveryLogs,
    inspectorReceipts: recentInspectorReceipts,
    channelHealth,
    outboundMetrics: {
      queued: queuedCount || 0,
      needsAttention: (queuedAttentionCount || 0) + (cancelledCount || 0),
      sentRecently: sentRecentCount || 0,
      webhookFailures: webhookFailureCount || 0,
    },
    pendingInvites,
    comments,
    teamMembers,
  });
}
