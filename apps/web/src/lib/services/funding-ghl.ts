import { createOpportunity, updateOpportunity, upsertContact } from '@/lib/ghl';
import { createOrUpdateFundingBrief } from '@/lib/services/funding-notion';
import {
  applicantRequirementsFromEvidence,
  applicantRouteBlockers,
  getFundingApplicantRegistry,
} from '@/lib/services/funding-applicant-registry';
import {
  buildFundingGhlCustomFields,
  getFundingGhlContractStatus,
} from '@/lib/services/funding-ghl-contract';
import { getServiceSupabase } from '@/lib/supabase';

export interface PursueFundingInput { projectCode: string; opportunityId: string; amountSought: number; applicantRouteId: string; relationshipOwnerId: string; funderContactEmail: string; nextAction: string; nextActionDue: string; grantscopeDecisionUrl: string; notionBriefUrl?: string | null; userId: string }
export function validatePursueFundingInput(input: Omit<PursueFundingInput, 'userId'>): string | null {
  if (!input.projectCode || !input.opportunityId) return 'projectCode and opportunityId are required';
  if (!Number.isFinite(input.amountSought) || input.amountSought <= 0) return 'amountSought must be greater than zero';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.applicantRouteId)) return 'applicantRouteId must be a canonical route id'; if (!input.relationshipOwnerId.trim()) return 'relationshipOwnerId must be a native GHL user id';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.funderContactEmail.trim())) return 'funderContactEmail must be a valid email address';
  if (!input.nextAction.trim()) return 'nextAction is required'; if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextActionDue)) return 'nextActionDue must be YYYY-MM-DD';
  if (!input.grantscopeDecisionUrl.startsWith('/org/')) return 'grantscopeDecisionUrl must be an internal org URL'; return null;
}
export async function pursueFundingInGhl(input: PursueFundingInput) {
  const db = getServiceSupabase();
  const [{ data: project, error: projectError }, { data: opportunity, error: opportunityError }, { data: opportunityRequirements, error: opportunityRequirementsError }, applicantRegistry, ghlContract] = await Promise.all([
    db.from('org_projects').select('id, org_profile_id, code, name, slug').eq('code', input.projectCode).eq('status', 'active').single(),
    db.from('act_grant_recommendations_current').select('opportunity_id, opportunity_name, funder_name, deadline, source_url, application_url').eq('project_code', input.projectCode).eq('opportunity_id', input.opportunityId).single(),
    db.from('alma_funding_opportunities').select('id, requires_abn, requires_deductible_gift_recipient, eligible_org_types').eq('id', input.opportunityId).single(),
    getFundingApplicantRegistry('act'),
    getFundingGhlContractStatus(),
  ]);
  if (projectError || !project) throw new Error(`Canonical project not found: ${projectError?.message || input.projectCode}`);
  if (opportunityError || !opportunity) throw new Error(`Opportunity is not evidence-safe apply_now: ${opportunityError?.message || input.opportunityId}`);
  if (opportunityRequirementsError || !opportunityRequirements) throw new Error(`Opportunity eligibility is unavailable: ${opportunityRequirementsError?.message || input.opportunityId}`);
  const applicantRoute = applicantRegistry?.routes.find(route => route.id === input.applicantRouteId && route.projectId === project.id);
  if (!applicantRoute) throw new Error('Applicant route is not registered for this project');
  const [profileResult, hybridResult] = await Promise.all([
    db.from('project_funding_profiles').select('completeness_status').eq('org_project_id', project.id).eq('is_current', true).single(),
    db.rpc('search_project_funding_hybrid', { p_org_project_id: project.id, p_match_count: 100 }),
  ]);
  if (profileResult.error || !profileResult.data) throw new Error(`Project funding profile is unavailable: ${profileResult.error?.message || project.code}`);
  const hybridMatch = !hybridResult.error && Array.isArray(hybridResult.data)
    ? hybridResult.data.find((row: { opportunity_id?: string }) => row.opportunity_id === input.opportunityId) as { eligibility_decision?: string } | undefined
    : undefined;
  const applicantBlockers = applicantRouteBlockers(applicantRoute, applicantRequirementsFromEvidence({
    requires_abn: opportunityRequirements.requires_abn,
    requires_dgr: opportunityRequirements.requires_deductible_gift_recipient,
    eligible_org_types: opportunityRequirements.eligible_org_types,
    profile_completeness: profileResult.data.completeness_status,
    eligibility_decision: hybridMatch?.eligibility_decision || 'needs_verification',
  }));
  if (applicantBlockers.length) throw new Error(`Applicant route is not eligible: ${applicantBlockers.join(' ')}`);
  if (!ghlContract.ready || !ghlContract.pipelineId || !ghlContract.initialStageId) {
    const gaps = [...ghlContract.missingStages, ...ghlContract.missingFields];
    throw new Error(`GHL funding contract is not ready${gaps.length ? `: ${gaps.join(', ')}` : ghlContract.error ? `: ${ghlContract.error}` : ''}`);
  }
  const relationshipOwner = ghlContract.users.find(user => user.id === input.relationshipOwnerId);
  if (!relationshipOwner) throw new Error('Selected relationship owner is not an active GHL user');
  const existingResult = await db.from('funding_ghl_handoffs').select('*').eq('project_code', input.projectCode).eq('opportunity_id', input.opportunityId).maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  const stageName = process.env.GHL_GRANTS_INITIAL_STAGE_NAME || 'Grant Opportunity Identified';
  const stageId = ghlContract.stageIds[stageName] || ghlContract.initialStageId;
  const canonicalOpportunityRef = `grantscope:alma_funding_opportunities:${input.opportunityId}`;
  const baseCustomFields = buildFundingGhlCustomFields(ghlContract.fieldIds, {
    projectCode: project.code,
    sourceRef: canonicalOpportunityRef,
    applicantEntity: applicantRoute.entity.name,
    decisionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://civicgraph.app'}${input.grantscopeDecisionUrl}`,
    nextAction: input.nextAction,
    nextActionDue: input.nextActionDue,
    notionUrl: input.notionBriefUrl,
  });
  const baseRow = { org_profile_id: project.org_profile_id, org_project_id: project.id, project_code: project.code, opportunity_id: input.opportunityId, source_system: 'grantscope', source_type: 'alma_funding_opportunities', source_id: input.opportunityId, canonical_opportunity_ref: canonicalOpportunityRef, funder_name: opportunity.funder_name || null, ghl_pipeline_id: ghlContract.pipelineId, ghl_stage_id: stageId, ghl_stage_name: stageName, ghl_assigned_to: relationshipOwner.id, amount_sought: input.amountSought, applicant_entity: applicantRoute.entity.name, applicant_entity_id: applicantRoute.entity.id, applicant_route_id: applicantRoute.id, relationship_owner: relationshipOwner.name, next_action: input.nextAction.trim(), next_action_due: input.nextActionDue, grantscope_decision_url: input.grantscopeDecisionUrl, notion_brief_url: input.notionBriefUrl || null, sync_status: 'pending', last_error: null, created_by: input.userId, updated_at: new Date().toISOString() };
  const handoff = await db.from('funding_ghl_handoffs').upsert(baseRow, { onConflict: 'project_code,opportunity_id' }).select('id, ghl_opportunity_id').single(); if (handoff.error) throw new Error(handoff.error.message);
  try {
    const contact = await upsertContact({ email: input.funderContactEmail.trim().toLowerCase(), companyName: opportunity.funder_name || undefined, tags: ['source:grantscope', 'role:funder', `project:${project.code.toLowerCase()}`], source: 'GrantScope Pursue' });
    const contactId = contact.id;
    const contactMirror = await db.from('funding_ghl_handoffs').update({ ghl_contact_id: contactId, updated_at: new Date().toISOString() }).eq('id', handoff.data.id);
    if (contactMirror.error) throw new Error(contactMirror.error.message);
    let ghlOpportunityId = handoff.data.ghl_opportunity_id as string | null; let operation: 'created' | 'updated';
    if (ghlOpportunityId) { await updateOpportunity(ghlOpportunityId, { pipelineStageId: stageId, status: 'open', monetaryValue: input.amountSought, contactId, assignedTo: relationshipOwner.id, customFields: baseCustomFields }); operation = 'updated'; }
    else { const response = await createOpportunity({ name: `[${project.code}] ${opportunity.opportunity_name}`, stage: stageName, monetaryValue: input.amountSought, pipelineId: ghlContract.pipelineId, pipelineStageId: stageId, contactId, assignedTo: relationshipOwner.id, customFields: baseCustomFields }); const payload = response && typeof response === 'object' ? response as Record<string, unknown> : {}; const nested = payload.opportunity && typeof payload.opportunity === 'object' ? payload.opportunity as Record<string, unknown> : payload; ghlOpportunityId = String(nested.id || nested._id || ''); if (!ghlOpportunityId) throw new Error('GHL did not return an opportunity id'); operation = 'created'; }
    const decision = await db.from('act_grant_recommendation_decisions').upsert({ project_code: project.code, opportunity_id: input.opportunityId, decision: 'pursuing', decision_scope: 'operational', decision_origin: 'grantscope_pursue', decided_by: input.userId, decided_at: new Date().toISOString(), notes: `${input.nextAction} — due ${input.nextActionDue}; owner ${relationshipOwner.name}; applicant ${applicantRoute.entity.name}; route ${applicantRoute.id}`, updated_at: new Date().toISOString() }, { onConflict: 'project_code,opportunity_id' }).select('id').single(); if (decision.error) throw new Error(decision.error.message);
    await db.from('funding_ghl_handoffs').update({ ghl_opportunity_id: ghlOpportunityId, decision_id: decision.data.id, sync_status: 'succeeded', last_error: null, updated_at: new Date().toISOString() }).eq('id', handoff.data.id);
    try {
      const notionBrief = await createOrUpdateFundingBrief(project.code, input.opportunityId);
      let notionWarning: string | undefined;
      if (notionBrief.pageUrl) {
        try {
          await updateOpportunity(ghlOpportunityId, {
            customFields: buildFundingGhlCustomFields(ghlContract.fieldIds, { notionUrl: notionBrief.pageUrl }),
          });
        } catch (error) {
          notionWarning = `Notion workspace created, but its GHL link needs retry: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      return { handoffId: handoff.data.id, ghlOpportunityId, operation, relationshipOwner, applicantRouteId: applicantRoute.id, applicantEntity: applicantRoute.entity.name, notionBrief, ...(notionWarning ? { notionWarning } : {}) };
    } catch (notionError) {
      return {
        handoffId: handoff.data.id,
        ghlOpportunityId,
        operation,
        relationshipOwner,
        applicantRouteId: applicantRoute.id,
        applicantEntity: applicantRoute.entity.name,
        notionBrief: null,
        notionWarning: notionError instanceof Error ? notionError.message : String(notionError),
      };
    }
  } catch (error) { await db.from('funding_ghl_handoffs').update({ sync_status: 'failed', last_error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() }).eq('id', handoff.data.id); throw error; }
}
