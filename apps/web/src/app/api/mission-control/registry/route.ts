import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { AGENTS, CATEGORIES } from '@/lib/agent-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

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
