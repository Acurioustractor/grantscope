import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { decisionTagLabel } from '@/lib/procurement-shortlist';

const DEFAULT_SHORTLIST_NAME = 'Primary Procurement Shortlist';
const PROCUREMENT_SHORTLIST_SELECT = 'id, org_profile_id, name, description, filters, is_default, recommendation_summary, why_now, risk_summary, next_action, owner_name, owner_user_id, approver_user_id, decision_due_at, approval_status, approval_notes, requested_by, requested_at, approved_by, approved_at, last_pack_export_id, approved_pack_export_id, approval_lock_active, approval_locked_at, approval_locked_by, reopened_at, reopened_by, created_at, updated_at';

type ServiceDb = ReturnType<typeof getServiceSupabase>;
export type ProcurementRole = 'lead' | 'reviewer' | 'approver' | 'observer';
export type ProcurementNotificationMode = 'immediate' | 'daily_digest' | 'none';
export type ProcurementPermissionKey =
  | 'can_edit_shortlist'
  | 'can_manage_tasks'
  | 'can_submit_signoff'
  | 'can_approve'
  | 'can_manage_team'
  | 'can_reopen_approval'
  | 'can_send_notifications';

export type ProcurementPermissionOverrides = Partial<Record<ProcurementPermissionKey, boolean>>;

export interface ProcurementPermissions {
  can_edit_shortlist: boolean;
  can_manage_tasks: boolean;
  can_submit_signoff: boolean;
  can_approve: boolean;
  can_manage_team: boolean;
  can_reopen_approval: boolean;
  can_send_notifications: boolean;
}

export interface ProcurementShortlistRow {
  id: string;
  org_profile_id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  is_default: boolean;
  recommendation_summary: string | null;
  why_now: string | null;
  risk_summary: string | null;
  next_action: string | null;
  owner_name: string | null;
  owner_user_id: string | null;
  approver_user_id: string | null;
  decision_due_at: string | null;
  approval_status: 'draft' | 'review_ready' | 'submitted' | 'approved' | 'changes_requested';
  approval_notes: string | null;
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  last_pack_export_id: string | null;
  approved_pack_export_id: string | null;
  approval_lock_active: boolean;
  approval_locked_at: string | null;
  approval_locked_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementShortlistWatchRow {
  id: string;
  org_profile_id: string;
  shortlist_id: string;
  enabled: boolean;
  interval_hours: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_summary: Record<string, unknown>;
  last_result_snapshot: Record<string, unknown>;
  last_alert_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProcurementAlertRow {
  id: string;
  org_profile_id: string;
  shortlist_id: string | null;
  shortlist_item_id: string | null;
  alert_type: 'new_supplier' | 'removed_supplier' | 'contract_signal_changed' | 'brief_rerun' | 'task_due' | 'task_escalated';
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved';
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProcurementTaskRow {
  id: string;
  org_profile_id: string;
  shortlist_id: string;
  shortlist_item_id: string | null;
  alert_id: string | null;
  task_key: string | null;
  task_type: 'review_alert' | 'follow_up' | 'evidence_check' | 'pack_refresh';
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'done';
  due_at: string | null;
  assignee_label: string | null;
  assignee_user_id: string | null;
  last_reminded_at: string | null;
  reminder_count: number;
  completion_outcome: 'resolved' | 'follow_up_required' | 'escalated' | 'approved_to_proceed' | 'excluded' | null;
  completion_note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProcurementReviewChecklist {
  fit: boolean;
  risk_checked: boolean;
  evidence_checked: boolean;
  decision_made: boolean;
}

export interface ProcurementPackExportRow {
  id: string;
  org_profile_id: string;
  shortlist_id: string;
  workflow_run_id: string | null;
  title: string;
  version_number: number;
  export_summary: Record<string, unknown>;
  pack_payload: Record<string, unknown>;
  evidence_snapshot: Record<string, unknown>;
  source_shortlist_updated_at: string | null;
  superseded_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementCommentRow {
  id: string;
  org_profile_id: string;
  shortlist_id: string;
  shortlist_item_id: string | null;
  pack_export_id: string | null;
  author_user_id: string | null;
  comment_type: 'discussion' | 'submission' | 'approval' | 'changes_requested' | 'supplier_review';
  body: string;
  created_at: string;
  updated_at: string;
  author_label?: string | null;
}

export interface ProcurementTeamMember {
  user_id: string;
  role: 'admin' | 'editor' | 'viewer' | string;
  procurement_role: ProcurementRole;
  notification_mode: ProcurementNotificationMode;
  permission_overrides: ProcurementPermissionOverrides;
  permissions: ProcurementPermissions;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  is_owner: boolean;
}

export interface ProcurementNotificationRow {
  id: string;
  org_profile_id: string;
  shortlist_id: string | null;
  pack_export_id: string | null;
  task_id: string | null;
  alert_id: string | null;
  recipient_user_id: string | null;
  recipient_label: string | null;
  notification_type: 'task_due' | 'task_escalated' | 'signoff_submitted' | 'signoff_approved' | 'signoff_changes_requested';
  delivery_mode: ProcurementNotificationMode;
  status: 'queued' | 'sent' | 'cancelled';
  subject: string;
  body: string | null;
  payload: Record<string, unknown>;
  queued_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementPendingInviteRow {
  id: string;
  org_profile_id: string;
  invited_email: string;
  role: string;
  invited_at: string | null;
  procurement_role: ProcurementRole;
  notification_mode: ProcurementNotificationMode;
  permission_overrides: ProcurementPermissionOverrides;
}

export interface ProcurementNotificationChannelRow {
  id: string;
  org_profile_id: string;
  channel_name: string;
  channel_type: 'webhook';
  endpoint_url: string;
  signing_secret: string | null;
  enabled: boolean;
  event_types: string[];
  verification_token: string;
  verification_status: 'untested' | 'passed' | 'failed';
  last_tested_at: string | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

type ProcurementContextOptions = {
  shortlistId?: string | null;
  createDefault?: boolean;
};

export type WorkspaceSupplierInput = {
  gs_id?: string;
  canonical_name?: string;
  abn?: string | null;
  entity_type?: string | null;
  state?: string | null;
  postcode?: string | null;
  remoteness?: string | null;
  lga_name?: string | null;
  seifa_irsd_decile?: number | null;
  latest_revenue?: number | null;
  is_community_controlled?: boolean;
  contracts?: { count?: number; total_value?: number } | null;
};

function fallbackProcurementRole(role: string | null, isOwner: boolean): ProcurementRole {
  if (isOwner) return 'lead';
  if (role === 'admin' || role === 'editor') return 'reviewer';
  return 'observer';
}

function normalizePermissionOverrides(value: unknown): ProcurementPermissionOverrides {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const source = value as Record<string, unknown>;
  const normalized: ProcurementPermissionOverrides = {};
  const keys: ProcurementPermissionKey[] = [
    'can_edit_shortlist',
    'can_manage_tasks',
    'can_submit_signoff',
    'can_approve',
    'can_manage_team',
    'can_reopen_approval',
    'can_send_notifications',
  ];

  for (const key of keys) {
    if (typeof source[key] === 'boolean') {
      normalized[key] = source[key] as boolean;
    }
  }

  return normalized;
}

function rolePermissions(role: string | null, isOwner: boolean): ProcurementPermissions {
  const resolvedRole = role === 'lead'
    || role === 'reviewer'
    || role === 'approver'
    || role === 'observer'
    ? role
    : fallbackProcurementRole(role, isOwner);

  if (resolvedRole === 'lead') {
    return {
      can_edit_shortlist: true,
      can_manage_tasks: true,
      can_submit_signoff: true,
      can_approve: true,
      can_manage_team: true,
      can_reopen_approval: true,
      can_send_notifications: true,
    };
  }

  if (resolvedRole === 'reviewer') {
    return {
      can_edit_shortlist: true,
      can_manage_tasks: true,
      can_submit_signoff: true,
      can_approve: false,
      can_manage_team: false,
      can_reopen_approval: false,
      can_send_notifications: false,
    };
  }

  if (resolvedRole === 'approver') {
    return {
      can_edit_shortlist: false,
      can_manage_tasks: false,
      can_submit_signoff: false,
      can_approve: true,
      can_manage_team: false,
      can_reopen_approval: false,
      can_send_notifications: false,
    };
  }

  return {
    can_edit_shortlist: false,
    can_manage_tasks: false,
    can_submit_signoff: false,
    can_approve: false,
    can_manage_team: false,
    can_reopen_approval: false,
    can_send_notifications: false,
  };
}

export function resolveProcurementPermissions(params: {
  role: string | null;
  isOwner?: boolean;
  permissionOverrides?: ProcurementPermissionOverrides | null;
}) {
  const defaults = rolePermissions(params.role, params.isOwner === true);
  const overrides = normalizePermissionOverrides(params.permissionOverrides);
  return {
    ...defaults,
    ...overrides,
  } satisfies ProcurementPermissions;
}

function readPermissions(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null }
    | undefined,
) {
  if (!input) {
    return resolveProcurementPermissions({ role: null });
  }

  if (typeof input === 'string') {
    return resolveProcurementPermissions({ role: input, isOwner: input === 'admin' });
  }

  if ('can_edit_shortlist' in input) {
    return input as ProcurementPermissions;
  }

  if (input.permissions) {
    return input.permissions;
  }

  return resolveProcurementPermissions({
    role: input.procurement_role || input.role || null,
    isOwner: input.is_owner === true,
  });
}

export function hasEditAccess(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null },
) {
  return readPermissions(input).can_edit_shortlist;
}

export function hasTaskAccess(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null },
) {
  return readPermissions(input).can_manage_tasks;
}

export function hasSubmitAccess(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null },
) {
  return readPermissions(input).can_submit_signoff;
}

export function hasApprovalAccess(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null },
) {
  return readPermissions(input).can_approve;
}

export function hasGovernanceAdminAccess(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null },
) {
  return readPermissions(input).can_manage_team;
}

export function hasReopenAccess(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null },
) {
  return readPermissions(input).can_reopen_approval;
}

export function hasNotificationAccess(
  input:
    | string
    | null
    | ProcurementPermissions
    | { permissions?: ProcurementPermissions | null; is_owner?: boolean | null; procurement_role?: string | null; role?: string | null },
) {
  return readPermissions(input).can_send_notifications;
}

