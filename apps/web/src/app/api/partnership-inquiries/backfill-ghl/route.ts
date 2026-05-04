import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase';
import { pushPartnershipToGHL } from '@/lib/services/partnership-ghl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type InquiryRow = {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_org: string | null;
  contact_phone: string | null;
  contact_role: string | null;
  partnership_types: string[] | null;
  partnership_other: string | null;
  message: string;
  budget_band: string | null;
  timeline: string | null;
  source_artefact: string | null;
};

/**
 * GET /api/partnership-inquiries/backfill-ghl
 *  → list rows that haven't been synced yet (admin-only, dry-run preview)
 *
 * POST /api/partnership-inquiries/backfill-ghl
 *  Body: { id?: string, limit?: number, dry_run?: boolean }
 *  → re-pushes pending inquiries to GHL. If `id` is supplied, only that one;
 *    otherwise all rows where ghl_synced_at IS NULL up to `limit` (default 50).
 *    `dry_run = true` returns the candidate list without calling GHL.
 *
 * Admin-only via isAdminEmail.
 */
async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const db = getServiceSupabase();
  const { data, error } = await db
    .from('partnership_inquiries')
    .select('id, submitted_at, contact_email, contact_name, source_artefact, partnership_types, ghl_synced_at')
    .is('ghl_synced_at', null)
    .order('submitted_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pending: data ?? [], count: data?.length ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const targetId = typeof body.id === 'string' ? body.id : null;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 200) : 50;
  const dryRun = body.dry_run === true;

  const db = getServiceSupabase();

  let query = db
    .from('partnership_inquiries')
    .select('id, contact_name, contact_email, contact_org, contact_phone, contact_role, partnership_types, partnership_other, message, budget_band, timeline, source_artefact')
    .order('submitted_at', { ascending: true })
    .limit(limit);

  if (targetId) {
    query = query.eq('id', targetId);
  } else {
    query = query.is('ghl_synced_at', null);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const candidates = (rows ?? []) as InquiryRow[];

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      would_process: candidates.length,
      candidates: candidates.map(r => ({ id: r.id, email: r.contact_email, source: r.source_artefact })),
    });
  }

  const results: Array<{ id: string; ok: boolean; reason?: string; status?: number; contact_id?: string }> = [];

  for (const row of candidates) {
    const pushed = await pushPartnershipToGHL({
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactOrg: row.contact_org,
      contactPhone: row.contact_phone,
      contactRole: row.contact_role,
      partnershipTypes: row.partnership_types ?? [],
      partnershipOther: row.partnership_other,
      message: row.message,
      budgetBand: row.budget_band,
      timeline: row.timeline,
      sourceArtefact: row.source_artefact,
      inquiryId: row.id,
    });

    if (pushed.ok) {
      await db.from('partnership_inquiries').update({
        ghl_synced_at: new Date().toISOString(),
        ghl_contact_id: pushed.contactId,
      }).eq('id', row.id);
      results.push({ id: row.id, ok: true, contact_id: pushed.contactId });
    } else {
      results.push({ id: row.id, ok: false, reason: pushed.reason, status: pushed.status });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed = results.length - succeeded;
  return NextResponse.json({
    processed: results.length,
    succeeded,
    failed,
    results,
  });
}
