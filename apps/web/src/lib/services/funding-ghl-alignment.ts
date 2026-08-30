import { updateOpportunity, type GhlOpportunityCustomField } from '@/lib/ghl';
import {
  buildFundingGhlCustomFields,
  getFundingGhlContractStatus,
} from '@/lib/services/funding-ghl-contract';
import { ghlCustomFieldValue } from '@/lib/services/funding-ghl-sync';
import { getServiceSupabase } from '@/lib/supabase';

const ALIGNMENT_KEY = 'funding-grants-notion';
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';
const ACT_FUNDING_DATA_SOURCE_ID = 'ecfa025b-3275-42a4-8923-6cddf800adce';
const ACT_PROJECTS_DATA_SOURCE_ID = '0786139b-85d6-4699-b2bc-5b2effd52457';
const NOTION_PAGE_SIZE = 100;
const NOTION_MAX_PAGES = 20;
const NOTION_WRITE_INTERVAL_MS = 350;

export type FundingGhlAlignmentTrigger = 'cron' | 'manual' | 'test';
export type FundingGhlAlignmentClassification =
  | 'safe_exact'
  | 'already_aligned'
  | 'conflict'
  | 'missing_notion_page'
  | 'missing_project_relation'
  | 'project_missing_code'
  | 'invalid_project_code'
  | 'multiple_project_codes'
  | 'title_collision';

type NotionRichText = {
  plain_text?: string;
  text?: { content?: string };
};

type NotionProperty = {
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  relation?: Array<{ id?: string }>;
};

type NotionPage = {
  id: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
};

type GhlMirror = {
  ghl_id: string;
  name: string;
  stage_name: string | null;
  status: string;
  project_code: string | null;
  custom_fields: GhlOpportunityCustomField[];
};

type NotionProject = {
  pageId: string;
  name: string;
  code: string | null;
};

type NotionFunding = {
  pageId: string;
  pageUrl: string;
  title: string;
  ghlOpportunityId: string | null;
  projectPageIds: string[];
};

export type FundingGhlAlignmentDecision = {
  classification: FundingGhlAlignmentClassification;
  status: 'pending' | 'applied' | 'blocked';
  projectCode: string | null;
};

export type FundingGhlAlignmentResult = {
  runId: string;
  status: 'succeeded' | 'skipped';
  ghlOpportunities: number;
  notionPagesScanned: number;
  inboxPagesCreated: number;
  notionLinksWritten: number;
  safeMappings: number;
  mappingsApplied: number;
  alreadyAligned: number;
  blocked: number;
  durationMs: number;
};

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function normalized(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function propertyText(property: NotionProperty | undefined, key: 'title' | 'rich_text'): string {
  const values = property?.[key] || [];
  return values.map(value => value.plain_text || value.text?.content || '').join('').trim();
}

function relationIds(property: NotionProperty | undefined): string[] {
  return (property?.relation || []).map(item => item.id?.trim() || '').filter(Boolean);
}

function richText(content: string | null | undefined) {
  return content ? [{ type: 'text', text: { content: String(content).slice(0, 2000) } }] : [];
}

function notionPageUrl(page: Pick<NotionPage, 'id' | 'url'>): string {
  return page.url || `https://www.notion.so/${page.id.replace(/-/g, '')}`;
}

function notionPageIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.replace(/-/g, '').match(/([0-9a-f]{32})$/i);
    return match?.[1]?.toLowerCase() || null;
  } catch {
    return null;
  }
}

function isSameNotionPage(value: string | null, page: NotionFunding): boolean {
  if (!value) return false;
  const linkedId = notionPageIdFromUrl(value);
  if (linkedId) return linkedId === page.pageId.replace(/-/g, '').toLowerCase();
  return value.replace(/[/?#]+$/, '') === page.pageUrl.replace(/[/?#]+$/, '');
}

function ghlRecordUrl(opportunityId: string): string | null {
  const template = process.env.GHL_OPPORTUNITY_URL_TEMPLATE;
  return template ? template.replace('{opportunityId}', opportunityId) : null;
}

async function notion(token: string, method: 'POST' | 'PATCH', path: string, body: unknown) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${NOTION_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) return response.json() as Promise<Record<string, unknown>>;
    const message = (await response.text()).slice(0, 600);
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await wait(500 * (2 ** attempt));
      continue;
    }
    throw new Error(`Notion ${response.status}: ${message}`);
  }
  throw new Error('Notion request failed after retries');
}

