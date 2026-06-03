/** メール確認リンクのリダイレクト先（Supabase の Redirect URLs に登録済みの origin） */
export function getEmailRedirectTo(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/`
  }
  return 'https://ibekiatch.vercel.app/'
}

export function isEmailNotConfirmedError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('email not confirmed') || m.includes('email_not_confirmed')
}

export function isEmailSendFailureError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('error sending confirmation email') ||
    m.includes('error sending email') ||
    m.includes('unexpected_failure')
  )
}

/** Resend テスト送信元 — 登録メール宛以外には届かない */
export const RESEND_SANDBOX_SENDER = 'onboarding@resend.dev'

export function isResendSandboxMode(): boolean {
  const sender = import.meta.env.VITE_RESEND_SENDER_EMAIL?.trim().toLowerCase()
  if (!sender) return true
  return sender === RESEND_SANDBOX_SENDER
}

export function isEmailConfirmRequired(): boolean {
  const raw = import.meta.env.VITE_AUTH_REQUIRE_EMAIL_CONFIRM?.trim().toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return false
}

/** テスト期間のみ true — ログイン画面を出さず共有アカウントで自動サインイン */
export function isAuthDisabled(): boolean {
  const raw = import.meta.env.VITE_AUTH_DISABLED?.trim().toLowerCase()
  return raw === 'true' || raw === '1'
}

export function getTestLoginCredentials(): { email: string; password: string } | null {
  if (!isAuthDisabled()) return null
  const email = import.meta.env.VITE_TEST_LOGIN_EMAIL?.trim()
  const password = import.meta.env.VITE_TEST_LOGIN_PASSWORD?.trim()
  if (!email || !password) return null
  return { email, password }
}

/** カンマ区切り。該当メールのみ AI 収集を全件（終了済み含む）表示 */
export function getMonitorTestEmails(): string[] {
  const raw = import.meta.env.VITE_MONITOR_TEST_EMAILS?.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function canViewFullMonitorFeed(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return getMonitorTestEmails().includes(normalized)
}

export function emailSendFailureMessage(): string {
  if (isResendSandboxMode()) {
    return [
      '確認メールの送信に失敗しました。',
      '現在は Resend のテスト送信元（onboarding@resend.dev）のため、',
      'Resend に登録したメールアドレス宛にしか届きません。',
      '別のアドレスで登録する場合は、Resend でドメインを verify し、',
      'RESEND_SENDER_EMAIL を noreply@yourdomain.com に変更してから',
      'npm run auth:smtp を実行してください。',
    ].join('\n')
  }
  return [
    '確認メールの送信に失敗しました。',
    'SMTP 設定（npm run auth:smtp）と Resend の送信ログを確認してください。',
  ].join('\n')
}

export function isAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('user already registered') || m.includes('already been registered')
}

export function alreadyRegisteredMessage(): string {
  return 'このメールアドレスは既に登録されています。「ログイン」タブからパスワードを入力するか、下の「パスワードを忘れた」から再設定してください。'
}

export function passwordResetEmailMessage(): string {
  return 'パスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。届かない場合は迷惑メールフォルダも確認してください。'
}

export function isPasswordResetSendFailure(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('error sending recovery email') || m.includes('error sending email')
}

export function passwordResetFailureMessage(): string {
  return [
    'パスワード再設定メールの送信に失敗しました。',
    '登録済みのアカウントは存在しますが、現在メール送信設定の都合で icloud 等の一部アドレスに届きません。',
    'お手数ですがサポート（project01myd2002@gmail.com）までご連絡ください。こちらで再設定リンクを発行します。',
  ].join('\n')
}

export function signupSandboxHint(): string {
  if (!isResendSandboxMode()) return ''
  return 'テスト中: 確認メールは Resend 登録メール宛にのみ届きます。他のアドレスはドメイン verify 後に利用可能です。'
}
