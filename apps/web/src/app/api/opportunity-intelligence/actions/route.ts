import { NextRequest, NextResponse } from 'next/server';
import {
  createOpportunityIntelligenceAction,
  type OpportunityActionRequest,
} from '@/lib/opportunity-intelligence';
import { requireModule } from '@/lib/api-auth';
import { requireOrgWriteAccess } from '../../org/_lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/opportunity-intelligence/actions',
    method: 'POST',
    mode: 'mirror-plus-actions',
    allowedKinds: [
      'no',
      'later',
      'research',
      'partner_path',
      'apply_path',
      'add_evidence_gap',
      'promote_to_pipeline',
      'send_to_ghl',
      'send_to_notion',
      'mark_no_go',
      'create_brief_task',
      'request_ingestion',
      'contact',
      'brief',
      'qualify',
      'monitor',
      'ingest',
      'no-go',
    ],
    safety: [
      'No email or SMS send in V1.',
      'No automatic GHL or Notion stage changes from ranking.',
      'send_to_ghl requires confirmWrite=true and a route payload.',
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModule('tracker');
    if (auth.error) return auth.error;

    const body = (await request.json()) as OpportunityActionRequest;
    if (!body.kind) {
      return NextResponse.json({ error: 'kind is required' }, { status: 400 });
    }

    // This endpoint writes through the service client. General tracker access
    // is not enough when the caller supplies a target organisation.
    if (body.orgProfileId) {
      const orgAuth = await requireOrgWriteAccess(body.orgProfileId);
      if (orgAuth instanceof NextResponse) return orgAuth;
    }

    const receipt = await createOpportunityIntelligenceAction(body, { userId: auth.user.id });
    return NextResponse.json(receipt, { status: receipt.status === 'blocked' ? 422 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to create opportunity intelligence action',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
