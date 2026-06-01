#!/usr/bin/env node
/**
 * Resend SMTP を Supabase Auth に反映します。
 *
 * 必要な .env:
 *   RESEND_API_KEY=re_...   （Resend Dashboard → API Keys）
 *   RESEND_SENDER_EMAIL=... （省略時 onboarding@resend.dev）
 *
 * 使い方:
 *   npm run auth:smtp
 *   RESEND_API_KEY=re_xxx npm run auth:smtp
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const supabaseBin = resolve(root, 'node_modules/.bin/supabase')

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

function run(command, extraEnv = {}) {
  console.log(`\n> ${command}\n`)
  execSync(command, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
}

async function verifyResendKey(apiKey) {
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const body = await res.text()
  if (res.ok) {
    console.log('✓ Resend API キーを確認しました')
    return
  }
  if (res.status === 401 && body.includes('restricted_api_key')) {
    console.log('✓ Resend API キーを確認しました（送信専用キー）')
    return
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Resend API キーが無効です。Dashboard で再発行してください。')
  }
  throw new Error(`Resend API 検証失敗 (${res.status}): ${body.slice(0, 200)}`)
}

const fileEnv = parseEnvFile(resolve(root, '.env'))
const apiKey = (process.argv[2] || fileEnv.RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim()

if (!apiKey) {
  console.error(
    [
      'RESEND_API_KEY が未設定です。',
      '',
      '1. https://resend.com/signup でアカウント作成（GitHub 連携可）',
      '2. https://resend.com/api-keys で API キーを作成',
      '3. .env に RESEND_API_KEY=re_... を追加',
      '4. npm run auth:smtp を再実行',
      '',
      'テスト送信のみ: RESEND_SENDER_EMAIL=onboarding@resend.dev',
      '（Resend 登録メールアドレス宛にのみ届きます。全ユーザー向けはドメイン verify が必要）',
    ].join('\n'),
  )
  process.exit(1)
}

if (!/^re_[A-Za-z0-9_]+$/.test(apiKey)) {
  console.error('RESEND_API_KEY の形式が不正です（re_ で始まる必要があります）')
  process.exit(1)
}

if (!existsSync(supabaseBin)) {
  console.error('Supabase CLI が見つかりません。npm install を実行してください。')
  process.exit(1)
}

console.log(`Sender (config.toml): onboarding@resend.dev`)
console.log('  本番用は supabase/config.toml の admin_email を verify 済みドメインに変更してください')
await verifyResendKey(apiKey)

const pushEnv = {
  RESEND_API_KEY: apiKey,
}

run(`"${supabaseBin}" config push --yes`, pushEnv)

console.log('\n✓ SMTP 設定を Supabase に反映しました')
console.log('  本番: https://ibekiatch.vercel.app で新規登録して確認メールをテストしてください')
