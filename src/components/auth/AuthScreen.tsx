import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmailRedirectTo, isEmailNotConfirmedError } from '../../lib/authConfig'
import { formatError } from '../../lib/formatError'
import { ConfirmEmailPanel } from './ConfirmEmailPanel'
import './auth.css'

type Props = {
  supabase: SupabaseClient
}

type View = 'form' | 'confirm'

export function AuthScreen({ supabase }: Props) {
  const [view, setView] = useState<View>('form')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  const startResendCooldown = () => setResendCooldown(60)

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
    if (mode === 'signup' && pw.length < 6) {
      setMessage({ type: 'err', text: 'パスワードは6文字以上で設定してください。' })
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password: pw,
          options: {
            emailRedirectTo: getEmailRedirectTo(),
          },
        })
        if (error) throw error

        if (data.session) {
          return
        }

        setView('confirm')
        setMessage(null)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw })
        if (error) {
          if (isEmailNotConfirmedError(error.message)) {
            setView('confirm')
            throw new Error(
              'メールアドレスが未確認です。確認メール内のリンクを開いてからログインしてください。',
            )
          }
          throw error
        }
      }
    } catch (err) {
      setMessage({ type: 'err', text: formatError(err) })
    } finally {
      setBusy(false)
    }
  }

  const onResendConfirmation = async () => {
    const em = email.trim()
    if (!em) {
      setMessage({ type: 'err', text: 'メールアドレスを入力してください。' })
      return
    }
    if (resendCooldown > 0) return

    setBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: em,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
        },
      })
      if (error) throw error
      startResendCooldown()
      setMessage({ type: 'ok', text: '確認メールを再送しました。' })
    } catch (err) {
      setMessage({ type: 'err', text: formatError(err) })
    } finally {
      setBusy(false)
    }
  }

  const backToLogin = () => {
    setView('form')
    setMode('login')
    setMessage(null)
    setPassword('')
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

        {view === 'confirm' ? (
          <ConfirmEmailPanel
            email={email.trim()}
            busy={busy}
            message={message}
            resendCooldown={resendCooldown}
            onResend={() => void onResendConfirmation()}
            onBackToLogin={backToLogin}
          />
        ) : (
          <>
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
              {mode === 'signup' && (
                <p className="auth-form__hint">6文字以上 · 登録後に確認メールが届きます</p>
              )}

              {message && (
                <div
                  className={`auth-form__message auth-form__message--${message.type === 'ok' ? 'ok' : 'err'}`}
                >
                  {message.text}
                </div>
              )}

              <button type="submit" className="auth-form__submit" disabled={busy}>
                {busy ? '処理中…' : mode === 'signup' ? '確認メールを送信' : 'ログイン'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
