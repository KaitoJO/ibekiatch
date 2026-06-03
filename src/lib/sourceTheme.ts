/** 監視ソースの表示名・カード背景色 */
export const SOURCE_LABELS: Record<string, string> = {
  kokuchiz: 'こくちーず',
  peatix: 'Peatix',
  google_news: 'Googleニュース',
  jmty: 'ジモティー',
  twitter: 'X',
  instagram: 'Instagram',
  threads: 'Threads',
  mie_cities: '市町村HP',
  shokokai: '商工会',
  michinoeki: '道の駅',
  eventbank: 'イベントバンク',
  maipure_mie: 'まいぷれ三重',
  mellow_shopstop: 'MELLOW SHOP STOP',
  mobimaru: 'Mobimaru',
  kitchencar_madoguchi: 'キッチンカーの窓口',
  aeon_mall: 'イオンモール',
  outlet_mall: 'アウトレット',
  mie_tourism: '観光協会',
  mie_news: '新聞',
  mie_fm: '三重FM',
  ja_mie: 'JA三重',
  facebook: 'Facebook',
}

/** ソースごとの hero 背景（こくちーず=緑、ジモティー=オレンジ 等） */
export const SOURCE_GRADIENTS: Record<string, string> = {
  kokuchiz: 'linear-gradient(145deg, #22c55e 0%, #15803d 100%)',
  jmty: 'linear-gradient(145deg, #fb923c 0%, #c2410c 100%)',
  peatix: 'linear-gradient(145deg, #f472b6 0%, #db2777 100%)',
  google_news: 'linear-gradient(145deg, #60a5fa 0%, #2563eb 100%)',
  twitter: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
  instagram: 'linear-gradient(145deg, #f97316 0%, #9333ea 100%)',
  threads: 'linear-gradient(145deg, #525252 0%, #171717 100%)',
  mie_cities: 'linear-gradient(145deg, #38bdf8 0%, #0284c7 100%)',
  shokokai: 'linear-gradient(145deg, #a78bfa 0%, #7c3aed 100%)',
  michinoeki: 'linear-gradient(145deg, #4ade80 0%, #059669 100%)',
  eventbank: 'linear-gradient(145deg, #fbbf24 0%, #d97706 100%)',
  maipure_mie: 'linear-gradient(145deg, #f87171 0%, #dc2626 100%)',
  mellow_shopstop: 'linear-gradient(145deg, #c084fc 0%, #9333ea 100%)',
  mobimaru: 'linear-gradient(145deg, #2dd4bf 0%, #0d9488 100%)',
  kitchencar_madoguchi: 'linear-gradient(145deg, #fcd34d 0%, #ca8a04 100%)',
  aeon_mall: 'linear-gradient(145deg, #f43f5e 0%, #be123c 100%)',
  outlet_mall: 'linear-gradient(145deg, #818cf8 0%, #4338ca 100%)',
  mie_tourism: 'linear-gradient(145deg, #34d399 0%, #047857 100%)',
  mie_news: 'linear-gradient(145deg, #94a3b8 0%, #475569 100%)',
  mie_fm: 'linear-gradient(145deg, #fb7185 0%, #e11d48 100%)',
  ja_mie: 'linear-gradient(145deg, #84cc16 0%, #4d7c0f 100%)',
  facebook: 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)',
}

const DEFAULT_COLLECTED_GRADIENT = 'linear-gradient(145deg, #64748b 0%, #475569 100%)'
const HOST_GRADIENT = 'linear-gradient(145deg, #6366f1 0%, #4f46e5 100%)'

export function getSourceLabel(sourceId: string | null | undefined): string | null {
  if (!sourceId) return null
  return SOURCE_LABELS[sourceId] ?? sourceId
}

export function getEventHeroBackground(
  origin: 'collected' | 'host',
  sourceId: string | null | undefined,
): string {
  if (origin === 'host') return HOST_GRADIENT
  if (sourceId && SOURCE_GRADIENTS[sourceId]) return SOURCE_GRADIENTS[sourceId]
  return DEFAULT_COLLECTED_GRADIENT
}
