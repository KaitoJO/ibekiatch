import { isSupabaseConfigured } from '../../lib/supabaseClient'
import './auth.css'

export function SetupScreen() {
  return (
    <div className="setup-screen">
      <div className="setup-screen__card">
        <h1 className="setup-screen__title">Supabase の環境変数が未設定です</h1>
        <p className="setup-screen__text">
          プロジェクト直下に <code>.env</code> を作成し、
          <code> VITE_SUPABASE_URL </code> と <code> VITE_SUPABASE_ANON_KEY </code>{' '}
          を設定してください。データベースのテーブル作成と Row Level Security の手順は{' '}
          <code>docs/SUPABASE_SETUP.md</code> を参照してください。
        </p>
      </div>
    </div>
  )
}

export function LoadingScreen({ label = '認証を確認中…' }: { label?: string }) {
  return <div className="loading-screen">{label}</div>
}

export { isSupabaseConfigured }
