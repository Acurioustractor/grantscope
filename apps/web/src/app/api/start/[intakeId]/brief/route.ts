import { NextRequest, NextResponse } from 'next/server';
import { getIntake, generateBrief } from '@/lib/services/intake-service';

type Params = { params: Promise<{ intakeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { intakeId } = await params;
  const intake = await getIntake(intakeId);
  if (!intake) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const brief = generateBrief(intake);
  return NextResponse.json({ brief, intake });
}