export function normalizeSupplierKey(input: WorkspaceSupplierInput) {
  if (input.gs_id) return `gs:${input.gs_id}`;
  if (input.abn) return `abn:${input.abn}`;
  const fallback = (input.canonical_name || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `name:${fallback || 'unknown'}`;
}

function normalizeIntervalHours(value: number | null | undefined) {
  const allowed = new Set([12, 24, 72, 168]);
  return allowed.has(Number(value)) ? Number(value) : 24;
}

export function normalizeReviewChecklist(value: unknown): ProcurementReviewChecklist {
  const checklist = typeof value === 'object' && value ? value as Record<string, unknown> : {};
  return {
    fit: checklist.fit === true,
    risk_checked: checklist.risk_checked === true,
    evidence_checked: checklist.evidence_checked === true,
    decision_made: checklist.decision_made === true,
  };
}

async function fetchOrgShortlists(serviceDb: ServiceDb, orgProfileId: string) {
  const { data, error } = await serviceDb
    .from('procurement_shortlists')
    .select(PROCUREMENT_SHORTLIST_SELECT)
    .eq('org_profile_id', orgProfileId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as ProcurementShortlistRow[];
}

async function fetchProcurementTeamMembersForOrg(
  serviceDb: ServiceDb,
  orgProfileId: string,
) {
  const { data: orgProfile, error: orgProfileError } = await serviceDb
    .from('org_profiles')
    .select('id, user_id')
    .eq('id', orgProfileId)
    .single();

  if (orgProfileError) throw orgProfileError;

  const { data: memberships, error: membershipsError } = await serviceDb
    .from('org_members')
    .select('user_id, role, accepted_at')
    .eq('org_profile_id', orgProfileId)
    .not('accepted_at', 'is', null);

  if (membershipsError) throw membershipsError;

  const memberByUserId = new Map<string, ProcurementTeamMember>();
  const ownerUserId = orgProfile.user_id as string | null;
  if (ownerUserId) {
    memberByUserId.set(ownerUserId, {
      user_id: ownerUserId,
      role: 'admin',
      procurement_role: 'lead',
      notification_mode: 'immediate',
      permission_overrides: {},
      permissions: resolveProcurementPermissions({ role: 'lead', isOwner: true }),
      email: null,
      full_name: null,
      display_name: null,
      is_owner: true,
    });
  }

  for (const membership of memberships || []) {
    if (!membership.user_id) continue;
    memberByUserId.set(membership.user_id, {
      user_id: membership.user_id,
      role: membership.role || 'viewer',
      procurement_role: fallbackProcurementRole(membership.role || 'viewer', membership.user_id === ownerUserId),
      notification_mode: 'immediate',
      permission_overrides: {},
      permissions: resolveProcurementPermissions({
        role: fallbackProcurementRole(membership.role || 'viewer', membership.user_id === ownerUserId),
        isOwner: membership.user_id === ownerUserId,
      }),
      email: null,
      full_name: null,
      display_name: null,
      is_owner: membership.user_id === ownerUserId,
    });
  }

  const memberIds = [...memberByUserId.keys()];
  if (memberIds.length === 0) {
    return [] as ProcurementTeamMember[];
  }

  const { data: profiles, error: profilesError } = await serviceDb
    .from('profiles')
    .select('id, email, full_name, display_name')
    .in('id', memberIds);

  if (profilesError) throw profilesError;

  const { data: settings, error: settingsError } = await serviceDb
    .from('procurement_team_settings')
    .select('user_id, procurement_role, notification_mode, permission_overrides')
    .eq('org_profile_id', orgProfileId)
    .in('user_id', memberIds);

  if (settingsError) throw settingsError;

  const settingsByUserId = new Map(
    (settings || []).map((setting) => [
      setting.user_id,
      {
        procurement_role: setting.procurement_role as ProcurementRole,
        notification_mode: setting.notification_mode as ProcurementNotificationMode,
        permission_overrides: normalizePermissionOverrides(setting.permission_overrides),
      },
    ]),
  );

  for (const [memberUserId, member] of memberByUserId.entries()) {
    const setting = settingsByUserId.get(memberUserId);
    if (!setting) continue;
    memberByUserId.set(memberUserId, {
      ...member,
      procurement_role: setting.procurement_role,
      notification_mode: setting.notification_mode,
      permission_overrides: setting.permission_overrides,
      permissions: resolveProcurementPermissions({
        role: setting.procurement_role,
        isOwner: member.is_owner,
        permissionOverrides: setting.permission_overrides,
      }),
    });
  }

  for (const profile of profiles || []) {
    const existing = memberByUserId.get(profile.id);
    if (!existing) continue;
    memberByUserId.set(profile.id, {
      ...existing,
      email: profile.email || null,
      full_name: profile.full_name || null,
      display_name: profile.display_name || null,
    });
  }

  return [...memberByUserId.values()].sort((a, b) => {
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
    const labelA = a.display_name || a.full_name || a.email || '';
    const labelB = b.display_name || b.full_name || b.email || '';
    return labelA.localeCompare(labelB);
  });
}

export async function getProcurementTeamMembers(
  serviceDb: ServiceDb,
  userId: string,
) {
  const context = await getProcurementContext(serviceDb, userId, { createDefault: false });
  if (!context.orgProfileId) {
    return {
      context,
      members: [] as ProcurementTeamMember[],
    };
  }

  return {
    context,
    members: await fetchProcurementTeamMembersForOrg(serviceDb, context.orgProfileId),
  };
}

export async function updateProcurementTeamMemberSetting(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    targetUserId: string;
    procurementRole?: ProcurementRole;
    notificationMode?: ProcurementNotificationMode;
    permissionOverrides?: ProcurementPermissionOverrides | null;
  },
) {
  const { context, members } = await getProcurementTeamMembers(serviceDb, userId);
  if (!context.orgProfileId) {
    throw new Error('No procurement workspace found.');
  }
  if (!hasGovernanceAdminAccess(context.currentUserPermissions)) {
    throw new Error('Only procurement leads can update procurement team settings.');
  }

  const targetMember = members.find((member) => member.user_id === params.targetUserId) || null;
  if (!targetMember) {
    throw new Error('Target team member not found.');
  }

  const nextRole = params.procurementRole || targetMember.procurement_role;
  const nextNotificationMode = params.notificationMode || targetMember.notification_mode;
  const nextPermissionOverrides = params.permissionOverrides === undefined
    ? targetMember.permission_overrides
    : normalizePermissionOverrides(params.permissionOverrides);

  const { data, error } = await serviceDb
    .from('procurement_team_settings')
    .upsert({
      org_profile_id: context.orgProfileId,
      user_id: params.targetUserId,
      procurement_role: nextRole,
      notification_mode: nextNotificationMode,
      permission_overrides: nextPermissionOverrides,
      created_by: userId,
      updated_by: userId,
    }, { onConflict: 'org_profile_id,user_id' })
    .select('user_id, procurement_role, notification_mode, permission_overrides')
    .single();

  if (error) throw error;

  return {
    context,
    setting: data,
  };
}

export async function getProcurementNotificationChannels(
  serviceDb: ServiceDb,
  userId: string,
) {
  const context = await getProcurementContext(serviceDb, userId);
  if (!context.orgProfileId) {
    return {
      context,
      channels: [] as ProcurementNotificationChannelRow[],
    };
  }

  const { data, error } = await serviceDb
    .from('procurement_notification_channels')
    .select('id, org_profile_id, channel_name, channel_type, endpoint_url, signing_secret, enabled, event_types, verification_token, verification_status, last_tested_at, last_test_error, created_at, updated_at')
    .eq('org_profile_id', context.orgProfileId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return {
    context,
    channels: (data || []) as ProcurementNotificationChannelRow[],
  };
}

export async function upsertProcurementNotificationChannel(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    channelId?: string | null;
    channelName: string;
    endpointUrl: string;
    enabled?: boolean;
    eventTypes?: string[];
    signingSecret?: string | null;
  },
) {
  const context = await getProcurementContext(serviceDb, userId);
  if (!context.orgProfileId) {
    throw new Error('No procurement workspace found.');
  }
  if (!hasGovernanceAdminAccess(context.currentUserPermissions)) {
    throw new Error('Only procurement leads can manage notification channels.');
  }

  const channelName = params.channelName.trim();
  const endpointUrl = params.endpointUrl.trim();
  if (!channelName) {
    throw new Error('Channel name is required.');
  }
  if (!/^https?:\/\//i.test(endpointUrl)) {
    throw new Error('Webhook URL must start with http:// or https://');
  }

  const allowedEventTypes = new Set<ProcurementNotificationRow['notification_type']>([
    'task_due',
    'task_escalated',
    'signoff_submitted',
    'signoff_approved',
    'signoff_changes_requested',
  ]);
  const eventTypes = [...new Set((params.eventTypes || []).filter((value): value is ProcurementNotificationRow['notification_type'] => allowedEventTypes.has(value as ProcurementNotificationRow['notification_type'])))];

  const payload = {
    org_profile_id: context.orgProfileId,
    channel_name: channelName,
    channel_type: 'webhook' as const,
    endpoint_url: endpointUrl,
    enabled: params.enabled ?? true,
    event_types: eventTypes,
    signing_secret: params.signingSecret?.trim() || null,
    updated_by: userId,
    created_by: userId,
  };

  const query = params.channelId
    ? serviceDb
        .from('procurement_notification_channels')
        .update(payload)
        .eq('id', params.channelId)
        .eq('org_profile_id', context.orgProfileId)
    : serviceDb
        .from('procurement_notification_channels')
        .insert(payload);

  const { data, error } = await query
    .select('id, org_profile_id, channel_name, channel_type, endpoint_url, signing_secret, enabled, event_types, verification_token, verification_status, last_tested_at, last_test_error, created_at, updated_at')
    .single();

  if (error) throw error;

  return {
    context,
    channel: data as ProcurementNotificationChannelRow,
  };
}

export async function createProcurementTeamInvite(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    email: string;
    procurementRole?: ProcurementRole;
    notificationMode?: ProcurementNotificationMode;
    orgRole?: 'admin' | 'editor' | 'viewer';
    permissionOverrides?: ProcurementPermissionOverrides | null;
  },
) {
  const context = await getProcurementContext(serviceDb, userId);
  if (!context.orgProfileId || !context.profile) {
    throw new Error('No procurement workspace found.');
  }
  if (!hasGovernanceAdminAccess(context.currentUserPermissions)) {
    throw new Error('Only procurement leads can invite team members.');
  }

  const email = params.email.trim().toLowerCase();
  if (!email) {
    throw new Error('Email is required.');
  }

  const procurementRole = params.procurementRole || 'reviewer';
  const notificationMode = params.notificationMode || 'immediate';
  const orgRole = params.orgRole || 'viewer';
  const permissionOverrides = normalizePermissionOverrides(params.permissionOverrides);

  const { data: invitedUsers, error: invitedUsersError } = await serviceDb.rpc('get_user_by_email', {
    email_input: email,
  });
  if (invitedUsersError) throw invitedUsersError;

  const existingPendingQuery = await serviceDb
    .from('org_members')
    .select('id, org_profile_id, user_id, invited_email, role, invited_at, accepted_at')
    .eq('org_profile_id', context.orgProfileId)
    .eq('invited_email', email)
    .is('user_id', null)
    .maybeSingle();

  if (existingPendingQuery.error) throw existingPendingQuery.error;

  if (!invitedUsers || invitedUsers.length === 0) {
    let pendingMember = existingPendingQuery.data;
    if (!pendingMember) {
      const { data, error } = await serviceDb
        .from('org_members')
        .insert({
          org_profile_id: context.orgProfileId,
          user_id: null,
          invited_email: email,
          role: orgRole,
          invited_by: userId,
          invited_at: new Date().toISOString(),
        })
        .select('id, org_profile_id, user_id, invited_email, role, invited_at, accepted_at')
        .single();
      if (error) throw error;
      pendingMember = data;
    } else if (pendingMember.role !== orgRole) {
      const { data, error } = await serviceDb
        .from('org_members')
        .update({ role: orgRole })
        .eq('id', pendingMember.id)
        .select('id, org_profile_id, user_id, invited_email, role, invited_at, accepted_at')
        .single();
      if (error) throw error;
      pendingMember = data;
    }

    const { data: pendingSetting, error: pendingSettingError } = await serviceDb
      .from('procurement_pending_team_invites')
      .upsert({
        org_profile_id: context.orgProfileId,
        invited_email: email,
        procurement_role: procurementRole,
        notification_mode: notificationMode,
        permission_overrides: permissionOverrides,
        created_by: userId,
        updated_by: userId,
      }, { onConflict: 'org_profile_id,invited_email' })
      .select('id, org_profile_id, invited_email, procurement_role, notification_mode, permission_overrides')
      .single();

    if (pendingSettingError) throw pendingSettingError;

    return {
      status: existingPendingQuery.data ? 'pending_updated' : 'pending_created',
      invite: {
        id: pendingMember.id,
        org_profile_id: context.orgProfileId,
        invited_email: email,
        role: pendingMember.role,
        invited_at: pendingMember.invited_at,
        procurement_role: pendingSetting.procurement_role as ProcurementRole,
        notification_mode: pendingSetting.notification_mode as ProcurementNotificationMode,
        permission_overrides: normalizePermissionOverrides(pendingSetting.permission_overrides),
      } satisfies ProcurementPendingInviteRow,
      email,
      profileName: context.profile.name,
      procurementRole,
      notificationMode,
    };
  }

  const invitedUserId = invitedUsers[0].id as string;
  const { data: existingMember, error: existingMemberError } = await serviceDb
    .from('org_members')
    .select('id, org_profile_id, user_id, role, invited_at, accepted_at')
    .eq('org_profile_id', context.orgProfileId)
    .eq('user_id', invitedUserId)
    .maybeSingle();

  if (existingMemberError) throw existingMemberError;

  let memberRow = existingMember;
  if (!memberRow) {
    const { data, error } = await serviceDb
      .from('org_members')
      .insert({
        org_profile_id: context.orgProfileId,
        user_id: invitedUserId,
        role: orgRole,
        invited_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .select('id, org_profile_id, user_id, role, invited_at, accepted_at')
      .single();
    if (error) throw error;
    memberRow = data;
  }

  const { data: setting, error: settingError } = await serviceDb
    .from('procurement_team_settings')
    .upsert({
      org_profile_id: context.orgProfileId,
      user_id: invitedUserId,
      procurement_role: procurementRole,
      notification_mode: notificationMode,
      permission_overrides: permissionOverrides,
      created_by: userId,
      updated_by: userId,
    }, { onConflict: 'org_profile_id,user_id' })
    .select('user_id, procurement_role, notification_mode, permission_overrides')
    .single();

  if (settingError) throw settingError;

  const { error: cleanupPendingError } = await serviceDb
    .from('procurement_pending_team_invites')
    .delete()
    .eq('org_profile_id', context.orgProfileId)
    .eq('invited_email', email);
  if (cleanupPendingError) throw cleanupPendingError;

  return {
    status: existingMember ? 'member_updated' : 'member_added',
    member: {
      id: memberRow.id,
      org_profile_id: context.orgProfileId,
      user_id: invitedUserId,
      role: memberRow.role,
      procurement_role: setting.procurement_role as ProcurementRole,
      notification_mode: setting.notification_mode as ProcurementNotificationMode,
      permission_overrides: permissionOverrides,
    },
    email,
    profileName: context.profile.name,
    procurementRole,
    notificationMode,
  };
}

export async function queueProcurementNotifications(
  serviceDb: ServiceDb,
  params: {
    orgProfileId: string | null;
    shortlistId?: string | null;
    packExportId?: string | null;
    taskId?: string | null;
    alertId?: string | null;
    notificationType: ProcurementNotificationRow['notification_type'];
    subject: string;
    body?: string | null;
    payload?: Record<string, unknown>;
    recipients: Array<{
      userId: string | null;
      label?: string | null;
      deliveryMode?: ProcurementNotificationMode;
    }>;
  },
) {
  if (!params.orgProfileId || params.recipients.length === 0) {
    return [] as ProcurementNotificationRow[];
  }

  const dedupedRecipients = params.recipients.filter((recipient, index, all) => {
    if (!recipient.userId || recipient.deliveryMode === 'none') return false;
    return all.findIndex((candidate) => candidate.userId === recipient.userId && (candidate.deliveryMode || 'immediate') === (recipient.deliveryMode || 'immediate')) === index;
  });

  if (dedupedRecipients.length === 0) {
    return [] as ProcurementNotificationRow[];
  }

  const { data, error } = await serviceDb
    .from('procurement_notification_outbox')
    .insert(dedupedRecipients.map((recipient) => ({
      org_profile_id: params.orgProfileId,
      shortlist_id: params.shortlistId || null,
      pack_export_id: params.packExportId || null,
      task_id: params.taskId || null,
      alert_id: params.alertId || null,
      recipient_user_id: recipient.userId,
      recipient_label: recipient.label || null,
      notification_type: params.notificationType,
      delivery_mode: recipient.deliveryMode || 'immediate',
      subject: params.subject,
      body: params.body || null,
      payload: params.payload || {},
    })))
    .select('*');

  if (error) throw error;
  return (data || []) as ProcurementNotificationRow[];
}

async function getProfileLabel(serviceDb: ServiceDb, profileId: string | null | undefined) {
  if (!profileId) return null;
  const { data, error } = await serviceDb
    .from('profiles')
    .select('display_name, full_name, email')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data.display_name || data.full_name || data.email || null;
}

async function getNextPackVersion(
  serviceDb: ServiceDb,
  shortlistId: string,
) {
  const { data, error } = await serviceDb
    .from('procurement_pack_exports')
    .select('version_number')
    .eq('shortlist_id', shortlistId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.version_number || 0) + 1;
}

export async function getShortlistComments(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    shortlistId?: string | null;
    shortlistItemId?: string | null;
    includeSupplierComments?: boolean;
    limit?: number;
  } = {},
) {
  const context = await getExistingProcurementContext(serviceDb, userId, { shortlistId: params.shortlistId });
  if (!context.orgProfileId || !context.shortlist) {
    return { context, comments: [] as ProcurementCommentRow[] };
  }

  let query = serviceDb
    .from('procurement_shortlist_comments')
    .select('id, org_profile_id, shortlist_id, shortlist_item_id, pack_export_id, author_user_id, comment_type, body, created_at, updated_at')
    .eq('org_profile_id', context.orgProfileId)
    .eq('shortlist_id', context.shortlist.id)
    .order('created_at', { ascending: false })
    .limit(params.limit || 12);

  if (params.shortlistItemId) {
    query = query.eq('shortlist_item_id', params.shortlistItemId);
  } else if (!params.includeSupplierComments) {
    query = query.is('shortlist_item_id', null);
  }

  const { data, error } = await query;

  if (error) throw error;

  const authorIds = [...new Set((data || []).map((comment) => comment.author_user_id).filter((value): value is string => !!value))];
  const { data: authors, error: authorsError } = authorIds.length > 0
    ? await serviceDb
        .from('profiles')
        .select('id, display_name, full_name, email')
        .in('id', authorIds)
    : { data: [], error: null };

  if (authorsError) throw authorsError;

  const authorLabelById = new Map(
    (authors || []).map((author) => [
      author.id,
      author.display_name || author.full_name || author.email || null,
    ]),
  );

  return {
    context,
    comments: (data || []).map((comment) => ({
      ...(comment as ProcurementCommentRow),
      author_label: comment.author_user_id ? authorLabelById.get(comment.author_user_id) || null : null,
    })),
  };
}

export async function createProcurementComment(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    shortlistId?: string | null;
    shortlistItemId?: string | null;
    packExportId?: string | null;
    commentType?: ProcurementCommentRow['comment_type'];
    body: string;
  },
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: params.shortlistId });
  if (!context.orgProfileId || !context.shortlist) {
    throw new Error('No procurement workspace found.');
  }

  const isSupplierComment = !!params.shortlistItemId || params.commentType === 'supplier_review';

  if (isSupplierComment) {
    if (!hasEditAccess(context.currentUserPermissions)) {
      throw new Error('You do not have permission to add supplier review comments.');
    }
    assertShortlistEditable(context.shortlist, 'adding supplier review comments');
  } else if (!hasEditAccess(context.currentUserPermissions) && !hasApprovalAccess(context.currentUserPermissions)) {
    throw new Error('You do not have permission to comment on this procurement shortlist.');
  }

  const body = params.body.trim();
  if (!body) {
    throw new Error('Comment body is required.');
  }

  let supplierItem:
    | { id: string; supplier_name: string; gs_id: string | null }
    | null = null;

  if (params.shortlistItemId) {
    const { data: itemData, error: itemError } = await serviceDb
      .from('procurement_shortlist_items')
      .select('id, supplier_name, gs_id')
      .eq('id', params.shortlistItemId)
      .eq('shortlist_id', context.shortlist.id)
      .single();

    if (itemError) throw itemError;
    supplierItem = itemData;
  }

  const { data, error } = await serviceDb
    .from('procurement_shortlist_comments')
    .insert({
      org_profile_id: context.orgProfileId,
      shortlist_id: context.shortlist.id,
      shortlist_item_id: supplierItem?.id || null,
      pack_export_id: supplierItem ? null : (params.packExportId || context.shortlist.last_pack_export_id || null),
      author_user_id: userId,
      comment_type: params.commentType || (supplierItem ? 'supplier_review' : 'discussion'),
      body,
    })
    .select('id, org_profile_id, shortlist_id, shortlist_item_id, pack_export_id, author_user_id, comment_type, body, created_at, updated_at')
    .single();

  if (error) throw error;

  await recordProcurementEvent(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: context.shortlist.id,
    shortlistItemId: supplierItem?.id || null,
    userId,
    eventType: 'comment_added',
    eventSummary: supplierItem
      ? `Added supplier comment on ${supplierItem.supplier_name}`
      : `Added ${params.commentType || 'discussion'} comment on ${context.shortlist.name}`,
    payload: {
      comment_id: data.id,
      comment_type: data.comment_type,
      pack_export_id: data.pack_export_id,
      shortlist_item_id: supplierItem?.id || null,
      supplier_name: supplierItem?.supplier_name || null,
      gs_id: supplierItem?.gs_id || null,
    },
  });

  if (supplierItem) {
    await invalidateShortlistApprovalIfNeeded(serviceDb, {
      shortlist: context.shortlist,
      orgProfileId: context.orgProfileId,
      userId,
      reason: 'supplier review changed',
      payload: {
        supplier_name: supplierItem.supplier_name,
        gs_id: supplierItem.gs_id,
      },
    });
  }

  return {
    context,
    comment: {
      ...(data as ProcurementCommentRow),
      author_label: await getProfileLabel(serviceDb, userId),
    },
  };
}

