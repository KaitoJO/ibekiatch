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

export function emailSendFailureMessage(): string {
  return [
    '確認メールの送信に失敗しました。',
    'テスト環境では Resend 登録メール（project01myd2002@gmail.com）宛のみ届きます。',
    '別のアドレスを使う場合は Resend でドメイン verify が必要です。',
  ].join(' ')
}
