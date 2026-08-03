import { getServiceSupabase } from '@/lib/supabase';

const NOTION_API = 'https://api.notion.com/v1';
function richText(content: string | null | undefined) { return content ? [{ type: 'text', text: { content: String(content).slice(0, 2000) } }] : []; }
function heading(text: string) { return { object: 'block', type: 'heading_2', heading_2: { rich_text: richText(text) } }; }
function paragraph(text: string) { return { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) } }; }
function todo(text: string) { return { object: 'block', type: 'to_do', to_do: { rich_text: richText(text), checked: false } }; }

export function buildFundingBriefBlocks(input: { projectName: string; opportunityName: string; funderName: string | null; applicantEntity: string; amountSought: number; nextAction: string; nextActionDue: string; sourceUrl: string | null; applicationUrl: string | null; eligibilityEvidence: Record<string, unknown> | null }) {
  const evidence = input.eligibilityEvidence || {};
  const unresolved = Array.isArray(evidence.unresolved_decisions) ? evidence.unresolved_decisions.map(String) : [];
  return [
    { object: 'block', type: 'callout', callout: { icon: { type: 'emoji', emoji: '🌱' }, rich_text: richText(`${input.projectName} is pursuing ${input.opportunityName} through ${input.applicantEntity}. The approved working ask is $${input.amountSought.toLocaleString('en-AU')}.`) } },
    heading('Decision and applicant route'), paragraph(`Funder: ${input.funderName || 'Not recorded'}\nApplicant: ${input.applicantEntity}\nNext action: ${input.nextAction}\nDue: ${input.nextActionDue}`),
    heading('Eligibility decision'), paragraph(`Profile completeness: ${String(evidence.profile_completeness || 'unknown')}\nRequires DGR: ${String(evidence.requires_dgr ?? 'unknown')}\nRequires ABN: ${String(evidence.requires_abn ?? 'unknown')}\nEligible organisation types: ${JSON.stringify(evidence.eligible_org_types || [])}`),
    ...unresolved.map(item => todo(`Resolve: ${item}`)),
    heading('Application evidence checklist'), todo('Confirm applicant authority and governing approvals'), todo('Confirm eligible costs and final budget'), todo('Attach outcomes, proof and community-benefit evidence'), todo('Confirm partner, auspice and endorsement requirements'), todo('Complete internal review before submission'),
    heading('Application questions'), paragraph('Paste the official application questions here. Keep each answer linked to verified evidence and reusable answer-bank material.'),
    heading('Budget draft'), paragraph(`Current approved ask: $${input.amountSought.toLocaleString('en-AU')}. Map every line to an eligible cost category before review.`),
    heading('Working narrative'), paragraph('Draft the fundable project boundary, need, activities, outcomes, authority and sustainability case here.'),
    heading('Review comments'), paragraph('Record reviewer, decision, changes required and final sign-off here.'),
    ...(input.sourceUrl ? [{ object: 'block', type: 'bookmark', bookmark: { url: input.sourceUrl } }] : []),
    ...(input.applicationUrl && input.applicationUrl !== input.sourceUrl ? [{ object: 'block', type: 'bookmark', bookmark: { url: input.applicationUrl } }] : []),
  ];
}

async function notion(token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${NOTION_API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Notion ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function createOrUpdateFundingBrief(projectCode: string, opportunityId: string) {
  const token = process.env.NOTION_TOKEN; const databaseId = process.env.NOTION_OPPORTUNITIES_DB_ID;
  if (!token || !databaseId) throw new Error('NOTION_TOKEN and NOTION_OPPORTUNITIES_DB_ID are required');
  const db = getServiceSupabase();
  const { data: handoff, error: handoffError } = await db.from('funding_ghl_handoffs').select('*, project:org_projects(name), opportunity:alma_funding_opportunities(name, funder_name, source_url, application_url, eligibility_criteria)').eq('project_code', projectCode).eq('opportunity_id', opportunityId).eq('sync_status', 'succeeded').single();
  if (handoffError || !handoff) throw new Error(`A successful explicit Pursue handoff is required: ${handoffError?.message || 'not found'}`);
  const { data: decision, error: decisionError } = await db.from('act_grant_recommendation_decisions').select('id, decision, notion_page_id').eq('project_code', projectCode).eq('opportunity_id', opportunityId).single();
  if (decisionError || !decision || !['pursuing', 'applied', 'submitted', 'won'].includes(decision.decision)) throw new Error('A current pursue decision is required');
  const project = Array.isArray(handoff.project) ? handoff.project[0] : handoff.project;
  const opportunity = Array.isArray(handoff.opportunity) ? handoff.opportunity[0] : handoff.opportunity;
  const hybrid = await db.rpc('search_project_funding_hybrid', { p_org_project_id: handoff.org_project_id, p_match_count: 100 });
  const hybridRow = !hybrid.error && Array.isArray(hybrid.data)
    ? hybrid.data.find((row: { opportunity_id?: string }) => row.opportunity_id === opportunityId) as { eligibility_evidence?: Record<string, unknown> } | undefined
    : undefined;
  const title = `[${projectCode}] ${opportunity?.name || 'Funding application'}`;
  const properties: Record<string, unknown> = { Name: { title: richText(title) }, Pipeline: { select: { name: 'Grants' } }, Project: { multi_select: [{ name: projectCode }] }, Stage: { select: { name: 'Scoping' } }, Status: { select: { name: 'open' } }, 'Org Name': { rich_text: richText(opportunity?.funder_name || '') }, Value: { number: Number(handoff.amount_sought) }, 'Last Synced': { date: { start: new Date().toISOString() } } };
  if (decision.notion_page_id) { await notion(token, 'PATCH', `/pages/${decision.notion_page_id}`, { properties }); return { pageId: decision.notion_page_id, pageUrl: handoff.notion_brief_url, operation: 'updated' as const }; }
  const page = await notion(token, 'POST', '/pages', { parent: { database_id: databaseId }, properties, children: buildFundingBriefBlocks({ projectName: project?.name || projectCode, opportunityName: opportunity?.name || title, funderName: opportunity?.funder_name || null, applicantEntity: handoff.applicant_entity, amountSought: Number(handoff.amount_sought), nextAction: handoff.next_action, nextActionDue: handoff.next_action_due, sourceUrl: opportunity?.source_url || null, applicationUrl: opportunity?.application_url || null, eligibilityEvidence: hybridRow?.eligibility_evidence || opportunity?.eligibility_criteria || null }) });
  const pageId = String(page.id || ''); const pageUrl = typeof page.url === 'string' ? page.url : `https://www.notion.so/${pageId.replace(/-/g, '')}`; if (!pageId) throw new Error('Notion did not return a page id');
  await Promise.all([db.from('act_grant_recommendation_decisions').update({ notion_page_id: pageId, updated_at: new Date().toISOString() }).eq('id', decision.id), db.from('funding_ghl_handoffs').update({ notion_brief_url: pageUrl, updated_at: new Date().toISOString() }).eq('id', handoff.id)]);
  return { pageId, pageUrl, operation: 'created' as const };
}
