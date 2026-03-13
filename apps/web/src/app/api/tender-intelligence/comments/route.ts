import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { createProcurementComment } from '../_lib/procurement-workspace';

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const shortlistId = typeof body?.shortlistId === 'string' ? body.shortlistId : null;
  const shortlistItemId = typeof body?.shortlistItemId === 'string' ? body.shortlistItemId : null;
  const packExportId = typeof body?.packExportId === 'string'
    ? body.packExportId
    : body?.packExportId === null
      ? null
      : undefined;
  const commentType = body?.commentType === 'discussion'
    || body?.commentType === 'submission'
    || body?.commentType === 'approval'
    || body?.commentType === 'changes_requested'
    || body?.commentType === 'supplier_review'
    ? body.commentType
    : shortlistItemId
      ? 'supplier_review'
      : 'discussion';
  const commentBody = typeof body?.body === 'string' ? body.body : '';

  if (!shortlistId) {
    return NextResponse.json({ error: 'shortlistId is required' }, { status: 400 });
  }

  try {
    const serviceDb = getServiceSupabase();
    const result = await createProcurementComment(serviceDb, user.id, {
      shortlistId,
      shortlistItemId,
      packExportId,
      commentType,
      body: commentBody,
    });
    return NextResponse.json({ comment: result.comment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save comment' },
      { status: 500 },
    );
  }
}
