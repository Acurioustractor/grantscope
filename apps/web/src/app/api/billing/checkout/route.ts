import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getServiceSupabase } from '@/lib/supabase'
import { stripe, TIERS, type TierKey } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tier } = body as { tier: TierKey }

    if (!tier || !(tier in TIERS)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    if (tier === 'community') {
      return NextResponse.json({ error: 'Community tier is free' }, { status: 400 })
    }

    const tierConfig = TIERS[tier]
    if (!tierConfig.stripePriceId) {
      return NextResponse.json({ error: 'Stripe price not configured for this tier' }, { status: 500 })
    }

    const supabase = getServiceSupabase()

    // Get or create org profile
    const { data: profile } = await supabase
      .from('org_profiles')
      .select('id, name, stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Create an organisation profile first' }, { status: 400 })
    }

    let stripeCustomerId = profile.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: profile.name || undefined,
        email: user.email || undefined,
        metadata: {
          org_profile_id: profile.id,
          platform: 'grantscope',
        },
      })
      stripeCustomerId = customer.id

      await supabase
        .from('org_profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', profile.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: tierConfig.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/profile?billing=success`,
      cancel_url: `${appUrl}/pricing?billing=cancelled`,
      metadata: {
        org_profile_id: profile.id,
        tier,
        platform: 'grantscope',
      },
      subscription_data: {
        metadata: {
          org_profile_id: profile.id,
          tier,
          platform: 'grantscope',
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Billing checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
