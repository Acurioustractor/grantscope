import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();

  // Only allow updating safe fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
  if (typeof body.interval_hours === 'number' && body.interval_hours > 0) updates.interval_hours = body.interval_hours;
  if (typeof body.priority === 'number' && body.priority >= 1 && body.priority <= 10) updates.priority = body.priority;
  if (body.params && typeof body.params === 'object') updates.params = body.params;

  const svc = getServiceSupabase();
  const { data, error } = await svc
    .from('agent_schedules')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ schedule: data });
}
