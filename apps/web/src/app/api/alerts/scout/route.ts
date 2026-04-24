import { NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { runGrantScoutForUser } from '@/lib/grant-scout';

export async function POST() {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const result = await runGrantScoutForUser(user.id);

    if (result.profilesScanned === 0) {
      return NextResponse.json(
        { error: 'Complete your organisation profile before running the grant scout.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to run grant scout.' },
      { status: 500 }
    );
  }
}
