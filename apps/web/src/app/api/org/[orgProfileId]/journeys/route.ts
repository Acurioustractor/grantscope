import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess } from '../../_lib/auth';
import { getJourneys, createJourney } from '@/lib/services/journey-service';

type Params = { params: Promise<{ orgProfileId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;

  const journeys = await getJourneys(orgProfileId, projectId);
  return NextResponse.json(journeys);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { title, description, projectId } = body;
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const journey = await createJourney(orgProfileId, projectId ?? null, title, description);
  if (!journey) return NextResponse.json({ error: 'Failed to create journey' }, { status: 500 });

  return NextResponse.json(journey, { status: 201 });
}
