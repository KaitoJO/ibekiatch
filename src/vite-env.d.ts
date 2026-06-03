/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_AUTH_DISABLED?: string
  readonly VITE_TEST_LOGIN_EMAIL?: string
  readonly VITE_TEST_LOGIN_PASSWORD?: string
  readonly VITE_MONITOR_TEST_EMAILS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
