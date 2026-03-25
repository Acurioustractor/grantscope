import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { createGovernedProofService } from '@/lib/governed-proof/service';

/**
 * PATCH /api/outcomes/:id/review — Review an outcome submission.
 * Actions: validate, reject, request_changes
 *
 * On validation, creates/updates a Governed Proof bundle and attaches the submission.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const { action, reviewer_notes } = body;

  if (!action || !['validate', 'reject', 'request_changes'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be one of: validate, reject, request_changes' },
      { status: 400 },
    );
  }

  const db = getServiceSupabase();

  // Fetch the submission
  const { data: submission, error: fetchErr } = await db
    .from('outcome_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const statusMap: Record<string, string> = {
    validate: 'validated',
    reject: 'rejected',
    request_changes: 'under_review',
  };

  // Update submission status
  const updates: Record<string, unknown> = {
    status: statusMap[action],
    reviewer_notes: reviewer_notes || submission.reviewer_notes,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };

  // On validation, create/update a Governed Proof bundle
  let bundleId: string | null = submission.proof_bundle_id;

  if (action === 'validate') {
    try {
      const proofService = createGovernedProofService();

      // Bundle key: org-program-period
      const orgSlug = (submission.org_name || 'unknown')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const programSlug = (submission.program_name || 'unknown')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const bundleKey = `outcome:${orgSlug}:${programSlug}:${submission.reporting_period}`;

      // Build evidence context from the outcomes
      const outcomes = (submission.outcomes || []) as Array<{
        metric: string;
        value: number;
        unit: string;
        description?: string;
      }>;

      const bundle = await proofService.upsertBundle({
        bundleKey,
        subjectType: 'organization',
        subjectId: submission.gs_entity_id || submission.org_abn || submission.org_name,
        ownerSystem: 'GS',
        lifecycleStatus: 'validated',
        reviewStatus: 'approved',
        promotionStatus: 'partner',
        evidenceConfidence: 0.7,
        evidenceContext: {
          source: 'outcome_submission',
          submission_id: id,
          program_name: submission.program_name,
          reporting_period: submission.reporting_period,
          outcomes,
          narrative: submission.narrative,
          methodology: submission.methodology,
          validated_by: user.id,
          validated_at: new Date().toISOString(),
        },
      });

      bundleId = bundle.id;

      // Attach the submission as a bundle record
      await proofService.attachBundleRecords([{
        bundleId: bundle.id,
        recordSystem: 'GS',
        recordType: 'outcome_submission',
        recordId: id,
        linkRole: 'evidence',
        confidenceScore: 0.7,
        provenancePayload: {
          org_name: submission.org_name,
          org_abn: submission.org_abn,
          program_name: submission.program_name,
          reporting_period: submission.reporting_period,
          outcome_count: outcomes.length,
        },
      }]);

      updates.proof_bundle_id = bundleId;
    } catch (err) {
      console.error('Failed to create proof bundle:', err);
      // Don't fail the review — just note the error
      updates.reviewer_notes = `${reviewer_notes || ''}\n[System: proof bundle creation failed: ${err instanceof Error ? err.message : String(err)}]`.trim();
    }
  }

  const { data: updated, error: updateErr } = await db
    .from('outcome_submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    submission: updated,
    proof_bundle_id: bundleId,
    action,
  });
}

/**
 * GET /api/outcomes/:id/review — Get submission details for review.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const db = getServiceSupabase();
  const { data: submission, error } = await db
    .from('outcome_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // If entity resolved, fetch entity details
  let entity = null;
  if (submission.gs_entity_id) {
    const { data } = await db
      .from('gs_entities')
      .select('gs_id, canonical_name, abn, entity_type, state, postcode, is_community_controlled')
      .eq('gs_id', submission.gs_entity_id)
      .single();
    entity = data;
  }

  // If has proof bundle, fetch it
  let bundle = null;
  if (submission.proof_bundle_id) {
    const { data } = await db
      .from('governed_proof_bundles')
      .select('*')
      .eq('id', submission.proof_bundle_id)
      .single();
    bundle = data;
  }

  return NextResponse.json({ submission, entity, bundle });
}
