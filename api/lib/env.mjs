import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function parseEnvFile(path) {
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

export function loadEnv() {
  return { ...parseEnvFile(resolve(root, '.env')), ...process.env }
}

export function requireEnv(env, key) {
  const value = env[key]?.trim()
  if (!value) throw new Error(`${key} is not configured`)
  return value
}

export function appOrigin(env = loadEnv()) {
  return (env.APP_URL || env.VITE_APP_URL || 'https://ibekiatch.vercel.app').replace(/\/+$/, '')
}