async function queryAllNotionPages(token: string, dataSourceId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < NOTION_MAX_PAGES; page += 1) {
    const response = await notion(token, 'POST', `/data_sources/${dataSourceId}/query`, {
      page_size: NOTION_PAGE_SIZE,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const results = Array.isArray(response.results) ? response.results : [];
    for (const result of results) {
      if (result && typeof result === 'object' && typeof (result as { id?: unknown }).id === 'string') {
        pages.push(result as NotionPage);
      }
    }
    if (response.has_more !== true) return pages;
    cursor = typeof response.next_cursor === 'string' ? response.next_cursor : undefined;
    if (!cursor) throw new Error(`Notion data source ${dataSourceId} reported more pages without a cursor`);
  }
  throw new Error(`Notion data source ${dataSourceId} exceeded ${NOTION_MAX_PAGES} pages`);
}

function toNotionProject(page: NotionPage): NotionProject {
  return {
    pageId: page.id,
    name: propertyText(page.properties?.Name, 'title'),
    code: propertyText(page.properties?.['ACT Project Code'], 'rich_text') || null,
  };
}

function toNotionFunding(page: NotionPage): NotionFunding {
  return {
    pageId: page.id,
    pageUrl: notionPageUrl(page),
    title: propertyText(page.properties?.['Funder / Opportunity'], 'title'),
    ghlOpportunityId: propertyText(page.properties?.['GHL Opportunity ID'], 'rich_text') || null,
    projectPageIds: relationIds(page.properties?.['🗂️ Projects']),
  };
}

export function classifyFundingAlignment(input: {
  exactPageCount: number;
  titleCollisionPageIds: string[];
  relatedProjectCodes: Array<string | null>;
  activeProjectCodes: Iterable<string>;
  currentProjectCode: string | null;
  remoteNotionConflict?: boolean;
}): FundingGhlAlignmentDecision {
  if (input.exactPageCount > 1 || input.remoteNotionConflict) {
    return { classification: 'conflict', status: 'blocked', projectCode: null };
  }
  if (input.exactPageCount === 0) {
    return input.titleCollisionPageIds.length
      ? { classification: 'title_collision', status: 'blocked', projectCode: null }
      : { classification: 'missing_notion_page', status: 'blocked', projectCode: null };
  }
  if (!input.relatedProjectCodes.length) {
    return { classification: 'missing_project_relation', status: 'blocked', projectCode: null };
  }
  if (input.relatedProjectCodes.some(code => !code)) {
    return { classification: 'project_missing_code', status: 'blocked', projectCode: null };
  }
  const codes = [...new Set(input.relatedProjectCodes.filter((code): code is string => Boolean(code)))];
  if (input.relatedProjectCodes.length > 1 || codes.length > 1) {
    return { classification: 'multiple_project_codes', status: 'blocked', projectCode: null };
  }
  const projectCode = codes[0] || null;
  const activeCodes = new Set(input.activeProjectCodes);
  if (!projectCode || !activeCodes.has(projectCode)) {
    return { classification: 'invalid_project_code', status: 'blocked', projectCode };
  }
  if (input.currentProjectCode && input.currentProjectCode !== projectCode) {
    return { classification: 'conflict', status: 'blocked', projectCode };
  }
  if (input.currentProjectCode === projectCode) {
    return { classification: 'already_aligned', status: 'applied', projectCode };
  }
  return { classification: 'safe_exact', status: 'pending', projectCode };
}

function notionMirrorProperties(opportunity: GhlMirror, syncedAt: string) {
  const recordUrl = ghlRecordUrl(opportunity.ghl_id);
  return {
    'GHL pipeline': { select: { name: 'Grants' } },
    'GHL stage': { rich_text: richText(opportunity.stage_name) },
    'Last GHL sync': { date: { start: syncedAt } },
    ...(recordUrl ? { 'GHL record URL': { url: recordUrl } } : {}),
  };
}

async function createNotionInboxPage(token: string, opportunity: GhlMirror, syncedAt: string): Promise<NotionFunding> {
  const dataSourceId = process.env.NOTION_FUNDERS_OPPORTUNITIES_DATA_SOURCE_ID || ACT_FUNDING_DATA_SOURCE_ID;
  const response = await notion(token, 'POST', '/pages', {
    parent: { type: 'data_source_id', data_source_id: dataSourceId },
    properties: {
      'Funder / Opportunity': { title: richText(opportunity.name) },
      'GHL Opportunity ID': { rich_text: richText(opportunity.ghl_id) },
      ...notionMirrorProperties(opportunity, syncedAt),
      Grant: { checkbox: true },
      Instrument: { select: { name: 'Grant' } },
      'Money door': { select: { name: 'Grant / philanthropy' } },
      'Source note': {
        rich_text: richText('Imported from GHL. Choose 🗂️ Projects to align this opportunity; no project was inferred.'),
      },
    },
    children: [{
      object: 'block',
      type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji: '🧭' },
        rich_text: richText('Alignment inbox: GHL owns stage, owner and contacts. Notion owns project relation and application writing.'),
      },
    }],
  });
  await wait(NOTION_WRITE_INTERVAL_MS);
  const page = response as NotionPage;
  if (!page.id) throw new Error(`Notion did not return a page ID for GHL opportunity ${opportunity.ghl_id}`);
  return {
    pageId: page.id,
    pageUrl: notionPageUrl(page),
    title: opportunity.name,
    ghlOpportunityId: opportunity.ghl_id,
    projectPageIds: [],
  };
}

