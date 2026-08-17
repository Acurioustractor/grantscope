import { NextRequest, NextResponse } from 'next/server';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  const from = parseInt(req.nextUrl.searchParams.get('from') ?? '2020', 10);
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('contract_supplier_detail', { p_key: key, p_from_year: Number.isFinite(from) ? from : 2020 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'no record for that supplier' }, { status: 404 });
  const d = data as Record<string, unknown>;
  if (!d.supplier_name) return NextResponse.json({ error: 'no record for that supplier' }, { status: 404 });
  return NextResponse.json({
    name: d.supplier_name,
    abn: d.supplier_abn,
    contract_count: d.contract_count,
    total_value: d.total_value,
    counterparties: ((d.buyers ?? []) as { buyer: string; value: number | null; contracts: number }[]).map((b) => ({ name: b.buyer, value: b.value, contracts: b.contracts })),
    contracts: ((d.contracts ?? []) as { title: string | null; buyer: string | null; value: number | null; start: string | null; end: string | null }[]).map((c) => ({ title: c.title, counterparty: c.buyer, value: c.value, start: c.start, end: c.end })),
  });
}
