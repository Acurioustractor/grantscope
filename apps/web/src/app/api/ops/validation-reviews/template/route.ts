import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';

const TEMPLATE = 'review_date,reviewer,record_type,surface,source,record_id,record_name,status,issue_type,url_works,open_now_correct,deadline_correct,amount_correct,provider_correct,match_relevance_score,relationship_signal_score,actionability_score,notes,recommended_fix,owner\n';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  return new NextResponse(TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="grantscope-data-review-scorecard-template.csv"',
    },
  });
}
