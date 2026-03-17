import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * POST /api/start/[intakeId]/claim
 *
 * Links an anonymous founder intake to the authenticated user's account.
 * Also imports matched grants/foundations into saved_grants/saved_foundations.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ intakeId: string }> },
) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { intakeId } = await params;
  const db = getServiceSupabase();

  // Claim the intake (only if unclaimed or already owned by this user)
  const { data: intake, error: claimError } = await db
    .from('founder_intakes')
    .update({ user_id: user.id })
    .eq('id', intakeId)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .select('id, matched_grants, matched_foundations')
    .single();

  if (claimError || !intake) {
    return NextResponse.json({ error: 'Intake not found or already claimed' }, { status: 404 });
  }

  // Import matched grants into saved_grants
  let grantsImported = 0;
  if (intake.matched_grants && Array.isArray(intake.matched_grants)) {
    for (const g of intake.matched_grants as Array<{ id?: string; name?: string }>) {
      if (!g.id) continue;
      const { error } = await db
        .from('saved_grants')
        .upsert(
          { user_id: user.id, grant_id: g.id, stage: 'discovered' },
          { onConflict: 'user_id,grant_id', ignoreDuplicates: true }
        );
      if (!error) grantsImported++;
    }
  }

  // Import matched foundations into saved_foundations
  let foundationsImported = 0;
  if (intake.matched_foundations && Array.isArray(intake.matched_foundations)) {
    for (const f of intake.matched_foundations as Array<{ id?: string; name?: string }>) {
      if (!f.id) continue;
      const { error } = await db
        .from('saved_foundations')
        .upsert(
          { user_id: user.id, foundation_id: f.id, stage: 'discovered' },
          { onConflict: 'user_id,foundation_id', ignoreDuplicates: true }
        );
      if (!error) foundationsImported++;
    }
  }

  return NextResponse.json({
    status: 'claimed',
    intake_id: intake.id,
    grants_imported: grantsImported,
    foundations_imported: foundationsImported,
  });
}
