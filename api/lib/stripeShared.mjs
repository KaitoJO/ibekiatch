import Stripe from 'stripe'
import { appOrigin, loadEnv, requireEnv } from './env.mjs'
import { getSupabaseAdmin } from './supabaseAdmin.mjs'

/** Stripe Price lookup_key（npm run stripe:setup） */
export const PRICE_LOOKUP = {
  standard: 'price_standard',
  standardEarly: 'price_standard_early',
  premium: 'price_premium',
  premiumEarly: 'price_premium_early',
}

export function getStripe() {
  const env = loadEnv()
  return new Stripe(requireEnv(env, 'STRIPE_SECRET_KEY'))
}

export function getPublishableKey(env = loadEnv()) {
  return (
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ||
    ''
  )
}

export function getPriceIds(env = loadEnv()) {
  return {
    standard: env.STRIPE_PRICE_STANDARD?.trim() || '',
    premium: env.STRIPE_PRICE_PREMIUM?.trim() || '',
    standardEarly: env.STRIPE_PRICE_STANDARD_EARLY?.trim() || '',
    premiumEarly: env.STRIPE_PRICE_PREMIUM_EARLY?.trim() || '',
  }
}

export function isEarlyBirdEnabled(env = loadEnv()) {
  const raw = env.STRIPE_EARLY_BIRD?.trim()
  if (raw === 'false' || raw === '0') return false
  return true
}

export async function findPriceByLookupKey(stripe, lookupKey) {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  return list.data[0] ?? null
}

/** チェックアウト用 Price ID（早期予約割引優先） */
export async function resolveCheckoutPriceId(stripe, plan, { earlyBird } = {}) {
  const env = loadEnv()
  const useEarly = earlyBird ?? isEarlyBirdEnabled(env)
  const prices = getPriceIds(env)

  if (plan === 'standard') {
    if (useEarly) {
      const fromEnv = prices.standardEarly
      if (fromEnv) return fromEnv
      const early = await findPriceByLookupKey(stripe, PRICE_LOOKUP.standardEarly)
      if (early) return early.id
    }
    if (prices.standard) return prices.standard
    const regular = await findPriceByLookupKey(stripe, PRICE_LOOKUP.standard)
    if (regular) return regular.id
  }

  if (plan === 'premium') {
    if (useEarly) {
      const fromEnv = prices.premiumEarly
      if (fromEnv) return fromEnv
      const early = await findPriceByLookupKey(stripe, PRICE_LOOKUP.premiumEarly)
      if (early) return early.id
    }
    if (prices.premium) return prices.premium
    const regular = await findPriceByLookupKey(stripe, PRICE_LOOKUP.premium)
    if (regular) return regular.id
  }

  return null
}

export function planFromPriceObject(price, env = loadEnv()) {
  if (!price) return null
  const lookup = price.lookup_key ?? ''
  if (lookup.includes('premium')) return 'premium'
  if (lookup.includes('standard')) return 'standard'
  if (price.metadata?.plan === 'premium' || price.metadata?.plan === 'standard') {
    return price.metadata.plan
  }
  const ids = getPriceIds(env)
  if (price.id === ids.premium || price.id === ids.premiumEarly) return 'premium'
  if (price.id === ids.standard || price.id === ids.standardEarly) return 'standard'
  return null
}

export function planFromPriceId(priceId, env = loadEnv()) {
  const ids = getPriceIds(env)
  if (priceId === ids.premium || priceId === ids.premiumEarly) return 'premium'
  if (priceId === ids.standard || priceId === ids.standardEarly) return 'standard'
  return null
}

export function isActiveSubscriptionStatus(status) {
  return status === 'active' || status === 'trialing'
}

