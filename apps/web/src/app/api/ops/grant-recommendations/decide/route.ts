import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

const ALLOWED_DECISIONS = new Set([
  'pursuing',
  'watching',
  'passed',
  'applied',
  'submitted',
  'won',
  'lost',
]);

// Decisions that should produce a /tracker Kanban entry.
const TRACKER_DECISIONS = new Set(['pursuing', 'applied', 'submitted']);

// Map ACT decision states → saved_grants stage (the /tracker vocabulary).
function trackerStageFor(decision: string): string {
  if (decision === 'applied') return 'submitted';
  if (decision === 'submitted') return 'submitted';
  return 'pursuing';
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { project_code?: unknown; opportunity_id?: unknown; decision?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const projectCode = typeof body.project_code === 'string' ? body.project_code : null;
  const opportunityId = typeof body.opportunity_id === 'string' ? body.opportunity_id : null;
  const decision = typeof body.decision === 'string' ? body.decision : null;
  const notes = typeof body.notes === 'string' ? body.notes : null;

  if (!projectCode || !opportunityId || !decision) {
    return NextResponse.json(
      { error: 'project_code, opportunity_id, decision required' },
      { status: 400 }
    );
  }
  if (!ALLOWED_DECISIONS.has(decision)) {
    return NextResponse.json({ error: `Invalid decision: ${decision}` }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Look up existing decision (might already have a mirrored grant_opportunity_id).
  const { data: existing } = await supabase
    .from('act_grant_recommendation_decisions')
    .select('grant_opportunity_id')
    .eq('project_code', projectCode)
    .eq('opportunity_id', opportunityId)
    .maybeSingle();

  let grantOpportunityId: string | null = existing?.grant_opportunity_id ?? null;

  // If this decision should land in /tracker and we don't yet have a mirror,
  // copy the alma row into grant_opportunities so saved_grants can reference it.
  if (TRACKER_DECISIONS.has(decision) && !grantOpportunityId) {
    const { data: alma, error: almaErr } = await supabase
      .from('alma_funding_opportunities')
      .select(
        'id, name, description, funder_name, min_grant_amount, max_grant_amount, deadline, source_url, focus_areas, jurisdictions'
      )
      .eq('id', opportunityId)
      .single();

    if (almaErr || !alma) {
      return NextResponse.json(
        { error: `alma_funding_opportunities lookup failed: ${almaErr?.message ?? 'not found'}` },
        { status: 500 }
      );
    }

    const deadlineDate = alma.deadline ? new Date(alma.deadline).toISOString().slice(0, 10) : null;

    const { data: mirrored, error: mirrorErr } = await supabase
      .from('grant_opportunities')
      .insert({
        name: alma.name,
        description: alma.description,
        amount_min: alma.min_grant_amount,
        amount_max: alma.max_grant_amount,
        deadline: deadlineDate,
        closes_at: deadlineDate,
        source: 'civicscope-act-recommendation',
        provider: alma.funder_name,
        url: alma.source_url,
        focus_areas: alma.focus_areas,
        aligned_projects: [projectCode],
        application_status: 'open',
        discovered_by: 'act-grant-recommendations',
        metadata: { alma_opportunity_id: alma.id, project_code: projectCode },
      })
      .select('id')
      .single();

    if (mirrorErr || !mirrored) {
      return NextResponse.json(
        { error: `grant_opportunities mirror failed: ${mirrorErr?.message ?? 'no id returned'}` },
        { status: 500 }
      );
    }
    grantOpportunityId = mirrored.id;
  }

  // Upsert the decision (always — every Apply/Watch/Pass click writes here).
  const { data: decisionRow, error: decisionErr } = await supabase
    .from('act_grant_recommendation_decisions')
    .upsert(
      {
        project_code: projectCode,
        opportunity_id: opportunityId,
        decision,
        decision_scope: 'operational',
        decision_origin: 'manual_admin',
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
        notes,
        grant_opportunity_id: grantOpportunityId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_code,opportunity_id' }
    )
    .select('project_code, opportunity_id, decision, decided_at, notes, grant_opportunity_id')
    .single();

  if (decisionErr) {
    return NextResponse.json({ error: decisionErr.message }, { status: 500 });
  }

  // Upsert into the admin's /tracker if this decision should be tracked.
  let trackerSynced = false;
  if (TRACKER_DECISIONS.has(decision) && grantOpportunityId) {
    const { error: savedErr } = await supabase
      .from('saved_grants')
      .upsert(
        {
          user_id: auth.user.id,
          grant_id: grantOpportunityId,
          stage: trackerStageFor(decision),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,grant_id' }
      );
    if (savedErr) {
      // Don't fail the whole decision — the bridge row is already written.
      // The admin can re-Apply later to sync the tracker entry.
      console.error('saved_grants upsert failed', savedErr);
    } else {
      trackerSynced = true;
    }
  }

  return NextResponse.json({
    decision: decisionRow,
    tracker_synced: trackerSynced,
    grant_opportunity_id: grantOpportunityId,
  });
}
