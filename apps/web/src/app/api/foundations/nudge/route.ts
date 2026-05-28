import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * POST /api/foundations/nudge
 *
 * Logs a foundation nudge (outreach event). Updates funder_context_snapshot.most_recent_contact_at
 * if a matching context row exists, so the Today digest stops surfacing this funder as "cooling".
 *
 * Body: {
 *   funder_name: string,
 *   project_code?: string,
 *   nudge_type?: 'email' | 'slack' | 'phone' | 'in_person' | 'linkedin' | 'other',
 *   subject?: string,
 *   body?: string,
 *   outcome?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    funder_name?: string;
    project_code?: string;
    nudge_type?: string;
    subject?: string;
    body?: string;
    outcome?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const funder_name = typeof body.funder_name === 'string' ? body.funder_name.trim() : '';
  if (!funder_name) {
    return NextResponse.json({ error: 'funder_name required' }, { status: 400 });
  }

  const nudge_type = body.nudge_type ?? 'email';
  const ALLOWED = ['email', 'slack', 'phone', 'in_person', 'linkedin', 'other'];
  if (!ALLOWED.includes(nudge_type)) {
    return NextResponse.json({ error: `nudge_type must be one of ${ALLOWED.join(', ')}` }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  // Insert nudge log
  const { data: log, error: logErr } = await supabase
    .from('funder_nudge_log')
    .insert({
      funder_name,
      project_code: body.project_code ?? null,
      nudge_type,
      subject: body.subject ?? null,
      body: body.body ?? null,
      outcome: body.outcome ?? null,
      nudged_by: auth.user.email ?? 'admin',
      nudged_at: now,
    })
    .select('id, nudged_at')
    .single();

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  // Best-effort: update funder_context_snapshot.most_recent_contact_at for any
  // matching funder. funder_context_snapshot.funder_aliases may include variants.
  await supabase
    .from('funder_context_snapshot')
    .update({ most_recent_contact_at: now })
    .ilike('funder_name', funder_name);

  return NextResponse.json({
    ok: true,
    nudge_id: log.id,
    nudged_at: log.nudged_at,
    funder_name,
  });
}
