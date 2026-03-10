import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceSupabase()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgProfileId = session.metadata?.org_profile_id
        const tier = session.metadata?.tier

        if (orgProfileId && tier) {
          await supabase
            .from('org_profiles')
            .update({
              subscription_plan: tier,
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
            })
            .eq('id', orgProfileId)

          console.log(`✅ CivicGraph subscription activated: org=${orgProfileId} tier=${tier}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const orgProfileId = subscription.metadata?.org_profile_id

        if (orgProfileId) {
          await supabase
            .from('org_profiles')
            .update({
              subscription_plan: subscription.metadata?.tier || undefined,
              subscription_status: subscription.status,
            })
            .eq('id', orgProfileId)

          console.log(`🔄 CivicGraph subscription updated: org=${orgProfileId} status=${subscription.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgProfileId = subscription.metadata?.org_profile_id

        if (orgProfileId) {
          await supabase
            .from('org_profiles')
            .update({
              subscription_plan: 'community',
              subscription_status: 'cancelled',
            })
            .eq('id', orgProfileId)

          console.log(`❌ CivicGraph subscription cancelled: org=${orgProfileId} → community`)
        }
        break
      }

      default:
        console.log(`Unhandled CivicGraph webhook event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('CivicGraph webhook handler error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
