import { NextRequest, NextResponse } from 'next/server';
import { getIntake, updateIntake } from '@/lib/services/intake-service';

type Params = { params: Promise<{ intakeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { intakeId } = await params;
  const intake = await getIntake(intakeId);
  if (!intake) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(intake);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { intakeId } = await params;
  const body = await req.json();
  const updated = await updateIntake(intakeId, body);
  if (!updated) return NextResponse.json({ error: 'Failed' }, { status: 500 });
  return NextResponse.json(updated);
}
