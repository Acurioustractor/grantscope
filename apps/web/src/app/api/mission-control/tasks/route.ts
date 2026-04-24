import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { AGENTS } from '@/lib/agent-registry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const agentId = searchParams.get('agent_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  const svc = getServiceSupabase();
  let query = svc
    .from('agent_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (agentId) query = query.eq('agent_id', agentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const { agent_id, priority, params } = body;

  if (!agent_id || !AGENTS[agent_id]) {
    return NextResponse.json({ error: `Unknown agent: ${agent_id}` }, { status: 400 });
  }

  const agent = AGENTS[agent_id];
  const svc = getServiceSupabase();

  const { data: existingTask, error: existingError } = await svc
    .from('agent_tasks')
    .select('id, agent_id, status, priority, created_at')
    .eq('agent_id', agent_id)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingTask) {
    return NextResponse.json({ task: existingTask, existing: true }, { status: 409 });
  }

  const { data, error } = await svc
    .from('agent_tasks')
    .insert({
      agent_id,
      priority: priority ?? agent.defaultPriority,
      params: params ?? {},
      created_by: user.email || 'user',
    })
    .select('id, agent_id, status, priority, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data, existing: false }, { status: 201 });
}
