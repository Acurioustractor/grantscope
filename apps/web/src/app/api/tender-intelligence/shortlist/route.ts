import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  addSupplierToShortlist,
  getProcurementContext,
  hasEditAccess,
  removeProcurementShortlistItem,
  updateProcurementShortlistItem,
} from '../_lib/procurement-workspace';

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);

  if (!context.orgProfileId) {
    return NextResponse.json({ error: 'Create an organisation profile before saving a shortlist.' }, { status: 400 });
  }

  if (!hasEditAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have edit access for this procurement workspace.' }, { status: 403 });
  }

  const body = await request.json();
  const supplier = body?.supplier;
  const shortlistId = typeof body?.shortlistId === 'string' ? body.shortlistId : undefined;
  if (!supplier || typeof supplier !== 'object') {
    return NextResponse.json({ error: 'supplier is required' }, { status: 400 });
  }

  try {
    const result = await addSupplierToShortlist(serviceDb, user.id, supplier, { shortlistId });
    return NextResponse.json({ item: result.item, shortlist: result.context.shortlist }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save supplier' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);

  if (!context.shortlist) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }

  if (!hasEditAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have edit access for this procurement workspace.' }, { status: 403 });
  }

  const { itemId, note, decisionTag, reviewChecklist, evidenceSnapshot, shortlistId } = await request.json();
  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
  }

  try {
    const result = await updateProcurementShortlistItem(serviceDb, user.id, {
      itemId,
      note,
      decisionTag,
      reviewChecklist: typeof reviewChecklist === 'object' && reviewChecklist ? reviewChecklist : undefined,
      evidenceSnapshot: typeof evidenceSnapshot === 'object' && evidenceSnapshot ? evidenceSnapshot : undefined,
      shortlistId: typeof shortlistId === 'string' ? shortlistId : undefined,
    });
    return NextResponse.json({ item: result.item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update shortlist item' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);

  if (!context.shortlist) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }

  if (!hasEditAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have edit access for this procurement workspace.' }, { status: 403 });
  }

  const { itemId, shortlistId } = await request.json();
  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
  }

  try {
    await removeProcurementShortlistItem(serviceDb, user.id, {
      itemId,
      shortlistId: typeof shortlistId === 'string' ? shortlistId : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to remove shortlist item' },
      { status: 500 },
    );
  }
}
