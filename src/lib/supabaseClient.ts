import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Project URL を正規化（/rest/v1/ や末尾スラッシュを除去） */
export function normalizeSupabaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '')
  url = url.replace(/\/rest\/v1\/?$/i, '')
  url = url.replace(/\/+$/, '')
  return url
}

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  return Boolean(url && key)
}

export function getSupabaseConfig(): { url: string; key: string } | null {
  if (!isSupabaseConfigured()) return null
  const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    console.error(
      '[ibekiatch] VITE_SUPABASE_URL の形式が不正です。',
      '正: https://xxxxxxxx.supabase.co（/rest/v1/ は付けない）',
    )
    return null
  }
  return { url, key }
}

export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig()
  if (!config) return null
  return createClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}
