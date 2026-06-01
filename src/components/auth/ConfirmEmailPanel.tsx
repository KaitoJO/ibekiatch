import { Mail, RefreshCw } from 'lucide-react'
import './auth.css'

type Props = {
  email: string
  busy: boolean
  message: { type: 'ok' | 'err'; text: string } | null
  resendCooldown: number
  onResend: () => void
  onBackToLogin: () => void
}

export function ConfirmEmailPanel({
  email,
  busy,
  message,
  resendCooldown,
  onResend,
  onBackToLogin,
}: Props) {
  return (
    <div className="auth-form confirm-email">
      <div className="confirm-email__icon" aria-hidden>
        <Mail size={32} strokeWidth={2} />
      </div>
      <h2 className="confirm-email__title">確認メールを送信しました</h2>
      <p className="confirm-email__text">
        <strong>{email}</strong> 宛に確認リンクを送りました。
        メール内のリンクをタップすると登録が完了し、自動的にログインします。
      </p>
      <ul className="confirm-email__tips">
        <li>届かない場合は迷惑メールフォルダを確認</li>
        <li>リンクの有効期限は約1時間です</li>
      </ul>

      {message && (
        <div
          className={`auth-form__message auth-form__message--${message.type === 'ok' ? 'ok' : 'err'}`}
        >
          {message.text}
        </div>
      )}

      <button
        type="button"
        className="auth-form__submit"
        disabled={busy || resendCooldown > 0}
        onClick={onResend}
      >
        <RefreshCw size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
        {busy
          ? '送信中…'
          : resendCooldown > 0
            ? `再送まで ${resendCooldown} 秒`
            : '確認メールを再送'}
      </button>

      <button type="button" className="auth-form__secondary" onClick={onBackToLogin}>
        ログイン画面に戻る
      </button>
    </div>
  )
}
