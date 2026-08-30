import {
  createOpportunityCustomField,
  findGrantPipeline,
  getLocationUsers,
  getOpportunityCustomFields,
  getPipelines,
  type GhlCustomField,
  type GhlLocationUser,
} from '@/lib/ghl';
import { getServiceSupabase } from '@/lib/supabase';

type Pipeline = { id?: string; name?: string; stages?: Array<{ id?: string; name?: string }> };

export const FUNDING_GHL_STAGES = [
  'Grant Opportunity Identified',
  'Application In Progress',
  'Grant Submitted',
  'Grant Awarded',
  'Grant Reporting Due',
  'Grant Report Submitted',
  'Grant Declined',
] as const;

export const FUNDING_GHL_FIELDS = [
  { key: 'projectCode', name: 'ACT project code', dataType: 'TEXT' },
  { key: 'sourceRef', name: 'GrantScope source ref', dataType: 'TEXT' },
  { key: 'applicantEntity', name: 'Applicant entity', dataType: 'TEXT' },
  { key: 'decisionUrl', name: 'GrantScope decision URL', dataType: 'TEXT' },
  { key: 'nextAction', name: 'Next funding action', dataType: 'LARGE_TEXT' },
  { key: 'nextActionDue', name: 'Next action due', dataType: 'DATE' },
  { key: 'notionUrl', name: 'Notion application URL', dataType: 'TEXT' },
] as const;

export type FundingGhlFieldKey = (typeof FUNDING_GHL_FIELDS)[number]['key'];

export type FundingGhlContractStatus = {
  ready: boolean;
  pipelineId: string | null;
  pipelineName: string;
  initialStageId: string | null;
  stageIds: Record<string, string>;
  missingStages: string[];
  fieldIds: Partial<Record<FundingGhlFieldKey, string>>;
  missingFields: string[];
  users: Array<{ id: string; name: string; email: string | null }>;
  metrics: {
    grantsPipeline: number;
    unalignedLegacy: number;
    governedHandoffs: number;
    projectFoundationLinks: number;
    foundationLinksWithContact: number;
  };
  error: string | null;
};

function pipelinesFrom(payload: unknown): Pipeline[] {
  if (Array.isArray(payload)) return payload as Pipeline[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { pipelines?: unknown }).pipelines)) {
    return (payload as { pipelines: Pipeline[] }).pipelines;
  }
  return [];
}