async function updateNotionMirror(token: string, pageId: string, opportunity: GhlMirror, syncedAt: string) {
  await notion(token, 'PATCH', `/pages/${pageId}`, {
    properties: notionMirrorProperties(opportunity, syncedAt),
  });
  await wait(NOTION_WRITE_INTERVAL_MS);
}

async function loadCurrentGhlMirrors(): Promise<GhlMirror[]> {
  const db = getServiceSupabase();
  const result = await db
    .from('ghl_opportunities')
    .select('ghl_id, name, stage_name, status, project_code, custom_fields')
    .ilike('pipeline_name', 'Grants')
    .eq('sync_status', 'synced')
    .order('name');
  if (result.error) throw new Error(`Load current GHL Grants opportunities: ${result.error.message}`);
  return (result.data || []) as GhlMirror[];
}

async function loadActiveProjectCodes(): Promise<Set<string>> {
  const db = getServiceSupabase();
  const result = await db.from('org_projects').select('code').eq('status', 'active').not('code', 'is', null);
  if (result.error) throw new Error(`Load canonical active project codes: ${result.error.message}`);
  return new Set((result.data || []).map(row => String(row.code || '').trim()).filter(Boolean));
}

export async function getFundingGhlAlignmentStatus() {
  const db = getServiceSupabase();
  const [state, runs] = await Promise.all([
    db.from('funding_ghl_alignment_state').select('*').eq('alignment_key', ALIGNMENT_KEY).maybeSingle(),
    db.from('funding_ghl_alignment_runs').select('*').order('started_at', { ascending: false }).limit(20),
  ]);
  if (state.error) throw new Error(`Load funding alignment state: ${state.error.message}`);
  if (runs.error) throw new Error(`Load funding alignment runs: ${runs.error.message}`);
  const latestRun = runs.data?.[0] || null;
  let candidatesQuery = db.from('funding_ghl_alignment_candidates').select('*').order('ghl_opportunity_name');
  if (latestRun?.started_at) candidatesQuery = candidatesQuery.gte('last_seen_at', latestRun.started_at);
  const candidates = await candidatesQuery;
  if (candidates.error) throw new Error(`Load funding alignment candidates: ${candidates.error.message}`);
  return { state: state.data, runs: runs.data || [], candidates: candidates.data || [] };
}

