import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

const ALLOWED_TYPES = new Set([
  'open_grant',
  'invitation_only',
  'award',
  'policy_framework',
  'partnership',
  'tender',
  'placeholder',
  'unverified',
]);

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { opportunity_id?: unknown; opportunity_type?: unknown; verification_notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const oppId = typeof body.opportunity_id === 'string' ? body.opportunity_id : null;
  const oppType = typeof body.opportunity_type === 'string' ? body.opportunity_type : null;
  const notes = typeof body.verification_notes === 'string' ? body.verification_notes : null;

  if (!oppId || !oppType) {
    return NextResponse.json({ error: 'opportunity_id and opportunity_type required' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(oppType)) {
    return NextResponse.json({ error: `Invalid opportunity_type: ${oppType}` }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Classifying as open_grant → mark verified so MV picks it up immediately
  // (without waiting for next nightly URL-verifier run). Other types stay as placeholder.
  const verificationStatus =
    oppType === 'open_grant' ? 'verified' : oppType === 'unverified' ? 'unverified' : 'placeholder';

  const updates: Record<string, unknown> = {
    opportunity_type: oppType,
    verification_status: verificationStatus,
    updated_at: new Date().toISOString(),
  };
  if (verificationStatus === 'verified') {
    updates.verified_at = new Date().toISOString();
  }
  if (notes != null) {
    updates.verification_notes = `[${auth.user.email}] ${notes}`;
  }

  const { data, error } = await supabase
    .from('alma_funding_opportunities')
    .update(updates)
    .eq('id', oppId)
    .select('id, opportunity_type, verification_status, name')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ opportunity: data });
}
