#!/usr/bin/env node
/**
 * メール確認を OFF にし、新規登録後すぐログインできるようにします（暫定対策）。
 *
 *   npm run auth:no-confirm
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getProjectRef,
  loadMergedEnv,
  patchAuthConfig,
  root,
} from './auth-email-shared.mjs'

const supabaseBin = resolve(root, 'node_modules/.bin/supabase')
const configPath = resolve(root, 'supabase/config.toml')
const env = loadMergedEnv()
const projectRef = getProjectRef(env)

if (!projectRef) {
  console.error('VITE_SUPABASE_URL からプロジェクト ref を特定できません。')
  process.exit(1)
}

console.log(`Project: ${projectRef}`)
console.log('メール確認を OFF にします…')

const token = env.SUPABASE_ACCESS_TOKEN?.trim()
if (token) {
  await patchAuthConfig(projectRef, token, { mailer_autoconfirm: true })
  console.log('✓ Management API: mailer_autoconfirm = true')
}

let toml = readFileSync(configPath, 'utf8')
if (/enable_confirmations\s*=\s*true/.test(toml)) {
  toml = toml.replace(/enable_confirmations\s*=\s*true/, 'enable_confirmations = false')
  writeFileSync(configPath, toml)
  console.log('✓ config.toml: enable_confirmations = false')
}

if (!existsSync(supabaseBin)) {
  console.error('Supabase CLI が見つかりません。')
  process.exit(1)
}

execSync(`"${supabaseBin}" config push --yes`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...env },
})

console.log('\n✓ 完了 — 新規登録後、確認メールなしでログインできます')
console.log('  確認メールを有効化: npm run auth:confirm-on（ドメイン verify 後）')
