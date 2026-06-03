#!/usr/bin/env node
/**
 * メール確認を ON に戻します（Resend ドメイン verify 後）。
 *
 *   npm run auth:confirm-on
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getProjectRef,
  isSandboxSender,
  loadMergedEnv,
  patchAuthConfig,
  RESEND_SANDBOX_SENDER,
  root,
} from './auth-email-shared.mjs'

const supabaseBin = resolve(root, 'node_modules/.bin/supabase')
const configPath = resolve(root, 'supabase/config.toml')
const env = loadMergedEnv()
const projectRef = getProjectRef(env)
const senderEmail = (env.RESEND_SENDER_EMAIL || RESEND_SANDBOX_SENDER).trim()

if (!projectRef) {
  console.error('VITE_SUPABASE_URL からプロジェクト ref を特定できません。')
  process.exit(1)
}

if (isSandboxSender(senderEmail)) {
  console.error(
    [
      'RESEND_SENDER_EMAIL がテスト用 (onboarding@resend.dev) のままです。',
      'ドメイン verify 後に noreply@yourdomain.com を設定してから実行してください。',
      '（暫定でメール確認なしのまま運用: npm run auth:no-confirm）',
    ].join('\n'),
  )
  process.exit(1)
}

console.log(`Project: ${projectRef}`)
console.log('メール確認を ON にします…')

const token = env.SUPABASE_ACCESS_TOKEN?.trim()
if (token) {
  await patchAuthConfig(projectRef, token, { mailer_autoconfirm: false })
  console.log('✓ Management API: mailer_autoconfirm = false')
}

let toml = readFileSync(configPath, 'utf8')
if (/enable_confirmations\s*=\s*false/.test(toml)) {
  toml = toml.replace(/enable_confirmations\s*=\s*false/, 'enable_confirmations = true')
  writeFileSync(configPath, toml)
  console.log('✓ config.toml: enable_confirmations = true')
}

execSync(`"${supabaseBin}" config push --yes`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...env, RESEND_SENDER_EMAIL: senderEmail },
})

console.log('\n✓ 完了 — 新規登録時に確認メールが必要になります')
console.log('  npm run auth:smtp で SMTP も再反映してください')
