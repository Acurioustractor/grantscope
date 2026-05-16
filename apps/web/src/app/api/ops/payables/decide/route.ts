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

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { invoice_id?: unknown; decision?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const invoiceId = typeof body.invoice_id === 'string' ? body.invoice_id : null;
  const decision = typeof body.decision === 'string' ? body.decision : null;
  const notes = typeof body.notes === 'string' ? body.notes : null;

  if (!invoiceId || !decision) {
    return NextResponse.json({ error: 'invoice_id and decision required' }, { status: 400 });
  }
  if (!ALLOWED_DECISIONS.has(decision)) {
    return NextResponse.json({ error: `Invalid decision: ${decision}` }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('act_payable_decisions')
    .upsert(
      {
        invoice_id: invoiceId,
        decision,
        notes,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'invoice_id' },
    )
    .select('invoice_id, decision, decided_at, notes')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `decision write failed: ${error?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ decision: data });
}
