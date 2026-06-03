import { getUserFromBearer } from '../lib/supabaseAdmin.mjs'
import {
  ensureProfileForUser,
  ensureStripeCustomer,
  getProfileByUserId,
  getStripe,
  syncCustomerSubscriptions,
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

    const stripe = getStripe()
    let profile = await getProfileByUserId(user.id)
    if (!profile) {
      profile = await ensureProfileForUser(user)
    }

    const customerId = profile.stripe_customer_id
      ? profile.stripe_customer_id
      : await ensureStripeCustomer(stripe, user, profile)

    const subscription = await syncCustomerSubscriptions(stripe, user.id, customerId)
    const refreshed = await getProfileByUserId(user.id)

    return res.status(200).json({
      ok: true,
      subscriptionPlan: refreshed?.subscription_plan ?? 'free',
      subscriptionStatus: refreshed?.subscription_status ?? 'none',
      synced: Boolean(subscription),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[stripe/sync]', message)
    return res.status(500).json({ error: message })
  }
}
