#!/usr/bin/env node
/**
 * .env の設定から Supabase プロジェクトに link し、
 * supabase/migrations/*.sql をリモート DB へ db push します。
 *
 * 必要な .env（いずれか/組み合わせ）:
 *   VITE_SUPABASE_URL          … プロジェクト ref を自動抽出
 *   SUPABASE_PROJECT_ID        … 明示指定（任意）
 *   SUPABASE_ACCESS_TOKEN      … ダッシュボードの Personal Access Token
 *   SUPABASE_DB_PASSWORD       … プロジェクト作成時の DB パスワード
 *
 * アクセストークン未設定時は `supabase login` 済みの CLI 認証を利用します。
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

function projectRefFromUrl(url) {
  if (!url) return null
  const normalized = url.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '')
  const match = normalized.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return match?.[1] ?? null
}

function run(command, extraEnv = {}) {
  console.log(`\n> ${command}\n`)
  execSync(command, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
}

function readLinkedProjectRef() {
  const refPath = resolve(root, 'supabase/.temp/project-ref')
  if (!existsSync(refPath)) return null
  return readFileSync(refPath, 'utf8').trim() || null
}

const fileEnv = parseEnvFile(resolve(root, '.env'))
const merged = { ...process.env, ...fileEnv }

const supabaseUrl = merged.VITE_SUPABASE_URL?.trim()
const projectRef =
  merged.SUPABASE_PROJECT_ID?.trim() || projectRefFromUrl(supabaseUrl)
const accessToken = merged.SUPABASE_ACCESS_TOKEN?.trim()
const dbPassword = merged.SUPABASE_DB_PASSWORD?.trim()

if (!existsSync(supabaseBin)) {
  console.error('Supabase CLI が見つかりません。npm install を実行してください。')
  process.exit(1)
}

if (!projectRef) {
  console.error(
    [
      'プロジェクト ref を特定できません。',
      '.env に VITE_SUPABASE_URL または SUPABASE_PROJECT_ID を設定してください。',
      '例: VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co',
    ].join('\n'),
  )
  process.exit(1)
}

const cliEnv = { SUPABASE_PROJECT_ID: projectRef }
if (accessToken) cliEnv.SUPABASE_ACCESS_TOKEN = accessToken
if (dbPassword) cliEnv.SUPABASE_DB_PASSWORD = dbPassword

console.log(`Target project ref: ${projectRef}`)

const linkedRef = readLinkedProjectRef()
if (linkedRef !== projectRef) {
  run(`"${supabaseBin}" link --project-ref ${projectRef}`, cliEnv)
} else {
  console.log(`\nAlready linked to ${projectRef}`)
}

run(`"${supabaseBin}" db push`, cliEnv)

console.log('\n✓ Migrations applied successfully.')
