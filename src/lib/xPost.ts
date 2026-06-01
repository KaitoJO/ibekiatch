/** プレミアム: 出店確定時に X 投稿画面を開く */
export function openXPostIntent(text: string): void {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function buildShopConfirmedPost(params: {
  title: string
  venue: string
  date: string
  area: string
}): string {
  return `🚚 出店確定！\n${params.title}\n📍 ${params.venue}（${params.area}）\n📅 ${params.date}\n#キッチンカー #出店 #イベキャッチ`
}
