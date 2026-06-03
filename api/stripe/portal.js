import { appOrigin } from '../lib/env.mjs'
import { getUserFromBearer } from '../lib/supabaseAdmin.mjs'
import {
  ensureStripeCustomer,
  getProfileByUserId,
  getStripe,
  ensureProfileForUser,
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
    const customerId = await ensureStripeCustomer(stripe, user, profile)
    const origin = appOrigin()

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?tab=profile`,
      locale: 'ja',
    })

    return res.status(200).json({ url: portal.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[stripe/portal]', message)
    return res.status(500).json({ error: message })
  }
}
