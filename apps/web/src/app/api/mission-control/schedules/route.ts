import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const svc = getServiceSupabase();
  const { data, error } = await svc
    .from('agent_schedules')
    .select('*')
    .order('agent_id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ schedules: data });
}
