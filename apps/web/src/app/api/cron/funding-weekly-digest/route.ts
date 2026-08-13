import { NextResponse } from 'next/server'; import { generateFundingWeeklyDigest } from '@/lib/services/funding-weekly-digest'; import { requireCronBearer } from '@/lib/cron-auth';
export const maxDuration = 60;
export async function GET(request: Request) { const unauthorized = requireCronBearer(request); if (unauthorized) return unauthorized; try { return NextResponse.json(await generateFundingWeeklyDigest('act')); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Weekly digest failed' }, { status: 500 }); } }
