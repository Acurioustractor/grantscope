import { NextResponse } from 'next/server';
import { createIntake } from '@/lib/services/intake-service';

export async function POST() {
  const intake = await createIntake();
  if (!intake) return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  return NextResponse.json(intake, { status: 201 });
}
