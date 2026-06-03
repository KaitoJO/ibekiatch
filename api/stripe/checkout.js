import { getUserFromBearer } from '../lib/supabaseAdmin.mjs'
import {
  checkoutUrls,
  ensureProfileForUser,
  ensureStripeCustomer,
  getProfileByUserId,
  getStripe,
  getSubscriptionByUserId,
  isActiveSubscriptionStatus,
  isEarlyBirdEnabled,
  resolveCheckoutPriceId,
} from '../lib/stripeShared.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const user = await getUserFromBearer(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    const plan = body.plan
    if (plan !== 'standard' && plan !== 'premium') {
      return res.status(400).json({ error: 'plan must be standard or premium' })
    }

    const earlyBird =
      body.earlyBird === undefined ? isEarlyBirdEnabled() : Boolean(body.earlyBird)

    const stripe = getStripe()
    const priceId = await resolveCheckoutPriceId(stripe, plan, { earlyBird })
    if (!priceId) {
      return res.status(503).json({
        error: 'Stripe price is not configured. Run npm run stripe:setup',
      })
    }

    let profile = await getProfileByUserId(user.id)
    if (!profile) {
      profile = await ensureProfileForUser(user)
    }

    const subscription = await getSubscriptionByUserId(user.id)
    const activeSubId =
      subscription?.stripe_subscription_id ?? profile?.stripe_subscription_id
    const activeStatus = subscription?.status ?? profile?.subscription_status

    if (activeSubId && isActiveSubscriptionStatus(activeStatus)) {
      return res.status(409).json({
        error: 'Active subscription exists. Use billing portal to change plan.',
        code: 'subscription_exists',
      })
    }

    const customerId = await ensureStripeCustomer(stripe, user, profile)
    const urls = checkoutUrls()

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: urls.success,
      cancel_url: urls.cancel,
      locale: 'ja',
      metadata: {
        supabase_user_id: user.id,
        plan,
        early_bird: earlyBird ? 'true' : 'false',
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return res.status(500).json({ error: 'Failed to create checkout session' })
    }

    return res.status(200).json({ url: session.url, earlyBird })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[stripe/checkout]', message)
    return res.status(500).json({ error: message })
  }
}
