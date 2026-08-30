import {
  searchOpportunitiesPage,
  type GhlOpportunity,
  type GhlOpportunityContact,
  type GhlOpportunityCustomField,
} from '@/lib/ghl';
import {
  fundingDecisionForGhlStage,
  getFundingGhlContractStatus,
  type FundingGhlContractStatus,
} from '@/lib/services/funding-ghl-contract';
import { getServiceSupabase } from '@/lib/supabase';

const SYNC_KEY = 'funding-grants-pipeline';
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;
const DB_BATCH_SIZE = 100;

export type FundingGhlSyncTrigger = 'cron' | 'manual' | 'test';

type MirrorRow = {
  ghl_id: string;
  ghl_contact_id: string | null;
  ghl_pipeline_id: string;
  ghl_stage_id: string | null;
  name: string;
  pipeline_name: string;
  stage_name: string | null;
  status: string;
  monetary_value: number;
  custom_fields: GhlOpportunityCustomField[];
  assigned_to: string | null;
  ghl_created_at: string | null;
  ghl_updated_at: string | null;
  last_synced_at: string;
  updated_at: string;
  project_code: string | null;
  last_stage_change_at: string | null;
  last_status_change_at: string | null;
  sync_status: 'synced';
};

type LocalMirrorRow = Pick<
  MirrorRow,
  | 'ghl_id'
  | 'ghl_contact_id'
  | 'ghl_pipeline_id'
  | 'ghl_stage_id'
  | 'name'
  | 'status'
  | 'monetary_value'
  | 'assigned_to'
  | 'ghl_updated_at'
  | 'project_code'
> & { sync_status: string | null };

type GovernedHandoff = {
  id: string;
  project_code: string;
  opportunity_id: string;
  ghl_opportunity_id: string | null;
};

export type FundingGhlSyncResult = {
  runId: string;
  status: 'succeeded' | 'skipped';
  pipelineId: string;
  pagesFetched: number;
  opportunitiesFetched: number;
  opportunitiesChanged: number;
  opportunitiesUpserted: number;
  contactsCreated: number;
  handoffsUpdated: number;
  decisionsUpdated: number;
  missingGovernedHandoffs: number;
  cursorAfter: string | null;
  durationMs: number;
};

function chunks<T>(values: T[], size = DB_BATCH_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function scalarString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const values = value.map(scalarString).filter((item): item is string => Boolean(item));
    return values.length ? values.join(', ') : null;
  }
  return null;
}

export function ghlCustomFieldValue(
  fields: GhlOpportunityCustomField[] | undefined,
  fieldId: string | undefined
): string | null {
  if (!fieldId) return null;
  const field = fields?.find(candidate => candidate.id === fieldId);
  return scalarString(
    field?.fieldValueString ??
    field?.fieldValueNumber ??
    field?.fieldValueDate ??
    field?.fieldValue ??
    field?.field_value ??
    field?.value
  );
}

function contactDisplayName(contact: GhlOpportunityContact | undefined): string | null {
  if (!contact) return null;
  const joined = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  return joined || contact.name?.trim() || contact.contactName?.trim() || null;
}

export function normalizeFundingGhlOpportunity(input: {
  opportunity: GhlOpportunity;
  contract: Pick<FundingGhlContractStatus, 'pipelineId' | 'pipelineName' | 'stageIds' | 'fieldIds'>;
  syncedAt: string;
}): MirrorRow | null {
  const { opportunity, contract, syncedAt } = input;
  const ghlId = String(opportunity.id || opportunity._id || '').trim();
  if (!ghlId || !contract.pipelineId) return null;
  const stageNamesById = new Map(Object.entries(contract.stageIds).map(([name, id]) => [id, name]));
  const projectCode = ghlCustomFieldValue(opportunity.customFields, contract.fieldIds.projectCode);
  const monetaryValue = Number(opportunity.monetaryValue || 0);
  return {
    ghl_id: ghlId,
    ghl_contact_id: String(opportunity.contactId || opportunity.contact?.id || '').trim() || null,
    ghl_pipeline_id: opportunity.pipelineId || contract.pipelineId,
    ghl_stage_id: opportunity.pipelineStageId || null,
    name: opportunity.name?.trim() || contactDisplayName(opportunity.contact) || ghlId,
    pipeline_name: contract.pipelineName,
    stage_name: opportunity.pipelineStageId ? stageNamesById.get(opportunity.pipelineStageId) || null : null,
    status: opportunity.status || 'open',
    monetary_value: Number.isFinite(monetaryValue) ? monetaryValue : 0,
    custom_fields: Array.isArray(opportunity.customFields) ? opportunity.customFields : [],
    assigned_to: opportunity.assignedTo || null,
    ghl_created_at: isoOrNull(opportunity.createdAt || opportunity.dateAdded),
    ghl_updated_at: isoOrNull(opportunity.updatedAt || opportunity.dateUpdated),
    last_synced_at: syncedAt,
    updated_at: syncedAt,
    project_code: projectCode,
    last_stage_change_at: isoOrNull(opportunity.lastStageChangeAt),
    last_status_change_at: isoOrNull(opportunity.lastStatusChangeAt),
    sync_status: 'synced',
  };
}

