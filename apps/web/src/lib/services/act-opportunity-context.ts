import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

export type ActOpportunityContextSourceStatus = 'ok' | 'partial' | 'stale' | 'blocked' | 'empty' | 'error';
export type ActOpportunityContextStepPriority = 'high' | 'medium' | 'low';

export interface ActOpportunityContextSource {
  key: 'grants' | 'ghl' | 'gmail' | 'knowledge' | 'funder_context' | 'decisions' | 'agents';
  label: string;
  status: ActOpportunityContextSourceStatus;
  count: number;
  latestAt: string | null;
  detail: string;
  action: string;
}

export interface ActOpportunityContextStep {
  priority: ActOpportunityContextStepPriority;
  label: string;
  detail: string;
  sourceKey: ActOpportunityContextSource['key'];
}

export interface ActOpportunityContextEvent {
  id: string;
  decisionId?: string | null;
  sourceSystem: string;
  sourceType: string;
  sourceRef: string;
  sourceUrl: string | null;
  title: string;
  summary: string;
  actorName: string | null;
  actorEmail: string | null;
  organisation: string | null;
  lane: string;
  signalKind: string;
  confidence: number;
  happenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  discoveryState: 'new' | 'changed' | null;
  metadata: Record<string, unknown>;
}

export interface ActOpportunityDiscoveryReceipt {
  batchWindowMinutes: number;
  latestAt: string | null;
  newSignals: number;
  changedSignals: number;
  opportunitySignals: number;
  relationshipSignals: number;
  refreshedPrograms: number;
}

export interface ActOpportunityContextStatus {
  generatedAt: string;
  overallStatus: ActOpportunityContextSourceStatus;
  summary: string;
  metrics: {
    openGrants: number;
    grantsDue30d: number;
    grantsUpdated7d: number;
    relationshipRows: number;
    recentRelationshipTouches: number;
    funderSnapshots: number;
    opportunityDecisions: number;
    sourceIssues: number;
  };
  sources: ActOpportunityContextSource[];
  nextSteps: ActOpportunityContextStep[];
  discoveryReceipt: ActOpportunityDiscoveryReceipt;
  recentEvents: ActOpportunityContextEvent[];
}

interface GrantStatsRow {
  total: number;
  open_count: number;
  due_30d: number;
  updated_24h: number;
  latest_batch_updates: number;
  updated_7d: number;
  latest_updated_at: string | null;
  latest_verified_at: string | null;
}

interface GhlStatsRow {
  contacts: number;
  opportunities: number;
  recent_touches: number;
  latest_contact_sync: string | null;
  latest_opportunity_sync: string | null;
}

interface GmailStatusRow {
  user_email: string | null;
  sync_status: string | null;
  last_sync: string | null;
  next_sync: string | null;
  total_messages: number | null;
  synced_messages: number | null;
  error_count: number | null;
  error_message: string | null;
}

interface GmailContextStatsRow {
  total: number;
  new_24h: number;
  changed_24h: number;
  recent_14d: number;
  relationship_events: number;
  opportunity_signals_24h: number;
  relationship_signals_24h: number;
  latest_batch_new: number;
  latest_batch_changed: number;
  latest_batch_opportunities: number;
  latest_batch_relationships: number;
  latest_happened_at: string | null;
  latest_created_at: string | null;
  latest_updated_at: string | null;
}

interface KnowledgeSyncRow {
  source_type: string;
  enabled: boolean | null;
  status: string | null;
  last_sync_at: string | null;
  next_sync_due: string | null;
  items_scanned_last_sync: number | null;
  items_extracted_last_sync: number | null;
  total_items_scanned: number | null;
  total_items_extracted: number | null;
  consecutive_errors: number | null;
  last_error: string | null;
}

interface FunderContextStatsRow {
  total: number;
  recent: number;
  with_contacts: number;
  with_email: number;
  latest_refreshed_at: string | null;
}

interface DecisionStatsRow {
  total: number;
  recent: number;
  latest_decision_at: string | null;
}

