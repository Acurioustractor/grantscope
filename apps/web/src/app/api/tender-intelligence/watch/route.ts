import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getProcurementContext, hasEditAccess, updateShortlistWatch } from '../_lib/procurement-workspace';

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const shortlistId = typeof body?.shortlistId === 'string' ? body.shortlistId : null;
  if (!shortlistId) {
    return NextResponse.json({ error: 'shortlistId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id, { shortlistId });
  if (!context.shortlist) {
    return NextResponse.json({ error: 'No procurement shortlist found.' }, { status: 404 });
  }
  if (!hasEditAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have edit access for this procurement workspace.' }, { status: 403 });
  }

  try {
    const result = await updateShortlistWatch(serviceDb, user.id, {
      shortlistId,
      enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
      intervalHours: typeof body?.intervalHours === 'number' ? body.intervalHours : undefined,
    });
    return NextResponse.json({ watch: result.watch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update saved brief watch' },
      { status: 500 },
    );
  }
}
