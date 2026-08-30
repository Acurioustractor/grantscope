import { getServiceSupabase } from '@/lib/supabase';

const NOTION_API = 'https://api.notion.com/v1';
const ACT_FUNDING_DATABASE_ID = 'bfa94a53-aceb-47fa-b99b-63c52b8077b6';
const ACT_PROJECTS_DATABASE_ID = '177ebcf9-81cf-80dd-9514-f1ec32f3314c';

type NotionPage = { id?: string; url?: string };

function richText(content: string | null | undefined) {
  return content ? [{ type: 'text', text: { content: String(content).slice(0, 2000) } }] : [];
}

function heading(text: string) {
  return { object: 'block', type: 'heading_2', heading_2: { rich_text: richText(text) } };
}

function paragraph(text: string) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) } };
}

function todo(text: string) {
  return { object: 'block', type: 'to_do', to_do: { rich_text: richText(text), checked: false } };
}

function receivingEntity(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('butterfly')) return 'The Butterfly Movement Ltd';
  if (normalized.includes('curious tractor')) return 'A Curious Tractor Pty Ltd';
  if (normalized.includes('community') || normalized.includes('partner')) return 'Community / partner entity';
  if (normalized.includes('buyer') || normalized.includes('contract')) return 'Buyer / contracting entity';
  return 'TBC';
}

function ghlRecordUrl(opportunityId: string | null | undefined) {
  const template = process.env.GHL_OPPORTUNITY_URL_TEMPLATE;
  return opportunityId && template ? template.replace('{opportunityId}', opportunityId) : null;
}

export function buildFundingBriefBlocks(input: {
  projectName: string;
  opportunityName: string;
  funderName: string | null;
  applicantEntity: string;
  amountSought: number;
  nextAction: string;
  nextActionDue: string;
  sourceUrl: string | null;
  applicationUrl: string | null;
  eligibilityEvidence: Record<string, unknown> | null;
}) {
  const evidence = input.eligibilityEvidence || {};
  const unresolved = Array.isArray(evidence.unresolved_decisions)
    ? evidence.unresolved_decisions.map(String)
    : [];

  return [
    {
      object: 'block',
      type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji: '🌱' },
        rich_text: richText(
          `${input.projectName} is pursuing ${input.opportunityName} through ${input.applicantEntity}. The approved working ask is $${input.amountSought.toLocaleString('en-AU')}.`
        ),
      },
    },
    heading('Decision and applicant route'),
    paragraph(
      `Funder: ${input.funderName || 'Not recorded'}\nApplicant: ${input.applicantEntity}\nNext action: ${input.nextAction}\nDue: ${input.nextActionDue}`
    ),
    heading('Eligibility decision'),
    paragraph(
      `Profile completeness: ${String(evidence.profile_completeness || 'unknown')}\nRequires DGR: ${String(evidence.requires_dgr ?? 'unknown')}\nRequires ABN: ${String(evidence.requires_abn ?? 'unknown')}\nEligible organisation types: ${JSON.stringify(evidence.eligible_org_types || [])}`
    ),
    ...unresolved.map((item) => todo(`Resolve: ${item}`)),
    heading('Application evidence checklist'),
    todo('Confirm applicant authority and governing approvals'),
    todo('Confirm eligible costs and final budget'),
    todo('Attach outcomes, proof and community-benefit evidence'),
    todo('Confirm partner, auspice and endorsement requirements'),
    todo('Complete internal review before submission'),
    heading('Application questions'),
    paragraph(
      'Paste the official application questions here. Keep each answer linked to verified evidence and reusable answer-bank material.'
    ),
    heading('Budget draft'),
    paragraph(
      `Current approved ask: $${input.amountSought.toLocaleString('en-AU')}. Map every line to an eligible cost category before review.`
    ),
    heading('Working narrative'),
    paragraph('Draft the fundable project boundary, need, activities, outcomes, authority and sustainability case here.'),
    heading('Review comments'),
    paragraph('Record reviewer, decision, changes required and final sign-off here.'),
    ...(input.sourceUrl
      ? [{ object: 'block', type: 'bookmark', bookmark: { url: input.sourceUrl } }]
      : []),
    ...(input.applicationUrl && input.applicationUrl !== input.sourceUrl
      ? [{ object: 'block', type: 'bookmark', bookmark: { url: input.applicationUrl } }]
      : []),
  ];
}

