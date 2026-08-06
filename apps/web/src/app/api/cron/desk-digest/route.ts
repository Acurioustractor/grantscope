import { NextResponse } from 'next/server';
import { composeDeskDigest, runDeskDigest } from '@/lib/services/act-desk-digest';
import { syncGhlTaskBridge } from '@/lib/services/act-ghl-task-bridge';

// The daily 07:00 Brisbane pass (Vercel cron, 21:00 UTC — Brisbane has no
// DST): ONE composition of "what's due", two channels out — the email digest
// (#160, delta-only + Monday heartbeat) and the GHL tasks bridge (#161,
// write-only projections). Desk, digest and tasks agree by construction.
//
// ?dry=1 composes and reports without sending email or touching GHL.
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET || process.env.API_SECRET_KEY;
  const supplied = request.headers.get('authorization');
  if (expected && supplied !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';

  try {
    const digest = await composeDeskDigest('act');
    const email = await runDeskDigest(digest, { dryRun });
    const bridge = digest.orgProfileId
      ? await syncGhlTaskBridge(digest.orgProfileId, digest.due, { dryRun })
      : null;

    return NextResponse.json({
      dryRun,
      composed: { decisions: digest.decisions.length, due: digest.due.length },
      email,
      bridge,
      ...(dryRun
        ? {
            preview: {
              decisions: digest.decisions.map((d) => ({ key: d.key, name: d.name, next: d.next })),
              due: digest.due.map((d) => ({ key: d.key, name: d.name, action: d.action, dueDays: d.dueDays })),
            },
          }
        : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'desk digest failed' },
      { status: 500 }
    );
  }
}
