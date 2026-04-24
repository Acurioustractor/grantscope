import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { sendGrantAlertDigests } from '@/lib/grant-alert-digests';
import { getAlertEntitlements } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user, tier } = auth;

  const entitlements = getAlertEntitlements(tier);
  if (!entitlements.weeklyDigest) {
    return NextResponse.json(
      {
        error: 'Weekly grant digests are available on the Professional plan and above.',
        tier,
        upgrade_url: '/pricing',
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const force = body?.force === true;

  try {
    const result = await sendGrantAlertDigests({
      userId: user.id,
      force,
      dryRun: false,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send weekly digest.' },
      { status: 500 }
    );
  }
}
