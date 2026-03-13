import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ grantId: string }> }
) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;

  const { grantId } = await params;
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('grant_opportunities')
    .select(
      'id, name, provider, program, program_type, amount_min, amount_max, closes_at, url, description, categories, focus_areas, target_recipients, status, eligibility_criteria, assessment_criteria, requirements_summary, grant_type, foundation_id, created_at, last_verified_at'
    )
    .eq('id', grantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
