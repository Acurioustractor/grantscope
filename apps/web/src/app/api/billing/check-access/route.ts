import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const supabaseAuth = await createSupabaseServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ authenticated: false, premium: false, tier: 'community' });
    }

    const supabase = getServiceSupabase();
    const { data: profile } = await supabase
      .from('org_profiles')
      .select('stripe_customer_id, name')
      .eq('user_id', user.id)
      .single();

    const isPremium = !!profile?.stripe_customer_id;

    return NextResponse.json({
      authenticated: true,
      premium: isPremium,
      tier: isPremium ? 'paid' : 'community',
      org_name: profile?.name || null,
    });
  } catch {
    return NextResponse.json({ authenticated: false, premium: false, tier: 'community' });
  }
}
