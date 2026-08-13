import { NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { ACT_FAST_WRITE_PROFILE_ID, ACT_FAST_WRITE_USER_ID, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';

export async function getGoodsGrantWriteContext() {
  if (shouldUseFastLocalOrg()) {
    return { userId: ACT_FAST_WRITE_USER_ID, orgProfileId: ACT_FAST_WRITE_PROFILE_ID, error: null };
  }

  const auth = await requireModule('tracker');
  if (auth.error) return { error: auth.error };
  const { data } = await getServiceSupabase().from('org_profiles').select('id').eq('user_id', auth.user.id).maybeSingle();
  if (!data?.id) return { error: NextResponse.json({ error: 'Organisation profile not found' }, { status: 404 }) };
  return { userId: auth.user.id, orgProfileId: String(data.id), error: null };
}