export function fundingGhlOpportunityChanged(remote: MirrorRow, local: LocalMirrorRow | undefined): boolean {
  if (!local) return true;
  return (
    remote.ghl_updated_at !== isoOrNull(local.ghl_updated_at) ||
    remote.ghl_contact_id !== local.ghl_contact_id ||
    remote.ghl_pipeline_id !== local.ghl_pipeline_id ||
    remote.ghl_stage_id !== local.ghl_stage_id ||
    remote.name !== local.name ||
    remote.status !== local.status ||
    remote.monetary_value !== Number(local.monetary_value || 0) ||
    remote.assigned_to !== local.assigned_to ||
    remote.project_code !== local.project_code ||
    local.sync_status !== 'synced'
  );
}

async function fetchAllPipelineOpportunities(pipelineId: string) {
  const opportunities = new Map<string, GhlOpportunity>();
  const seenCursors = new Set<string>();
  let startAfter: number | string | undefined;
  let startAfterId: string | undefined;
  let pagesFetched = 0;
  let reportedTotal: number | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await searchOpportunitiesPage({ pipelineId, startAfter, startAfterId, limit: PAGE_LIMIT });
    pagesFetched += 1;
    if (typeof payload.meta?.total === 'number') reportedTotal = payload.meta.total;
    for (const opportunity of payload.opportunities) {
      const id = String(opportunity.id || opportunity._id || '').trim();
      if (id) opportunities.set(id, opportunity);
    }

    const nextStartAfter = payload.meta?.startAfter;
    const nextStartAfterId = payload.meta?.startAfterId;
    const completeByCount = reportedTotal !== null && opportunities.size >= reportedTotal;
    if (payload.opportunities.length < PAGE_LIMIT || completeByCount || payload.meta?.nextPage === false) break;
    if (nextStartAfter === undefined || !nextStartAfterId) {
      throw new Error(`GHL pagination stopped without a cursor after ${opportunities.size} opportunities`);
    }
    const cursorKey = `${nextStartAfter}:${nextStartAfterId}`;
    if (seenCursors.has(cursorKey)) throw new Error(`GHL repeated pagination cursor ${cursorKey}`);
    seenCursors.add(cursorKey);
    startAfter = nextStartAfter;
    startAfterId = nextStartAfterId;
  }

  if (pagesFetched === MAX_PAGES) throw new Error(`GHL pagination exceeded the ${MAX_PAGES}-page safety limit`);
  if (reportedTotal !== null && opportunities.size < reportedTotal) {
    throw new Error(`GHL returned ${opportunities.size} of ${reportedTotal} reported Grants opportunities`);
  }
  return { opportunities: [...opportunities.values()], pagesFetched, reportedTotal };
}

async function loadLocalMirrors(ghlIds: string[]): Promise<Map<string, LocalMirrorRow>> {
  const db = getServiceSupabase();
  const rows: LocalMirrorRow[] = [];
  for (const batch of chunks(ghlIds)) {
    const result = await db
      .from('ghl_opportunities')
      .select('ghl_id, ghl_contact_id, ghl_pipeline_id, ghl_stage_id, name, status, monetary_value, assigned_to, ghl_updated_at, project_code, sync_status')
      .in('ghl_id', batch);
    if (result.error) throw new Error(`Load local GHL opportunities: ${result.error.message}`);
    rows.push(...(result.data || []) as LocalMirrorRow[]);
  }
  return new Map(rows.map(row => [row.ghl_id, row]));
}

