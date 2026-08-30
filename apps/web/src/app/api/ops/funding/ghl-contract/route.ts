import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { ensureFundingGhlContract, getFundingGhlContractStatus } from '@/lib/services/funding-ghl-contract';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  return NextResponse.json(await getFundingGhlContractStatus());
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'confirm=true is required for a GHL configuration write' }, { status: 400 });
  }
  try {
    return NextResponse.json(await ensureFundingGhlContract());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GHL contract reconciliation failed' },
      { status: 502 }
    );
  }
}