export async function getSubscriptionByUserId(userId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getProfileByUserId(userId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, subscription_plan, stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertSubscriptionRecord(userId, patch) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const row = {
    user_id: userId,
    plan: patch.plan ?? 'free',
    status: patch.status ?? 'none',
    stripe_customer_id: patch.stripe_customer_id ?? null,
    stripe_subscription_id: patch.stripe_subscription_id ?? null,
    updated_at: now,
  }

  const { error: subErr } = await supabase.from('subscriptions').upsert(row, { onConflict: 'user_id' })
  if (subErr) throw subErr

  const profilePatch = {
    subscription_plan: row.plan,
    subscription_status: row.status,
    updated_at: now,
  }
  if (patch.stripe_customer_id !== undefined) {
    profilePatch.stripe_customer_id = patch.stripe_customer_id
  }
  if (patch.stripe_subscription_id !== undefined) {
    profilePatch.stripe_subscription_id = patch.stripe_subscription_id
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update(profilePatch)
    .eq('user_id', userId)
  if (profileErr) throw profileErr
}

export async function updateBillingProfile(userId, patch) {
  await upsertSubscriptionRecord(userId, {
    plan: patch.subscription_plan,
    status: patch.subscription_status,
    stripe_customer_id: patch.stripe_customer_id,
    stripe_subscription_id: patch.stripe_subscription_id,
  })
}

export async function ensureProfileForUser(user) {
  const supabase = getSupabaseAdmin()
  const existing = await getProfileByUserId(user.id)
  if (existing) return existing

  const displayName =
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.email?.split('@')[0] ??
    'ユーザー'

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      display_name: displayName,
      subscription_plan: 'free',
      subscription_status: 'none',
    })
    .select('id, user_id, subscription_plan, stripe_customer_id, stripe_subscription_id, subscription_status')
    .single()

  if (error) throw error

  await upsertSubscriptionRecord(user.id, {
    plan: 'free',
    status: 'none',
    stripe_customer_id: null,
    stripe_subscription_id: null,
  })

  return data
}

export async function ensureStripeCustomer(stripe, user, profile) {
  const ensuredProfile = profile ?? (await ensureProfileForUser(user))
  const sub = (await getSubscriptionByUserId(user.id)) ?? {}
  const existingCustomerId = sub.stripe_customer_id ?? ensuredProfile?.stripe_customer_id
  if (existingCustomerId) return existingCustomerId

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { supabase_user_id: user.id },
  })

  await upsertSubscriptionRecord(user.id, {
    plan: sub.plan ?? ensuredProfile?.subscription_plan ?? 'free',
    status: sub.status ?? ensuredProfile?.subscription_status ?? 'none',
    stripe_customer_id: customer.id,
    stripe_subscription_id: sub.stripe_subscription_id ?? ensuredProfile?.stripe_subscription_id ?? null,
  })

  return customer.id
}

export async function syncSubscriptionToProfile(subscription) {
  const userId = subscription.metadata?.supabase_user_id
  if (!userId) return

  const price = subscription.items?.data?.[0]?.price
  const plan = planFromPriceObject(price) ?? planFromPriceId(price?.id)
  const active = isActiveSubscriptionStatus(subscription.status)

  await upsertSubscriptionRecord(userId, {
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: active && plan ? plan : 'free',
    stripe_customer_id:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
  })
}

export async function syncCustomerSubscriptions(stripe, userId, customerId) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })

  const active = subscriptions.data.find((sub) => isActiveSubscriptionStatus(sub.status))
  if (active) {
    if (!active.metadata?.supabase_user_id) {
      await stripe.subscriptions.update(active.id, {
        metadata: { ...active.metadata, supabase_user_id: userId },
      })
      active.metadata = { ...active.metadata, supabase_user_id: userId }
    }
    await syncSubscriptionToProfile(active)
    return active
  }

  const latest = subscriptions.data[0]
  if (latest) {
    await syncSubscriptionToProfile(latest)
    return latest
  }

  await upsertSubscriptionRecord(userId, {
    plan: 'free',
    status: 'none',
    stripe_subscription_id: null,
    stripe_customer_id: customerId,
  })
  return null
}

export function checkoutUrls(env = loadEnv()) {
  const origin = appOrigin(env)
  return {
    success: `${origin}/?checkout=success&tab=profile`,
    cancel: `${origin}/?checkout=cancel&tab=profile`,
  }
}

export async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body))
  }
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}