async function ensureContactMirrors(opportunities: GhlOpportunity[], syncedAt: string): Promise<number> {
  const db = getServiceSupabase();
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');
  const contacts = new Map<string, GhlOpportunityContact | undefined>();
  for (const opportunity of opportunities) {
    const contactId = String(opportunity.contactId || opportunity.contact?.id || '').trim();
    if (contactId && !contacts.has(contactId)) contacts.set(contactId, opportunity.contact);
  }
  if (!contacts.size) return 0;

  const existing = new Set<string>();
  for (const batch of chunks([...contacts.keys()])) {
    const result = await db.from('ghl_contacts').select('ghl_id').in('ghl_id', batch);
    if (result.error) throw new Error(`Load local GHL contacts: ${result.error.message}`);
    for (const row of result.data || []) existing.add(String(row.ghl_id));
  }
  const missing = [...contacts.entries()].filter(([id]) => !existing.has(id));
  let created = 0;
  for (const batch of chunks(missing)) {
    const rows = batch.map(([ghlId, contact]) => ({
      ghl_id: ghlId,
      ghl_location_id: locationId,
      first_name: contact?.firstName || null,
      last_name: contact?.lastName || null,
      full_name: contactDisplayName(contact),
      email: contact?.email || null,
      phone: contact?.phone || null,
      company_name: contact?.companyName || null,
      tags: Array.isArray(contact?.tags) ? contact.tags.filter(tag => typeof tag === 'string') : [],
      custom_fields: Array.isArray(contact?.customFields) ? contact.customFields : [],
      ghl_created_at: isoOrNull(contact?.createdAt || contact?.dateAdded),
      ghl_updated_at: isoOrNull(contact?.updatedAt || contact?.dateUpdated),
      last_synced_at: syncedAt,
      sync_status: 'synced',
      source: 'ghl',
      updated_at: syncedAt,
    }));
    const result = await db.from('ghl_contacts').upsert(rows, {
      onConflict: 'ghl_id',
      ignoreDuplicates: true,
    }).select('ghl_id');
    if (result.error) throw new Error(`Create missing GHL contact mirrors: ${result.error.message}`);
    created += result.data?.length || 0;
  }
  return created;
}

async function reconcileGovernedHandoffs(input: {
  mirrorById: Map<string, MirrorRow>;
  syncedAt: string;
}): Promise<{ updated: number; decisionsUpdated: number; missing: number }> {
  const db = getServiceSupabase();
  const handoffResult = await db
    .from('funding_ghl_handoffs')
    .select('id, project_code, opportunity_id, ghl_opportunity_id')
    .not('ghl_opportunity_id', 'is', null);
  if (handoffResult.error) throw new Error(`Load governed GHL handoffs: ${handoffResult.error.message}`);
  const handoffs = (handoffResult.data || []) as GovernedHandoff[];
  let updated = 0;
  let decisionsUpdated = 0;
  let missing = 0;

  for (const handoff of handoffs) {
    const mirror = handoff.ghl_opportunity_id ? input.mirrorById.get(handoff.ghl_opportunity_id) : undefined;
    if (!mirror) {
      const result = await db.from('funding_ghl_handoffs').update({
        sync_status: 'failed',
        last_error: 'GHL opportunity was not found in the Grants pipeline during scheduled reconciliation',
        last_ghl_sync_at: input.syncedAt,
        updated_at: input.syncedAt,
      }).eq('id', handoff.id).select('id');
      if (result.error) throw new Error(`Flag missing governed GHL handoff: ${result.error.message}`);
      updated += result.data?.length || 0;
      missing += 1;
      continue;
    }

    const handoffUpdate = await db.from('funding_ghl_handoffs').update({
      ghl_contact_id: mirror.ghl_contact_id,
      ghl_pipeline_id: mirror.ghl_pipeline_id,
      ghl_stage_id: mirror.ghl_stage_id,
      ghl_stage_name: mirror.stage_name,
      ghl_assigned_to: mirror.assigned_to,
      callback_status: mirror.status,
      sync_status: 'succeeded',
      last_error: null,
      last_ghl_sync_at: input.syncedAt,
      ghl_updated_at: mirror.ghl_updated_at,
      updated_at: input.syncedAt,
    }).eq('id', handoff.id).select('id');
    if (handoffUpdate.error) throw new Error(`Update governed GHL handoff: ${handoffUpdate.error.message}`);
    updated += handoffUpdate.data?.length || 0;

    const decision = mirror.stage_name ? fundingDecisionForGhlStage(mirror.stage_name) : null;
    if (decision) {
      const decisionUpdate = await db.from('act_grant_recommendation_decisions').update({
        decision,
        decided_at: input.syncedAt,
        updated_at: input.syncedAt,
      })
        .eq('project_code', handoff.project_code)
        .eq('opportunity_id', handoff.opportunity_id)
        .neq('decision', decision)
        .select('id');
      if (decisionUpdate.error) throw new Error(`Project governed GHL decision: ${decisionUpdate.error.message}`);
      decisionsUpdated += decisionUpdate.data?.length || 0;
    }
  }
  return { updated, decisionsUpdated, missing };
}

