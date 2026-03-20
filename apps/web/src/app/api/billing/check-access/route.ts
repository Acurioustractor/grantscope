import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveSubscriptionTier, getModules } from '@/lib/subscription';
import { getImpersonateSlug } from '@/lib/org-profile';

export async function GET() {
  try {
    const supabaseAuth = await createSupabaseServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ authenticated: false, premium: false, tier: 'community', modules: ['grants', 'research'] });
    }

    const supabase = getServiceSupabase();

    // Check impersonation — use impersonated org's subscription
    const impersonateSlug = await getImpersonateSlug();
    const { data: profile } = impersonateSlug
      ? await supabase
          .from('org_profiles')
          .select('stripe_customer_id, subscription_plan, name')
          .eq('slug', impersonateSlug)
          .maybeSingle()
      : await supabase
          .from('org_profiles')
          .select('stripe_customer_id, subscription_plan, name')
          .eq('user_id', user.id)
          .maybeSingle();

    const tier = resolveSubscriptionTier(profile?.subscription_plan);
    const modules = getModules(tier);

    return NextResponse.json({
      authenticated: true,
      premium: tier !== 'community',
      tier,
      modules,
      org_name: profile?.name || null,
    });
  } catch {
    return NextResponse.json({ authenticated: false, premium: false, tier: 'community', modules: ['grants', 'research'] });
  }
}
