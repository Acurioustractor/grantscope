export type TabKey = 'discover' | 'enrich' | 'pack';
export type WorkflowStage = 'brief' | 'review' | 'signoff' | 'export';
export type WorkspaceMode = 'work' | 'signoff' | 'admin';

export interface SupplierResult {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean;
  lga_name: string | null;
  latest_revenue: number | null;
  contracts: { count: number; total_value: number };
}

export interface DiscoverResult {
  suppliers: SupplierResult[];
  summary: {
    total_found: number;
    indigenous_businesses: number;
    social_enterprises: number;
    community_controlled: number;
    with_federal_contracts: number;
  };
}

export interface ReviewChecklist {
  fit: boolean;
  risk_checked: boolean;
  evidence_checked: boolean;
  decision_made: boolean;
}

export interface ProcurementPermissions {
  can_edit_shortlist: boolean;
  can_manage_tasks: boolean;
  can_submit_signoff: boolean;
  can_approve: boolean;
  can_manage_team: boolean;
  can_reopen_approval: boolean;
  can_send_notifications: boolean;
}

export interface PackExportSummary {
  id: string;
  shortlist_id: string;
  title: string;
  version_number: number;
  export_summary: Record<string, unknown>;
  source_shortlist_updated_at: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PackResult = {
  pack: { generated_at: string; filters?: { state?: string; lga?: string }; sections: any };
  export?: { id: string; title: string; created_at: string } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EnrichResult = { enriched: any[]; summary: any };

export interface WorkspaceOrgProfile {
  id: string;
  name: string;
  abn: string | null;
  subscription_plan: string | null;
}

export interface ShortlistRecord {
  id: string;
  supplier_key: string;
  gs_id: string | null;
  supplier_abn: string | null;
  supplier_name: string;
  entity_type: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  lga_name: string | null;
  seifa_irsd_decile: number | null;
  latest_revenue: number | null;
  is_community_controlled: boolean;
  contract_count: number;
  contract_total_value: number;
  note: string | null;
  decision_tag: string | null;
  review_checklist: ReviewChecklist;
  evidence_snapshot: Record<string, unknown>;
  last_reviewed_at: string | null;
  updated_at: string;
  provenance?: {
    source_datasets: string[];
    source_count: number;
    confidence: string | null;
    financial_year: string | null;
    last_seen: string | null;
    entity_updated_at: string | null;
    match_reason: string;
  };
}

export interface ShortlistSummary {
  id: string;
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
  item_count: number;
  decision_counts: Record<string, number>;
  updated_at: string;
}

export interface WorkspaceEvent {
  id: string;
  shortlist_id: string | null;
  shortlist_item_id: string | null;
  event_type:
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
  event_summary: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_type: 'discover' | 'enrich' | 'pack' | 'compliance';
  workflow_status: 'completed' | 'failed' | 'blocked';
  output_summary: Record<string, unknown>;
  records_scanned: number;
  records_changed: number;
  error_count: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface ShortlistWatch {
  id: string;
  shortlist_id: string;
  enabled: boolean;
  interval_hours: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_summary: Record<string, unknown>;
  last_alert_count: number;
}

export interface ProcurementAlert {
  id: string;
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

export interface ProcurementNotification {
  id: string;
  shortlist_id: string | null;
  pack_export_id: string | null;
  task_id: string | null;
  alert_id: string | null;
  recipient_user_id: string | null;
  recipient_label: string | null;
  notification_type: 'task_due' | 'task_escalated' | 'signoff_submitted' | 'signoff_approved' | 'signoff_changes_requested';
  delivery_mode: 'immediate' | 'daily_digest';
  status: 'queued' | 'sent' | 'cancelled';
  subject: string;
  body: string | null;
  payload: Record<string, unknown>;
  queued_at: string;
  sent_at: string | null;
  attempt_count: number;
  last_attempted_at: string | null;
  last_error: string | null;
  external_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingTeamInvite {
  id: string;
  invited_email: string | null;
  role: string;
  invited_at: string | null;
  procurement_role: 'lead' | 'reviewer' | 'approver' | 'observer';
  notification_mode: 'immediate' | 'daily_digest' | 'none';
  permission_overrides: Partial<Record<keyof ProcurementPermissions, boolean>>;
}

export interface ProcurementTask {
  id: string;
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

export interface InboxTask extends ProcurementTask {
  shortlist_name: string;
}

export interface ApprovalInboxItem {
  id: string;
  name: string;
  owner_name: string | null;
  decision_due_at: string | null;
  approval_status: 'submitted';
  last_pack_export_id: string | null;
  updated_at: string;
}

export interface TeamMember {
  user_id: string;
  role: string;
  procurement_role: 'lead' | 'reviewer' | 'approver' | 'observer';
  notification_mode: 'immediate' | 'daily_digest' | 'none';
  permission_overrides: Partial<Record<keyof ProcurementPermissions, boolean>>;
  permissions: ProcurementPermissions;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  is_owner: boolean;
}

export interface NotificationChannel {
  id: string;
  channel_name: string;
  channel_type: 'webhook';
  endpoint_url: string;
  signing_secret: string | null;
  enabled: boolean;
  event_types: ProcurementNotification['notification_type'][];
  verification_token: string;
  verification_status: 'untested' | 'passed' | 'failed';
  last_tested_at: string | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryLogEntry {
  id: string;
  source: string;
  webhook_id: string;
  channel_name: string;
  event_type: string;
  status: 'processed' | 'failed';
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  received_at: string | null;
}

export interface ChannelHealth {
  id: string;
  channel_name: string;
  enabled: boolean;
  verification_status: 'untested' | 'passed' | 'failed';
  verification_token: string;
  last_tested_at: string | null;
  last_receipt_at: string | null;
  success_count: number;
  failure_count: number;
  last_processed_at: string | null;
  last_failed_at: string | null;
  last_error_message: string | null;
}

export interface OutboundMetrics {
  queued: number;
  needsAttention: number;
  sentRecently: number;
  webhookFailures: number;
}

export interface InspectorReceipt {
  id: string;
  channel_id: string;
  channel_name: string;
  source: string;
  event_type: string | null;
  signature_valid: boolean | null;
  received_at: string | null;
  created_at: string;
}

export interface ProcurementComment {
  id: string;
  shortlist_id: string;
  shortlist_item_id: string | null;
  pack_export_id: string | null;
  author_user_id: string | null;
  author_label: string | null;
  comment_type: 'discussion' | 'submission' | 'approval' | 'changes_requested' | 'supplier_review';
  body: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceResponse {
  canUseWorkspace: boolean;
  needsProfile: boolean;
  currentUserId: string;
  orgProfile: WorkspaceOrgProfile | null;
  currentUserRole: string | null;
  currentUserPermissions: ProcurementPermissions;
  shortlists: ShortlistSummary[];
  shortlist: ShortlistSummary | null;
  shortlistItems: ShortlistRecord[];
  workflowRuns: WorkflowRun[];
  recentEvents: WorkspaceEvent[];
  watch: ShortlistWatch | null;
  alerts: ProcurementAlert[];
  tasks: ProcurementTask[];
  myTasks: InboxTask[];
  myApprovals: ApprovalInboxItem[];
  myNotifications: ProcurementNotification[];
  packExports: PackExportSummary[];
  notifications: ProcurementNotification[];
  notificationChannels: NotificationChannel[];
  deliveryLogs: DeliveryLogEntry[];
  inspectorReceipts: InspectorReceipt[];
  channelHealth: ChannelHealth[];
  outboundMetrics: OutboundMetrics;
  pendingInvites: PendingTeamInvite[];
  comments: ProcurementComment[];
  teamMembers: TeamMember[];
}
