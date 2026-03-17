import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess } from '../../../_lib/auth';
import {
  getJourney,
  updateJourney,
  deleteJourney,
  upsertPersona,
  upsertStep,
  addMatch,
} from '@/lib/services/journey-service';

type Params = { params: Promise<{ orgProfileId: string; journeyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgProfileId, journeyId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const journey = await getJourney(journeyId);
  if (!journey) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (journey.org_profile_id !== orgProfileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(journey);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgProfileId, journeyId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { action } = body;

  // Route to different operations based on action
  if (action === 'upsert_persona') {
    const persona = await upsertPersona(journeyId, body.persona);
    if (!persona) return NextResponse.json({ error: 'Failed' }, { status: 500 });
    return NextResponse.json(persona);
  }

  if (action === 'upsert_step') {
    const step = await upsertStep(body.personaId, body.step);
    if (!step) return NextResponse.json({ error: 'Failed' }, { status: 500 });
    return NextResponse.json(step);
  }

  if (action === 'add_match') {
    const match = await addMatch(body.stepId, body.match);
    if (!match) return NextResponse.json({ error: 'Failed' }, { status: 500 });
    return NextResponse.json(match);
  }

  // Default: update journey metadata
  const updated = await updateJourney(journeyId, body);
  if (!updated) return NextResponse.json({ error: 'Failed' }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { orgProfileId, journeyId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const ok = await deleteJourney(journeyId);
  if (!ok) return NextResponse.json({ error: 'Failed' }, { status: 500 });
  return NextResponse.json({ success: true });
}
