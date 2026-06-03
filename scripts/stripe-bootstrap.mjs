#!/usr/bin/env node
/**
 * Stripe 一括セットアップ（Price / Webhook / Customer Portal / Vercel env）
 *
 *   npm run stripe:bootstrap
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import Stripe from 'stripe'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP_URL = 'https://ibekiatch.vercel.app'
const WEBHOOK_URL = `${APP_URL}/api/stripe/webhook`

const WEBHOOK_EVENTS = ['checkout.session.completed', 'customer.subscription.deleted']

const PRICES = [
  { name: 'スタンダード', lookupKey: 'price_standard', amount: 1200, plan: 'standard' },
  { name: 'スタンダード（早期予約）', lookupKey: 'price_standard_early', amount: 980, plan: 'standard' },
  { name: 'プレミアム', lookupKey: 'price_premium', amount: 2980, plan: 'premium' },
  { name: 'プレミアム（早期予約）', lookupKey: 'price_premium_early', amount: 2480, plan: 'premium' },
]

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function upsertEnv(updates) {
  const envPath = resolve(root, '.env')
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  for (const [key, val] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(content)) content = content.replace(re, `${key}=${val}`)
    else content += `${content.endsWith('\n') || content.length === 0 ? '' : '\n'}${key}=${val}\n`
  }
  writeFileSync(envPath, content)
}

async function findPrice(stripe, lookupKey) {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  return list.data[0] ?? null
}

async function ensurePrice(stripe, { name, lookupKey, amount, plan }) {
  const existing = await findPrice(stripe, lookupKey)
  if (existing) {
    console.log(`✓ ${name}: ${existing.id}`)
    return existing
  }
  const product = await stripe.products.create({
    name: `ibekiatch ${name}`,
    metadata: { app: 'ibekiatch', plan },
  })
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'jpy',
    unit_amount: amount,
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    metadata: { app: 'ibekiatch', plan },
  })
  console.log(`+ ${name} 作成: ${price.id}`)
  return price
}

async function ensureWebhook(stripe) {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 })
  const match = existing.data.find((w) => w.url === WEBHOOK_URL)
  if (match) {
    await stripe.webhookEndpoints.update(match.id, { enabled_events: WEBHOOK_EVENTS })
    console.log(`✓ Webhook 更新: ${match.id}`)
    return match.secret ?? null
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: 'ibekiatch production',
  })
  console.log(`+ Webhook 作成: ${endpoint.id}`)
  return endpoint.secret
}

async function ensurePortal(stripe, standardPrice, premiumPrice) {
  const configs = await stripe.billingPortal.configurations.list({ limit: 1 })
  if (configs.data.length > 0) {
    console.log('✓ Customer Portal 設定済み')
    return
  }
  const standardProduct =
    typeof standardPrice.product === 'string' ? standardPrice.product : standardPrice.product.id
  const premiumProduct =
    typeof premiumPrice.product === 'string' ? premiumPrice.product : premiumPrice.product.id

  await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'イベキャッチ プラン管理' },
    features: {
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        products: [
          { product: standardProduct, prices: [standardPrice.id] },
          { product: premiumProduct, prices: [premiumPrice.id] },
        ],
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  })
  console.log('+ Customer Portal を有効化')
}

function pushVercelEnv(key, value) {
  const result = spawnSync(
    'npx',
    ['vercel', 'env', 'add', key, 'production', '--force'],
    {
      cwd: root,
      input: `${value}\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
  if (result.status === 0) {
    console.log(`✓ Vercel env: ${key}`)
    return true
  }
  console.warn(`⚠ Vercel env ${key}:`, result.stderr?.trim() || result.stdout?.trim())
  return false
}

const env = { ...parseEnvFile(resolve(root, '.env')), ...process.env }
const secretKey = env.STRIPE_SECRET_KEY?.trim()

if (!secretKey) {
  console.error('STRIPE_SECRET_KEY が未設定です')
  process.exit(1)
}

const stripe = new Stripe(secretKey)
console.log(`Mode: ${secretKey.startsWith('sk_live') ? 'LIVE ⚠' : 'TEST'}\n`)

const created = {}
for (const item of PRICES) {
  created[item.lookupKey] = await ensurePrice(stripe, item)
}

const webhookSecret = await ensureWebhook(stripe)
await ensurePortal(stripe, created.price_standard, created.price_premium)

const envUpdates = {
  STRIPE_PRICE_STANDARD: created.price_standard.id,
  STRIPE_PRICE_STANDARD_EARLY: created.price_standard_early.id,
  STRIPE_PRICE_PREMIUM: created.price_premium.id,
  STRIPE_PRICE_PREMIUM_EARLY: created.price_premium_early.id,
  STRIPE_EARLY_BIRD: 'true',
  APP_URL,
}
if (webhookSecret) envUpdates.STRIPE_WEBHOOK_SECRET = webhookSecret
upsertEnv(envUpdates)

console.log('\n=== .env 更新完了 ===')
console.log('\n=== Vercel Production 環境変数 ===')
const vercelKeys = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STANDARD',
  'STRIPE_PRICE_STANDARD_EARLY',
  'STRIPE_PRICE_PREMIUM',
  'STRIPE_PRICE_PREMIUM_EARLY',
  'STRIPE_EARLY_BIRD',
  'APP_URL',
]
if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
  vercelKeys.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
}

const merged = { ...parseEnvFile(resolve(root, '.env')), ...process.env }
for (const key of vercelKeys) {
  const val = merged[key]?.trim()
  if (!val || val.includes('...')) {
    console.log(`⚠ スキップ ${key}（未設定）`)
    continue
  }
  pushVercelEnv(key, val)
}

console.log('\n完了。NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY が未設定なら Dashboard から .env / Vercel に追加してください。')
console.log('反映後: npx vercel --prod')
