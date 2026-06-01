/** Supabase / Postgrest エラーを人間が読める文字列に変換 */
export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string' && obj.message) return obj.message
    if (typeof obj.error_description === 'string') return obj.error_description
    if (typeof obj.details === 'string' && obj.details) return obj.details
    if (typeof obj.hint === 'string' && obj.hint) {
      return `${String(obj.message ?? 'エラー')} — ${obj.hint}`
    }
  }
  if (typeof err === 'string') return err
  return 'データの取得に失敗しました'
}
