import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { AGENTS, CATEGORIES } from '@/lib/agent-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agents = Object.entries(AGENTS).map(([id, def]) => ({
    id,
    displayName: def.displayName,
    category: def.category,
    defaultPriority: def.defaultPriority,
    timeoutMs: def.timeoutMs,
    dependencies: def.dependencies,
  }));

  return NextResponse.json({ agents, categories: CATEGORIES });
}
