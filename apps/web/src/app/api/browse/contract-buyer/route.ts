import { NextRequest, NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  const from = parseInt(req.nextUrl.searchParams.get('from') ?? '2020', 10);
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('contract_buyer_detail', { p_key: key, p_from_year: Number.isFinite(from) ? from : 2020 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'no record for that buyer' }, { status: 404 });
  const d = data as Record<string, unknown>;
  if (!d.buyer_name) return NextResponse.json({ error: 'no record for that buyer' }, { status: 404 });
  return NextResponse.json({
    name: d.buyer_name,
    abn: null,
    contract_count: d.contract_count,
    total_value: d.total_value,
    counterparties: ((d.suppliers ?? []) as { supplier: string; value: number | null; contracts: number }[]).map((s) => ({ name: s.supplier, value: s.value, contracts: s.contracts })),
    contracts: ((d.contracts ?? []) as { title: string | null; supplier: string | null; value: number | null; start: string | null; end: string | null }[]).map((c) => ({ title: c.title, counterparty: c.supplier, value: c.value, start: c.start, end: c.end })),
  });
}
