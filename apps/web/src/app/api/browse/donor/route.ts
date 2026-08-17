import { NextRequest, NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  const from = req.nextUrl.searchParams.get('from') || '2014-15';
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('donation_donor_detail', { p_key: key, p_from_fy: from });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'no record for that donor' }, { status: 404 });
  const d = data as Record<string, unknown>;
  if (!d.donor_name) return NextResponse.json({ error: 'no record for that donor' }, { status: 404 });
  return NextResponse.json({
    name: d.donor_name,
    abn: d.donor_abn,
    contract_count: d.donation_count,
    total_value: d.total_dollars,
    counterparties: ((d.recipients ?? []) as { recipient: string; dollars: number | null; donations: number }[]).map((r) => ({ name: r.recipient, value: r.dollars, contracts: r.donations })),
    contracts: ((d.donations ?? []) as { recipient: string | null; amount: number | null; year: string | null }[]).map((g) => ({ title: g.recipient, counterparty: g.year, value: g.amount, start: null, end: null })),
  });
}
