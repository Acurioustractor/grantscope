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

export type ProcurementContextOptions = {
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
