import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const RESEND_SANDBOX_SENDER = 'onboarding@resend.dev'

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

export function loadMergedEnv() {
  return { ...process.env, ...parseEnvFile(resolve(root, '.env')) }
}

export function projectRefFromUrl(url) {
  if (!url) return null
  const normalized = url.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '')
  const match = normalized.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return match?.[1] ?? null
}

export function getProjectRef(env = loadMergedEnv()) {
  return (
    env.SUPABASE_PROJECT_ID?.trim() ||
    projectRefFromUrl(env.VITE_SUPABASE_URL) ||
    readLinkedProjectRef()
  )
}

function readLinkedProjectRef() {
  const refPath = resolve(root, 'supabase/.temp/project-ref')
  if (!existsSync(refPath)) return null
  return readFileSync(refPath, 'utf8').trim() || null
}

export function isSandboxSender(senderEmail) {
  return (senderEmail ?? '').trim().toLowerCase() === RESEND_SANDBOX_SENDER
}

export async function managementFetch(path, { method = 'GET', body, token }) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text.slice(0, 200) || res.statusText
    throw new Error(`Management API ${method} ${path} failed (${res.status}): ${msg}`)
  }
  return data
}

export async function patchAuthConfig(projectRef, token, patch) {
  return managementFetch(`/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    token,
    body: patch,
  })
}

export async function getAuthConfig(projectRef, token) {
  return managementFetch(`/projects/${projectRef}/config/auth`, { token })
}

export async function verifyResendKey(apiKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ibekiatch <onboarding@resend.dev>',
      to: ['delivered@resend.dev'],
      subject: 'ibekiatch key check',
      html: '<p>key check</p>',
    }),
  })
  const body = await res.text()
  if (res.status === 422 || res.status === 403) {
    // Resend validates recipient — key is accepted
    if (body.includes('restricted') || body.includes('only send') || body.includes('testing')) {
      return { ok: true, sandbox: true }
    }
  }
  if (res.ok) return { ok: true, sandbox: true }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Resend API キーが無効です。Dashboard で再発行してください。')
  }
  throw new Error(`Resend API 検証失敗 (${res.status}): ${body.slice(0, 200)}`)
}

export function requireAccessToken(env) {
  const token = env.SUPABASE_ACCESS_TOKEN?.trim()
  if (token) return token
  throw new Error(
    [
      'SUPABASE_ACCESS_TOKEN が未設定です。',
      'https://supabase.com/dashboard/account/tokens で Personal Access Token を作成し、',
      '.env に SUPABASE_ACCESS_TOKEN=sbp_... を追加してから再実行してください。',
      '（または npx supabase login 後、トークンを .env にコピー）',
    ].join('\n'),
  )
}
