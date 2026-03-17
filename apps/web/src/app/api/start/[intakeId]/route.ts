import { NextRequest, NextResponse } from 'next/server';
import { getIntake, updateIntake } from '@/lib/services/intake-service';

type Params = { params: Promise<{ intakeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { intakeId } = await params;
  const intake = await getIntake(intakeId);
  if (!intake) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(intake);
}

const PATCH_ALLOWED_FIELDS = new Set([
  'idea_summary', 'problem_statement', 'issue_areas', 'geographic_focus',
  'target_beneficiary', 'recommended_entity_type', 'entity_type_rationale',
  'phase', 'metadata',
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  const { intakeId } = await params;
  const body = await req.json();

  // Only allow known fields
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (PATCH_ALLOWED_FIELDS.has(key)) filtered[key] = value;
  }
  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const updated = await updateIntake(intakeId, filtered);
  if (!updated) return NextResponse.json({ error: 'Failed' }, { status: 500 });
  return NextResponse.json(updated);
}
