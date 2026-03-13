import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { rerunProcurementShortlist } from '../_lib/shortlist-rerun';

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { shortlistId } = await request.json();
  if (!shortlistId || typeof shortlistId !== 'string') {
    return NextResponse.json({ error: 'shortlistId is required' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const result = await rerunProcurementShortlist(supabase, {
      shortlistId,
      userId: user.id,
      trigger: 'manual',
    });

    return NextResponse.json({
      suppliers: result.discovery.suppliers,
      summary: result.discovery.summary,
      filters_applied: result.discovery.appliedFilters,
      delta: result.delta,
      watch: result.watch,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to rerun saved brief';
    const status = message.includes('No procurement shortlist found.') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
