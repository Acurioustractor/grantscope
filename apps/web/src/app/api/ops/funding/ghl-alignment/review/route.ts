import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import {
  applyFundingGhlAlignmentReviews,
  getFundingGhlAlignmentReviewQueue,
} from '@/lib/services/funding-ghl-alignment-review';

export const maxDuration = 300;

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getFundingGhlAlignmentReviewQueue());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funding alignment review queue failed' },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'confirm=true is required for approved Notion and GHL writes' }, { status: 400 });
  }
  const assignments = Array.isArray(body.assignments)
    ? body.assignments.flatMap(item => {
      if (!item || typeof item !== 'object') return [];
      const row = item as { ghlOpportunityId?: unknown; projectCode?: unknown };
      const ghlOpportunityId = typeof row.ghlOpportunityId === 'string' ? row.ghlOpportunityId.trim() : '';
      const projectCode = typeof row.projectCode === 'string' ? row.projectCode.trim() : '';
      return ghlOpportunityId && projectCode ? [{ ghlOpportunityId, projectCode }] : [];
    })
    : [];
  try {
    return NextResponse.json(await applyFundingGhlAlignmentReviews({
      assignments,
      reviewedBy: auth.user.id,
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funding alignment review failed' },
      { status: 502 }
    );
  }
}