export async function runFundingGhlAlignment(
  trigger: FundingGhlAlignmentTrigger,
  options: { createInbox?: boolean; applySafe?: boolean } = {}
): Promise<FundingGhlAlignmentResult> {
  const startedAtMs = Date.now();
  const db = getServiceSupabase();
  const createInbox = options.createInbox ?? trigger !== 'test';
  const applySafe = options.applySafe ?? trigger !== 'test';
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN is required for GHL funding alignment');

  const contract = await getFundingGhlContractStatus();
  if (!contract.ready || !contract.pipelineId || !contract.fieldIds.projectCode || !contract.fieldIds.notionUrl) {
    throw new Error('GHL funding contract must be ready before Notion alignment');
  }

  const runInsert = await db.from('funding_ghl_alignment_runs').insert({
    trigger,
    status: 'running',
    create_inbox: createInbox,
    apply_safe: applySafe,
  }).select('id').single();
  if (runInsert.error || !runInsert.data) {
    throw new Error(`Create funding alignment run: ${runInsert.error?.message || 'no row returned'}`);
  }
  const runId = String(runInsert.data.id);
  let lockAcquired = false;

  try {
    const lock = await db.rpc('acquire_funding_ghl_alignment_lock', {
      p_alignment_key: ALIGNMENT_KEY,
      p_run_id: runId,
      p_lease_seconds: 900,
    });
    if (lock.error) throw new Error(`Acquire funding alignment lease: ${lock.error.message}`);
    lockAcquired = lock.data === true;
    if (!lockAcquired) {
      const durationMs = Date.now() - startedAtMs;
      const skipped = await db.from('funding_ghl_alignment_runs').update({
        status: 'skipped',
        errors: [{ code: 'already_running', message: 'Another funding alignment holds the database lease' }],
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
      if (skipped.error) throw new Error(`Record skipped funding alignment: ${skipped.error.message}`);
      return {
        runId,
        status: 'skipped',
        ghlOpportunities: 0,
        notionPagesScanned: 0,
        inboxPagesCreated: 0,
        notionLinksWritten: 0,
        safeMappings: 0,
        mappingsApplied: 0,
        alreadyAligned: 0,
        blocked: 0,
        durationMs,
      };
    }

    const fundingDataSourceId = process.env.NOTION_FUNDERS_OPPORTUNITIES_DATA_SOURCE_ID || ACT_FUNDING_DATA_SOURCE_ID;
    const projectsDataSourceId = process.env.NOTION_PROJECTS_DATA_SOURCE_ID || ACT_PROJECTS_DATA_SOURCE_ID;
    const [opportunities, activeProjectCodes, projectPages, fundingPages] = await Promise.all([
      loadCurrentGhlMirrors(),
      loadActiveProjectCodes(),
      queryAllNotionPages(token, projectsDataSourceId),
      queryAllNotionPages(token, fundingDataSourceId),
    ]);
    const projectByPageId = new Map(projectPages.map(toNotionProject).map(project => [project.pageId, project]));
    const notionFunding = fundingPages.map(toNotionFunding);
    const fundingByGhlId = new Map<string, NotionFunding[]>();
    const fundingByTitle = new Map<string, NotionFunding[]>();
    for (const page of notionFunding) {
      if (page.ghlOpportunityId) {
        const exact = fundingByGhlId.get(page.ghlOpportunityId) || [];
        exact.push(page);
        fundingByGhlId.set(page.ghlOpportunityId, exact);
      }
      const titleKey = normalized(page.title);
      if (titleKey) {
        const titled = fundingByTitle.get(titleKey) || [];
        titled.push(page);
        fundingByTitle.set(titleKey, titled);
      }
    }

    const syncedAt = new Date().toISOString();
    const candidates: Array<Record<string, unknown>> = [];
    let inboxPagesCreated = 0;
    let notionLinksWritten = 0;
    let safeMappings = 0;
    let mappingsApplied = 0;
    let alreadyAligned = 0;
    let blocked = 0;

    for (const opportunity of opportunities) {
      let exactPages = fundingByGhlId.get(opportunity.ghl_id) || [];
      const titleCollisions = exactPages.length
        ? []
        : (fundingByTitle.get(normalized(opportunity.name)) || []).filter(page => page.ghlOpportunityId !== opportunity.ghl_id);
      let createdInbox = false;

      if (!exactPages.length && !titleCollisions.length && createInbox) {
        const created = await createNotionInboxPage(token, opportunity, syncedAt);
        exactPages = [created];
        fundingByGhlId.set(opportunity.ghl_id, exactPages);
        inboxPagesCreated += 1;
        createdInbox = true;
      }

      const exactPage = exactPages.length === 1 ? exactPages[0] : null;
      if (exactPage && !createdInbox && createInbox) {
        await updateNotionMirror(token, exactPage.pageId, opportunity, syncedAt);
      }

      const relatedProjects = exactPage
        ? exactPage.projectPageIds.map(pageId => projectByPageId.get(pageId) || { pageId, name: '', code: null })
        : [];
      const remoteNotionUrl = ghlCustomFieldValue(opportunity.custom_fields, contract.fieldIds.notionUrl);
      const remoteNotionConflict = Boolean(remoteNotionUrl && exactPage && !isSameNotionPage(remoteNotionUrl, exactPage));
      let decision = classifyFundingAlignment({
        exactPageCount: exactPages.length,
        titleCollisionPageIds: titleCollisions.map(page => page.pageId),
        relatedProjectCodes: relatedProjects.map(project => project.code),
        activeProjectCodes,
        currentProjectCode: opportunity.project_code,
        remoteNotionConflict,
      });

      if (decision.classification === 'safe_exact') safeMappings += 1;
      if (decision.classification === 'already_aligned') alreadyAligned += 1;

      if (exactPage && !remoteNotionConflict && applySafe) {
        const values: { notionUrl?: string; projectCode?: string } = {};
        if (!isSameNotionPage(remoteNotionUrl, exactPage)) values.notionUrl = exactPage.pageUrl;
        if (decision.classification === 'safe_exact' && decision.projectCode) values.projectCode = decision.projectCode;
        const customFields = buildFundingGhlCustomFields(contract.fieldIds, values);
        if (customFields.length) {
          await updateOpportunity(opportunity.ghl_id, { customFields });
          if (values.notionUrl) notionLinksWritten += 1;
          if (values.projectCode) {
            const mirrorUpdate = await db.from('ghl_opportunities').update({
              project_code: values.projectCode,
              updated_at: syncedAt,
            }).eq('ghl_id', opportunity.ghl_id).select('ghl_id');
            if (mirrorUpdate.error) throw new Error(`Update aligned GHL mirror: ${mirrorUpdate.error.message}`);
            if (mirrorUpdate.data?.length !== 1) throw new Error(`Aligned GHL mirror ${opportunity.ghl_id} was not updated`);
            mappingsApplied += 1;
            decision = { ...decision, status: 'applied' };
          }
        }
      }

      if (decision.status === 'blocked') blocked += 1;
      candidates.push({
        ghl_opportunity_id: opportunity.ghl_id,
        ghl_opportunity_name: opportunity.name,
        notion_funding_page_id: exactPage?.pageId || null,
        notion_funding_page_url: exactPage?.pageUrl || null,
        notion_project_page_ids: relatedProjects.map(project => project.pageId),
        project_code: decision.projectCode,
        current_project_code: decision.status === 'applied' && decision.projectCode
          ? decision.projectCode
          : opportunity.project_code,
        classification: decision.classification,
        status: decision.status,
        evidence: {
          authority: 'exact GHL Opportunity ID + explicit Notion 🗂️ Projects relation + active canonical ACT project code',
          exactNotionPageIds: exactPages.map(page => page.pageId),
          titleCollisionPageIds: titleCollisions.map(page => page.pageId),
          titleCollisions: titleCollisions.map(page => ({
            pageId: page.pageId,
            pageUrl: page.pageUrl,
            title: page.title,
            ghlOpportunityId: page.ghlOpportunityId,
          })),
          relatedProjects,
          remoteNotionUrl: remoteNotionUrl || null,
          remoteNotionConflict,
        },
        last_seen_at: syncedAt,
        ...(decision.status === 'applied' ? { applied_at: syncedAt } : {}),
        updated_at: syncedAt,
      });
    }

    if (candidates.length) {
      const candidateUpsert = await db.from('funding_ghl_alignment_candidates')
        .upsert(candidates, { onConflict: 'ghl_opportunity_id' })
        .select('ghl_opportunity_id');
      if (candidateUpsert.error) throw new Error(`Persist funding alignment candidates: ${candidateUpsert.error.message}`);
      if (candidateUpsert.data?.length !== candidates.length) {
        throw new Error(`Funding alignment candidate mismatch: attempted ${candidates.length}, wrote ${candidateUpsert.data?.length || 0}`);
      }
    }

    const durationMs = Date.now() - startedAtMs;
    const stateUpdate = await db.from('funding_ghl_alignment_state').update({
      last_success_at: syncedAt,
      last_run_id: runId,
      last_error: null,
      locked_until: null,
      locked_by: null,
      metadata: {
        ghlOpportunities: opportunities.length,
        notionPagesScanned: fundingPages.length,
        inboxPagesCreated,
        notionLinksWritten,
        mappingsApplied,
        blocked,
      },
      updated_at: syncedAt,
    }).eq('alignment_key', ALIGNMENT_KEY).eq('locked_by', runId).select('alignment_key');
    if (stateUpdate.error) throw new Error(`Commit funding alignment state: ${stateUpdate.error.message}`);
    if (stateUpdate.data?.length !== 1) throw new Error('Funding alignment lease expired before state could be committed');
    lockAcquired = false;

    const runUpdate = await db.from('funding_ghl_alignment_runs').update({
      status: 'succeeded',
      ghl_opportunities: opportunities.length,
      notion_pages_scanned: fundingPages.length,
      inbox_pages_created: inboxPagesCreated,
      notion_links_written: notionLinksWritten,
      safe_mappings: safeMappings,
      mappings_applied: mappingsApplied,
      already_aligned: alreadyAligned,
      blocked,
      duration_ms: durationMs,
      completed_at: syncedAt,
    }).eq('id', runId);
    if (runUpdate.error) throw new Error(`Complete funding alignment run: ${runUpdate.error.message}`);

    return {
      runId,
      status: 'succeeded',
      ghlOpportunities: opportunities.length,
      notionPagesScanned: fundingPages.length,
      inboxPagesCreated,
      notionLinksWritten,
      safeMappings,
      mappingsApplied,
      alreadyAligned,
      blocked,
      durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();
    const runFailure = await db.from('funding_ghl_alignment_runs').update({
      status: 'failed',
      errors: [{ message }],
      duration_ms: Date.now() - startedAtMs,
      completed_at: completedAt,
    }).eq('id', runId);
    if (runFailure.error) console.error('Failed to record funding alignment failure', runFailure.error.message);
    if (lockAcquired) {
      const stateFailure = await db.from('funding_ghl_alignment_state').update({
        last_error: message,
        locked_until: null,
        locked_by: null,
        updated_at: completedAt,
      }).eq('alignment_key', ALIGNMENT_KEY).eq('locked_by', runId);
      if (stateFailure.error) console.error('Failed to release funding alignment lease', stateFailure.error.message);
    }
    throw error;
  }
}
