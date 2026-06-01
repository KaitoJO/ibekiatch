import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import './auth.css'

type Props = {
  supabase: SupabaseClient
}

export function AuthScreen({ supabase }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setMessage(null)

    const em = email.trim()
    const pw = password
    if (!em || !pw) {
      setMessage({ type: 'err', text: 'メールアドレスとパスワードを入力してください。' })
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: em, password: pw })
        if (error) throw error
        setMessage({
          type: 'ok',
          text: '登録メールを送信しました。メール内のリンクを確認するか、確認をオフにしている場合はそのままログインできます。',
        })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw })
        if (error) throw error
      }
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__inner">
        <div className="auth-screen__brand">
          <div className="auth-screen__logo" aria-hidden>
            🚚
          </div>
          <h1 className="auth-screen__title">ibekiatch</h1>
          <p className="auth-screen__subtitle">キッチンカーアカウントでログイン</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tabs__btn${mode === 'login' ? ' auth-tabs__btn--active' : ''}`}
            onClick={() => {
              setMode('login')
              setMessage(null)
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`auth-tabs__btn${mode === 'signup' ? ' auth-tabs__btn--active' : ''}`}
            onClick={() => {
              setMode('signup')
              setMessage(null)
            }}
          >
            新規登録
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-form__label" htmlFor="auth-email">
            EMAIL
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            className="auth-form__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="auth-form__label" htmlFor="auth-password">
            PASSWORD
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="auth-form__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {message && (
            <div
              className={`auth-form__message auth-form__message--${message.type === 'ok' ? 'ok' : 'err'}`}
            >
              {message.text}
            </div>
          )}

          <button type="submit" className="auth-form__submit" disabled={busy}>
            {busy ? '処理中…' : mode === 'signup' ? 'アカウントを作成' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
