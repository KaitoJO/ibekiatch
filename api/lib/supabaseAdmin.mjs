import { createClient } from '@supabase/supabase-js'
import { loadEnv, requireEnv } from './env.mjs'

export function getSupabaseAdmin() {
  const env = loadEnv()
  const url = requireEnv(env, 'VITE_SUPABASE_URL').replace(/\/rest\/v1\/?$/i, '')
  const key = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getSupabaseAuthClient() {
  const env = loadEnv()
  const url = requireEnv(env, 'VITE_SUPABASE_URL').replace(/\/rest\/v1\/?$/i, '')
  const key = requireEnv(env, 'VITE_SUPABASE_ANON_KEY')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getUserFromBearer(req) {
  const auth = req.headers?.authorization ?? req.headers?.Authorization
  const header = Array.isArray(auth) ? auth[0] : auth
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null
  const supabase = getSupabaseAuthClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
