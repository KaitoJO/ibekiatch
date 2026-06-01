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
