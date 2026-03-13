import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { GrantEngine } from '@grant-engine/engine';

export async function POST(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;

  const body = await request.json();
  const { sources, dryRun, geography, categories, keywords } = body;

  const supabase = getServiceSupabase();
  const engine = new GrantEngine({
    supabase,
    sources,
    dryRun: dryRun || false,
  });

  const result = await engine.discover({
    geography: geography || ['AU'],
    categories,
    keywords,
  });

  return NextResponse.json(result);
}
