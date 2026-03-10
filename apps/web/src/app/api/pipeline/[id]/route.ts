import { NextResponse } from 'next/server';

/**
 * DEPRECATED: /api/pipeline/[id] is replaced by /api/tracker/[grantId].
 * The canonical grant tracking table is saved_grants.
 */

export async function PATCH() {
  return NextResponse.json(
    { error: 'Deprecated. Use PUT /api/tracker/[grantId] instead.' },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Deprecated. Use DELETE /api/tracker/[grantId] instead.' },
    { status: 410 }
  );
}
