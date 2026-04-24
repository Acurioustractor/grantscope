import { NextRequest, NextResponse } from 'next/server'
import { recordProductEvents } from '@/lib/product-events'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

function toIsoTimestamp(value: number | null | undefined): string | null {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number' && value > 0)

  if (periodEnds.length === 0) return null
  return Math.min(...periodEnds)
}

function getSubscriptionProfileUpdate(subscription: Stripe.Subscription, fallbackTier?: string) {
  return {
    subscription_plan: subscription.metadata?.tier || fallbackTier || undefined,
    subscription_status: subscription.status,
    subscription_trial_end: toIsoTimestamp(subscription.trial_end),
    subscription_current_period_end: toIsoTimestamp(getSubscriptionPeriodEnd(subscription)),
    subscription_cancel_at_period_end: subscription.cancel_at_period_end,
  }
}

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
        const checkoutSource = session.metadata?.checkout_source || null

        if (orgProfileId && tier) {
          let subscriptionStatus = 'active'
          let subscriptionUpdate: ReturnType<typeof getSubscriptionProfileUpdate> | null = null
          if (typeof session.subscription === 'string') {
            const subscription = await stripe.subscriptions.retrieve(session.subscription)
            subscriptionStatus = subscription.status
            subscriptionUpdate = getSubscriptionProfileUpdate(subscription, tier)
          }

          await supabase
            .from('org_profiles')
            .update({
              stripe_customer_id: session.customer as string,
              subscription_plan: tier,
              subscription_status: subscriptionStatus,
              ...(subscriptionUpdate ?? {}),
            })
            .eq('id', orgProfileId)

          const { data: profile } = await supabase
            .from('org_profiles')
            .select('user_id')
            .eq('id', orgProfileId)
            .maybeSingle()

          if (profile?.user_id) {
            const events: Parameters<typeof recordProductEvents>[0] = [
              {
                userId: profile.user_id,
                orgProfileId,
                eventType: 'subscription_activated',
                metadata: {
                  tier,
                  subscription_status: subscriptionStatus,
                  stripe_customer_id: session.customer as string,
                  source: checkoutSource,
                },
              },
            ]

            if (subscriptionStatus === 'trialing') {
              events.push({
                userId: profile.user_id,
                orgProfileId,
                eventType: 'subscription_trial_started',
                metadata: {
                  tier,
                  subscription_status: subscriptionStatus,
                  source: checkoutSource,
                  trial_end: subscriptionUpdate?.subscription_trial_end || null,
                },
              })
            }

            await recordProductEvents(events)
          }

          console.log(`✅ CivicGraph subscription activated: org=${orgProfileId} tier=${tier}`)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const orgProfileId = subscription.metadata?.org_profile_id
        const checkoutSource = subscription.metadata?.checkout_source || null

        if (orgProfileId) {
          await supabase
            .from('org_profiles')
            .update(getSubscriptionProfileUpdate(subscription))
            .eq('id', orgProfileId)

          const { data: profile } = await supabase
            .from('org_profiles')
            .select('user_id')
            .eq('id', orgProfileId)
            .maybeSingle()

          if (profile?.user_id) {
            await recordProductEvents([
              {
                userId: profile.user_id,
                orgProfileId,
                eventType: 'subscription_changed',
                metadata: {
                  tier: subscription.metadata?.tier || null,
                  subscription_status: subscription.status,
                  source: checkoutSource,
                },
              },
            ])
          }

          console.log(`🔄 CivicGraph subscription updated: org=${orgProfileId} status=${subscription.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgProfileId = subscription.metadata?.org_profile_id
        const checkoutSource = subscription.metadata?.checkout_source || null

        if (orgProfileId) {
          const endedAt = toIsoTimestamp(subscription.ended_at || getSubscriptionPeriodEnd(subscription))

          await supabase
            .from('org_profiles')
            .update({
              subscription_plan: 'community',
              subscription_status: subscription.status,
              subscription_trial_end: null,
              subscription_current_period_end: endedAt,
              subscription_cancel_at_period_end: false,
            })
            .eq('id', orgProfileId)

          const { data: profile } = await supabase
            .from('org_profiles')
            .select('user_id')
            .eq('id', orgProfileId)
            .maybeSingle()

          if (profile?.user_id) {
            await recordProductEvents([
              {
                userId: profile.user_id,
                orgProfileId,
                eventType: 'subscription_cancelled',
                metadata: {
                  previous_tier: subscription.metadata?.tier || null,
                  subscription_status: subscription.status,
                  source: checkoutSource,
                },
              },
            ])
          }

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
