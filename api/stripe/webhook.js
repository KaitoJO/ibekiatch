import { loadEnv, requireEnv } from '../lib/env.mjs'
import {
  getStripe,
  readRawBody,
  syncSubscriptionToProfile,
  upsertSubscriptionRecord,
} from '../lib/stripeShared.mjs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const env = loadEnv()
  const webhookSecret = requireEnv(env, 'STRIPE_WEBHOOK_SECRET')
  const stripe = getStripe()

  let event
  try {
    const rawBody = await readRawBody(req)
    const signature = req.headers['stripe-signature']
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' })
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[stripe/webhook] signature error:', message)
    return res.status(400).json({ error: `Webhook Error: ${message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.supabase_user_id
        const subscriptionId = session.subscription
        if (!userId || !subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(String(subscriptionId))
        if (!subscription.metadata?.supabase_user_id) {
          await stripe.subscriptions.update(subscription.id, {
            metadata: { ...subscription.metadata, supabase_user_id: userId },
          })
          subscription.metadata = { ...subscription.metadata, supabase_user_id: userId }
        }

        await syncSubscriptionToProfile(subscription)
        console.log('[stripe/webhook] checkout completed', userId, subscription.id)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        await upsertSubscriptionRecord(userId, {
          plan: 'free',
          status: 'canceled',
          stripe_subscription_id: null,
          stripe_customer_id:
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id ?? null,
        })
        console.log('[stripe/webhook] subscription deleted', userId)
        break
      }

      default:
        break
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[stripe/webhook]', event.type, message)
    return res.status(500).json({ error: message })
  }
}
