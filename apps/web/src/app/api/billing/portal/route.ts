import { NextResponse } from 'next/server'
import { recordProductEvents } from '@/lib/product-events'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getServiceSupabase } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const source = typeof body?.source === 'string' && body.source.trim().length > 0
      ? body.source.trim().slice(0, 80)
      : 'profile_billing_panel'

    const supabase = getServiceSupabase()
    const { data: profile } = await supabase
      .from('org_profiles')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/profile?billing_source=${encodeURIComponent(source)}`,
    })

    await recordProductEvents([
      {
        userId: user.id,
        orgProfileId: profile.id,
        eventType: 'billing_portal_opened',
        metadata: {
          source,
          stripe_customer_id: profile.stripe_customer_id,
        },
      },
    ])

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Billing portal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
