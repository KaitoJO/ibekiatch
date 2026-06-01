#!/usr/bin/env node
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

const fileEnv = parseEnvFile(resolve(root, '.env'))
const merged = { ...process.env, ...fileEnv }

const projectRef =
  merged.SUPABASE_PROJECT_ID?.trim() ||
  projectRefFromUrl(merged.VITE_SUPABASE_URL?.trim())

const cliEnv = {}
if (merged.SUPABASE_ACCESS_TOKEN?.trim()) {
  cliEnv.SUPABASE_ACCESS_TOKEN = merged.SUPABASE_ACCESS_TOKEN.trim()
}
if (merged.SUPABASE_DB_PASSWORD?.trim()) {
  cliEnv.SUPABASE_DB_PASSWORD = merged.SUPABASE_DB_PASSWORD.trim()
}
if (projectRef) cliEnv.SUPABASE_PROJECT_ID = projectRef

console.log(`> ${supabaseBin} migration list --linked\n`)
execSync(`"${supabaseBin}" migration list --linked`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...cliEnv },
})
