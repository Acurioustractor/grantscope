import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = getServiceSupabase();
  const { data, error } = await svc
    .from('agent_schedules')
    .select('*')
    .order('agent_id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ schedules: data });
}
