import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  alreadyRegisteredMessage,
  getEmailRedirectTo,
  isAlreadyRegisteredError,
  isEmailConfirmRequired,
  isEmailNotConfirmedError,
  isEmailSendFailureError,
  isPasswordResetSendFailure,
  emailSendFailureMessage,
  passwordResetEmailMessage,
  passwordResetFailureMessage,
  signupSandboxHint,
} from '../../lib/authConfig'
import { APP_DESCRIPTION, APP_NAME } from '../../lib/brand'
import { formatError } from '../../lib/formatError'
import { ConfirmEmailPanel } from './ConfirmEmailPanel'
import './auth.css'

type Props = {
  supabase: SupabaseClient
}

type View = 'form' | 'confirm' | 'forgot' | 'new-password'

export function AuthScreen({ supabase }: Props) {
  const [view, setView] = useState<View>('form')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (/type=recovery/.test(hash)) {
      setView('new-password')
    }
  }, [])

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
        if (error) {
          if (isAlreadyRegisteredError(error.message)) {
            throw new Error(alreadyRegisteredMessage())
          }
          if (isEmailSendFailureError(error.message)) {
            throw new Error(emailSendFailureMessage())
          }
          throw error
        }

        if (data.user && data.user.identities?.length === 0) {
          throw new Error(alreadyRegisteredMessage())
        }

        if (data.session) {
          return
        }

        if (!isEmailConfirmRequired()) {
          setMessage({
            type: 'err',
            text: '登録は完了しましたがログインできませんでした。ログインタブからお試しください。',
          })
          setMode('login')
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
              'メールアドレスが未確認です。「パスワードを忘れた」から再設定するか、確認メール内のリンクを開いてください。',
            )
          }
          if (/invalid login credentials/i.test(error.message)) {
            throw new Error(
              'メールアドレスまたはパスワードが正しくありません。パスワードを忘れた場合は「パスワードを忘れた」から再設定してください。',
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

  const onForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    if (!em) {
      setMessage({ type: 'err', text: 'メールアドレスを入力してください。' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: getEmailRedirectTo(),
      })
      if (error) {
        if (isPasswordResetSendFailure(error.message)) {
          throw new Error(passwordResetFailureMessage())
        }
        throw error
      }
      setMessage({ type: 'ok', text: passwordResetEmailMessage() })
    } catch (err) {
      setMessage({ type: 'err', text: formatError(err) })
    } finally {
      setBusy(false)
    }
  }

  const onUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setMessage({ type: 'err', text: 'パスワードは6文字以上で設定してください。' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      window.history.replaceState(null, '', window.location.pathname)
      setMessage({ type: 'ok', text: 'パスワードを更新しました。ログインしています…' })
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
      if (error) {
        if (isEmailSendFailureError(error.message)) {
          throw new Error(emailSendFailureMessage())
        }
        throw error
      }
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

  if (view === 'new-password') {
    return (
      <div className="auth-screen">
        <div className="auth-screen__inner">
          <div className="auth-screen__brand">
            <h1 className="auth-screen__title">新しいパスワード</h1>
            <p className="auth-screen__subtitle">6文字以上で設定してください</p>
          </div>
          <form className="auth-form" onSubmit={onUpdatePassword}>
            <label className="auth-form__label" htmlFor="auth-new-password">
              NEW PASSWORD
            </label>
            <input
              id="auth-new-password"
              type="password"
              autoComplete="new-password"
              className="auth-form__input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {message && (
              <div
                className={`auth-form__message auth-form__message--${message.type === 'ok' ? 'ok' : 'err'}`}
              >
                {message.text}
              </div>
            )}
            <button type="submit" className="auth-form__submit" disabled={busy}>
              {busy ? '保存中…' : 'パスワードを更新'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (view === 'forgot') {
    return (
      <div className="auth-screen">
        <div className="auth-screen__inner">
          <div className="auth-screen__brand">
            <h1 className="auth-screen__title">パスワード再設定</h1>
            <p className="auth-screen__subtitle">登録メールアドレスを入力してください</p>
          </div>
          <form className="auth-form" onSubmit={onForgotPassword}>
            <label className="auth-form__label" htmlFor="auth-email-forgot">
              EMAIL
            </label>
            <input
              id="auth-email-forgot"
              type="email"
              autoComplete="email"
              className="auth-form__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {message && (
              <div
                className={`auth-form__message auth-form__message--${message.type === 'ok' ? 'ok' : 'err'}`}
              >
                {message.text}
              </div>
            )}
            <button type="submit" className="auth-form__submit" disabled={busy}>
              {busy ? '送信中…' : '再設定メールを送信'}
            </button>
            <button type="button" className="auth-form__secondary" onClick={backToLogin}>
              ログインに戻る
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__inner">
        <div className="auth-screen__brand">
          <div className="auth-screen__logo" aria-hidden>
            🚚
          </div>
          <h1 className="auth-screen__title">{APP_NAME}</h1>
          <p className="auth-screen__subtitle">{APP_DESCRIPTION}</p>
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
              {mode === 'login' && (
                <button
                  type="button"
                  className="auth-form__link"
                  onClick={() => {
                    setView('forgot')
                    setMessage(null)
                  }}
                >
                  パスワードを忘れた
                </button>
              )}
              {mode === 'signup' && (
                <>
                  <p className="auth-form__hint">
                    {isEmailConfirmRequired()
                      ? '6文字以上 · 登録後に確認メールが届きます'
                      : '6文字以上 · 登録後すぐログインできます（確認メール不要）'}
                  </p>
                  {isEmailConfirmRequired() && signupSandboxHint() && (
                    <p className="auth-form__hint auth-form__hint--warn">{signupSandboxHint()}</p>
                  )}
                </>
              )}

              {message && (
                <div
                  className={`auth-form__message auth-form__message--${message.type === 'ok' ? 'ok' : 'err'}`}
                >
                  {message.text}
                </div>
              )}

              <button type="submit" className="auth-form__submit" disabled={busy}>
                {busy ? '処理中…' : mode === 'signup' ? (isEmailConfirmRequired() ? '確認メールを送信' : '新規登録') : 'ログイン'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