async function notion(token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Notion ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function querySingleNotionPage(
  token: string,
  databaseId: string,
  filter: Record<string, unknown>,
  label: string
) {
  const response = await notion(token, 'POST', `/databases/${databaseId}/query`, {
    filter,
    page_size: 2,
  });
  const results = Array.isArray(response.results) ? (response.results as NotionPage[]) : [];
  if (results.length > 1) throw new Error(`Multiple Notion pages matched ${label}`);
  return results[0] || null;
}

async function findProjectPage(token: string, projectCode: string) {
  const databaseId = process.env.NOTION_PROJECTS_DB_ID || ACT_PROJECTS_DATABASE_ID;
  return querySingleNotionPage(
    token,
    databaseId,
    { property: 'ACT Project Code', rich_text: { equals: projectCode } },
    `ACT Project Code ${projectCode}`
  );
}

async function findFundingPage(token: string, databaseId: string, opportunityId: string) {
  const typedId = `alma_funding_opportunities:${opportunityId}`;
  return querySingleNotionPage(
    token,
    databaseId,
    {
      or: [
        { property: 'GrantScope ID', rich_text: { equals: typedId } },
        { property: 'GrantScope ID', rich_text: { equals: opportunityId } },
      ],
    },
    `GrantScope opportunity ${typedId}`
  );
}

export async function createOrUpdateFundingBrief(projectCode: string, opportunityId: string) {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_FUNDERS_OPPORTUNITIES_DB_ID || ACT_FUNDING_DATABASE_ID;
  if (!token) throw new Error('NOTION_TOKEN is required');

  const db = getServiceSupabase();
  const { data: handoff, error: handoffError } = await db
    .from('funding_ghl_handoffs')
    .select(
      '*, project:org_projects(name), opportunity:alma_funding_opportunities(name, funder_name, source_url, application_url, eligibility_criteria, deadline)'
    )
    .eq('project_code', projectCode)
    .eq('opportunity_id', opportunityId)
    .eq('sync_status', 'succeeded')
    .single();
  if (handoffError || !handoff) {
    throw new Error(`A successful explicit Pursue handoff is required: ${handoffError?.message || 'not found'}`);
  }

  const { data: decision, error: decisionError } = await db
    .from('act_grant_recommendation_decisions')
    .select('id, decision, decision_scope, notion_page_id')
    .eq('project_code', projectCode)
    .eq('opportunity_id', opportunityId)
    .single();
  if (
    decisionError ||
    !decision ||
    decision.decision_scope !== 'operational' ||
    !['pursuing', 'applied', 'submitted', 'won'].includes(decision.decision)
  ) {
    throw new Error('A current pursue decision is required');
  }

  const project = Array.isArray(handoff.project) ? handoff.project[0] : handoff.project;
  const opportunity = Array.isArray(handoff.opportunity) ? handoff.opportunity[0] : handoff.opportunity;
  const notionProject = await findProjectPage(token, projectCode);
  if (!notionProject?.id) {
    throw new Error(`Notion project is missing ACT Project Code ${projectCode}`);
  }

  const hybrid = await db.rpc('search_project_funding_hybrid', {
    p_org_project_id: handoff.org_project_id,
    p_match_count: 100,
  });
  const hybridRow =
    !hybrid.error && Array.isArray(hybrid.data)
      ? (hybrid.data.find(
          (row: { opportunity_id?: string }) => row.opportunity_id === opportunityId
        ) as { eligibility_evidence?: Record<string, unknown> } | undefined)
      : undefined;

  const now = new Date().toISOString();
  const title = `[${projectCode}] ${opportunity?.name || 'Funding application'}`;
  const properties: Record<string, unknown> = {
    'Funder / Opportunity': { title: richText(title) },
    'Decision state': { select: { name: 'Work' } },
    'Canonical status': { select: { name: 'Active' } },
    Stage: { select: { name: 'Preparing application' } },
    Priority: { select: { name: 'Now' } },
    'Money door': { select: { name: 'Grant / philanthropy' } },
    Instrument: { select: { name: 'Grant' } },
    Grant: { checkbox: true },
    'Artifact status': { select: { name: 'Draft' } },
    'Evidence status': { select: { name: 'Partial' } },
    Eligibility: { select: { name: 'TBC' } },
    'GHL pipeline': { select: { name: 'Grants' } },
    'GHL stage': { rich_text: richText(handoff.ghl_stage_name) },
    'GHL Opportunity ID': { rich_text: richText(handoff.ghl_opportunity_id) },
    'GrantScope ID': { rich_text: richText(`alma_funding_opportunities:${opportunityId}`) },
    'Supabase ID': { rich_text: richText(`funding_ghl_handoffs:${handoff.id}`) },
    'Amount (AUD)': { number: Number(handoff.amount_sought) },
    'Receiving entity': { select: { name: receivingEntity(handoff.applicant_entity) } },
    'Next action': { rich_text: richText(handoff.next_action) },
    'Next action due': { date: { start: handoff.next_action_due } },
    'Last GHL sync': { date: { start: now } },
    'Last reviewed': { date: { start: now } },
    'Source note': {
      rich_text: richText(`Explicit Pursue decision in GrantScope: ${handoff.grantscope_decision_url}`),
    },
    '🗂️ Projects': { relation: [{ id: notionProject.id }] },
  };
  if (opportunity?.deadline) properties['Due date'] = { date: { start: opportunity.deadline } };
  if (opportunity?.source_url) properties['Source URL'] = { url: opportunity.source_url };
  if (opportunity?.application_url) properties['Application URL'] = { url: opportunity.application_url };
  const recordUrl = ghlRecordUrl(handoff.ghl_opportunity_id);
  if (recordUrl) properties['GHL record URL'] = { url: recordUrl };

  const existingPage = await findFundingPage(token, databaseId, opportunityId);
  if (existingPage?.id) {
    await notion(token, 'PATCH', `/pages/${existingPage.id}`, { properties });
    const pageUrl =
      existingPage.url || `https://www.notion.so/${existingPage.id.replace(/-/g, '')}`;
    await Promise.all([
      db
        .from('act_grant_recommendation_decisions')
        .update({ notion_page_id: existingPage.id, updated_at: now })
        .eq('id', decision.id),
      db
        .from('funding_ghl_handoffs')
        .update({ notion_brief_url: pageUrl, updated_at: now })
        .eq('id', handoff.id),
    ]);
    return { pageId: existingPage.id, pageUrl, operation: 'updated' as const };
  }

  if (decision.notion_page_id) {
    properties['Legacy record URL'] = {
      url: `https://www.notion.so/${String(decision.notion_page_id).replace(/-/g, '')}`,
    };
  }
  const page = await notion(token, 'POST', '/pages', {
    parent: { database_id: databaseId },
    properties,
    children: buildFundingBriefBlocks({
      projectName: project?.name || projectCode,
      opportunityName: opportunity?.name || title,
      funderName: opportunity?.funder_name || null,
      applicantEntity: handoff.applicant_entity,
      amountSought: Number(handoff.amount_sought),
      nextAction: handoff.next_action,
      nextActionDue: handoff.next_action_due,
      sourceUrl: opportunity?.source_url || null,
      applicationUrl: opportunity?.application_url || null,
      eligibilityEvidence: hybridRow?.eligibility_evidence || opportunity?.eligibility_criteria || null,
    }),
  });
  const pageId = String(page.id || '');
  const pageUrl =
    typeof page.url === 'string' ? page.url : `https://www.notion.so/${pageId.replace(/-/g, '')}`;
  if (!pageId) throw new Error('Notion did not return a page id');

  await Promise.all([
    db
      .from('act_grant_recommendation_decisions')
      .update({ notion_page_id: pageId, updated_at: now })
      .eq('id', decision.id),
    db
      .from('funding_ghl_handoffs')
      .update({ notion_brief_url: pageUrl, updated_at: now })
      .eq('id', handoff.id),
  ]);
  return { pageId, pageUrl, operation: 'created' as const };
}