function normalized(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

export function buildFundingGhlContractSnapshot(input: {
  pipelinesPayload: unknown;
  fields: GhlCustomField[];
  users: GhlLocationUser[];
  metrics?: Partial<FundingGhlContractStatus['metrics']>;
  error?: string | null;
}): FundingGhlContractStatus {
  const pipeline = findGrantPipeline(pipelinesFrom(input.pipelinesPayload));
  const stages = new Map(
    (pipeline?.stages || []).flatMap(stage => stage.id && stage.name ? [[normalized(stage.name), stage.id] as const] : [])
  );
  const missingStages = FUNDING_GHL_STAGES.filter(name => !stages.has(normalized(name)));
  const fieldsByName = new Map(input.fields.map(field => [normalized(field.name), field]));
  const fieldIds: Partial<Record<FundingGhlFieldKey, string>> = {};
  const missingFields: string[] = [];
  for (const field of FUNDING_GHL_FIELDS) {
    const existing = fieldsByName.get(normalized(field.name));
    if (existing?.id) fieldIds[field.key] = existing.id;
    else missingFields.push(field.name);
  }
  const users = input.users
    .filter(user => user.id && !user.deleted)
    .map(user => ({ id: user.id, name: user.name || user.email || user.id, email: user.email || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const metrics = {
    grantsPipeline: input.metrics?.grantsPipeline || 0,
    unalignedLegacy: input.metrics?.unalignedLegacy || 0,
    governedHandoffs: input.metrics?.governedHandoffs || 0,
    projectFoundationLinks: input.metrics?.projectFoundationLinks || 0,
    foundationLinksWithContact: input.metrics?.foundationLinksWithContact || 0,
  };
  const initialStageId = stages.get(normalized(FUNDING_GHL_STAGES[0])) || null;
  const error = input.error || null;
  return {
    ready: Boolean(pipeline?.id && initialStageId && !missingStages.length && !missingFields.length && users.length && !error),
    pipelineId: pipeline?.id || null,
    pipelineName: pipeline?.name || 'Grants',
    initialStageId,
    stageIds: Object.fromEntries(FUNDING_GHL_STAGES.flatMap(name => {
      const id = stages.get(normalized(name));
      return id ? [[name, id]] : [];
    })),
    missingStages,
    fieldIds,
    missingFields,
    users,
    metrics,
    error,
  };
}

async function loadMetrics(): Promise<FundingGhlContractStatus['metrics']> {
  const db = getServiceSupabase();
  const [grants, unaligned, handoffs, foundationLinks, foundationContacts] = await Promise.all([
    db.from('ghl_opportunities').select('id', { count: 'exact', head: true }).ilike('pipeline_name', 'Grants').eq('sync_status', 'synced'),
    db.from('ghl_opportunities').select('id', { count: 'exact', head: true }).ilike('pipeline_name', 'Grants').eq('sync_status', 'synced').is('project_code', null),
    db.from('funding_ghl_handoffs').select('id', { count: 'exact', head: true }),
    db.from('org_project_foundations').select('id', { count: 'exact', head: true }),
    db.from('org_project_foundations').select('id', { count: 'exact', head: true }).not('ghl_contact_id', 'is', null),
  ]);
  return {
    grantsPipeline: grants.count || 0,
    unalignedLegacy: unaligned.count || 0,
    governedHandoffs: handoffs.count || 0,
    projectFoundationLinks: foundationLinks.count || 0,
    foundationLinksWithContact: foundationContacts.count || 0,
  };
}

export async function getFundingGhlContractStatus(): Promise<FundingGhlContractStatus> {
  const metrics = await loadMetrics();
  try {
    const pipelinesPayload = await getPipelines();
    const fields = await getOpportunityCustomFields();
    const users = await getLocationUsers();
    return buildFundingGhlContractSnapshot({ pipelinesPayload, fields, users, metrics });
  } catch (error) {
    return buildFundingGhlContractSnapshot({
      pipelinesPayload: [],
      fields: [],
      users: [],
      metrics,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function ensureFundingGhlContract(): Promise<FundingGhlContractStatus> {
  const pipelinesPayload = await getPipelines();
  const fields = await getOpportunityCustomFields();
  const pipeline = findGrantPipeline(pipelinesFrom(pipelinesPayload));
  if (!pipeline?.id) throw new Error('The GHL Grants pipeline is missing');
  const stages = new Set((pipeline.stages || []).map(stage => normalized(stage.name)));
  const missingStages = FUNDING_GHL_STAGES.filter(stage => !stages.has(normalized(stage)));
  if (missingStages.length) throw new Error(`The GHL Grants pipeline is missing stages: ${missingStages.join(', ')}`);
  const existingNames = new Set(fields.map(field => normalized(field.name)));
  for (const field of FUNDING_GHL_FIELDS) {
    if (!existingNames.has(normalized(field.name))) {
      await createOpportunityCustomField({ name: field.name, dataType: field.dataType });
    }
  }
  return getFundingGhlContractStatus();
}

export function buildFundingGhlCustomFields(
  fieldIds: FundingGhlContractStatus['fieldIds'],
  values: Partial<Record<FundingGhlFieldKey, string | null | undefined>>
): Array<{ id: string; fieldValue: string }> {
  return FUNDING_GHL_FIELDS.flatMap(field => {
    const id = fieldIds[field.key];
    const value = values[field.key]?.trim();
    return id && value ? [{ id, fieldValue: value }] : [];
  });
}

export function fundingDecisionForGhlStage(stageName: string): string | null {
  const decisions: Record<string, string> = {
    'grant opportunity identified': 'pursuing',
    'application in progress': 'applied',
    'grant submitted': 'submitted',
    'grant awarded': 'won',
    'grant reporting due': 'won',
    'grant report submitted': 'won',
    'grant declined': 'lost',
  };
  return decisions[normalized(stageName)] || null;
}