interface AgentRunRow {
  agent_id: string;
  agent_name: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  items_found: number | null;
  items_new: number | null;
  items_updated: number | null;
}

interface ContextEventRow {
  id: string;
  decision_id: string | null;
  source_system: string;
  source_type: string;
  source_ref: string;
  source_url: string | null;
  title: string;
  summary: string;
  actor_name: string | null;
  actor_email: string | null;
  organisation: string | null;
  lane: string;
  signal_kind: string;
  confidence: number | string | null;
  happened_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function daysSince(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function ageLabel(value: string | null): string {
  const days = daysSince(value);
  if (days === null) return 'never synced';
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 31) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function freshnessStatus(
  value: string | null,
  freshDays: number,
  staleDays: number,
): ActOpportunityContextSourceStatus {
  const days = daysSince(value);
  if (days === null) return 'empty';
  if (days <= freshDays) return 'ok';
  if (days <= staleDays) return 'partial';
  return 'stale';
}

function worstStatus(sources: ActOpportunityContextSource[]): ActOpportunityContextSourceStatus {
  if (sources.some((source) => source.status === 'error')) return 'error';
  if (sources.some((source) => source.status === 'blocked')) return 'blocked';
  if (sources.some((source) => source.status === 'stale')) return 'stale';
  if (sources.some((source) => source.status === 'partial')) return 'partial';
  if (sources.every((source) => source.status === 'empty')) return 'empty';
  return 'ok';
}

function asGrantStats(row: Record<string, unknown> | undefined): GrantStatsRow {
  return {
    total: num(row?.total),
    open_count: num(row?.open_count),
    due_30d: num(row?.due_30d),
    updated_24h: num(row?.updated_24h),
    latest_batch_updates: num(row?.latest_batch_updates),
    updated_7d: num(row?.updated_7d),
    latest_updated_at: iso(row?.latest_updated_at),
    latest_verified_at: iso(row?.latest_verified_at),
  };
}

function asGhlStats(row: Record<string, unknown> | undefined): GhlStatsRow {
  return {
    contacts: num(row?.contacts),
    opportunities: num(row?.opportunities),
    recent_touches: num(row?.recent_touches),
    latest_contact_sync: iso(row?.latest_contact_sync),
    latest_opportunity_sync: iso(row?.latest_opportunity_sync),
  };
}

function asGmailContextStats(row: Record<string, unknown> | undefined): GmailContextStatsRow {
  return {
    total: num(row?.total),
    new_24h: num(row?.new_24h),
    changed_24h: num(row?.changed_24h),
    recent_14d: num(row?.recent_14d),
    relationship_events: num(row?.relationship_events),
    opportunity_signals_24h: num(row?.opportunity_signals_24h),
    relationship_signals_24h: num(row?.relationship_signals_24h),
    latest_batch_new: num(row?.latest_batch_new),
    latest_batch_changed: num(row?.latest_batch_changed),
    latest_batch_opportunities: num(row?.latest_batch_opportunities),
    latest_batch_relationships: num(row?.latest_batch_relationships),
    latest_happened_at: iso(row?.latest_happened_at),
    latest_created_at: iso(row?.latest_created_at),
    latest_updated_at: iso(row?.latest_updated_at),
  };
}

function discoveryState(createdAt: string, updatedAt: string): ActOpportunityContextEvent['discoveryState'] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (Number.isFinite(created) && created >= cutoff) return 'new';
  if (Number.isFinite(updated) && updated >= cutoff && updated > created + 1_000) return 'changed';
  return null;
}

function asFunderStats(row: Record<string, unknown> | undefined): FunderContextStatsRow {
  return {
    total: num(row?.total),
    recent: num(row?.recent),
    with_contacts: num(row?.with_contacts),
    with_email: num(row?.with_email),
    latest_refreshed_at: iso(row?.latest_refreshed_at),
  };
}

function asDecisionStats(row: Record<string, unknown> | undefined): DecisionStatsRow {
  return {
    total: num(row?.total),
    recent: num(row?.recent),
    latest_decision_at: iso(row?.latest_decision_at),
  };
}

function asContextEvents(rows: ContextEventRow[] | null | undefined): ActOpportunityContextEvent[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    decisionId: row.decision_id,
    sourceSystem: row.source_system,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    sourceUrl: row.source_url,
    title: row.title,
    summary: row.summary,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    organisation: row.organisation,
    lane: row.lane,
    signalKind: row.signal_kind,
    confidence: num(row.confidence),
    happenedAt: row.happened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    discoveryState: discoveryState(row.created_at, row.updated_at),
    metadata: row.metadata ?? {},
  }));
}

