import { NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { buildYouthJusticeReport } from '@grant-engine/reports/money-flow';

export async function GET(request: Request) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '2025', 10);

  try {
    const supabase = getServiceSupabase();
    const report = await buildYouthJusticeReport(supabase, year);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
