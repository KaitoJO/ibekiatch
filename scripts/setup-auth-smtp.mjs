#!/usr/bin/env node
/**
 * Resend SMTP を Supabase Auth（本番）に反映します。
 *
 * 必要な .env:
 *   RESEND_API_KEY=re_...
 *   SUPABASE_ACCESS_TOKEN=sbp_...  （Management API 用）
 *   RESEND_SENDER_EMAIL=...        （省略時 onboarding@resend.dev = テスト用）
 *
 * 使い方:
 *   npm run auth:smtp
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getAuthConfig,
  getProjectRef,
  isSandboxSender,
  loadMergedEnv,
  patchAuthConfig,
  requireAccessToken,
  RESEND_SANDBOX_SENDER,
  root,
  verifyResendKey,
} from './auth-email-shared.mjs'

const supabaseBin = resolve(root, 'node_modules/.bin/supabase')

function run(command, extraEnv = {}) {
  console.log(`\n> ${command}\n`)
  execSync(command, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
}

const env = loadMergedEnv()
const apiKey = (process.argv[2] || env.RESEND_API_KEY || '').trim()
const senderEmail = (env.RESEND_SENDER_EMAIL || RESEND_SANDBOX_SENDER).trim()
const projectRef = getProjectRef(env)

if (!apiKey) {
  console.error(
    [
      'RESEND_API_KEY が未設定です。',
      '',
      '1. https://resend.com/api-keys で API キーを作成',
      '2. .env に RESEND_API_KEY=re_... を追加',
      '3. npm run auth:smtp を再実行',
    ].join('\n'),
  )
  process.exit(1)
}

if (!/^re_[A-Za-z0-9_]+$/.test(apiKey)) {
  console.error('RESEND_API_KEY の形式が不正です（re_ で始まる必要があります）')
  process.exit(1)
}

if (!projectRef) {
  console.error('VITE_SUPABASE_URL からプロジェクト ref を特定できません。')
  process.exit(1)
}

if (!existsSync(supabaseBin)) {
  console.error('Supabase CLI が見つかりません。npm install を実行してください。')
  process.exit(1)
}

console.log(`Project: ${projectRef}`)
console.log(`Sender:  ${senderEmail}`)

if (isSandboxSender(senderEmail)) {
  console.warn(
    [
      '',
      '⚠ テスト送信元 (onboarding@resend.dev) です。',
      '  Resend 登録メールアドレス宛にしか確認メールは届きません。',
      '  全ユーザー向け: https://resend.com/domains でドメイン verify 後、',
      '  .env の RESEND_SENDER_EMAIL=noreply@yourdomain.com に変更して再実行。',
      '',
    ].join('\n'),
  )
}

const resendCheck = await verifyResendKey(apiKey)
console.log(resendCheck.sandbox ? '✓ Resend API キー OK（サンドボックス）' : '✓ Resend API キー OK')

let accessToken
try {
  accessToken = requireAccessToken(env)
} catch (err) {
  console.warn(String(err.message))
  console.warn('\nManagement API をスキップし config push のみ実行します…')
}

if (accessToken) {
  console.log('\nManagement API で SMTP を直接設定します…')
  await patchAuthConfig(projectRef, accessToken, {
    external_email_enabled: true,
    mailer_autoconfirm: false,
    smtp_host: 'smtp.resend.com',
    smtp_port: 465,
    smtp_user: 'resend',
    smtp_pass: apiKey,
    smtp_admin_email: senderEmail,
    smtp_sender_name: 'ibekiatch',
  })

  const cfg = await getAuthConfig(projectRef, accessToken)
  console.log('✓ SMTP 反映済み')
  console.log(`  smtp_host: ${cfg.smtp_host}`)
  console.log(`  smtp_admin_email: ${cfg.smtp_admin_email}`)
  console.log(`  smtp_pass: ${cfg.smtp_pass ? '（設定済み）' : '（未設定）'}`)
}

run(`"${supabaseBin}" config push --yes`, {
  RESEND_API_KEY: apiKey,
  RESEND_SENDER_EMAIL: senderEmail,
})

console.log('\n✓ 完了')
console.log('  診断: npm run auth:diagnose')
if (isSandboxSender(senderEmail)) {
  console.log('  全アドレスで届ける: ドメイン verify → RESEND_SENDER_EMAIL 変更 → npm run auth:smtp')
}