function latestDate(values: Array<string | null>): string | null {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

function knowledgeSummary(rows: KnowledgeSyncRow[]) {
  const enabledRows = rows.filter((row) => row.enabled);
  const latestAt = latestDate(rows.map((row) => row.last_sync_at));
  const errorRows = rows.filter((row) => num(row.consecutive_errors) > 0 || Boolean(row.last_error));
  const disabledContextRows = rows.filter((row) => ['gmail', 'ghl'].includes(row.source_type) && !row.enabled);
  const totalExtracted = rows.reduce((sum, row) => sum + num(row.total_items_extracted), 0);

  let status: ActOpportunityContextSourceStatus = freshnessStatus(latestAt, 1, 7);
  if (errorRows.length > 0) status = 'error';
  if (rows.length === 0) status = 'empty';
  if (enabledRows.length === 0 && rows.length > 0) status = 'blocked';
  if (status === 'empty' && disabledContextRows.length > 0) status = 'blocked';

  return {
    status,
    latestAt,
    totalExtracted,
    enabledCount: enabledRows.length,
    disabledContextCount: disabledContextRows.length,
    errorCount: errorRows.length,
  };
}

function agentSummary(rows: AgentRunRow[]) {
  const latestAt = latestDate(rows.map((row) => row.started_at));
  const failures = rows.filter((row) => ['failed', 'timed_out', 'error'].includes(String(row.status ?? '').toLowerCase()));
  const found = rows.reduce((sum, row) => sum + num(row.items_found), 0);
  const createdOrUpdated = rows.reduce((sum, row) => sum + num(row.items_new) + num(row.items_updated), 0);
  const status: ActOpportunityContextSourceStatus = failures.length > 0
    ? 'partial'
    : freshnessStatus(latestAt, 1, 7);

  return {
    status,
    latestAt,
    failures,
    found,
    createdOrUpdated,
  };
}

export const getActOpportunityContextStatus = cache(async (
  orgProfileId: string,
): Promise<ActOpportunityContextStatus> => {
  const supabase = getServiceSupabase();
  const safeOrgProfileId = orgProfileId.replace(/'/g, "''");

  const [
    grantRows,
    ghlRows,
    gmailRows,
    gmailContextRows,
    knowledgeRows,
    funderRows,
    decisionRows,
    agentRows,
    contextEventRows,
  ] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `WITH latest_grant AS (
          SELECT MAX(updated_at) AS latest_at FROM grant_opportunities
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE COALESCE(closes_at, deadline) >= CURRENT_DATE)::int AS open_count,
          COUNT(*) FILTER (WHERE COALESCE(closes_at, deadline) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS due_30d,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '24 hours')::int AS updated_24h,
          COUNT(*) FILTER (WHERE updated_at >= (SELECT latest_at FROM latest_grant) - INTERVAL '5 minutes')::int AS latest_batch_updates,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::int AS updated_7d,
          MAX(updated_at)::text AS latest_updated_at,
          MAX(last_verified_at)::text AS latest_verified_at
        FROM grant_opportunities`,
    }), 'act opportunity context grant stats') as Promise<Array<Record<string, unknown>> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
          (SELECT COUNT(*) FROM ghl_contacts)::int AS contacts,
          (SELECT COUNT(*) FROM ghl_opportunities)::int AS opportunities,
          (SELECT COUNT(*) FROM ghl_contacts WHERE last_contact_date >= NOW() - INTERVAL '90 days')::int AS recent_touches,
          (SELECT MAX(COALESCE(last_synced_at, ghl_updated_at, updated_at))::text FROM ghl_contacts) AS latest_contact_sync,
          (SELECT MAX(COALESCE(last_synced_at, ghl_updated_at, updated_at))::text FROM ghl_opportunities) AS latest_opportunity_sync`,
    }), 'act opportunity context ghl stats') as Promise<Array<Record<string, unknown>> | null>,
    safe(supabase
      .from('gmail_sync_status')
      .select('user_email, sync_status, last_sync, next_sync, total_messages, synced_messages, error_count, error_message')
      .order('updated_at', { ascending: false })
      .limit(1), 'act opportunity context gmail status') as Promise<GmailStatusRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `WITH latest_activity AS (
          SELECT MAX(GREATEST(created_at, updated_at)) AS latest_at
          FROM opportunity_context_events
          WHERE org_profile_id = '${safeOrgProfileId}'
            AND source_system = 'gmail'
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS new_24h,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '24 hours' AND updated_at > created_at + INTERVAL '1 second')::int AS changed_24h,
          COUNT(*) FILTER (WHERE happened_at >= NOW() - INTERVAL '14 days')::int AS recent_14d,
          COUNT(*) FILTER (WHERE lane IN ('relationship', 'foundation', 'procurement', 'arts'))::int AS relationship_events,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND signal_kind IN ('open_opportunity', 'procurement_opportunity', 'capital_opportunity', 'forecast_opportunity'))::int AS opportunity_signals_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND signal_kind IN ('relationship', 'warm_intro', 'invitation', 'event', 'funding_lead', 'reporting'))::int AS relationship_signals_24h,
          COUNT(*) FILTER (WHERE created_at >= (SELECT latest_at FROM latest_activity) - INTERVAL '5 minutes')::int AS latest_batch_new,
          COUNT(*) FILTER (WHERE updated_at >= (SELECT latest_at FROM latest_activity) - INTERVAL '5 minutes' AND created_at < (SELECT latest_at FROM latest_activity) - INTERVAL '5 minutes')::int AS latest_batch_changed,
          COUNT(*) FILTER (WHERE GREATEST(created_at, updated_at) >= (SELECT latest_at FROM latest_activity) - INTERVAL '5 minutes' AND signal_kind IN ('open_opportunity', 'procurement_opportunity', 'capital_opportunity', 'forecast_opportunity'))::int AS latest_batch_opportunities,
          COUNT(*) FILTER (WHERE GREATEST(created_at, updated_at) >= (SELECT latest_at FROM latest_activity) - INTERVAL '5 minutes' AND signal_kind IN ('relationship', 'warm_intro', 'invitation', 'event', 'funding_lead', 'reporting'))::int AS latest_batch_relationships,
          MAX(happened_at)::text AS latest_happened_at,
          MAX(created_at)::text AS latest_created_at,
          MAX(updated_at)::text AS latest_updated_at
        FROM opportunity_context_events
        WHERE org_profile_id = '${safeOrgProfileId}'
          AND source_system = 'gmail'`,
    }), 'act opportunity context gmail event stats') as Promise<Array<Record<string, unknown>> | null>,
    safe(supabase
      .from('knowledge_source_sync')
      .select('source_type, enabled, status, last_sync_at, next_sync_due, items_scanned_last_sync, items_extracted_last_sync, total_items_scanned, total_items_extracted, consecutive_errors, last_error')
      .order('source_type'), 'act opportunity context knowledge sync') as Promise<KnowledgeSyncRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE refreshed_at >= NOW() - INTERVAL '7 days')::int AS recent,
          COUNT(*) FILTER (WHERE contacts_count > 0)::int AS with_contacts,
          COUNT(*) FILTER (WHERE COALESCE(email_count, 0) > 0)::int AS with_email,
          MAX(refreshed_at)::text AS latest_refreshed_at
        FROM funder_context_snapshot`,
    }), 'act opportunity context funder stats') as Promise<Array<Record<string, unknown>> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days')::int AS recent,
          MAX(created_at)::text AS latest_decision_at
        FROM opportunity_decisions
        WHERE org_profile_id = '${safeOrgProfileId}'`,
    }), 'act opportunity context decision stats') as Promise<Array<Record<string, unknown>> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT agent_id, agent_name, status, started_at::text, completed_at::text, items_found, items_new, items_updated
        FROM agent_runs
        WHERE agent_id ILIKE '%grant%'
          OR agent_id ILIKE '%ghl%'
          OR agent_id ILIKE '%funder%'
          OR agent_id ILIKE '%opportun%'
          OR agent_id ILIKE '%gmail%'
        ORDER BY started_at DESC
        LIMIT 12`,
    }), 'act opportunity context agent runs') as Promise<AgentRunRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
          id::text,
          decision_id::text,
          source_system,
          source_type,
          source_ref,
          source_url,
          title,
          summary,
          actor_name,
          actor_email,
          organisation,
          lane,
          signal_kind,
          confidence,
          happened_at::text,
          created_at::text,
          updated_at::text,
          metadata
        FROM opportunity_context_events
        WHERE org_profile_id = '${safeOrgProfileId}'
        ORDER BY COALESCE(happened_at, created_at) DESC
        LIMIT 500`,
    }), 'act opportunity context recent events') as Promise<ContextEventRow[] | null>,
  ]);

  const grantStats = asGrantStats(grantRows?.[0]);
  const ghlStats = asGhlStats(ghlRows?.[0]);
  const gmailStatus = gmailRows?.[0] ?? null;
  const gmailContextStats = asGmailContextStats(gmailContextRows?.[0]);
  const knowledge = knowledgeSummary(knowledgeRows ?? []);
  const funderStats = asFunderStats(funderRows?.[0]);
  const decisionStats = asDecisionStats(decisionRows?.[0]);
  const agents = agentSummary(agentRows ?? []);
  const recentEvents = asContextEvents(contextEventRows);

  const latestGrantAt = grantStats.latest_verified_at ?? grantStats.latest_updated_at;
  const latestGhlAt = latestDate([ghlStats.latest_contact_sync, ghlStats.latest_opportunity_sync]);
  const gmailErrors = num(gmailStatus?.error_count);
  const gmailLatestAt = gmailStatus?.last_sync ?? null;
  const gmailContextLatestAt = latestDate([
    gmailContextStats.latest_created_at,
    gmailContextStats.latest_updated_at,
    gmailContextStats.latest_happened_at,
  ]);
  const gmailStatusText = gmailStatus
    ? `Mail mirror has ${gmailStatus.synced_messages ?? 0}/${gmailStatus.total_messages ?? 0} messages; last mirror sync ${ageLabel(gmailLatestAt)}.`
    : 'No mailbox mirror status row is available.';

  const sources: ActOpportunityContextSource[] = [
    {
      key: 'grants',
      label: 'Grant and opportunity feeds',
      status: grantStats.open_count > 0 ? freshnessStatus(latestGrantAt, 1, 7) : 'empty',
      count: grantStats.open_count,
      latestAt: latestGrantAt,
      detail: `${grantStats.open_count.toLocaleString()} open opportunities, ${grantStats.due_30d.toLocaleString()} closing in 30 days, ${grantStats.updated_7d.toLocaleString()} updated in 7 days. Last evidence ${ageLabel(latestGrantAt)}.`,
      action: 'Keep grant scrapers and deadline checks running before ranking new work.',
    },
    {
      key: 'ghl',
      label: 'GoHighLevel mirror',
      status: ghlStats.contacts + ghlStats.opportunities > 0 ? freshnessStatus(latestGhlAt, 2, 14) : 'empty',
      count: ghlStats.contacts + ghlStats.opportunities,
      latestAt: latestGhlAt,
      detail: `${ghlStats.contacts.toLocaleString()} contacts, ${ghlStats.opportunities.toLocaleString()} opportunities, ${ghlStats.recent_touches.toLocaleString()} touches in 90 days. Last mirror update ${ageLabel(latestGhlAt)}.`,
      action: 'Refresh contact and opportunity mirrors before recommending relationship moves.',
    },
    {
      key: 'gmail',
      label: 'Gmail context',
      status: gmailErrors > 0 && gmailContextStats.total === 0
        ? 'error'
        : gmailContextStats.total > 0
          ? freshnessStatus(gmailContextLatestAt, 1, 7)
          : gmailStatus
            ? freshnessStatus(gmailLatestAt, 1, 7)
            : 'empty',
      count: gmailContextStats.total > 0
        ? gmailContextStats.total
        : num(gmailStatus?.synced_messages ?? gmailStatus?.total_messages),
      latestAt: gmailContextLatestAt ?? gmailLatestAt,
      detail: gmailContextStats.total > 0
        ? `${gmailContextStats.total.toLocaleString()} summarized context event(s), ${gmailContextStats.recent_14d.toLocaleString()} from the last 14 days, ${gmailContextStats.new_24h.toLocaleString()} added in 24 hours. Last sweep ${ageLabel(gmailContextLatestAt)}. ${gmailStatusText}`
        : gmailStatus
          ? `${gmailStatus.synced_messages ?? 0}/${gmailStatus.total_messages ?? 0} messages synced for ${gmailStatus.user_email ?? 'mailbox'}. Last sync ${ageLabel(gmailLatestAt)}.`
          : 'empty',
      action: gmailContextStats.total > 0
        ? 'Keep the read-only relationship sweep running and turn high-confidence signals into tasks, dossiers, and outreach decisions.'
        : 'Run a read-only funding, procurement, partner, festival, and invitation thread sweep.',
    },
    {
      key: 'knowledge',
      label: 'Knowledge source sync',
      status: knowledge.status,
      count: knowledge.totalExtracted,
      latestAt: knowledge.latestAt,
      detail: `${knowledge.enabledCount} enabled source(s), ${knowledge.totalExtracted.toLocaleString()} extracted items. ${knowledge.disabledContextCount} Gmail/GHL context source(s) disabled.`,
      action: 'Enable and schedule the context sources that should feed the queue.',
    },
    {
      key: 'funder_context',
      label: 'Funder context snapshots',
      status: funderStats.total > 0 ? freshnessStatus(funderStats.latest_refreshed_at, 1, 14) : 'empty',
      count: funderStats.total,
      latestAt: funderStats.latest_refreshed_at,
      detail: `${funderStats.total.toLocaleString()} funder snapshots, ${funderStats.with_contacts.toLocaleString()} with contacts, ${funderStats.with_email.toLocaleString()} with email context. Last refresh ${ageLabel(funderStats.latest_refreshed_at)}.`,
      action: 'Refresh funder dossiers after new grant, CRM, email, Xero, or Notion data lands.',
    },
    {
      key: 'decisions',
      label: 'Decision memory',
      status: decisionStats.total > 0 ? freshnessStatus(decisionStats.latest_decision_at, 14, 45) : 'empty',
      count: decisionStats.total,
      latestAt: decisionStats.latest_decision_at,
      detail: `${decisionStats.total.toLocaleString()} ACT decisions, ${decisionStats.recent.toLocaleString()} in the last 14 days. Last decision ${ageLabel(decisionStats.latest_decision_at)}.`,
      action: 'Use Apply, Partner, Proof gap, Park, and Bad match decisions to train ranking.',
    },
    {
      key: 'agents',
      label: 'Discovery agent runs',
      status: agents.status,
      count: agents.found,
      latestAt: agents.latestAt,
      detail: `${agents.createdOrUpdated.toLocaleString()} rows created or updated in the latest relevant runs. ${agents.failures.length} recent failure(s).`,
      action: 'Fix failing grant, GHL, and funder jobs before trusting completeness.',
    },
  ];

  const nextSteps: ActOpportunityContextStep[] = [];
  const sourceByKey = new Map(sources.map((source) => [source.key, source]));

  function addStep(
    sourceKey: ActOpportunityContextSource['key'],
    priority: ActOpportunityContextStepPriority,
    label: string,
    detail: string,
  ) {
    nextSteps.push({ sourceKey, priority, label, detail });
  }

  if (sourceByKey.get('gmail')?.status !== 'ok') {
    addStep(
      'gmail',
      'high',
      'Run recent relationship mail sweep',
      'Search the last 90 days for grant, funding, tender, foundation, sponsorship, festival, invitation, and buyer language, then store summaries and evidence refs.',
    );
  }

  if (sourceByKey.get('ghl')?.status !== 'ok') {
    addStep(
      'ghl',
      'high',
      'Refresh CRM relationship mirror',
      'Sync contacts, opportunities, stages, tags, last touch, and next task context before recommending outreach.',
    );
  }

  if (sourceByKey.get('funder_context')?.status !== 'ok') {
    addStep(
      'funder_context',
      'medium',
      'Rebuild funder dossiers',
      'Recompute foundation profile, contacts, grantee history, Xero flow, Notion match, email count, and relationship score.',
    );
  }

  if (sourceByKey.get('decisions')?.status === 'empty') {
    addStep(
      'decisions',
      'medium',
      'Seed decision memory',
      'Record the first batch of Apply, Partner, Proof gap, Park, and Bad match decisions so future ranking learns ACT preferences.',
    );
  }

  if (agents.failures.length > 0) {
    const failedNames = agents.failures
      .slice(0, 3)
      .map((run) => run.agent_name || run.agent_id)
      .join(', ');
    addStep(
      'agents',
      'medium',
      'Fix failing discovery jobs',
      `${failedNames} failed or timed out in recent relevant runs.`,
    );
  }

  if (nextSteps.length === 0) {
    addStep(
      'grants',
      'low',
      'Review top queue and write outcomes',
      'The source stack is current enough for human review; the next learning gain comes from recorded decisions and outcomes.',
    );
  }

  const issueStatuses = new Set<ActOpportunityContextSourceStatus>(['partial', 'stale', 'blocked', 'empty', 'error']);
  const sourceIssues = sources.filter((source) => issueStatuses.has(source.status)).length;
  const overallStatus = worstStatus(sources);

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    summary: `${sources.length - sourceIssues}/${sources.length} sources current. ${grantStats.open_count.toLocaleString()} open opportunities, ${grantStats.due_30d.toLocaleString()} closing in 30 days, ${decisionStats.total.toLocaleString()} ACT decisions in memory.`,
    metrics: {
      openGrants: grantStats.open_count,
      grantsDue30d: grantStats.due_30d,
      grantsUpdated7d: grantStats.updated_7d,
      relationshipRows: ghlStats.contacts + funderStats.with_contacts + gmailContextStats.relationship_events,
      recentRelationshipTouches: ghlStats.recent_touches,
      funderSnapshots: funderStats.total,
      opportunityDecisions: decisionStats.total,
      sourceIssues,
    },
    sources,
    nextSteps,
    discoveryReceipt: {
      batchWindowMinutes: 5,
      latestAt: latestDate([gmailContextLatestAt, grantStats.latest_updated_at]),
      newSignals: gmailContextStats.latest_batch_new,
      changedSignals: gmailContextStats.latest_batch_changed,
      opportunitySignals: gmailContextStats.latest_batch_opportunities,
      relationshipSignals: gmailContextStats.latest_batch_relationships,
      refreshedPrograms: grantStats.latest_batch_updates,
    },
    recentEvents,
  };
});
