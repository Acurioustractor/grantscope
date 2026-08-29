import { createOpportunity, findGrantPipeline, getPipelines, updateOpportunity, upsertContact } from '@/lib/ghl';
import { createOrUpdateFundingBrief } from '@/lib/services/funding-notion';
import { getServiceSupabase } from '@/lib/supabase';

export interface PursueFundingInput { projectCode: string; opportunityId: string; amountSought: number; applicantEntity: string; relationshipOwner: string; funderContactEmail: string; nextAction: string; nextActionDue: string; grantscopeDecisionUrl: string; notionBriefUrl?: string | null; userId: string }
type Pipeline = { id?: string; name?: string; stages?: Array<{ id?: string; name?: string }> };
function pipelinesFrom(payload: unknown): Pipeline[] { if (Array.isArray(payload)) return payload as Pipeline[]; if (payload && typeof payload === 'object' && Array.isArray((payload as { pipelines?: unknown }).pipelines)) return (payload as { pipelines: Pipeline[] }).pipelines; return []; }
export function validatePursueFundingInput(input: Omit<PursueFundingInput, 'userId'>): string | null {
  if (!input.projectCode || !input.opportunityId) return 'projectCode and opportunityId are required';
  if (!Number.isFinite(input.amountSought) || input.amountSought <= 0) return 'amountSought must be greater than zero';
  if (!input.applicantEntity.trim()) return 'applicantEntity is required'; if (!input.relationshipOwner.trim()) return 'relationshipOwner is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.funderContactEmail.trim())) return 'funderContactEmail must be a valid email address';
  if (!input.nextAction.trim()) return 'nextAction is required'; if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextActionDue)) return 'nextActionDue must be YYYY-MM-DD';
  if (!input.grantscopeDecisionUrl.startsWith('/org/')) return 'grantscopeDecisionUrl must be an internal org URL'; return null;
}
export async function pursueFundingInGhl(input: PursueFundingInput) {
  const db = getServiceSupabase();
  const [{ data: project, error: projectError }, { data: opportunity, error: opportunityError }] = await Promise.all([
    db.from('org_projects').select('id, org_profile_id, code, name, slug').eq('code', input.projectCode).eq('status', 'active').single(),
    db.from('act_grant_recommendations_current').select('opportunity_id, opportunity_name, funder_name, deadline').eq('project_code', input.projectCode).eq('opportunity_id', input.opportunityId).single(),
  ]);
  if (projectError || !project) throw new Error(`Canonical project not found: ${projectError?.message || input.projectCode}`);
  if (opportunityError || !opportunity) throw new Error(`Opportunity is not evidence-safe apply_now: ${opportunityError?.message || input.opportunityId}`);
  const existingResult = await db.from('funding_ghl_handoffs').select('*').eq('project_code', input.projectCode).eq('opportunity_id', input.opportunityId).maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  const pipeline = findGrantPipeline(pipelinesFrom(await getPipelines())); if (!pipeline?.id) throw new Error('Configured GHL grants pipeline was not found');
  const stageName = process.env.GHL_GRANTS_INITIAL_STAGE_NAME || 'Grant Opportunity Identified';
  const stage = pipeline.stages?.find(item => item.name?.toLowerCase() === stageName.toLowerCase()) || pipeline.stages?.[0]; if (!stage?.id) throw new Error('Configured GHL grants stage was not found');
  const baseRow = { org_profile_id: project.org_profile_id, org_project_id: project.id, project_code: project.code, opportunity_id: input.opportunityId, ghl_pipeline_id: pipeline.id, ghl_stage_id: stage.id, ghl_stage_name: stage.name || stageName, amount_sought: input.amountSought, applicant_entity: input.applicantEntity.trim(), relationship_owner: input.relationshipOwner.trim(), next_action: input.nextAction.trim(), next_action_due: input.nextActionDue, grantscope_decision_url: input.grantscopeDecisionUrl, notion_brief_url: input.notionBriefUrl || null, sync_status: 'pending', last_error: null, created_by: input.userId, updated_at: new Date().toISOString() };
  const handoff = await db.from('funding_ghl_handoffs').upsert(baseRow, { onConflict: 'project_code,opportunity_id' }).select('id, ghl_opportunity_id').single(); if (handoff.error) throw new Error(handoff.error.message);
  try {
    const contact = await upsertContact({ email: input.funderContactEmail.trim().toLowerCase(), companyName: opportunity.funder_name || undefined, tags: ['source:grantscope', 'role:funder', `project:${project.code}`], source: 'GrantScope Pursue' });
    const contactId = contact.id;
    let ghlOpportunityId = handoff.data.ghl_opportunity_id as string | null; let operation: 'created' | 'updated';
    if (ghlOpportunityId) { await updateOpportunity(ghlOpportunityId, { pipelineStageId: stage.id, status: 'open', monetaryValue: input.amountSought, contactId }); operation = 'updated'; }
    else { const response = await createOpportunity({ name: `[${project.code}] ${opportunity.opportunity_name}`, stage: stage.name || stageName, monetaryValue: input.amountSought, pipelineId: pipeline.id, pipelineStageId: stage.id, contactId }); const payload = response && typeof response === 'object' ? response as Record<string, unknown> : {}; const nested = payload.opportunity && typeof payload.opportunity === 'object' ? payload.opportunity as Record<string, unknown> : payload; ghlOpportunityId = String(nested.id || nested._id || ''); if (!ghlOpportunityId) throw new Error('GHL did not return an opportunity id'); operation = 'created'; }
    const decision = await db.from('act_grant_recommendation_decisions').upsert({ project_code: project.code, opportunity_id: input.opportunityId, decision: 'pursuing', decided_by: input.userId, decided_at: new Date().toISOString(), notes: `${input.nextAction} — due ${input.nextActionDue}; applicant ${input.applicantEntity}`, updated_at: new Date().toISOString() }, { onConflict: 'project_code,opportunity_id' }).select('id').single(); if (decision.error) throw new Error(decision.error.message);
    await db.from('funding_ghl_handoffs').update({ ghl_opportunity_id: ghlOpportunityId, decision_id: decision.data.id, sync_status: 'succeeded', last_error: null, updated_at: new Date().toISOString() }).eq('id', handoff.data.id);
    try {
      const notionBrief = await createOrUpdateFundingBrief(project.code, input.opportunityId);
      return { handoffId: handoff.data.id, ghlOpportunityId, operation, notionBrief };
    } catch (notionError) {
      return {
        handoffId: handoff.data.id,
        ghlOpportunityId,
        operation,
        notionBrief: null,
        notionWarning: notionError instanceof Error ? notionError.message : String(notionError),
      };
    }
  } catch (error) { await db.from('funding_ghl_handoffs').update({ sync_status: 'failed', last_error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() }).eq('id', handoff.data.id); throw error; }
}
