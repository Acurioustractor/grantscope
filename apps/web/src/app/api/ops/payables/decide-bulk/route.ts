import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

const ALLOWED_DECISIONS = new Set([
  'undecided',
  'pay_now',
  'scheduled',
  'chase_supplier',
  'dispute',
  'write_off',
  'paid',
]);

const MAX_BULK = 500;

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { invoice_ids?: unknown; decision?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const invoiceIds = Array.isArray(body.invoice_ids)
    ? body.invoice_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const decision = typeof body.decision === 'string' ? body.decision : null;
  const notes = typeof body.notes === 'string' ? body.notes : null;

  if (invoiceIds.length === 0 || !decision) {
    return NextResponse.json({ error: 'invoice_ids (array) and decision required' }, { status: 400 });
  }
  if (invoiceIds.length > MAX_BULK) {
    return NextResponse.json(
      { error: `bulk size ${invoiceIds.length} exceeds limit of ${MAX_BULK}` },
      { status: 400 },
    );
  }
  if (!ALLOWED_DECISIONS.has(decision)) {
    return NextResponse.json({ error: `Invalid decision: ${decision}` }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const nowIso = new Date().toISOString();
  const rows = invoiceIds.map((id) => ({
    invoice_id: id,
    decision,
    notes,
    decided_at: nowIso,
    updated_at: nowIso,
  }));

  const { data, error } = await supabase
    .from('act_payable_decisions')
    .upsert(rows, { onConflict: 'invoice_id' })
    .select('invoice_id, decision, decided_at');

  if (error) {
    return NextResponse.json(
      { error: `bulk decision write failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    decided: data?.length ?? 0,
    decision,
    invoice_ids: invoiceIds,
  });
}
