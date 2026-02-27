import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { GrantEngine } from '@grantscope/engine';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.API_SECRET_KEY;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
