import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        auth: 'no user',
        authError: authError?.message || null,
      });
    }

    const serviceDb = getServiceSupabase();
    const { data, error } = await serviceDb
      .from('saved_grants')
      .select('id, grant_id, stars, stage')
      .eq('user_id', user.id);

    return NextResponse.json({
      auth: 'ok',
      userId: user.id,
      email: user.email,
      savedGrants: data?.length ?? 0,
      queryError: error?.message || null,
      grants: data,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
