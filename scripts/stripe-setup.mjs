#!/usr/bin/env node
/**
 * Stripe に ibekiatch 用 Product / Price を作成し、.env 追記用の値を表示します。
 *
 *   npm run stripe:setup
 *
 * 必要: STRIPE_SECRET_KEY（sk_test_... または sk_live_...）
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

const env = { ...parseEnvFile(resolve(root, '.env')), ...process.env }
const secretKey = env.STRIPE_SECRET_KEY?.trim()

if (!secretKey) {
  console.error('STRIPE_SECRET_KEY が未設定です。.env に sk_test_... を追加してください。')
  process.exit(1)
}

const stripe = new Stripe(secretKey)

const PRICES = [
  { name: 'スタンダード', lookupKey: 'price_standard', amount: 1200, plan: 'standard' },
  { name: 'スタンダード（早期予約）', lookupKey: 'price_standard_early', amount: 980, plan: 'standard' },
  { name: 'プレミアム', lookupKey: 'price_premium', amount: 2980, plan: 'premium' },
  { name: 'プレミアム（早期予約）', lookupKey: 'price_premium_early', amount: 2480, plan: 'premium' },
]

async function findPrice(lookupKey) {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  return list.data[0] ?? null
}

async function ensureProduct(name, lookupKey, amount, plan) {
  const existing = await findPrice(lookupKey)
  if (existing) {
    console.log(`✓ ${name}: ${existing.id} (${lookupKey})`)
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

  console.log(`+ ${name} を作成: ${price.id}`)
  return price
}

console.log(`Stripe mode: ${secretKey.startsWith('sk_live') ? 'LIVE' : 'TEST'}\n`)

const created = {}
for (const item of PRICES) {
  created[item.lookupKey] = await ensureProduct(item.name, item.lookupKey, item.amount, item.plan)
}

const lines = [
  '',
  '# --- Stripe（npm run stripe:setup で生成） ---',
  `STRIPE_SECRET_KEY=${secretKey}`,
  'STRIPE_WEBHOOK_SECRET=whsec_...  # Stripe Dashboard → Webhooks → 署名シークレット',
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`,
  `STRIPE_PRICE_STANDARD=${created.price_standard.id}`,
  `STRIPE_PRICE_STANDARD_EARLY=${created.price_standard_early.id}`,
  `STRIPE_PRICE_PREMIUM=${created.price_premium.id}`,
  `STRIPE_PRICE_PREMIUM_EARLY=${created.price_premium_early.id}`,
  'STRIPE_EARLY_BIRD=true',
  'APP_URL=https://ibekiatch.vercel.app',
  '',
  '# Webhook URL（本番）:',
  '# https://ibekiatch.vercel.app/api/stripe/webhook',
  '# イベント: checkout.session.completed, customer.subscription.deleted',
  '',
]

console.log(lines.join('\n'))

const envPath = resolve(root, '.env')
if (existsSync(envPath)) {
  let content = readFileSync(envPath, 'utf8')
  const updates = {
    STRIPE_SECRET_KEY: secretKey,
    STRIPE_PRICE_STANDARD: created.price_standard.id,
    STRIPE_PRICE_STANDARD_EARLY: created.price_standard_early.id,
    STRIPE_PRICE_PREMIUM: created.price_premium.id,
    STRIPE_PRICE_PREMIUM_EARLY: created.price_premium_early.id,
    STRIPE_EARLY_BIRD: 'true',
  }
  for (const [key, val] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(content)) {
      content = content.replace(re, `${key}=${val}`)
    } else {
      content += `\n${key}=${val}`
    }
  }
  if (!/^APP_URL=/m.test(content)) {
    content += '\nAPP_URL=https://ibekiatch.vercel.app'
  }
  writeFileSync(envPath, content)
  console.log('✓ .env に Price ID を追記しました（Webhook / Publishable key は Dashboard から手動設定）')
}
