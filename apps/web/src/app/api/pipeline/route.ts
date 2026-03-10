import { NextResponse } from 'next/server';

/**
 * DEPRECATED: /api/pipeline now redirects to /api/tracker.
 * The canonical grant tracking table is saved_grants, served by /api/tracker.
 */

export async function GET() {
  return NextResponse.redirect(new URL('/api/tracker', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'http://localhost:3000' : 'http://localhost:3000'));
}

export async function POST() {
  return NextResponse.json(
    { error: 'Deprecated. Use PUT /api/tracker/[grantId] instead.' },
    { status: 410 }
  );
}