export async function getEntityProcurementMemberships(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    gsId: string;
    supplierAbn?: string | null;
    preferredShortlistId?: string | null;
  },
) {
  const context = await getExistingProcurementContext(serviceDb, userId, { shortlistId: params.preferredShortlistId });
  if (!context.orgProfileId || context.shortlists.length === 0) {
    return {
      context,
      memberships: [] as Array<{
        id: string;
        shortlist_id: string;
        shortlist_name: string;
        shortlist_is_default: boolean;
        shortlist_owner_name: string | null;
        shortlist_decision_due_at: string | null;
        shortlist_next_action: string | null;
        note: string | null;
        decision_tag: string | null;
        updated_at: string;
        contract_count: number;
        contract_total_value: number;
      }>,
      tasks: [] as ProcurementTaskRow[],
    };
  }

  let query = serviceDb
    .from('procurement_shortlist_items')
    .select('id, shortlist_id, note, decision_tag, updated_at, contract_count, contract_total_value')
    .in('shortlist_id', context.shortlists.map((shortlist) => shortlist.id))
    .order('updated_at', { ascending: false });

  query = params.supplierAbn
    ? query.or(`gs_id.eq.${params.gsId},supplier_abn.eq.${params.supplierAbn}`)
    : query.eq('gs_id', params.gsId);

  const { data, error } = await query;
  if (error) throw error;

  const shortlistById = new Map(context.shortlists.map((shortlist) => [shortlist.id, shortlist]));
  const memberships = (data || [])
    .map((item) => {
      const shortlist = shortlistById.get(item.shortlist_id);
      if (!shortlist) return null;
      return {
        ...item,
        shortlist_name: shortlist.name,
        shortlist_is_default: shortlist.is_default,
        shortlist_owner_name: shortlist.owner_name,
        shortlist_decision_due_at: shortlist.decision_due_at,
        shortlist_next_action: shortlist.next_action,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const membershipItemIds = memberships.map((membership) => membership.id);
  const { data: taskData, error: taskError } = membershipItemIds.length > 0
    ? await serviceDb
        .from('procurement_tasks')
        .select('*')
        .in('shortlist_item_id', membershipItemIds)
        .neq('status', 'done')
        .order('priority', { ascending: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(12)
    : { data: [], error: null };

  if (taskError) throw taskError;

  return {
    context,
    memberships,
    tasks: (taskData || []) as ProcurementTaskRow[],
  };
}

export async function getShortlistWatch(
  serviceDb: ServiceDb,
  userId: string,
  options: {
    shortlistId?: string | null;
    createIfMissing?: boolean;
  } = {},
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: options.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    return { context, watch: null as ProcurementShortlistWatchRow | null };
  }

  let { data, error } = await serviceDb
    .from('procurement_shortlist_watches')
    .select('*')
    .eq('shortlist_id', context.shortlist.id)
    .maybeSingle();

  if (error) throw error;

  if (!data && options.createIfMissing) {
    const { data: inserted, error: insertError } = await serviceDb
      .from('procurement_shortlist_watches')
      .insert({
        org_profile_id: context.orgProfileId,
        shortlist_id: context.shortlist.id,
        interval_hours: 24,
        created_by: userId,
        updated_by: userId,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;
    data = inserted;
  }

  return { context, watch: (data as ProcurementShortlistWatchRow | null) || null };
}

export async function updateShortlistWatch(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    shortlistId?: string | null;
    enabled?: boolean;
    intervalHours?: number;
    lastRunAt?: string | null;
    nextRunAt?: string | null;
    lastSummary?: Record<string, unknown>;
    lastResultSnapshot?: Record<string, unknown>;
    lastAlertCount?: number;
  },
) {
  const { context, watch } = await getShortlistWatch(serviceDb, userId, {
    shortlistId: params.shortlistId,
    createIfMissing: true,
  });
  if (!context.shortlist || !context.orgProfileId) {
    throw new Error('No procurement workspace found.');
  }

  const intervalHours = normalizeIntervalHours(params.intervalHours ?? watch?.interval_hours);
  const updates = {
    enabled: params.enabled ?? watch?.enabled ?? false,
    interval_hours: intervalHours,
    last_run_at: params.lastRunAt === undefined ? watch?.last_run_at ?? null : params.lastRunAt,
    next_run_at: params.nextRunAt === undefined
      ? (
        params.enabled ?? watch?.enabled
          ? new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()
          : null
      )
      : params.nextRunAt,
    last_summary: params.lastSummary ?? watch?.last_summary ?? {},
    last_result_snapshot: params.lastResultSnapshot ?? watch?.last_result_snapshot ?? {},
    last_alert_count: params.lastAlertCount ?? watch?.last_alert_count ?? 0,
    updated_by: userId,
  };

  const { data, error } = await serviceDb
    .from('procurement_shortlist_watches')
    .upsert({
      org_profile_id: context.orgProfileId,
      shortlist_id: context.shortlist.id,
      created_by: watch ? undefined : userId,
      ...updates,
    }, { onConflict: 'shortlist_id' })
    .select('*')
    .single();
  if (error) throw error;

  return { context, watch: data as ProcurementShortlistWatchRow };
}

export async function createProcurementAlerts(
  serviceDb: ServiceDb,
  params: {
    orgProfileId: string | null;
    shortlistId?: string | null;
    alerts: Array<{
      shortlistItemId?: string | null;
      alertType: ProcurementAlertRow['alert_type'];
      severity?: ProcurementAlertRow['severity'];
      status?: ProcurementAlertRow['status'];
      title: string;
      body?: string | null;
      payload?: Record<string, unknown>;
    }>;
  },
) {
  if (!params.orgProfileId || params.alerts.length === 0) {
    return [];
  }

  const { data, error } = await serviceDb
    .from('procurement_alerts')
    .insert(params.alerts.map((alert) => ({
      org_profile_id: params.orgProfileId,
      shortlist_id: params.shortlistId || null,
      shortlist_item_id: alert.shortlistItemId || null,
      alert_type: alert.alertType,
      severity: alert.severity || 'info',
      status: alert.status || 'open',
      title: alert.title,
      body: alert.body || null,
      payload: alert.payload || {},
    })))
    .select('*');

  if (error) throw error;
  return (data || []) as ProcurementAlertRow[];
}

function pickActiveShortlist(shortlists: ProcurementShortlistRow[], shortlistId?: string | null) {
  if (shortlists.length === 0) {
    return null;
  }
  if (shortlistId) {
    const matched = shortlists.find((shortlist) => shortlist.id === shortlistId);
    if (matched) {
      return matched;
    }
  }
  return shortlists.find((shortlist) => shortlist.is_default) || shortlists[0];
}

export async function getProcurementContext(
  serviceDb: ServiceDb,
  userId: string,
  options: ProcurementContextOptions = {},
) {
  const orgContext = await getCurrentOrgProfileContext(serviceDb, userId);
  const procurementMembers = orgContext.orgProfileId
    ? await fetchProcurementTeamMembersForOrg(serviceDb, orgContext.orgProfileId)
    : [];
  const currentProcurementMember = procurementMembers.find((member) => member.user_id === userId) || null;
  const currentUserPermissions = currentProcurementMember?.permissions
    || resolveProcurementPermissions({
      role: currentProcurementMember?.procurement_role || orgContext.currentUserRole,
      isOwner: currentProcurementMember?.is_owner || orgContext.currentUserRole === 'admin',
      permissionOverrides: currentProcurementMember?.permission_overrides,
    });

  if (!orgContext.orgProfileId || !orgContext.profile) {
    return {
      ...orgContext,
      currentUserRole: currentProcurementMember?.procurement_role || orgContext.currentUserRole,
      currentUserPermissions,
      currentUserMember: currentProcurementMember,
      shortlists: [] as ProcurementShortlistRow[],
      shortlist: null as ProcurementShortlistRow | null,
    };
  }

  let shortlists = await fetchOrgShortlists(serviceDb, orgContext.orgProfileId);

  if (shortlists.length === 0 && options.createDefault !== false) {
    const { error } = await serviceDb
      .from('procurement_shortlists')
      .upsert(
        {
          org_profile_id: orgContext.orgProfileId,
          name: DEFAULT_SHORTLIST_NAME,
          is_default: true,
          updated_by: userId,
        },
        { onConflict: 'org_profile_id,name' },
      );

    if (error) {
      throw error;
    }

    shortlists = await fetchOrgShortlists(serviceDb, orgContext.orgProfileId);
  }

  return {
    ...orgContext,
    currentUserRole: currentProcurementMember?.procurement_role || fallbackProcurementRole(orgContext.currentUserRole, orgContext.currentUserRole === 'admin'),
    currentUserPermissions,
    currentUserMember: currentProcurementMember,
    shortlists,
    shortlist: pickActiveShortlist(shortlists, options.shortlistId),
  };
}

export async function getExistingProcurementContext(
  serviceDb: ServiceDb,
  userId: string,
  options: Omit<ProcurementContextOptions, 'createDefault'> = {},
) {
  return getProcurementContext(serviceDb, userId, { ...options, createDefault: false });
}

export async function recordProcurementEvent(
  serviceDb: ServiceDb,
  params: {
    orgProfileId: string | null;
    shortlistId?: string | null;
    shortlistItemId?: string | null;
    userId?: string | null;
    eventType:
      | 'shortlist_created'
      | 'shortlist_updated'
      | 'item_added'
      | 'item_removed'
      | 'note_updated'
      | 'decision_updated'
      | 'task_created'
      | 'task_updated'
      | 'task_completed'
      | 'checklist_updated'
      | 'pack_exported'
      | 'approval_updated'
      | 'comment_added';
    eventSummary: string;
    payload?: Record<string, unknown>;
  },
) {
  if (!params.orgProfileId) {
    return;
  }

  const { error } = await serviceDb
    .from('procurement_shortlist_events')
    .insert({
      org_profile_id: params.orgProfileId,
      shortlist_id: params.shortlistId || null,
      shortlist_item_id: params.shortlistItemId || null,
      user_id: params.userId || null,
      event_type: params.eventType,
      event_summary: params.eventSummary,
      payload: params.payload || {},
    });

  if (error) {
    console.error('[procurement-shortlist-event]', error.message);
  }
}

async function invalidateShortlistApprovalIfNeeded(
  serviceDb: ServiceDb,
  params: {
    shortlist: ProcurementShortlistRow | null;
    orgProfileId: string | null;
    userId: string;
    reason: string;
    payload?: Record<string, unknown>;
  },
) {
  if (!params.shortlist || !params.orgProfileId) {
    return params.shortlist;
  }

  if (params.shortlist.approval_lock_active) {
    throw new Error('This shortlist is approval-locked. Reopen it before making changes.');
  }

  if (params.shortlist.approval_status !== 'submitted' && params.shortlist.approval_status !== 'approved') {
    return params.shortlist;
  }

  const { data, error } = await serviceDb
    .from('procurement_shortlists')
    .update({
      approval_status: 'review_ready',
      requested_by: null,
      requested_at: null,
      approved_by: null,
      approved_at: null,
      approval_lock_active: false,
      approval_locked_at: null,
      approval_locked_by: null,
      updated_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.shortlist.id)
    .select(PROCUREMENT_SHORTLIST_SELECT)
    .single();

  if (error) throw error;

  await recordProcurementEvent(serviceDb, {
    orgProfileId: params.orgProfileId,
    shortlistId: params.shortlist.id,
    userId: params.userId,
    eventType: 'approval_updated',
    eventSummary: `Approval reset for ${params.shortlist.name} after ${params.reason}`,
    payload: {
      previous_status: params.shortlist.approval_status,
      next_status: 'review_ready',
      invalidation_reason: params.reason,
      ...(params.payload || {}),
    },
  });

  return data as ProcurementShortlistRow;
}

function assertShortlistEditable(shortlist: ProcurementShortlistRow | null, action: string) {
  if (!shortlist?.approval_lock_active) {
    return;
  }

  throw new Error(`This shortlist is approval-locked. Reopen it before ${action}.`);
}

export async function createProcurementShortlist(
  serviceDb: ServiceDb,
  userId: string,
  input: { name: string; description?: string | null },
) {
  const context = await getProcurementContext(serviceDb, userId);

  if (!context.orgProfileId || !context.profile) {
    throw new Error('Create an organisation profile before creating a shortlist.');
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Shortlist name is required.');
  }

  const { data, error } = await serviceDb
    .from('procurement_shortlists')
    .insert({
      org_profile_id: context.orgProfileId,
      name: trimmedName,
      description: input.description?.trim() || null,
      is_default: false,
      created_by: userId,
      updated_by: userId,
    })
    .select(PROCUREMENT_SHORTLIST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  await recordProcurementEvent(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: data.id,
    userId,
    eventType: 'shortlist_created',
    eventSummary: `Created shortlist "${trimmedName}"`,
    payload: {
      shortlist_name: trimmedName,
      description: input.description?.trim() || null,
    },
  });

  const nextContext = await getProcurementContext(serviceDb, userId, { shortlistId: data.id });

  return {
    context: nextContext,
    shortlist: data as ProcurementShortlistRow,
  };
}

export async function addSupplierToShortlist(
  serviceDb: ServiceDb,
  userId: string,
  supplier: WorkspaceSupplierInput,
  options: { shortlistId?: string | null } = {},
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: options.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    throw new Error('Create an organisation profile before saving a procurement shortlist.');
  }
  if (!hasEditAccess(context.currentUserPermissions)) {
    throw new Error('You do not have edit access for this procurement workspace.');
  }
  assertShortlistEditable(context.shortlist, 'changing the shortlist');

  const supplierKey = normalizeSupplierKey(supplier);
  const { data: existingItem } = await serviceDb
    .from('procurement_shortlist_items')
    .select('id')
    .eq('shortlist_id', context.shortlist.id)
    .eq('supplier_key', supplierKey)
    .maybeSingle();

  const { data, error } = await serviceDb
    .from('procurement_shortlist_items')
    .upsert(
      {
        shortlist_id: context.shortlist.id,
        supplier_key: supplierKey,
        gs_id: supplier.gs_id || null,
        supplier_abn: supplier.abn || null,
        supplier_name: supplier.canonical_name || 'Unknown supplier',
        entity_type: supplier.entity_type || null,
        state: supplier.state || null,
        postcode: supplier.postcode || null,
        remoteness: supplier.remoteness || null,
        lga_name: supplier.lga_name || null,
        seifa_irsd_decile: supplier.seifa_irsd_decile ?? null,
        latest_revenue: supplier.latest_revenue ?? null,
        is_community_controlled: supplier.is_community_controlled ?? false,
        contract_count: supplier.contracts?.count ?? 0,
        contract_total_value: supplier.contracts?.total_value ?? 0,
        source_payload: supplier,
        updated_by: userId,
        added_by: existingItem?.id ? undefined : userId,
      },
      { onConflict: 'shortlist_id,supplier_key' },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (!existingItem?.id) {
    await recordProcurementEvent(serviceDb, {
      orgProfileId: context.orgProfileId,
      shortlistId: context.shortlist.id,
      shortlistItemId: data.id,
      userId,
      eventType: 'item_added',
      eventSummary: `Added ${data.supplier_name} to ${context.shortlist.name}`,
      payload: {
        supplier_name: data.supplier_name,
        gs_id: data.gs_id,
        supplier_abn: data.supplier_abn,
        shortlist_name: context.shortlist.name,
      },
    });

    await invalidateShortlistApprovalIfNeeded(serviceDb, {
      shortlist: context.shortlist,
      orgProfileId: context.orgProfileId,
      userId,
      reason: 'supplier added to shortlist',
      payload: {
        supplier_name: data.supplier_name,
        gs_id: data.gs_id,
      },
    });
  }

  return {
    context,
    item: data,
  };
}

export async function updateShortlistFilters(
  serviceDb: ServiceDb,
  userId: string,
  filters: Record<string, unknown>,
  options: { shortlistId?: string | null } = {},
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: options.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    return context;
  }

  if (!hasEditAccess(context.currentUserPermissions)) {
    return context;
  }
  assertShortlistEditable(context.shortlist, 'updating the saved brief');

  const { error } = await serviceDb
    .from('procurement_shortlists')
    .update({
      filters,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', context.shortlist.id);

  if (error) {
    throw error;
  }

  await recordProcurementEvent(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: context.shortlist.id,
    userId,
    eventType: 'shortlist_updated',
    eventSummary: `Updated saved search filters for ${context.shortlist.name}`,
    payload: {
      shortlist_name: context.shortlist.name,
      filters,
    },
  });

  await invalidateShortlistApprovalIfNeeded(serviceDb, {
    shortlist: context.shortlist,
    orgProfileId: context.orgProfileId,
    userId,
    reason: 'saved brief filters changed',
    payload: { filters },
  });

  return context;
}

export async function updateProcurementShortlistSummary(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    shortlistId?: string | null;
    recommendationSummary?: string | null;
    whyNow?: string | null;
    riskSummary?: string | null;
    nextAction?: string | null;
    ownerName?: string | null;
    ownerUserId?: string | null;
    approverUserId?: string | null;
    decisionDueAt?: string | null;
    approvalStatus?: ProcurementShortlistRow['approval_status'];
    approvalNotes?: string | null;
    lastPackExportId?: string | null;
    approvedPackExportId?: string | null;
    reopenForChanges?: boolean;
  },
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: params.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    throw new Error('No procurement workspace found.');
  }

  const editsDecisionBrief =
    params.recommendationSummary !== undefined
    || params.whyNow !== undefined
    || params.riskSummary !== undefined
    || params.nextAction !== undefined
    || params.ownerName !== undefined
    || params.ownerUserId !== undefined
    || params.approverUserId !== undefined
    || params.decisionDueAt !== undefined
    || params.lastPackExportId !== undefined;

  if (params.reopenForChanges) {
    if (!hasReopenAccess(context.currentUserPermissions)) {
      throw new Error('Only procurement leads can reopen an approved shortlist for changes.');
    }
    if (!context.shortlist.approval_lock_active) {
      return {
        context,
        shortlist: context.shortlist,
      };
    }

    const { data, error } = await serviceDb
      .from('procurement_shortlists')
      .update({
        approval_status: 'review_ready',
        approval_notes: params.approvalNotes?.trim() || context.shortlist.approval_notes || null,
        requested_by: null,
        requested_at: null,
        approved_by: null,
        approved_at: null,
        approval_lock_active: false,
        approval_locked_at: null,
        approval_locked_by: null,
        reopened_at: new Date().toISOString(),
        reopened_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.shortlist.id)
      .select(PROCUREMENT_SHORTLIST_SELECT)
      .single();

    if (error) throw error;

    await recordProcurementEvent(serviceDb, {
      orgProfileId: context.orgProfileId,
      shortlistId: context.shortlist.id,
      userId,
      eventType: 'approval_updated',
      eventSummary: `Reopened ${context.shortlist.name} for changes`,
      payload: {
        shortlist_name: context.shortlist.name,
        previous_status: context.shortlist.approval_status,
        next_status: 'review_ready',
        approval_lock_active: false,
      },
    });

    if (params.approvalNotes?.trim()) {
      await createProcurementComment(serviceDb, userId, {
        shortlistId: context.shortlist.id,
        packExportId: context.shortlist.approved_pack_export_id || context.shortlist.last_pack_export_id || null,
        commentType: 'discussion',
        body: params.approvalNotes.trim(),
      });
    }

    return {
      context,
      shortlist: data as ProcurementShortlistRow,
    };
  }

  if (editsDecisionBrief && !hasEditAccess(context.currentUserPermissions)) {
    throw new Error('You do not have edit access for this procurement workspace.');
  }

  if (
    params.approvalNotes !== undefined
    && params.approvalStatus === undefined
    && !hasEditAccess(context.currentUserPermissions)
    && !hasApprovalAccess(context.currentUserPermissions)
  ) {
    throw new Error('You do not have permission to update approval notes for this procurement workspace.');
  }

  if (params.approvalStatus === 'submitted' && !hasSubmitAccess(context.currentUserPermissions)) {
    throw new Error('You do not have permission to submit this shortlist for sign-off.');
  }

  if ((params.approvalStatus === 'approved' || params.approvalStatus === 'changes_requested') && !hasApprovalAccess(context.currentUserPermissions)) {
    throw new Error('You do not have approval access for this procurement workspace.');
  }

  if (editsDecisionBrief) {
    assertShortlistEditable(context.shortlist, 'editing the decision brief');
  }

  const updates: Record<string, unknown> = {
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (params.recommendationSummary !== undefined) updates.recommendation_summary = params.recommendationSummary?.trim() || null;
  if (params.whyNow !== undefined) updates.why_now = params.whyNow?.trim() || null;
  if (params.riskSummary !== undefined) updates.risk_summary = params.riskSummary?.trim() || null;
  if (params.nextAction !== undefined) updates.next_action = params.nextAction?.trim() || null;
  if (params.ownerName !== undefined) updates.owner_name = params.ownerName?.trim() || null;
  if (params.ownerUserId !== undefined) {
    updates.owner_user_id = params.ownerUserId || null;
    updates.owner_name = params.ownerUserId ? await getProfileLabel(serviceDb, params.ownerUserId) : (params.ownerName?.trim() || null);
  }
  if (params.approverUserId !== undefined) {
    updates.approver_user_id = params.approverUserId || null;
  }
  if (params.decisionDueAt !== undefined) updates.decision_due_at = params.decisionDueAt || null;
  if (params.approvalNotes !== undefined) updates.approval_notes = params.approvalNotes?.trim() || null;
  if (params.lastPackExportId !== undefined) updates.last_pack_export_id = params.lastPackExportId || null;
  if (params.approvedPackExportId !== undefined) updates.approved_pack_export_id = params.approvedPackExportId || null;
  if (params.approvalStatus !== undefined) {
    updates.approval_status = params.approvalStatus;
    if (params.approvalStatus === 'submitted') {
      updates.requested_by = userId;
      updates.requested_at = new Date().toISOString();
      updates.approved_by = null;
      updates.approved_at = null;
      updates.approval_lock_active = false;
      updates.approval_locked_at = null;
      updates.approval_locked_by = null;
    } else if (params.approvalStatus === 'approved') {
      updates.approved_by = userId;
      updates.approved_at = new Date().toISOString();
      updates.approved_pack_export_id =
        params.approvedPackExportId
        || params.lastPackExportId
        || context.shortlist.last_pack_export_id
        || null;
      updates.approval_lock_active = true;
      updates.approval_locked_at = new Date().toISOString();
      updates.approval_locked_by = userId;
    } else if (params.approvalStatus === 'draft' || params.approvalStatus === 'review_ready' || params.approvalStatus === 'changes_requested') {
      updates.approval_lock_active = false;
      updates.approval_locked_at = null;
      updates.approval_locked_by = null;
      if (params.approvalStatus === 'draft' || params.approvalStatus === 'review_ready') {
        updates.approved_by = null;
        updates.approved_at = null;
      }
      if (params.approvalStatus === 'draft') {
        updates.requested_by = null;
        updates.requested_at = null;
      }
    }
  }

  const { data, error } = await serviceDb
    .from('procurement_shortlists')
    .update(updates)
    .eq('id', context.shortlist.id)
    .select(PROCUREMENT_SHORTLIST_SELECT)
    .single();

  if (error) throw error;

  let nextShortlist = data as ProcurementShortlistRow;

  await recordProcurementEvent(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: context.shortlist.id,
    userId,
    eventType: params.approvalStatus !== undefined ? 'approval_updated' : 'shortlist_updated',
    eventSummary: params.approvalStatus !== undefined
      ? `Updated approval status for ${context.shortlist.name}`
      : `Updated decision summary for ${context.shortlist.name}`,
    payload: {
      shortlist_name: context.shortlist.name,
      recommendation_summary: updates.recommendation_summary,
      why_now: updates.why_now,
      risk_summary: updates.risk_summary,
      next_action: updates.next_action,
      owner_name: updates.owner_name,
      owner_user_id: updates.owner_user_id,
      approver_user_id: updates.approver_user_id,
      decision_due_at: updates.decision_due_at,
      approval_status: updates.approval_status,
      approval_notes: updates.approval_notes,
      last_pack_export_id: updates.last_pack_export_id,
      approved_pack_export_id: updates.approved_pack_export_id,
      approval_lock_active: updates.approval_lock_active,
    },
  });

  const approvalCommentType = params.approvalStatus === 'submitted'
    ? 'submission'
    : params.approvalStatus === 'approved'
      ? 'approval'
      : params.approvalStatus === 'changes_requested'
        ? 'changes_requested'
        : null;

  if (approvalCommentType && params.approvalNotes?.trim()) {
    await createProcurementComment(serviceDb, userId, {
      shortlistId: context.shortlist.id,
      packExportId:
        params.approvedPackExportId
        || params.lastPackExportId
        || context.shortlist.last_pack_export_id
        || null,
      commentType: approvalCommentType,
      body: params.approvalNotes.trim(),
    });
  }

  if (params.approvalStatus !== undefined) {
    const teamMembers = await fetchProcurementTeamMembersForOrg(serviceDb, context.orgProfileId);
    const memberByUserId = new Map(teamMembers.map((member) => [member.user_id, member]));
    const subjectByStatus = {
      submitted: `${context.shortlist.name} submitted for sign-off`,
      approved: `${context.shortlist.name} approved`,
      changes_requested: `${context.shortlist.name} needs changes`,
    } as const;

    if (params.approvalStatus === 'submitted' || params.approvalStatus === 'approved' || params.approvalStatus === 'changes_requested') {
      const recipientIds = params.approvalStatus === 'submitted'
        ? [
            nextShortlist.approver_user_id,
            ...teamMembers
              .filter((member) => member.procurement_role === 'lead' || member.procurement_role === 'approver')
              .map((member) => member.user_id),
          ]
        : [nextShortlist.owner_user_id, nextShortlist.requested_by];

      await queueProcurementNotifications(serviceDb, {
        orgProfileId: context.orgProfileId,
        shortlistId: context.shortlist.id,
        packExportId:
          nextShortlist.approved_pack_export_id
          || nextShortlist.last_pack_export_id
          || null,
        notificationType:
          params.approvalStatus === 'submitted'
            ? 'signoff_submitted'
            : params.approvalStatus === 'approved'
              ? 'signoff_approved'
              : 'signoff_changes_requested',
        subject: subjectByStatus[params.approvalStatus],
        body: params.approvalNotes?.trim() || nextShortlist.approval_notes || null,
        payload: {
          shortlist_id: context.shortlist.id,
          shortlist_name: context.shortlist.name,
          approval_status: params.approvalStatus,
          pack_export_id:
            nextShortlist.approved_pack_export_id
            || nextShortlist.last_pack_export_id
            || null,
        },
        recipients: recipientIds
          .filter((value): value is string => !!value && value !== userId)
          .map((recipientUserId) => ({
            userId: recipientUserId,
            label: memberByUserId.get(recipientUserId)?.display_name
              || memberByUserId.get(recipientUserId)?.full_name
              || memberByUserId.get(recipientUserId)?.email
              || null,
            deliveryMode: memberByUserId.get(recipientUserId)?.notification_mode || 'immediate',
          })),
      });
    }
  }

  const shouldInvalidateApproval =
    params.approvalStatus === undefined
    && (
      params.recommendationSummary !== undefined
      || params.whyNow !== undefined
      || params.riskSummary !== undefined
      || params.nextAction !== undefined
      || params.ownerName !== undefined
      || params.ownerUserId !== undefined
      || params.approverUserId !== undefined
      || params.decisionDueAt !== undefined
    );

  if (shouldInvalidateApproval) {
    nextShortlist = await invalidateShortlistApprovalIfNeeded(serviceDb, {
      shortlist: context.shortlist,
      orgProfileId: context.orgProfileId,
      userId,
      reason: 'decision brief changed',
      payload: {
        shortlist_name: context.shortlist.name,
      },
    }) || nextShortlist;
  }

  return {
    context,
    shortlist: nextShortlist,
  };
}

export async function createProcurementTasks(
  serviceDb: ServiceDb,
  params: {
    orgProfileId: string | null;
    shortlistId: string;
    userId?: string | null;
    tasks: Array<{
      shortlistItemId?: string | null;
      alertId?: string | null;
      taskKey?: string | null;
      taskType: ProcurementTaskRow['task_type'];
      title: string;
      description?: string | null;
      priority?: ProcurementTaskRow['priority'];
      dueAt?: string | null;
      assigneeLabel?: string | null;
      assigneeUserId?: string | null;
      completionOutcome?: ProcurementTaskRow['completion_outcome'];
      completionNote?: string | null;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  if (!params.orgProfileId || params.tasks.length === 0) {
    return [] as ProcurementTaskRow[];
  }

  const taskKeys = params.tasks
    .map((task) => task.taskKey)
    .filter((value): value is string => !!value);

  const { data: existingTasks, error: existingError } = taskKeys.length > 0
    ? await serviceDb
        .from('procurement_tasks')
        .select('id, task_key')
        .eq('org_profile_id', params.orgProfileId)
        .in('task_key', taskKeys)
        .in('status', ['open', 'in_progress'])
    : { data: [], error: null };

  if (existingError) throw existingError;

  const existingTaskKeySet = new Set((existingTasks || []).map((task) => task.task_key).filter(Boolean));
  const rowsToInsert = params.tasks.filter((task) => !task.taskKey || !existingTaskKeySet.has(task.taskKey));

  if (rowsToInsert.length === 0) {
    return [] as ProcurementTaskRow[];
  }

  const assigneeLabels = new Map<string, string | null>();
  for (const task of rowsToInsert) {
    if (task.assigneeUserId && !assigneeLabels.has(task.assigneeUserId)) {
      assigneeLabels.set(task.assigneeUserId, await getProfileLabel(serviceDb, task.assigneeUserId));
    }
  }

  const { data, error } = await serviceDb
    .from('procurement_tasks')
    .insert(rowsToInsert.map((task) => ({
      org_profile_id: params.orgProfileId,
      shortlist_id: params.shortlistId,
      shortlist_item_id: task.shortlistItemId || null,
      alert_id: task.alertId || null,
      task_key: task.taskKey || null,
      task_type: task.taskType,
      title: task.title,
      description: task.description || null,
      priority: task.priority || 'medium',
      due_at: task.dueAt || null,
      assignee_label: task.assigneeUserId ? assigneeLabels.get(task.assigneeUserId) || task.assigneeLabel || null : task.assigneeLabel || null,
      assignee_user_id: task.assigneeUserId || null,
      completion_outcome: task.completionOutcome || null,
      completion_note: task.completionNote?.trim() || null,
      completed_at: null,
      completed_by: null,
      metadata: task.metadata || {},
      created_by: params.userId || null,
      updated_by: params.userId || null,
    })))
    .select('*');

  if (error) throw error;

  for (const task of data || []) {
    await recordProcurementEvent(serviceDb, {
      orgProfileId: params.orgProfileId,
      shortlistId: params.shortlistId,
      shortlistItemId: task.shortlist_item_id,
      userId: params.userId || null,
      eventType: 'task_created',
      eventSummary: `Created task: ${task.title}`,
      payload: {
        task_id: task.id,
        task_type: task.task_type,
        priority: task.priority,
        title: task.title,
        due_at: task.due_at,
      },
    });
  }

  return (data || []) as ProcurementTaskRow[];
}

export async function updateProcurementTask(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    taskId: string;
    shortlistId?: string | null;
    status?: ProcurementTaskRow['status'];
    priority?: ProcurementTaskRow['priority'];
    dueAt?: string | null;
    assigneeLabel?: string | null;
    assigneeUserId?: string | null;
    completionOutcome?: ProcurementTaskRow['completion_outcome'];
    completionNote?: string | null;
    title?: string;
    description?: string | null;
    shortlistItemId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: params.shortlistId });
  if (!context.orgProfileId) {
    throw new Error('No procurement workspace found.');
  }

  if (!hasTaskAccess(context.currentUserPermissions)) {
    throw new Error('You do not have task access for this procurement workspace.');
  }

  const { data: existingTask, error: existingError } = await serviceDb
    .from('procurement_tasks')
    .select('*')
    .eq('id', params.taskId)
    .eq('org_profile_id', context.orgProfileId)
    .single();

  if (existingError) throw existingError;

  const updates: Record<string, unknown> = {
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (params.status !== undefined) updates.status = params.status;
  if (params.priority !== undefined) updates.priority = params.priority;
  if (params.dueAt !== undefined) updates.due_at = params.dueAt;
  if (params.assigneeLabel !== undefined) updates.assignee_label = params.assigneeLabel?.trim() || null;
  if (params.assigneeUserId !== undefined) {
    updates.assignee_user_id = params.assigneeUserId || null;
    updates.assignee_label = params.assigneeUserId ? await getProfileLabel(serviceDb, params.assigneeUserId) : (params.assigneeLabel?.trim() || null);
  }
  if (params.completionOutcome !== undefined) updates.completion_outcome = params.completionOutcome || null;
  if (params.completionNote !== undefined) updates.completion_note = params.completionNote?.trim() || null;
  if (params.title !== undefined) updates.title = params.title.trim();
  if (params.description !== undefined) updates.description = params.description?.trim() || null;
  if (params.shortlistItemId !== undefined) updates.shortlist_item_id = params.shortlistItemId;
  if (params.metadata !== undefined) updates.metadata = params.metadata;

  const nextStatus = (updates.status as ProcurementTaskRow['status'] | undefined) ?? existingTask.status;
  if (nextStatus === 'done') {
    updates.completed_at = new Date().toISOString();
    updates.completed_by = userId;
  } else if (params.status !== undefined && existingTask.status === 'done') {
    updates.completed_at = null;
    updates.completed_by = null;
    updates.completion_outcome = null;
    if (params.completionNote === undefined) {
      updates.completion_note = null;
    }
  }

  const hasMeaningfulChange = Object.entries(updates).some(([key, value]) => {
    if (key === 'updated_by' || key === 'updated_at') return false;
    const existingValue = existingTask[key];
    return (existingValue ?? null) !== (value ?? null);
  });

  if (!hasMeaningfulChange) {
    return {
      context,
      task: existingTask as ProcurementTaskRow,
    };
  }

  const { data, error } = await serviceDb
    .from('procurement_tasks')
    .update(updates)
    .eq('id', params.taskId)
    .eq('org_profile_id', context.orgProfileId)
    .select('*')
    .single();

  if (error) throw error;

  const taskStatusChanged = params.status !== undefined && params.status !== existingTask.status;

  if (taskStatusChanged && data.status === 'done') {
    const { error: resolveAlertError } = await serviceDb
      .from('procurement_alerts')
      .update({
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .eq('org_profile_id', context.orgProfileId)
      .in('alert_type', ['task_due', 'task_escalated'])
      .eq('status', 'open')
      .contains('payload', { task_id: data.id });

    if (resolveAlertError) {
      console.error('[procurement-task-alert-resolve]', resolveAlertError.message);
    }
  }

  await recordProcurementEvent(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: data.shortlist_id,
    shortlistItemId: data.shortlist_item_id,
    userId,
    eventType: taskStatusChanged && data.status === 'done' ? 'task_completed' : 'task_updated',
    eventSummary: taskStatusChanged && data.status === 'done'
      ? `Completed task: ${data.title}${data.completion_outcome ? ` (${String(data.completion_outcome).replace(/_/g, ' ')})` : ''}`
      : `Updated task: ${data.title}`,
    payload: {
      task_id: data.id,
      previous_status: existingTask.status,
      next_status: data.status,
        previous_priority: existingTask.priority,
        next_priority: data.priority,
        due_at: data.due_at,
        assignee_label: data.assignee_label,
        assignee_user_id: data.assignee_user_id,
        shortlist_item_id: data.shortlist_item_id,
        completion_outcome: data.completion_outcome,
        completion_note: data.completion_note,
        completed_at: data.completed_at,
      },
    });

  return {
    context,
    task: data as ProcurementTaskRow,
  };
}

export async function updateProcurementShortlistItem(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    itemId: string;
    note?: string;
    decisionTag?: string;
    reviewChecklist?: Partial<ProcurementReviewChecklist>;
    evidenceSnapshot?: Record<string, unknown>;
    shortlistId?: string | null;
  },
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: params.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    throw new Error('No procurement workspace found.');
  }
  if (!hasEditAccess(context.currentUserPermissions)) {
    throw new Error('You do not have edit access for this procurement workspace.');
  }
  assertShortlistEditable(context.shortlist, 'reviewing shortlisted suppliers');

  const { data: existingItem, error: existingError } = await serviceDb
    .from('procurement_shortlist_items')
    .select('*')
    .eq('id', params.itemId)
    .eq('shortlist_id', context.shortlist.id)
    .single();

  if (existingError) {
    throw existingError;
  }

  const updates: Record<string, unknown> = {
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const existingChecklist = normalizeReviewChecklist(existingItem.review_checklist);
  const nextChecklist = params.reviewChecklist
    ? {
        ...existingChecklist,
        ...params.reviewChecklist,
      }
    : existingChecklist;
  const nextEvidenceSnapshot = params.evidenceSnapshot
    ? {
        ...(typeof existingItem.evidence_snapshot === 'object' && existingItem.evidence_snapshot ? existingItem.evidence_snapshot : {}),
        ...params.evidenceSnapshot,
      }
    : existingItem.evidence_snapshot;

  if (params.note !== undefined) updates.note = params.note || null;
  if (params.decisionTag !== undefined) updates.decision_tag = params.decisionTag || null;
  if (params.reviewChecklist !== undefined) updates.review_checklist = nextChecklist;
  if (params.evidenceSnapshot !== undefined) updates.evidence_snapshot = nextEvidenceSnapshot;

  if (
    params.note !== undefined
    || params.decisionTag !== undefined
    || params.reviewChecklist !== undefined
    || params.evidenceSnapshot !== undefined
  ) {
    updates.last_reviewed_at = new Date().toISOString();
    updates.last_reviewed_by = userId;
  }

  const { data, error } = await serviceDb
    .from('procurement_shortlist_items')
    .update(updates)
    .eq('id', params.itemId)
    .eq('shortlist_id', context.shortlist.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (params.note !== undefined && (existingItem.note || '') !== (data.note || '')) {
    await recordProcurementEvent(serviceDb, {
      orgProfileId: context.orgProfileId,
      shortlistId: context.shortlist.id,
      shortlistItemId: data.id,
      userId,
      eventType: 'note_updated',
      eventSummary: data.note
        ? `Updated note for ${data.supplier_name}`
        : `Cleared note for ${data.supplier_name}`,
      payload: {
        supplier_name: data.supplier_name,
        gs_id: data.gs_id,
        previous_note: existingItem.note,
        next_note: data.note,
      },
    });
  }

  if (params.decisionTag !== undefined && (existingItem.decision_tag || '') !== (data.decision_tag || '')) {
    await recordProcurementEvent(serviceDb, {
      orgProfileId: context.orgProfileId,
      shortlistId: context.shortlist.id,
      shortlistItemId: data.id,
      userId,
      eventType: 'decision_updated',
      eventSummary: data.decision_tag
        ? `Marked ${data.supplier_name} as ${decisionTagLabel(data.decision_tag).toLowerCase()}`
        : `Reset decision tag for ${data.supplier_name}`,
      payload: {
        supplier_name: data.supplier_name,
        gs_id: data.gs_id,
        previous_decision_tag: existingItem.decision_tag,
        next_decision_tag: data.decision_tag,
      },
    });
  }

  if (params.reviewChecklist !== undefined) {
    const checklistChanged = JSON.stringify(existingChecklist) !== JSON.stringify(normalizeReviewChecklist(data.review_checklist));
    if (checklistChanged) {
      await recordProcurementEvent(serviceDb, {
        orgProfileId: context.orgProfileId,
        shortlistId: context.shortlist.id,
        shortlistItemId: data.id,
        userId,
        eventType: 'checklist_updated',
        eventSummary: `Updated review checklist for ${data.supplier_name}`,
        payload: {
          supplier_name: data.supplier_name,
          gs_id: data.gs_id,
          previous_checklist: existingChecklist,
          next_checklist: normalizeReviewChecklist(data.review_checklist),
        },
      });
    }
  }

  const noteChanged = params.note !== undefined && (existingItem.note || '') !== (data.note || '');
  const decisionChanged = params.decisionTag !== undefined && (existingItem.decision_tag || '') !== (data.decision_tag || '');
  const checklistChanged = params.reviewChecklist !== undefined
    && JSON.stringify(existingChecklist) !== JSON.stringify(normalizeReviewChecklist(data.review_checklist));

  if (noteChanged || decisionChanged || checklistChanged) {
    await invalidateShortlistApprovalIfNeeded(serviceDb, {
      shortlist: context.shortlist,
      orgProfileId: context.orgProfileId,
      userId,
      reason: 'supplier review changed',
      payload: {
        supplier_name: data.supplier_name,
        gs_id: data.gs_id,
      },
    });
  }

  return {
    context,
    item: data,
  };
}

export async function removeProcurementShortlistItem(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    itemId: string;
    shortlistId?: string | null;
  },
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: params.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    throw new Error('No procurement workspace found.');
  }
  if (!hasEditAccess(context.currentUserPermissions)) {
    throw new Error('You do not have edit access for this procurement workspace.');
  }
  assertShortlistEditable(context.shortlist, 'removing suppliers');

  const { data: existingItem, error: existingError } = await serviceDb
    .from('procurement_shortlist_items')
    .select('*')
    .eq('id', params.itemId)
    .eq('shortlist_id', context.shortlist.id)
    .single();

  if (existingError) {
    throw existingError;
  }

  await recordProcurementEvent(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: context.shortlist.id,
    shortlistItemId: existingItem.id,
    userId,
    eventType: 'item_removed',
    eventSummary: `Removed ${existingItem.supplier_name} from ${context.shortlist.name}`,
    payload: {
      supplier_name: existingItem.supplier_name,
      gs_id: existingItem.gs_id,
      supplier_abn: existingItem.supplier_abn,
      shortlist_name: context.shortlist.name,
    },
  });

  const { error } = await serviceDb
    .from('procurement_shortlist_items')
    .delete()
    .eq('id', params.itemId)
    .eq('shortlist_id', context.shortlist.id);

  if (error) {
    throw error;
  }

  await invalidateShortlistApprovalIfNeeded(serviceDb, {
    shortlist: context.shortlist,
    orgProfileId: context.orgProfileId,
    userId,
    reason: 'supplier removed from shortlist',
    payload: {
      supplier_name: existingItem.supplier_name,
      gs_id: existingItem.gs_id,
    },
  });

  return {
    context,
    item: existingItem,
  };
}

export async function createProcurementPackExport(
  serviceDb: ServiceDb,
  userId: string,
  params: {
    shortlistId?: string | null;
    workflowRunId?: string | null;
    title: string;
    exportSummary?: Record<string, unknown>;
    packPayload: Record<string, unknown>;
    evidenceSnapshot?: Record<string, unknown>;
  },
) {
  const context = await getProcurementContext(serviceDb, userId, { shortlistId: params.shortlistId });
  if (!context.shortlist || !context.orgProfileId) {
    return null;
  }
  if (!hasEditAccess(context.currentUserPermissions)) {
    throw new Error('You do not have edit access for this procurement workspace.');
  }
  if (context.shortlist.approval_lock_active) {
    throw new Error('This shortlist is approval-locked. Reopen it before generating a new decision pack.');
  }

  const nextVersionNumber = await getNextPackVersion(serviceDb, context.shortlist.id);
  const exportSummary = {
    ...(params.exportSummary || {}),
    version_number: nextVersionNumber,
  };

  const { data, error } = await serviceDb
    .from('procurement_pack_exports')
    .insert({
      org_profile_id: context.orgProfileId,
      shortlist_id: context.shortlist.id,
      workflow_run_id: params.workflowRunId || null,
      title: params.title.trim(),
      version_number: nextVersionNumber,
      export_summary: exportSummary,
      pack_payload: params.packPayload,
      evidence_snapshot: params.evidenceSnapshot || {},
      source_shortlist_updated_at: context.shortlist.updated_at,
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const { error: supersedeError } = await serviceDb
    .from('procurement_pack_exports')
    .update({
      superseded_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('shortlist_id', context.shortlist.id)
    .neq('id', data.id)
    .is('superseded_at', null);

  if (supersedeError) {
    throw supersedeError;
  }

  await recordProcurementEvent(serviceDb, {
    orgProfileId: context.orgProfileId,
    shortlistId: context.shortlist.id,
    userId,
    eventType: 'pack_exported',
    eventSummary: `Generated decision pack for ${context.shortlist.name}`,
    payload: {
      export_id: data.id,
      title: data.title,
      version_number: data.version_number,
      shortlist_name: context.shortlist.name,
      workflow_run_id: params.workflowRunId || null,
    },
  });

  return data as ProcurementPackExportRow;
}

export async function processDueTaskReminders(
  serviceDb: ServiceDb,
  params: {
    orgProfileId: string;
    shortlistId?: string | null;
  },
) {
  const reminderCadenceMs = 24 * 60 * 60 * 1000;
  const escalationThresholdMs = 48 * 60 * 60 * 1000;
  const dueThresholdIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let taskQuery = serviceDb
    .from('procurement_tasks')
    .select('id, shortlist_id, shortlist_item_id, title, due_at, status, assignee_label, assignee_user_id, metadata, reminder_count, last_reminded_at')
    .eq('org_profile_id', params.orgProfileId)
    .in('status', ['open', 'in_progress'])
    .not('due_at', 'is', null)
    .lte('due_at', dueThresholdIso)
    .order('due_at', { ascending: true })
    .limit(25);

  if (params.shortlistId) {
    taskQuery = taskQuery.eq('shortlist_id', params.shortlistId);
  }

  const { data: dueTasks, error: dueTasksError } = await taskQuery;
  if (dueTasksError) throw dueTasksError;
  if (!dueTasks || dueTasks.length === 0) {
    return {
      alertsCreated: 0,
      escalationAlertsCreated: 0,
      remindersProcessed: 0,
    };
  }

  const { data: existingAlerts, error: alertsError } = await serviceDb
    .from('procurement_alerts')
    .select('id, alert_type, payload')
    .eq('org_profile_id', params.orgProfileId)
    .in('alert_type', ['task_due', 'task_escalated'])
    .eq('status', 'open');

  if (alertsError) throw alertsError;

  const now = Date.now();
  const openAlertsByTaskId = new Map<string, string[]>();
  const openEscalationsByTaskId = new Map<string, string[]>();
  for (const alert of existingAlerts || []) {
    const payload = typeof alert.payload === 'object' && alert.payload ? alert.payload as Record<string, unknown> : {};
    const taskId = typeof payload.task_id === 'string' ? payload.task_id : null;
    if (!taskId) continue;
    if (alert.alert_type === 'task_escalated') {
      const existing = openEscalationsByTaskId.get(taskId) || [];
      existing.push(alert.id);
      openEscalationsByTaskId.set(taskId, existing);
    } else {
      const existing = openAlertsByTaskId.get(taskId) || [];
      existing.push(alert.id);
      openAlertsByTaskId.set(taskId, existing);
    }
  }

  const reminders = dueTasks.filter((task) => {
    if (!task.last_reminded_at) return true;
    const lastRemindedAt = new Date(task.last_reminded_at).getTime();
    if (Number.isNaN(lastRemindedAt)) return true;
    return now - lastRemindedAt >= reminderCadenceMs;
  });
  if (reminders.length === 0) {
    return {
      alertsCreated: 0,
      escalationAlertsCreated: 0,
      remindersProcessed: dueTasks.length,
    };
  }

  const alertIdsToResolve = reminders.flatMap((task) => openAlertsByTaskId.get(task.id) || []);
  if (alertIdsToResolve.length > 0) {
    const { error: resolveError } = await serviceDb
      .from('procurement_alerts')
      .update({
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .in('id', alertIdsToResolve);

    if (resolveError) throw resolveError;
  }

  const alerts = await createProcurementAlerts(serviceDb, {
    orgProfileId: params.orgProfileId,
    shortlistId: params.shortlistId,
    alerts: reminders.map((task) => {
      const dueAt = task.due_at ? new Date(task.due_at).getTime() : now;
      const overdue = dueAt < now;
      return {
        shortlistItemId: task.shortlist_item_id,
        alertType: 'task_due',
        severity: overdue ? 'critical' : 'warning',
        title: overdue ? `Task overdue: ${task.title}` : `Task due soon: ${task.title}`,
        body: overdue
          ? `${task.assignee_label || 'Assigned reviewer'} has an overdue procurement task.`
          : `${task.assignee_label || 'Assigned reviewer'} has a procurement task due within 24 hours.`,
        payload: {
          task_id: task.id,
          due_at: task.due_at,
          shortlist_id: task.shortlist_id,
          shortlist_item_id: task.shortlist_item_id,
          gs_id: typeof task.metadata?.gs_id === 'string' ? task.metadata.gs_id : null,
          supplier_name: typeof task.metadata?.supplier_name === 'string' ? task.metadata.supplier_name : null,
          assignee_label: task.assignee_label,
          assignee_user_id: task.assignee_user_id,
          reminder_count: (task.reminder_count || 0) + 1,
        },
      };
    }),
  });

  const escalations = reminders.filter((task) => {
    const dueAt = task.due_at ? new Date(task.due_at).getTime() : now;
    const isOverdueLongEnough = dueAt < (now - escalationThresholdMs);
    const nextReminderCount = (task.reminder_count || 0) + 1;
    if (!isOverdueLongEnough && nextReminderCount < 3) {
      return false;
    }
    return (openEscalationsByTaskId.get(task.id) || []).length === 0;
  });

  const escalationAlerts = escalations.length > 0
    ? await createProcurementAlerts(serviceDb, {
        orgProfileId: params.orgProfileId,
        shortlistId: params.shortlistId,
        alerts: escalations.map((task) => ({
          shortlistItemId: task.shortlist_item_id,
          alertType: 'task_escalated',
          severity: 'critical',
          title: `Escalated overdue task: ${task.title}`,
          body: `${task.assignee_label || 'Assigned reviewer'} has not cleared this task after repeated reminders.`,
          payload: {
            task_id: task.id,
            due_at: task.due_at,
            shortlist_id: task.shortlist_id,
            shortlist_item_id: task.shortlist_item_id,
            gs_id: typeof task.metadata?.gs_id === 'string' ? task.metadata.gs_id : null,
            supplier_name: typeof task.metadata?.supplier_name === 'string' ? task.metadata.supplier_name : null,
            assignee_label: task.assignee_label,
            assignee_user_id: task.assignee_user_id,
            reminder_count: (task.reminder_count || 0) + 1,
            escalation_reason: 'overdue_reminder_threshold',
          },
        })),
      })
    : [];

  const teamMembers = await fetchProcurementTeamMembersForOrg(serviceDb, params.orgProfileId);
  const memberByUserId = new Map(teamMembers.map((member) => [member.user_id, member]));

  for (const alert of alerts) {
    const payload = typeof alert.payload === 'object' && alert.payload ? alert.payload as Record<string, unknown> : {};
    const task = reminders.find((candidate) => candidate.id === payload.task_id);
    if (!task) continue;
    const fallbackRecipients = teamMembers
      .filter((member) => member.procurement_role === 'lead')
      .map((member) => member.user_id);
    const recipientIds = task.assignee_user_id ? [task.assignee_user_id] : fallbackRecipients;
    await queueProcurementNotifications(serviceDb, {
      orgProfileId: params.orgProfileId,
      shortlistId: task.shortlist_id,
      taskId: task.id,
      alertId: alert.id,
      notificationType: 'task_due',
      subject: alert.title,
      body: alert.body,
      payload,
      recipients: recipientIds.map((recipientUserId) => ({
        userId: recipientUserId,
        label: memberByUserId.get(recipientUserId)?.display_name
          || memberByUserId.get(recipientUserId)?.full_name
          || memberByUserId.get(recipientUserId)?.email
          || null,
        deliveryMode: memberByUserId.get(recipientUserId)?.notification_mode || 'immediate',
      })),
    });
  }

  for (const alert of escalationAlerts) {
    const payload = typeof alert.payload === 'object' && alert.payload ? alert.payload as Record<string, unknown> : {};
    const task = reminders.find((candidate) => candidate.id === payload.task_id);
    if (!task) continue;
    const recipientIds = [
      task.assignee_user_id,
      ...teamMembers
        .filter((member) => member.procurement_role === 'lead' || member.procurement_role === 'approver')
        .map((member) => member.user_id),
    ].filter((value): value is string => !!value);
    await queueProcurementNotifications(serviceDb, {
      orgProfileId: params.orgProfileId,
      shortlistId: task.shortlist_id,
      taskId: task.id,
      alertId: alert.id,
      notificationType: 'task_escalated',
      subject: alert.title,
      body: alert.body,
      payload,
      recipients: recipientIds.map((recipientUserId) => ({
        userId: recipientUserId,
        label: memberByUserId.get(recipientUserId)?.display_name
          || memberByUserId.get(recipientUserId)?.full_name
          || memberByUserId.get(recipientUserId)?.email
          || null,
        deliveryMode: memberByUserId.get(recipientUserId)?.notification_mode || 'immediate',
      })),
    });
  }

  for (const task of reminders) {
    const { error: updateError } = await serviceDb
      .from('procurement_tasks')
      .update({
        last_reminded_at: new Date().toISOString(),
        reminder_count: (task.reminder_count || 0) + 1,
      })
      .eq('id', task.id);

    if (updateError) throw updateError;
  }

  return {
    alertsCreated: alerts.length,
    escalationAlertsCreated: escalationAlerts.length,
    remindersProcessed: reminders.length,
  };
}

export async function logProcurementWorkflowRun(
  serviceDb: ServiceDb,
  params: {
    userId: string;
    workflowType: 'discover' | 'enrich' | 'pack' | 'compliance';
    workflowStatus: 'completed' | 'failed' | 'blocked';
    shortlistId?: string | null;
    inputPayload?: Record<string, unknown>;
    outputSummary?: Record<string, unknown>;
    recordsScanned?: number;
    recordsChanged?: number;
    errorCount?: number;
    startedAt?: string;
  },
) {
  const context = await getProcurementContext(serviceDb, params.userId, { shortlistId: params.shortlistId });

  const { data, error } = await serviceDb
    .from('procurement_workflow_runs')
    .insert({
      org_profile_id: context.orgProfileId,
      shortlist_id: context.shortlist?.id ?? null,
      user_id: params.userId,
      workflow_type: params.workflowType,
      workflow_status: params.workflowStatus,
      input_payload: params.inputPayload || {},
      output_summary: params.outputSummary || {},
      records_scanned: params.recordsScanned ?? 0,
      records_changed: params.recordsChanged ?? 0,
      error_count: params.errorCount ?? 0,
      started_at: params.startedAt || new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select('id, org_profile_id, shortlist_id')
    .single();

  if (error) {
    console.error('[procurement-workflow-run]', error.message);
    return null;
  }

  return data;
}
