import type { Profile } from '../types'

export type SubscriptionPlanId = 'free' | 'standard' | 'premium'

const BLOCKED_STATUSES = new Set(['canceled', 'unpaid', 'past_due'])

export function hasPaidAccess(profile: Profile | null | undefined): boolean {
  if (!profile) return false
  if (profile.subscriptionPlan === 'free') return false
  return !BLOCKED_STATUSES.has(profile.subscriptionStatus)
}

export function planRank(plan: SubscriptionPlanId): number {
  if (plan === 'premium') return 2
  if (plan === 'standard') return 1
  return 0
}

async function authHeaders(accessToken: string): Promise<HeadersInit> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function startCheckout(
  accessToken: string,
  plan: 'standard' | 'premium',
): Promise<string> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: await authHeaders(accessToken),
    body: JSON.stringify({ plan }),
  })
  const data = (await res.json()) as { url?: string; error?: string; code?: string }
  if (!res.ok) {
    if (data.code === 'subscription_exists') {
      const portalUrl = await openBillingPortal(accessToken)
      window.location.href = portalUrl
      return portalUrl
    }
    throw new Error(data.error ?? `Checkout failed (${res.status})`)
  }
  if (!data.url) throw new Error('Checkout URL missing')
  return data.url
}

export async function openBillingPortal(accessToken: string): Promise<string> {
  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: await authHeaders(accessToken),
  })
  const data = (await res.json()) as { url?: string; error?: string }
  if (!res.ok) throw new Error(data.error ?? `Portal failed (${res.status})`)
  if (!data.url) throw new Error('Portal URL missing')
  return data.url
}

export async function syncBillingFromStripe(accessToken: string): Promise<{
  subscriptionPlan: string
  subscriptionStatus: string
}> {
  const res = await fetch('/api/stripe/sync', {
    method: 'POST',
    headers: await authHeaders(accessToken),
  })
  const data = (await res.json()) as {
    subscriptionPlan?: string
    subscriptionStatus?: string
    error?: string
  }
  if (!res.ok) throw new Error(data.error ?? `Sync failed (${res.status})`)
  return {
    subscriptionPlan: data.subscriptionPlan ?? 'free',
    subscriptionStatus: data.subscriptionStatus ?? 'none',
  }
}
