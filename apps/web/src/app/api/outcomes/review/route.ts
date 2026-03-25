import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/outcomes/review — List all outcome submissions for admin review.
 * Query params: status (draft|submitted|under_review|validated|rejected|published)
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const statusFilter = request.nextUrl.searchParams.get('status');

  const db = getServiceSupabase();
  let query = db
    .from('outcome_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Summary counts
  const { data: counts } = await db
    .from('outcome_submissions')
    .select('status')
    .then(({ data }) => ({
      data: {
        total: data?.length ?? 0,
        draft: data?.filter(d => d.status === 'draft').length ?? 0,
        submitted: data?.filter(d => d.status === 'submitted').length ?? 0,
        under_review: data?.filter(d => d.status === 'under_review').length ?? 0,
        validated: data?.filter(d => d.status === 'validated').length ?? 0,
        rejected: data?.filter(d => d.status === 'rejected').length ?? 0,
      },
    }));

  return NextResponse.json({ submissions: data, counts });
}