function maxObservedTimestamp(rows: MirrorRow[], cursorBefore: string | null): string | null {
  let maximum = cursorBefore ? Date.parse(cursorBefore) : Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const timestamp = row.ghl_updated_at ? Date.parse(row.ghl_updated_at) : Number.NaN;
    if (Number.isFinite(timestamp)) maximum = Math.max(maximum, timestamp);
  }
  return Number.isFinite(maximum) ? new Date(maximum).toISOString() : null;
}

export async function getFundingGhlSyncStatus() {
  const db = getServiceSupabase();
  const [state, runs] = await Promise.all([
    db.from('funding_ghl_sync_state').select('*').eq('sync_key', SYNC_KEY).maybeSingle(),
    db.from('funding_ghl_sync_runs').select('*').order('started_at', { ascending: false }).limit(20),
  ]);
  if (state.error) throw new Error(`Load GHL sync state: ${state.error.message}`);
  if (runs.error) throw new Error(`Load GHL sync runs: ${runs.error.message}`);
  return { state: state.data, runs: runs.data || [] };
}

export async function runFundingGhlSync(trigger: FundingGhlSyncTrigger): Promise<FundingGhlSyncResult> {
  const startedAtMs = Date.now();
  const db = getServiceSupabase();
  const contract = await getFundingGhlContractStatus();
  if (!contract.ready || !contract.pipelineId) {
    const gaps = [...contract.missingStages, ...contract.missingFields];
    throw new Error(`GHL funding contract is not ready${gaps.length ? `: ${gaps.join(', ')}` : contract.error ? `: ${contract.error}` : ''}`);
  }

  const runInsert = await db.from('funding_ghl_sync_runs').insert({
    trigger,
    status: 'running',
    pipeline_id: contract.pipelineId,
  }).select('id').single();
  if (runInsert.error || !runInsert.data) throw new Error(`Create GHL sync run: ${runInsert.error?.message || 'no row returned'}`);
  const runId = String(runInsert.data.id);
  let lockAcquired = false;

  try {
    const lock = await db.rpc('acquire_funding_ghl_sync_lock', {
      p_sync_key: SYNC_KEY,
      p_pipeline_id: contract.pipelineId,
      p_run_id: runId,
      p_lease_seconds: 600,
    });
    if (lock.error) throw new Error(`Acquire GHL sync lease: ${lock.error.message}`);
    lockAcquired = lock.data === true;
    if (!lockAcquired) {
      const durationMs = Date.now() - startedAtMs;
      const skipped = await db.from('funding_ghl_sync_runs').update({
        status: 'skipped',
        errors: [{ code: 'already_running', message: 'Another GHL funding sync holds the database lease' }],
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
      if (skipped.error) throw new Error(`Record skipped GHL sync: ${skipped.error.message}`);
      return {
        runId,
        status: 'skipped',
        pipelineId: contract.pipelineId,
        pagesFetched: 0,
        opportunitiesFetched: 0,
        opportunitiesChanged: 0,
        opportunitiesUpserted: 0,
        contactsCreated: 0,
        handoffsUpdated: 0,
        decisionsUpdated: 0,
        missingGovernedHandoffs: 0,
        cursorAfter: null,
        durationMs,
      };
    }

    const stateResult = await db.from('funding_ghl_sync_state')
      .select('cursor_updated_at')
      .eq('sync_key', SYNC_KEY)
      .single();
    if (stateResult.error) throw new Error(`Load GHL sync cursor: ${stateResult.error.message}`);
    const cursorBefore = isoOrNull(stateResult.data.cursor_updated_at);
    const cursorPatch = await db.from('funding_ghl_sync_runs').update({ cursor_before: cursorBefore }).eq('id', runId);
    if (cursorPatch.error) throw new Error(`Record GHL sync cursor: ${cursorPatch.error.message}`);

    const fetched = await fetchAllPipelineOpportunities(contract.pipelineId);
    const syncedAt = new Date().toISOString();
    const opportunityIds = fetched.opportunities
      .map(opportunity => String(opportunity.id || opportunity._id || '').trim())
      .filter(Boolean);
    const localMirrors = await loadLocalMirrors(opportunityIds);
    const normalized = fetched.opportunities.flatMap(opportunity => {
      const id = String(opportunity.id || opportunity._id || '').trim();
      const row = normalizeFundingGhlOpportunity({
        opportunity,
        contract,
        syncedAt,
      });
      return row ? [row] : [];
    });
    if (normalized.length !== fetched.opportunities.length) {
      throw new Error(`GHL returned ${fetched.opportunities.length - normalized.length} opportunities without stable IDs`);
    }

    const contactsCreated = await ensureContactMirrors(fetched.opportunities, syncedAt);
    const changed = normalized.filter(row => fundingGhlOpportunityChanged(row, localMirrors.get(row.ghl_id)));
    let opportunitiesUpserted = 0;
    for (const batch of chunks(changed)) {
      const result = await db.from('ghl_opportunities').upsert(batch, { onConflict: 'ghl_id' }).select('ghl_id');
      if (result.error) throw new Error(`Upsert GHL opportunity mirrors: ${result.error.message}`);
      opportunitiesUpserted += result.data?.length || 0;
    }
    if (opportunitiesUpserted !== changed.length) {
      throw new Error(`GHL opportunity upsert mismatch: attempted ${changed.length}, wrote ${opportunitiesUpserted}`);
    }

    const mirrorById = new Map(normalized.map(row => [row.ghl_id, row]));
    const handoffs = await reconcileGovernedHandoffs({ mirrorById, syncedAt });
    const cursorAfter = maxObservedTimestamp(normalized, cursorBefore);
    const warnings = handoffs.missing
      ? [{ code: 'missing_governed_handoffs', count: handoffs.missing }]
      : [];
    const durationMs = Date.now() - startedAtMs;
    const stateUpdate = await db.from('funding_ghl_sync_state').update({
      pipeline_id: contract.pipelineId,
      cursor_updated_at: cursorAfter,
      last_success_at: syncedAt,
      last_run_id: runId,
      last_error: null,
      locked_until: null,
      locked_by: null,
      metadata: {
        reportedTotal: fetched.reportedTotal,
        opportunitiesFetched: normalized.length,
        missingGovernedHandoffs: handoffs.missing,
      },
      updated_at: syncedAt,
    }).eq('sync_key', SYNC_KEY).eq('locked_by', runId).select('sync_key');
    if (stateUpdate.error) throw new Error(`Advance GHL sync state: ${stateUpdate.error.message}`);
    if (stateUpdate.data?.length !== 1) throw new Error('GHL sync lease expired before state could be committed');
    lockAcquired = false;

    const runUpdate = await db.from('funding_ghl_sync_runs').update({
      status: 'succeeded',
      cursor_after: cursorAfter,
      pages_fetched: fetched.pagesFetched,
      opportunities_fetched: normalized.length,
      opportunities_changed: changed.length,
      opportunities_upserted: opportunitiesUpserted,
      contacts_created: contactsCreated,
      handoffs_updated: handoffs.updated,
      decisions_updated: handoffs.decisionsUpdated,
      errors: warnings,
      duration_ms: durationMs,
      completed_at: syncedAt,
    }).eq('id', runId);
    if (runUpdate.error) throw new Error(`Complete GHL sync run: ${runUpdate.error.message}`);

    return {
      runId,
      status: 'succeeded',
      pipelineId: contract.pipelineId,
      pagesFetched: fetched.pagesFetched,
      opportunitiesFetched: normalized.length,
      opportunitiesChanged: changed.length,
      opportunitiesUpserted,
      contactsCreated,
      handoffsUpdated: handoffs.updated,
      decisionsUpdated: handoffs.decisionsUpdated,
      missingGovernedHandoffs: handoffs.missing,
      cursorAfter,
      durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();
    const runFailure = await db.from('funding_ghl_sync_runs').update({
      status: 'failed',
      errors: [{ message }],
      duration_ms: Date.now() - startedAtMs,
      completed_at: completedAt,
    }).eq('id', runId);
    if (runFailure.error) console.error('Failed to record GHL sync run failure', runFailure.error.message);
    if (lockAcquired) {
      const stateFailure = await db.from('funding_ghl_sync_state').update({
        last_error: message,
        locked_until: null,
        locked_by: null,
        updated_at: completedAt,
      }).eq('sync_key', SYNC_KEY).eq('locked_by', runId);
      if (stateFailure.error) console.error('Failed to release GHL sync lease', stateFailure.error.message);
    }
    throw error;
  }
}
