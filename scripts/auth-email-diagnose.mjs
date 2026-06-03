#!/usr/bin/env node
/**
 * 新規登録メールが届かない原因を診断します。
 *
 *   npm run auth:diagnose
 */
import { createClient } from '@supabase/supabase-js'
import {
  getAuthConfig,
  getProjectRef,
  isSandboxSender,
  loadMergedEnv,
  requireAccessToken,
  RESEND_SANDBOX_SENDER,
} from './auth-email-shared.mjs'

const env = loadMergedEnv()
const projectRef = getProjectRef(env)
const supabaseUrl = env.VITE_SUPABASE_URL?.trim()?.replace(/\/rest\/v1\/?$/i, '')
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
const senderEmail = (env.RESEND_SENDER_EMAIL || RESEND_SANDBOX_SENDER).trim()

console.log('=== ibekiatch 確認メール診断 ===\n')

if (!supabaseUrl || !anonKey) {
  console.error('✗ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が .env に必要です')
  process.exit(1)
}

console.log(`プロジェクト: ${projectRef ?? '不明'}`)
console.log(`送信元設定: ${senderEmail}`)

if (isSandboxSender(senderEmail)) {
  console.log('\n⚠ 原因（最有力）: Resend テスト送信元の制限')
  console.log('  onboarding@resend.dev は Resend アカウント登録メール宛にしか送れません。')
  console.log('  他の Gmail 等で登録すると Supabase が「Error sending confirmation email」を返します。')
  console.log('\n対策:')
  console.log('  1. https://resend.com/domains で独自ドメインを verify')
  console.log('  2. .env に RESEND_SENDER_EMAIL=noreply@yourdomain.com')
  console.log('  3. npm run auth:smtp')
  console.log('\n  暫定: npm run auth:no-confirm（メール確認なしで即登録）')
}

try {
  const token = requireAccessToken(env)
  const cfg = await getAuthConfig(projectRef, token)
  console.log('\n--- Supabase Auth SMTP ---')
  console.log(`  external_email_enabled: ${cfg.external_email_enabled}`)
  console.log(`  mailer_autoconfirm: ${cfg.mailer_autoconfirm}`)
  console.log(`  smtp_host: ${cfg.smtp_host ?? '（未設定）'}`)
  console.log(`  smtp_admin_email: ${cfg.smtp_admin_email ?? '（未設定）'}`)
  console.log(`  smtp_pass: ${cfg.smtp_pass ? '設定済み' : '未設定 ✗'}`)
  if (!cfg.smtp_pass || !cfg.smtp_host) {
    console.log('\n✗ カスタム SMTP 未設定 → npm run auth:smtp')
  }
} catch (err) {
  console.log(`\n（Management API 未確認: ${err.message.split('\n')[0]}）`)
}

console.log('\n--- 送信テスト（ダミーアドレス） ---')
const sb = createClient(supabaseUrl, anonKey)
const testEmail = `diagnose-${Date.now()}@example.com`
const { error } = await sb.auth.signUp({
  email: testEmail,
  password: 'DiagnoseTest123456!',
  options: { emailRedirectTo: 'https://ibekiatch.vercel.app/' },
})

if (error) {
  console.log(`✗ signUp 失敗: ${error.message}`)
  if (/error sending confirmation email/i.test(error.message)) {
    console.log('  → SMTP 送信拒否（Resend サンドボックス制限の可能性大）')
  }
} else {
  console.log('✓ signUp API は成功（この宛先では送信できた可能性）')
}

console.log('\n=== 診断完了 ===')
